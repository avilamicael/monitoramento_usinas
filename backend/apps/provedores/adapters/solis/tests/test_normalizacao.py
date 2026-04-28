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

    # Fixture real: uAc1=230.4, uAc2=0, uAc3=0 → monofásico, canônico = uAc1.
    assert dados.tensao_ac_v == Decimal("230.4")
    assert dados.tipo_ligacao == "monofasico"
    assert dados.corrente_ac_a == Decimal("29.7")
    assert dados.tensao_dc_v == Decimal("164.2")
    assert dados.corrente_dc_a == Decimal("9.3")
    assert dados.frequencia_hz == Decimal("59.98")


def test_normalizar_inversor_monofasico_eletrica_ac(adapter):
    """Fixture real é monofásica — verifica payload `eletrica_ac` completo."""
    raw = _load("inverter_list_record.json")
    dados = adapter._normalizar_inversor(raw, id_usina_externo="X")

    assert dados.tipo_ligacao == "monofasico"
    assert dados.tensao_ac_v == Decimal("230.4")

    eletrica = dados.eletrica_ac
    assert eletrica is not None
    # Fases-neutro: a/b/c presentes (a=230.4, b=0, c=0) — todas as chaves
    # mantidas pra auditoria, só `a` é considerada ativa.
    assert eletrica["fases_neutro"]["a"] == Decimal("230.4")
    assert eletrica["fases_neutro"]["b"] == Decimal("0.0")
    assert eletrica["fases_neutro"]["c"] == Decimal("0.0")
    # Sem linha (monofásico não tem `ab_estimada`).
    assert "linhas" not in eletrica
    # Correntes: a=29.7, b=0, c=0.
    assert eletrica["correntes"]["a"] == Decimal("29.7")
    # Power factor e reactive power vêm da fixture (1.0 e 0.0).
    assert eletrica["fator_potencia"] == Decimal("1.0")
    assert eletrica["potencia_reativa_kvar"] == Decimal("0.0")


def test_normalizar_inversor_bifasico_canonico_via_linha_estimada(adapter):
    """Bifásico Solis: 2 fases ativas → canônico = uAc1+uAc2 (linha estimada)."""
    raw = _load("inverter_list_record.json")
    raw = {
        **raw,
        "_detail": {
            **raw["_detail"],
            "uAc1": 115.0,
            "uAc2": 112.0,
            "uAc3": 0.0,
            "iAc1": 14.0,
            "iAc2": 14.0,
            "iAc3": 0.0,
        },
    }
    dados = adapter._normalizar_inversor(raw, id_usina_externo="X")

    assert dados.tipo_ligacao == "bifasico"
    # Linha estimada = 115 + 112 = 227 (próximo da rede 220V brasileira).
    assert dados.tensao_ac_v == Decimal("227.0")

    eletrica = dados.eletrica_ac
    assert eletrica is not None
    assert eletrica["linhas"]["ab_estimada"] == Decimal("227.0")
    assert eletrica["fases_neutro"]["a"] == Decimal("115.0")
    assert eletrica["fases_neutro"]["b"] == Decimal("112.0")


def test_normalizar_inversor_trifasico_canonico_uAc1(adapter):
    """Trifásico Solis: 3 fases ativas → canônico = uAc1 (convenção)."""
    raw = _load("inverter_list_record.json")
    raw = {
        **raw,
        "_detail": {
            **raw["_detail"],
            "uAc1": 220.0,
            "uAc2": 221.0,
            "uAc3": 219.0,
            "iAc1": 10.0,
            "iAc2": 10.5,
            "iAc3": 9.8,
        },
    }
    dados = adapter._normalizar_inversor(raw, id_usina_externo="X")

    assert dados.tipo_ligacao == "trifasico"
    assert dados.tensao_ac_v == Decimal("220.0")

    eletrica = dados.eletrica_ac
    assert eletrica is not None
    # Trifásico não popula linhas (Solis não expõe).
    assert "linhas" not in eletrica
    assert eletrica["fases_neutro"] == {
        "a": Decimal("220.0"),
        "b": Decimal("221.0"),
        "c": Decimal("219.0"),
    }
    assert eletrica["correntes"] == {
        "a": Decimal("10.0"),
        "b": Decimal("10.5"),
        "c": Decimal("9.8"),
    }


def test_normalizar_inversor_payload_vazio_sem_classificacao(adapter):
    """Payload vazio (provedor offline / inverterDetail falhou): tudo None."""
    raw = _load("inverter_list_record.json")
    raw = {**raw, "_detail": {}}
    dados = adapter._normalizar_inversor(raw, id_usina_externo="X")

    assert dados.tipo_ligacao is None
    assert dados.tensao_ac_v is None
    # eletrica_ac fica None quando nada relevante foi exposto.
    assert dados.eletrica_ac is None


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
