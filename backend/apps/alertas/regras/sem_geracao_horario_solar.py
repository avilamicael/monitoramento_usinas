"""Regra `sem_geracao_horario_solar`.

A regra mais importante do sistema na visão do produto: se o sol está
disponível (definido pela janela horário_solar_inicio/fim em
`ConfiguracaoEmpresa`) e a usina reporta potência ≈ 0 **abruptamente**,
alguma coisa está errada — **crítico**.

Cobre: Wi-Fi caiu durante o dia e o provedor continua reportando o último
valor (zero), inversor desligado em pleno meio-dia, disjuntor aberto, falha
de string total, etc.

Detecção de queda abrupta vs curva natural
------------------------------------------
A janela `horario_solar_*` (default 08:00–18:00) inclui as bordas onde a
geração é naturalmente próxima de zero (alvorecer/anoitecer). Pra evitar
falso positivo nessas bordas, quando a leitura atual está em zero olhamos
a leitura imediatamente anterior:

- Se a anterior já estava abaixo de
  `ConfiguracaoEmpresa.sem_geracao_queda_abrupta_pct`% da capacidade,
  é curva natural de fim de dia — não dispara (`None`).
- Se a anterior estava acima desse limite, é queda abrupta — dispara
  o alerta (a usina foi de gerando para zero de uma coleta pra outra).
- Se não há leitura anterior, ou a usina não tem capacidade cadastrada,
  cai no comportamento conservador antigo (dispara).

Roadmap: substituir a janela horário_solar_* por cálculo de irradiação
NASA com lat/lon da usina; janela vira fallback quando lat/lon ausente.
"""
from __future__ import annotations

from decimal import Decimal

from apps.alertas.models import SeveridadeAlerta
from apps.monitoramento.models import LeituraUsina

from ._helpers import aproximadamente_zero, em_horario_solar
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

        return Anomalia(
            severidade=self.severidade_padrao,
            mensagem=(
                f"Usina {usina.nome} sem gerar em horário solar "
                f"({config.horario_solar_inicio:%H:%M}–{config.horario_solar_fim:%H:%M}) "
                f"— potência {leitura.potencia_kw} kW."
            ),
            contexto={
                "potencia_kw": str(leitura.potencia_kw),
                "potencia_anterior_kw": str(anterior) if anterior is not None else None,
                "capacidade_kwp": str(capacidade) if capacidade else None,
                "horario_solar_inicio": config.horario_solar_inicio.isoformat(),
                "horario_solar_fim": config.horario_solar_fim.isoformat(),
                "fuso_horario": usina.fuso_horario,
                "leitura_id": str(leitura.pk) if leitura.pk else None,
            },
        )
