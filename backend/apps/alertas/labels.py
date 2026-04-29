"""Labels amigáveis para nomes de regras.

Mensagens exibidas ao usuário (em alertas, agregações, contextos) devem
usar essas strings em vez do `nome` técnico (`subtensao_ac`, etc) que é
identificador interno.
"""
from __future__ import annotations

REGRA_LABELS: dict[str, str] = {
    "subtensao_ac": "subtensão AC",
    "sobretensao_ac": "sobretensão AC",
    "frequencia_anomala": "frequência anômala",
    "temperatura_alta": "temperatura alta",
    "inversor_offline": "inversor offline",
    "string_mppt_zerada": "string MPPT zerada",
    "dado_eletrico_ausente": "dado elétrico ausente",
    "sem_comunicacao": "sem comunicação",
    "sem_geracao_horario_solar": "sem geração em horário solar",
    "subdesempenho": "subdesempenho",
    "queda_rendimento": "queda de rendimento",
    "garantia_vencendo": "garantia vencendo",
}


def rotular_regra(nome: str) -> str:
    """Devolve o label amigável de uma regra. Fallback: o próprio nome."""
    return REGRA_LABELS.get(nome, nome)
