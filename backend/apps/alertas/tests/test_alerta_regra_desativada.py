"""Testes da flag `regra_desativada` no `Alerta` (F1/C3 do plano).

A flag é exposta como property + campo no `AlertaSerializer`. Permite que a
UI mostre badge "regra desativada" e que o operador resolva manualmente
alertas órfãos (motor não fecha por silêncio quando a regra é desativada).

Cenários:
1. Sem override → False.
2. Override com `ativa=False` → True (mesmo alerta criado antes).
3. Multi-tenancy: empresa B sem override não é afetada quando empresa A desativa.
4. Override com `ativa=True` → False (regra ativa, override de severidade só).
5. Anotação `com_regra_desativada()` evita N+1 e bate com a property.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.alertas.models import (
    Alerta,
    ConfiguracaoRegra,
    EstadoAlerta,
    SeveridadeAlerta,
)
from apps.empresas.models import Empresa
from apps.garantia.models import Garantia
from apps.provedores.models import ContaProvedor, TipoProvedor
from apps.usinas.models import Usina


def _empresa_com_usina(slug: str, nome: str = "Empresa X"):
    """Helper para criar empresa+conta+usina+garantia. Independente do
    `conftest` — preciso de duas empresas isoladas para checar tenancy."""
    empresa = Empresa.objects.create(nome=nome, slug=slug)
    conta = ContaProvedor.objects.create(
        empresa=empresa,
        tipo=TipoProvedor.SOLIS,
        rotulo=f"Conta {slug}",
        credenciais_enc="dummy",
    )
    usina = Usina.objects.create(
        empresa=empresa,
        conta_provedor=conta,
        id_externo=f"ext-{slug}",
        nome=f"Usina {slug}",
        capacidade_kwp=Decimal("100.000"),
    )
    Garantia.objects.create(
        empresa=empresa,
        usina=usina,
        inicio_em=date.today() - timedelta(days=30),
        meses=24,
    )
    return empresa, usina


@pytest.mark.django_db
def test_sem_configuracao_regra_returns_false(empresa, usina):
    """Sem `ConfiguracaoRegra` → property é False (default do código)."""
    alerta = Alerta.objects.create(
        empresa=empresa,
        usina=usina,
        regra="temperatura_alta",
        severidade=SeveridadeAlerta.AVISO,
        mensagem="x",
    )
    assert alerta.regra_desativada is False


@pytest.mark.django_db
def test_override_ativa_false_marca_alerta(empresa, usina):
    """Override existente com `ativa=False` → property True para alertas
    pré-existentes da mesma `(empresa, regra)`. Esse é o caminho do
    "alerta congelado" descrito em F1/C3."""
    alerta = Alerta.objects.create(
        empresa=empresa,
        usina=usina,
        regra="temperatura_alta",
        severidade=SeveridadeAlerta.AVISO,
        mensagem="aberto antes do admin desativar",
    )
    assert alerta.regra_desativada is False  # antes da desativação

    ConfiguracaoRegra.objects.create(
        empresa=empresa,
        regra_nome="temperatura_alta",
        ativa=False,
        severidade=SeveridadeAlerta.AVISO,
    )

    # Re-fetch do banco — a property é dinâmica, não cacheada.
    alerta.refresh_from_db()
    assert alerta.regra_desativada is True


@pytest.mark.django_db
def test_override_ativa_true_nao_marca(empresa, usina):
    """Override com `ativa=True` (só severidade mudada) → não marca.

    Operador customizou severidade mas a regra continua avaliada — não há
    risco de alerta órfão.
    """
    Alerta.objects.create(
        empresa=empresa,
        usina=usina,
        regra="temperatura_alta",
        severidade=SeveridadeAlerta.CRITICO,
        mensagem="x",
    )
    ConfiguracaoRegra.objects.create(
        empresa=empresa,
        regra_nome="temperatura_alta",
        ativa=True,
        severidade=SeveridadeAlerta.CRITICO,
    )
    alerta = Alerta.objects.get(usina=usina, regra="temperatura_alta")
    assert alerta.regra_desativada is False


@pytest.mark.django_db
def test_multi_tenancy_isola_override(db):
    """Empresa A desativa `temperatura_alta`; empresa B não é afetada.

    Cobertura crítica de tenancy: o EXISTS subquery filtra por
    `empresa_id=OuterRef('empresa_id')` — alertas da B não enxergam o
    override da A.
    """
    empresa_a, usina_a = _empresa_com_usina("a", "Empresa A")
    empresa_b, usina_b = _empresa_com_usina("b", "Empresa B")

    alerta_a = Alerta.objects.create(
        empresa=empresa_a,
        usina=usina_a,
        regra="sobretensao_ac",
        severidade=SeveridadeAlerta.AVISO,
        mensagem="A",
    )
    alerta_b = Alerta.objects.create(
        empresa=empresa_b,
        usina=usina_b,
        regra="sobretensao_ac",
        severidade=SeveridadeAlerta.AVISO,
        mensagem="B",
    )

    # Apenas empresa A desativa a regra.
    ConfiguracaoRegra.objects.create(
        empresa=empresa_a,
        regra_nome="sobretensao_ac",
        ativa=False,
        severidade=SeveridadeAlerta.AVISO,
    )

    assert alerta_a.regra_desativada is True
    assert alerta_b.regra_desativada is False


@pytest.mark.django_db
def test_anotacao_evita_n_mais_um(empresa, usina):
    """`com_regra_desativada()` materializa a flag em 1 query.

    Cria N alertas, ativa anotação, itera serializando — total de queries
    deve ser 1 (lista) + 0 (sem fallback à property). Sem anotação seriam
    1 + N.
    """
    # 5 alertas, 5 regras diferentes, 2 desativadas.
    nomes = [
        "temperatura_alta",
        "sobretensao_ac",
        "subtensao_ac",
        "frequencia_anomala",
        "inversor_offline",
    ]
    for nome in nomes:
        Alerta.objects.create(
            empresa=empresa,
            usina=usina,
            regra=nome,
            severidade=SeveridadeAlerta.AVISO,
            mensagem=nome,
        )
    ConfiguracaoRegra.objects.create(
        empresa=empresa, regra_nome="temperatura_alta",
        ativa=False, severidade=SeveridadeAlerta.AVISO,
    )
    ConfiguracaoRegra.objects.create(
        empresa=empresa, regra_nome="frequencia_anomala",
        ativa=False, severidade=SeveridadeAlerta.AVISO,
    )

    # Caminho otimizado: 1 query (a anotação vira parte do SELECT).
    with CaptureQueriesContext(connection) as ctx:
        resultados = {
            a.regra: a.regra_desativada
            for a in Alerta.objects.com_regra_desativada().filter(empresa=empresa)
        }
    # Somente 1 SELECT (lista anotada). Property não dispara nada porque
    # `_regra_desativada_anotada` já está populado.
    assert len(ctx.captured_queries) == 1, ctx.captured_queries

    assert resultados["temperatura_alta"] is True
    assert resultados["frequencia_anomala"] is True
    assert resultados["sobretensao_ac"] is False
    assert resultados["subtensao_ac"] is False
    assert resultados["inversor_offline"] is False


@pytest.mark.django_db
def test_serializer_expoe_regra_desativada(empresa, usina):
    """`AlertaSerializer` expõe a flag — UI consome direto da listagem."""
    from apps.alertas.serializers import AlertaSerializer

    alerta = Alerta.objects.create(
        empresa=empresa,
        usina=usina,
        regra="temperatura_alta",
        severidade=SeveridadeAlerta.AVISO,
        mensagem="x",
    )
    # Sem override
    data = AlertaSerializer(alerta).data
    assert data["regra_desativada"] is False

    ConfiguracaoRegra.objects.create(
        empresa=empresa, regra_nome="temperatura_alta",
        ativa=False, severidade=SeveridadeAlerta.AVISO,
    )
    alerta.refresh_from_db()
    data = AlertaSerializer(alerta).data
    assert data["regra_desativada"] is True


@pytest.mark.django_db
def test_alerta_resolvido_tambem_reflete_estado_atual(empresa, usina):
    """Mesmo um alerta JÁ resolvido reflete o estado atual da regra.

    Importante para histórico: se a regra foi desativada DEPOIS do alerta
    ter sido resolvido, a UI ainda pode informar isso ao operador
    consultando o histórico. Não há razão para a flag depender de `estado`.
    """
    from django.utils import timezone as djtz

    alerta = Alerta.objects.create(
        empresa=empresa,
        usina=usina,
        regra="temperatura_alta",
        severidade=SeveridadeAlerta.AVISO,
        mensagem="x",
        estado=EstadoAlerta.RESOLVIDO,
        resolvido_em=djtz.now(),
    )
    ConfiguracaoRegra.objects.create(
        empresa=empresa, regra_nome="temperatura_alta",
        ativa=False, severidade=SeveridadeAlerta.AVISO,
    )
    assert alerta.regra_desativada is True
