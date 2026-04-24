"""Endpoints Huawei FusionSolar thirdData.

Particularidades:
- `failCode == 407` = ACCESS_FREQUENCY_IS_TOO_HIGH (rate limit). API
  documenta mínimo de 30 min entre chamadas — `intervalo_minimo_minutos=30`.
- `failCode == 305` = sessão expirada → re-login transparente.
- Pausa entre chamadas (`_PAUSA_S`) mitiga bursts que disparam 407
  mesmo dentro do intervalo.
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

from .autenticacao import BASE_URL, fazer_login

logger = logging.getLogger(__name__)

# devTypeIds confirmados como suportados por /getDevRealKpi. Outros tipos
# são incluídos sem _kpi (adapter trata como "offline/sem dados").
TIPOS_COM_KPI = frozenset({
    1,   # String Inverter trifásico (comercial/utility)
    38,  # SUN2000 residencial
})

_PAUSA_S = 5


def _post(
    path: str,
    body: dict,
    sessao: requests.Session,
    usuario: str,
    system_code: str,
) -> dict:
    try:
        resp = sessao.post(
            f"{BASE_URL}/{path.lstrip('/')}", json=body, timeout=20
        )
    except requests.RequestException as exc:
        raise ErroProvedor(f"FusionSolar rede em {path}: {exc}") from exc

    if resp.status_code == 429:
        raise ErroRateLimitProvedor("FusionSolar 429")

    if resp.status_code == 401:
        logger.info("FusionSolar: 401 — reconectando")
        fazer_login(usuario, system_code, sessao)
        try:
            resp = sessao.post(
                f"{BASE_URL}/{path.lstrip('/')}", json=body, timeout=20
            )
        except requests.RequestException as exc:
            raise ErroProvedor(f"FusionSolar: após re-login {path}: {exc}") from exc
        if resp.status_code == 401:
            raise ErroAutenticacaoProvedor(
                "FusionSolar: re-login falhou (401)"
            )

    try:
        dados = resp.json()
    except ValueError as exc:
        raise ErroProvedor(
            f"FusionSolar: resposta inválida em {path}: {resp.text[:200]}"
        ) from exc

    if not dados.get("success"):
        fail = str(dados.get("failCode", ""))
        msg = dados.get("message") or dados.get("data") or fail or str(dados)

        if fail == "407" or "frequency" in str(msg).lower():
            raise ErroRateLimitProvedor(f"FusionSolar rate (407) em {path}")

        if fail == "305" or "login" in str(msg).lower():
            logger.info("FusionSolar: sessão expirada (%s) — reconectando", fail)
            fazer_login(usuario, system_code, sessao)
            time.sleep(2)
            try:
                resp = sessao.post(
                    f"{BASE_URL}/{path.lstrip('/')}", json=body, timeout=20
                )
                dados = resp.json()
            except Exception as exc:  # noqa: BLE001
                raise ErroProvedor(
                    f"FusionSolar: pós re-login em {path}: {exc}"
                ) from exc
            if not dados.get("success"):
                fail2 = str(dados.get("failCode", ""))
                if fail2 == "407":
                    raise ErroRateLimitProvedor(
                        f"FusionSolar rate pós re-login em {path}"
                    )
                raise ErroAutenticacaoProvedor(
                    f"FusionSolar pós re-login: {dados.get('message')}"
                )
            return dados

        raise ErroProvedor(f"FusionSolar erro em {path} — {msg}")

    return dados


def listar_usinas(
    sessao: requests.Session, usuario: str, system_code: str
) -> list[dict]:
    """`/getStationList` + `/getStationRealKpi` em lote.

    Retorna registros com `_kpi` combinado (mesclado com dataItemMap).
    """
    dados = _post("/getStationList", {}, sessao, usuario, system_code)
    usinas = dados.get("data") or []
    if not usinas:
        return []

    codigos = ",".join(u.get("stationCode", "") for u in usinas if u.get("stationCode"))
    time.sleep(_PAUSA_S)

    try:
        kpi = _post(
            "/getStationRealKpi",
            {"stationCodes": codigos},
            sessao, usuario, system_code,
        )
        kpi_map = {
            item["stationCode"]: item.get("dataItemMap", {})
            for item in (kpi.get("data") or [])
            if item.get("stationCode")
        }
    except ErroProvedor:
        kpi_map = {}

    return [{**u, "_kpi": kpi_map.get(u.get("stationCode", ""), {})} for u in usinas]


def listar_todos_inversores(
    codigos_usinas: list[str],
    sessao: requests.Session,
    usuario: str,
    system_code: str,
) -> dict[str, list[dict]]:
    """Busca inversores de todas as usinas em lote via `/getDevList` +
    `/getDevRealKpi` por devTypeId.

    Retorna dict `{stationCode: [dispositivos_com__kpi]}`. Tipos fora de
    `TIPOS_COM_KPI` aparecem com `_kpi = {}` (adapter trata como sem dados).
    """
    resultado: dict[str, list[dict]] = {c: [] for c in codigos_usinas}
    if not codigos_usinas:
        return resultado

    time.sleep(_PAUSA_S)
    try:
        dados = _post(
            "/getDevList",
            {"stationCodes": ",".join(codigos_usinas)},
            sessao, usuario, system_code,
        )
    except (ErroRateLimitProvedor, ErroProvedor) as exc:
        logger.warning("FusionSolar: getDevList falhou — %s", exc)
        return resultado

    inversores = dados.get("data") or []
    if not inversores:
        return resultado

    por_tipo: dict[int, list[dict]] = {}
    for d in inversores:
        por_tipo.setdefault(d.get("devTypeId"), []).append(d)

    kpi_por_id: dict[str, dict] = {}
    for dev_type, devs in por_tipo.items():
        if dev_type not in TIPOS_COM_KPI:
            continue
        ids = [str(d.get("id")) for d in devs if d.get("id")]
        if not ids:
            continue
        time.sleep(_PAUSA_S)
        try:
            kpi_resp = _post(
                "/getDevRealKpi",
                {"devIds": ",".join(ids), "devTypeId": dev_type},
                sessao, usuario, system_code,
            )
            for item in kpi_resp.get("data") or []:
                if item.get("devId"):
                    kpi_por_id[str(item["devId"])] = item.get("dataItemMap", {})
        except ErroProvedor as exc:
            logger.warning(
                "FusionSolar: getDevRealKpi tipo=%s falhou — %s", dev_type, exc
            )

    for d in inversores:
        codigo = d.get("stationCode", "")
        if codigo in resultado:
            resultado[codigo].append(
                {**d, "_kpi": kpi_por_id.get(str(d.get("id", "")), {})}
            )
    return resultado
