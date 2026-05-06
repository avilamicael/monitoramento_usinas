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
    # FoxESS não fornece timestamp real; offline → medido_em=None
    # (preserva sinal de comunicação degradada).
    assert inv.medido_em is None


def test_usina_todos_offline_zera_medido_em(adapter):
    """Quando nenhum dispositivo da usina retornou tempo_real, `qtd_online=0`.
    `medido_em` deve ser `None` para não enganar `sem_comunicacao`.

    `qtd_inversores_online` é serializado como `None` (e não `0`) pelo adapter
    via `qtd_online or None` — o que importa aqui é o sinal do `medido_em`.
    """
    adapter._usinas_raw = [{"stationID": "X", "name": "X"}]
    adapter._detalhes_usina = {"X": {}}
    adapter._dispositivos = [{"deviceSN": "SN1", "stationID": "X"}]
    adapter._detalhes_disp = {"SN1": {}}
    adapter._tempo_real = {}  # nenhum device respondeu
    adapter._geracao = {}
    adapter._hidratado = True
    [usina] = adapter.buscar_usinas()
    assert not usina.qtd_inversores_online  # 0 vira None na saída
    assert usina.medido_em is None


def test_inversor_alerta_preenche_medido_em(adapter):
    """Inversor em estado=alerta (fault ativo) ainda está reportando — mantém
    `medido_em=now()`."""
    adapter._usinas_raw = [{"stationID": "X", "name": "X"}]
    adapter._detalhes_usina = {"X": {}}
    adapter._dispositivos = [{"deviceSN": "SN1", "stationID": "X"}]
    adapter._detalhes_disp = {"SN1": {}}
    adapter._tempo_real = {"SN1": {"currentFault": "4125", "currentFaultCount": 1}}
    adapter._geracao = {"SN1": {}}
    adapter._hidratado = True
    [inv] = adapter.buscar_inversores("X")
    assert inv.estado == "alerta"
    assert inv.medido_em is not None


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


# ── Classificação ligação AC ─────────────────────────────────────────────


def _montar_adapter_com_real(adapter, real: dict) -> FoxessAdapter:
    """Helper: popula cache mínimo com um payload de real/query custom."""
    adapter._usinas_raw = [{"stationID": "X", "name": "X"}]
    adapter._detalhes_usina = {"X": {}}
    adapter._dispositivos = [{"deviceSN": "SN1", "stationID": "X"}]
    adapter._detalhes_disp = {"SN1": {}}
    adapter._tempo_real = {"SN1": real}
    adapter._geracao = {}
    adapter._hidratado = True
    return adapter


def test_classifica_monofasico_canonico_e_eletrica_ac(adapter):
    """1 fase-neutro ativa (R=219.3, S=0, T=0): mono, canônico = R."""
    real = {
        "RVolt": 219.3, "SVolt": 0.0, "TVolt": 0.0,
        "RCurrent": 7.8, "SCurrent": 0.0, "TCurrent": 0.0,
        "RFreq": 60.03,
        "PowerFactor": 0.99,
        "ReactivePower": 0.05,
    }
    [inv] = _montar_adapter_com_real(adapter, real).buscar_inversores("X")
    assert inv.tipo_ligacao == "monofasico"
    assert inv.tensao_ac_v == Decimal("219.3")
    assert inv.eletrica_ac is not None
    assert inv.eletrica_ac["fases_neutro"] == {
        "a": Decimal("219.3"), "b": Decimal("0.0"), "c": Decimal("0.0"),
    }
    assert inv.eletrica_ac["correntes"] == {
        "a": Decimal("7.8"), "b": Decimal("0.0"), "c": Decimal("0.0"),
    }
    assert inv.eletrica_ac["fator_potencia"] == Decimal("0.99")
    assert inv.eletrica_ac["potencia_reativa_kvar"] == Decimal("0.05")
    # FoxESS não expõe linhas — chave deve estar ausente.
    assert "linhas" not in inv.eletrica_ac


def test_classifica_bifasico_canonico_soma_linhas_ab_estimada(adapter):
    """2 fases-neutro ativas (R=115, S=113, T=0): bi, canônico = soma das
    fases ativas, exposta também em `eletrica_ac.linhas.ab_estimada`.

    Convenção alinhada com Solis/FusionSolar: em rede 220V brasileira
    bifásica, cada fase é reportada em ~115V relativo a um neutro virtual
    interno; a soma aproxima a tensão útil de linha. Usar média ou primeira
    fase dispararia `subtensao_ac` falsa (limite mínimo 190V).
    """
    real = {
        "RVolt": 115.0, "SVolt": 113.0, "TVolt": 0.0,
        "RCurrent": 5.0, "SCurrent": 4.8, "TCurrent": 0.0,
    }
    [inv] = _montar_adapter_com_real(adapter, real).buscar_inversores("X")
    assert inv.tipo_ligacao == "bifasico"
    # Soma de 115 e 113 = 228.
    assert inv.tensao_ac_v == Decimal("228.0")
    assert inv.eletrica_ac is not None
    assert inv.eletrica_ac["linhas"] == {"ab_estimada": Decimal("228.0")}


def test_classifica_trifasico_canonico_primeira_fase(adapter):
    """3 fases-neutro ativas (220 V cada): tri, canônico = R."""
    real = {
        "RVolt": 220.5, "SVolt": 219.8, "TVolt": 220.1,
        "RCurrent": 3.1, "SCurrent": 3.0, "TCurrent": 3.2,
        "RFreq": 60.0, "SFreq": 60.0, "TFreq": 60.0,
    }
    [inv] = _montar_adapter_com_real(adapter, real).buscar_inversores("X")
    assert inv.tipo_ligacao == "trifasico"
    assert inv.tensao_ac_v == Decimal("220.5")
    assert inv.eletrica_ac["fases_neutro"] == {
        "a": Decimal("220.5"), "b": Decimal("219.8"), "c": Decimal("220.1"),
    }


def test_classifica_payload_vazio_fica_none(adapter):
    """Sem nenhuma tensão (real/query não veio): tipo=None, canônico=None,
    eletrica_ac=None."""
    [inv] = _montar_adapter_com_real(adapter, {}).buscar_inversores("X")
    assert inv.tipo_ligacao is None
    assert inv.tensao_ac_v is None
    assert inv.eletrica_ac is None


def test_classifica_todas_fases_zeradas_fica_none_mas_preserva_dict(adapter):
    """Inversor reportando 0 V em todas as fases (offline/standby):
    tipo=None (nenhuma fase ativa), canônico=None, mas eletrica_ac
    ainda contém os dados crus (zeros são leituras legítimas)."""
    real = {
        "RVolt": 0.0, "SVolt": 0.0, "TVolt": 0.0,
        "RCurrent": 0.0, "SCurrent": 0.0, "TCurrent": 0.0,
    }
    [inv] = _montar_adapter_com_real(adapter, real).buscar_inversores("X")
    assert inv.tipo_ligacao is None
    assert inv.tensao_ac_v is None
    # Dict ainda monta — não inventamos None onde provedor reportou 0.
    assert inv.eletrica_ac is not None
    assert inv.eletrica_ac["fases_neutro"]["a"] == Decimal("0.0")
