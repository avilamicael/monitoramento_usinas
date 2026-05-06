"""Motor de alertas interno.

Orquestra as regras registradas em `alertas.regras` contra as leituras
mais recentes e aplica a política sem histerese: um único alerta aberto
por `(usina, inversor, regra)`. Resultado da regra:

- `Anomalia`   → abre novo alerta, ou atualiza `mensagem`/`contexto` do aberto.
- `False`      → se há alerta aberto, resolve; senão nada.
- `None`       → regra não avaliou (dado ausente); mantém estado anterior.

Agregação por usina (regra com `agregar_por_usina=True`):
    Em vez de criar 1 alerta por inversor, o motor consolida todas as
    anomalias da mesma regra dentro da usina em **um único** alerta com
    `inversor=NULL`. O `contexto` traz a lista de inversores afetados
    (SN + valores). Útil em regras cuja causa é compartilhada (rede da
    concessionária, ambiente da usina) — ex.: `sobretensao_ac`.

    Em PostgreSQL, NULL ≠ NULL na `UniqueConstraint` parcial do `Alerta`,
    então um alerta agregado por (usina, regra) NÃO conflita com possíveis
    alertas legados por (usina, inversor, regra). Ainda assim, antes do
    primeiro ciclo após marcar uma regra como agregadora, rode o command
    `migrar_alertas_para_agregados` para fechar os antigos.

Ganchos:
- `avaliar_empresa(empresa_id)` é síncrono — pode ser chamado do shell.
- `avaliar_empresa_em_commit(empresa_id)` agenda pós-commit — usado pela
  task de coleta.
"""
from __future__ import annotations

import logging

from django.db import transaction
from django.utils import timezone as djtz

from apps.alertas.labels import rotular_regra
from apps.alertas.models import (
    Alerta,
    ConfiguracaoRegra,
    EstadoAlerta,
    SeveridadeAlerta,
)
from apps.alertas.regras import Anomalia, RegraInversor, RegraUsina, regras_registradas
from apps.core.models import ConfiguracaoEmpresa
from apps.inversores.models import Inversor
from apps.monitoramento.models import LeituraInversor, LeituraUsina
from apps.usinas.models import Usina

logger = logging.getLogger(__name__)


# Ordem de severidade para "max" entre múltiplas anomalias agregadas.
_ORDEM_SEVERIDADE = {
    SeveridadeAlerta.INFO: 0,
    SeveridadeAlerta.AVISO: 1,
    SeveridadeAlerta.CRITICO: 2,
}


def _max_severidade(severidades) -> SeveridadeAlerta:
    return max(severidades, key=lambda s: _ORDEM_SEVERIDADE.get(s, 0))


def _aplicar_override_severidade(resultado, severidade_override):
    """Sobrescreve `severidade` da `Anomalia` quando há override configurado.

    Para regras com `severidade_dinamica=True`, o motor passa
    `severidade_override=None` e o resultado é devolvido intacto. Para regras
    fixas com override, devolve uma `Anomalia` nova (preservando `mensagem`/
    `contexto`). `False` e `None` passam direto.
    """
    if severidade_override is None:
        return resultado
    if not isinstance(resultado, Anomalia):
        return resultado
    return Anomalia(
        severidade=severidade_override,
        mensagem=resultado.mensagem,
        contexto=resultado.contexto,
    )


def _carregar_regras() -> None:
    """Força import dos módulos em `alertas.regras.*` pra ativar `@registrar`."""
    from apps.alertas.regras import (  # noqa: F401
        dado_eletrico_ausente,
        frequencia_anomala,
        garantia_vencendo,
        inversor_offline,
        queda_rendimento,
        sem_comunicacao,
        sem_geracao_horario_solar,
        sobretensao_ac,
        string_mppt_zerada,
        subdesempenho,
        subtensao_ac,
        temperatura_alta,
    )


def _ultima_leitura_usina(usina: Usina) -> LeituraUsina | None:
    return (
        LeituraUsina.objects.filter(usina=usina)
        .order_by("-coletado_em")
        .first()
    )


def _ultima_leitura_inversor(inversor: Inversor) -> LeituraInversor | None:
    return (
        LeituraInversor.objects.filter(inversor=inversor)
        .order_by("-coletado_em")
        .first()
    )


def _aplicar(
    *,
    usina: Usina,
    inversor: Inversor | None,
    regra_nome: str,
    resultado,
) -> tuple[int, int]:
    """Aplica o resultado da regra no banco. Retorna (abertos, resolvidos)."""
    if resultado is None:
        return (0, 0)

    existente = (
        Alerta.objects.filter(
            usina=usina,
            inversor=inversor,
            regra=regra_nome,
            estado=EstadoAlerta.ABERTO,
        )
        .order_by("-aberto_em")
        .first()
    )

    if resultado is False:
        if existente:
            Alerta.objects.filter(pk=existente.pk).update(
                estado=EstadoAlerta.RESOLVIDO,
                resolvido_em=djtz.now(),
            )
            return (0, 1)
        return (0, 0)

    # resultado é Anomalia
    anomalia = resultado
    if existente:
        # Atualiza in-place; `aberto_em` preservado (auto_now_add não refaz).
        Alerta.objects.filter(pk=existente.pk).update(
            severidade=anomalia.severidade,
            mensagem=anomalia.mensagem,
            contexto=anomalia.contexto,
        )
        return (0, 0)

    Alerta.objects.create(
        empresa=usina.empresa,
        usina=usina,
        inversor=inversor,
        regra=regra_nome,
        severidade=anomalia.severidade,
        mensagem=anomalia.mensagem,
        contexto=anomalia.contexto,
    )
    return (1, 0)


def _aplicar_agregado(
    *,
    usina: Usina,
    regra_nome: str,
    severidade_padrao: SeveridadeAlerta,
    respostas: list,
) -> tuple[int, int]:
    """Consolida respostas por inversor em um único alerta `(usina, regra)`
    com `inversor=None`.

    Política:
    - 1+ `Anomalia` em respostas → cria/atualiza alerta agregado com a
      severidade máxima e contexto listando os inversores afetados.
    - Nenhuma `Anomalia` mas 1+ `False` (algum inversor leu condição
      claramente falsa) → resolve alerta agregado se houver. Pelo menos
      uma leitura concreta confirma que o problema cessou.
    - Apenas `None` em todas as respostas → noop (regra inaplicável em
      todos; mantém estado anterior).
    """
    anomalias = [(inv, r) for inv, r in respostas if isinstance(r, Anomalia)]
    if anomalias:
        severidade = _max_severidade(
            (a.severidade for _, a in anomalias)
        )
        # Para 1 inversor afetado usa a mensagem específica dele;
        # para N>1, mensagem genérica com contagem. As individuais ficam
        # em `contexto.inversores` (UI mostra detalhe na expansão).
        n = len(anomalias)
        if n == 1:
            mensagem = anomalias[0][1].mensagem
        else:
            mensagem = f"{n} inversores com {rotular_regra(regra_nome)}."

        contexto = {
            "regra": regra_nome,
            "agregado": True,
            "qtd_inversores_afetados": n,
            "total_inversores_da_usina": len(respostas),
            "inversores": [
                {
                    "id": inv.pk,
                    "numero_serie": inv.numero_serie,
                    "id_externo": inv.id_externo,
                    "mensagem": a.mensagem,
                    "severidade": a.severidade,
                    **(a.contexto or {}),
                }
                for inv, a in anomalias
            ],
        }
        return _aplicar(
            usina=usina,
            inversor=None,
            regra_nome=regra_nome,
            resultado=Anomalia(
                severidade=severidade,
                mensagem=mensagem,
                contexto=contexto,
            ),
        )

    # Sem anomalias. Se ao menos uma leitura concreta voltou False,
    # podemos resolver — alguma evidência confirma que cessou.
    if any(r is False for _, r in respostas):
        return _aplicar(
            usina=usina,
            inversor=None,
            regra_nome=regra_nome,
            resultado=False,
        )

    # Tudo None (ou respostas vazias) — noop.
    return (0, 0)


# Regras que rodam apenas via task diária (não a cada coleta).
# Motivo: a métrica não muda em ritmo útil entre coletas e/ou a query
# de baseline é mais cara — uma vez por dia basta.
REGRAS_DIARIAS = {"garantia_vencendo", "queda_rendimento"}


def avaliar_empresa(empresa_id, *, apenas_diarias: bool = False) -> dict:
    """Roda regras de alerta para a empresa.

    Por padrão (`apenas_diarias=False`) executa todas as regras EXCETO as
    de `REGRAS_DIARIAS` — chamado pelo worker depois de cada coleta.

    Com `apenas_diarias=True`, executa SOMENTE as de `REGRAS_DIARIAS` —
    chamado por uma task Celery diária.
    """
    _carregar_regras()

    config, _ = ConfiguracaoEmpresa.objects.get_or_create(
        empresa_id=empresa_id
    )

    # Overrides por regra para esta empresa. Carregados em 1 query e usados
    # ao longo do loop. Quando não há linha, defaults vêm do código da regra.
    overrides = {
        cr.regra_nome: cr
        for cr in ConfiguracaoRegra.objects.filter(empresa_id=empresa_id)
    }

    abertos = resolvidos = 0
    todas = regras_registradas()
    if apenas_diarias:
        regras = [r for r in todas if r.nome in REGRAS_DIARIAS]
    else:
        regras = [r for r in todas if r.nome not in REGRAS_DIARIAS]

    # Filtra regras desativadas pela empresa. Alertas abertos pré-existentes
    # NÃO são fechados por silêncio — F1/C3 trata o "regra desativada" com
    # flag separada.
    regras = [r for r in regras if not (overrides.get(r.nome) and not overrides[r.nome].ativa)]

    qs = (
        Usina.objects
        .filter(empresa_id=empresa_id, is_active=True)
        .select_related("garantia")
    )
    for usina in qs:
        # Política de produto: usinas sem garantia ativa não geram alertas.
        # Cobrança e SLA seguem a garantia; sem ela, monitorar virtualmente
        # vira ruído. Resolvidos pré-existentes ficam preservados (histórico).
        garantia = getattr(usina, "garantia", None)
        if garantia is None or not garantia.is_active:
            continue

        leitura_u = _ultima_leitura_usina(usina)
        for regra_cls in regras:
            if not issubclass(regra_cls, RegraUsina):
                continue
            try:
                r = regra_cls().avaliar(usina, leitura_u, config)
            except Exception:
                logger.exception("regra %s falhou em usina %s", regra_cls.nome, usina.pk)
                continue
            cfg = overrides.get(regra_cls.nome)
            severidade_override = (
                cfg.severidade
                if cfg is not None and not regra_cls.severidade_dinamica
                else None
            )
            r = _aplicar_override_severidade(r, severidade_override)
            a, r_ = _aplicar(
                usina=usina,
                inversor=None,
                regra_nome=regra_cls.nome,
                resultado=r,
            )
            abertos += a
            resolvidos += r_

        if not usina.expoe_dados_inversor:
            continue

        regras_inversor = [r for r in regras if issubclass(r, RegraInversor)]
        if not regras_inversor:
            continue

        # Carrega leitura atual de cada inversor uma única vez por usina,
        # pra reusar nas múltiplas regras de inversor.
        inversores = list(Inversor.objects.filter(usina=usina, is_active=True))
        leituras_inv = {
            inv.pk: _ultima_leitura_inversor(inv) for inv in inversores
        }

        for regra_cls in regras_inversor:
            agregar = getattr(regra_cls, "agregar_por_usina", False)
            cfg = overrides.get(regra_cls.nome)
            severidade_override = (
                cfg.severidade
                if cfg is not None and not regra_cls.severidade_dinamica
                else None
            )
            respostas = []  # list[(inversor, resultado)]
            for inv in inversores:
                leitura_i = leituras_inv[inv.pk]
                try:
                    r = regra_cls().avaliar(inv, leitura_i, config)
                except Exception:
                    logger.exception(
                        "regra %s falhou em inversor %s", regra_cls.nome, inv.pk
                    )
                    continue
                r = _aplicar_override_severidade(r, severidade_override)
                respostas.append((inv, r))

            if agregar:
                a, r_ = _aplicar_agregado(
                    usina=usina,
                    regra_nome=regra_cls.nome,
                    severidade_padrao=regra_cls.severidade_padrao,
                    respostas=respostas,
                )
                abertos += a
                resolvidos += r_
            else:
                for inv, r in respostas:
                    a, r_ = _aplicar(
                        usina=usina,
                        inversor=inv,
                        regra_nome=regra_cls.nome,
                        resultado=r,
                    )
                    abertos += a
                    resolvidos += r_

    logger.info(
        "motor.avaliar_empresa(%s): abertos=%d resolvidos=%d",
        empresa_id, abertos, resolvidos,
    )
    return {"abertos": abertos, "resolvidos": resolvidos}


def avaliar_empresa_em_commit(empresa_id) -> None:
    """Agenda `avaliar_empresa` para rodar após o commit da transação atual.

    Se chamado fora de transação, executa imediatamente.
    """
    transaction.on_commit(lambda: avaliar_empresa(empresa_id))
