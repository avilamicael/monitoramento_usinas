"""Testes da desativação de `subdesempenho` + comando de fechamento."""
from __future__ import annotations

from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone as djtz

from apps.alertas.models import Alerta, EstadoAlerta, SeveridadeAlerta
from apps.alertas.motor import _carregar_regras
from apps.alertas.regras import regras_registradas


def test_subdesempenho_nao_esta_no_registro():
    """`@registrar` foi removido — motor não deve carregar a regra."""
    _carregar_regras()
    nomes = {r.nome for r in regras_registradas()}
    assert "subdesempenho" not in nomes


@pytest.mark.django_db
def test_fechar_alertas_obsoletos_dry_run(usina, empresa):
    """`--dry-run` não altera o banco mas reporta o que faria."""
    a = Alerta.objects.create(
        empresa=empresa,
        usina=usina,
        regra="subdesempenho",
        severidade=SeveridadeAlerta.AVISO,
        mensagem="legado",
    )

    out = StringIO()
    call_command("fechar_alertas_obsoletos", "--dry-run", stdout=out)

    a.refresh_from_db()
    assert a.estado == EstadoAlerta.ABERTO
    saida = out.getvalue()
    assert "subdesempenho" in saida
    assert "[dry-run]" in saida


@pytest.mark.django_db
def test_fechar_alertas_obsoletos_aplica(usina, empresa):
    """Sem --dry-run, fecha alertas de regras desregistradas."""
    a_obsoleto = Alerta.objects.create(
        empresa=empresa,
        usina=usina,
        regra="subdesempenho",
        severidade=SeveridadeAlerta.AVISO,
        mensagem="legado",
    )
    a_ativo = Alerta.objects.create(
        empresa=empresa,
        usina=usina,
        regra="sem_comunicacao",
        severidade=SeveridadeAlerta.AVISO,
        mensagem="ativo",
    )

    call_command("fechar_alertas_obsoletos", stdout=StringIO())

    a_obsoleto.refresh_from_db()
    a_ativo.refresh_from_db()

    assert a_obsoleto.estado == EstadoAlerta.RESOLVIDO
    assert a_obsoleto.resolvido_em is not None
    assert (djtz.now() - a_obsoleto.resolvido_em).total_seconds() < 5

    # Alerta de regra ainda registrada NÃO deve ser tocado.
    assert a_ativo.estado == EstadoAlerta.ABERTO


@pytest.mark.django_db
def test_fechar_alertas_obsoletos_idempotente(usina, empresa):
    """Rodar duas vezes não causa efeito colateral na segunda execução."""
    Alerta.objects.create(
        empresa=empresa,
        usina=usina,
        regra="subdesempenho",
        severidade=SeveridadeAlerta.AVISO,
        mensagem="legado",
    )

    out1 = StringIO()
    call_command("fechar_alertas_obsoletos", stdout=out1)
    out2 = StringIO()
    call_command("fechar_alertas_obsoletos", stdout=out2)

    assert "Fechados 1" in out1.getvalue()
    assert "Nada a fechar" in out2.getvalue()
