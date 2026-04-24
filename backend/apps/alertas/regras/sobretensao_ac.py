"""Regra `sobretensao_ac` — alerta quando a tensão AC passa do limite da usina.

Avaliada por inversor. Usa `Usina.tensao_ac_limite_v` (configurável, default
240 V) como threshold — sobretensão é sensível à região da rede, por isso
fica por usina e não global.

Comportamento:
- `leitura is None` ou `tensao_ac_v is None` → retorna `None` (não avalia).
- Tensão ≤ limite → `False` (motor fecha alerta se existir).
- Tensão > limite → `Anomalia(crítico)`.
"""
from __future__ import annotations

from decimal import Decimal

from apps.alertas.models import SeveridadeAlerta

from .base import Anomalia, RegraInversor, registrar


@registrar
class SobretensaoAc(RegraInversor):
    nome = "sobretensao_ac"
    severidade_padrao = SeveridadeAlerta.CRITICO

    def avaliar(self, inversor, leitura, config) -> Anomalia | None | bool:
        if leitura is None or leitura.tensao_ac_v is None:
            return None

        limite = Decimal(str(inversor.usina.tensao_ac_limite_v))
        tensao = leitura.tensao_ac_v

        if tensao <= limite:
            return False

        return Anomalia(
            severidade=self.severidade_padrao,
            mensagem=(
                f"Tensão AC {tensao} V acima do limite ({limite} V) no "
                f"inversor {inversor.numero_serie or inversor.id_externo}."
            ),
            contexto={
                "tensao_ac_v": str(tensao),
                "limite_v": str(limite),
                "leitura_id": str(leitura.pk) if leitura.pk else None,
                "medido_em": leitura.medido_em.isoformat() if leitura.medido_em else None,
            },
        )
