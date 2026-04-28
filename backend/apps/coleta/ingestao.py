"""Serviço de ingestão: traduz dataclasses dos adapters para operações no banco.

Invariantes:
- Uma chamada = um ciclo de coleta. `coletado_em` é arredondado para a janela
  (default 10 min) e reaproveitado para todas as leituras do ciclo, garantindo
  que uma re-execução do mesmo ciclo seja idempotente (UniqueConstraint).
- Todas as operações rodam dentro de uma transação atômica externa (a task
  que chama o serviço abre `with transaction.atomic()`).
- Na primeira coleta de uma usina, a `Garantia` é criada automaticamente com
  prazo vindo de `ConfiguracaoEmpresa.garantia_padrao_meses`.
- `Usina.expoe_dados_inversor` é (re)definido conforme o adapter retorna
  dados de inversor — worker pode reexecutar o fluxo de inversor mesmo em
  usinas criadas antes do campo existir.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from django.db import transaction
from django.utils import timezone as djtz

from apps.alertas.models import Alerta, EstadoAlerta
from apps.core.models import ConfiguracaoEmpresa
from apps.garantia.models import Garantia
from apps.inversores.models import Inversor, TipoInversor
from apps.monitoramento.models import LeituraInversor, LeituraUsina
from apps.provedores.adapters.base import DadosInversor, DadosUsina
from apps.provedores.models import ContaProvedor
from apps.usinas.models import TipoEquipamento, Usina

logger = logging.getLogger(__name__)

JANELA_COLETA_MIN = 10


def _serializar_json(valor):
    """Converte Decimal recursivamente pra str — JSONField não aceita Decimal."""
    if isinstance(valor, Decimal):
        return str(valor)
    if isinstance(valor, dict):
        return {k: _serializar_json(v) for k, v in valor.items()}
    if isinstance(valor, list):
        return [_serializar_json(v) for v in valor]
    return valor


def arredondar_janela(dt: datetime, minutos: int = JANELA_COLETA_MIN) -> datetime:
    """Arredonda para o múltiplo anterior de `minutos`.

    Dois ciclos de coleta na mesma janela geram o mesmo `coletado_em`, o que
    casa com `UniqueConstraint(usina, coletado_em)` e torna a ingestão
    idempotente.
    """
    tam = minutos * 60
    ts = int(dt.timestamp())
    return datetime.fromtimestamp((ts // tam) * tam, tz=timezone.utc)


@dataclass
class ResultadoIngestao:
    usinas_vistas: int = 0
    usinas_criadas: int = 0
    inversores_vistos: int = 0
    inversores_criados: int = 0
    leituras_usina_criadas: int = 0
    leituras_inversor_criadas: int = 0
    alertas_abertos: int = 0
    alertas_resolvidos: int = 0


class ServicoIngestao:
    """Instanciar uma vez por ciclo de coleta — guarda `coletado_em` e
    acumuladores."""

    def __init__(self, conta: ContaProvedor, agora: datetime | None = None) -> None:
        self.conta = conta
        self.agora = agora or djtz.now()
        self.coletado_em = arredondar_janela(self.agora)
        self.resultado = ResultadoIngestao()

    # ── Usina ────────────────────────────────────────────────────────────

    def processar_usina(
        self, dados: DadosUsina, *, expoe_dados_inversor: bool
    ) -> Usina:
        """Garante que a usina existe e grava a leitura do ciclo.

        Também mantém `Usina.expoe_dados_inversor` e `ultima_leitura_em`
        sincronizados — o primeiro controla o fluxo de `Inversor`/`LeituraInversor`,
        o segundo alimenta regras de alerta e dashboards.
        """
        usina = self._upsert_usina(dados, expoe_dados_inversor=expoe_dados_inversor)
        criada = self._criar_leitura_usina(usina, dados)
        if criada:
            self.resultado.leituras_usina_criadas += 1
        self.resultado.usinas_vistas += 1
        return usina

    def _upsert_usina(
        self, dados: DadosUsina, *, expoe_dados_inversor: bool
    ) -> Usina:
        defaults = {
            "empresa": self.conta.empresa,
            "nome": dados.nome,
            "endereco": dados.endereco,
            "cidade": dados.cidade,
            "estado": dados.estado,
            "latitude": dados.latitude,
            "longitude": dados.longitude,
            "fuso_horario": dados.fuso_horario,
            "capacidade_kwp": dados.capacidade_kwp,
            "expoe_dados_inversor": expoe_dados_inversor,
            "tipo_equipamento": TipoEquipamento.INDEFINIDO,
        }
        usina, criada = Usina.objects.get_or_create(
            conta_provedor=self.conta,
            id_externo=dados.id_externo,
            defaults=defaults,
        )
        if criada:
            self.resultado.usinas_criadas += 1
            self._criar_garantia_padrao(usina)
            return usina

        # Atualiza só os campos que mudaram — evita reescrever updated_at à toa.
        alterados: list[str] = []
        for campo, novo in (
            ("nome", dados.nome),
            ("endereco", dados.endereco),
            ("cidade", dados.cidade),
            ("estado", dados.estado),
            ("capacidade_kwp", dados.capacidade_kwp),
            ("expoe_dados_inversor", expoe_dados_inversor),
        ):
            if novo and getattr(usina, campo) != novo:
                setattr(usina, campo, novo)
                alterados.append(campo)
        if alterados:
            usina.save(update_fields=alterados + ["updated_at"])
        return usina

    def _criar_leitura_usina(self, usina: Usina, dados: DadosUsina) -> bool:
        _, criada = LeituraUsina.objects.get_or_create(
            usina=usina,
            coletado_em=self.coletado_em,
            defaults={
                "empresa": self.conta.empresa,
                "medido_em": dados.medido_em,
                "potencia_kw": dados.potencia_kw or 0,
                "energia_hoje_kwh": dados.energia_hoje_kwh or 0,
                "energia_mes_kwh": dados.energia_mes_kwh,
                "energia_total_kwh": dados.energia_total_kwh or 0,
                "status": dados.status,
                "qtd_inversores_total": dados.qtd_inversores_total,
                "qtd_inversores_online": dados.qtd_inversores_online,
                "raw": dados.raw,
            },
        )
        if criada and dados.medido_em is not None:
            # `ultima_leitura_em` é o sinal usado pela regra `sem_comunicacao`.
            # SÓ preenche quando o provedor expõe `medido_em` — preencher com
            # `coletado_em` mascararia o sinal de Wi-Fi caído (a API responde
            # 200 OK mesmo com o datalogger offline há dias).
            #
            # Provedores sem `medido_em` (FusionSolar, Foxess hoje): a usina
            # fica com `ultima_leitura_em = null`, `sem_comunicacao` retorna
            # None (não avalia). Detecção fica por conta de
            # `sem_geracao_horario_solar` e `dado_eletrico_ausente`.
            Usina.objects.filter(pk=usina.pk).update(
                ultima_leitura_em=dados.medido_em,
            )
        return criada

    def _criar_garantia_padrao(self, usina: Usina) -> None:
        config, _ = ConfiguracaoEmpresa.objects.get_or_create(
            empresa=self.conta.empresa
        )
        Garantia.objects.get_or_create(
            usina=usina,
            defaults={
                "empresa": self.conta.empresa,
                "inicio_em": djtz.localdate(),
                "meses": config.garantia_padrao_meses,
                "observacoes": "Garantia padrão criada na primeira coleta.",
            },
        )

    # ── Inversor ─────────────────────────────────────────────────────────

    def processar_inversor(
        self, usina: Usina, dados: DadosInversor
    ) -> Inversor:
        inversor = self._upsert_inversor(usina, dados)
        criada = self._criar_leitura_inversor(usina, inversor, dados)
        if criada:
            self.resultado.leituras_inversor_criadas += 1
        self.resultado.inversores_vistos += 1
        return inversor

    def _upsert_inversor(self, usina: Usina, dados: DadosInversor) -> Inversor:
        tipo = TipoInversor(dados.tipo) if dados.tipo in TipoInversor.values else TipoInversor.INVERSOR
        inversor, criada = Inversor.objects.get_or_create(
            usina=usina,
            id_externo=dados.id_externo,
            defaults={
                "empresa": self.conta.empresa,
                "numero_serie": dados.numero_serie,
                "modelo": dados.modelo,
                "tipo": tipo,
            },
        )
        if criada:
            self.resultado.inversores_criados += 1
            return inversor

        alterados: list[str] = []
        for campo, novo in (
            ("numero_serie", dados.numero_serie),
            ("modelo", dados.modelo),
            ("tipo", tipo),
        ):
            if novo and getattr(inversor, campo) != novo:
                setattr(inversor, campo, novo)
                alterados.append(campo)
        if alterados:
            inversor.save(update_fields=alterados + ["updated_at"])
        return inversor

    def _criar_leitura_inversor(
        self, usina: Usina, inversor: Inversor, dados: DadosInversor
    ) -> bool:
        _, criada = LeituraInversor.objects.get_or_create(
            inversor=inversor,
            coletado_em=self.coletado_em,
            defaults={
                "empresa": self.conta.empresa,
                "usina": usina,
                "medido_em": dados.medido_em,
                "estado": dados.estado,
                "pac_kw": dados.pac_kw or 0,
                "energia_hoje_kwh": dados.energia_hoje_kwh or 0,
                "energia_total_kwh": dados.energia_total_kwh or 0,
                "tensao_ac_v": dados.tensao_ac_v,
                "corrente_ac_a": dados.corrente_ac_a,
                "frequencia_hz": dados.frequencia_hz,
                "tensao_dc_v": dados.tensao_dc_v,
                "corrente_dc_a": dados.corrente_dc_a,
                "temperatura_c": dados.temperatura_c,
                "soc_bateria_pct": dados.soc_bateria_pct,
                "tipo_ligacao": dados.tipo_ligacao,
                "eletrica_ac": _serializar_json(dados.eletrica_ac),
                "strings_mppt": [
                    {
                        "indice": s.indice,
                        "tensao_v": str(s.tensao_v) if s.tensao_v is not None else None,
                        "corrente_a": str(s.corrente_a) if s.corrente_a is not None else None,
                        "potencia_w": str(s.potencia_w) if s.potencia_w is not None else None,
                    }
                    for s in dados.strings_mppt
                ],
                "raw": dados.raw,
            },
        )
        if criada and dados.medido_em is not None:
            # Mesma lógica de `_criar_leitura_usina`: `ultima_leitura_em`
            # só recebe `medido_em`, nunca `coletado_em`.
            Inversor.objects.filter(pk=inversor.pk).update(
                ultima_leitura_em=dados.medido_em,
            )
        return criada


@transaction.atomic
def ingerir_ciclo(
    conta: ContaProvedor,
    usinas: list[DadosUsina],
    inversores_por_usina: dict[str, list[DadosInversor]],
    *,
    expoe_dados_inversor: bool,
    agora: datetime | None = None,
) -> ResultadoIngestao:
    """Entry point para a task Celery. Processa o ciclo inteiro em transação.

    `inversores_por_usina`: dict `{id_externo_da_usina: [DadosInversor, ...]}`.
    Vazio quando `expoe_dados_inversor=False` — o adapter nem precisa coletar.
    """
    servico = ServicoIngestao(conta, agora=agora)

    for dados_usina in usinas:
        usina = servico.processar_usina(
            dados_usina, expoe_dados_inversor=expoe_dados_inversor
        )
        if not expoe_dados_inversor:
            continue
        for dados_inv in inversores_por_usina.get(dados_usina.id_externo, []):
            servico.processar_inversor(usina, dados_inv)

    logger.info(
        "coleta: conta=%s usinas=%d(novas=%d) invs=%d(novos=%d) leituras_u=%d leituras_i=%d",
        conta.pk,
        servico.resultado.usinas_vistas,
        servico.resultado.usinas_criadas,
        servico.resultado.inversores_vistos,
        servico.resultado.inversores_criados,
        servico.resultado.leituras_usina_criadas,
        servico.resultado.leituras_inversor_criadas,
    )
    return servico.resultado
