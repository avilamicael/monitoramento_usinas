"""Testes da regra `inversor_offline` após calibração 2026-04-27.

Foco: garantir que `estado=None` e `medido_em` recente NÃO geram falso
positivo, mesmo com 3+ leituras em offline.
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone as djtz

from apps.alertas.regras.inversor_offline import InversorOffline
from apps.monitoramento.models import LeituraInversor, LeituraUsina, StatusLeitura


def _criar_leitura_usina(usina, *, potencia_kw, coletado_em):
    return LeituraUsina.objects.create(
        empresa=usina.empresa,
        usina=usina,
        coletado_em=coletado_em,
        potencia_kw=potencia_kw,
    )


def _criar_leitura_inversor(inversor, *, estado, coletado_em, medido_em=None):
    return LeituraInversor.objects.create(
        empresa=inversor.empresa,
        usina=inversor.usina,
        inversor=inversor,
        coletado_em=coletado_em,
        medido_em=medido_em,
        estado=estado,
    )


@pytest.mark.django_db
def test_estado_none_retorna_none(usina, inversor, config, monkeypatch):
    """Se `estado` é None (provedor não conseguiu ler), regra não avalia."""
    # Força horário solar.
    monkeypatch.setattr(
        "apps.alertas.regras.inversor_offline.em_horario_solar",
        lambda u, c: True,
    )

    agora = djtz.now()
    _criar_leitura_usina(usina, potencia_kw=Decimal("50"), coletado_em=agora)

    leitura = _criar_leitura_inversor(
        inversor,
        estado=StatusLeitura.OFFLINE,
        coletado_em=agora,
        medido_em=agora - timedelta(hours=8),
    )
    # Simula estado=None (provedor inconsistente).
    leitura.estado = None

    resultado = InversorOffline().avaliar(inversor, leitura, config)
    assert resultado is None


@pytest.mark.django_db
def test_medido_em_recente_offline_retorna_none(usina, inversor, config, monkeypatch):
    """`medido_em` ≤30min atrás + estado=offline = transição, não anomalia."""
    monkeypatch.setattr(
        "apps.alertas.regras.inversor_offline.em_horario_solar",
        lambda u, c: True,
    )

    agora = djtz.now()
    _criar_leitura_usina(usina, potencia_kw=Decimal("50"), coletado_em=agora)

    # Mesmo com 3 coletas em offline, se medido_em é fresca, é transitório.
    for i in range(3):
        _criar_leitura_inversor(
            inversor,
            estado=StatusLeitura.OFFLINE,
            coletado_em=agora - timedelta(minutes=10 * i),
            medido_em=agora - timedelta(minutes=5),  # bem recente
        )

    leitura_atual = LeituraInversor.objects.filter(
        inversor=inversor
    ).order_by("-coletado_em").first()

    resultado = InversorOffline().avaliar(inversor, leitura_atual, config)
    assert resultado is None


@pytest.mark.django_db
def test_medido_em_antiga_offline_dispara(usina, inversor, config, monkeypatch):
    """`medido_em` >6h + estado=offline + carência = anomalia real."""
    monkeypatch.setattr(
        "apps.alertas.regras.inversor_offline.em_horario_solar",
        lambda u, c: True,
    )

    agora = djtz.now()
    _criar_leitura_usina(usina, potencia_kw=Decimal("50"), coletado_em=agora)

    medido_antigo = agora - timedelta(hours=8)
    for i in range(3):  # 3 coletas consecutivas offline
        _criar_leitura_inversor(
            inversor,
            estado=StatusLeitura.OFFLINE,
            coletado_em=agora - timedelta(minutes=10 * i),
            medido_em=medido_antigo,
        )

    leitura_atual = LeituraInversor.objects.filter(
        inversor=inversor
    ).order_by("-coletado_em").first()

    resultado = InversorOffline().avaliar(inversor, leitura_atual, config)
    assert resultado is not None and resultado is not False
    assert "offline" in resultado.mensagem.lower()


@pytest.mark.django_db
def test_medido_em_none_offline_segue_carencia(usina, inversor, config, monkeypatch):
    """Sem `medido_em`, segue lógica de carência por coletas consecutivas."""
    monkeypatch.setattr(
        "apps.alertas.regras.inversor_offline.em_horario_solar",
        lambda u, c: True,
    )

    agora = djtz.now()
    _criar_leitura_usina(usina, potencia_kw=Decimal("50"), coletado_em=agora)

    for i in range(3):
        _criar_leitura_inversor(
            inversor,
            estado=StatusLeitura.OFFLINE,
            coletado_em=agora - timedelta(minutes=10 * i),
            medido_em=None,
        )

    leitura_atual = LeituraInversor.objects.filter(
        inversor=inversor
    ).order_by("-coletado_em").first()

    resultado = InversorOffline().avaliar(inversor, leitura_atual, config)
    # Sem medido_em pra desambiguar, a carência decide — 3 consecutivas dispara.
    assert resultado is not None and resultado is not False


@pytest.mark.django_db
def test_estado_online_resolve_aberto(usina, inversor, config, monkeypatch):
    """estado=online deve retornar False (motor fecha alerta)."""
    monkeypatch.setattr(
        "apps.alertas.regras.inversor_offline.em_horario_solar",
        lambda u, c: True,
    )

    agora = djtz.now()
    _criar_leitura_usina(usina, potencia_kw=Decimal("50"), coletado_em=agora)
    leitura = _criar_leitura_inversor(
        inversor,
        estado=StatusLeitura.ONLINE,
        coletado_em=agora,
        medido_em=agora,
    )

    resultado = InversorOffline().avaliar(inversor, leitura, config)
    assert resultado is False
