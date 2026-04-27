"""Testes do serializer de Usina cobrindo `tensao_nominal_v`."""
from __future__ import annotations

from decimal import Decimal

import pytest

from apps.empresas.models import Empresa
from apps.provedores.models import ContaProvedor, TipoProvedor
from apps.usinas.models import TensaoNominalV, Usina
from apps.usinas.serializers import UsinaDetalhadaSerializer


@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="X", slug="x")


@pytest.fixture
def conta(empresa):
    return ContaProvedor.objects.create(
        empresa=empresa, tipo=TipoProvedor.FUSIONSOLAR,
        rotulo="C", credenciais_enc="dummy",
    )


@pytest.fixture
def usina(empresa, conta):
    return Usina.objects.create(
        empresa=empresa, conta_provedor=conta, nome="U",
        capacidade_kwp=Decimal("10"),
    )


@pytest.mark.django_db
def test_serializer_expoe_tensao_nominal_v(usina):
    s = UsinaDetalhadaSerializer(usina)
    assert "tensao_nominal_v" in s.data
    assert s.data["tensao_nominal_v"] == 220


@pytest.mark.django_db
def test_serializer_aceita_atualizacao_tensao_nominal(usina):
    s = UsinaDetalhadaSerializer(usina, data={"tensao_nominal_v": 110}, partial=True)
    assert s.is_valid(), s.errors
    s.save()
    usina.refresh_from_db()
    assert usina.tensao_nominal_v == TensaoNominalV.V110


@pytest.mark.django_db
def test_serializer_rejeita_valor_invalido_tensao_nominal(usina):
    s = UsinaDetalhadaSerializer(usina, data={"tensao_nominal_v": 380}, partial=True)
    assert not s.is_valid()
    assert "tensao_nominal_v" in s.errors
