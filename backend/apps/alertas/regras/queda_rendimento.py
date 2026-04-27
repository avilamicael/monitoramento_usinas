"""Regra `queda_rendimento`.

Compara a energia gerada hoje (até agora) com a média dos últimos 7 dias
da própria usina (excluindo hoje). Dispara aviso quando o valor de hoje
está abaixo de `ConfiguracaoEmpresa.queda_rendimento_pct` (default 60%)
da média.

Particular:
- Roda 1× ao dia, no fim da tarde (~18h via task diária). Avaliar a cada
  coleta seria redundante — a métrica não muda durante o dia em ritmo
  útil pra alertar.
- Sem histórico de 7 dias retornado: regra retorna None (não avalia).
- Dia totalmente nublado vai disparar — comportamento aceito.
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Max
from django.utils import timezone as djtz

from apps.alertas.models import SeveridadeAlerta
from apps.monitoramento.models import LeituraUsina

from .base import Anomalia, RegraUsina, registrar

DIAS_BASELINE = 7
# Mínimo de dias úteis para considerar a baseline confiável. Abaixo disso
# a média é instável (uma usina nova ou com gap de coleta dispara falso
# positivo só pela amostra pequena).
DIAS_BASELINE_MINIMO = 5


@registrar
class QuedaRendimento(RegraUsina):
    nome = "queda_rendimento"
    severidade_padrao = SeveridadeAlerta.AVISO

    def avaliar(self, usina, leitura, config) -> Anomalia | None | bool:
        if leitura is None or leitura.energia_hoje_kwh is None:
            return None

        agora = djtz.now()
        inicio_baseline = agora - timedelta(days=DIAS_BASELINE)
        # Pega o pico diário de energia_hoje_kwh dos últimos 7 dias
        # (excluindo hoje). `energia_hoje_kwh` é cumulativa no dia, então
        # o último ponto antes da meia-noite é o total daquele dia.
        leituras_baseline = (
            LeituraUsina.objects
            .filter(
                usina=usina,
                coletado_em__gte=inicio_baseline,
                coletado_em__lt=agora.replace(hour=0, minute=0, second=0, microsecond=0),
            )
            .extra(select={"data": "DATE(coletado_em)"})
            .values("data")
            .annotate(maximo=Max("energia_hoje_kwh"))
        )
        valores = [row["maximo"] for row in leituras_baseline if row["maximo"] is not None]
        if len(valores) < DIAS_BASELINE_MINIMO:
            # Sem baseline suficiente (usina nova, dados incompletos).
            return None

        media = sum(valores) / len(valores)
        if media <= 0:
            return None

        atual = Decimal(str(leitura.energia_hoje_kwh))
        pct = (atual / Decimal(str(media))) * 100
        limite = Decimal(str(config.queda_rendimento_pct))

        if pct >= limite:
            return False

        return Anomalia(
            severidade=self.severidade_padrao,
            mensagem=(
                f"Usina {usina.nome} gerou {atual} kWh hoje "
                f"({pct:.1f}% da média {DIAS_BASELINE}d = {media:.2f} kWh)."
            ),
            contexto={
                "energia_hoje_kwh": str(atual),
                "media_baseline_kwh": f"{media:.3f}",
                "dias_baseline": len(valores),
                "pct_atual": f"{pct:.2f}",
                "pct_limite": str(limite),
            },
        )
