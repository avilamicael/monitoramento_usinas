"""Login Huawei FusionSolar (thirdData).

Fluxo:
1. POST `/thirdData/login` com `{userName, systemCode}`.
2. Recebe cookie `XSRF-TOKEN`; injeta como header em todas as chamadas.

Sessão expira depois de algumas horas. Expiração detectada em `consultas._post`
por `HTTP 401` ou `failCode == 305` ou mensagem contendo "login". Re-login
automático.

Credenciais: `{"username": "...", "system_code": "..."}`.
Cache: `{"xsrf_token": "..."}`.
"""
from __future__ import annotations

import logging

import requests

from apps.provedores.adapters.base import ErroAutenticacaoProvedor, ErroProvedor

logger = logging.getLogger(__name__)

BASE_URL = "https://intl.fusionsolar.huawei.com/thirdData"


def fazer_login(
    usuario: str, system_code: str, sessao: requests.Session
) -> str:
    try:
        resp = sessao.post(
            f"{BASE_URL}/login",
            json={"userName": usuario, "systemCode": system_code},
            timeout=20,
        )
    except requests.RequestException as exc:
        raise ErroProvedor(f"FusionSolar: rede no login — {exc}") from exc

    try:
        dados = resp.json()
    except ValueError as exc:
        raise ErroProvedor(
            f"FusionSolar: resposta inválida no login — {resp.text[:200]}"
        ) from exc

    if not dados.get("success"):
        raise ErroAutenticacaoProvedor(
            f"FusionSolar: login falhou — {dados.get('message') or dados}"
        )

    token = resp.cookies.get("XSRF-TOKEN") or resp.headers.get("XSRF-TOKEN")
    if token:
        sessao.headers.update({"XSRF-TOKEN": token})
    logger.info("FusionSolar: login ok")
    return token or ""
