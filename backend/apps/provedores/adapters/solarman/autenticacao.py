"""Validação de token JWT Solarman Business.

Login web está protegido por Cloudflare Turnstile — não automatizamos. O
JWT (cookie `tokenKey`) é copiado manualmente do browser e salvo em
`ContaProvedor.cache_token_enc` via admin. Validade típica ~60 dias.

Se o token está expirado (ou a menos de `margem_horas` da expiração),
`validar_token` levanta `ErroAutenticacaoProvedor` — worker marca
`precisa_atencao=True` e o usuário é notificado.

Credenciais: `{"email": "...", "password": "..."}` (só informativo).
Cache: `{"token": "eyJ..."}`.
"""
from __future__ import annotations

import json
import logging
import time
from base64 import b64decode

from apps.provedores.adapters.base import ErroAutenticacaoProvedor

logger = logging.getLogger(__name__)

BASE_URL = "https://globalpro.solarmanpv.com"

HEADERS_BASE = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0",
    "Referer": f"{BASE_URL}/",
}


def decodificar_jwt_payload(token: str) -> dict:
    """Decodifica o payload JWT sem validar assinatura (só leitura do `exp`)."""
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return {}
        payload_b64 = parts[1]
        pad = 4 - len(payload_b64) % 4
        if pad != 4:
            payload_b64 += "=" * pad
        return json.loads(b64decode(payload_b64))
    except Exception:  # noqa: BLE001
        return {}


def token_expirado(token: str, margem_horas: int = 24) -> bool:
    payload = decodificar_jwt_payload(token)
    exp = payload.get("exp", 0)
    if not exp:
        return True
    return int(time.time()) >= (exp - margem_horas * 3600)


def validar_token(token: str) -> str:
    if not token or not token.startswith("eyJ"):
        raise ErroAutenticacaoProvedor(
            "Solarman: token JWT inválido ou ausente — copie o cookie tokenKey do browser."
        )
    if token_expirado(token, margem_horas=0):
        raise ErroAutenticacaoProvedor(
            "Solarman: JWT expirado — renovação manual necessária (Turnstile)."
        )
    return token
