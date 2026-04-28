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

def test_inversor_monofasico_unica_fase_ativa(adapter):
    """Apenas `a_u` é fase ativa (b_u/c_u zerados) e nenhuma linha ativa →
    monofásico real (rede 127V fase-neutro), canônico = a fase ativa.

    Convenção: sem linha ativa, classificamos pelo número de fases-neutro.
    """
    r = {
        "id": 1,
        "_kpi": {
            "run_state": 1,
            "active_power": 0.5,
            "a_u": 127, "b_u": 0, "c_u": 0,
            "ab_u": 0, "bc_u": 0, "ca_u": 0,
            "a_i": 3.5,
        },
    }
    i = adapter._normalizar_inversor(r, "X")
    assert i.tipo_ligacao == "monofasico"
    assert i.tensao_ac_v == Decimal("127")
    assert i.eletrica_ac is not None
    assert i.eletrica_ac["fases_neutro"]["a"] == Decimal("127")
    assert i.eletrica_ac["correntes"]["a"] == Decimal("3.5")


def test_inversor_monofasico_sem_linhas_no_payload(adapter):
    """Monofásico real puro: `a_u=127`, `b_u/c_u/ab_u/bc_u/ca_u` AUSENTES do
    payload. `a_n=1`, `l_n=0` → monofásico, canônico = a_u.
    """
    r = {
        "id": 10,
        "_kpi": {
            "run_state": 1,
            "active_power": 0.5,
            "a_u": 127,
            "a_i": 3.5,
        },
    }
    i = adapter._normalizar_inversor(r, "X")
    assert i.tipo_ligacao == "monofasico"
    assert i.tensao_ac_v == Decimal("127")
    assert i.eletrica_ac is not None
    assert i.eletrica_ac["fases_neutro"]["a"] == Decimal("127")
    # b/c e linhas ausentes não devem aparecer no detalhe.
    assert "b" not in i.eletrica_ac["fases_neutro"]
    assert "c" not in i.eletrica_ac["fases_neutro"]
    assert "linhas" not in i.eletrica_ac


def test_inversor_bifasico_duas_fases_ativas_canonico_e_linha(adapter):
    """Cenário do bug real: rede 220V br entre 2 fases vivas (sem neutro útil).

    `a_u=115, b_u=112, c_u=0, ab_u=228`. Heurística antiga classificava como
    trifásico e retornava `a_u=115` → falso positivo de subtensao_ac.
    Heurística nova classifica como bifásico e usa a tensão de linha (`ab_u`).
    """
    r = {
        "id": 2,
        "_kpi": {
            "run_state": 1,
            "active_power": 1.2,
            "a_u": 115, "b_u": 112, "c_u": 0,
            "ab_u": 228, "bc_u": 0, "ca_u": 0,
            "a_i": 15.93,
        },
    }
    i = adapter._normalizar_inversor(r, "X")
    assert i.tipo_ligacao == "bifasico"
    assert i.tensao_ac_v == Decimal("228")
    assert i.eletrica_ac is not None
    assert i.eletrica_ac["fases_neutro"]["a"] == Decimal("115")
    assert i.eletrica_ac["fases_neutro"]["b"] == Decimal("112")
    assert i.eletrica_ac["linhas"]["ab"] == Decimal("228")


def test_inversor_trifasico_tres_fases_ativas_canonico_a_u(adapter):
    """Rede 380/220Y: `a_u`, `b_u`, `c_u` ≈ 220V cada (fase-neutro)."""
    r = {
        "id": 3,
        "_kpi": {
            "run_state": 1,
            "active_power": 5.0,
            "a_u": 220, "b_u": 221, "c_u": 219,
            "ab_u": 380, "bc_u": 381, "ca_u": 379,
            "a_i": 7.6, "b_i": 7.7, "c_i": 7.5,
            "power_factor": 1.0,
            "reactive_power": -0.001,
        },
    }
    i = adapter._normalizar_inversor(r, "X")
    assert i.tipo_ligacao == "trifasico"
    assert i.tensao_ac_v == Decimal("220")
    assert i.eletrica_ac is not None
    assert i.eletrica_ac["fases_neutro"]["a"] == Decimal("220")
    assert i.eletrica_ac["fases_neutro"]["b"] == Decimal("221")
    assert i.eletrica_ac["fases_neutro"]["c"] == Decimal("219")
    assert i.eletrica_ac["linhas"]["ab"] == Decimal("380")
    assert i.eletrica_ac["correntes"]["a"] == Decimal("7.6")
    assert i.eletrica_ac["fator_potencia"] == Decimal("1.0")
    assert i.eletrica_ac["potencia_reativa_kvar"] == Decimal("-0.001")


def test_inversor_kpi_vazio_nao_classifica(adapter):
    """Sem `_kpi` (provedor não retornou nada) → tudo None, sem regredir."""
    r = {"id": 4, "_kpi": {}}
    i = adapter._normalizar_inversor(r, "X")
    assert i.tipo_ligacao is None
    assert i.eletrica_ac is None
    assert i.tensao_ac_v is None


def test_inversor_bifasico_degenerado_duas_fases_sem_linha(adapter):
    """Caso raro/degenerado: 2 fases-neutro ativas, NENHUMA linha ativa.

    `a_n=2, l_n=0` → bifásico (provedor reportou 2 fase-neutro vivas), mas
    sem tensão de linha confiável → canônico = None. Regras elétricas devem
    pular (não avaliar) já que `tensao_ac_v` é null.
    """
    r = {
        "id": 5,
        "_kpi": {
            "run_state": 1,
            "active_power": 1.0,
            "a_u": 115, "b_u": 113, "c_u": 0,
            "ab_u": 0, "bc_u": 0, "ca_u": 0,
            "a_i": 4.0,
        },
    }
    i = adapter._normalizar_inversor(r, "X")
    assert i.tipo_ligacao == "bifasico"
    assert i.tensao_ac_v is None
    assert i.eletrica_ac is not None
    assert i.eletrica_ac["fases_neutro"]["a"] == Decimal("115")
    assert i.eletrica_ac["fases_neutro"]["b"] == Decimal("113")


def test_inversor_online_com_eletricos(adapter):
    """run_state=1 + KPIs populados → estado=online + campos preenchidos.

    SUN2000-5KTL-L1 real: reporta `a_u=113.2` com `b_u`/`c_u` AUSENTES do
    payload, mas `ab_u=224.8` populado. Fisicamente é bifásico (rede 220V br
    entre 2 fases vivas) que o inversor expõe como "fase-neutro virtual" +
    linha. A heurística usa a linha como evidência primária → bifásico,
    canônico = ab_u (224.8). Tratar como monofásico de 113V dispararia
    `subtensao_ac` falsa em produção (limite mínimo 190V).
    """
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
    # Linha ativa (ab_u=224.8) é evidência primária → bifásico, canônico=ab_u.
    assert i.tipo_ligacao == "bifasico"
    assert i.tensao_ac_v == Decimal("224.8")
    assert i.eletrica_ac is not None
    assert i.eletrica_ac["fases_neutro"]["a"] == Decimal("113.2")
    assert i.eletrica_ac["linhas"]["ab"] == Decimal("224.8")
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
    assert i.tipo_ligacao is None
    assert i.eletrica_ac is None


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
