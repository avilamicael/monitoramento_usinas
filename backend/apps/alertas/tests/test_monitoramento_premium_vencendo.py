"""Testes da regra `monitoramento_premium_vencendo`.

Espelha a lógica de `garantia_vencendo`: INFO em ≤30 dias, AVISO em ≤7 dias,
`False` quando ainda longe do fim e `None` quando não há contrato premium.

Constrói o `MonitoramentoAtivo` em memória com `fim_em` controlado (sem tocar
o banco) e injeta no cache do reverse one-to-one da usina.
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest

from apps.alertas.models import SeveridadeAlerta
from apps.alertas.regras.monitoramento_premium_vencendo import (
    MonitoramentoPremiumVencendo,
)
from apps.monitoramento_ativo.models import MonitoramentoAtivo


def _premium_com_dias(usina, dias: int) -> None:
    """Anexa um contrato premium em memória com `dias` restantes à usina."""
    ma = MonitoramentoAtivo(
        usina=usina, empresa=usina.empresa, inicio_em=date.today(), meses=1,
    )
    ma.fim_em = date.today() + timedelta(days=dias)
    usina.monitoramento_ativo = ma


@pytest.mark.django_db
def test_sem_contrato_premium_retorna_none(usina, config):
    """Usina sem premium (só garantia, da fixture) → regra inaplicável."""
    resultado = MonitoramentoPremiumVencendo().avaliar(usina, None, config)
    assert resultado is None


@pytest.mark.django_db
def test_longe_do_fim_retorna_false(usina, config):
    """40 dias restantes (> aviso 30) → fecha alerta aberto."""
    _premium_com_dias(usina, 40)
    resultado = MonitoramentoPremiumVencendo().avaliar(usina, None, config)
    assert resultado is False


@pytest.mark.django_db
def test_dentro_aviso_info(usina, config):
    """25 dias (≤30, >7) → INFO."""
    _premium_com_dias(usina, 25)
    resultado = MonitoramentoPremiumVencendo().avaliar(usina, None, config)
    assert resultado is not None and resultado is not False
    assert resultado.severidade == SeveridadeAlerta.INFO
    assert resultado.contexto["dias_restantes"] == 25


@pytest.mark.django_db
def test_dentro_critico_aviso(usina, config):
    """5 dias (≤7) → AVISO."""
    _premium_com_dias(usina, 5)
    resultado = MonitoramentoPremiumVencendo().avaliar(usina, None, config)
    assert resultado is not None and resultado is not False
    assert resultado.severidade == SeveridadeAlerta.AVISO


@pytest.mark.django_db
def test_contrato_vencido_retorna_none(usina, config):
    """Premium já vencido (não ativo) → regra não avalia."""
    _premium_com_dias(usina, -3)
    resultado = MonitoramentoPremiumVencendo().avaliar(usina, None, config)
    assert resultado is None
