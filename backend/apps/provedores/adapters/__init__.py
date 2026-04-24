from __future__ import annotations

from .base import BaseAdapter, ErroProvedor, SnapshotUsina
from .registry import adapter_para, registrar, tipos_registrados

__all__ = (
    "BaseAdapter",
    "SnapshotUsina",
    "ErroProvedor",
    "adapter_para",
    "registrar",
    "tipos_registrados",
)
