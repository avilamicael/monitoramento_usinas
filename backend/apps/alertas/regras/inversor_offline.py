"""Regra `inversor_offline` — inversor desconectado em horário solar.

Cobre dois cenários no mesmo critério:
- 1 inversor caiu enquanto outros seguem gerando (cliente perdeu uma
  string, queimou MPPT, etc.).
- TODOS os inversores da usina estão offline (cliente trocou Wi-Fi,
  desligou disjuntor, equipamento parou de comunicar antes mesmo da
  primeira geração — caso comum em cliente novo cadastrando usinas).

A diferenciação fica visível no card agregado: `agregar_por_usina=True`
faz o motor consolidar em 1 alerta por usina com `qtd_inversores_afetados`
vs `total_inversores_da_usina` no contexto. UI mostra "5 de 5 offline" ou
"1 de 5 offline".

Decisão (refactor 2026-05-06): a regra NÃO checa mais `usina.potencia_kw>0`.
A versão antiga deixava cego o caso "usina inteira morta" porque jogava a
bola para `sem_geracao_horario_solar`, que silenciava em pico baixo (cliente
novo nunca gerou) e para `sem_comunicacao`, que era enganada por adapters
preenchendo `medido_em` falso. O sinal `inversor.estado='offline'` é o mais
limpo — quando todos estão offline em horário solar, é problema real
independentemente da potência reportada.

`em_horario_solar` ainda blinda o caso "à noite tudo offline" — fora da
janela astral (fallback fixa 8h–18h), a regra não avalia.

Tri-state estrito:
- `leitura.estado is None` → `None`. O provedor não conseguiu ler o
  status do inversor agora; tratar como ausente, não como offline.
- `medido_em` muito recente (≤30min) + estado=offline → `None`. Isso é
  transição (início/fim de janela solar, microquedas de comunicação) e
  não anomalia persistente. Carência por coletas consecutivas resolve
  isso "estatisticamente"; o guard explícito reduz ainda mais o ruído.
- `medido_em` ausente (`None`, adapter sem timestamp real ou equipamento
  offline) → segue para a verificação de carência. Sem timestamp do
  provedor, contamos só com nossas leituras.

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
from apps.monitoramento.models import LeituraInversor

from ._helpers import em_horario_solar
from .base import Anomalia, RegraInversor, registrar

# Janela em que estado=offline é considerado "transitório" e não dispara.
# 30 min cobre a transição de início/fim de janela solar e microquedas
# pontuais; passou disso, é ofensa real.
_JANELA_TRANSIENTE = timedelta(minutes=30)


@registrar
class InversorOffline(RegraInversor):
    nome = "inversor_offline"
    severidade_padrao = SeveridadeAlerta.AVISO
    # Quando TODOS os inversores da usina estão offline, escala para crítico —
    # usina inteira parada significa zero geração, problema de Wi-Fi/disjuntor/
    # falha total que precisa de ação imediata (vs perda parcial = aviso).
    severidade_se_todos_afetados = SeveridadeAlerta.CRITICO
    severidade_dinamica = True  # motor decide a escalada; admin não edita.
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
                f"offline há {n_minimo} coletas consecutivas."
            ),
            contexto={
                "estado_inversor": leitura.estado,
                "coletas_consecutivas_offline": n_minimo,
                "leitura_id": str(leitura.pk) if leitura.pk else None,
            },
        )
