"""Testes de normalização do AuxsolAdapter."""
from __future__ import annotations

from decimal import Decimal

import pytest

from apps.provedores.adapters.auxsol.adapter import AuxsolAdapter


@pytest.fixture
def adapter() -> AuxsolAdapter:
    return AuxsolAdapter(
        {"account": "x", "password": "y", "token": "t", "obtido_em": 0}
    )


def test_usina_normalizacao(adapter):
    r = {
        "plantId": "36054",
        "plantName": "WILSON MEDEIROS",
        "capacity": 12.0,
        "currentPower": 6.57,
        "todayYield": 32.74,
        "monthlyYield": 924.38,
        "totalYield": 7030.37,
        "status": "01",
        "address": "Rua João José Martins",
        "timeZone": "-03:00",
        "dt": "2026-04-24 13:55:05",
    }
    u = adapter._normalizar_usina(r)
    assert u.id_externo == "36054"
    assert u.nome == "WILSON MEDEIROS"
    assert u.capacidade_kwp == Decimal("12")
    assert u.potencia_kw == Decimal("6.57")
    assert u.energia_hoje_kwh == Decimal("32.74")
    assert u.energia_mes_kwh == Decimal("924.38")
    assert u.energia_total_kwh == Decimal("7030.37")
    assert u.status == "online"


def test_usina_status_offline(adapter):
    u = adapter._normalizar_usina({"plantId": "1", "plantName": "x", "status": "02"})
    assert u.status == "offline"


def test_inversor_eletricos_completos(adapter):
    inv = {
        "inverterId": "INV1",
        "sn": "ASN-6SL-G2250719002084",
        "model": "ASN-6SL-G2",
        "status": "01",
        "currentPower": 1.48,
        "dayEnergy": 18.06,
        "totalEnergy": 2385.43,
        "timeZone": "-03:00",
        "lastDt": "2026-04-24 13:58:20",
    }
    realtime = {
        "energyData": {
            "power": 1.48,
            "y": 18.06,
            "yt": 2385.43,
            "pvList": [
                {"index": 1, "u": 288.0, "i": 2.33, "p": 671.04},
                {"index": 2, "u": 277.1, "i": 2.6, "p": 720.46},
            ],
        },
        "gridData": {
            "acList": [{"phase": "A", "u": 217.9, "i": 7.1, "f": 59.98}],
        },
        "otherData": {"temperature1": 54.3, "insideTemperature": 54.5},
    }
    i = adapter._normalizar_inversor(inv, "PLANT", realtime)
    assert i.numero_serie == "ASN-6SL-G2250719002084"
    assert i.modelo == "ASN-6SL-G2"
    assert i.pac_kw == Decimal("1.48")
    assert i.tensao_ac_v == Decimal("217.9")
    assert i.corrente_ac_a == Decimal("7.1")
    assert i.frequencia_hz == Decimal("59.98")
    assert i.tensao_dc_v == Decimal("288.0")
    assert i.corrente_dc_a == Decimal("2.33")
    assert i.temperatura_c == Decimal("54.3")

    # 1 fase ativa → monofásico, fase A populada.
    assert i.tipo_ligacao == "monofasico"
    assert i.eletrica_ac is not None
    assert i.eletrica_ac["fases_neutro"]["a"] == Decimal("217.9")
    assert i.eletrica_ac["correntes"]["a"] == Decimal("7.1")
    assert "b" not in i.eletrica_ac["fases_neutro"]
    assert "c" not in i.eletrica_ac["fases_neutro"]

    indices = sorted(s.indice for s in i.strings_mppt)
    assert indices == [1, 2]


def test_inversor_bifasico_duas_fases_ativas(adapter):
    inv = {"inverterId": "1", "sn": "SN", "model": "X", "status": "01"}
    realtime = {
        "gridData": {
            "acList": [
                {"phase": "A", "u": 127.0, "i": 5.0, "f": 60.0},
                {"phase": "B", "u": 126.5, "i": 4.8, "f": 60.0},
            ],
        },
    }
    i = adapter._normalizar_inversor(inv, "X", realtime)
    assert i.tipo_ligacao == "bifasico"
    assert i.eletrica_ac is not None
    assert i.eletrica_ac["fases_neutro"]["a"] == Decimal("127.0")
    assert i.eletrica_ac["fases_neutro"]["b"] == Decimal("126.5")
    assert i.eletrica_ac["correntes"]["a"] == Decimal("5.0")
    assert i.eletrica_ac["correntes"]["b"] == Decimal("4.8")
    # Canônicos saem da primeira fase ativa.
    assert i.tensao_ac_v == Decimal("127.0")
    assert i.corrente_ac_a == Decimal("5.0")
    assert i.frequencia_hz == Decimal("60.0")


def test_inversor_trifasico_tres_fases_ativas(adapter):
    inv = {"inverterId": "1", "sn": "SN", "model": "X", "status": "01"}
    realtime = {
        "gridData": {
            "acList": [
                {"phase": "A", "u": 220.0, "i": 7.6, "f": 60.0},
                {"phase": "B", "u": 221.0, "i": 7.5, "f": 60.0},
                {"phase": "C", "u": 219.0, "i": 7.7, "f": 60.0},
            ],
        },
    }
    i = adapter._normalizar_inversor(inv, "X", realtime)
    assert i.tipo_ligacao == "trifasico"
    assert i.eletrica_ac is not None
    assert i.eletrica_ac["fases_neutro"]["a"] == Decimal("220.0")
    assert i.eletrica_ac["fases_neutro"]["b"] == Decimal("221.0")
    assert i.eletrica_ac["fases_neutro"]["c"] == Decimal("219.0")
    assert i.eletrica_ac["correntes"]["c"] == Decimal("7.7")
    assert i.tensao_ac_v == Decimal("220.0")


def test_inversor_aclist_zerada_nao_classifica(adapter):
    """Inversor desligado/standby reporta `u=0` em todas as fases — não
    classifica e não devolve canônico, mas mantém o detalhe bruto se
    houver corrente (raro)."""
    inv = {"inverterId": "1", "sn": "SN", "model": "X", "status": "02"}
    realtime = {
        "gridData": {
            "acList": [
                {"phase": "A", "u": 0, "i": 0, "f": 0},
                {"phase": "B", "u": 0, "i": 0, "f": 0},
            ],
        },
    }
    i = adapter._normalizar_inversor(inv, "X", realtime)
    assert i.tipo_ligacao is None
    assert i.tensao_ac_v is None
    assert i.corrente_ac_a is None
    assert i.frequencia_hz is None
    # Bruto (u=0/i=0) é preservado: zero é dado válido (≠ ausente).
    assert i.eletrica_ac is not None
    assert i.eletrica_ac["fases_neutro"]["a"] == Decimal("0")


def test_inversor_sem_realtime_usa_list(adapter):
    inv = {
        "inverterId": "INV1", "sn": "SN1", "model": "X",
        "status": "01", "currentPower": 2.0, "dayEnergy": 10, "totalEnergy": 500,
    }
    i = adapter._normalizar_inversor(inv, "PLANT", {})
    assert i.pac_kw == Decimal("2.0")
    assert i.energia_hoje_kwh == Decimal("10")
    assert i.energia_total_kwh == Decimal("500")
    # Sem realtime → todos os elétricos ficam null
    assert i.tensao_ac_v is None
    assert i.corrente_ac_a is None
    assert i.frequencia_hz is None
    assert i.tensao_dc_v is None
    assert i.temperatura_c is None
    assert i.strings_mppt == []
    # Sem acList → não classifica nem inventa eletrica_ac.
    assert i.tipo_ligacao is None
    assert i.eletrica_ac is None


def test_inversor_temperatura_fallback_insidetemperature(adapter):
    inv = {"inverterId": "1", "sn": "SN", "model": "", "status": "01"}
    realtime = {"otherData": {"insideTemperature": 45.2}}
    i = adapter._normalizar_inversor(inv, "X", realtime)
    assert i.temperatura_c == Decimal("45.2")
