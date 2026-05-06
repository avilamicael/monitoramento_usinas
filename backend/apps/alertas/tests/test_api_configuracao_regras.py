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


# ── PUT — F2/C2 ─────────────────────────────────────────────────────────────

def _url_detalhe(regra_nome):
    return reverse("configuracao-regras-detalhe", args=[regra_nome])


@pytest.mark.django_db
def test_put_cria_override_quando_nao_existe(admin_a, empresa_a):
    """Sem `ConfiguracaoRegra` prévia → PUT cria registro novo."""
    assert not ConfiguracaoRegra.objects.filter(
        empresa=empresa_a, regra_nome="temperatura_alta",
    ).exists()

    resp = _client(admin_a).put(
        _url_detalhe("temperatura_alta"),
        {"ativa": False, "severidade": "critico"},
        format="json",
    )

    assert resp.status_code == status.HTTP_200_OK, resp.data
    assert resp.data["regra_nome"] == "temperatura_alta"
    assert resp.data["ativa"] is False
    assert resp.data["severidade"] == "critico"
    assert resp.data["is_default"] is False
    assert resp.data["configurada_em"] is not None

    cfg = ConfiguracaoRegra.objects.get(
        empresa=empresa_a, regra_nome="temperatura_alta",
    )
    assert cfg.ativa is False
    assert cfg.severidade == "critico"


@pytest.mark.django_db
def test_put_atualiza_override_existente_preservando_created_at(admin_a, empresa_a):
    """Update_or_create deve preservar `created_at` do registro original."""
    cfg = ConfiguracaoRegra.objects.create(
        empresa=empresa_a, regra_nome="temperatura_alta",
        ativa=True, severidade=SeveridadeAlerta.AVISO,
    )
    created_original = cfg.created_at

    resp = _client(admin_a).put(
        _url_detalhe("temperatura_alta"),
        {"ativa": False, "severidade": "critico"},
        format="json",
    )

    assert resp.status_code == status.HTTP_200_OK
    cfg.refresh_from_db()
    assert cfg.ativa is False
    assert cfg.severidade == "critico"
    # created_at preservado (não houve INSERT novo)
    assert cfg.created_at == created_original
    # updated_at deve ser >= created_at (auto_now)
    assert cfg.updated_at >= created_original


@pytest.mark.django_db
def test_put_regra_invalida_devolve_404(admin_a, empresa_a):
    """Regra inexistente em `regras_registradas()` → 404."""
    resp = _client(admin_a).put(
        _url_detalhe("regra_que_nao_existe"),
        {"ativa": True, "severidade": "info"},
        format="json",
    )
    assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_put_payload_invalido_devolve_400(admin_a, empresa_a):
    """Severidade fora de choices → 400."""
    resp = _client(admin_a).put(
        _url_detalhe("temperatura_alta"),
        {"ativa": True, "severidade": "xyz"},
        format="json",
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "severidade" in resp.data


@pytest.mark.django_db
def test_put_payload_faltando_campo_devolve_400(admin_a, empresa_a):
    """Sem `ativa` no payload → 400 (BooleanField obrigatório)."""
    resp = _client(admin_a).put(
        _url_detalhe("temperatura_alta"),
        {"severidade": "info"},
        format="json",
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "ativa" in resp.data


@pytest.mark.django_db
def test_put_operacional_devolve_403(operacional_a, empresa_a):
    """Operacional não pode escrever — 403."""
    resp = _client(operacional_a).put(
        _url_detalhe("temperatura_alta"),
        {"ativa": False, "severidade": "info"},
        format="json",
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert not ConfiguracaoRegra.objects.filter(
        empresa=empresa_a, regra_nome="temperatura_alta",
    ).exists()


@pytest.mark.django_db
def test_put_severidade_dinamica_aceita_payload_mas_motor_ignora(
    admin_a, empresa_a,
):
    """Para regras dinâmicas a API persiste a severidade no banco; o motor
    ignora em runtime (já testado em F1/C2).

    Decisão: API permissiva, UI controla a interação. Permite que se algum
    dia mudarmos a semântica para "teto" ou "piso", o dado já está lá.
    """
    resp = _client(admin_a).put(
        _url_detalhe("sem_comunicacao"),  # severidade_dinamica=True
        {"ativa": True, "severidade": "info"},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK
    # Persistiu mesmo sendo dinâmica
    cfg = ConfiguracaoRegra.objects.get(
        empresa=empresa_a, regra_nome="sem_comunicacao",
    )
    assert cfg.severidade == "info"
    # E a resposta marca a regra como dinâmica para a UI exibir o tooltip
    assert resp.data["severidade_dinamica"] is True


@pytest.mark.django_db
def test_put_multi_tenancy(admin_a, admin_b, empresa_a, empresa_b):
    """PUT em empresa A não cria/altera nada na empresa B."""
    _client(admin_a).put(
        _url_detalhe("temperatura_alta"),
        {"ativa": False, "severidade": "critico"},
        format="json",
    )
    assert ConfiguracaoRegra.objects.filter(empresa=empresa_a).count() == 1
    assert ConfiguracaoRegra.objects.filter(empresa=empresa_b).count() == 0


# ── DELETE — F2/C2 ──────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_delete_remove_override_e_volta_para_default(admin_a, empresa_a):
    """DELETE apaga o override; próximo GET marca a regra como default."""
    ConfiguracaoRegra.objects.create(
        empresa=empresa_a, regra_nome="temperatura_alta",
        ativa=False, severidade=SeveridadeAlerta.CRITICO,
    )

    resp = _client(admin_a).delete(_url_detalhe("temperatura_alta"))
    assert resp.status_code == status.HTTP_204_NO_CONTENT

    assert not ConfiguracaoRegra.objects.filter(
        empresa=empresa_a, regra_nome="temperatura_alta",
    ).exists()

    # GET confirma que a regra voltou ao default
    resp_list = _client(admin_a).get(reverse("configuracao-regras-list"))
    por_nome = {r["regra_nome"]: r for r in resp_list.data["results"]}
    assert por_nome["temperatura_alta"]["is_default"] is True
    assert por_nome["temperatura_alta"]["configurada_em"] is None


@pytest.mark.django_db
def test_delete_idempotente(admin_a, empresa_a):
    """DELETE de regra sem override → 204 (idempotente)."""
    assert not ConfiguracaoRegra.objects.filter(
        empresa=empresa_a, regra_nome="temperatura_alta",
    ).exists()

    resp = _client(admin_a).delete(_url_detalhe("temperatura_alta"))
    assert resp.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
def test_delete_regra_invalida_devolve_404(admin_a, empresa_a):
    """DELETE de regra inexistente → 404 (sintoma de cliente quebrado)."""
    resp = _client(admin_a).delete(_url_detalhe("regra_inexistente_xyz"))
    assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_delete_operacional_devolve_403(operacional_a, empresa_a):
    """Operacional não pode deletar — 403."""
    ConfiguracaoRegra.objects.create(
        empresa=empresa_a, regra_nome="temperatura_alta",
        ativa=False, severidade=SeveridadeAlerta.CRITICO,
    )
    resp = _client(operacional_a).delete(_url_detalhe("temperatura_alta"))
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    # Override continua lá
    assert ConfiguracaoRegra.objects.filter(
        empresa=empresa_a, regra_nome="temperatura_alta",
    ).exists()


@pytest.mark.django_db
def test_delete_multi_tenancy(admin_a, admin_b, empresa_a, empresa_b):
    """DELETE em A não toca em overrides de B com mesma `regra_nome`."""
    ConfiguracaoRegra.objects.create(
        empresa=empresa_a, regra_nome="temperatura_alta",
        ativa=False, severidade=SeveridadeAlerta.CRITICO,
    )
    ConfiguracaoRegra.objects.create(
        empresa=empresa_b, regra_nome="temperatura_alta",
        ativa=False, severidade=SeveridadeAlerta.AVISO,
    )

    resp = _client(admin_a).delete(_url_detalhe("temperatura_alta"))
    assert resp.status_code == status.HTTP_204_NO_CONTENT

    assert not ConfiguracaoRegra.objects.filter(
        empresa=empresa_a, regra_nome="temperatura_alta",
    ).exists()
    # B intacto
    assert ConfiguracaoRegra.objects.filter(
        empresa=empresa_b, regra_nome="temperatura_alta",
    ).exists()


# ── POST /reset-todos/ — F2/C3 ──────────────────────────────────────────────

@pytest.mark.django_db
def test_reset_todos_apaga_todos_overrides_da_empresa(admin_a, empresa_a):
    """POST com 3 overrides → 204 + GET volta tudo para `is_default=True`."""
    for nome in ("temperatura_alta", "sobretensao_ac", "subtensao_ac"):
        ConfiguracaoRegra.objects.create(
            empresa=empresa_a, regra_nome=nome,
            ativa=False, severidade=SeveridadeAlerta.AVISO,
        )
    assert ConfiguracaoRegra.objects.filter(empresa=empresa_a).count() == 3

    url = reverse("configuracao-regras-reset")
    resp = _client(admin_a).post(url)
    assert resp.status_code == status.HTTP_204_NO_CONTENT

    assert ConfiguracaoRegra.objects.filter(empresa=empresa_a).count() == 0

    # Listagem confirma: todas voltaram a `is_default=True`.
    resp_list = _client(admin_a).get(reverse("configuracao-regras-list"))
    assert all(r["is_default"] is True for r in resp_list.data["results"])


@pytest.mark.django_db
def test_reset_todos_idempotente(admin_a, empresa_a):
    """POST sem nada para apagar → 204."""
    assert ConfiguracaoRegra.objects.filter(empresa=empresa_a).count() == 0

    url = reverse("configuracao-regras-reset")
    resp = _client(admin_a).post(url)
    assert resp.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
def test_reset_todos_operacional_devolve_403(operacional_a, empresa_a):
    """Operacional não pode resetar — 403, override mantido."""
    ConfiguracaoRegra.objects.create(
        empresa=empresa_a, regra_nome="temperatura_alta",
        ativa=False, severidade=SeveridadeAlerta.CRITICO,
    )
    url = reverse("configuracao-regras-reset")
    resp = _client(operacional_a).post(url)
    assert resp.status_code == status.HTTP_403_FORBIDDEN

    assert ConfiguracaoRegra.objects.filter(empresa=empresa_a).count() == 1


@pytest.mark.django_db
def test_reset_todos_multi_tenancy(admin_a, admin_b, empresa_a, empresa_b):
    """Reset em A não apaga overrides de B."""
    ConfiguracaoRegra.objects.create(
        empresa=empresa_a, regra_nome="temperatura_alta",
        ativa=False, severidade=SeveridadeAlerta.CRITICO,
    )
    ConfiguracaoRegra.objects.create(
        empresa=empresa_b, regra_nome="temperatura_alta",
        ativa=False, severidade=SeveridadeAlerta.AVISO,
    )

    url = reverse("configuracao-regras-reset")
    resp = _client(admin_a).post(url)
    assert resp.status_code == status.HTTP_204_NO_CONTENT

    assert ConfiguracaoRegra.objects.filter(empresa=empresa_a).count() == 0
    assert ConfiguracaoRegra.objects.filter(empresa=empresa_b).count() == 1


@pytest.mark.django_db
def test_reset_todos_url_nao_colide_com_detalhe(admin_a, empresa_a):
    """Sanity: a rota `reset-todos/` precisa preceder `<str:regra_nome>/`
    no urls.py. Sem isso, o POST cairia no detalhe procurando uma regra
    "reset-todos" e o detalhe não aceita POST → 405.

    Validamos que o POST atinge o reset (204), não o detalhe.
    """
    ConfiguracaoRegra.objects.create(
        empresa=empresa_a, regra_nome="temperatura_alta",
        ativa=False, severidade=SeveridadeAlerta.CRITICO,
    )
    resp = _client(admin_a).post(reverse("configuracao-regras-reset"))
    assert resp.status_code == status.HTTP_204_NO_CONTENT
    assert ConfiguracaoRegra.objects.filter(empresa=empresa_a).count() == 0
