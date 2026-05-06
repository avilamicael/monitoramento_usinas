"""Testes da API de configuração de regras (F2 do plano).

Endpoints sob `/api/alertas/configuracao-regras/`:
    GET    /                  → lista regras (overrides ∪ defaults)
    PUT    /<regra_nome>/     → upsert override
    DELETE /<regra_nome>/     → remove override
    POST   /reset-todos/      → apaga todos os overrides da empresa

Cobre permissão (admin escreve, operacional lê), validação de regra
inexistente e payload inválido, multi-tenancy e idempotência.
"""
from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.alertas.models import ConfiguracaoRegra, SeveridadeAlerta
from apps.empresas.models import Empresa
from apps.usuarios.models import PapelUsuario, Usuario


# ── Fixtures locais (não uso o conftest da pasta porque preciso de
# múltiplas empresas e usuários com papéis diferentes) ──────────────────────

@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="Empresa A", slug="empresa-a-cfgregras")


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(nome="Empresa B", slug="empresa-b-cfgregras")


def _criar_usuario(empresa, papel, sufixo):
    u = Usuario(
        username=f"u_{papel}_{sufixo}",
        email=f"{papel}.{sufixo}@x.com",
        papel=papel,
        empresa=empresa,
    )
    u.set_password("senha123")
    u.save()
    return u


@pytest.fixture
def admin_a(db, empresa_a):
    return _criar_usuario(empresa_a, PapelUsuario.ADMIN, "a")


@pytest.fixture
def operacional_a(db, empresa_a):
    return _criar_usuario(empresa_a, PapelUsuario.OPERACIONAL, "a")


@pytest.fixture
def admin_b(db, empresa_b):
    return _criar_usuario(empresa_b, PapelUsuario.ADMIN, "b")


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


# ── GET — F2/C1 ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_get_sem_overrides_lista_todas_regras_com_defaults(admin_a, empresa_a):
    """Sem nenhum override → todas as regras retornam com `is_default=True`."""
    from apps.alertas.motor import _carregar_regras
    from apps.alertas.regras import regras_registradas

    _carregar_regras()
    n_regras = len(regras_registradas())

    url = reverse("configuracao-regras-list")
    resp = _client(admin_a).get(url)

    assert resp.status_code == status.HTTP_200_OK, resp.data
    results = resp.data["results"]
    assert len(results) == n_regras
    assert all(r["is_default"] is True for r in results)
    # Defaults: ativa=True, configurada_em=null
    assert all(r["ativa"] is True for r in results)
    assert all(r["configurada_em"] is None for r in results)
    # Cada regra traz seu severidade_default
    for r in results:
        assert r["severidade"] == r["severidade_default"]
    # severidade_dinamica é bool
    for r in results:
        assert isinstance(r["severidade_dinamica"], bool)
    # E pelo menos `sem_comunicacao` e `garantia_vencendo` são dinâmicas
    nomes_dinamicos = {
        r["regra_nome"] for r in results if r["severidade_dinamica"]
    }
    assert "sem_comunicacao" in nomes_dinamicos
    assert "garantia_vencendo" in nomes_dinamicos


@pytest.mark.django_db
def test_get_com_overrides_marca_apenas_as_configuradas(admin_a, empresa_a):
    """Com 2 overrides → só essas duas têm `is_default=False`."""
    ConfiguracaoRegra.objects.create(
        empresa=empresa_a, regra_nome="temperatura_alta",
        ativa=False, severidade=SeveridadeAlerta.CRITICO,
    )
    ConfiguracaoRegra.objects.create(
        empresa=empresa_a, regra_nome="sobretensao_ac",
        ativa=True, severidade=SeveridadeAlerta.CRITICO,
    )

    url = reverse("configuracao-regras-list")
    resp = _client(admin_a).get(url)
    assert resp.status_code == status.HTTP_200_OK

    por_nome = {r["regra_nome"]: r for r in resp.data["results"]}
    assert por_nome["temperatura_alta"]["is_default"] is False
    assert por_nome["temperatura_alta"]["ativa"] is False
    assert por_nome["temperatura_alta"]["severidade"] == "critico"
    assert por_nome["temperatura_alta"]["configurada_em"] is not None

    assert por_nome["sobretensao_ac"]["is_default"] is False
    assert por_nome["sobretensao_ac"]["ativa"] is True
    assert por_nome["sobretensao_ac"]["severidade"] == "critico"

    # Demais ainda default
    assert por_nome["subtensao_ac"]["is_default"] is True


@pytest.mark.django_db
def test_get_sem_autenticacao_devolve_401(empresa_a):
    """Anônimo → 401."""
    url = reverse("configuracao-regras-list")
    resp = APIClient().get(url)
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_get_operacional_pode_ler(operacional_a, empresa_a):
    """Operacional (não admin) consegue ler — leitura é SAFE_METHOD."""
    url = reverse("configuracao-regras-list")
    resp = _client(operacional_a).get(url)
    assert resp.status_code == status.HTTP_200_OK
    assert "results" in resp.data


@pytest.mark.django_db
def test_get_multi_tenancy_isola_overrides(admin_a, admin_b, empresa_a, empresa_b):
    """Override criado em A não vaza para a listagem de B."""
    ConfiguracaoRegra.objects.create(
        empresa=empresa_a, regra_nome="temperatura_alta",
        ativa=False, severidade=SeveridadeAlerta.CRITICO,
    )

    url = reverse("configuracao-regras-list")

    resp_a = _client(admin_a).get(url)
    por_nome_a = {r["regra_nome"]: r for r in resp_a.data["results"]}
    assert por_nome_a["temperatura_alta"]["is_default"] is False

    resp_b = _client(admin_b).get(url)
    por_nome_b = {r["regra_nome"]: r for r in resp_b.data["results"]}
    assert por_nome_b["temperatura_alta"]["is_default"] is True
