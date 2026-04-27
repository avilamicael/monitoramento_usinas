"""Testes do management command `recalibrar_alertas_tensao`.

Cobre:
- Fecha alertas abertos da regra `subtensao_ac` em usinas 110 V.
- Não toca em alertas de outras regras (sobretensao_ac, sem_comunicacao, …).
- Não toca em alertas de usinas 220 V.
- `--dry-run` apenas reporta, sem alterar.
- Idempotente: rodar 2× não fecha mais nada na 2ª execução.
"""
from __future__ import annotations

from decimal import Decimal
from io import StringIO

import pytest
from django.core.management import call_command

from apps.alertas.models import Alerta, EstadoAlerta, SeveridadeAlerta
from apps.empresas.models import Empresa
from apps.inversores.models import Inversor
from apps.provedores.models import ContaProvedor, TipoProvedor
from apps.usinas.models import TensaoNominalV, Usina


@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Empresa Recal", slug="empresa-recal")


@pytest.fixture
def conta(empresa):
    return ContaProvedor.objects.create(
        empresa=empresa,
        tipo=TipoProvedor.FUSIONSOLAR,
        rotulo="Conta",
        credenciais_enc="dummy",
    )


@pytest.fixture
def cenario(empresa, conta):
    """Cria 2 usinas (220 V e 110 V) com 1 inversor cada e alertas variados."""
    usina_110 = Usina.objects.create(
        empresa=empresa, conta_provedor=conta, nome="Usina 110V",
        capacidade_kwp=Decimal("10"), tensao_nominal_v=TensaoNominalV.V110,
    )
    usina_220 = Usina.objects.create(
        empresa=empresa, conta_provedor=conta, nome="Usina 220V",
        capacidade_kwp=Decimal("10"), tensao_nominal_v=TensaoNominalV.V220,
    )
    inv_110 = Inversor.objects.create(
        empresa=empresa, usina=usina_110, id_externo="I110",
    )
    inv_220 = Inversor.objects.create(
        empresa=empresa, usina=usina_220, id_externo="I220",
    )

    # Alvos a fechar: subtensão aberta em 110 V
    a_subtensao_110 = Alerta.objects.create(
        empresa=empresa, usina=usina_110, inversor=inv_110,
        regra="subtensao_ac", severidade=SeveridadeAlerta.AVISO,
        estado=EstadoAlerta.ABERTO, mensagem="Subtensão antiga.",
    )

    # Não deve mexer:
    # 1) Subtensão 220 V (rede de fato)
    a_subtensao_220 = Alerta.objects.create(
        empresa=empresa, usina=usina_220, inversor=inv_220,
        regra="subtensao_ac", severidade=SeveridadeAlerta.AVISO,
        estado=EstadoAlerta.ABERTO, mensagem="Subtensão real 220V.",
    )
    # 2) Outra regra qualquer em 110 V
    a_sobretensao_110 = Alerta.objects.create(
        empresa=empresa, usina=usina_110, inversor=inv_110,
        regra="sobretensao_ac", severidade=SeveridadeAlerta.CRITICO,
        estado=EstadoAlerta.ABERTO, mensagem="Sobretensão.",
    )
    # 3) Subtensão já resolvida em 110 V
    a_subtensao_110_resolvida = Alerta.objects.create(
        empresa=empresa, usina=usina_110, inversor=inv_110,
        regra="subtensao_ac", severidade=SeveridadeAlerta.AVISO,
        estado=EstadoAlerta.RESOLVIDO, mensagem="Antiga, já fechada.",
    )

    return {
        "fechar": [a_subtensao_110],
        "preservar": [a_subtensao_220, a_sobretensao_110, a_subtensao_110_resolvida],
    }


@pytest.mark.django_db
def test_recalibrar_fecha_apenas_subtensao_de_usina_110v(cenario):
    out = StringIO()
    call_command("recalibrar_alertas_tensao", stdout=out)

    # Alvo fechado
    fechar = cenario["fechar"][0]
    fechar.refresh_from_db()
    assert fechar.estado == EstadoAlerta.RESOLVIDO
    assert fechar.resolvido_em is not None
    assert "Calibração automática" in fechar.mensagem

    # Demais preservados
    for a in cenario["preservar"]:
        estado_antes = a.estado
        a.refresh_from_db()
        assert a.estado == estado_antes


@pytest.mark.django_db
def test_recalibrar_dry_run_nao_altera(cenario):
    out = StringIO()
    call_command("recalibrar_alertas_tensao", "--dry-run", stdout=out)

    fechar = cenario["fechar"][0]
    estado_antes = fechar.estado
    fechar.refresh_from_db()
    assert fechar.estado == estado_antes
    assert "[dry-run]" in out.getvalue()


@pytest.mark.django_db
def test_recalibrar_idempotente(cenario):
    """Segunda execução não encontra alvos."""
    call_command("recalibrar_alertas_tensao", stdout=StringIO())
    out = StringIO()
    call_command("recalibrar_alertas_tensao", stdout=out)
    assert "nenhum alerta aberto" in out.getvalue().lower()


@pytest.mark.django_db
def test_recalibrar_sem_usinas_110v_noop(empresa):
    """Sem nenhuma usina em 110 V, comando reporta noop."""
    out = StringIO()
    call_command("recalibrar_alertas_tensao", stdout=out)
    assert "nenhuma usina" in out.getvalue().lower()
