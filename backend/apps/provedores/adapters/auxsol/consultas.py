"""Endpoints AuxSol Cloud.

Alertas nativos (`/analysis/alarm/list`) **não** são consultados — sistema
novo gera alertas das leituras. `code = AWX-0000` significa sucesso; qualquer
outro código vira erro.
"""
from __future__ import annotations

import logging
import time

import requests

from apps.provedores.adapters.base import (
    ErroAutenticacaoProvedor,
    ErroProvedor,
    ErroRateLimitProvedor,
)

from .autenticacao import BASE_URL

logger = logging.getLogger(__name__)

ITENS_POR_PAGINA = 100

_AUTH_MARCADORES = ("auth", "token", "expir", "login", "登录", "过期")


def _get(
    path: str,
    sessao: requests.Session,
    token: str,
    params: dict | None = None,
) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    inicio = time.time()
    try:
        resp = sessao.get(
            f"{BASE_URL}{path}", params=params, headers=headers, timeout=20
        )
    except requests.RequestException as exc:
        raise ErroProvedor(f"AuxSol rede em {path}: {exc}") from exc

    dur = int((time.time() - inicio) * 1000)

    if resp.status_code == 429:
        raise ErroRateLimitProvedor("AuxSol 429")
    if resp.status_code == 401:
        raise ErroAutenticacaoProvedor("AuxSol 401")

    try:
        dados = resp.json()
    except ValueError as exc:
        raise ErroProvedor(
            f"AuxSol: resposta inválida em {path}: {resp.text[:200]}"
        ) from exc

    code = dados.get("code", "")
    if code != "AWX-0000":
        msg = dados.get("msg") or str(dados)
        msg_low = str(msg).lower()
        if (
            any(m in msg_low for m in _AUTH_MARCADORES)
            or "401" in str(code)
        ):
            raise ErroAutenticacaoProvedor(f"AuxSol auth — {msg}")
        raise ErroProvedor(f"AuxSol erro em {path} — {msg}")

    logger.debug("AuxSol: GET %s %dms", path, dur)
    return dados


def listar_usinas(sessao: requests.Session, token: str) -> list[dict]:
    """`/archive/plant/list` paginado.

    Campos: plantId, plantName, capacity, currentPower, todayYield,
    monthlyYield, totalYield, status, address, timeZone, dt.
    """
    resultado: list[dict] = []
    pagina = 1
    while True:
        dados = _get(
            "/auxsol-api/archive/plant/list",
            sessao,
            token,
            params={
                "status": "",
                "plantType": "",
                "pageSize": ITENS_POR_PAGINA,
                "pageNum": pagina,
            },
        )
        inner = dados.get("data", {})
        registros = inner.get("rows") or []
        resultado.extend(registros)
        total = int(inner.get("total") or 0)
        if not registros or len(resultado) >= total:
            break
        pagina += 1
    return resultado


def listar_inversores(
    plant_id: str, sessao: requests.Session, token: str
) -> list[dict]:
    """`/archive/inverter/getInverterByPlant/{plantId}` — sem paginação."""
    dados = _get(
        f"/auxsol-api/archive/inverter/getInverterByPlant/{plant_id}",
        sessao,
        token,
    )
    return dados.get("data") or []


def inversor_realtime(
    sn: str, sessao: requests.Session, token: str
) -> dict:
    """`/analysis/inverterReport/findInverterRealTimeInfoBySnV1`.

    Expõe `energyData.pvList` (strings MPPT), `gridData.acList` (rede),
    `otherData.temperature1/insideTemperature`, `batteryData` (híbridos).
    """
    dados = _get(
        "/auxsol-api/analysis/inverterReport/findInverterRealTimeInfoBySnV1",
        sessao,
        token,
        params={"sn": sn},
    )
    return dados.get("data") or {}
