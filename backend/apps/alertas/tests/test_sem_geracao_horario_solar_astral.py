"""Testes da regra `sem_geracao_horario_solar` com janela astral.

Cobre:
1. `_janela_astral` aplica buffer de 1h em sunrise/sunset (mock de `sun`).
2. Regra dispara quando lat/lon presentes e janela astral contém o horário atual.
3. Regra cai no fallback fixo quando lat/lon ausentes.
4. Regra retorna `None` quando o horário atual está fora da janela astral.
"""
from __future__ import annotations

from datetime import datetime, time, timedelta
from decimal import Decimal
from unittest import mock

import pytest

from apps.alertas.regras import _helpers
from apps.alertas.regras import sem_geracao_horario_solar as modulo_regra
from apps.alertas.regras.base import Anomalia
from apps.alertas.regras.sem_geracao_horario_solar import SemGeracaoHorarioSolar
from apps.core.models import ConfiguracaoEmpresa
from apps.empresas.models import Empresa
from apps.usinas.models import Usina


@pytest.fixture(autouse=True)
def _limpar_cache_astral():
    """Limpa o cache do helper antes/depois de cada teste — os mocks
    ficariam mascarados se uma chamada anterior tivesse populado a entrada."""
    _helpers._CACHE_JANELA_ASTRAL.clear()
    yield
    _helpers._CACHE_JANELA_ASTRAL.clear()


@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Firma D", slug="firma-d")


@pytest.fixture
def config(db, empresa):
    cfg, _ = ConfiguracaoEmpresa.objects.get_or_create(empresa=empresa)
    return cfg


def _criar_conta(empresa):
    from apps.provedores.models import ContaProvedor, TipoProvedor
    return ContaProvedor.objects.create(
        empresa=empresa,
        tipo=TipoProvedor.SOLIS,
        rotulo="Conta Teste",
        credenciais_enc="x",
    )


def _criar_usina(empresa, *, latitude=None, longitude=None):
    return Usina.objects.create(
        empresa=empresa,
        conta_provedor=_criar_conta(empresa),
        nome="Usina D",
        capacidade_kwp=Decimal("10"),
        latitude=latitude,
        longitude=longitude,
        fuso_horario="America/Sao_Paulo",
    )


def _stub_anterior(modulo, valor):
    """Stub do queryset que busca a leitura anterior dentro da regra.

    A regra faz `LeituraUsina.objects.filter(...).order_by(...).values_list(...).first()`.
    Patcheia o nome `LeituraUsina` no módulo da regra (cujo símbolo já foi
    importado lá no topo) e devolve o context manager.
    """
    return mock.patch.object(
        modulo.LeituraUsina.objects, "filter",
        return_value=mock.Mock(
            **{
                "order_by.return_value.values_list.return_value.first.return_value": valor,
            }
        ),
    )


# ── 1. _janela_astral ────────────────────────────────────────────────────


@pytest.mark.django_db
def test_janela_astral_aplica_buffer_de_uma_hora(empresa):
    """O retorno deve ser sunrise+1h e sunset-1h, com `astral.sun.sun` mockado."""
    usina = _criar_usina(
        empresa, latitude=Decimal("-27.5954"), longitude=Decimal("-48.5480")
    )
    tz = _helpers._resolver_tz(usina)
    hoje = datetime.now(tz=tz).date()

    sunrise = datetime.combine(hoje, time(6, 0), tzinfo=tz)
    sunset = datetime.combine(hoje, time(18, 0), tzinfo=tz)

    with mock.patch.object(
        _helpers, "sun", return_value={"sunrise": sunrise, "sunset": sunset}
    ):
        janela = _helpers._janela_astral(usina, hoje)

    assert janela is not None
    inicio, fim = janela
    assert inicio == time(7, 0)
    assert fim == time(17, 0)


# ── 2. Regra com lat/lon (janela astral) ─────────────────────────────────


@pytest.mark.django_db
def test_regra_dispara_em_horario_solar_com_janela_astral(empresa, config):
    """Janela astral mockada pra conter o horário atual; potência atual = 0
    e anterior alta → queda abrupta → Anomalia com `janela_origem='astral'`."""
    usina = _criar_usina(
        empresa, latitude=Decimal("-27.6"), longitude=Decimal("-48.5")
    )

    tz = _helpers._resolver_tz(usina)
    agora = datetime.now(tz=tz).time()
    janela = (
        (datetime.combine(datetime.today(), agora) - timedelta(hours=2)).time(),
        (datetime.combine(datetime.today(), agora) + timedelta(hours=2)).time(),
    )

    leitura = mock.Mock()
    leitura.potencia_kw = Decimal("0")
    leitura.coletado_em = datetime.now(tz=tz)
    leitura.pk = None

    # Patch nos dois bindings de `_janela_astral`: dentro de `_helpers`
    # (usado por `em_horario_solar`) e dentro da regra (usado pra montar
    # mensagem/contexto).
    with mock.patch.object(_helpers, "_janela_astral", return_value=janela), \
         mock.patch.object(modulo_regra, "_janela_astral", return_value=janela), \
         _stub_anterior(modulo_regra, Decimal("8")):
        resultado = SemGeracaoHorarioSolar().avaliar(usina, leitura, config)

    assert isinstance(resultado, Anomalia)
    assert resultado.contexto["janela_origem"] == "astral"


# ── 3. Fallback para janela fixa quando lat/lon ausente ──────────────────


@pytest.mark.django_db
def test_regra_usa_janela_fixa_quando_sem_lat_lon(empresa, config):
    """Sem latitude/longitude, a regra usa `ConfiguracaoEmpresa.horario_solar_*`."""
    usina = _criar_usina(empresa, latitude=None, longitude=None)
    tz = _helpers._resolver_tz(usina)

    agora = datetime.now(tz=tz).time()
    config.horario_solar_inicio = (
        datetime.combine(datetime.today(), agora) - timedelta(hours=2)
    ).time()
    config.horario_solar_fim = (
        datetime.combine(datetime.today(), agora) + timedelta(hours=2)
    ).time()
    config.save()

    leitura = mock.Mock()
    leitura.potencia_kw = Decimal("0")
    leitura.coletado_em = datetime.now(tz=tz)
    leitura.pk = None

    with _stub_anterior(modulo_regra, Decimal("9")):
        resultado = SemGeracaoHorarioSolar().avaliar(usina, leitura, config)

    assert isinstance(resultado, Anomalia)
    assert resultado.contexto["janela_origem"] == "fixa"


# ── 4. Regra inaplicável fora da janela astral ───────────────────────────


@pytest.mark.django_db
def test_regra_nao_dispara_fora_da_janela_astral(empresa, config):
    """Janela astral mockada pra um intervalo passado/curto que NÃO contém
    o horário atual → `em_horario_solar` False → regra retorna `None`."""
    usina = _criar_usina(
        empresa, latitude=Decimal("-27.6"), longitude=Decimal("-48.5")
    )
    janela_passada = (time(0, 0), time(0, 1))

    leitura = mock.Mock()
    leitura.potencia_kw = Decimal("0")
    leitura.coletado_em = datetime.now(tz=_helpers._resolver_tz(usina))
    leitura.pk = None

    with mock.patch.object(_helpers, "_janela_astral", return_value=janela_passada):
        resultado = SemGeracaoHorarioSolar().avaliar(usina, leitura, config)

    assert resultado is None
