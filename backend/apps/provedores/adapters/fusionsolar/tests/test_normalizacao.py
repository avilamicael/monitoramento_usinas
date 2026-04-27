"""Testes de normalização do FusionSolarAdapter."""
from __future__ import annotations

from decimal import Decimal

import pytest

from apps.provedores.adapters.fusionsolar.adapter import FusionSolarAdapter


@pytest.fixture
def adapter() -> FusionSolarAdapter:
    return FusionSolarAdapter(
        {"username": "u", "system_code": "sc", "xsrf_token": "fake"}
    )


# ── Usina ─────────────────────────────────────────────────────────────────

def test_usina_com_kpi_populado(adapter):
    r = {
        "stationCode": "NE=38915014",
        "stationName": "MAGAIVER",
        "capacity": 0.00805,    # MW = 8.05 kWp
        "stationAddr": "Brasil SC Penha",
        "_kpi": {
            "day_power": 22.11,
            "month_power": 681.06,
            "total_power": 7774.19,
            "total_current_power": 4.139,
            "real_health_state": 3,
        },
    }
    u = adapter._normalizar_usina(r)
    assert u.id_externo == "NE=38915014"
    assert u.nome == "MAGAIVER"
    # 0.00805 MW → 8.05 kWp
    assert u.capacidade_kwp == Decimal("8.050")
    assert u.potencia_kw == Decimal("4.139")
    assert u.energia_hoje_kwh == Decimal("22.11")


def test_usina_capacity_em_kwp_mantem(adapter):
    """Quando capacity ≥ 100, interpretamos como kWp (não MW)."""
    r = {"stationCode": "X", "stationName": "Y", "capacity": 250.5, "_kpi": {}}
    u = adapter._normalizar_usina(r)
    assert u.capacidade_kwp == Decimal("250.5")


# ── Inversor ──────────────────────────────────────────────────────────────

def test_inversor_online_com_eletricos(adapter):
    """run_state=1 + KPIs populados → estado=online + campos preenchidos."""
    r = {
        "id": 1000000040519690,
        "devName": "INV-NS24BG015346",
        "invType": "SUN2000-5KTL-L1",
        "esnCode": "NS24BG015346",
        "devTypeId": 38,
        "_kpi": {
            "run_state": 1,
            "active_power": 0.542,
            "day_cap": 12.49,
            "total_cap": 3013.84,
            "a_u": 113.2,
            "ab_u": 224.8,
            "a_i": 2.329,
            "pv1_u": 262.9,
            "pv1_i": 2.18,
            "elec_freq": 59.97,
            "temperature": 37.1,
        },
    }
    i = adapter._normalizar_inversor(r, "STATION")
    assert i.estado == "online"
    assert i.id_externo == "1000000040519690"
    assert i.numero_serie == "NS24BG015346"
    assert i.modelo == "SUN2000-5KTL-L1"
    assert i.pac_kw == Decimal("0.542")
    # SUN2000-5KTL-L1 é monofásico (b_u/c_u=0): tensão útil é ab_u (linha
    # entre fases ≈ 220V), não a_u (fase-neutro virtual ≈ 114V).
    assert i.tensao_ac_v == Decimal("224.8")
    assert i.corrente_ac_a == Decimal("2.329")
    assert i.frequencia_hz == Decimal("59.97")
    assert i.tensao_dc_v == Decimal("262.9")
    assert i.corrente_dc_a == Decimal("2.18")
    assert i.temperatura_c == Decimal("37.1")


def test_inversor_offline_run_state_zero_mantem_eletricos_null(adapter):
    """
    Crítico: quando run_state=0, todos os outros KPIs vêm null. NÃO preencher
    com zero — null propaga pro DadosInversor para que as regras de alerta
    NÃO avaliem dado ausente.
    """
    r = {
        "id": 1,
        "invType": "SUN2000",
        "_kpi": {
            "run_state": 0,
            "active_power": None,
            "a_u": None,
            "a_i": None,
            "pv1_u": None,
            "pv1_i": None,
            "elec_freq": None,
            "temperature": None,
        },
    }
    i = adapter._normalizar_inversor(r, "X")
    assert i.estado == "offline"
    assert i.pac_kw is None
    assert i.tensao_ac_v is None
    assert i.corrente_ac_a is None
    assert i.tensao_dc_v is None
    assert i.corrente_dc_a is None
    assert i.frequencia_hz is None
    assert i.temperatura_c is None


def test_inversor_sem_run_state_usa_devstatus(adapter):
    r = {"id": 1, "devStatus": 1, "_kpi": {}}
    i = adapter._normalizar_inversor(r, "X")
    assert i.estado == "online"
    r2 = {"id": 1, "devStatus": 0, "_kpi": {}}
    assert adapter._normalizar_inversor(r2, "X").estado == "offline"


def test_inversor_strings_mppt_agregam_pv_u_e_i(adapter):
    r = {
        "id": 1,
        "_kpi": {
            "run_state": 1,
            "pv1_u": 262.9, "pv1_i": 2.18,
            "pv2_u": 0, "pv2_i": 0,  # string 2 sem dados
            "pv3_u": 230.5, "pv3_i": 1.9,
        },
    }
    i = adapter._normalizar_inversor(r, "X")
    indices = sorted(s.indice for s in i.strings_mppt)
    # pv2 deixou ambos null → não entra; mas 0 não é None, então entra.
    # O teste aqui aceita que slots com 0 aparecem — contrato: omitir só
    # quando TUDO é None. Ajustamos o adapter: 0 é "dado real".
    assert 1 in indices
    assert 3 in indices
