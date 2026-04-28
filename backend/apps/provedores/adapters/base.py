"""Contrato base de adapters de provedores.

Cada provedor implementa `BaseAdapter`, normaliza sua resposta nativa para
`DadosUsina` e `DadosInversor` (unidades fixas: kW/kWh/V/A/Hz/°C) e declara
suas `Capacidades`. Polling, retry e persistência ficam fora do adapter —
responsabilidade do worker em `coleta/`.

Alertas nativos do provedor **não** fazem parte desse contrato. A experiência
com o sistema antigo (12.8% churn médio, 46% em Solis) mostrou que eles são
inconsistentes. No sistema novo, alertas são derivados das leituras pelo
motor em `alertas/regras/`.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any, TypedDict


class ErroProvedor(Exception):
    """Erro genérico do provedor. Especializar quando útil."""


class ErroAutenticacaoProvedor(ErroProvedor):
    """Credenciais inválidas ou sessão expirada que não pôde ser renovada."""


class ErroRateLimitProvedor(ErroProvedor):
    """Provedor respondeu com rate-limit. Worker deve respeitar backoff."""


# ── Dataclasses normalizadas ──────────────────────────────────────────────

class EletricaAc(TypedDict, total=False):
    """Schema do detalhe elétrico AC por fase preenchido pelos adapters.

    Todas as chaves são opcionais — adapter preenche apenas o que o provedor
    expõe. Os subdicionários (`fases_neutro`, `linhas`, `correntes`) também
    têm chaves opcionais.

    - `fases_neutro`: tensões fase-neutro em V (chaves `a`, `b`, `c`).
    - `linhas`: tensões entre fases em V (chaves `ab`, `bc`, `ca`).
    - `correntes`: correntes por fase em A (chaves `a`, `b`, `c`).
    - `fator_potencia`: cosφ.
    - `potencia_reativa_kvar`: kvar.
    """

    fases_neutro: dict[str, Decimal]
    linhas: dict[str, Decimal]
    correntes: dict[str, Decimal]
    fator_potencia: Decimal
    potencia_reativa_kvar: Decimal


@dataclass(slots=True)
class MpptString:
    """Dado granular por string/port MPPT dentro de um inversor.

    Cada adapter traduz seu formato original (dict numerado do Solis, array
    do Foxess, ports do Hoymiles…) para essa lista. Slots com todos os
    valores zerados podem ser omitidos — o Solis retorna 32 slots mas
    tipicamente só 2 estão ativos.
    """

    indice: int
    tensao_v: Decimal | None = None
    corrente_a: Decimal | None = None
    potencia_w: Decimal | None = None


@dataclass(slots=True)
class DadosUsina:
    """Snapshot agregado de uma usina no instante da coleta.

    Todo valor numérico está na unidade canônica do sistema: kW, kWh, graus.
    Campos ausentes ficam None (nunca 0 como sentinela).
    """

    id_externo: str
    nome: str

    # Energia / potência — unidades canônicas
    capacidade_kwp: Decimal | None = None
    potencia_kw: Decimal | None = None
    energia_hoje_kwh: Decimal | None = None
    energia_mes_kwh: Decimal | None = None
    energia_total_kwh: Decimal | None = None

    # Estado — enum do sistema (`monitoramento.StatusLeitura`)
    status: str = "online"

    # Tempo
    medido_em: datetime | None = None

    # Localização — opcional, preenche quando o provedor expõe
    endereco: str = ""
    cidade: str = ""
    estado: str = ""
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    fuso_horario: str = "America/Sao_Paulo"

    # Contagem agregada (null quando provedor não expõe)
    qtd_inversores_total: int | None = None
    qtd_inversores_online: int | None = None

    # Payload bruto do provedor — auditoria/debug
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class DadosInversor:
    """Snapshot de um inversor/microinversor no instante da coleta.

    Todos os campos elétricos são opcionais. **Null ≠ 0**: null significa
    "provedor não expôs"; zero significa "provedor reportou zero". Essa
    distinção é crítica pras regras de alerta.
    """

    id_externo: str
    id_usina_externo: str
    numero_serie: str = ""
    modelo: str = ""
    tipo: str = "inversor"  # inversor | microinversor

    estado: str = "online"
    medido_em: datetime | None = None

    # Potência/energia
    pac_kw: Decimal | None = None
    energia_hoje_kwh: Decimal | None = None
    energia_total_kwh: Decimal | None = None

    # Elétricos — tudo opcional
    tensao_ac_v: Decimal | None = None
    corrente_ac_a: Decimal | None = None
    frequencia_hz: Decimal | None = None
    tensao_dc_v: Decimal | None = None
    corrente_dc_a: Decimal | None = None
    temperatura_c: Decimal | None = None
    soc_bateria_pct: Decimal | None = None

    # Tipo de ligação AC inferido pelo adapter (`monofasico`/`bifasico`/
    # `trifasico`) ou None quando não dá pra classificar.
    tipo_ligacao: str | None = None

    # Detalhe elétrico AC por fase. Schema em `EletricaAc` (TypedDict acima):
    # `fases_neutro`, `linhas`, `correntes`, `fator_potencia`,
    # `potencia_reativa_kvar` — todas as chaves opcionais.
    eletrica_ac: dict[str, Any] | None = None

    # Granular
    strings_mppt: list[MpptString] = field(default_factory=list)

    raw: dict[str, Any] = field(default_factory=dict)


# ── Capacidades declaradas pelo adapter ───────────────────────────────────

@dataclass(slots=True)
class Capacidades:
    """Propriedades do adapter que o worker usa para decidir como coletar.

    Cada adapter declara via `BaseAdapter.capacidades`. Valores refletem
    limites reais da API (FusionSolar rejeita <30min com failCode=407, por
    exemplo) e não devem ser alterados pelo usuário — o que o usuário
    controla é o `intervalo_coleta_minutos` em `ContaProvedor`, e o worker
    valida que é ≥ `intervalo_minimo_minutos`.
    """

    # Se expõe dados por equipamento individual
    expoe_inversores: bool = True

    # Se strings MPPT vêm detalhadas
    expoe_strings_mppt: bool = True

    # Rate limit
    requisicoes_por_janela: int = 5
    janela_segundos: int = 10

    # Intervalo mínimo entre coletas (em minutos). Validado no serializer
    # de `ContaProvedor`. Fusion=30, Hoymiles=10, Solis=10, Foxess=15,
    # Solarman=10, Auxsol=10.
    intervalo_minimo_minutos: int = 10


# ── Contrato ABC ──────────────────────────────────────────────────────────

class BaseAdapter(ABC):
    """Interface comum a todos os provedores.

    Construtor recebe as credenciais já **descriptografadas** (dict). Cache
    de token (quando o provedor é stateful) chega no mesmo dict via chave
    convencionada do adapter — cada um documenta as suas.
    """

    tipo: str = ""
    capacidades: Capacidades = Capacidades()

    def __init__(self, credenciais: dict[str, Any]) -> None:
        self._credenciais = credenciais

    @abstractmethod
    def buscar_usinas(self) -> list[DadosUsina]:
        """Retorna todas as usinas visíveis nessa conta."""

    @abstractmethod
    def buscar_inversores(self, id_usina_externo: str) -> list[DadosInversor]:
        """Retorna os inversores de uma usina específica.

        Pode retornar `[]` se o provedor não suporta (`capacidades.expoe_inversores`
        é o indicador que o worker consulta antes de chamar).
        """

    # ── Gerenciamento de token (stateful providers) ───────────────────────
    # Override nos adapters com sessão (Hoymiles, FusionSolar).

    def obter_cache_token(self) -> dict[str, Any] | None:
        """Retorna o token atual em formato serializável, pra ser guardado
        em `ContaProvedor.cache_token_enc`. `None` = não há token (stateless).
        """
        return None
