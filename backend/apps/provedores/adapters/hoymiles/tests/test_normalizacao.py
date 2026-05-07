"""Testes de normalização do HoymilesAdapter.

Alimenta os dataclasses diretamente (sem mockar HTTP) — foca em verificar
as conversões W→kW, Wh→kWh e o tratamento de `warn_data.connect` e
`strings_mppt`.
"""
from __future__ import annotations

from decimal import Decimal

import pytest

from apps.provedores.adapters.hoymiles.adapter import HoymilesAdapter


@pytest.fixture
def adapter() -> HoymilesAdapter:
    return HoymilesAdapter(
        {"username": "u", "password": "p", "token": "3.fake"}
    )


# ── Usina ─────────────────────────────────────────────────────────────────

def test_usina_converte_watts_para_kw(adapter):
    raw = {
        "id": 13051020,
        "name": "ANILDO SOUZA",
        "capacitor": "7.2",
        "status": 40,
        "tz_name": "UTC-03",
        "address": "",
        "_realtime": {
            "real_power": "5176.7",      # W
            "today_eq": "23336.0",       # Wh
            "month_eq": "426578",        # Wh
            "total_eq": "426578",        # Wh
        },
    }
    u = adapter._normalizar_usina(raw)
    assert u.id_externo == "13051020"
    assert u.nome == "ANILDO SOUZA"
    assert u.capacidade_kwp == Decimal("7.2")
    # 5176.7 W → 5.1767 kW
    assert u.potencia_kw == Decimal("5.1767")
    # Wh → kWh
    assert u.energia_hoje_kwh == Decimal("23.336")
    assert u.energia_mes_kwh == Decimal("426.578")
    assert u.energia_total_kwh == Decimal("426.578")
    assert u.status == "online"  # status=40 → online


def test_usina_status_desconhecido_vira_offline(adapter):
    u = adapter._normalizar_usina({"id": 1, "name": "x", "status": 99})
    assert u.status == "offline"


def test_usina_offline_zera_medido_em(adapter):
    """Hoymiles não fornece timestamp real; quando offline, `medido_em=None`
    para não enganar `sem_comunicacao` com `now()` falso."""
    u = adapter._normalizar_usina({"id": 1, "name": "x", "status": 99})
    assert u.status == "offline"
    assert u.medido_em is None


def test_usina_online_preenche_medido_em(adapter):
    """Online → `medido_em=now()` (proxy aceitável quando há atividade)."""
    u = adapter._normalizar_usina({"id": 1, "name": "x", "status": 40})
    assert u.status == "online"
    assert u.medido_em is not None


# ── Inversor ──────────────────────────────────────────────────────────────

def test_inversor_microinversor_online_com_eletricos(adapter):
    raw_inv = {
        "id": 31086730,
        "sn": "1422B022EFE8",
        "dtu_sn": "4145B022EFE8",
        "type": 3,
        "model_no": "HMS-2000DW-4T",
        "warn_data": {"connect": True, "warn": False},
    }
    dia = {
        31086730: {
            "tensao_dc_v": 38.9,
            "corrente_dc_a": 20.12,
            "pac_kw": 0.7849,
            "energia_hoje_kwh": 0.0,
            "tensao_ac_v": 221.0,
            "frequencia_hz": 60.01,
            "temperatura_c": 43.2,
            "strings_mppt": {
                "1": {"tensao": 39.0, "corrente": 6.73},
                "2": {"tensao": 39.0, "corrente": 6.66},
                "3": {"tensao": 38.8, "corrente": 6.73},
                "4": {"tensao": 38.8, "corrente": None},
            },
        }
    }
    inv = adapter._normalizar_inversor(raw_inv, "USINA", dia)
    assert inv.id_externo == "31086730"
    assert inv.numero_serie == "1422B022EFE8"
    assert inv.tipo == "microinversor"
    assert inv.estado == "online"
    assert inv.pac_kw == Decimal("0.7849")
    assert inv.tensao_ac_v == Decimal("221.0")
    # Hoymiles cloud NÃO expõe corrente AC por micro — sempre null
    assert inv.corrente_ac_a is None
    assert inv.frequencia_hz == Decimal("60.01")
    assert inv.tensao_dc_v == Decimal("38.9")
    assert inv.corrente_dc_a == Decimal("20.12")
    assert inv.temperatura_c == Decimal("43.2")

    # Microinversor com tensão AC presente: classifica como monofásico e
    # mapeia a tensão para `fases_neutro.a`. Sem corrente AC → sem
    # `correntes`. Sem fp/kvar/linhas no protobuf.
    assert inv.tipo_ligacao == "monofasico"
    assert inv.eletrica_ac is not None
    assert inv.eletrica_ac["fases_neutro"]["a"] == Decimal("221.0")
    assert "b" not in inv.eletrica_ac["fases_neutro"]
    assert "c" not in inv.eletrica_ac["fases_neutro"]
    assert "linhas" not in inv.eletrica_ac
    assert "correntes" not in inv.eletrica_ac

    indices = sorted(s.indice for s in inv.strings_mppt)
    assert indices == [1, 2, 3, 4]


def test_inversor_desconectado_fica_offline(adapter):
    raw = {"id": 1, "sn": "SN", "warn_data": {"connect": False}}
    inv = adapter._normalizar_inversor(raw, "X", {})
    assert inv.estado == "offline"
    # Cloud não expõe timestamp real — `now()` mascara perda de comunicação.
    assert inv.medido_em is None


def test_inversor_conectado_preenche_medido_em(adapter):
    raw = {"id": 1, "sn": "SN", "warn_data": {"connect": True}}
    inv = adapter._normalizar_inversor(raw, "X", {})
    assert inv.estado == "online"
    assert inv.medido_em is not None


def test_inversor_sem_dados_dia_tudo_null(adapter):
    """Quando protobuf falhou (dia={}), todos os elétricos ficam null."""
    raw = {"id": 1, "sn": "SN", "warn_data": {"connect": True}}
    inv = adapter._normalizar_inversor(raw, "X", {})
    assert inv.pac_kw is None
    assert inv.tensao_ac_v is None
    assert inv.frequencia_hz is None
    assert inv.temperatura_c is None
    assert inv.tensao_dc_v is None
    assert inv.corrente_dc_a is None
    assert inv.strings_mppt == []
    # Sem tensão AC → não classifica nem inventa eletrica_ac.
    assert inv.tipo_ligacao is None
    assert inv.eletrica_ac is None


def test_inversor_modelo_fallback_para_tipo(adapter):
    raw = {"id": 1, "sn": "SN", "type": 3, "warn_data": {"connect": True}}
    inv = adapter._normalizar_inversor(raw, "X", {})
    # Sem model/model_no — usa "tipo-{type}"
    assert inv.modelo == "tipo-3"


# ── Fix: estado offline + pac>0 (warn_data.connect transitorio) ───────────

def test_inversor_offline_com_pac_positivo_vira_online(adapter):
    """Caso real RICARDO HOFFMANN 2026-05-07 17:00 UTC: connect=false mas
    pac=1.453 (DTU piscou; cloud entregou pac fresco). Realidade física
    vence o flag — micro está produzindo, logo está online."""
    raw = {"id": 1, "sn": "SN", "warn_data": {"connect": False}}
    dia = {1: {"pac_kw": 1.453}}
    inv = adapter._normalizar_inversor(raw, "X", dia)
    assert inv.estado == "online"
    assert inv.pac_kw == Decimal("1.453")
    # Como agora está online, medido_em é proxy `now()` (não None).
    assert inv.medido_em is not None


def test_inversor_offline_com_pac_zero_continua_offline(adapter):
    """`pac=0` com `connect=false` é offline genuíno — não inventar online."""
    raw = {"id": 1, "sn": "SN", "warn_data": {"connect": False}}
    dia = {1: {"pac_kw": 0}}
    inv = adapter._normalizar_inversor(raw, "X", dia)
    assert inv.estado == "offline"


def test_inversor_offline_sem_pac_continua_offline(adapter):
    """`pac=None` (protobuf sem dados) com `connect=false` continua offline."""
    raw = {"id": 1, "sn": "SN", "warn_data": {"connect": False}}
    inv = adapter._normalizar_inversor(raw, "X", {})
    assert inv.estado == "offline"
    assert inv.pac_kw is None


# ── Fix: recalibrar_usinas (soma dos microinversores) ─────────────────────

def test_recalibrar_usinas_soma_pac_dos_microinversores(adapter):
    """Hoymiles agregador atrasa: usina pac=0 enquanto micros geram. O hook
    recalibra `usina.potencia_kw` com a soma — fonte de verdade são os micros."""
    usina_raw = {
        "id": 12824900,
        "name": "RICARDO HOFFMANN",
        "capacitor": "7.38",
        "status": 40,
        "tz_name": "UTC-03",
        "_realtime": {"real_power": "0", "today_eq": "18457.0"},
    }
    u = adapter._normalizar_usina(usina_raw)
    assert u.potencia_kw == Decimal("0")  # antes do hook

    inversores = [
        adapter._normalizar_inversor(
            {"id": i, "sn": f"SN{i}", "warn_data": {"connect": True}},
            "12824900",
            {i: {"pac_kw": p}},
        )
        for i, p in enumerate([1.453, 0.413, 0.025], start=1)
    ]
    adapter.recalibrar_usinas([u], {"12824900": inversores})

    assert u.potencia_kw == Decimal("1.891")
    assert u.raw["_potencia_recalibrada_de_inversores"] is True


def test_recalibrar_usinas_skipa_quando_micros_sem_pac(adapter):
    """Se todos os micros têm pac_kw=None, mantém o valor original do
    agregador (não inventa zero)."""
    usina_raw = {
        "id": 1,
        "name": "x",
        "status": 40,
        "_realtime": {"real_power": "5000"},
    }
    u = adapter._normalizar_usina(usina_raw)
    inv = adapter._normalizar_inversor(
        {"id": 1, "sn": "SN", "warn_data": {"connect": True}}, "1", {}
    )
    assert inv.pac_kw is None
    adapter.recalibrar_usinas([u], {"1": [inv]})
    assert u.potencia_kw == Decimal("5")  # original preservado
    assert "_potencia_recalibrada_de_inversores" not in u.raw


def test_recalibrar_usinas_sem_inversores_no_dict_skipa(adapter):
    """Usina sem entrada no dict de inversores (provedor não expõe ou
    coleta de inversores falhou) — mantém o valor original."""
    usina_raw = {
        "id": 1,
        "name": "x",
        "status": 40,
        "_realtime": {"real_power": "3000"},
    }
    u = adapter._normalizar_usina(usina_raw)
    adapter.recalibrar_usinas([u], {})
    assert u.potencia_kw == Decimal("3")
