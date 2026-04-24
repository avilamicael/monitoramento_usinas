"""Assinatura FoxESS OpenAPI (HMAC-MD5 stateless).

Cada requisição carrega os headers `token`, `timestamp` (ms) e `signature`.
A assinatura é MD5 hex de `path + "\\r\\n" + api_key + "\\r\\n" + timestamp_ms`,
onde `\\r\\n` são os 4 caracteres literais `\\`, `r`, `\\`, `n` — **não** CR+LF
interpretado (validado contra a API: CR+LF resulta em `illegal signature`).

Credenciais esperadas no dict: `{"api_key": "..."}`.
"""
from __future__ import annotations

import hashlib
import time


def montar_headers(path: str, api_key: str) -> dict[str, str]:
    timestamp_ms = str(int(time.time() * 1000))
    raw = fr"{path}\r\n{api_key}\r\n{timestamp_ms}"
    signature = hashlib.md5(raw.encode("utf-8")).hexdigest()
    return {
        "token": api_key,
        "timestamp": timestamp_ms,
        "signature": signature,
        "lang": "en",
        "Content-Type": "application/json;charset=UTF-8",
    }
