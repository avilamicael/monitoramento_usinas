"""Conversões e parsing de valores dos provedores.

Regras do sistema:
- Potência: sempre `kW` (`DadosUsina.potencia_kw`, `DadosInversor.pac_kw`).
- Energia: sempre `kWh`.
- Tensão: `V`.
- Corrente: `A`.
- Frequência: `Hz`.
- Temperatura: `°C`.

Provedores retornam misturado (Hoymiles em W, Solis em kW, Fusion em MW na
capacidade). Todo adapter passa os valores por esses helpers antes de
instanciar os dataclasses — assim não há `if provedor == ...` nas camadas
superiores.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation


def _para_decimal(valor) -> Decimal | None:
    """Converte valor qualquer para `Decimal`. `None`/inválido → `None`.

    Aceita string, float, int, Decimal. Float passa por str para evitar
    ruído binário clássico do IEEE-754.
    """
    if valor is None or valor == "":
        return None
    try:
        if isinstance(valor, Decimal):
            return valor
        if isinstance(valor, float):
            return Decimal(str(valor))
        return Decimal(str(valor).strip())
    except (InvalidOperation, ValueError, TypeError):
        return None


def w_para_kw(valor) -> Decimal | None:
    """Converte Watts → kilowatts."""
    dec = _para_decimal(valor)
    return dec / Decimal(1000) if dec is not None else None


def wh_para_kwh(valor) -> Decimal | None:
    """Converte Wh → kWh."""
    dec = _para_decimal(valor)
    return dec / Decimal(1000) if dec is not None else None


def mw_para_kw(valor) -> Decimal | None:
    """Converte MW → kW (FusionSolar retorna capacidade em MW quando < 100)."""
    dec = _para_decimal(valor)
    return dec * Decimal(1000) if dec is not None else None


def kw(valor) -> Decimal | None:
    """Já está em kW — só normaliza o tipo."""
    return _para_decimal(valor)


def kwh(valor) -> Decimal | None:
    """Já está em kWh."""
    return _para_decimal(valor)


def v(valor) -> Decimal | None:
    """Tensão em V."""
    return _para_decimal(valor)


def a(valor) -> Decimal | None:
    """Corrente em A."""
    return _para_decimal(valor)


def hz(valor) -> Decimal | None:
    """Frequência em Hz."""
    return _para_decimal(valor)


def temp_c(valor) -> Decimal | None:
    """Temperatura em °C.

    Alguns provedores cravam 150.0 como "sem leitura" (ex.: Solis `temp:150.0`
    quando o inversor não expõe temperatura pelo CT). Adapter que conheça
    esse padrão deve filtrar antes de passar o valor aqui.
    """
    return _para_decimal(valor)


def pct(valor) -> Decimal | None:
    """Percentual 0-100."""
    return _para_decimal(valor)


def ts_ms_para_datetime(ts_ms) -> datetime | None:
    """Unix epoch em milissegundos → datetime UTC. `None`/inválido → `None`."""
    if ts_ms is None or ts_ms == "":
        return None
    try:
        return datetime.fromtimestamp(int(ts_ms) / 1000, tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


def ts_s_para_datetime(ts_s) -> datetime | None:
    """Unix epoch em segundos → datetime UTC."""
    if ts_s is None or ts_s == "":
        return None
    try:
        return datetime.fromtimestamp(float(ts_s), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None
