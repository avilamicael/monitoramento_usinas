"""Criptografia simétrica de credenciais de provedores.

Usa Fernet (cryptography). A chave fica em `settings.CHAVE_CRIPTOGRAFIA`,
carregada de env. Geração inicial:

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

Rotação: guardar chave antiga + nova, descriptografar com antiga e recriptografar
com nova numa task one-off (fora deste escopo).
"""
from __future__ import annotations

import json

from cryptography.fernet import Fernet
from django.conf import settings


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
