"""Cobertura do relogin transparente do AuxsolAdapter.

Cenário de produção (2026-05-07): a VPS recebia `登录状态已过期`
do `eu.auxsolcloud.com` antes do prazo de 12h declarado pelo provedor.
O `_get` traduzia em `ErroAutenticacaoProvedor` e a task marcava a conta
como `precisa_atencao=True` sem reaproveitar a sessão. O adapter agora
invalida o token local nessa exceção, refaz login e reexecuta a chamada
uma vez antes de propagar.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest

from apps.provedores.adapters.auxsol.adapter import AuxsolAdapter
from apps.provedores.adapters.base import ErroAutenticacaoProvedor


@pytest.fixture
def adapter() -> AuxsolAdapter:
    # token já cacheado, ainda dentro da validade local — simula o caso
    # em que o servidor invalidou antes do prazo.
    return AuxsolAdapter(
        {
            "account": "x",
            "password": "y",
            "token": "token-velho",
            "obtido_em": 9_000_000_000,  # bem no futuro pra _garantir_autenticado não relogar sozinho
        }
    )


def test_buscar_usinas_relogin_apos_token_rejeitado(adapter):
    """Primeira chamada falha com auth; adapter relog e tenta de novo."""
    chamadas: list[str] = []

    def listar_fake(sessao, token):
        chamadas.append(token)
        if token == "token-velho":
            raise ErroAutenticacaoProvedor("AuxSol auth — 登录状态已过期")
        return []

    def login_fake(account, password, sessao):
        return {"token": "token-novo", "obtido_em": 9_000_000_001}

    with (
        patch("apps.provedores.adapters.auxsol.adapter.listar_usinas", listar_fake),
        patch("apps.provedores.adapters.auxsol.adapter.fazer_login", login_fake),
    ):
        adapter.buscar_usinas()

    assert chamadas == ["token-velho", "token-novo"]
    assert adapter._token == "token-novo"


def test_buscar_usinas_relogin_falhando_propaga(adapter):
    """Se o relogin também falhar, exceção sobe pra task marcar atenção."""

    def listar_sempre_falha(sessao, token):
        raise ErroAutenticacaoProvedor("AuxSol auth — 登录状态已过期")

    def login_fake(account, password, sessao):
        return {"token": "token-novo", "obtido_em": 9_000_000_001}

    with (
        patch(
            "apps.provedores.adapters.auxsol.adapter.listar_usinas",
            listar_sempre_falha,
        ),
        patch("apps.provedores.adapters.auxsol.adapter.fazer_login", login_fake),
    ):
        with pytest.raises(ErroAutenticacaoProvedor):
            adapter.buscar_usinas()


def test_credenciais_aceita_username_como_chave_padrao():
    """Adapter aceita `username` (convenção) e `account` (legado)."""
    a = AuxsolAdapter({"username": "u", "password": "p", "token": "t", "obtido_em": 0})
    assert a._account == "u"
    b = AuxsolAdapter({"account": "u2", "password": "p", "token": "t", "obtido_em": 0})
    assert b._account == "u2"


def test_buscar_inversores_relogin_transparente(adapter):
    """Listagem de inversores também precisa do retry."""
    chamadas: list[str] = []

    def listar_inversores_fake(plant_id, sessao, token):
        chamadas.append(("listar", token))
        if token == "token-velho":
            raise ErroAutenticacaoProvedor("AuxSol auth — 登录状态已过期")
        return []

    def login_fake(account, password, sessao):
        return {"token": "token-novo", "obtido_em": 9_000_000_001}

    with (
        patch(
            "apps.provedores.adapters.auxsol.adapter.listar_inversores",
            listar_inversores_fake,
        ),
        patch("apps.provedores.adapters.auxsol.adapter.fazer_login", login_fake),
    ):
        adapter.buscar_inversores("usina-1")

    assert chamadas == [("listar", "token-velho"), ("listar", "token-novo")]
