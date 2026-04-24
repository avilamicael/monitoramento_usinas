"""Testes de normalização do SolarmanAdapter."""
from __future__ import annotations

from decimal import Decimal

import pytest

from apps.provedores.adapters.solarman.adapter import SolarmanAdapter


@pytest.fixture
def adapter() -> SolarmanAdapter:
    # Token fake para evitar validação no teste (os métodos normalizar_* não
    # chamam _garantir_autenticado).
    return SolarmanAdapter({"token": "eyJ.fake.token"})


def test_usina_converte_generationpower_watts_para_kw(adapter):
    r = {
        "station": {
            "id": 64844508,
            "name": "ADILSON CORSO",
            "installedCapacity": 5.4,
            "generationPower": 1638.0,  # W
            "generationValue": 16.5,
            "generationMonth": 461.6,
            "generationTotal": 5135.6,
            "networkStatus": "NORMAL",
            "locationAddress": "RUA DOM PEDRO II",
            "regionTimezone": "America/Sao_Paulo",
            "lastUpdateTime": 1777049704.0,
        }
    }
    u = adapter._normalizar_usina(r)
    assert u.id_externo == "64844508"
    assert u.nome == "ADILSON CORSO"
    # 1638 W → 1.638 kW
    assert u.potencia_kw == Decimal("1.638")
    assert u.capacidade_kwp == Decimal("5.4")
    assert u.energia_hoje_kwh == Decimal("16.5")
    assert u.status == "online"


def test_usina_status_offline(adapter):
    r = {"station": {"id": 1, "name": "x", "networkStatus": "OFFLINE"}}
    assert adapter._normalizar_usina(r).status == "offline"


def test_inversor_com_stats_traz_eletricos_completos(adapter):
    """Confirma que o fix (acoplar stats/day) popula os elétricos."""
    inv = {
        "id": 256525466,
        "deviceSn": "2411060319",
        "type": "MICRO_INVERTER",
        "netState": 1,
        "deviceState": 3,
        "collectionTime": 1776176264.0,
    }
    dados = {
        "APo_t1": 480.0,       # W → 0.48 kW
        "Etdy_ge0": 2.5,       # kWh
        "Et_ge0": 1000.0,      # kWh
        "AV1": 220.5,
        "AC1": 2.18,
        "AF1": 60.01,
        "DV1": 38.9,
        "DC1": 11.4,
        "DP1": 450,            # W
        "AC_RDT_T1": 42.0,
    }
    i = adapter._normalizar_inversor(inv, "USINA", dados)
    assert i.tipo == "microinversor"
    assert i.estado == "online"
    assert i.numero_serie == "2411060319"
    assert i.pac_kw == Decimal("0.48")
    assert i.energia_hoje_kwh == Decimal("2.5")
    assert i.energia_total_kwh == Decimal("1000.0")
    assert i.tensao_ac_v == Decimal("220.5")
    assert i.corrente_ac_a == Decimal("2.18")
    assert i.frequencia_hz == Decimal("60.01")
    assert i.tensao_dc_v == Decimal("38.9")
    assert i.corrente_dc_a == Decimal("11.4")
    assert i.temperatura_c == Decimal("42.0")
    assert len(i.strings_mppt) == 1
    assert i.strings_mppt[0].tensao_v == Decimal("38.9")


def test_inversor_sem_stats_fica_com_eletricos_null(adapter):
    """Bug original: sem stats/day, todos os elétricos ficavam 0.
    No novo schema, ficam null (= regra de alerta não avalia)."""
    inv = {"id": 1, "deviceSn": "SN", "type": "MICRO_INVERTER", "netState": 1}
    i = adapter._normalizar_inversor(inv, "X", {})
    assert i.pac_kw is None
    assert i.tensao_ac_v is None
    assert i.corrente_ac_a is None
    assert i.frequencia_hz is None
    assert i.tensao_dc_v is None
    assert i.corrente_dc_a is None
    assert i.temperatura_c is None
    assert i.strings_mppt == []


def test_inversor_netstate_zero_fica_offline(adapter):
    inv = {"id": 1, "deviceSn": "SN", "type": "INVERTER", "netState": 0}
    i = adapter._normalizar_inversor(inv, "X", {})
    assert i.estado == "offline"
    assert i.tipo == "inversor"
