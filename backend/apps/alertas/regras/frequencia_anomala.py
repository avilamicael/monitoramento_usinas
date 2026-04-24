"""Regra `frequencia_anomala` — alerta se a frequência sai da faixa.

Limites em `Usina.frequencia_minimo_hz` e `frequencia_maximo_hz` (default
59.5 / 60.5 Hz, padrão ONS para o Brasil). Configurável por usina porque
em alguns alimentadores rurais ou ilhas de geração a faixa pode ser
legitimamente mais larga.
"""
from __future__ import annotations

from decimal import Decimal

from apps.alertas.models import SeveridadeAlerta

from .base import Anomalia, RegraInversor, registrar


@registrar
class FrequenciaAnomala(RegraInversor):
    nome = "frequencia_anomala"
    severidade_padrao = SeveridadeAlerta.AVISO

    def avaliar(self, inversor, leitura, config) -> Anomalia | None | bool:
        if leitura is None or leitura.frequencia_hz is None:
            return None

        usina = inversor.usina
        minimo = Decimal(str(usina.frequencia_minimo_hz))
        maximo = Decimal(str(usina.frequencia_maximo_hz))
        freq = leitura.frequencia_hz

        if minimo <= freq <= maximo:
            return False

        return Anomalia(
            severidade=self.severidade_padrao,
            mensagem=(
                f"Frequência {freq} Hz fora da faixa "
                f"[{minimo}, {maximo}] no inversor "
                f"{inversor.numero_serie or inversor.id_externo}."
            ),
            contexto={
                "frequencia_hz": str(freq),
                "limite_minimo_hz": str(minimo),
                "limite_maximo_hz": str(maximo),
                "leitura_id": str(leitura.pk) if leitura.pk else None,
                "medido_em": leitura.medido_em.isoformat() if leitura.medido_em else None,
            },
        )
