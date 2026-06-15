"""Regra `monitoramento_premium_vencendo`.

Avisa quando o contrato de monitoramento ativo (premium) de uma usina está
perto de vencer. Espelha `garantia_vencendo`, mas lê
`usina.monitoramento_ativo` e os limites de `ConfiguracaoEmpresa`:

- `dias_restantes ≤ monitoramento_premium_aviso_dias` (30) → severidade `info`.
- `dias_restantes ≤ monitoramento_premium_critico_dias` (7) → severidade `aviso`.

Como o estado muda devagar (1 vez por dia no máximo), roda só na task diária
(faz parte de `REGRAS_DIARIAS` no motor).
"""
from __future__ import annotations

from apps.alertas.models import SeveridadeAlerta

from .base import Anomalia, RegraUsina, registrar


@registrar
class MonitoramentoPremiumVencendo(RegraUsina):
    nome = "monitoramento_premium_vencendo"
    severidade_padrao = SeveridadeAlerta.INFO
    # Severidade escala dinamicamente: INFO em ≤ 30 dias, AVISO em ≤ 7 dias.
    # Override de severidade via `ConfiguracaoRegra` é ignorado — só `ativa`
    # é respeitado.
    severidade_dinamica = True

    def avaliar(self, usina, leitura, config) -> Anomalia | None | bool:
        premium = getattr(usina, "monitoramento_ativo", None)
        # Sem contrato premium ou já vencido — regra inaplicável (não abre nem
        # fecha). A usina pode estar no motor só pela garantia.
        if premium is None or not premium.is_active:
            return None

        dias = premium.dias_restantes
        critico = config.monitoramento_premium_critico_dias
        aviso = config.monitoramento_premium_aviso_dias

        if dias > aviso:
            return False

        if dias <= critico:
            severidade = SeveridadeAlerta.AVISO
            faixa = f"≤ {critico} dias"
        else:
            severidade = SeveridadeAlerta.INFO
            faixa = f"≤ {aviso} dias"

        return Anomalia(
            severidade=severidade,
            mensagem=(
                f"Monitoramento premium vence em {dias} dias ({faixa})."
            ),
            contexto={
                "dias_restantes": dias,
                "fim_em": premium.fim_em.isoformat(),
                "limite_aviso": aviso,
                "limite_critico": critico,
            },
        )
