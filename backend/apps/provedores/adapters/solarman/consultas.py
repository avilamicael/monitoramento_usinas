"""Endpoints Solarman Business.

Todos autenticados por Bearer do JWT. Erros `code` da API são traduzidos
para as exceções do sistema.

**Endpoint crítico**: `buscar_dados_inversor` (`/device-s/device/{id}/stats/day`)
é o que traz os campos elétricos (DV1-DV4, AV1, AC1, AF1, APo_t1, Etdy_ge0,
AC_RDT_T1). O sistema antigo tinha a função implementada mas não acoplada
ao fluxo do adapter — aqui ela é chamada por inversor online.
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


def _request(
    method: str,
    path: str,
    sessao: requests.Session,
    token: str,
    json_body: dict | None = None,
    params: dict | None = None,
) -> dict | list:
    headers = {"Authorization": f"Bearer {token}"}
    inicio = time.time()
    try:
        resp = sessao.request(
            method,
            f"{BASE_URL}{path}",
            json=json_body,
            params=params,
            headers=headers,
            timeout=30,
        )
    except requests.RequestException as exc:
        raise ErroProvedor(f"Solarman rede em {path}: {exc}") from exc

    dur = int((time.time() - inicio) * 1000)

    if resp.status_code == 429:
        raise ErroRateLimitProvedor("Solarman 429")
    if resp.status_code == 401:
        raise ErroAutenticacaoProvedor("Solarman 401")
    if resp.status_code == 403:
        raise ErroAutenticacaoProvedor("Solarman 403")

    try:
        dados = resp.json()
    except ValueError as exc:
        raise ErroProvedor(
            f"Solarman: resposta inválida em {path}: {resp.text[:200]}"
        ) from exc

    if isinstance(dados, dict) and dados.get("code"):
        msg = dados.get("msg") or dados.get("code") or str(dados)
        if "token" in str(msg).lower() or "auth" in str(msg).lower():
            raise ErroAutenticacaoProvedor(f"Solarman auth — {msg}")
        raise ErroProvedor(f"Solarman erro em {path} — {msg}")

    logger.debug("Solarman: %s %s %dms", method, path, dur)
    return dados


def _get(path: str, sessao, token, params=None):
    return _request("GET", path, sessao, token, params=params)


def _post(path: str, sessao, token, body=None):
    return _request("POST", path, sessao, token, json_body=body or {})


def listar_usinas(sessao: requests.Session, token: str) -> list[dict]:
    """`POST /maintain-s/operating/station/v2/search` paginado.

    Retorno envelopa: cada record tem `station`/`extraData`. O adapter pega
    o sub-dict `station` com os campos úteis (id, name, networkStatus,
    generationPower, generationValue, generationMonth, generationTotal,
    lastUpdateTime, regionTimezone, locationAddress).
    """
    resultado: list[dict] = []
    pagina = 1
    while True:
        dados = _post(
            f"/maintain-s/operating/station/v2/search?page={pagina}"
            f"&size={ITENS_POR_PAGINA}&order.direction=ASC&order.property=name",
            sessao,
            token,
            {"station": {"powerTypeList": ["PV"]}},
        )
        registros = dados.get("data") or []
        resultado.extend(registros)
        total = int(dados.get("total") or 0)
        if not registros or len(resultado) >= total:
            break
        pagina += 1
    return resultado


def listar_inversores(
    station_id: str, sessao: requests.Session, token: str
) -> list[dict]:
    """`GET /maintain-s/operating/station/{id}/microInverter` paginado.

    Retorna `id`, `deviceSn`, `type`, `netState`, `deviceState`,
    `collectionTime`, `parentDeviceSn`.
    """
    resultado: list[dict] = []
    pagina = 1
    while True:
        dados = _get(
            f"/maintain-s/operating/station/{station_id}/microInverter"
            f"?page={pagina}&size={ITENS_POR_PAGINA}"
            f"&order.direction=ASC&order.property=device_sn",
            sessao,
            token,
        )
        registros = dados.get("data") or []
        resultado.extend(registros)
        total = int(dados.get("total") or 0)
        if not registros or len(resultado) >= total:
            break
        pagina += 1
    return resultado


def buscar_dados_inversor(
    device_id: str, sessao: requests.Session, token: str
) -> dict:
    """`GET /device-s/device/{id}/stats/day` — dados elétricos do dia.

    Retorna lista `[{storageName, detailList:[{value}]}]`. Achatamos para
    `{storageName: último_valor_da_série}`.

    Parâmetros de storageName relevantes:
        DV1-DV4: Tensão DC PV1-4 (V)
        DC1-DC4: Corrente DC PV1-4 (A)
        DP1-DP4: Potência DC PV1-4 (W)
        AV1:     Tensão AC (V)
        AC1:     Corrente AC (A)
        AF1:     Frequência (Hz)
        APo_t1:  Potência AC total (W)
        Et_ge0:  Energia acumulada total (kWh)
        Etdy_ge0: Energia do dia (kWh)
        AC_RDT_T1: Temperatura (°C)
    """
    from datetime import date

    hoje = date.today().strftime("%Y/%m/%d")
    dados = _get(
        f"/device-s/device/{device_id}/stats/day",
        sessao,
        token,
        params={"day": hoje, "lan": "en"},
    )
    if not isinstance(dados, list):
        return {}

    resultado: dict = {}
    for param in dados:
        nome = param.get("storageName", "")
        detail = param.get("detailList") or []
        if not detail:
            continue
        ultimo = detail[-1].get("value")
        if ultimo is None:
            continue
        try:
            resultado[nome] = float(ultimo)
        except (TypeError, ValueError):
            resultado[nome] = ultimo
    return resultado
