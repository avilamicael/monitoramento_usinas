"""Testes do model `MonitoramentoAtivo`.

Foco: cálculo de `fim_em` (incl. virada de ano e clamp de dia) e persistência
no `save()` — diferente de `Garantia`, aqui `fim_em` é coluna real para
permitir filtrar alertas premium em SQL.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest

from apps.empresas.models import Empresa
from apps.monitoramento_ativo.models import MonitoramentoAtivo
from apps.provedores.models import ContaProvedor, TipoProvedor
from apps.usinas.models import Usina


def test_somar_meses_simples():
    assert MonitoramentoAtivo._somar_meses(date(2026, 1, 15), 12) == date(2027, 1, 15)


def test_somar_meses_virada_de_ano():
    assert MonitoramentoAtivo._somar_meses(date(2026, 11, 10), 3) == date(2027, 2, 10)


def test_somar_meses_clamp_dia():
    # 31/jan + 1 mês → 28/fev (fevereiro não tem dia 31).
    assert MonitoramentoAtivo._somar_meses(date(2026, 1, 31), 1) == date(2026, 2, 28)


@pytest.mark.django_db
def test_fim_em_persistido_e_propriedades():
    empresa = Empresa.objects.create(nome="E", slug="e-mon")
    conta = ContaProvedor.objects.create(
        empresa=empresa, tipo=TipoProvedor.SOLIS, rotulo="c", credenciais_enc="x",
    )
    usina = Usina.objects.create(
        empresa=empresa, conta_provedor=conta, id_externo="x1", nome="U",
        capacidade_kwp=Decimal("10.000"),
    )
    inicio = date.today() - timedelta(days=10)
    ma = MonitoramentoAtivo.objects.create(
        empresa=empresa, usina=usina, inicio_em=inicio, meses=12,
        valor_mensal=Decimal("199.90"), contratante="Cliente X",
    )
    ma.refresh_from_db()

    assert ma.fim_em == MonitoramentoAtivo._somar_meses(inicio, 12)
    assert ma.is_active is True
    assert ma.dias_restantes > 0


@pytest.mark.django_db
def test_contrato_vencido_is_active_false():
    empresa = Empresa.objects.create(nome="E", slug="e-mon2")
    conta = ContaProvedor.objects.create(
        empresa=empresa, tipo=TipoProvedor.SOLIS, rotulo="c", credenciais_enc="x",
    )
    usina = Usina.objects.create(
        empresa=empresa, conta_provedor=conta, id_externo="x2", nome="U2",
        capacidade_kwp=Decimal("10.000"),
    )
    # inicio há 400 dias, 12 meses → fim ~35 dias atrás.
    ma = MonitoramentoAtivo.objects.create(
        empresa=empresa, usina=usina, inicio_em=date.today() - timedelta(days=400),
        meses=12,
    )
    assert ma.is_active is False
    assert ma.dias_restantes < 0
