"""Endpoints da API Solis Cloud usados pelo adapter.

Cada função retorna o JSON bruto (lista de dicts). A normalização para
`DadosUsina`/`DadosInversor` fica em `adapter.py` — esse módulo só fala HTTP.

**Alertas nativos da Solis não são consumidos aqui.** O sistema antigo tinha
46% de churn <1h na Solis (falso-positivo grave); no novo sistema alertas
vêm das leituras pelo motor em `alertas/regras/`.
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

from .autenticacao import assinar

logger = logging.getLogger(__name__)

BASE_URL = "https://www.soliscloud.com:13333"
ITENS_POR_PAGINA = 100

# Rate limit observado da API: 3 req/5s. Pausa pequena entre chamadas
# consecutivas para não disparar 429 durante `listar_inversores` que faz
# N+1 pra buscar detalhe elétrico de cada inversor.
_PAUSA_ENTRE_DETALHES_S = 0.4


def _post(path: str, body: dict, api_key: str, app_secret: str) -> dict:
    """POST autenticado. Traduz erros HTTP/API para `ErroProvedor`."""
    headers, body_str = assinar(body, path, api_key, app_secret)

    inicio = time.time()
    try:
        resp = requests.post(
            BASE_URL + path, data=body_str, headers=headers, timeout=20,
        )
    except requests.RequestException as exc:
        raise ErroProvedor(f"Solis: erro de rede em {path}: {exc}") from exc

    duracao_ms = int((time.time() - inicio) * 1000)

    if resp.status_code == 429:
        raise ErroRateLimitProvedor("Solis: rate limit (429)")
    if resp.status_code == 401:
        raise ErroAutenticacaoProvedor("Solis: credenciais inválidas (401)")

    try:
        dados = resp.json()
    except ValueError as exc:
        raise ErroProvedor(
            f"Solis: resposta inválida em {path}: {resp.text[:200]}"
        ) from exc

    # Success flag da API: `success=True` ou `code=0/"0"`.
    if not dados.get("success") and dados.get("code") not in (0, "0"):
        msg = dados.get("msg") or dados.get("message") or str(dados)
        if "auth" in str(msg).lower() or "sign" in str(msg).lower():
            raise ErroAutenticacaoProvedor(f"Solis: auth — {msg}")
        raise ErroProvedor(f"Solis: erro API em {path} — {msg}")

    logger.debug("Solis: POST %s → %dms", path, duracao_ms)
    return dados


def listar_usinas(api_key: str, app_secret: str) -> list[dict]:
    """`POST /v1/api/userStationList` paginado. Retorna lista de stations."""
    resultado: list[dict] = []
    pagina = 1

    while True:
        dados = _post(
            "/v1/api/userStationList",
            {"pageNo": pagina, "pageSize": ITENS_POR_PAGINA},
            api_key,
            app_secret,
        )
        pagina_dados = (dados.get("data") or {}).get("page") or {}
        registros = pagina_dados.get("records") or []
        resultado.extend(registros)

        total = int(pagina_dados.get("total") or 0)
        if not registros or len(resultado) >= total:
            break
        pagina += 1

    return resultado


def listar_inversores(
    id_usina: str, api_key: str, app_secret: str
) -> list[dict]:
    """Retorna os inversores com dados elétricos em tempo real.

    Fluxo em dois passos:
      1. `/v1/api/inverterList` — lista + campos agregados (pac, etotal, pow1-32).
      2. `/v1/api/inverterDetail` por inversor — dados elétricos finos
         (uAc1, iAc1, uPv1, iPv1, fac, inverterTemperature).

    O passo 2 é rate-limited — o Solis rejeita em rajadas. A pausa de 0.4s
    entre chamadas mantém ~2.5 req/s, dentro do limite de 3 req/5s.
    """
    resultado: list[dict] = []
    pagina = 1

    while True:
        dados = _post(
            "/v1/api/inverterList",
            {
                "stationId": id_usina,
                "pageNo": pagina,
                "pageSize": ITENS_POR_PAGINA,
            },
            api_key,
            app_secret,
        )
        inner = dados.get("data") or dados
        pagina_dados = inner.get("page") or {}
        registros = pagina_dados.get("records") or []
        resultado.extend(registros)

        total = int(pagina_dados.get("total") or 0)
        if not registros or len(resultado) >= total:
            break
        pagina += 1

    # Enriquece cada inversor com dados elétricos do endpoint de detalhe.
    # Falha no detalhe não aborta — só marca `_detail = {}` e segue; o
    # adapter trata como "campos elétricos ausentes" (null no DadosInversor).
    for inv in resultado:
        inv_id = str(inv.get("id") or "")
        if not inv_id:
            inv["_detail"] = {}
            continue
        try:
            time.sleep(_PAUSA_ENTRE_DETALHES_S)
            detalhe = _post(
                "/v1/api/inverterDetail",
                {"id": inv_id},
                api_key,
                app_secret,
            )
            inv["_detail"] = detalhe.get("data") or {}
        except ErroProvedor as exc:
            logger.warning("Solis: detalhe falhou inv=%s — %s", inv_id, exc)
            inv["_detail"] = {}

    return resultado
