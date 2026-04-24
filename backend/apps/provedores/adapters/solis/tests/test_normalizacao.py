"""Tests the SolisAdapter normalization against real payloads captured
from the production system.

The fixtures under fixtures/ are trimmed copies of actual Solis API
responses observed on 2026-04-24 — keeping them real makes regressions
easy to spot if Solis tweaks the schema.
"""
from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

import pytest

from apps.provedores.adapters.solis.adapter import SolisAdapter

FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


@pytest.fixture
def adapter() -> SolisAdapter:
    return SolisAdapter({"api_key": "dummy", "app_secret": "dummy"})


# ── Usina ─────────────────────────────────────────────────────────────────

def test_normalizar_usina_campos_essenciais(adapter):
    raw = _load("station_list_record.json")
    dados = adapter._normalizar_usina(raw)

    assert dados.id_externo == "1298491919449480322"
    assert dados.nome == "Daniele Vieira"
    assert dados.capacidade_kwp == Decimal("6.72")  # `capacity` tem precedência sobre `dip`
    assert dados.potencia_kw == Decimal("0")
    assert dados.energia_hoje_kwh == Decimal("0")
    assert dados.energia_mes_kwh == Decimal("0")
    assert dados.energia_total_kwh == Decimal("16.532")


def test_normalizar_usina_status_offline(adapter):
    raw = _load("station_list_record.json")
    assert raw["state"] == 2
    dados = adapter._normalizar_usina(raw)
    assert dados.status == "offline"


def test_normalizar_usina_preserva_raw(adapter):
    raw = _load("station_list_record.json")
    dados = adapter._normalizar_usina(raw)
    assert dados.raw is raw  # sem cópia desnecessária


def test_normalizar_usina_campos_opcionais(adapter):
    raw = _load("station_list_record.json")
    dados = adapter._normalizar_usina(raw)
    # Amostra tem `inverterCount=1` e `inverterOnlineCount=0` — usina offline
    assert dados.qtd_inversores_total == 1
    assert dados.qtd_inversores_online is None  # 0 → None por causa do `or None`
    assert dados.endereco == "61 Rua Evaldo Jordão de Souza"


def test_normalizar_usina_status_offline_fallback_para_codigo_desconhecido(adapter):
    raw = _load("station_list_record.json")
    raw = {**raw, "state": 99}
    dados = adapter._normalizar_usina(raw)
    assert dados.status == "offline"


def test_normalizar_usina_sem_state(adapter):
    raw = _load("station_list_record.json")
    raw = {**raw, "state": None}
    dados = adapter._normalizar_usina(raw)
    assert dados.status == "offline"


# ── Inversor ──────────────────────────────────────────────────────────────

def test_normalizar_inversor_campos_eletricos(adapter):
    raw = _load("inverter_list_record.json")
    dados = adapter._normalizar_inversor(raw, id_usina_externo="USINA_X")

    assert dados.id_externo == "1308675217948798137"
    assert dados.id_usina_externo == "USINA_X"
    assert dados.numero_serie == "1003010241110282"
    assert dados.modelo == "S6-GR1P8K2"
    assert dados.pac_kw == Decimal("6.96")
    assert dados.energia_hoje_kwh == Decimal("8.4")
    assert dados.energia_total_kwh == Decimal("5.531")


def test_normalizar_inversor_usa_detail_para_eletricos(adapter):
    raw = _load("inverter_list_record.json")
    dados = adapter._normalizar_inversor(raw, id_usina_externo="USINA_X")

    # Do _detail
    assert dados.tensao_ac_v == Decimal("230.4")
    assert dados.corrente_ac_a == Decimal("29.7")
    assert dados.tensao_dc_v == Decimal("164.2")
    assert dados.corrente_dc_a == Decimal("9.3")
    assert dados.frequencia_hz == Decimal("59.98")


def test_normalizar_inversor_temperatura_valida(adapter):
    """Quando `_detail.inverterTemperature` tem valor razoável, ele é usado."""
    raw = _load("inverter_list_record.json")
    assert raw["_detail"]["inverterTemperature"] == 64.6
    dados = adapter._normalizar_inversor(raw, id_usina_externo="X")
    assert dados.temperatura_c == Decimal("64.6")


def test_normalizar_inversor_temperatura_sentinela_150_vira_null(adapter):
    """Solis reporta 150.0°C quando o sensor não está disponível — filtrar."""
    raw = _load("inverter_list_record.json")
    raw = {**raw, "_detail": {**raw["_detail"], "inverterTemperature": 150.0}}
    dados = adapter._normalizar_inversor(raw, id_usina_externo="X")
    assert dados.temperatura_c is None


def test_normalizar_inversor_sem_detail_deixa_eletricos_null(adapter):
    """Quando /inverterDetail falha, _detail vem vazio — nunca preencher com 0."""
    raw = _load("inverter_list_record.json")
    raw = {**raw, "_detail": {}}
    dados = adapter._normalizar_inversor(raw, id_usina_externo="X")
    assert dados.tensao_ac_v is None
    assert dados.corrente_ac_a is None
    assert dados.tensao_dc_v is None
    assert dados.corrente_dc_a is None
    assert dados.frequencia_hz is None
    assert dados.temperatura_c is None


def test_normalizar_inversor_strings_mppt_omite_slots_zerados(adapter):
    raw = _load("inverter_list_record.json")
    dados = adapter._normalizar_inversor(raw, id_usina_externo="X")

    # A fixture tem pow1=1527.06 e pow2=6020.82 ativos; pow3..pow32 zerados.
    indices = [s.indice for s in dados.strings_mppt]
    assert 1 in indices
    assert 2 in indices
    # Slots zerados devem ter sido podados
    assert 15 not in indices
    assert 32 not in indices


def test_normalizar_inversor_preserva_raw(adapter):
    raw = _load("inverter_list_record.json")
    dados = adapter._normalizar_inversor(raw, id_usina_externo="X")
    assert dados.raw is raw
