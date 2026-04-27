"""Regra `subtensao_ac` — alerta quando a tensão AC fica abaixo do limite.

Espelho de `sobretensao_ac`. Threshold derivado de `Usina.tensao_nominal_v`
(default rede 220 V → 187 V; rede "110 V" / nominal real 127 V → 108 V),
com override manual em `Usina.tensao_ac_limite_minimo_v` quando o admin
muda esse campo.

Guard de potência mínima (`ConfiguracaoEmpresa.potencia_minima_avaliacao_kw`,
default 0.5 kW): inversor em standby reporta `tensao_ac_v=0`, o que não é
subtensão real. A regra retorna `False` (resolve alerta aberto, se houver) —
inversor desligado não está com subtensão; se voltar a ligar e ainda tiver
problema, abre de novo no próximo ciclo.
"""
from __future__ import annotations

from decimal import Decimal

from apps.alertas.models import SeveridadeAlerta

from ._helpers import threshold_subtensao_v
from .base import Anomalia, RegraInversor, registrar


@registrar
class SubtensaoAc(RegraInversor):
    nome = "subtensao_ac"
    severidade_padrao = SeveridadeAlerta.AVISO

    def avaliar(self, inversor, leitura, config) -> Anomalia | None | bool:
        if leitura is None or leitura.tensao_ac_v is None:
            return None

        # Guard: inversor desligado/em transição não tem tensão real para medir.
        # Retorna False (resolve alerta aberto) — standby ≠ subtensão.
        if leitura.pac_kw is None:
            return False
        potencia_min = Decimal(str(config.potencia_minima_avaliacao_kw))
        if Decimal(str(leitura.pac_kw)) < potencia_min:
            return False

        limite = threshold_subtensao_v(inversor.usina)
        tensao = leitura.tensao_ac_v

        if tensao >= limite:
            return False

        return Anomalia(
            severidade=self.severidade_padrao,
            mensagem=(
                f"Tensão AC {tensao} V abaixo do limite ({limite} V) no "
                f"inversor {inversor.numero_serie or inversor.id_externo}."
            ),
            contexto={
                "tensao_ac_v": str(tensao),
                "limite_minimo_v": str(limite),
                "leitura_id": str(leitura.pk) if leitura.pk else None,
                "medido_em": leitura.medido_em.isoformat() if leitura.medido_em else None,
            },
        )
