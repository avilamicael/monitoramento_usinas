"""Regra `inversor_offline` — um inversor offline enquanto a usina gera.

Diferenciação importante (insight do user):
- **`sem_comunicacao`** (regra de usina): a usina toda parou de reportar
  (Wi-Fi caiu, datalogger sem conexão).
- **`inversor_offline`** (esta): UM inversor específico está offline
  enquanto outros da MESMA usina seguem gerando.

Por isso a regra só dispara se a usina tem `potencia_kw > 0` no momento
(=algum equipamento gerando) — caso contrário, o problema é da usina
inteira, não desse inversor.

Também só roda em horário solar — inversor "offline" às 22h é apenas o
sol pôs.
"""
from __future__ import annotations

from apps.alertas.models import SeveridadeAlerta
from apps.monitoramento.models import LeituraUsina

from ._helpers import aproximadamente_zero, em_horario_solar
from .base import Anomalia, RegraInversor, registrar


@registrar
class InversorOffline(RegraInversor):
    nome = "inversor_offline"
    severidade_padrao = SeveridadeAlerta.AVISO

    def avaliar(self, inversor, leitura, config) -> Anomalia | None | bool:
        if leitura is None:
            return None

        if not em_horario_solar(inversor.usina, config):
            return None

        # Pega a leitura mais recente da usina pra saber se ela está
        # gerando como um todo.
        leitura_usina = (
            LeituraUsina.objects
            .filter(usina=inversor.usina)
            .order_by("-coletado_em")
            .first()
        )
        if leitura_usina is None or leitura_usina.potencia_kw is None:
            return None
        if aproximadamente_zero(leitura_usina.potencia_kw):
            # Usina inteira não está gerando — outras regras tratam disso.
            return None

        if leitura.estado != "offline":
            return False

        return Anomalia(
            severidade=self.severidade_padrao,
            mensagem=(
                f"Inversor {inversor.numero_serie or inversor.id_externo} "
                f"offline enquanto a usina {inversor.usina.nome} gera "
                f"{leitura_usina.potencia_kw} kW."
            ),
            contexto={
                "estado_inversor": leitura.estado,
                "potencia_usina_kw": str(leitura_usina.potencia_kw),
                "leitura_id": str(leitura.pk) if leitura.pk else None,
            },
        )
