"""Testes de F1/C2 — motor consulta `ConfiguracaoRegra`.

Cobre 4 cenários:

1. Sem override → comportamento atual (severidade do `severidade_padrao`).
2. Override `ativa=False` → regra não dispara mesmo com leitura anômala E
   alerta aberto pré-existente fica congelado (NÃO é fechado por silêncio).
3. Override de severidade → próximo alerta criado/atualizado usa a nova.
4. Regra dinâmica + override de severidade → motor IGNORA override (mantém
   severidade decidida pela regra), mas respeita `ativa`.

Padrão dos testes: regra dummy registrada via `monkeypatch` em `_REGISTRO`
+ `regras_registradas` substituída no módulo motor (ver
`test_motor_agregacao.py`). Mantém os testes isolados das 12 regras reais.
"""
from __future__ import annotations

import pytest

from apps.alertas.models import (
    Alerta,
    ConfiguracaoRegra,
    EstadoAlerta,
    SeveridadeAlerta,
)
from apps.alertas.motor import avaliar_empresa
from apps.alertas.regras import base as regras_base
from apps.alertas.regras.base import Anomalia, RegraUsina


def _registrar_dummy(monkeypatch, *, severidade_dinamica: bool):
    """Registra uma `RegraUsina` dummy que sempre dispara `Anomalia` aviso.

    Substitui `regras_registradas` no módulo motor para enxergar SOMENTE
    essa regra — isolando o teste das 12 regras reais.
    """
    class _Dummy(RegraUsina):
        nome = "_dummy_cfg"
        severidade_padrao = SeveridadeAlerta.AVISO

        def avaliar(self, usina, leitura, config):
            return Anomalia(
                severidade=SeveridadeAlerta.AVISO,
                mensagem="dummy disparou",
                contexto={"v": 1},
            )

    _Dummy.severidade_dinamica = severidade_dinamica

    monkeypatch.setitem(regras_base._REGISTRO, _Dummy.nome, _Dummy)
    from apps.alertas import motor as motor_mod
    monkeypatch.setattr(motor_mod, "regras_registradas", lambda: [_Dummy])
    return _Dummy


@pytest.mark.django_db
def test_sem_override_usa_severidade_padrao(empresa, config, usina, monkeypatch):
    """Sem ConfiguracaoRegra → severidade vem do `severidade_padrao`."""
    _registrar_dummy(monkeypatch, severidade_dinamica=False)

    avaliar_empresa(empresa.id)

    alerta = Alerta.objects.get(
        usina=usina, regra="_dummy_cfg", estado=EstadoAlerta.ABERTO,
    )
    assert alerta.severidade == SeveridadeAlerta.AVISO
    assert alerta.mensagem == "dummy disparou"


@pytest.mark.django_db
def test_override_ativa_false_pula_regra_e_congela_aberto(
    empresa, config, usina, monkeypatch
):
    """Override `ativa=False` → motor pula a regra e NÃO fecha alerta aberto.

    Bug famoso a evitar: alerta pré-existente sumir só porque o admin
    desativou a regra. Operador resolve manualmente; auditoria preserva.
    """
    _registrar_dummy(monkeypatch, severidade_dinamica=False)

    # Pré-existente: alerta aberto criado em ciclo anterior.
    aberto = Alerta.objects.create(
        empresa=empresa,
        usina=usina,
        regra="_dummy_cfg",
        severidade=SeveridadeAlerta.AVISO,
        mensagem="aberto antigo",
    )

    # Admin desativa a regra para a empresa.
    ConfiguracaoRegra.objects.create(
        empresa=empresa,
        regra_nome="_dummy_cfg",
        ativa=False,
        severidade=SeveridadeAlerta.AVISO,
    )

    avaliar_empresa(empresa.id)

    aberto.refresh_from_db()
    # Continua aberto, congelado — motor nem avaliou a regra.
    assert aberto.estado == EstadoAlerta.ABERTO
    assert aberto.resolvido_em is None
    # Nenhum alerta novo foi criado (1 só, o pré-existente).
    assert Alerta.objects.filter(usina=usina, regra="_dummy_cfg").count() == 1


@pytest.mark.django_db
def test_override_severidade_sobrescreve_anomalia(
    empresa, config, usina, monkeypatch
):
    """Override de severidade → próximo alerta criado usa a nova severidade.

    A regra dummy retorna AVISO; com override `critico`, o motor reescreve
    antes de salvar. Ciclo seguinte (mesma anomalia) atualiza in-place.
    """
    _registrar_dummy(monkeypatch, severidade_dinamica=False)

    ConfiguracaoRegra.objects.create(
        empresa=empresa,
        regra_nome="_dummy_cfg",
        ativa=True,
        severidade=SeveridadeAlerta.CRITICO,
    )

    avaliar_empresa(empresa.id)

    alerta = Alerta.objects.get(
        usina=usina, regra="_dummy_cfg", estado=EstadoAlerta.ABERTO,
    )
    assert alerta.severidade == SeveridadeAlerta.CRITICO
    # Mensagem e contexto preservados — só a severidade muda.
    assert alerta.mensagem == "dummy disparou"
    assert alerta.contexto == {"v": 1}

    # Ciclo 2: troca o override para INFO, motor atualiza in-place
    # (motor já tem a lógica "Anomalia + há aberto → atualiza severidade").
    ConfiguracaoRegra.objects.filter(
        empresa=empresa, regra_nome="_dummy_cfg",
    ).update(severidade=SeveridadeAlerta.INFO)

    avaliar_empresa(empresa.id)

    alerta.refresh_from_db()
    assert alerta.severidade == SeveridadeAlerta.INFO
    assert alerta.estado == EstadoAlerta.ABERTO


@pytest.mark.django_db
def test_regra_dinamica_ignora_override_de_severidade(
    empresa, config, usina, monkeypatch
):
    """Regra com `severidade_dinamica=True` ignora override de severidade.

    O override existe (`ativa=True`, severidade=info) mas o motor passa
    a Anomalia da regra intacta — quem decide a severidade é a regra.
    `ativa` continua sendo respeitado (verificado em outro teste).
    """
    _registrar_dummy(monkeypatch, severidade_dinamica=True)

    ConfiguracaoRegra.objects.create(
        empresa=empresa,
        regra_nome="_dummy_cfg",
        ativa=True,
        severidade=SeveridadeAlerta.INFO,  # tentativa de rebaixar
    )

    avaliar_empresa(empresa.id)

    alerta = Alerta.objects.get(
        usina=usina, regra="_dummy_cfg", estado=EstadoAlerta.ABERTO,
    )
    # Severidade veio da regra (AVISO), NÃO do override (INFO).
    assert alerta.severidade == SeveridadeAlerta.AVISO


@pytest.mark.django_db
def test_regra_dinamica_respeita_ativa_false(
    empresa, config, usina, monkeypatch
):
    """Regra dinâmica com `ativa=False` é pulada como qualquer outra."""
    _registrar_dummy(monkeypatch, severidade_dinamica=True)

    ConfiguracaoRegra.objects.create(
        empresa=empresa,
        regra_nome="_dummy_cfg",
        ativa=False,
        severidade=SeveridadeAlerta.AVISO,
    )

    avaliar_empresa(empresa.id)

    assert not Alerta.objects.filter(
        usina=usina, regra="_dummy_cfg",
    ).exists()
