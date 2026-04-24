"""Motor de alertas interno.

Orquestra as regras registradas em `alertas.regras` contra as leituras
mais recentes e aplica a política sem histerese: um único alerta aberto
por `(usina, inversor, regra)`. Resultado da regra:

- `Anomalia`   → abre novo alerta, ou atualiza `mensagem`/`contexto` do aberto.
- `False`      → se há alerta aberto, resolve; senão nada.
- `None`       → regra não avaliou (dado ausente); mantém estado anterior.

Ganchos:
- `avaliar_empresa(empresa_id)` é síncrono — pode ser chamado do shell.
- `avaliar_empresa_em_commit(empresa_id)` agenda pós-commit — usado pela
  task de coleta.
"""
from __future__ import annotations

import logging

from django.db import transaction
from django.utils import timezone as djtz

from apps.alertas.models import Alerta, EstadoAlerta
from apps.alertas.regras import RegraInversor, RegraUsina, regras_registradas
from apps.core.models import ConfiguracaoEmpresa
from apps.inversores.models import Inversor
from apps.monitoramento.models import LeituraInversor, LeituraUsina
from apps.usinas.models import Usina

logger = logging.getLogger(__name__)


def _carregar_regras() -> None:
    """Força import dos módulos em `alertas.regras.*` pra ativar `@registrar`."""
    # Cada regra registrada aqui.
    from apps.alertas.regras import sem_comunicacao, sobretensao_ac  # noqa: F401


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


def avaliar_empresa(empresa_id) -> dict:
    """Roda todas as regras para todas as usinas/inversores da empresa."""
    _carregar_regras()

    config, _ = ConfiguracaoEmpresa.objects.get_or_create(
        empresa_id=empresa_id
    )

    abertos = resolvidos = 0
    regras = regras_registradas()

    for usina in Usina.objects.filter(empresa_id=empresa_id, is_active=True):
        leitura_u = _ultima_leitura_usina(usina)
        for regra_cls in regras:
            if not issubclass(regra_cls, RegraUsina):
                continue
            try:
                r = regra_cls().avaliar(usina, leitura_u, config)
            except Exception:  # noqa: BLE001
                logger.exception("regra %s falhou em usina %s", regra_cls.nome, usina.pk)
                continue
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
        for inversor in Inversor.objects.filter(usina=usina, is_active=True):
            leitura_i = _ultima_leitura_inversor(inversor)
            for regra_cls in regras:
                if not issubclass(regra_cls, RegraInversor):
                    continue
                try:
                    r = regra_cls().avaliar(inversor, leitura_i, config)
                except Exception:  # noqa: BLE001
                    logger.exception(
                        "regra %s falhou em inversor %s", regra_cls.nome, inversor.pk
                    )
                    continue
                a, r_ = _aplicar(
                    usina=usina,
                    inversor=inversor,
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
