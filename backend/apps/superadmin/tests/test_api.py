"""Testes da API superadmin (cross-tenant)."""
from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.empresas.models import Empresa
from apps.usuarios.models import PapelUsuario, Usuario


@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="Empresa A", slug="empresa-a")


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(nome="Empresa B", slug="empresa-b")


@pytest.fixture
def empresa_firma(db):
    return Empresa.objects.create(nome="Firma Solar", slug="firma-solar")


@pytest.fixture
def superadmin(db, empresa_firma):
    user = Usuario(
        username="micael",
        email="micael@firmasolar.com.br",
        papel=PapelUsuario.SUPERADMIN,
        empresa=empresa_firma,
    )
    user.set_password("supersenha123")
    user.save()
    return user


@pytest.fixture
def admin_a(db, empresa_a):
    user = Usuario(
        username="admin_a",
        email="admin@a.com",
        papel=PapelUsuario.ADMIN,
        empresa=empresa_a,
    )
    user.set_password("senha123")
    user.save()
    return user


@pytest.fixture
def operacional_b(db, empresa_b):
    user = Usuario(
        username="op_b",
        email="op@b.com",
        papel=PapelUsuario.OPERACIONAL,
        empresa=empresa_b,
    )
    user.set_password("senha123")
    user.save()
    return user


@pytest.fixture
def client_super(superadmin):
    c = APIClient()
    c.force_authenticate(user=superadmin)
    return c


@pytest.fixture
def client_admin(admin_a):
    c = APIClient()
    c.force_authenticate(user=admin_a)
    return c


@pytest.fixture
def client_op(operacional_b):
    c = APIClient()
    c.force_authenticate(user=operacional_b)
    return c


# ─── Empresas ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_superadmin_lista_todas_empresas(client_super, empresa_a, empresa_b, empresa_firma):
    url = reverse("superadmin-empresa-list")
    resp = client_super.get(url)
    assert resp.status_code == status.HTTP_200_OK
    slugs = {e["slug"] for e in resp.data["results"]}
    assert {"empresa-a", "empresa-b", "firma-solar"} <= slugs


@pytest.mark.django_db
def test_superadmin_cria_empresa_e_admin(client_super):
    url_emp = reverse("superadmin-empresa-list")
    resp = client_super.post(
        url_emp,
        {"nome": "Cliente Novo", "cidade": "Florianópolis", "uf": "sc"},
        format="json",
    )
    assert resp.status_code == status.HTTP_201_CREATED, resp.data
    assert resp.data["slug"] == "cliente-novo"
    assert resp.data["uf"] == "SC"
    empresa_id = resp.data["id"]

    url_user = reverse("superadmin-usuario-list")
    resp2 = client_super.post(
        url_user,
        {
            "username": "admin_novo",
            "email": "novo@cliente.com",
            "first_name": "Admin",
            "last_name": "Novo",
            "papel": "administrador",
            "empresa": empresa_id,
            "password": "senhaSuperForte123",
            "is_active": True,
        },
        format="json",
    )
    assert resp2.status_code == status.HTTP_201_CREATED, resp2.data
    novo = Usuario.objects.get(username="admin_novo")
    assert novo.papel == "administrador"
    assert str(novo.empresa_id) == empresa_id
    assert novo.check_password("senhaSuperForte123")


@pytest.mark.django_db
def test_admin_de_empresa_recebe_403(client_admin):
    url = reverse("superadmin-empresa-list")
    resp = client_admin.get(url)
    assert resp.status_code == status.HTTP_403_FORBIDDEN

    resp2 = client_admin.post(
        url,
        {"nome": "Tentativa Hostil"},
        format="json",
    )
    assert resp2.status_code == status.HTTP_403_FORBIDDEN

    url_user = reverse("superadmin-usuario-list")
    resp3 = client_admin.get(url_user)
    assert resp3.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_operacional_recebe_403(client_op):
    url = reverse("superadmin-empresa-list")
    resp = client_op.get(url)
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_anonimo_recebe_401(empresa_a):
    c = APIClient()
    url = reverse("superadmin-empresa-list")
    resp = c.get(url)
    assert resp.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
def test_destroy_empresa_eh_soft_delete(client_super, empresa_a):
    url = reverse("superadmin-empresa-detail", kwargs={"pk": empresa_a.pk})
    resp = client_super.delete(url)
    assert resp.status_code == status.HTTP_204_NO_CONTENT
    empresa_a.refresh_from_db()
    assert empresa_a.is_active is False


# ─── Usuários ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_criar_usuario_hasheia_senha(client_super, empresa_a):
    url = reverse("superadmin-usuario-list")
    resp = client_super.post(
        url,
        {
            "username": "u_test",
            "papel": "operacional",
            "empresa": str(empresa_a.id),
            "password": "senhaForteSegura123",
        },
        format="json",
    )
    assert resp.status_code == status.HTTP_201_CREATED, resp.data
    u = Usuario.objects.get(username="u_test")
    assert u.password != "senhaForteSegura123"
    assert u.check_password("senhaForteSegura123") is True
    # Senha não deve voltar no payload de resposta.
    assert "password" not in resp.data


@pytest.mark.django_db
def test_listar_usuarios_filtra_por_empresa(client_super, empresa_a, empresa_b, admin_a, operacional_b):
    url = reverse("superadmin-usuario-list")
    resp = client_super.get(url, {"empresa": str(empresa_a.id)})
    assert resp.status_code == status.HTTP_200_OK
    usernames = {u["username"] for u in resp.data["results"]}
    assert "admin_a" in usernames
    assert "op_b" not in usernames

    resp_b = client_super.get(url, {"empresa": str(empresa_b.id)})
    usernames_b = {u["username"] for u in resp_b.data["results"]}
    assert "op_b" in usernames_b
    assert "admin_a" not in usernames_b


@pytest.mark.django_db
def test_atualizar_senha_via_patch(client_super, admin_a):
    url = reverse("superadmin-usuario-detail", kwargs={"pk": admin_a.pk})
    resp = client_super.patch(
        url,
        {"password": "novaSenhaForte123"},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK, resp.data
    admin_a.refresh_from_db()
    assert admin_a.check_password("novaSenhaForte123") is True


@pytest.mark.django_db
def test_destroy_usuario_eh_soft_delete(client_super, admin_a):
    url = reverse("superadmin-usuario-detail", kwargs={"pk": admin_a.pk})
    resp = client_super.delete(url)
    assert resp.status_code == status.HTTP_204_NO_CONTENT
    admin_a.refresh_from_db()
    assert admin_a.is_active is False


@pytest.mark.django_db
def test_command_criar_superadmin_idempotente(db, empresa_firma):
    from io import StringIO

    from django.core.management import call_command

    out = StringIO()
    call_command(
        "criar_superadmin",
        username="micael",
        senha="senhaForte123",
        empresa="firma-solar",
        stdout=out,
    )
    u = Usuario.objects.get(username="micael")
    assert u.papel == "superadmin"
    assert u.empresa.slug == "firma-solar"
    assert u.check_password("senhaForte123")

    # 2ª execução: redefine senha sem erro.
    call_command(
        "criar_superadmin",
        username="micael",
        senha="outraSenha456",
        empresa="firma-solar",
        stdout=out,
    )
    u.refresh_from_db()
    assert u.check_password("outraSenha456")
    assert Usuario.objects.filter(username="micael").count() == 1
    assert Empresa.objects.filter(slug="firma-solar").count() == 1
