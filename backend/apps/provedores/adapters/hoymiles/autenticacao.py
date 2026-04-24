"""Login da Hoymiles S-Cloud (nonce-hash).

Fluxo:
1. POST `/iam/pub/3/auth/pre-insp` com `{u: username}` → recebe `{n: nonce, a: salt, v: versão}`.
2. Gera hash da senha:
   - v1/v2: `md5(senha) + "." + sha256_b64(senha)`.
   - v3: `argon2id(senha, salt)` hex.
3. POST `/iam/pub/3/auth/login` com `{u, ch: hash, n: nonce}` → `{token: "3.xxx..."}`.

Token vive semanas/meses — deve ser persistido em `ContaProvedor.cache_token_enc`
pelo worker pra evitar re-login por ciclo.

Credenciais esperadas no dict: `{"username": "...", "password": "..."}`.
Cache populado: `{"token": "..."}`.
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging

import requests

from apps.provedores.adapters.base import (
    ErroAutenticacaoProvedor,
    ErroProvedor,
)

logger = logging.getLogger(__name__)

BASE_URL = "https://neapi.hoymiles.com"

HEADERS_BASE = {
    "Content-Type": "application/json; charset=UTF-8",
    "Accept": "application/json",
    "Origin": "https://global.hoymiles.com",
    "Referer": "https://global.hoymiles.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0",
    "language": "pt-pt",
}


def _md5(t: str) -> str:
    return hashlib.md5(t.encode()).hexdigest()


def _sha256_b64(t: str) -> str:
    return base64.b64encode(hashlib.sha256(t.encode()).digest()).decode()


def _hash_v1v2(senha: str) -> str:
    return f"{_md5(senha)}.{_sha256_b64(senha)}"


def _hash_v3(senha: str, salt_hex: str) -> str:
    try:
        from argon2.low_level import Type, hash_secret_raw
    except ImportError as exc:
        raise ErroProvedor(
            "Hoymiles v3 requer argon2-cffi"
        ) from exc
    h = hash_secret_raw(
        secret=senha.encode(),
        salt=bytes.fromhex(salt_hex),
        time_cost=3,
        memory_cost=32768,
        parallelism=1,
        hash_len=32,
        type=Type.ID,
    )
    return h.hex()


def _post_sem_auth(path: str, body: dict, sessao: requests.Session) -> dict:
    try:
        resp = sessao.post(
            f"{BASE_URL}/{path.lstrip('/')}",
            data=json.dumps(body, ensure_ascii=False),
            timeout=20,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as exc:
        raise ErroProvedor(f"Hoymiles rede em {path}: {exc}") from exc


def fazer_login(
    usuario: str, senha: str, sessao: requests.Session
) -> str:
    """Login completo. Retorna o token."""
    pre = _post_sem_auth("/iam/pub/3/auth/pre-insp", {"u": usuario}, sessao)
    inner = pre.get("data") or {}
    salt = inner.get("a")
    nonce = inner.get("n")
    versao = inner.get("v", 1)

    if versao == 3:
        if not salt:
            raise ErroAutenticacaoProvedor(
                "Hoymiles v3: salt ausente no pre-insp"
            )
        ch = _hash_v3(senha, salt)
    else:
        ch = _hash_v1v2(senha)

    resp = _post_sem_auth(
        "/iam/pub/3/auth/login",
        {"u": usuario, "ch": ch, "n": nonce},
        sessao,
    )
    data = resp.get("data") or {}
    token = data.get("token") if isinstance(data, dict) else data
    if not token:
        raise ErroAutenticacaoProvedor(f"Hoymiles: sem token em login — {resp}")

    logger.info("Hoymiles: login ok (token=%s...)", str(token)[:20])
    return token
