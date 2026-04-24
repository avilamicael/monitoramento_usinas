"""Adapter FusionSolar thirdData — XSRF-TOKEN session + KPI por devTypeId.

Particularidade crítica: quando `_kpi.run_state == 0`, o inversor está
offline (noite/desligado) e a API retorna todos os outros KPIs como
`null`. O adapter **não substitui null por zero** nesse caso — deixa
null pra que as regras de alerta (sobretensao_ac, etc) não avaliem
dado ausente.

FusionSolar retorna capacidade em **MW** quando < 100. Adapter detecta
(`capacity < 100` → multiplicar por 1000 para obter kWp).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
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
    mw_para_kw,
    temp_c,
    v,
)

from .autenticacao import fazer_login
from .consultas import listar_todos_inversores, listar_usinas

logger = logging.getLogger(__name__)


def _kwp_de_capacity(capacity: Any) -> Decimal | None:
    """FusionSolar retorna capacidade em MW quando < 100, senão em kWp.
    Usuário observou bug 0.00805 (= 8.05 kWp) no sample; proteção contra
    dado claramente absurdo → trata como MW por padrão quando < 100."""
    dec = kw(capacity)
    if dec is None:
        return None
    if dec < Decimal("100"):
        return mw_para_kw(capacity)
    return dec


@registrar
class FusionSolarAdapter(BaseAdapter):
    """Huawei FusionSolar thirdData.

    Credenciais: `{"username", "system_code"}`.
    Cache: `{"xsrf_token": "..."}`.

    Intervalo mínimo 30 min — API rejeita com `failCode=407` abaixo disso.
    """

    tipo = "fusionsolar"
    capacidades = Capacidades(
        expoe_inversores=True,
        expoe_strings_mppt=True,
        requisicoes_por_janela=1,
        janela_segundos=5,
        intervalo_minimo_minutos=30,
    )

    def __init__(self, credenciais: dict[str, Any]) -> None:
        super().__init__(credenciais)
        self._usuario = credenciais["username"]
        self._system_code = credenciais["system_code"]
        self._sessao = requests.Session()
        self._sessao.headers.update({"Content-Type": "application/json"})
        xsrf = credenciais.get("xsrf_token")
        if xsrf:
            self._sessao.headers["XSRF-TOKEN"] = xsrf
            self._autenticado = True
        else:
            self._autenticado = False

        # Cache hidratado em buscar_usinas() pra evitar N chamadas.
        self._cache_inv: dict[str, list] = {}

    def _garantir_autenticado(self) -> None:
        if not self._autenticado:
            fazer_login(self._usuario, self._system_code, self._sessao)
            self._autenticado = True

    def obter_cache_token(self) -> dict[str, Any] | None:
        xsrf = self._sessao.headers.get("XSRF-TOKEN", "")
        return {"xsrf_token": xsrf} if xsrf else None

    # ── Contrato ─────────────────────────────────────────────────────────

    def buscar_usinas(self) -> list[DadosUsina]:
        self._garantir_autenticado()
        registros = listar_usinas(self._sessao, self._usuario, self._system_code)

        # Pré-carrega inversores pra evitar N × getDevList
        codigos = [r.get("stationCode", "") for r in registros if r.get("stationCode")]
        self._cache_inv = listar_todos_inversores(
            codigos, self._sessao, self._usuario, self._system_code
        )

        # Soma active_power dos inversores como fallback quando total_current_power
        # vem null (getStationRealKpi falha ou usina não expõe).
        potencia_por_usina: dict[str, Decimal | None] = {}
        for codigo, devs in self._cache_inv.items():
            soma = Decimal("0")
            tem_dado = False
            for d in devs:
                ap = (d.get("_kpi") or {}).get("active_power")
                if ap is not None:
                    ap_dec = kw(ap)
                    if ap_dec is not None:
                        soma += ap_dec
                        tem_dado = True
            potencia_por_usina[codigo] = soma if tem_dado else None

        usinas: list[DadosUsina] = []
        for r in registros:
            u = self._normalizar_usina(r)
            codigo = r.get("stationCode", "")
            if u.potencia_kw is None and potencia_por_usina.get(codigo) is not None:
                u.potencia_kw = potencia_por_usina[codigo]
            usinas.append(u)
        return usinas

    def buscar_inversores(self, id_usina_externo: str) -> list[DadosInversor]:
        self._garantir_autenticado()
        # Usa cache preenchido em buscar_usinas. Se vazio (chamada fora de
        # ordem), pré-carrega só essa usina.
        if not self._cache_inv:
            logger.warning("FusionSolar: cache vazio — recarregando")
            self._cache_inv = listar_todos_inversores(
                [id_usina_externo], self._sessao, self._usuario, self._system_code
            )
        registros = self._cache_inv.get(id_usina_externo, [])
        return [self._normalizar_inversor(r, id_usina_externo) for r in registros]

    # ── Normalização — usina ─────────────────────────────────────────────

    def _normalizar_usina(self, r: dict) -> DadosUsina:
        kpi = r.get("_kpi") or {}
        return DadosUsina(
            id_externo=r.get("stationCode") or "",
            nome=r.get("stationName") or r.get("stationCode") or "(sem nome)",
            capacidade_kwp=_kwp_de_capacity(r.get("capacity")),
            potencia_kw=kw(kpi.get("total_current_power")),
            energia_hoje_kwh=kwh(kpi.get("day_power")),
            energia_mes_kwh=kwh(kpi.get("month_power")),
            energia_total_kwh=kwh(kpi.get("total_power")),
            # FusionSolar não expõe status consolidado por usina na list.
            status="online",
            medido_em=datetime.now(timezone.utc),
            fuso_horario=r.get("timeZone") or "America/Sao_Paulo",
            endereco=r.get("stationAddr") or r.get("address") or "",
            raw=r,
        )

    # ── Normalização — inversor ──────────────────────────────────────────

    def _normalizar_inversor(
        self, r: dict, id_usina_externo: str
    ) -> DadosInversor:
        kpi = r.get("_kpi") or {}
        dev_id = str(r.get("id", ""))

        # Estado: run_state=1 → online; outro → offline.
        run_state = kpi.get("run_state")
        if run_state is not None:
            try:
                estado = "online" if int(run_state) == 1 else "offline"
            except (TypeError, ValueError):
                estado = "offline"
        else:
            estado = "online" if r.get("devStatus") == 1 else "offline"

        # Quando offline (run_state=0), os KPIs vêm null. Deixamos null
        # propagar — NÃO preencher com 0.

        # Strings MPPT: `mppt_N_cap` é energia acumulada por string (kWh),
        # não potência instantânea. Ainda assim é o dado mais granular
        # que o FusionSolar dá — armazenamos em `potencia_w=None` e usamos
        # tensao/corrente quando houver `pvN_u/pvN_i`.
        strings_mppt: list[MpptString] = []
        for i in range(1, 9):
            tensao = v(kpi.get(f"pv{i}_u"))
            corrente = a(kpi.get(f"pv{i}_i"))
            if tensao is None and corrente is None:
                continue
            strings_mppt.append(
                MpptString(
                    indice=i,
                    tensao_v=tensao,
                    corrente_a=corrente,
                    potencia_w=None,
                )
            )

        return DadosInversor(
            id_externo=dev_id,
            id_usina_externo=id_usina_externo,
            numero_serie=r.get("esnCode") or r.get("devSn") or dev_id,
            modelo=r.get("invType") or r.get("devName") or "",
            tipo="inversor",
            estado=estado,
            medido_em=datetime.now(timezone.utc),
            pac_kw=kw(kpi.get("active_power")),
            energia_hoje_kwh=kwh(kpi.get("day_cap")),
            energia_total_kwh=kwh(kpi.get("total_cap")),
            # Fase A como canônica (trifásico: a_u, b_u, c_u).
            tensao_ac_v=v(kpi.get("a_u") or kpi.get("ab_u")),
            corrente_ac_a=a(kpi.get("a_i")),
            frequencia_hz=hz(kpi.get("elec_freq")),
            # `pv1_u/pv1_i` = primeira string.
            tensao_dc_v=v(kpi.get("pv1_u")),
            corrente_dc_a=a(kpi.get("pv1_i")),
            temperatura_c=temp_c(kpi.get("temperature")),
            soc_bateria_pct=None,
            strings_mppt=strings_mppt,
            raw=r,
        )
