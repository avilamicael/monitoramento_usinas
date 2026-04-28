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


def _ativa(valor: Decimal | None) -> bool:
    """True se a tensão fase-neutro indica fase ativa (> 1V)."""
    if valor is None:
        return False
    try:
        return float(valor) > 1
    except (TypeError, ValueError):
        return False


def _para_decimal_local(valor: Any) -> Decimal | None:
    """Converte fator de potência / potência reativa para Decimal."""
    if valor is None or valor == "":
        return None
    try:
        if isinstance(valor, Decimal):
            return valor
        if isinstance(valor, float):
            return Decimal(str(valor))
        return Decimal(str(valor).strip())
    except (ArithmeticError, ValueError, TypeError):
        return None


def _classificar_eletrica_ac_solis(
    detail: dict, registro: dict
) -> tuple[str | None, dict[str, Any] | None, Decimal | None]:
    """Classifica ligação AC e monta `eletrica_ac` a partir do `_detail` Solis.

    Solis expõe **apenas tensões fase-neutro** (`uAc1/2/3`); não há campos
    de tensão de linha (`ab_u/bc_u/ca_u`) nativos como no FusionSolar.
    Heurística baseada em quantas fases-neutro estão ativas (>1V):

    - 0 fases ativas → `(None, eletrica_ac_parcial_ou_None, None)`.
    - 1 fase ativa → MONOFÁSICO. Canônico = a fase ativa (ex.: `uAc1=230.4`).
    - 2 fases ativas → BIFÁSICO. **Canônico = `uAc1 + uAc2` (linha estimada)**.
      Em rede brasileira 220V entre 2 fases vivas, cada `uAcN` reporta ~115V
      fase-neutro virtual; a soma aproxima a tensão útil de rede (~225-230V).
      Não é matematicamente exato (linha real depende do ângulo de fase),
      mas alinha com o que o FusionSolar entrega nativamente em `ab_u` e
      evita disparar `subtensao_ac` falsa (limite 190V) num inversor Solis
      bifásico que reportaria ~115V se usássemos média.
      A estimada vai exposta em `eletrica_ac.linhas.ab_estimada` para
      auditoria. TODO: se uma usina Solis bifásica específica gerar
      alertas falsos com essa heurística, considerar override de
      `tensao_ac_limite_minimo_v` por inversor.
    - 3 fases ativas → TRIFÁSICO. Canônico = `uAc1` (mesma convenção do
      FusionSolar pra trifásico).

    Lê também `fac`, `powerFactor` e `reactivePower` quando presentes
    (todos opcionais; `.get()` em todos).

    Retorna `(tipo_ligacao, eletrica_ac, tensao_canonica)`. `eletrica_ac`
    fica `None` se nenhuma chave relevante estiver disponível.
    """
    u_ac1 = v(detail.get("uAc1"))
    u_ac2 = v(detail.get("uAc2"))
    u_ac3 = v(detail.get("uAc3"))
    i_ac1 = a(detail.get("iAc1"))
    i_ac2 = a(detail.get("iAc2"))
    i_ac3 = a(detail.get("iAc3"))
    fp = _para_decimal_local(detail.get("powerFactor"))
    q_kvar = _para_decimal_local(detail.get("reactivePower"))

    fases_neutro = {
        chave: val
        for chave, val in (("a", u_ac1), ("b", u_ac2), ("c", u_ac3))
        if val is not None
    }
    correntes = {
        chave: val
        for chave, val in (("a", i_ac1), ("b", i_ac2), ("c", i_ac3))
        if val is not None
    }

    fases_ativas = [
        (rotulo, valor)
        for rotulo, valor in (("a", u_ac1), ("b", u_ac2), ("c", u_ac3))
        if _ativa(valor)
    ]
    a_n = len(fases_ativas)

    # Linha estimada para bifásico (heurística — ver docstring).
    linhas: dict[str, Decimal] = {}
    tensao_canonica: Decimal | None = None
    tipo_ligacao: str | None = None

    if a_n == 0:
        tipo_ligacao = None
        tensao_canonica = None
    elif a_n == 1:
        tipo_ligacao = "monofasico"
        tensao_canonica = fases_ativas[0][1]
    elif a_n == 2:
        tipo_ligacao = "bifasico"
        # Soma das duas fases ativas como aproximação da tensão de linha.
        ab_estimada = fases_ativas[0][1] + fases_ativas[1][1]
        linhas["ab_estimada"] = ab_estimada
        tensao_canonica = ab_estimada
    else:  # a_n == 3
        tipo_ligacao = "trifasico"
        tensao_canonica = u_ac1

    eletrica_ac: dict[str, Any] = {}
    if fases_neutro:
        eletrica_ac["fases_neutro"] = fases_neutro
    if linhas:
        eletrica_ac["linhas"] = linhas
    if correntes:
        eletrica_ac["correntes"] = correntes
    if fp is not None:
        eletrica_ac["fator_potencia"] = fp
    if q_kvar is not None:
        eletrica_ac["potencia_reativa_kvar"] = q_kvar

    eletrica_ac_final: dict[str, Any] | None = eletrica_ac or None

    return tipo_ligacao, eletrica_ac_final, tensao_canonica


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

        # Classifica ligação AC e monta detalhe por fase. `tensao_canonica`
        # respeita o tipo: monofásico → fase-neutro ativa; bifásico →
        # `uAc1+uAc2` (linha estimada); trifásico → uAc1.
        tipo_ligacao, eletrica_ac, tensao_canonica = (
            _classificar_eletrica_ac_solis(detail, r)
        )

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
            tensao_ac_v=tensao_canonica,
            tipo_ligacao=tipo_ligacao,
            eletrica_ac=eletrica_ac,
            corrente_ac_a=a(detail.get("iAc1")),
            frequencia_hz=hz(detail.get("fac")),
            tensao_dc_v=v(detail.get("uPv1")),
            corrente_dc_a=a(detail.get("iPv1")),
            temperatura_c=temperatura,
            soc_bateria_pct=None,  # Inversores híbridos populam; maioria não tem bateria.
            strings_mppt=_extrair_strings_mppt(r),
            raw=r,
        )
