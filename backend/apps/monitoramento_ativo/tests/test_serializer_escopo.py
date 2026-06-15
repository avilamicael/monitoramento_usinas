"""Testes de escopo por empresa no `MonitoramentoAtivoSerializer` (anti-IDOR).

Garante que o campo `usina` (PK vinda do cliente) é validado contra a empresa
do request — um admin da empresa A não pode anexar contrato a uma usina da
empresa B (CR-01 do code review).
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from apps.empresas.models import Empresa
from apps.monitoramento_ativo.serializers import MonitoramentoAtivoSerializer
from apps.provedores.models import ContaProvedor, TipoProvedor
from apps.usinas.models import Usina


class _Req:
    """Request mínimo — `empresa_do_request` lê `request.empresa` primeiro."""

    def __init__(self, empresa):
        self.empresa = empresa


def _usina(empresa, externo):
    conta = ContaProvedor.objects.create(
        empresa=empresa, tipo=TipoProvedor.SOLIS, rotulo="c", credenciais_enc="x",
    )
    return Usina.objects.create(
        empresa=empresa, conta_provedor=conta, id_externo=externo, nome="U",
        capacidade_kwp=Decimal("10.000"),
    )


@pytest.mark.django_db
def test_rejeita_usina_de_outra_empresa():
    empresa_a = Empresa.objects.create(nome="A", slug="emp-a")
    empresa_b = Empresa.objects.create(nome="B", slug="emp-b")
    usina_b = _usina(empresa_b, "ext-b")

    ser = MonitoramentoAtivoSerializer(
        data={"usina": usina_b.pk, "inicio_em": date.today().isoformat(), "meses": 12},
        context={"request": _Req(empresa_a)},
    )
    assert not ser.is_valid()
    assert "usina" in ser.errors


@pytest.mark.django_db
def test_aceita_usina_da_propria_empresa():
    empresa_a = Empresa.objects.create(nome="A", slug="emp-a2")
    usina_a = _usina(empresa_a, "ext-a")

    ser = MonitoramentoAtivoSerializer(
        data={"usina": usina_a.pk, "inicio_em": date.today().isoformat(), "meses": 12},
        context={"request": _Req(empresa_a)},
    )
    assert ser.is_valid(), ser.errors


@pytest.mark.django_db
def test_rejeita_meses_zero():
    """Backend é autoritativo: `meses=0` é rejeitado (não só no frontend)."""
    empresa_a = Empresa.objects.create(nome="A", slug="emp-a3")
    usina_a = _usina(empresa_a, "ext-a3")

    ser = MonitoramentoAtivoSerializer(
        data={"usina": usina_a.pk, "inicio_em": date.today().isoformat(), "meses": 0},
        context={"request": _Req(empresa_a)},
    )
    assert not ser.is_valid()
    assert "meses" in ser.errors
