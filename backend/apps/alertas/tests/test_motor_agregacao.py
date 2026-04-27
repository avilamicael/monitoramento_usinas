"""Testes da agregação por usina no motor de alertas.

Quando uma `RegraInversor` declara `agregar_por_usina = True`, o motor
deve:

1. Quando 2+ inversores da mesma usina disparam → 1 alerta com
   `inversor=NULL`, `qtd_inversores_afetados=N`, lista no contexto.
2. Quando todos os inversores voltam ao normal → o alerta agregado é
   resolvido (estado=resolvido).
3. Severidade do alerta agregado = max das severidades das anomalias
   individuais.
4. Comportamento de regras NÃO-agregadoras fica intacto (1 alerta por
   inversor).
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest

from apps.alertas.models import Alerta, EstadoAlerta, SeveridadeAlerta
from apps.alertas.motor import avaliar_empresa
from apps.alertas.regras.base import Anomalia, RegraInversor
from apps.inversores.models import Inversor
from apps.monitoramento.models import LeituraInversor, StatusLeitura
from apps.usinas.models import Usina


def _coletado_em():
    """Timestamp aware estável (granularidade de 10min) usado nas leituras."""
    agora = datetime.now(tz=UTC).replace(second=0, microsecond=0)
    minuto = (agora.minute // 10) * 10
    return agora.replace(minute=minuto)


@pytest.fixture
def usina_com_inversores(db, empresa, conta_provedor):
    """Cria uma usina com 3 inversores ativos + garantia ativa."""
    from datetime import date

    from apps.garantia.models import Garantia

    u = Usina.objects.create(
        empresa=empresa,
        conta_provedor=conta_provedor,
        id_externo="agg-usina-1",
        nome="Usina Agregação",
        capacidade_kwp=Decimal("100.000"),
        expoe_dados_inversor=True,
    )
    Garantia.objects.create(
        empresa=empresa,
        usina=u,
        inicio_em=date.today() - timedelta(days=30),
        meses=24,
    )
    inversores = [
        Inversor.objects.create(
            empresa=empresa,
            usina=u,
            id_externo=f"inv-agg-{i}",
            numero_serie=f"SN-AGG-{i}",
        )
        for i in range(3)
    ]
    return u, inversores


def _criar_leitura_inversor_com_sobretensao(inversor, *, tensao_ac):
    """Cria uma leitura de inversor com sobretensão para `sobretensao_ac`."""
    return LeituraInversor.objects.create(
        empresa=inversor.empresa,
        usina=inversor.usina,
        inversor=inversor,
        coletado_em=_coletado_em(),
        medido_em=datetime.now(tz=UTC),
        estado=StatusLeitura.ONLINE,
        pac_kw=Decimal("5.000"),
        tensao_ac_v=Decimal(str(tensao_ac)),
    )


@pytest.mark.django_db
def test_sobretensao_em_3_inversores_vira_um_alerta_agregado(
    empresa, config, usina_com_inversores, monkeypatch
):
    """3 inversores em sobretensão na mesma usina → 1 alerta agregado."""
    usina, inversores = usina_com_inversores
    # Todos os 3 inversores acima do limite default 220V * 1.10 = 242V.
    for inv in inversores:
        _criar_leitura_inversor_com_sobretensao(inv, tensao_ac=Decimal("250.0"))

    avaliar_empresa(empresa.id)

    abertos = list(
        Alerta.objects.filter(
            usina=usina, regra="sobretensao_ac", estado=EstadoAlerta.ABERTO
        )
    )
    # 1 alerta agregado, sem inversor.
    assert len(abertos) == 1
    alerta = abertos[0]
    assert alerta.inversor_id is None
    assert alerta.contexto.get("agregado") is True
    assert alerta.contexto["qtd_inversores_afetados"] == 3
    assert alerta.contexto["total_inversores_da_usina"] == 3
    sns = {item["numero_serie"] for item in alerta.contexto["inversores"]}
    assert sns == {"SN-AGG-0", "SN-AGG-1", "SN-AGG-2"}
    # Severidade nova é AVISO (mudança 2026-04-27 — sobretensão é problema
    # de rede, não derruba sistema).
    assert alerta.severidade == SeveridadeAlerta.AVISO


@pytest.mark.django_db
def test_resolucao_quando_todos_inversores_voltam_ao_normal(
    empresa, config, usina_com_inversores
):
    """Após 1 ciclo com anomalia, próximo ciclo com tensão OK resolve agregado."""
    usina, inversores = usina_com_inversores

    # Ciclo 1: 2 inversores em sobretensão → cria alerta agregado.
    for inv in inversores[:2]:
        _criar_leitura_inversor_com_sobretensao(inv, tensao_ac=Decimal("250.0"))
    # 3º inversor com tensão OK no ciclo 1.
    _criar_leitura_inversor_com_sobretensao(
        inversores[2], tensao_ac=Decimal("220.0")
    )

    avaliar_empresa(empresa.id)
    assert Alerta.objects.filter(
        usina=usina, regra="sobretensao_ac", estado=EstadoAlerta.ABERTO
    ).count() == 1

    # Ciclo 2: todos com tensão dentro do limite (cria leituras novas).
    coletado_2 = _coletado_em() + timedelta(minutes=10)
    for inv in inversores:
        LeituraInversor.objects.create(
            empresa=inv.empresa,
            usina=inv.usina,
            inversor=inv,
            coletado_em=coletado_2,
            medido_em=datetime.now(tz=UTC),
            estado=StatusLeitura.ONLINE,
            pac_kw=Decimal("5.000"),
            tensao_ac_v=Decimal("220.0"),
        )

    avaliar_empresa(empresa.id)

    # Alerta agregado deve estar resolvido.
    assert Alerta.objects.filter(
        usina=usina, regra="sobretensao_ac", estado=EstadoAlerta.ABERTO
    ).count() == 0
    assert Alerta.objects.filter(
        usina=usina, regra="sobretensao_ac", estado=EstadoAlerta.RESOLVIDO
    ).count() == 1


@pytest.mark.django_db
def test_severidade_agregada_eh_o_maximo(
    empresa, config, usina_com_inversores, monkeypatch
):
    """Mesma regra com severidades diferentes nos inversores → max."""
    from apps.alertas.regras import base as regras_base

    usina, inversores = usina_com_inversores

    # Cria leituras pra todos terem leitura no banco (necessário pro motor
    # passar pelos inversores).
    for inv in inversores:
        _criar_leitura_inversor_com_sobretensao(inv, tensao_ac=Decimal("245.0"))

    # Dummy regra agregadora retornando severidades diferentes por inversor.
    class _Dummy(RegraInversor):
        nome = "_dummy_severidade"
        severidade_padrao = SeveridadeAlerta.AVISO
        agregar_por_usina = True

        def avaliar(self, inversor, leitura, config):
            if inversor.numero_serie == "SN-AGG-0":
                return Anomalia(SeveridadeAlerta.INFO, "info")
            if inversor.numero_serie == "SN-AGG-1":
                return Anomalia(SeveridadeAlerta.AVISO, "aviso")
            return Anomalia(SeveridadeAlerta.CRITICO, "critico")

    # Registra dummy + faz `avaliar_empresa` enxergar só ele.
    monkeypatch.setitem(regras_base._REGISTRO, _Dummy.nome, _Dummy)
    from apps.alertas import motor as motor_mod
    monkeypatch.setattr(motor_mod, "regras_registradas", lambda: [_Dummy])

    avaliar_empresa(empresa.id)

    alerta = Alerta.objects.get(
        usina=usina, regra="_dummy_severidade", estado=EstadoAlerta.ABERTO
    )
    assert alerta.severidade == SeveridadeAlerta.CRITICO
    assert alerta.contexto["qtd_inversores_afetados"] == 3


@pytest.mark.django_db
def test_regra_nao_agregadora_continua_um_alerta_por_inversor(
    empresa, config, usina_com_inversores, monkeypatch
):
    """Regra com `agregar_por_usina=False` mantém 1 alerta por inversor."""
    from apps.alertas.regras import base as regras_base

    usina, inversores = usina_com_inversores

    for inv in inversores:
        _criar_leitura_inversor_com_sobretensao(inv, tensao_ac=Decimal("245.0"))

    class _DummyNaoAgrega(RegraInversor):
        nome = "_dummy_nao_agrega"
        severidade_padrao = SeveridadeAlerta.AVISO
        agregar_por_usina = False

        def avaliar(self, inversor, leitura, config):
            return Anomalia(SeveridadeAlerta.AVISO, f"problema {inversor.numero_serie}")

    monkeypatch.setitem(regras_base._REGISTRO, _DummyNaoAgrega.nome, _DummyNaoAgrega)
    from apps.alertas import motor as motor_mod
    monkeypatch.setattr(motor_mod, "regras_registradas", lambda: [_DummyNaoAgrega])

    avaliar_empresa(empresa.id)

    abertos = list(
        Alerta.objects.filter(
            usina=usina, regra="_dummy_nao_agrega", estado=EstadoAlerta.ABERTO
        )
    )
    assert len(abertos) == 3
    assert all(a.inversor_id is not None for a in abertos)


@pytest.mark.django_db
def test_apenas_alguns_inversores_com_anomalia_agrega_subset(
    empresa, config, usina_com_inversores
):
    """Apenas 2 de 3 inversores com sobretensão → contexto reflete subset."""
    usina, inversores = usina_com_inversores

    _criar_leitura_inversor_com_sobretensao(inversores[0], tensao_ac=Decimal("250.0"))
    _criar_leitura_inversor_com_sobretensao(inversores[1], tensao_ac=Decimal("245.0"))
    _criar_leitura_inversor_com_sobretensao(inversores[2], tensao_ac=Decimal("220.0"))

    avaliar_empresa(empresa.id)

    alerta = Alerta.objects.get(
        usina=usina, regra="sobretensao_ac", estado=EstadoAlerta.ABERTO
    )
    assert alerta.inversor_id is None
    assert alerta.contexto["qtd_inversores_afetados"] == 2
    assert alerta.contexto["total_inversores_da_usina"] == 3
    sns = {item["numero_serie"] for item in alerta.contexto["inversores"]}
    assert sns == {"SN-AGG-0", "SN-AGG-1"}
