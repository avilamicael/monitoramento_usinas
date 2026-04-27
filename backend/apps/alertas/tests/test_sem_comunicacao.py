"""Testes da regra `sem_comunicacao` após calibração 2026-04-27.

Foco: limite default 24h, mensagem com horas + última leitura, retornos
tri-state corretos.
"""
from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone as djtz

from apps.alertas.models import SeveridadeAlerta
from apps.alertas.regras.sem_comunicacao import SemComunicacao


def test_default_24h(config):
    """Default novo (1440 min = 24h) entra em vigor pra empresas novas."""
    assert config.alerta_sem_comunicacao_minutos == 1440


@pytest.mark.django_db
def test_ultima_leitura_em_none_retorna_none(usina, config):
    """Sem `medido_em` (provedor não expõe), regra não avalia."""
    usina.ultima_leitura_em = None
    usina.save()
    resultado = SemComunicacao().avaliar(usina, None, config)
    assert resultado is None


@pytest.mark.django_db
def test_dentro_da_janela_retorna_false(usina, config):
    """Última leitura recente — regra fecha qualquer alerta aberto."""
    usina.ultima_leitura_em = djtz.now() - timedelta(hours=2)
    usina.save()
    # Default 24h.
    resultado = SemComunicacao().avaliar(usina, None, config)
    assert resultado is False


@pytest.mark.django_db
def test_acima_do_limite_aviso(usina, config):
    """Acima do limite (24h) mas abaixo de 2× = aviso."""
    usina.ultima_leitura_em = djtz.now() - timedelta(hours=30)
    usina.save()
    resultado = SemComunicacao().avaliar(usina, None, config)
    assert resultado is not None and resultado is not False
    assert resultado.severidade == SeveridadeAlerta.AVISO
    assert "30.0 horas" in resultado.mensagem
    # Mensagem inclui última leitura formatada (dd/mm hh:mm).
    assert "última:" in resultado.mensagem


@pytest.mark.django_db
def test_muito_acima_escala_critico(usina, config):
    """>2× o limite escala pra crítico."""
    usina.ultima_leitura_em = djtz.now() - timedelta(hours=60)
    usina.save()
    resultado = SemComunicacao().avaliar(usina, None, config)
    assert resultado is not None and resultado is not False
    assert resultado.severidade == SeveridadeAlerta.CRITICO


@pytest.mark.django_db
def test_usina_inativa_retorna_none(usina, config):
    """Usina inativa não tem coleta esperada."""
    usina.is_active = False
    usina.ultima_leitura_em = djtz.now() - timedelta(hours=72)
    usina.save()
    resultado = SemComunicacao().avaliar(usina, None, config)
    assert resultado is None


@pytest.mark.django_db
def test_limite_customizado_respeitado(usina, config):
    """Empresa que customizou (ex.: 6h) não é afetada pelo default novo."""
    config.alerta_sem_comunicacao_minutos = 360  # 6h
    config.save()
    usina.ultima_leitura_em = djtz.now() - timedelta(hours=8)
    usina.save()
    resultado = SemComunicacao().avaliar(usina, None, config)
    assert resultado is not None and resultado is not False
