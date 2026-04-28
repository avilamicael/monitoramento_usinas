"""Adapter Solarman Business — JWT manual + endpoint elétrico acoplado."""
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
    ErroAutenticacaoProvedor,
    MpptString,
)
from apps.provedores.adapters.registry import registrar
from apps.provedores.adapters.unidades import (
    a,
    hz,
    kw,
    kwh,
    temp_c,
    ts_s_para_datetime,
    v,
    w_para_kw,
)

from .autenticacao import HEADERS_BASE, token_expirado, validar_token
from .consultas import (
    buscar_dados_inversor,
    listar_inversores,
    listar_usinas,
)

logger = logging.getLogger(__name__)

_STATUS = {"NORMAL": "online", "OFFLINE": "offline", "ALARM": "alerta"}


def _ativa(valor: Any) -> bool:
    """True se a tensão fase-neutro indica fase ativa (> 1V)."""
    if valor is None:
        return False
    try:
        return float(valor) > 1
    except (TypeError, ValueError):
        return False


def _para_decimal_local(valor: Any) -> Decimal | None:
    """Conversor para campos sem helper específico (FP, kvar)."""
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


def _classificar_eletrica_ac_solarman(
    dados: dict,
) -> tuple[str | None, dict[str, Any] | None, Any]:
    """Classifica ligação AC e monta `eletrica_ac` a partir do `stats/day`.

    Solarman é uma plataforma agregadora — diferentes inversores reportam
    storageNames distintos. Convenção observada nos modelos suportados
    (Deye, Sofar, Solis-via-Solarman, Goodwe-via-Solarman):

    - `AV1`/`AV2`/`AV3`: tensão AC fase-neutro (V) por fase 1/2/3.
    - `AC1`/`AC2`/`AC3`: corrente AC por fase (A).
    - `AF1`/`AF2`/`AF3`: frequência por fase (Hz).
    - `Et_pf` ou `Pf_t1`: fator de potência (cosφ).
    - `Et_q` ou `RPo_t1`: potência reativa (kvar).
    Solarman **não expõe** tensões de linha — `linhas` fica omitido.

    Heurística por contagem de fases-neutro ativas (> 1V):
    - 0 → tipo=None, canônico=None.
    - 1 → monofasico, canônico = a fase ativa.
    - 2 → bifasico, canônico = média das duas fases ativas.
    - 3 → trifasico, canônico = primeira fase (AV1).

    Retorna `(tipo_ligacao, eletrica_ac, tensao_canonica)`. `eletrica_ac`
    inclui apenas chaves não-None; pode ser `None` se nada veio.
    """
    a_u = v(dados.get("AV1"))
    b_u = v(dados.get("AV2"))
    c_u = v(dados.get("AV3"))
    a_i = a(dados.get("AC1"))
    b_i = a(dados.get("AC2"))
    c_i = a(dados.get("AC3"))
    fp = _para_decimal_local(dados.get("Et_pf") or dados.get("Pf_t1"))
    q_kvar = _para_decimal_local(dados.get("Et_q") or dados.get("RPo_t1"))

    fases_neutro = {
        chave: val
        for chave, val in (("a", a_u), ("b", b_u), ("c", c_u))
        if val is not None
    }
    correntes = {
        chave: val
        for chave, val in (("a", a_i), ("b", b_i), ("c", c_i))
        if val is not None
    }

    eletrica_ac: dict[str, Any] = {}
    if fases_neutro:
        eletrica_ac["fases_neutro"] = fases_neutro
    if correntes:
        eletrica_ac["correntes"] = correntes
    if fp is not None:
        eletrica_ac["fator_potencia"] = fp
    if q_kvar is not None:
        eletrica_ac["potencia_reativa_kvar"] = q_kvar

    eletrica_ac_final: dict[str, Any] | None = eletrica_ac or None

    fases_ativas = [
        (rotulo, valor)
        for rotulo, valor in (("a", a_u), ("b", b_u), ("c", c_u))
        if _ativa(valor)
    ]
    n = len(fases_ativas)

    if n == 0:
        return None, eletrica_ac_final, None
    if n == 1:
        return "monofasico", eletrica_ac_final, fases_ativas[0][1]
    if n == 2:
        # Média das duas fases ativas (Solarman não expõe linha).
        media = (fases_ativas[0][1] + fases_ativas[1][1]) / Decimal(2)
        return "bifasico", eletrica_ac_final, media
    # n == 3
    return "trifasico", eletrica_ac_final, fases_ativas[0][1]


@registrar
class SolarmanAdapter(BaseAdapter):
    """Solarman Business (globalpro.solarmanpv.com).

    Credenciais: `{"email", "password"}` (informativos), `{"token": "eyJ..."}`
    no cache. Token é JWT copiado do browser.

    Fix em relação ao sistema antigo: este adapter **chama
    `buscar_dados_inversor` para cada inversor online**, populando os
    campos elétricos (Vac, Iac, freq, Vdc, Idc, temperatura). No antigo,
    a função existia mas não era invocada no fluxo — resultado: 273
    inversores com dados zerados no banco.
    """

    tipo = "solarman"
    capacidades = Capacidades(
        expoe_inversores=True,
        expoe_strings_mppt=True,
        requisicoes_por_janela=5,
        janela_segundos=10,
        intervalo_minimo_minutos=10,
    )

    def __init__(self, credenciais: dict[str, Any]) -> None:
        super().__init__(credenciais)
        self._token: str | None = credenciais.get("token")
        self._sessao = requests.Session()
        self._sessao.headers.update(HEADERS_BASE)

    def _garantir_autenticado(self) -> None:
        if not self._token:
            raise ErroAutenticacaoProvedor(
                "Solarman: token JWT ausente — cadastre via admin."
            )
        validar_token(self._token)

    def obter_cache_token(self) -> dict[str, Any] | None:
        return {"token": self._token} if self._token else None

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
            dados_eletricos: dict = {}
            device_id = inv.get("id")
            if device_id and inv.get("netState") == 1:
                try:
                    dados_eletricos = buscar_dados_inversor(
                        str(device_id), self._sessao, self._token
                    )
                except Exception as exc:  # noqa: BLE001 — best-effort
                    logger.warning(
                        "Solarman: stats/day falhou device=%s — %s",
                        device_id, exc,
                    )
            resultado.append(
                self._normalizar_inversor(inv, id_usina_externo, dados_eletricos)
            )
        return resultado

    # ── Normalização — usina ─────────────────────────────────────────────

    def _normalizar_usina(self, r: dict) -> DadosUsina:
        # A API encapsula em {station: {...}, extraData: {...}}
        s = r.get("station") if isinstance(r.get("station"), dict) else r
        status_raw = s.get("networkStatus", "OFFLINE")
        return DadosUsina(
            id_externo=str(s.get("id", "")),
            nome=s.get("name") or "(sem nome)",
            capacidade_kwp=kw(s.get("installedCapacity")),
            # generationPower vem em W — converter para kW.
            potencia_kw=w_para_kw(s.get("generationPower")),
            energia_hoje_kwh=kwh(s.get("generationValue")),
            energia_mes_kwh=kwh(s.get("generationMonth")),
            energia_total_kwh=kwh(s.get("generationTotal")),
            status=_STATUS.get(status_raw, "offline"),
            medido_em=ts_s_para_datetime(s.get("lastUpdateTime"))
            or datetime.now(timezone.utc),
            endereco=s.get("locationAddress") or "",
            fuso_horario=s.get("regionTimezone") or "America/Sao_Paulo",
            raw=s,
        )

    # ── Normalização — inversor ──────────────────────────────────────────

    def _normalizar_inversor(
        self, inv: dict, id_usina: str, dados: dict
    ) -> DadosInversor:
        sn = inv.get("deviceSn") or inv.get("serialNumber") or ""
        online = inv.get("netState") == 1

        # Tipo: API distingue entre MICRO_INVERTER e INVERTER.
        tipo_api = (inv.get("type") or "").upper()
        tipo = "microinversor" if tipo_api == "MICRO_INVERTER" else "inversor"

        # Dados elétricos do stats/day — já em unidades nativas.
        # APo_t1 em W → kW; Et_ge0 e Etdy_ge0 em kWh.
        pac_kw = w_para_kw(dados.get("APo_t1"))
        energia_hoje = kwh(dados.get("Etdy_ge0"))
        energia_total = kwh(dados.get("Et_ge0"))

        # Strings MPPT: tensão (DV1-4), corrente (DC1-4), potência (DP1-4 em W).
        strings_mppt: list[MpptString] = []
        for i in range(1, 5):
            tensao = v(dados.get(f"DV{i}"))
            corrente = a(dados.get(f"DC{i}"))
            potencia_w = dados.get(f"DP{i}")
            if all(
                x in (None, 0, 0.0)
                for x in (tensao, corrente, potencia_w)
            ):
                continue
            strings_mppt.append(
                MpptString(
                    indice=i,
                    tensao_v=tensao,
                    corrente_a=corrente,
                    potencia_w=Decimal(str(potencia_w)) if potencia_w else None,
                )
            )

        # Classifica ligação AC e monta detalhe por fase. Canônico:
        # mono → fase ativa; bi → média das fases ativas (Solarman não
        # expõe tensão de linha); tri → AV1.
        tipo_ligacao, eletrica_ac, tensao_canonica = (
            _classificar_eletrica_ac_solarman(dados)
        )

        return DadosInversor(
            id_externo=str(inv.get("id") or sn),
            id_usina_externo=id_usina,
            numero_serie=sn,
            modelo=inv.get("type") or "",
            tipo=tipo,
            estado="online" if online else "offline",
            medido_em=ts_s_para_datetime(inv.get("collectionTime"))
            or datetime.now(timezone.utc),
            pac_kw=pac_kw,
            energia_hoje_kwh=energia_hoje,
            energia_total_kwh=energia_total,
            tensao_ac_v=v(tensao_canonica),
            tipo_ligacao=tipo_ligacao,
            eletrica_ac=eletrica_ac,
            corrente_ac_a=a(dados.get("AC1")),
            frequencia_hz=hz(dados.get("AF1")),
            tensao_dc_v=v(dados.get("DV1")),
            corrente_dc_a=a(dados.get("DC1")),
            temperatura_c=temp_c(dados.get("AC_RDT_T1")),
            soc_bateria_pct=None,
            strings_mppt=strings_mppt,
            raw={**inv, "_stats": dados},
        )
