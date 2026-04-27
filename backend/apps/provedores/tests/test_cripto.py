"""Testes do parser `parsear_exp_jwt`.

Cobre:
- JWT válido com claim `exp` (caso típico Solarman).
- JWT sem claim `exp` ou com `exp` não-numérico.
- Strings que não são JWT (UUID Auxsol, session opaca Hoymiles).
- Inputs inválidos (None, vazio, padding base64 quebrado).
"""
from __future__ import annotations

import json
import time
from base64 import urlsafe_b64encode
from datetime import datetime, timezone

from apps.provedores.cripto import parsear_exp_jwt


def _montar_jwt(payload: dict) -> str:
    """Monta um JWT fake (assinatura ignorada — só queremos o payload)."""
    header = urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').rstrip(b"=").decode()
    body = urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    return f"{header}.{body}.assinatura-ignorada"


def test_jwt_com_exp_valido_retorna_datetime_utc():
    futuro = int(time.time()) + 30 * 24 * 3600  # +30d
    token = _montar_jwt({"sub": "user", "exp": futuro})

    resultado = parsear_exp_jwt(token)

    assert resultado is not None
    assert resultado.tzinfo is timezone.utc
    assert resultado == datetime.fromtimestamp(futuro, tz=timezone.utc)


def test_jwt_sem_exp_retorna_none():
    token = _montar_jwt({"sub": "user"})
    assert parsear_exp_jwt(token) is None


def test_jwt_com_exp_nao_numerico_retorna_none():
    token = _montar_jwt({"exp": "amanha"})
    assert parsear_exp_jwt(token) is None


def test_token_opaco_uuid_auxsol_retorna_none():
    # Auxsol Bearer = UUID, sem pontos.
    assert parsear_exp_jwt("550e8400-e29b-41d4-a716-446655440000") is None


def test_token_com_dois_pontos_nao_e_jwt():
    # JWT precisa de exatamente 3 partes (header.payload.signature).
    assert parsear_exp_jwt("a.b") is None
    assert parsear_exp_jwt("a.b.c.d") is None


def test_payload_invalido_base64_retorna_none():
    # Segunda parte não decodifica como JSON.
    assert parsear_exp_jwt("aaa.bbb.ccc") is None


def test_string_vazia_retorna_none():
    assert parsear_exp_jwt("") is None


def test_none_retorna_none():
    assert parsear_exp_jwt(None) is None  # type: ignore[arg-type]


def test_input_nao_string_retorna_none():
    assert parsear_exp_jwt(12345) is None  # type: ignore[arg-type]


def test_payload_sem_padding_base64_funciona():
    # Payload `{"exp":1}` em base64 sem padding tem comprimento 12, precisa
    # de 0 paddings. Testa um caso que precisa de padding (1 byte).
    payload = {"exp": 1700000000}
    raw = urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    # Verifica que precisamos remover padding e re-adicionar:
    token = f"hdr.{raw}.sig"
    resultado = parsear_exp_jwt(token)
    assert resultado is not None
    assert resultado == datetime.fromtimestamp(1700000000, tz=timezone.utc)
