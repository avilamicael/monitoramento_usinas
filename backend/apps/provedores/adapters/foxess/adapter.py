"""Adapter FoxESS — traduz para DadosUsina/DadosInversor.

Particularidades validadas em produção:
1. Stateless — sem token. Cada request carrega MD5 signature.
2. `status` em `device/list`/`device/detail` é inconsistente — adapter usa
   o `real/query` como fonte da verdade.
3. `generation.cumulative` pode ser menor que `generation.today` em contas
   novas — preferimos `PVEnergyTotal` do real/query.
4. Fluxo do contrato (`buscar_usinas` → N × `buscar_inversores`) força N+1
   se cada chamada bater na API. Adapter hidrata tudo **uma vez** em
   `buscar_usinas()` e reusa na mesma instância (1 ciclo de coleta).
"""
from __future__ import annotations

import logging
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
    v,
)

from .consultas import (
    consultar_geracao,
    consultar_tempo_real,
    detalhe_dispositivo,
    detalhe_usina,
    listar_dispositivos,
    listar_usinas,
)

logger = logging.getLogger(__name__)


def _fault_ativo(variaveis: dict) -> bool:
    fault = variaveis.get("currentFault")
    if isinstance(fault, str):
        fault = fault.strip()
    if fault not in (None, "", 0, "0"):
        return True
    try:
        return int(variaveis.get("currentFaultCount") or 0) > 0
    except (TypeError, ValueError):
        return False


@registrar
class FoxessAdapter(BaseAdapter):
    """FoxESS OpenAPI — autenticação HMAC-MD5 stateless.

    Credenciais esperadas (dict): `{"api_key": "..."}`.

    Capacidades: expõe inversores com Vac, Iac, Vdc, Idc, freq, temperatura
    e strings MPPT. Intervalo mínimo 15 min (FoxESS tem orçamento diário
    de 1440 chamadas por inversor — 96 coletas/dia via 15 min é confortável).
    """

    tipo = "foxess"
    capacidades = Capacidades(
        expoe_inversores=True,
        expoe_strings_mppt=True,
        requisicoes_por_janela=1,
        janela_segundos=1,
        intervalo_minimo_minutos=15,
    )

    def __init__(self, credenciais: dict[str, Any]) -> None:
        super().__init__(credenciais)
        self._api_key = credenciais["api_key"]
        # Cache hidratado uma vez por instância.
        self._hidratado = False
        self._usinas_raw: list[dict] = []
        self._detalhes_usina: dict[str, dict] = {}
        self._dispositivos: list[dict] = []
        self._detalhes_disp: dict[str, dict] = {}
        self._tempo_real: dict[str, dict] = {}
        self._geracao: dict[str, dict] = {}

    # ── Contrato ──────────────────────────────────────────────────────────

    def buscar_usinas(self) -> list[DadosUsina]:
        self._hidratar()
        return [self._normalizar_usina(r) for r in self._usinas_raw]

    def buscar_inversores(self, id_usina_externo: str) -> list[DadosInversor]:
        self._hidratar()
        alvo = str(id_usina_externo)
        sns = [
            d["deviceSN"] for d in self._dispositivos
            if str(d.get("stationID")) == alvo and d.get("deviceSN")
        ]
        return [self._normalizar_inversor(sn, alvo) for sn in sns]

    # ── Hidratação ────────────────────────────────────────────────────────

    def _hidratar(self) -> None:
        if self._hidratado:
            return

        self._usinas_raw = listar_usinas(self._api_key)
        for u in self._usinas_raw:
            sid = str(u.get("stationID") or "")
            if not sid:
                continue
            try:
                self._detalhes_usina[sid] = detalhe_usina(sid, self._api_key)
            except Exception as exc:  # noqa: BLE001 — hidratação best-effort
                logger.warning("FoxESS: detalhe usina %s falhou — %s", sid, exc)
                self._detalhes_usina[sid] = {}

        self._dispositivos = listar_dispositivos(self._api_key)
        sns = [d["deviceSN"] for d in self._dispositivos if d.get("deviceSN")]

        for sn in sns:
            try:
                self._detalhes_disp[sn] = detalhe_dispositivo(sn, self._api_key)
            except Exception as exc:  # noqa: BLE001
                logger.warning("FoxESS: detalhe disp %s falhou — %s", sn, exc)
                self._detalhes_disp[sn] = {}

        try:
            self._tempo_real = consultar_tempo_real(sns, self._api_key)
        except Exception as exc:  # noqa: BLE001
            logger.warning("FoxESS: real/query falhou — %s", exc)
            self._tempo_real = {}

        for sn in sns:
            try:
                self._geracao[sn] = consultar_geracao(sn, self._api_key)
            except Exception as exc:  # noqa: BLE001
                logger.warning("FoxESS: generation %s falhou — %s", sn, exc)
                self._geracao[sn] = {}

        self._hidratado = True

    # ── Normalização — usina ─────────────────────────────────────────────

    def _normalizar_usina(self, r: dict) -> DadosUsina:
        sid = str(r.get("stationID") or "")
        detalhe = self._detalhes_usina.get(sid, {})

        # Agregado: somar potência/energia dos devices desta usina (FoxESS
        # não tem endpoint de "station real" consolidado).
        potencia_kw = Decimal("0")
        energia_hoje = Decimal("0")
        energia_mes: Decimal | None = None  # Foxess não expõe mês agregado
        energia_total = Decimal("0")
        qtd_total = 0
        qtd_online = 0

        for disp in self._dispositivos:
            if str(disp.get("stationID")) != sid:
                continue
            qtd_total += 1
            sn = disp.get("deviceSN")
            if not sn:
                continue
            variaveis = self._tempo_real.get(sn, {})
            if not _fault_ativo(variaveis) and variaveis:
                qtd_online += 1
            potencia_kw += (kw(variaveis.get("generationPower")) or Decimal("0"))
            energia_hoje += (kwh(variaveis.get("todayYield")) or Decimal("0"))
            energia_total += (
                kwh(variaveis.get("PVEnergyTotal"))
                or kwh(self._geracao.get(sn, {}).get("cumulative"))
                or Decimal("0")
            )

        return DadosUsina(
            id_externo=sid,
            nome=r.get("name") or detalhe.get("stationName") or "(sem nome)",
            capacidade_kwp=kw(detalhe.get("capacity")),
            potencia_kw=potencia_kw,
            energia_hoje_kwh=energia_hoje,
            energia_mes_kwh=energia_mes,
            energia_total_kwh=energia_total,
            status="online",  # FoxESS não tem status real por usina
            medido_em=datetime.now(timezone.utc),
            endereco=detalhe.get("address") or "",
            cidade=detalhe.get("city") or "",
            estado="",
            fuso_horario=r.get("ianaTimezone") or "America/Sao_Paulo",
            qtd_inversores_total=qtd_total or None,
            qtd_inversores_online=qtd_online or None,
            raw=r,
        )

    # ── Normalização — inversor ──────────────────────────────────────────

    def _normalizar_inversor(
        self, sn: str, id_usina_externo: str
    ) -> DadosInversor:
        disp = next(
            (d for d in self._dispositivos if d.get("deviceSN") == sn),
            {},
        )
        detalhe = self._detalhes_disp.get(sn, {})
        variaveis = self._tempo_real.get(sn, {})
        geracao = self._geracao.get(sn, {})

        # Estado: `aviso` se há fault ativo; senão `online` se variáveis
        # existem; `offline` quando nem real/query retornou.
        if _fault_ativo(variaveis):
            estado = "alerta"
        elif variaveis:
            estado = "online"
        else:
            estado = "offline"

        strings_mppt = []
        for i in range(1, 9):  # FoxESS tipicamente 1-4 mas testa até 8
            potencia = variaveis.get(f"pv{i}Power")
            tensao = variaveis.get(f"pv{i}Volt")
            corrente = variaveis.get(f"pv{i}Current")
            if all(x in (None, 0, 0.0) for x in (potencia, tensao, corrente)):
                continue
            strings_mppt.append(
                MpptString(
                    indice=i,
                    tensao_v=v(tensao),
                    corrente_a=a(corrente),
                    # FoxESS retorna `pvNPower` em kW — convertemos para W.
                    potencia_w=(kw(potencia) * Decimal("1000"))
                    if kw(potencia) is not None else None,
                )
            )

        return DadosInversor(
            id_externo=sn,
            id_usina_externo=id_usina_externo,
            numero_serie=sn,
            modelo=detalhe.get("deviceType") or disp.get("deviceType") or "",
            tipo="inversor",
            estado=estado,
            medido_em=datetime.now(timezone.utc),
            pac_kw=kw(variaveis.get("generationPower")),
            energia_hoje_kwh=(
                kwh(variaveis.get("todayYield"))
                or kwh(geracao.get("today"))
            ),
            energia_total_kwh=(
                kwh(variaveis.get("PVEnergyTotal"))
                or kwh(geracao.get("cumulative"))
            ),
            tensao_ac_v=v(variaveis.get("RVolt")),
            corrente_ac_a=a(variaveis.get("RCurrent")),
            frequencia_hz=hz(variaveis.get("RFreq")),
            # FoxESS expõe Vdc/Idc só por string (pv1Volt, pv1Current...).
            # Agregamos? Não — usamos strings_mppt. Esses campos ficam null.
            tensao_dc_v=None,
            corrente_dc_a=None,
            temperatura_c=temp_c(variaveis.get("invTemperation")),
            soc_bateria_pct=None,
            strings_mppt=strings_mppt,
            raw={**disp, "_detail": detalhe, "_real": variaveis, "_geracao": geracao},
        )
