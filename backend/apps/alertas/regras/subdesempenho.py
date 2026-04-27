"""Regra `subdesempenho` — gerando muito menos que a capacidade.

Threshold: `ConfiguracaoEmpresa.subdesempenho_limite_pct` (default 30%).
Avalia em horário **pleno** (10h-15h, dentro da janela solar) — não
pega a curva de subida da manhã ou descida da tarde, onde geração baixa
é normal.

Cálculo: `potencia_kw / capacidade_kwp * 100 < pct_limite`.

Falso positivo natural: dia totalmente nublado vai disparar. O sistema
notifica, operador vê o clima e ignora — é o comportamento aceito ("só
comunica, operador filtra").
"""
from __future__ import annotations

import zoneinfo
from datetime import datetime, time
from decimal import Decimal

from apps.alertas.models import SeveridadeAlerta

from .base import Anomalia, RegraUsina, registrar  # noqa: F401  (registrar mantido para reativação fácil)

# Janela "horário pleno" — dentro do horário solar mas só entre 10h-15h
# locais. Antes/depois disso a geração é naturalmente menor.
_PLENO_INICIO = time(10, 0)
_PLENO_FIM = time(15, 0)


def _em_horario_pleno(usina) -> bool:
    try:
        tz = zoneinfo.ZoneInfo(usina.fuso_horario or "America/Sao_Paulo")
    except zoneinfo.ZoneInfoNotFoundError:
        tz = zoneinfo.ZoneInfo("America/Sao_Paulo")
    agora = datetime.now(tz=tz).time()
    return _PLENO_INICIO <= agora <= _PLENO_FIM


# Desativada temporariamente — virará relatório futuro (não-alerta).
# Decisão: subdesempenho gera ruído crônico (dia nublado dispara). O sinal
# útil é melhor consumido como métrica/relatório agregado do que como
# alerta individual. Mantemos o código intacto para reuso futuro pelo
# motor de relatórios; basta reativar `@registrar` quando virar alerta de
# novo (improvável) ou portar a lógica para `apps/relatorios/`.
# @registrar
class Subdesempenho(RegraUsina):
    nome = "subdesempenho"
    severidade_padrao = SeveridadeAlerta.AVISO

    def avaliar(self, usina, leitura, config) -> Anomalia | None | bool:
        if not _em_horario_pleno(usina):
            return None
        if leitura is None or leitura.potencia_kw is None:
            return None
        if usina.capacidade_kwp is None or usina.capacidade_kwp <= 0:
            return None

        # Guard: potência ≈ 0 é "sem geração" (coberto por
        # `sem_geracao_horario_solar`), não subdesempenho. Retorna False
        # para resolver alertas pré-existentes desse caso.
        if Decimal(str(leitura.potencia_kw)) <= Decimal("0.01"):
            return False

        pct = (Decimal(str(leitura.potencia_kw)) / usina.capacidade_kwp) * 100
        limite = Decimal(str(config.subdesempenho_limite_pct))

        if pct >= limite:
            return False

        return Anomalia(
            severidade=self.severidade_padrao,
            mensagem=(
                f"Usina {usina.nome} gerando {leitura.potencia_kw} kW "
                f"({pct:.1f}% da capacidade {usina.capacidade_kwp} kWp), "
                f"abaixo do limite de {limite}%."
            ),
            contexto={
                "potencia_kw": str(leitura.potencia_kw),
                "capacidade_kwp": str(usina.capacidade_kwp),
                "pct_atual": f"{pct:.2f}",
                "pct_limite": str(limite),
                "leitura_id": str(leitura.pk) if leitura.pk else None,
            },
        )
