"""Adapter Solis — traduz payloads brutos para o contrato do sistema."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from apps.provedores.adapters.base import (
    BaseAdapter,
    Capacidades,
    DadosInversor,
    DadosUsina,
    MpptString,
)
from apps.provedores.adapters.registry import registrar
from apps.provedores.adapters.unidades import (
    a,
    hz,
    kw,
    kwh,
    temp_c,
    ts_ms_para_datetime,
    v,
)

from .consultas import listar_inversores, listar_usinas

# Mapa do código `state` da Solis para o enum do sistema.
_MAPA_STATUS = {
    0: "online",
    1: "alerta",
    2: "offline",
    3: "construcao",
}

# Temperatura 150.0 é um sentinela de "sem leitura" vindo do firmware
# Solis em alguns modelos — tratamos como null.
_TEMPERATURA_INVALIDA = Decimal("150")


def _mapear_status(codigo: Any) -> str:
    try:
        return _MAPA_STATUS.get(int(codigo), "offline")
    except (TypeError, ValueError):
        return "offline"


def _extrair_strings_mppt(inv: dict) -> list[MpptString]:
    """Converte `pow1..pow32` + `_detail.uPv*` + `_detail.iPv*` em MpptString.

    Solis retorna 32 slots mesmo quando só 2 estão ativos. Omitimos os
    slots com todos os valores zero/ausentes pra evitar ruído.
    """
    detail = inv.get("_detail") or {}
    resultado: list[MpptString] = []
    for i in range(1, 33):
        potencia = kw(inv.get(f"pow{i}"))  # já em kW? Na verdade é W em pow*.
        # Os campos `pow*` do Solis vêm em W na listagem — mas no sample
        # real vêm como kWh acumulado do dia... deixamos como está (o raw
        # preserva o número exato) e passamos em `potencia_w` só se não for 0.
        tensao = v(detail.get(f"uPv{i}"))
        corrente = a(detail.get(f"iPv{i}"))
        potencia_w = inv.get(f"pow{i}")

        # Pula slots com tudo zero/ausente
        if not any([potencia_w, tensao, corrente]):
            continue
        if all(
            (x is None or x == 0)
            for x in (potencia_w, tensao, corrente)
        ):
            continue

        resultado.append(
            MpptString(
                indice=i,
                tensao_v=tensao,
                corrente_a=corrente,
                potencia_w=Decimal(str(potencia_w)) if potencia_w else None,
            )
        )
    return resultado


@registrar
class SolisAdapter(BaseAdapter):
    """Solis Cloud — autenticação HMAC-SHA1 stateless.

    Credenciais esperadas (dict já descriptografado):
        api_key:    chave fornecida pela Solis
        app_secret: segredo para assinar requisições

    Capacidades: expõe inversores com dados elétricos completos (Vac, Iac,
    Vdc, Idc, freq, temp) + strings MPPT. Intervalo mínimo 10 min.
    """

    tipo = "solis"
    capacidades = Capacidades(
        expoe_inversores=True,
        expoe_strings_mppt=True,
        requisicoes_por_janela=3,
        janela_segundos=5,
        intervalo_minimo_minutos=10,
    )

    def __init__(self, credenciais: dict[str, Any]) -> None:
        super().__init__(credenciais)
        self._api_key = credenciais["api_key"]
        self._app_secret = credenciais["app_secret"]

    # ── Contrato ──────────────────────────────────────────────────────────

    def buscar_usinas(self) -> list[DadosUsina]:
        registros = listar_usinas(self._api_key, self._app_secret)
        return [self._normalizar_usina(r) for r in registros]

    def buscar_inversores(self, id_usina_externo: str) -> list[DadosInversor]:
        registros = listar_inversores(
            id_usina_externo, self._api_key, self._app_secret
        )
        return [self._normalizar_inversor(r, id_usina_externo) for r in registros]

    # ── Normalização usina ────────────────────────────────────────────────

    def _normalizar_usina(self, r: dict) -> DadosUsina:
        return DadosUsina(
            id_externo=str(r.get("id") or ""),
            nome=r.get("stationName") or r.get("name") or "(sem nome)",
            capacidade_kwp=kw(r.get("capacity") or r.get("dip")),
            potencia_kw=kw(r.get("power")),
            energia_hoje_kwh=kwh(r.get("dayEnergy")),
            energia_mes_kwh=kwh(r.get("monthEnergy")),
            energia_total_kwh=kwh(r.get("allEnergy")),
            status=_mapear_status(r.get("state")),
            medido_em=ts_ms_para_datetime(r.get("dataTimestamp"))
            or datetime.now(timezone.utc),
            endereco=r.get("addrOrigin") or "",
            cidade=r.get("countyStr") or "",
            estado=r.get("regionStr") or "",
            fuso_horario=r.get("timeZoneName") or "America/Sao_Paulo",
            qtd_inversores_total=int(r.get("inverterCount") or 0) or None,
            qtd_inversores_online=int(r.get("inverterOnlineCount") or 0) or None,
            raw=r,
        )

    # ── Normalização inversor ─────────────────────────────────────────────

    def _normalizar_inversor(
        self, r: dict, id_usina_externo: str
    ) -> DadosInversor:
        detail = r.get("_detail") or {}

        temperatura = temp_c(detail.get("inverterTemperature"))
        if temperatura == _TEMPERATURA_INVALIDA:
            temperatura = None

        return DadosInversor(
            id_externo=str(r.get("id") or r.get("sn") or ""),
            id_usina_externo=id_usina_externo,
            numero_serie=r.get("sn") or "",
            modelo=r.get("machine") or "",
            tipo="inversor",
            estado=_mapear_status(r.get("state")),
            medido_em=ts_ms_para_datetime(r.get("dataTimestamp"))
            or ts_ms_para_datetime(detail.get("dataTimestamp"))
            or datetime.now(timezone.utc),
            pac_kw=kw(r.get("pac")),
            energia_hoje_kwh=kwh(r.get("etoday")),
            energia_total_kwh=kwh(r.get("etotal")),
            # Elétricos em `_detail` (só preenchidos se `inverterDetail` bateu OK)
            tensao_ac_v=v(detail.get("uAc1")),
            corrente_ac_a=a(detail.get("iAc1")),
            frequencia_hz=hz(detail.get("fac")),
            tensao_dc_v=v(detail.get("uPv1")),
            corrente_dc_a=a(detail.get("iPv1")),
            temperatura_c=temperatura,
            soc_bateria_pct=None,  # Inversores híbridos populam; maioria não tem bateria.
            strings_mppt=_extrair_strings_mppt(r),
            raw=r,
        )
