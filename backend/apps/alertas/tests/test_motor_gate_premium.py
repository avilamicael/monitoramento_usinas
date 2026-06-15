"""Testes do gate do motor com monitoramento ativo (premium).

Antes, o motor só avaliava usinas com garantia ativa. Agora garantia OU
monitoramento ativo (premium) ligam o monitoramento. Cobre:

1. Usina premium SEM garantia É avaliada (gate liga pelo premium).
2. Usina sem garantia e sem premium é pulada.
3. Usina com premium vencido (e sem garantia) é pulada.
4. `Alerta.premium` / `com_premium()` refletem o contrato vigente.

Usa uma regra dummy isolada (mesmo padrão de
`test_motor_respeita_configuracao_regra.py`) para não depender das regras reais.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest

from apps.alertas.models import Alerta, EstadoAlerta, SeveridadeAlerta
from apps.alertas.motor import avaliar_empresa
from apps.alertas.regras import base as regras_base
from apps.alertas.regras.base import Anomalia, RegraUsina
from apps.monitoramento_ativo.models import MonitoramentoAtivo
from apps.usinas.models import Usina


def _registrar_dummy(monkeypatch):
    """Regra dummy que sempre dispara — isola o gate da lógica das regras reais."""
    class _Dummy(RegraUsina):
        nome = "_dummy_gate"
        severidade_padrao = SeveridadeAlerta.AVISO

        def avaliar(self, usina, leitura, config):
            return Anomalia(
                severidade=SeveridadeAlerta.AVISO, mensagem="dummy", contexto={},
            )

    monkeypatch.setitem(regras_base._REGISTRO, _Dummy.nome, _Dummy)
    from apps.alertas import motor as motor_mod
    monkeypatch.setattr(motor_mod, "regras_registradas", lambda: [_Dummy])
    return _Dummy


@pytest.fixture
def usina_sem_garantia(db, empresa, conta_provedor):
    """Usina sem garantia — ao contrário da fixture `usina` do conftest."""
    return Usina.objects.create(
        empresa=empresa, conta_provedor=conta_provedor, id_externo="ext-premium",
        nome="Usina Premium", capacidade_kwp=Decimal("50.000"),
    )


@pytest.mark.django_db
def test_premium_sem_garantia_e_avaliada(
    empresa, config, usina_sem_garantia, monkeypatch
):
    """Usina premium-sem-garantia gera alerta (gate liga pelo premium)."""
    _registrar_dummy(monkeypatch)
    MonitoramentoAtivo.objects.create(
        empresa=empresa, usina=usina_sem_garantia,
        inicio_em=date.today() - timedelta(days=10), meses=12,
    )

    avaliar_empresa(empresa.id)

    assert Alerta.objects.filter(
        usina=usina_sem_garantia, regra="_dummy_gate", estado=EstadoAlerta.ABERTO,
    ).exists()


@pytest.mark.django_db
def test_sem_garantia_sem_premium_e_pulada(
    empresa, config, usina_sem_garantia, monkeypatch
):
    """Sem garantia e sem premium → motor pula a usina (nenhum alerta)."""
    _registrar_dummy(monkeypatch)

    avaliar_empresa(empresa.id)

    assert not Alerta.objects.filter(usina=usina_sem_garantia).exists()


@pytest.mark.django_db
def test_premium_vencido_e_pulada(
    empresa, config, usina_sem_garantia, monkeypatch
):
    """Premium vencido (e sem garantia) não liga o monitoramento."""
    _registrar_dummy(monkeypatch)
    MonitoramentoAtivo.objects.create(
        empresa=empresa, usina=usina_sem_garantia,
        inicio_em=date.today() - timedelta(days=400), meses=12,
    )

    avaliar_empresa(empresa.id)

    assert not Alerta.objects.filter(usina=usina_sem_garantia).exists()


@pytest.mark.django_db
def test_alerta_premium_anotado(empresa, config, usina_sem_garantia, monkeypatch):
    """`com_premium()` e a property `premium` refletem o contrato vigente."""
    _registrar_dummy(monkeypatch)
    MonitoramentoAtivo.objects.create(
        empresa=empresa, usina=usina_sem_garantia,
        inicio_em=date.today() - timedelta(days=10), meses=12,
    )

    avaliar_empresa(empresa.id)

    alerta = Alerta.objects.com_premium().get(usina=usina_sem_garantia)
    assert alerta._premium_anotado is True
    assert alerta.premium is True

    # Sem anotação (instância crua) a property cai no fallback por query.
    cru = Alerta.objects.get(pk=alerta.pk)
    assert cru.premium is True
