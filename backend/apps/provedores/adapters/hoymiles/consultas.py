"""Endpoints da Hoymiles S-Cloud (já autenticados)."""
from __future__ import annotations

import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date as date_type

import requests

from apps.provedores.adapters.base import (
    ErroAutenticacaoProvedor,
    ErroProvedor,
    ErroRateLimitProvedor,
)

from .autenticacao import BASE_URL
from .protobuf import parsear_dados_dia

logger = logging.getLogger(__name__)


def _post(
    path: str, body: dict, sessao: requests.Session, token: str
) -> dict:
    inicio = time.time()
    try:
        resp = sessao.post(
            f"{BASE_URL}/{path.lstrip('/')}",
            data=json.dumps(body, ensure_ascii=False),
            headers={"authorization": token},
            timeout=20,
        )
    except requests.RequestException as exc:
        raise ErroProvedor(f"Hoymiles rede em {path}: {exc}") from exc

    dur_ms = int((time.time() - inicio) * 1000)

    if resp.status_code == 429:
        raise ErroRateLimitProvedor("Hoymiles: 429")
    if resp.status_code == 401:
        raise ErroAutenticacaoProvedor("Hoymiles: 401")

    try:
        dados = resp.json()
    except ValueError as exc:
        raise ErroProvedor(
            f"Hoymiles: resposta não-JSON em {path}: {resp.text[:200]}"
        ) from exc

    status = str(dados.get("status", ""))
    if status not in ("0", "200", ""):
        msg = dados.get("message") or str(dados)
        if (
            "auth" in msg.lower()
            or "token" in msg.lower()
            or status in ("401", "403")
        ):
            raise ErroAutenticacaoProvedor(f"Hoymiles auth — {msg}")
        raise ErroProvedor(f"Hoymiles erro em {path} — {msg}")

    logger.debug("Hoymiles: %s %dms", path, dur_ms)
    return dados


def _realtime_usina(
    id_usina: str, sessao: requests.Session, token: str
) -> dict:
    try:
        dados = _post(
            "/pvm-data/api/0/station/data/count_station_real_data",
            {"sid": id_usina},
            sessao,
            token,
        )
        return dados.get("data") or {}
    except ErroProvedor:
        return {}


def listar_usinas(
    sessao: requests.Session, token: str
) -> list[dict]:
    """Lista paginada + realtime em paralelo (até 5 threads).

    Cada registro final é `{...campos, "_realtime": {...}}`.
    """
    todas: list[dict] = []
    pagina = 1
    while True:
        dados = _post(
            "/pvm/api/0/station/select_by_page",
            {"page": pagina, "page_size": 100},
            sessao,
            token,
        )
        usinas = (dados.get("data") or {}).get("list") or []
        todas.extend(usinas)
        if len(usinas) < 100:
            break
        pagina += 1

    if not todas:
        return []

    ids = [str(u.get("id", "")) for u in todas]
    realtime: dict[str, dict] = {}

    with ThreadPoolExecutor(max_workers=5) as ex:
        futs = {ex.submit(_realtime_usina, sid, sessao, token): sid for sid in ids}
        for fut in as_completed(futs):
            sid = futs[fut]
            try:
                realtime[sid] = fut.result()
            except Exception:  # noqa: BLE001
                realtime[sid] = {}

    return [
        {**u, "_realtime": realtime.get(str(u.get("id", "")), {})}
        for u in todas
    ]


def listar_inversores(
    id_usina: str, sessao: requests.Session, token: str
) -> list[dict]:
    """`select_device_of_tree` — filtra apenas type=2 (inversor) e 3 (microinversor)."""
    dados = _post(
        "/pvm/api/0/station/select_device_of_tree",
        {"id": id_usina},
        sessao,
        token,
    )
    dispositivos = dados.get("data") or []
    resultado: list[dict] = []

    def _percorrer(itens):
        for item in itens:
            if item.get("type") in (2, 3):
                resultado.append(item)
            filhos = item.get("children") or []
            if filhos:
                _percorrer(filhos)

    _percorrer(dispositivos)
    return resultado


def baixar_dados_dia(
    id_usina: str, sessao: requests.Session, token: str
) -> dict[int, dict]:
    """Baixa `down_module_day_data` e devolve `{micro_id: dados_agregados}`.

    Falha silenciosa (retorna {}) pra não abortar o ciclo se um dia tiver
    problema — adapter trata como "elétricos ausentes" e não abre alerta.
    """
    hoje = date_type.today().strftime("%Y-%m-%d")
    try:
        resp = sessao.post(
            f"{BASE_URL}/pvm-data/api/0/module/data/down_module_day_data",
            data=json.dumps({"sid": int(id_usina), "date": hoje}),
            headers={"authorization": token},
            timeout=30,
        )
    except requests.RequestException as exc:
        logger.warning("Hoymiles: rede em down_module_day_data — %s", exc)
        return {}

    if resp.status_code != 200 or not resp.content:
        logger.warning(
            "Hoymiles: down_module_day_data HTTP %d", resp.status_code
        )
        return {}

    try:
        return parsear_dados_dia(resp.content)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Hoymiles: parsing protobuf falhou — %s", exc)
        return {}
