"""Adapter AuxSol Cloud — Bearer token de 12h."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

import requests

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
    pct,
    temp_c,
    v,
)

from .autenticacao import HEADERS_BASE, fazer_login, token_expirado
from .consultas import inversor_realtime, listar_inversores, listar_usinas

logger = logging.getLogger(__name__)

# 01=normal, 02=standby (noite), 03=falha/desligado
_STATUS = {"01": "online", "02": "offline", "03": "alerta"}


def _mapear_status(s: Any) -> str:
    return _STATUS.get(str(s or ""), "offline")


def _parse_dt(dt_str: str, tz_offset: str = "-03:00") -> datetime:
    if not dt_str:
        return datetime.now(timezone.utc)
    try:
        dt = datetime.strptime(dt_str[:19], "%Y-%m-%d %H:%M:%S")
        horas = int(tz_offset.split(":")[0])
        tz = timezone(timedelta(hours=horas))
        return dt.replace(tzinfo=tz)
    except (ValueError, IndexError):
        return datetime.now(timezone.utc)


@registrar
class AuxsolAdapter(BaseAdapter):
    """AuxSol Cloud (eu.auxsolcloud.com).

    Credenciais: `{"account": "...", "password": "...", "token": ...?, "obtido_em": ...?}`.
    Cache reutilizável por 12h.
    """

    tipo = "auxsol"
    capacidades = Capacidades(
        expoe_inversores=True,
        expoe_strings_mppt=True,
        requisicoes_por_janela=5,
        janela_segundos=10,
        intervalo_minimo_minutos=10,
    )

    def __init__(self, credenciais: dict[str, Any]) -> None:
        super().__init__(credenciais)
        self._account = credenciais["account"]
        self._password = credenciais["password"]
        self._token: str | None = credenciais.get("token")
        self._obtido_em: int = credenciais.get("obtido_em", 0) or 0
        self._sessao = requests.Session()
        self._sessao.headers.update(HEADERS_BASE)

    # ── Token ────────────────────────────────────────────────────────────

    def _garantir_autenticado(self) -> None:
        if not self._token or token_expirado({"obtido_em": self._obtido_em}):
            novo = fazer_login(self._account, self._password, self._sessao)
            self._token = novo["token"]
            self._obtido_em = novo["obtido_em"]

    def obter_cache_token(self) -> dict[str, Any] | None:
        if self._token:
            return {"token": self._token, "obtido_em": self._obtido_em}
        return None

    # ── Contrato ─────────────────────────────────────────────────────────

    def buscar_usinas(self) -> list[DadosUsina]:
        self._garantir_autenticado()
        assert self._token
        registros = listar_usinas(self._sessao, self._token)
        return [self._normalizar_usina(r) for r in registros]

    def buscar_inversores(self, id_usina_externo: str) -> list[DadosInversor]:
        self._garantir_autenticado()
        assert self._token
        registros = listar_inversores(id_usina_externo, self._sessao, self._token)
        resultado: list[DadosInversor] = []
        for inv in registros:
            sn = inv.get("sn") or ""
            realtime: dict = {}
            if sn:
                try:
                    realtime = inversor_realtime(sn, self._sessao, self._token)
                except Exception as exc:  # noqa: BLE001 — realtime é best-effort
                    logger.warning("AuxSol: realtime %s falhou — %s", sn, exc)
            resultado.append(
                self._normalizar_inversor(inv, id_usina_externo, realtime)
            )
        return resultado

    # ── Normalização — usina ─────────────────────────────────────────────

    def _normalizar_usina(self, r: dict) -> DadosUsina:
        tz_str = r.get("timeZone") or "-03:00"
        return DadosUsina(
            id_externo=str(r.get("plantId", "")),
            nome=r.get("plantName") or "(sem nome)",
            capacidade_kwp=kw(r.get("capacity")),
            potencia_kw=kw(r.get("currentPower")),
            energia_hoje_kwh=kwh(r.get("todayYield")),
            energia_mes_kwh=kwh(r.get("monthlyYield")),
            energia_total_kwh=kwh(r.get("totalYield")),
            status=_mapear_status(r.get("status")),
            medido_em=_parse_dt(r.get("dt", ""), tz_str),
            endereco=r.get("address") or "",
            fuso_horario="America/Sao_Paulo",
            raw=r,
        )

    # ── Normalização — inversor ──────────────────────────────────────────

    def _normalizar_inversor(
        self, inv: dict, id_usina: str, realtime: dict
    ) -> DadosInversor:
        sn = inv.get("sn") or ""
        tz_str = inv.get("timeZone") or "-03:00"

        # Endpoint list tem valores já em kW/kWh.
        pac_kw = kw(inv.get("currentPower"))
        energia_hoje = kwh(inv.get("dayEnergy"))
        energia_total = kwh(inv.get("totalEnergy"))

        energy = realtime.get("energyData") or {}
        grid = realtime.get("gridData") or {}
        other = realtime.get("otherData") or {}
        battery = realtime.get("batteryData") or {}

        # Realtime (mais atual)
        if energy:
            pac_kw = kw(energy.get("power")) or pac_kw
            energia_hoje = kwh(energy.get("y")) or energia_hoje
            energia_total = kwh(energy.get("yt")) or energia_total

        # Strings MPPT do realtime — pvList: [{index, u, i, p}]
        strings_mppt: list[MpptString] = []
        for pv in energy.get("pvList") or []:
            idx = pv.get("index")
            if idx is None:
                continue
            tensao = v(pv.get("u"))
            corrente = a(pv.get("i"))
            potencia = pv.get("p")
            if all(x in (None, 0, 0.0) for x in (tensao, corrente, potencia)):
                continue
            strings_mppt.append(
                MpptString(
                    indice=int(idx),
                    tensao_v=tensao,
                    corrente_a=corrente,
                    potencia_w=Decimal(str(potencia)) if potencia else None,
                )
            )

        # AC fase 1
        tensao_ac = corrente_ac = frequencia = None
        ac_list = grid.get("acList") or []
        if ac_list:
            ac = ac_list[0]
            tensao_ac = v(ac.get("u"))
            corrente_ac = a(ac.get("i"))
            frequencia = hz(ac.get("f"))

        # DC string 1
        tensao_dc = corrente_dc = None
        if energy.get("pvList"):
            primeira = energy["pvList"][0]
            tensao_dc = v(primeira.get("u"))
            corrente_dc = a(primeira.get("i"))

        # Temperatura (heatsink preferido, interna fallback)
        temperatura = (
            temp_c(other.get("temperature1"))
            or temp_c(other.get("insideTemperature"))
        )

        soc = pct(battery.get("soc")) if battery else None

        return DadosInversor(
            id_externo=str(inv.get("inverterId") or sn),
            id_usina_externo=id_usina,
            numero_serie=sn,
            modelo=inv.get("model") or "",
            tipo="inversor",
            estado=_mapear_status(inv.get("status")),
            medido_em=_parse_dt(inv.get("lastDt", ""), tz_str),
            pac_kw=pac_kw,
            energia_hoje_kwh=energia_hoje,
            energia_total_kwh=energia_total,
            tensao_ac_v=tensao_ac,
            corrente_ac_a=corrente_ac,
            frequencia_hz=frequencia,
            tensao_dc_v=tensao_dc,
            corrente_dc_a=corrente_dc,
            temperatura_c=temperatura,
            soc_bateria_pct=soc,
            strings_mppt=strings_mppt,
            raw={**inv, "_realtime": realtime},
        )
