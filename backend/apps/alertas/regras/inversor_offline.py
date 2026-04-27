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

Tri-state estrito (calibração 2026-04-27):
- `leitura.estado is None` → `None`. O provedor não conseguiu ler o
  status do inversor agora; tratar como ausente, não como offline.
- `medido_em` muito recente (≤30min) + estado=offline → `None`. Isso é
  transição (início/fim de janela solar, microquedas de comunicação) e
  não anomalia persistente. Carência por coletas consecutivas resolve
  isso "estatisticamente"; o guard explícito reduz ainda mais o ruído.
- `medido_em` ausente (`None`) e estado=offline → segue para a verificação
  de carência. Sem timestamp do provedor, contamos só com nossas leituras.
- `medido_em` muito antiga (>6h) + estado=offline em horário solar → é
  offline real, segue lógica de carência.

Carência (`ConfiguracaoEmpresa.inversor_offline_coletas_minimas`, default 3):
inversor precisa estar `estado=offline` em N coletas consecutivas antes de
abrir alerta. Evita ruído de inversores que ligam/desligam minutos depois
dos vizinhos no início/fim do dia. Quando N coletas seguidas vierem
`estado=offline`, dispara; basta 1 leitura `online`/`alerta` pra resetar
e fechar alerta aberto.
"""
from __future__ import annotations

from datetime import timedelta

from django.utils import timezone as djtz

from apps.alertas.models import SeveridadeAlerta
from apps.monitoramento.models import LeituraInversor, LeituraUsina

from ._helpers import aproximadamente_zero, em_horario_solar
from .base import Anomalia, RegraInversor, registrar

# Janela em que estado=offline é considerado "transitório" e não dispara.
# 30 min cobre a transição de início/fim de janela solar e microquedas
# pontuais; passou disso, é ofensa real.
_JANELA_TRANSIENTE = timedelta(minutes=30)


@registrar
class InversorOffline(RegraInversor):
    nome = "inversor_offline"
    severidade_padrao = SeveridadeAlerta.AVISO
    # 1 alerta por usina listando todos os inversores offline. 5 inversores
    # caindo na mesma usina vira "5 inversores offline" e não 5 cards
    # repetidos.
    agregar_por_usina = True

    def avaliar(self, inversor, leitura, config) -> Anomalia | None | bool:
        if leitura is None:
            return None

        # `estado=None` significa "provedor não reportou status agora" —
        # diferente de `estado=offline` (provedor afirmou offline).
        # Tratamos como ausente pra não criar alerta com base em ausência
        # de dado. NUNCA virar offline implícito.
        if leitura.estado is None:
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

        # Guard de transitoriedade: se a leitura é fresquinha (medido_em
        # nos últimos 30 min) e o estado é offline, é provavelmente
        # standby/transição, não anomalia. Retorna None pra não criar
        # nem fechar alerta — a próxima coleta com mais idade decide.
        if leitura.medido_em is not None:
            agora = djtz.now()
            idade = agora - leitura.medido_em
            if idade <= _JANELA_TRANSIENTE:
                return None

        # Carência: precisa de N coletas consecutivas em offline.
        n_minimo = max(1, int(config.inversor_offline_coletas_minimas))
        ultimas = list(
            LeituraInversor.objects
            .filter(inversor=inversor)
            .order_by("-coletado_em")
            .values_list("estado", flat=True)[:n_minimo]
        )
        if len(ultimas) < n_minimo or any(e != "offline" for e in ultimas):
            return None

        return Anomalia(
            severidade=self.severidade_padrao,
            mensagem=(
                f"Inversor {inversor.numero_serie or inversor.id_externo} "
                f"offline há {n_minimo} coletas consecutivas enquanto a usina "
                f"{inversor.usina.nome} gera {leitura_usina.potencia_kw} kW."
            ),
            contexto={
                "estado_inversor": leitura.estado,
                "potencia_usina_kw": str(leitura_usina.potencia_kw),
                "coletas_consecutivas_offline": n_minimo,
                "leitura_id": str(leitura.pk) if leitura.pk else None,
            },
        )
