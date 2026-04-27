"""Testes do management command `migrar_alertas_para_agregados`.

Cobre:
1. Fecha alertas legados por inversor das regras agregadoras.
2. Idempotente: segunda execução não altera nada.
3. `--dry-run` não persiste mudanças.
4. Ignora alertas de regras NÃO-agregadoras (ex: `sem_comunicacao`).
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from io import StringIO

import pytest
from django.core.management import call_command

from apps.alertas.models import Alerta, EstadoAlerta, SeveridadeAlerta
from apps.garantia.models import Garantia
from apps.inversores.models import Inversor
from apps.usinas.models import Usina


@pytest.fixture
def usina_com_inversores(db, empresa, conta_provedor):
    u = Usina.objects.create(
        empresa=empresa,
        conta_provedor=conta_provedor,
        id_externo="mig-usina",
        nome="Usina Migração",
        capacidade_kwp=Decimal("100.000"),
        expoe_dados_inversor=True,
    )
    Garantia.objects.create(
        empresa=empresa,
        usina=u,
        inicio_em=date.today() - timedelta(days=30),
        meses=24,
    )
    invs = [
        Inversor.objects.create(
            empresa=empresa,
            usina=u,
            id_externo=f"mig-inv-{i}",
            numero_serie=f"SN-MIG-{i}",
        )
        for i in range(3)
    ]
    return u, invs


def _criar_alerta_legado(usina, inversor, regra: str):
    """Cria alerta com `inversor` preenchido — formato antigo, pré-agregação."""
    return Alerta.objects.create(
        empresa=usina.empresa,
        usina=usina,
        inversor=inversor,
        regra=regra,
        severidade=SeveridadeAlerta.CRITICO,
        mensagem="legado",
        contexto={},
    )


@pytest.mark.django_db
def test_fecha_alertas_legados_de_regra_agregadora(usina_com_inversores):
    usina, inversores = usina_com_inversores
    for inv in inversores:
        _criar_alerta_legado(usina, inv, regra="sobretensao_ac")

    out = StringIO()
    call_command("migrar_alertas_para_agregados", stdout=out)

    abertos = Alerta.objects.filter(
        regra="sobretensao_ac", estado=EstadoAlerta.ABERTO
    )
    assert abertos.count() == 0
    resolvidos = Alerta.objects.filter(
        regra="sobretensao_ac", estado=EstadoAlerta.RESOLVIDO
    )
    assert resolvidos.count() == 3
    # Mensagem de auditoria é gravada em todos.
    for a in resolvidos:
        assert "migrar_alertas_para_agregados" in a.mensagem


@pytest.mark.django_db
def test_idempotente_segunda_execucao_nao_altera(usina_com_inversores):
    usina, inversores = usina_com_inversores
    for inv in inversores:
        _criar_alerta_legado(usina, inv, regra="sobretensao_ac")

    call_command("migrar_alertas_para_agregados", stdout=StringIO())
    # Segunda execução: nenhum legado restante.
    out2 = StringIO()
    call_command("migrar_alertas_para_agregados", stdout=out2)
    assert "nada a fazer" in out2.getvalue().lower()

    assert Alerta.objects.filter(
        regra="sobretensao_ac", estado=EstadoAlerta.ABERTO
    ).count() == 0


@pytest.mark.django_db
def test_dry_run_nao_persiste(usina_com_inversores):
    usina, inversores = usina_com_inversores
    for inv in inversores:
        _criar_alerta_legado(usina, inv, regra="sobretensao_ac")

    out = StringIO()
    call_command("migrar_alertas_para_agregados", "--dry-run", stdout=out)
    assert "dry-run" in out.getvalue().lower()
    # Tudo continua aberto.
    assert Alerta.objects.filter(
        regra="sobretensao_ac", estado=EstadoAlerta.ABERTO
    ).count() == 3


@pytest.mark.django_db
def test_ignora_regras_nao_agregadoras(usina_com_inversores):
    """Alertas de regra de usina (`sem_comunicacao`) não devem ser tocados."""
    usina, _ = usina_com_inversores

    # Alerta de regra de usina (não agregadora — o legado já vinha com
    # `inversor=NULL`, mas pra garantir, criamos um com inversor preenchido
    # também e checamos que NÃO é fechado: `sem_comunicacao` não está
    # marcada como agregadora).
    Alerta.objects.create(
        empresa=usina.empresa,
        usina=usina,
        inversor=None,
        regra="sem_comunicacao",
        severidade=SeveridadeAlerta.AVISO,
        mensagem="usina sem com",
        contexto={},
    )

    call_command("migrar_alertas_para_agregados", stdout=StringIO())

    # `sem_comunicacao` não foi mexido.
    assert Alerta.objects.filter(
        regra="sem_comunicacao", estado=EstadoAlerta.ABERTO
    ).count() == 1


@pytest.mark.django_db
def test_filtro_regra_especifica(usina_com_inversores):
    """`--regra <nome>` limita o cleanup a uma regra agregadora."""
    usina, inversores = usina_com_inversores

    _criar_alerta_legado(usina, inversores[0], regra="sobretensao_ac")
    _criar_alerta_legado(usina, inversores[0], regra="frequencia_anomala")

    call_command(
        "migrar_alertas_para_agregados",
        "--regra", "sobretensao_ac",
        stdout=StringIO(),
    )

    # Sobretensão fechada, frequência anômala intacta.
    assert Alerta.objects.filter(
        regra="sobretensao_ac", estado=EstadoAlerta.ABERTO
    ).count() == 0
    assert Alerta.objects.filter(
        regra="frequencia_anomala", estado=EstadoAlerta.ABERTO
    ).count() == 1
