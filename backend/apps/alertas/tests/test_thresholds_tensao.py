"""Testes dos helpers de threshold de tensão e das regras subtensao_ac/sobretensao_ac.

Cobre:

- `threshold_subtensao_v` / `threshold_sobretensao_v` derivam dos nominais
  efetivos quando os campos de override estão no default.
- Override manual (não-default) é respeitado.
- A regra `subtensao_ac` em uma usina 110 V (rede 127 V) **não** dispara para
  inversores reportando 120 V — comportamento desejado da feature.
- A regra ainda dispara para 100 V em rede 110 V e 180 V em rede 220 V.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from apps.alertas.regras._helpers import (
    threshold_sobretensao_v,
    threshold_subtensao_v,
)
from apps.alertas.regras.sobretensao_ac import SobretensaoAc
from apps.alertas.regras.subtensao_ac import SubtensaoAc
from apps.empresas.models import Empresa
from apps.inversores.models import Inversor
from apps.provedores.models import ContaProvedor, TipoProvedor
from apps.usinas.models import TensaoNominalV, Usina


@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Empresa Teste", slug="empresa-teste")


@pytest.fixture
def conta_provedor(empresa):
    return ContaProvedor.objects.create(
        empresa=empresa,
        tipo=TipoProvedor.FUSIONSOLAR,
        rotulo="Conta de Teste",
        credenciais_enc="dummy",
    )


@pytest.fixture
def usina_220v(empresa, conta_provedor):
    return Usina.objects.create(
        empresa=empresa,
        conta_provedor=conta_provedor,
        nome="Usina 220V",
        capacidade_kwp=Decimal("10.000"),
        tensao_nominal_v=TensaoNominalV.V220,
    )


@pytest.fixture
def usina_110v(empresa, conta_provedor):
    return Usina.objects.create(
        empresa=empresa,
        conta_provedor=conta_provedor,
        nome="Usina 110V",
        capacidade_kwp=Decimal("10.000"),
        tensao_nominal_v=TensaoNominalV.V110,
    )


@pytest.fixture
def inversor_220v(empresa, usina_220v):
    return Inversor.objects.create(
        empresa=empresa,
        usina=usina_220v,
        id_externo="INV-220",
        numero_serie="SN-220",
    )


@pytest.fixture
def inversor_110v(empresa, usina_110v):
    return Inversor.objects.create(
        empresa=empresa,
        usina=usina_110v,
        id_externo="INV-110",
        numero_serie="SN-110",
    )


@pytest.fixture
def config(empresa):
    """Configuração mínima da empresa, com defaults reais."""
    from apps.core.models import ConfiguracaoEmpresa

    cfg, _ = ConfiguracaoEmpresa.objects.get_or_create(empresa=empresa)
    return cfg


class _LeituraFake:
    """Stand-in para LeituraInversor — evita criar leitura real (que exige
    `coletado_em` arredondado e `usina`/`empresa` consistentes)."""

    def __init__(self, *, tensao_ac_v=None, pac_kw=None, medido_em=None):
        self.tensao_ac_v = tensao_ac_v
        self.pac_kw = pac_kw
        self.medido_em = medido_em or datetime.now(tz=timezone.utc)
        self.pk = None


# ─── threshold_subtensao_v ────────────────────────────────────────────────


@pytest.mark.django_db
def test_threshold_subtensao_220v_usa_91_por_cento(usina_220v):
    # 220 × 0.91 = 200.2
    assert threshold_subtensao_v(usina_220v) == Decimal("200.2")


@pytest.mark.django_db
def test_threshold_subtensao_110v_adota_127v_efetivo(usina_110v):
    # 127 × 0.91 = 115.57 → arredondado para 115.6 (1 casa decimal)
    assert threshold_subtensao_v(usina_110v) == Decimal("115.6")


@pytest.mark.django_db
def test_threshold_subtensao_respeita_override_manual(usina_220v):
    usina_220v.tensao_ac_limite_minimo_v = Decimal("200.0")
    usina_220v.save()
    assert threshold_subtensao_v(usina_220v) == Decimal("200.0")


# ─── threshold_sobretensao_v ──────────────────────────────────────────────


@pytest.mark.django_db
def test_threshold_sobretensao_220v_usa_110_por_cento(usina_220v):
    # 220 × 1.10 = 242.0
    assert threshold_sobretensao_v(usina_220v) == Decimal("242.0")


@pytest.mark.django_db
def test_threshold_sobretensao_110v_adota_127v_efetivo(usina_110v):
    # 127 × 1.10 = 139.7
    assert threshold_sobretensao_v(usina_110v) == Decimal("139.7")


@pytest.mark.django_db
def test_threshold_sobretensao_respeita_override_manual(usina_220v):
    usina_220v.tensao_ac_limite_v = Decimal("260.0")
    usina_220v.save()
    assert threshold_sobretensao_v(usina_220v) == Decimal("260.0")


# ─── Regra subtensao_ac ───────────────────────────────────────────────────


@pytest.mark.django_db
def test_subtensao_220v_120v_dispara_alerta(inversor_220v, config):
    """Em rede 220 V, 120 V é claramente subtensão."""
    leitura = _LeituraFake(tensao_ac_v=Decimal("120.0"), pac_kw=Decimal("5.0"))
    resultado = SubtensaoAc().avaliar(inversor_220v, leitura, config)
    assert getattr(resultado, "severidade", None) is not None


@pytest.mark.django_db
def test_subtensao_110v_120v_NAO_dispara_alerta(inversor_110v, config):
    """Caso central da feature: em rede 127V, 120V é normal — limite é ~108V."""
    leitura = _LeituraFake(tensao_ac_v=Decimal("120.0"), pac_kw=Decimal("5.0"))
    resultado = SubtensaoAc().avaliar(inversor_110v, leitura, config)
    assert resultado is False


@pytest.mark.django_db
def test_subtensao_110v_100v_dispara_alerta(inversor_110v, config):
    """Em rede 127 V, 100 V está abaixo do limite (108 V) — dispara."""
    leitura = _LeituraFake(tensao_ac_v=Decimal("100.0"), pac_kw=Decimal("5.0"))
    resultado = SubtensaoAc().avaliar(inversor_110v, leitura, config)
    assert getattr(resultado, "severidade", None) is not None


@pytest.mark.django_db
def test_subtensao_guard_potencia_minima(inversor_220v, config):
    """Standby (pac_kw=0) com tensão 0V não vira alerta — retorna False."""
    leitura = _LeituraFake(tensao_ac_v=Decimal("0.0"), pac_kw=Decimal("0.0"))
    resultado = SubtensaoAc().avaliar(inversor_220v, leitura, config)
    assert resultado is False


@pytest.mark.django_db
def test_subtensao_tensao_ausente_retorna_none(inversor_220v, config):
    leitura = _LeituraFake(tensao_ac_v=None, pac_kw=Decimal("5.0"))
    resultado = SubtensaoAc().avaliar(inversor_220v, leitura, config)
    assert resultado is None


# ─── Regra sobretensao_ac ─────────────────────────────────────────────────


@pytest.mark.django_db
def test_sobretensao_220v_245v_dispara(inversor_220v, config):
    """Em rede 220 V, 245 V > 242 V (limite) — dispara crítico."""
    leitura = _LeituraFake(tensao_ac_v=Decimal("245.0"), pac_kw=Decimal("5.0"))
    resultado = SobretensaoAc().avaliar(inversor_220v, leitura, config)
    assert getattr(resultado, "severidade", None) is not None


@pytest.mark.django_db
def test_sobretensao_110v_135v_NAO_dispara(inversor_110v, config):
    """Em rede 127 V, 135 V está abaixo do limite (139.7 V) — não dispara."""
    leitura = _LeituraFake(tensao_ac_v=Decimal("135.0"), pac_kw=Decimal("5.0"))
    resultado = SobretensaoAc().avaliar(inversor_110v, leitura, config)
    assert resultado is False


@pytest.mark.django_db
def test_sobretensao_110v_145v_dispara(inversor_110v, config):
    """Em rede 127 V, 145 V > 139.7 V — dispara crítico."""
    leitura = _LeituraFake(tensao_ac_v=Decimal("145.0"), pac_kw=Decimal("5.0"))
    resultado = SobretensaoAc().avaliar(inversor_110v, leitura, config)
    assert getattr(resultado, "severidade", None) is not None
