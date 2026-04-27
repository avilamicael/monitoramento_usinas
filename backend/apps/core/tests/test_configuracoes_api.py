"""Testes da API de configuração da empresa.

Endpoint singleton em `/api/configuracoes/`:
- GET retorna a `ConfiguracaoEmpresa` da empresa do request (cria com
  defaults via `get_or_create` se ainda não existir).
- PUT/PATCH atualiza — somente administradores podem escrever.
"""
from __future__ import annotations

from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.core.models import ConfiguracaoEmpresa
from apps.empresas.models import Empresa
from apps.usuarios.models import PapelUsuario, Usuario


@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Empresa Teste", slug="empresa-teste")


@pytest.fixture
def admin(db, empresa):
    user = Usuario(
        username="admin_cfg",
        email="admin@cfg.com",
        papel=PapelUsuario.ADMIN,
        empresa=empresa,
    )
    user.set_password("senha123")
    user.save()
    return user


@pytest.fixture
def operacional(db, empresa):
    user = Usuario(
        username="op_cfg",
        email="op@cfg.com",
        papel=PapelUsuario.OPERACIONAL,
        empresa=empresa,
    )
    user.set_password("senha123")
    user.save()
    return user


@pytest.fixture
def client_admin(admin):
    c = APIClient()
    c.force_authenticate(user=admin)
    return c


@pytest.fixture
def client_op(operacional):
    c = APIClient()
    c.force_authenticate(user=operacional)
    return c


@pytest.mark.django_db
def test_get_cria_configuracao_com_defaults_se_nao_existe(client_admin, empresa):
    """Primeira leitura cria a configuração automaticamente com defaults."""
    assert not ConfiguracaoEmpresa.objects.filter(empresa=empresa).exists()

    url = reverse("configuracoes")
    resp = client_admin.get(url)

    assert resp.status_code == status.HTTP_200_OK, resp.data
    # Defaults conforme `core.models.ConfiguracaoEmpresa`
    assert resp.data["garantia_padrao_meses"] == 12
    assert resp.data["alerta_sem_comunicacao_minutos"] == 60
    assert resp.data["temperatura_limite_c"] == "75.00"
    assert str(resp.data["empresa"]) == str(empresa.id)
    # E persistiu
    assert ConfiguracaoEmpresa.objects.filter(empresa=empresa).exists()


@pytest.mark.django_db
def test_admin_atualiza_configuracao_via_patch(client_admin, empresa):
    """Admin altera `temperatura_limite_c` e o valor persiste."""
    ConfiguracaoEmpresa.objects.create(empresa=empresa)

    url = reverse("configuracoes")
    resp = client_admin.patch(url, {"temperatura_limite_c": "80.0"}, format="json")

    assert resp.status_code == status.HTTP_200_OK, resp.data
    assert resp.data["temperatura_limite_c"] == "80.00"

    config = ConfiguracaoEmpresa.objects.get(empresa=empresa)
    assert config.temperatura_limite_c == Decimal("80.00")


@pytest.mark.django_db
def test_operacional_pode_ler_mas_nao_pode_atualizar(client_op, empresa):
    """Operacional vê a configuração mas recebe 403 ao tentar PATCH/PUT."""
    ConfiguracaoEmpresa.objects.create(empresa=empresa, temperatura_limite_c=Decimal("75"))

    url = reverse("configuracoes")

    resp_get = client_op.get(url)
    assert resp_get.status_code == status.HTTP_200_OK
    assert resp_get.data["temperatura_limite_c"] == "75.00"

    resp_patch = client_op.patch(url, {"temperatura_limite_c": "90.0"}, format="json")
    assert resp_patch.status_code == status.HTTP_403_FORBIDDEN

    # Valor não mudou
    config = ConfiguracaoEmpresa.objects.get(empresa=empresa)
    assert config.temperatura_limite_c == Decimal("75.00")
