"""Assinatura HMAC-SHA1 da API Solis Cloud.

A Solis é stateless: não há token nem sessão. Cada requisição é assinada
individualmente com `api_key` + `app_secret` via HMAC-SHA1 sobre uma string
canônica que inclui método, MD5 do body, content-type, data GMT e path.

Doc: https://www.soliscloud.com/doc/en/solis-cloud-api/

Credenciais esperadas no dict do adapter:
    {"api_key": "...", "app_secret": "..."}
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone


def assinar(body: dict, path: str, api_key: str, app_secret: str) -> tuple[dict, str]:
    """Retorna `(headers, body_str)` prontos para `requests.post(path, data=body_str)`.

    Retorna o body já serializado (mesmos bytes usados no MD5 que entrou na
    assinatura) — reemitir o dict pode gerar outra ordem e invalidar a assinatura.
    """
    body_str = json.dumps(body, separators=(",", ":"))
    md5 = base64.b64encode(hashlib.md5(body_str.encode()).digest()).decode()
    content_type = "application/json"
    data = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")

    str_para_assinar = f"POST\n{md5}\n{content_type}\n{data}\n{path}"
    assinatura = base64.b64encode(
        hmac.new(
            app_secret.encode(),
            str_para_assinar.encode(),
            hashlib.sha1,
        ).digest()
    ).decode()

    headers = {
        "Content-Type": content_type,
        "Content-MD5": md5,
        "Date": data,
        "Authorization": f"API {api_key}:{assinatura}",
    }
    return headers, body_str
