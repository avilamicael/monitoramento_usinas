from __future__ import annotations

from .base import BaseAdapter

_REGISTRO: dict[str, type[BaseAdapter]] = {}


def registrar(cls: type[BaseAdapter]) -> type[BaseAdapter]:
    """Decorator para registrar um adapter pelo seu `tipo`."""
    if not cls.tipo:
        raise ValueError(f"{cls.__name__} precisa definir `tipo`.")
    _REGISTRO[cls.tipo] = cls
    return cls


def adapter_para(tipo: str) -> type[BaseAdapter]:
    try:
        return _REGISTRO[tipo]
    except KeyError as exc:
        raise KeyError(f"Nenhum adapter registrado para tipo={tipo!r}.") from exc


def tipos_registrados() -> list[str]:
    return sorted(_REGISTRO)
