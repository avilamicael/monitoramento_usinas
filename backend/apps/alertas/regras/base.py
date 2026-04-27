"""Contrato base das regras de alerta.

Uma `Regra` é avaliada pelo motor (`alertas.motor`) a cada coleta e retorna
uma lista de `Anomalia` — ou lista vazia quando tudo está ok. O motor usa
o resultado pra abrir/atualizar/resolver `Alerta` seguindo a política sem
histerese: 1 alerta aberto por (usina, inversor, regra), criado na 1ª
detecção e fechado na 1ª coleta onde a condição não mais se aplica.

Princípio crítico: **null ≠ ok**. Se o dado necessário não está disponível
(provedor não expôs), a regra retorna `None` pra aquele alvo — e o motor
trata como "não avaliado", sem abrir nem fechar alerta. Isso evita falso
positivo em Solarman/Fusion com campos elétricos ausentes e falso negativo
em provedores completos.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING, Any

from apps.alertas.models import SeveridadeAlerta

if TYPE_CHECKING:
    from apps.core.models import ConfiguracaoEmpresa
    from apps.inversores.models import Inversor
    from apps.monitoramento.models import LeituraInversor, LeituraUsina
    from apps.usinas.models import Usina


class Escopo(str, Enum):
    USINA = "usina"
    INVERSOR = "inversor"


@dataclass
class Anomalia:
    """Resultado positivo da avaliação de uma regra.

    O motor usa `severidade` + `mensagem` + `contexto` pra popular o `Alerta`.
    """

    severidade: SeveridadeAlerta
    mensagem: str
    contexto: dict[str, Any] = field(default_factory=dict)


# ── Registro ──────────────────────────────────────────────────────────────

_REGISTRO: dict[str, type[Regra]] = {}


def registrar(cls: type[Regra]) -> type[Regra]:
    """Decorator que registra a regra no motor. Usa `cls.nome` como chave."""
    if not getattr(cls, "nome", None):
        raise ValueError(f"{cls.__name__} precisa definir `nome`.")
    _REGISTRO[cls.nome] = cls
    return cls


def regras_registradas() -> list[type[Regra]]:
    return list(_REGISTRO.values())


# ── Interface ─────────────────────────────────────────────────────────────

class Regra(ABC):
    """Interface base. Concretas devem ser `RegraUsina` ou `RegraInversor`."""

    nome: str = ""
    severidade_padrao: SeveridadeAlerta = SeveridadeAlerta.AVISO
    escopo: Escopo = Escopo.USINA


class RegraUsina(Regra):
    """Avalia uma usina como um todo.

    Recebe `Usina`, última `LeituraUsina` (pode ser None se ainda não coletou)
    e `ConfiguracaoEmpresa` da empresa dona. Retorna:
        - `Anomalia`: condição disparou → abrir/atualizar alerta.
        - `None`:     regra inaplicável (dado ausente) → motor ignora.
        - `False`:    condição claramente não se aplica → motor fecha alerta
                      aberto desse tipo, se houver.
    """

    escopo = Escopo.USINA

    @abstractmethod
    def avaliar(
        self,
        usina: Usina,
        leitura: LeituraUsina | None,
        config: ConfiguracaoEmpresa,
    ) -> Anomalia | None | bool: ...


class RegraInversor(Regra):
    """Avalia um inversor individual. Mesma semântica de retorno.

    Quando `agregar_por_usina = True`, o motor consolida todas as anomalias
    da regra dentro de uma mesma usina em **um único** `Alerta` com
    `inversor=NULL`. O contexto do alerta agregado expõe a lista de
    inversores afetados, com SN + valores medidos. Útil para regras onde 1
    alerta por inversor poluiria a tela quando o problema é da rede ou da
    usina inteira (ex.: sobretensão AC, frequência anômala, todos os
    inversores da Laura disparando ao mesmo tempo).

    Default `False` preserva o comportamento histórico de 1 alerta por
    inversor.
    """

    escopo = Escopo.INVERSOR
    agregar_por_usina: bool = False

    @abstractmethod
    def avaliar(
        self,
        inversor: Inversor,
        leitura: LeituraInversor | None,
        config: ConfiguracaoEmpresa,
    ) -> Anomalia | None | bool: ...
