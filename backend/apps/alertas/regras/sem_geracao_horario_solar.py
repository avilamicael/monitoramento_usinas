"""Regra `sem_geracao_horario_solar`.

A regra mais importante do sistema na visão do produto: se o sol está
disponível e a usina reporta potência ≈ 0 **abruptamente**, alguma coisa
está errada — **crítico**.

Cobre: Wi-Fi caiu durante o dia e o provedor continua reportando o último
valor (zero), inversor desligado em pleno meio-dia, disjuntor aberto, falha
de string total, etc.

Janela solar — astral por usina, fallback configurável
------------------------------------------------------
Quando `usina.latitude` e `usina.longitude` estão preenchidos, a janela
é calculada via biblioteca `astral`: `(sunrise + 1h, sunset - 1h)` no fuso
local da usina. Em SC no inverno, isso fica em torno de 07:30→17:00; no
verão, 06:30→19:30. O buffer de 1h evita borda de baixa luz/sombra natural.

Sem lat/lon, fallback para `ConfiguracaoEmpresa.horario_solar_inicio/_fim`
(default 08:00–18:00). Use o endpoint `POST /api/usinas/geocode/` ou o
management command `python manage.py geocode_usinas` para preencher
automaticamente a partir de CEP/endereço.

Detecção de queda abrupta vs curva natural
------------------------------------------
A janela ainda pode incluir momentos de geração baixa em dias ruins. Pra
evitar falso positivo, quando a leitura atual está em zero olhamos a
leitura imediatamente anterior:

- Se a anterior já estava abaixo de
  `ConfiguracaoEmpresa.sem_geracao_queda_abrupta_pct`% da capacidade,
  é curva natural de fim de dia — não dispara (`None`).
- Se a anterior estava acima desse limite, é queda abrupta — dispara
  o alerta (a usina foi de gerando para zero de uma coleta pra outra).
- Se não há leitura anterior, ou a usina não tem capacidade cadastrada,
  cai no comportamento conservador (dispara).
"""
from __future__ import annotations

from decimal import Decimal

from apps.alertas.models import SeveridadeAlerta
from apps.monitoramento.models import LeituraUsina

from ._helpers import _janela_astral, aproximadamente_zero, em_horario_solar
from .base import Anomalia, RegraUsina, registrar


@registrar
class SemGeracaoHorarioSolar(RegraUsina):
    nome = "sem_geracao_horario_solar"
    severidade_padrao = SeveridadeAlerta.CRITICO

    def avaliar(self, usina, leitura, config) -> Anomalia | None | bool:
        # Fora do horário solar — a regra não se aplica (não abre nem fecha).
        # Alertas pré-existentes ficam intactos até o motor reavaliar dentro
        # da janela. Se o problema persistir até amanhã às 8h, dispara de novo.
        if not em_horario_solar(usina, config):
            return None

        if leitura is None or leitura.potencia_kw is None:
            return None

        if not aproximadamente_zero(leitura.potencia_kw):
            return False

        # Potência atual ≈ 0 — distinguir curva natural de queda abrupta.
        anterior = (
            LeituraUsina.objects
            .filter(usina=usina, coletado_em__lt=leitura.coletado_em)
            .order_by("-coletado_em")
            .values_list("potencia_kw", flat=True)
            .first()
        )
        capacidade = usina.capacidade_kwp
        if anterior is not None and capacidade and capacidade > 0:
            limiar_pct = Decimal(str(config.sem_geracao_queda_abrupta_pct))
            anterior_pct = (Decimal(str(anterior)) / Decimal(str(capacidade))) * 100
            if anterior_pct < limiar_pct:
                # Curva natural de fim/início de dia — não dispara.
                return None

        # Janela exibida na mensagem reflete o método em uso (astral vs fixa).
        from datetime import datetime as _dt
        import zoneinfo as _zi
        try:
            tz = _zi.ZoneInfo(usina.fuso_horario or "America/Sao_Paulo")
        except _zi.ZoneInfoNotFoundError:
            tz = _zi.ZoneInfo("America/Sao_Paulo")
        hoje_local = _dt.now(tz=tz).date()
        janela_astral = _janela_astral(usina, hoje_local)

        if janela_astral is not None:
            inicio, fim = janela_astral
            origem_janela = "astral"
        else:
            inicio = config.horario_solar_inicio
            fim = config.horario_solar_fim
            origem_janela = "fixa"

        return Anomalia(
            severidade=self.severidade_padrao,
            mensagem=(
                f"Usina {usina.nome} sem gerar em horário solar "
                f"({inicio:%H:%M}–{fim:%H:%M}) — potência {leitura.potencia_kw} kW."
            ),
            contexto={
                "potencia_kw": str(leitura.potencia_kw),
                "potencia_anterior_kw": str(anterior) if anterior is not None else None,
                "capacidade_kwp": str(capacidade) if capacidade else None,
                "janela_inicio": inicio.isoformat(),
                "janela_fim": fim.isoformat(),
                "janela_origem": origem_janela,
                "fuso_horario": usina.fuso_horario,
                "leitura_id": str(leitura.pk) if leitura.pk else None,
            },
        )
