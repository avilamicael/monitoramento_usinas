"""Motor de alertas interno.

A versão real lê todas as regras em `apps/alertas/regras/`, avalia cada uma
contra as leituras recentes e abre/atualiza/resolve `Alerta`. Essa stub
serve apenas para destravar a task de coleta (F5/C2) — a implementação
completa chega em F6/C4.
"""
from __future__ import annotations

import logging

from django.db import transaction

logger = logging.getLogger(__name__)


def avaliar_empresa(empresa_id) -> None:
    """Stub — F6/C4 substitui por chamada às regras."""
    logger.debug("motor.avaliar_empresa(%s): stub", empresa_id)


def avaliar_empresa_em_commit(empresa_id) -> None:
    """Agenda `avaliar_empresa` para rodar após o commit da transação
    atual. Usado no fim da task de coleta pra não misturar escrita de
    leituras com avaliação de regras."""
    transaction.on_commit(lambda: avaliar_empresa(empresa_id))
