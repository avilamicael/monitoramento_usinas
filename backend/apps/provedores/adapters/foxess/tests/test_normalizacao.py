"""Tests para FoxessAdapter — usam o cache interno preenchido manualmente
(em vez de mockar HTTP). Evita flakiness de mock e testa o caminho real
de normalização.
"""
from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

import pytest

from apps.provedores.adapters.foxess.adapter import FoxessAdapter

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def adapter() -> FoxessAdapter:
    return FoxessAdapter({"api_key": "dummy"})


@pytest.fixture
def adapter_hidratado(adapter) -> FoxessAdapter:
    """Pré-popula o cache como se `_hidratar()` já tivesse rodado."""
    real = json.loads((FIXTURES / "real_query.json").read_text())
    adapter._usinas_raw = [
        {"stationID": "SIRLEI-MANECA", "name": "Sirlei (Maneca)", "ianaTimezone": "America/Sao_Paulo"},
    ]
    adapter._detalhes_usina = {
        "SIRLEI-MANECA": {
            "capacity": 8.4,
            "address": "Guilherme Jacob Bruch",
            "city": "São José",
            "stationName": "Sirlei (Maneca)",
        },
    }
    adapter._dispositivos = [
        {"deviceSN": "60Q1252054MR054", "stationID": "SIRLEI-MANECA", "deviceType": "Q1-2500-E"},
    ]
    adapter._detalhes_disp = {
        "60Q1252054MR054": {"deviceType": "Q1-2500-E", "capacity": 2.5},
    }
    adapter._tempo_real = real
    adapter._geracao = {
        "60Q1252054MR054": {"today": 1.8, "month": 53.0, "cumulative": 1197.4},
    }
    adapter._hidratado = True
    return adapter


# ── Usina ─────────────────────────────────────────────────────────────────

def test_usina_agrega_potencia_e_energia(adapter_hidratado):
    [usina] = adapter_hidratado.buscar_usinas()
    assert usina.id_externo == "SIRLEI-MANECA"
    assert usina.nome == "Sirlei (Maneca)"
    assert usina.capacidade_kwp == Decimal("8.4")
    # Soma de todos os devices da usina (só 1 no fixture)
    assert usina.potencia_kw == Decimal("1.708")
    assert usina.energia_hoje_kwh == Decimal("1.8")
    assert usina.energia_total_kwh == Decimal("1197.4")


def test_usina_contagem_inversores(adapter_hidratado):
    [usina] = adapter_hidratado.buscar_usinas()
    assert usina.qtd_inversores_total == 1
    assert usina.qtd_inversores_online == 1


def test_usina_preserva_raw(adapter_hidratado):
    [usina] = adapter_hidratado.buscar_usinas()
    assert usina.raw["stationID"] == "SIRLEI-MANECA"


# ── Inversor ──────────────────────────────────────────────────────────────

def test_inversor_campos_eletricos(adapter_hidratado):
    [inv] = adapter_hidratado.buscar_inversores("SIRLEI-MANECA")
    assert inv.id_externo == "60Q1252054MR054"
    assert inv.numero_serie == "60Q1252054MR054"
    assert inv.modelo == "Q1-2500-E"
    assert inv.pac_kw == Decimal("1.708")
    assert inv.energia_hoje_kwh == Decimal("1.8")
    assert inv.energia_total_kwh == Decimal("1197.4")
    assert inv.tensao_ac_v == Decimal("219.3")
    assert inv.corrente_ac_a == Decimal("7.8")
    assert inv.frequencia_hz == Decimal("60.03")
    assert inv.temperatura_c == Decimal("48.0")


def test_inversor_strings_mppt(adapter_hidratado):
    [inv] = adapter_hidratado.buscar_inversores("SIRLEI-MANECA")
    indices = [s.indice for s in inv.strings_mppt]
    assert indices == [1, 2, 3, 4]
    s1 = inv.strings_mppt[0]
    assert s1.tensao_v == Decimal("39.3")
    assert s1.corrente_a == Decimal("11.4")
    # pv1Power = 0.448 kW → 448 W
    assert s1.potencia_w == Decimal("448.000")


def test_inversor_sem_fault_fica_online(adapter_hidratado):
    [inv] = adapter_hidratado.buscar_inversores("SIRLEI-MANECA")
    assert inv.estado == "online"


def test_inversor_com_fault_fica_alerta(adapter):
    adapter._usinas_raw = [{"stationID": "X", "name": "X"}]
    adapter._detalhes_usina = {"X": {}}
    adapter._dispositivos = [{"deviceSN": "SN1", "stationID": "X"}]
    adapter._detalhes_disp = {"SN1": {}}
    adapter._tempo_real = {"SN1": {"currentFault": "4125", "currentFaultCount": 1}}
    adapter._geracao = {"SN1": {}}
    adapter._hidratado = True
    [inv] = adapter.buscar_inversores("X")
    assert inv.estado == "alerta"


def test_inversor_sem_real_query_fica_offline(adapter):
    adapter._usinas_raw = [{"stationID": "X", "name": "X"}]
    adapter._detalhes_usina = {"X": {}}
    adapter._dispositivos = [{"deviceSN": "SN1", "stationID": "X"}]
    adapter._detalhes_disp = {"SN1": {}}
    adapter._tempo_real = {}  # real/query falhou
    adapter._geracao = {}
    adapter._hidratado = True
    [inv] = adapter.buscar_inversores("X")
    assert inv.estado == "offline"
    # Campos elétricos não podem ser 0 — devem ser None (não temos dado)
    assert inv.tensao_ac_v is None
    assert inv.corrente_ac_a is None
    assert inv.frequencia_hz is None
    assert inv.temperatura_c is None


def test_inversor_energia_total_prefere_pv_energy_total_sobre_cumulative(adapter):
    """Quando cumulative é buggy (< today), PVEnergyTotal do real/query prevalece."""
    adapter._usinas_raw = [{"stationID": "X", "name": "X"}]
    adapter._detalhes_usina = {"X": {}}
    adapter._dispositivos = [{"deviceSN": "SN1", "stationID": "X"}]
    adapter._detalhes_disp = {"SN1": {}}
    adapter._tempo_real = {"SN1": {"PVEnergyTotal": 5000, "todayYield": 10}}
    adapter._geracao = {"SN1": {"cumulative": 2}}  # buggy: < today
    adapter._hidratado = True
    [inv] = adapter.buscar_inversores("X")
    assert inv.energia_total_kwh == Decimal("5000")
