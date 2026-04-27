"""Regra `sobretensao_ac` — alerta quando a tensão AC passa do limite da usina.

Avaliada por inversor. Threshold derivado de `Usina.tensao_nominal_v`
(rede 220 V → 242 V; rede "110 V" / nominal real 127 V → 140 V), com
override manual em `Usina.tensao_ac_limite_v` quando o admin muda esse
campo. Sobretensão é sensível à região da rede, por isso fica por usina e
não global.

Comportamento:
- `leitura is None` ou `tensao_ac_v is None` → retorna `None` (não avalia).
- Tensão ≤ limite → `False` (motor fecha alerta se existir).
- Tensão > limite → `Anomalia(crítico)`.
"""
from __future__ import annotations

from apps.alertas.models import SeveridadeAlerta

from ._helpers import threshold_sobretensao_v
from .base import Anomalia, RegraInversor, registrar


@registrar
class SobretensaoAc(RegraInversor):
    nome = "sobretensao_ac"
    # Decisão 2026-04-27: sobretensão é problema de rede (concessionária),
    # não derruba o sistema; rebaixado de CRITICO para AVISO.
    severidade_padrao = SeveridadeAlerta.AVISO
    # Vários inversores da mesma usina costumam disparar juntos quando a
    # rede está alta — agrega tudo em 1 alerta por usina.
    agregar_por_usina = True

    def avaliar(self, inversor, leitura, config) -> Anomalia | None | bool:
        if leitura is None or leitura.tensao_ac_v is None:
            return None

        limite = threshold_sobretensao_v(inversor.usina)
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
