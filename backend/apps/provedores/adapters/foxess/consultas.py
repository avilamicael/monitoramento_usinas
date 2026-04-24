"""Endpoints da FoxESS OpenAPI usados pelo adapter.

Doc: https://www.foxesscloud.com/public/i18n/en/OpenApiDocument.html

Limites:
- 1 req/s (observado).
- 1440 chamadas por inversor por dia (`errno=40400`).

Alertas nativos **não** são consumidos — o sistema antigo sintetizava a
partir de `currentFault`, o que causava churn. No novo sistema, regras
internas cuidam disso.
"""
from __future__ import annotations

import json
import logging
import time

import requests

from apps.provedores.adapters.base import (
    ErroAutenticacaoProvedor,
    ErroProvedor,
    ErroRateLimitProvedor,
)

from .autenticacao import montar_headers

logger = logging.getLogger(__name__)

BASE_URL = "https://www.foxesscloud.com"
ITENS_POR_PAGINA = 100

_ERRNOS_AUTH = {40256, 40257, 40258, 40260}  # illegal sig, token, api key, permission
_ERRNOS_RATE = {40400, 40401}  # limite diário, concorrência


def _chamar(
    method: str, path: str, api_key: str, *, params=None, body=None
) -> dict:
    headers = montar_headers(path, api_key)
    data = json.dumps(body) if body is not None else None

    inicio = time.time()
    try:
        resp = requests.request(
            method, BASE_URL + path,
            headers=headers, params=params, data=data, timeout=20,
        )
    except requests.RequestException as exc:
        raise ErroProvedor(f"FoxESS: rede em {path}: {exc}") from exc

    duracao = int((time.time() - inicio) * 1000)

    if resp.status_code == 429:
        raise ErroRateLimitProvedor("FoxESS: HTTP 429")
    if resp.status_code in (401, 403):
        raise ErroAutenticacaoProvedor(f"FoxESS: HTTP {resp.status_code}")

    try:
        dados = resp.json()
    except ValueError as exc:
        raise ErroProvedor(
            f"FoxESS: resposta não-JSON em {path}: {resp.text[:200]}"
        ) from exc

    errno = dados.get("errno")
    msg = dados.get("msg") or ""

    if errno == 0:
        logger.debug("FoxESS: %s %s %dms", method, path, duracao)
        return dados

    if errno in _ERRNOS_AUTH:
        raise ErroAutenticacaoProvedor(
            f"FoxESS: auth errno={errno} msg={msg}"
        )
    if errno in _ERRNOS_RATE:
        raise ErroRateLimitProvedor(
            f"FoxESS: rate errno={errno} msg={msg}"
        )
    raise ErroProvedor(f"FoxESS: erro em {path} errno={errno} msg={msg}")


def listar_usinas(api_key: str) -> list[dict]:
    """`POST /op/v0/plant/list` paginado. Retorna stationID, name, ianaTimezone."""
    resultado: list[dict] = []
    pagina = 1
    while True:
        dados = _chamar(
            "POST", "/op/v0/plant/list", api_key,
            body={"currentPage": pagina, "pageSize": ITENS_POR_PAGINA},
        )
        pagina_dados = dados.get("result") or {}
        registros = pagina_dados.get("data") or []
        resultado.extend(registros)
        total = int(pagina_dados.get("total") or 0)
        if not registros or len(resultado) >= total:
            break
        pagina += 1
    return resultado


def detalhe_usina(station_id: str, api_key: str) -> dict:
    """`GET /op/v0/plant/detail?id=<stationID>` — capacidade, endereço, TZ."""
    dados = _chamar(
        "GET", "/op/v0/plant/detail", api_key, params={"id": station_id}
    )
    return dados.get("result") or {}


def listar_dispositivos(api_key: str) -> list[dict]:
    """`POST /op/v0/device/list` paginado.

    Atenção: `status` aqui é inconsistente (aparece `3` mesmo com o device
    gerando). O adapter deriva o estado real do real/query.
    """
    resultado: list[dict] = []
    pagina = 1
    while True:
        dados = _chamar(
            "POST", "/op/v0/device/list", api_key,
            body={"currentPage": pagina, "pageSize": ITENS_POR_PAGINA},
        )
        pagina_dados = dados.get("result") or {}
        registros = pagina_dados.get("data") or []
        resultado.extend(registros)
        total = int(pagina_dados.get("total") or 0)
        if not registros or len(resultado) >= total:
            break
        pagina += 1
    return resultado


def detalhe_dispositivo(device_sn: str, api_key: str) -> dict:
    """`GET /op/v1/device/detail?sn=<SN>` — capacidade, versões, bateria."""
    dados = _chamar(
        "GET", "/op/v1/device/detail", api_key, params={"sn": device_sn}
    )
    return dados.get("result") or {}


def consultar_tempo_real(sns: list[str], api_key: str) -> dict[str, dict]:
    """`POST /op/v1/device/real/query` em lotes de 50 SNs.

    Retorna `{sn: {variable_name: value}}` — achata o shape `datas:[{variable,value}]`
    da API pra facilitar o acesso no adapter.
    """
    if not sns:
        return {}
    resultado: dict[str, dict] = {}
    for i in range(0, len(sns), 50):
        lote = sns[i:i + 50]
        dados = _chamar(
            "POST", "/op/v1/device/real/query", api_key, body={"sns": lote}
        )
        for item in dados.get("result") or []:
            sn = item.get("deviceSN")
            if not sn:
                continue
            resultado[sn] = {
                v.get("variable"): v.get("value")
                for v in item.get("datas") or []
            }
    return resultado


def consultar_geracao(device_sn: str, api_key: str) -> dict:
    """`GET /op/v0/device/generation?sn=<SN>` — `{today, month, cumulative}`.

    Bug documentado: `cumulative` pode ser < `today` em contas novas. Adapter
    prefere `PVEnergyTotal` do real/query.
    """
    dados = _chamar(
        "GET", "/op/v0/device/generation", api_key, params={"sn": device_sn}
    )
    return dados.get("result") or {}
