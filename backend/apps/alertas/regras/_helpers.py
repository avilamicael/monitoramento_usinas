"""Helpers compartilhados pelas regras."""
from __future__ import annotations

import zoneinfo
from datetime import date, datetime, time, timedelta
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

try:
    from astral import LocationInfo  # type: ignore[import-not-found]
    from astral.sun import sun  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover — astral é dep do backend
    LocationInfo = None  # type: ignore[assignment]
    sun = None  # type: ignore[assignment]

# Cache in-memory de janelas astrais por (lat_arred, lon_arred, dia_iso).
# Evita recalcular `astral.sun.sun(...)` para cada inversor da mesma usina
# no mesmo ciclo de avaliação. Invalida naturalmente quando o dia muda.
_CACHE_JANELA_ASTRAL: dict[tuple[float, float, str], tuple[time, time]] = {}

# Buffer das bordas da janela. Sunrise + 1h (luz ainda fraca, ângulo baixo) e
# sunset - 1h (sombra natural, telhados orientados para leste já não captam
# nada). Evita falso positivo na primeira/última hora do dia solar.
_BUFFER_BORDA_HORAS = 1


def _resolver_tz(usina) -> zoneinfo.ZoneInfo:
    try:
        return zoneinfo.ZoneInfo(usina.fuso_horario or "America/Sao_Paulo")
    except zoneinfo.ZoneInfoNotFoundError:
        return zoneinfo.ZoneInfo("America/Sao_Paulo")


def _janela_astral(usina, dia: date) -> tuple[time, time] | None:
    """Calcula `(sunrise+1h, sunset-1h)` no fuso da usina via `astral`.

    Retorna `None` se a usina não tem `latitude`/`longitude`. Cacheia o
    resultado por `(lat, lon, dia)` em memória do processo — válido até o
    dia mudar. Tolerante a falhas: se `astral` levantar exceção (data
    extrema, lib quebrada), devolve `None` para que o caller faça fallback
    no horário fixo.
    """
    lat = usina.latitude
    lon = usina.longitude
    if lat is None or lon is None:
        return None

    chave = (round(float(lat), 4), round(float(lon), 4), dia.isoformat())
    if chave in _CACHE_JANELA_ASTRAL:
        return _CACHE_JANELA_ASTRAL[chave]

    if LocationInfo is None or sun is None:
        return None

    tz = _resolver_tz(usina)
    location = LocationInfo(
        name=usina.nome or "usina",
        region="BR",
        timezone=str(tz),
        latitude=float(lat),
        longitude=float(lon),
    )

    try:
        s = sun(location.observer, date=dia, tzinfo=tz)
    except Exception:  # noqa: BLE001 — astral lança ValueError em latitudes polares
        return None

    sunrise: datetime = s["sunrise"]
    sunset: datetime = s["sunset"]
    inicio = (sunrise + timedelta(hours=_BUFFER_BORDA_HORAS)).timetz().replace(tzinfo=None)
    fim = (sunset - timedelta(hours=_BUFFER_BORDA_HORAS)).timetz().replace(tzinfo=None)

    janela = (inicio, fim)
    _CACHE_JANELA_ASTRAL[chave] = janela
    return janela


def em_horario_solar(usina, config) -> bool:
    """Verifica se o horário **local da usina** está dentro da janela solar.

    Estratégia (preferindo precisão geográfica):

    1. Se `usina.latitude` E `usina.longitude` estão preenchidos, calcula
       sunrise/sunset do dia atual via `astral` e usa
       `(sunrise + 1h, sunset - 1h)` — buffer pra evitar borda de baixa luz
       (sol raso, sombra de telhados, ângulo desfavorável).
    2. Senão, fallback na janela fixa configurada em
       `ConfiguracaoEmpresa.horario_solar_inicio/_fim` (default 08:00–18:00).

    Usa `usina.fuso_horario` (default `America/Sao_Paulo`). O cache é por
    `(lat, lon, dia)` no módulo — invalida automaticamente quando o dia
    muda em relação à última chamada.
    """
    tz = _resolver_tz(usina)
    agora_local = datetime.now(tz=tz)

    janela = _janela_astral(usina, agora_local.date())
    if janela is not None:
        inicio, fim = janela
        return inicio <= agora_local.time() <= fim

    return config.horario_solar_inicio <= agora_local.time() <= config.horario_solar_fim


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
