"""Regra `string_mppt_zerada`.

Detecta quando uma string MPPT (entrada de painéis) está reportando 0 W
enquanto outras strings do mesmo inversor estão gerando bem (>500 W).
Diagnóstico típico: painel queimado, conector solto, fusível, sombra
permanente (árvore crescendo, prédio novo).

Sem histerese: nuvem passageira numa string específica vai disparar e
fechar sozinha. User aceita esse barulho — sistema só comunica.

A regra só roda quando o inversor tem >= 2 strings reportadas — único
modelo precisa de outro sinal pra saber se está com problema.
"""
from __future__ import annotations

from decimal import Decimal

from apps.alertas.models import SeveridadeAlerta

from .base import Anomalia, RegraInversor, registrar

# Limite mínimo de potência em uma OUTRA string pra considerar o cenário
# como "outras strings estão gerando bem".
_REFERENCIA_W = Decimal("500")


@registrar
class StringMpptZerada(RegraInversor):
    nome = "string_mppt_zerada"
    severidade_padrao = SeveridadeAlerta.AVISO
    # Sombra/falha em painéis costuma se replicar em mais de um inversor
    # (mesmo arranjo de telhado). Agrega por usina.
    agregar_por_usina = True

    def avaliar(self, inversor, leitura, config) -> Anomalia | None | bool:
        if leitura is None:
            return None

        # `strings_mppt` é JSONField (lista de dicts).
        strings = leitura.strings_mppt or []
        if len(strings) < 2:
            return None

        zeradas = []
        outras_potentes = False
        for s in strings:
            potencia_w = s.get("potencia_w")
            if potencia_w is None:
                continue
            try:
                p = Decimal(str(potencia_w))
            except Exception:
                continue
            if p == 0:
                zeradas.append(s.get("indice"))
            elif p >= _REFERENCIA_W:
                outras_potentes = True

        if not zeradas or not outras_potentes:
            return False

        return Anomalia(
            severidade=self.severidade_padrao,
            mensagem=(
                f"String(s) MPPT zerada(s): {zeradas} no inversor "
                f"{inversor.numero_serie or inversor.id_externo} "
                f"(outras strings gerando >500 W)."
            ),
            contexto={
                "strings_zeradas": zeradas,
                "leitura_id": str(leitura.pk) if leitura.pk else None,
                "medido_em": leitura.medido_em.isoformat() if leitura.medido_em else None,
            },
        )
