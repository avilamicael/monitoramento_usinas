"""Regra `sem_geracao_horario_solar`.

A regra mais importante do sistema na visão do produto: se o sol está
disponível (definido pela janela horário_solar_inicio/fim em
`ConfiguracaoEmpresa`) e a usina reporta potência ≈ 0, alguma coisa
está errada — **crítico**.

Cobre o caso onde o Wi-Fi caiu durante o dia e o provedor continua
reportando o último valor (zero). Cobre também: inversor desligado,
disjuntor aberto, falha de string total, etc. O sistema só sinaliza —
operador investiga.

Sem histerese. Se uma nuvem passa e a potência cai a zero por 10 min,
o alerta vai abrir; na próxima coleta após a nuvem, fecha sozinho. User
aceita esse comportamento (sistema notifica, operador filtra).
"""
from __future__ import annotations

from apps.alertas.models import SeveridadeAlerta

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

        return Anomalia(
            severidade=self.severidade_padrao,
            mensagem=(
                f"Usina {usina.nome} sem gerar em horário solar "
                f"({config.horario_solar_inicio:%H:%M}–{config.horario_solar_fim:%H:%M}) "
                f"— potência {leitura.potencia_kw} kW."
            ),
            contexto={
                "potencia_kw": str(leitura.potencia_kw),
                "horario_solar_inicio": config.horario_solar_inicio.isoformat(),
                "horario_solar_fim": config.horario_solar_fim.isoformat(),
                "fuso_horario": usina.fuso_horario,
                "leitura_id": str(leitura.pk) if leitura.pk else None,
            },
        )
