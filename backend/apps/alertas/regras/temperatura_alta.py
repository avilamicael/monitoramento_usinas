"""Regra `temperatura_alta` — alerta quando o inversor passa do limite.

Cascata de threshold: `Inversor.temperatura_limite_c` (null → cai pra
`ConfiguracaoEmpresa.temperatura_limite_c`, default 75°C).

Modelos diferentes de inversor toleram temperaturas diferentes —
string inverter trifásico opera quente normalmente (60-80°C); microinversor
em telhado costuma ficar mais fresco. Por isso o override é por inversor.
"""
from __future__ import annotations

from decimal import Decimal

from apps.alertas.models import SeveridadeAlerta

from .base import Anomalia, RegraInversor, registrar


@registrar
class TemperaturaAlta(RegraInversor):
    nome = "temperatura_alta"
    severidade_padrao = SeveridadeAlerta.AVISO

    def avaliar(self, inversor, leitura, config) -> Anomalia | None | bool:
        if leitura is None or leitura.temperatura_c is None:
            return None

        limite = inversor.temperatura_limite_c or config.temperatura_limite_c
        if limite is None:
            return None
        limite = Decimal(str(limite))
        temp = leitura.temperatura_c

        if temp <= limite:
            return False

        return Anomalia(
            severidade=self.severidade_padrao,
            mensagem=(
                f"Temperatura {temp}°C acima do limite ({limite}°C) no "
                f"inversor {inversor.numero_serie or inversor.id_externo}."
            ),
            contexto={
                "temperatura_c": str(temp),
                "limite_c": str(limite),
                "leitura_id": str(leitura.pk) if leitura.pk else None,
                "medido_em": leitura.medido_em.isoformat() if leitura.medido_em else None,
            },
        )
