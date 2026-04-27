"""Fixtures compartilhadas pelos testes do app alertas."""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest

from apps.core.models import ConfiguracaoEmpresa
from apps.empresas.models import Empresa
from apps.garantia.models import Garantia
from apps.inversores.models import Inversor
from apps.provedores.models import ContaProvedor, TipoProvedor
from apps.usinas.models import Usina


@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Empresa Teste", slug="empresa-teste")


@pytest.fixture
def config(db, empresa):
    return ConfiguracaoEmpresa.objects.create(empresa=empresa)


@pytest.fixture
def conta_provedor(db, empresa):
    return ContaProvedor.objects.create(
        empresa=empresa,
        tipo=TipoProvedor.SOLIS,
        rotulo="Conta Solis Teste",
        credenciais_enc="dummy",
    )


@pytest.fixture
def usina(db, empresa, conta_provedor):
    u = Usina.objects.create(
        empresa=empresa,
        conta_provedor=conta_provedor,
        id_externo="ext-1",
        nome="Usina Teste",
        capacidade_kwp=Decimal("100.000"),
    )
    # Garantia ativa — sem ela o motor pula a usina.
    Garantia.objects.create(
        empresa=empresa,
        usina=u,
        inicio_em=date.today() - timedelta(days=30),
        meses=24,
    )
    return u


@pytest.fixture
def inversor(db, empresa, usina):
    return Inversor.objects.create(
        empresa=empresa,
        usina=usina,
        id_externo="inv-1",
        numero_serie="SN-TEST-1",
    )
