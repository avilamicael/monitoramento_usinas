from __future__ import annotations

from .base import BaseAdapter, SnapshotUsina
from .registry import registrar


@registrar
class SolisAdapter(BaseAdapter):
    """Placeholder para Solis (Ginlong)."""

    tipo = "solis"

    def listar_usinas(self) -> list[SnapshotUsina]:
        raise NotImplementedError

    def buscar_usina(self, id_externo: str) -> SnapshotUsina:
        raise NotImplementedError
