"""Regressão: `?status_garantia=` não pode quebrar com usina sem garantia.

Antes, `filtrar_status_garantia` acessava `u.garantia` direto; uma usina sem
garantia tem o reverse 1:1 ausente e levantava `RelatedObjectDoesNotExist`
(HTTP 500 → "Erro ao carregar usinas" no frontend).
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest

from apps.empresas.models import Empresa
from apps.garantia.models import Garantia
from apps.provedores.models import ContaProvedor, TipoProvedor
from apps.usinas.models import Usina
from apps.usinas.views import UsinaFilter


@pytest.fixture
def cenario(db):
    empresa = Empresa.objects.create(nome="E", slug="e-status")
    conta = ContaProvedor.objects.create(
        empresa=empresa, tipo=TipoProvedor.SOLIS, rotulo="c", credenciais_enc="x",
    )

    def _usina(externo, nome):
        return Usina.objects.create(
            empresa=empresa, conta_provedor=conta, id_externo=externo, nome=nome,
            capacidade_kwp=Decimal("10.000"),
        )

    com_garantia = _usina("com", "Com garantia")
    Garantia.objects.create(
        empresa=empresa, usina=com_garantia,
        inicio_em=date.today() - timedelta(days=30), meses=24,
    )
    sem_garantia = _usina("sem", "Sem garantia")  # <- o que quebrava antes
    return empresa, com_garantia, sem_garantia


def _filtrar(value, empresa):
    qs = Usina.objects.filter(empresa=empresa)
    return set(UsinaFilter({"status_garantia": value}, queryset=qs).qs.values_list("pk", flat=True))


@pytest.mark.django_db
def test_status_ativa_nao_quebra_com_usina_sem_garantia(cenario):
    empresa, com, sem = cenario
    ids = _filtrar("ativa", empresa)
    assert com.pk in ids
    assert sem.pk not in ids


@pytest.mark.django_db
def test_status_sem_garantia(cenario):
    empresa, com, sem = cenario
    ids = _filtrar("sem_garantia", empresa)
    assert ids == {sem.pk}


@pytest.mark.django_db
def test_status_vencida_vazio(cenario):
    empresa, com, sem = cenario
    assert _filtrar("vencida", empresa) == set()


@pytest.mark.django_db
def test_status_invalido_retorna_tudo(cenario):
    empresa, com, sem = cenario
    assert _filtrar("xpto", empresa) == {com.pk, sem.pk}
