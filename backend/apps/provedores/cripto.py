"""Criptografia simétrica de credenciais de provedores.

Usa Fernet (cryptography). A chave fica em `settings.CHAVE_CRIPTOGRAFIA`,
carregada de env. Geração inicial:

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

Rotação: guardar chave antiga + nova, descriptografar com antiga e recriptografar
com nova numa task one-off (fora deste escopo).
"""
from __future__ import annotations

import json
import logging
from base64 import b64decode
from datetime import datetime, timezone

from cryptography.fernet import Fernet
from django.conf import settings

logger = logging.getLogger(__name__)


class ChaveCriptografiaAusente(RuntimeError):
    """Levantada quando `CHAVE_CRIPTOGRAFIA` não está configurada."""


def _fernet() -> Fernet:
    chave = getattr(settings, "CHAVE_CRIPTOGRAFIA", "") or ""
    if not chave:
        raise ChaveCriptografiaAusente(
            "CHAVE_CRIPTOGRAFIA não definida. Gere uma com "
            "`python -c 'from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())'` e configure no .env."
        )
    return Fernet(chave.encode() if isinstance(chave, str) else chave)


def criptografar(dados: dict) -> str:
    """Serializa um dict e retorna texto criptografado."""
    return _fernet().encrypt(json.dumps(dados).encode()).decode()


def descriptografar(texto_enc: str) -> dict:
    """Descriptografa e devolve o dict original. Lança `InvalidToken` se a
    chave estiver errada ou o payload corrompido."""
    return json.loads(_fernet().decrypt(texto_enc.encode()).decode())


def parsear_exp_jwt(token: str) -> datetime | None:
    """Decodifica o claim `exp` de um JWT (sem validar assinatura).

    Retorna `datetime` aware em UTC se o token for um JWT com claim `exp`
    válido. Retorna `None` se:
      - `token` não é string ou está vazio,
      - o token não tem 3 partes separadas por `.`,
      - o payload não decodifica ou não é JSON,
      - o claim `exp` está ausente ou não é numérico.

    Não valida assinatura — só lê o payload. Uso interno para popular
    `ContaProvedor.cache_token_expira_em` a partir de tokens cacheados
    que sejam JWT (Solarman, FusionSolar futuro). Tokens não-JWT
    (Bearer UUID Auxsol, sessions Hoymiles) retornam `None`.
    """
    if not token or not isinstance(token, str):
        return None
    parts = token.split(".")
    if len(parts) != 3:
        return None
    payload_b64 = parts[1]
    pad = 4 - len(payload_b64) % 4
    if pad != 4:
        payload_b64 += "=" * pad
    try:
        payload = json.loads(b64decode(payload_b64))
    except Exception:  # noqa: BLE001 — qualquer falha de decode = não é JWT
        return None
    exp = payload.get("exp")
    if not isinstance(exp, (int, float)):
        return None
    try:
        return datetime.fromtimestamp(int(exp), tz=timezone.utc)
    except (OverflowError, OSError, ValueError):
        return None
