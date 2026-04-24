"""Login AuxSol Cloud.

Fluxo:
1. POST `/auxsol-api/auth/login` com `{account, password, lang}`.
2. Resposta: `{code: "AWX-0000", data: {access_token: "uuid"}}`.
3. Token vive 12h (`Admin-Expires-In: 43200`).

Credenciais: `{"account": "...", "password": "..."}`.
Cache: `{"token": "...", "obtido_em": epoch_s}`.
"""
from __future__ import annotations

import logging
import time

import requests

from apps.provedores.adapters.base import ErroAutenticacaoProvedor, ErroProvedor

logger = logging.getLogger(__name__)

BASE_URL = "https://eu.auxsolcloud.com"

HEADERS_BASE = {
    "Content-Type": "application/json;charset=utf-8",
    "Accept": "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0",
    "Referer": f"{BASE_URL}/",
}

TOKEN_VALIDADE_S = 43200  # 12h
_MARGEM_RENOVACAO_S = 600  # renova 10min antes de expirar


def fazer_login(
    account: str, password: str, sessao: requests.Session
) -> dict:
    try:
        resp = sessao.post(
            f"{BASE_URL}/auxsol-api/auth/login",
            json={"account": account, "password": password, "lang": "en-US"},
            headers=HEADERS_BASE,
            timeout=20,
        )
    except requests.RequestException as exc:
        raise ErroProvedor(f"AuxSol rede no login: {exc}") from exc

    if resp.status_code == 401:
        raise ErroAutenticacaoProvedor("AuxSol: 401")

    try:
        dados = resp.json()
    except ValueError as exc:
        raise ErroProvedor(
            f"AuxSol: resposta inválida no login: {resp.text[:200]}"
        ) from exc

    if dados.get("code") != "AWX-0000":
        msg = dados.get("msg") or str(dados)
        raise ErroAutenticacaoProvedor(f"AuxSol login — {msg}")

    token = dados.get("data", {}).get("access_token") or dados.get("data")
    if not token or not isinstance(token, str):
        raise ErroAutenticacaoProvedor(f"AuxSol: sem token — {dados}")

    logger.info("AuxSol: login ok (token=%s...)", token[:20])
    return {"token": token, "obtido_em": int(time.time())}


def token_expirado(dados_token: dict) -> bool:
    """True se o token está dentro da margem de renovação (10min antes)."""
    obtido = dados_token.get("obtido_em", 0) or 0
    return int(time.time()) - obtido >= (TOKEN_VALIDADE_S - _MARGEM_RENOVACAO_S)
