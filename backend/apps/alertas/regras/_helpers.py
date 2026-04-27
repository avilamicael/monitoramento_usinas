"""Helpers compartilhados pelas regras."""
from __future__ import annotations

import zoneinfo
from datetime import datetime
from decimal import Decimal

# Defaults dos campos `Usina.tensao_ac_limite_v` / `tensao_ac_limite_minimo_v`.
# Quando o valor armazenado é igual ao default, consideramos que o admin não
# fez override e calculamos o threshold automaticamente a partir de
# `Usina.tensao_nominal_v`. Quando difere do default, respeita o valor manual.
_DEFAULT_LIMITE_SOBRETENSAO_V = Decimal("240")
_DEFAULT_LIMITE_SUBTENSAO_V = Decimal("190")

# Nominal efetivo por choice de `Usina.tensao_nominal_v`.
# Para "110 V" usamos 127 V (NBR 5410 — faixa adequada 117–133 V).
# Para "220 V" usamos 220 V literal.
_NOMINAL_EFETIVO_V: dict[int, Decimal] = {
    110: Decimal("127"),
    220: Decimal("220"),
}

# Multiplicadores aplicados sobre o nominal efetivo.
_FATOR_SOBRETENSAO = Decimal("1.10")  # 110% do nominal → limite superior
_FATOR_SUBTENSAO = Decimal("0.85")  # 85% do nominal → limite inferior


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


def _nominal_efetivo_v(usina) -> Decimal:
    """Nominal efetivo (em V) da rede da usina.

    Tolera ausência do campo `tensao_nominal_v` (usinas antigas) caindo no
    default 220 V.
    """
    valor = getattr(usina, "tensao_nominal_v", None) or 220
    return _NOMINAL_EFETIVO_V.get(int(valor), Decimal("220"))


def threshold_sobretensao_v(usina) -> Decimal:
    """Limite de sobretensão da usina, em V.

    - Se `tensao_ac_limite_v` foi sobrescrito (≠ default 240), respeita o
      valor manual — admin sabe o que está fazendo.
    - Caso contrário, calcula 110% do nominal efetivo de `tensao_nominal_v`:
      220 V → 242 V; 127 V (rótulo "110 V") → 139,7 V.
    """
    manual = Decimal(str(usina.tensao_ac_limite_v))
    if manual != _DEFAULT_LIMITE_SOBRETENSAO_V:
        return manual
    return (_nominal_efetivo_v(usina) * _FATOR_SOBRETENSAO).quantize(Decimal("0.1"))


def threshold_subtensao_v(usina) -> Decimal:
    """Limite de subtensão da usina, em V.

    - Se `tensao_ac_limite_minimo_v` foi sobrescrito (≠ default 190),
      respeita o valor manual.
    - Caso contrário, calcula 85% do nominal efetivo: 220 V → 187 V;
      127 V (rótulo "110 V") → 107,95 V.
    """
    manual = Decimal(str(usina.tensao_ac_limite_minimo_v))
    if manual != _DEFAULT_LIMITE_SUBTENSAO_V:
        return manual
    return (_nominal_efetivo_v(usina) * _FATOR_SUBTENSAO).quantize(Decimal("0.1"))
