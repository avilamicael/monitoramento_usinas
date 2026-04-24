"""Regra `garantia_vencendo`.

Dois níveis:
- `dias_restantes ≤ ConfiguracaoEmpresa.garantia_aviso_dias` (30) → severidade `info`.
- `dias_restantes ≤ garantia_critico_dias` (7) → severidade `aviso`.

Como o estado da garantia muda devagar (1× por dia no máximo), essa regra
não precisa rodar a cada coleta — basta uma task diária. Mas mantemos a
implementação como `RegraUsina` normal pra integrar no mesmo motor; o
loop diário é um wrapper externo (em `coleta/tasks.py::avaliar_alertas_diarios`).
"""
from __future__ import annotations

from apps.alertas.models import SeveridadeAlerta

from .base import Anomalia, RegraUsina, registrar


@registrar
class GarantiaVencendo(RegraUsina):
    nome = "garantia_vencendo"
    severidade_padrao = SeveridadeAlerta.INFO

    def avaliar(self, usina, leitura, config) -> Anomalia | None | bool:
        garantia = getattr(usina, "garantia", None)
        # Sem garantia ou já vencida — outras regras do motor já filtram a
        # usina antes (avaliar_empresa pula garantia inativa). Aqui só
        # finaliza o cenário pulando.
        if garantia is None or not garantia.is_active:
            return None

        dias = garantia.dias_restantes
        critico = config.garantia_critico_dias
        aviso = config.garantia_aviso_dias

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
                f"Garantia da usina {usina.nome} vence em {dias} dias "
                f"({faixa})."
            ),
            contexto={
                "dias_restantes": dias,
                "fim_em": garantia.fim_em.isoformat(),
                "limite_aviso": aviso,
                "limite_critico": critico,
            },
        )
