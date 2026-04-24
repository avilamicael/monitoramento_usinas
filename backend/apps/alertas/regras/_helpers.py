"""Helpers compartilhados pelas regras."""
from __future__ import annotations

import zoneinfo
from datetime import datetime
from decimal import Decimal


def em_horario_solar(usina, config) -> bool:
    """Verifica se o horário **local da usina** está dentro da janela
    `config.horario_solar_inicio` ↔ `config.horario_solar_fim`.

    Usa `usina.fuso_horario` (default America/Sao_Paulo). Janela default
    08:00–18:00 — configurável por empresa, ajustável pelo super admin.
    """
    try:
        tz = zoneinfo.ZoneInfo(usina.fuso_horario or "America/Sao_Paulo")
    except zoneinfo.ZoneInfoNotFoundError:
        tz = zoneinfo.ZoneInfo("America/Sao_Paulo")

    agora_local = datetime.now(tz=tz).time()
    return config.horario_solar_inicio <= agora_local <= config.horario_solar_fim


def aproximadamente_zero(valor) -> bool:
    """Retorna True quando o valor é zero ou um epsilon próximo de zero.

    Usado pelas regras de potência — `pac_kw=0.001` na prática é "não está
    gerando" (ruído de medição). Limite: 50 W.
    """
    if valor is None:
        return False
    return Decimal(str(valor)) < Decimal("0.05")
