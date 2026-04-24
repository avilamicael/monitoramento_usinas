from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any


class ErroProvedor(Exception):
    """Erro genérico de integração com provedor externo."""


@dataclass(slots=True)
class SnapshotUsina:
    """Estrutura normalizada que todo adapter deve produzir por usina.

    Os adapters traduzem a resposta do provedor para esse formato comum
    para que `monitoramento`/`alertas` não precisem conhecer detalhes de
    cada API.
    """

    id_externo: str
    nome: str
    capacidade_kwp: Decimal | None = None
    potencia_atual_kw: Decimal | None = None
    energia_hoje_kwh: Decimal | None = None
    energia_total_kwh: Decimal | None = None
    vista_em: datetime | None = None
    status: str = ""
    bruto: dict[str, Any] = field(default_factory=dict)


class BaseAdapter(ABC):
    """Interface comum a todos os provedores.

    Cada integração nova herda desta classe, registra o `tipo` e implementa
    os dois métodos abaixo. Polling, retry e persistência ficam fora do
    adapter — isso aqui é só a camada de tradução.
    """

    tipo: str = ""

    def __init__(self, conta) -> None:  # noqa: ANN001 — evita import circular
        self.conta = conta

    @abstractmethod
    def listar_usinas(self) -> list[SnapshotUsina]:
        """Retorna todas as usinas visíveis nessa conta no provedor."""

    @abstractmethod
    def buscar_usina(self, id_externo: str) -> SnapshotUsina:
        """Retorna o snapshot atual de uma usina específica."""
