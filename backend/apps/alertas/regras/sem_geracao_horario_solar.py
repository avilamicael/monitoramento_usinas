"""Regra `sem_geracao_horario_solar`.

A regra mais importante do sistema na visão do produto: se o sol está
disponível e a usina reporta potência ≈ 0 **abruptamente**, alguma coisa
está errada — **crítico**.

Cobre: Wi-Fi caiu durante o dia e o provedor continua reportando o último
valor (zero), inversor desligado em pleno meio-dia, disjuntor aberto, falha
de string total, etc.

Janela solar — astral por usina, fallback configurável
------------------------------------------------------
Quando `usina.latitude` e `usina.longitude` estão preenchidos, a janela
é calculada via biblioteca `astral`: `(sunrise + 1h, sunset - 1h)` no fuso
local da usina. Em SC no inverno, isso fica em torno de 07:30→17:00; no
verão, 06:30→19:30. O buffer de 1h evita borda de baixa luz/sombra natural.

Sem lat/lon, fallback para `ConfiguracaoEmpresa.horario_solar_inicio/_fim`
(default 08:00–18:00). Use o endpoint `POST /api/usinas/geocode/` ou o
management command `python manage.py geocode_usinas` para preencher
automaticamente a partir de CEP/endereço.

Detecção de queda abrupta vs curva natural
------------------------------------------
A janela ainda pode incluir momentos de geração baixa em dias ruins. Pra
evitar falso positivo, quatro proteções:

1. **Buffer de fim de dia (`_BUFFER_FIM_DIA_MIN`, 90 min):** quando faltam
   menos de 90 min para o fim da janela, a queda pra 0 é considerada curva
   natural (sol descendo, sombra de telhado, etc.) — não dispara.

2. **Leitura anterior baixa** (`sem_geracao_queda_abrupta_pct`): se a
   anterior já estava abaixo do limiar, é curva natural — não dispara.

3. **Pico do dia baixo** (mesmo limiar): se a maior potência registrada
   hoje nunca passou do limiar, a usina nunca esteve gerando "de verdade"
   (dia muito nublado, orientação ruim, sombra crônica, sub-instalação) —
   não dispara. Sem essa proteção, qualquer usina ruim acumularia falsos
   alertas todo fim de tarde.

4. Caso contrário (anterior > limiar OU pico > limiar, e ainda longe do
   fim do dia) → queda abrupta real → dispara o alerta crítico.
"""
from __future__ import annotations

import zoneinfo
from datetime import datetime, timedelta
from decimal import Decimal

from apps.alertas.models import SeveridadeAlerta
from apps.monitoramento.models import LeituraUsina

from ._helpers import _janela_astral, aproximadamente_zero, em_horario_solar
from .base import Anomalia, RegraUsina, registrar

# Buffer de fim de dia: quando faltam menos que isto até o fim da janela
# solar, a queda para 0 é considerada curva natural (sol descendo) e a
# regra não dispara. 90 min cobre a transição típica em SC entre o pico
# (12h-14h) e o pôr do sol efetivo, considerando a sombra de telhados
# orientados a leste e ângulo desfavorável.
_BUFFER_FIM_DIA_MIN = 90


@registrar
class SemGeracaoHorarioSolar(RegraUsina):
    nome = "sem_geracao_horario_solar"
    severidade_padrao = SeveridadeAlerta.CRITICO

    def avaliar(self, usina, leitura, config) -> Anomalia | None | bool:
        # Fora do horário solar — a regra não se aplica (não abre nem fecha).
        # Alertas pré-existentes ficam intactos até o motor reavaliar dentro
        # da janela. Se o problema persistir até amanhã às 8h, dispara de novo.
        if not em_horario_solar(usina, config):
            return None

        if leitura is None or leitura.potencia_kw is None:
            return None

        # Sem capacidade cadastrada (kWp = 0 ou None) não há baseline pra
        # avaliar geração — usina com cadastro incompleto. Resolve alerta
        # aberto e não dispara novo (admin precisa preencher capacidade).
        if not usina.capacidade_kwp or usina.capacidade_kwp <= 0:
            return False

        # Provedor reportando `status=offline` é falha de comunicação ou
        # equipamento desligado — caso de `sem_comunicacao`/`inversor_offline`,
        # não de "sem gerar anômalo". Resolve alerta aberto e deixa as outras
        # regras tratarem o problema real.
        if leitura.status == "offline":
            return False

        if not aproximadamente_zero(leitura.potencia_kw):
            return False

        # Resolução da janela (astral por usina, fallback configurável).
        try:
            tz = zoneinfo.ZoneInfo(usina.fuso_horario or "America/Sao_Paulo")
        except zoneinfo.ZoneInfoNotFoundError:
            tz = zoneinfo.ZoneInfo("America/Sao_Paulo")
        agora_local = datetime.now(tz=tz)
        hoje_local = agora_local.date()
        janela_astral = _janela_astral(usina, hoje_local)

        if janela_astral is not None:
            inicio, fim = janela_astral
            origem_janela = "astral"
        else:
            inicio = config.horario_solar_inicio
            fim = config.horario_solar_fim
            origem_janela = "fixa"

        # Buffer de fim de dia: a queda pra 0 perto do fim da janela é
        # curva natural, não anomalia. Não dispara nesse intervalo;
        # alertas já abertos persistem até sair da janela ou voltar a gerar.
        fim_local = datetime.combine(hoje_local, fim, tzinfo=tz)
        minutos_ate_fim = (fim_local - agora_local).total_seconds() / 60
        if 0 <= minutos_ate_fim < _BUFFER_FIM_DIA_MIN:
            return None

        # Potência atual ≈ 0 — distinguir curva natural de queda abrupta
        # comparando com a leitura anterior e com o pico do dia.
        anterior = (
            LeituraUsina.objects
            .filter(usina=usina, coletado_em__lt=leitura.coletado_em)
            .order_by("-coletado_em")
            .values_list("potencia_kw", flat=True)
            .first()
        )
        capacidade = usina.capacidade_kwp
        if capacidade and capacidade > 0:
            limiar_pct = Decimal(str(config.sem_geracao_queda_abrupta_pct))

            # Heurística 1 — leitura imediatamente anterior já estava baixa:
            # curva natural (sol ainda subindo de manhã ou descendo no fim
            # da tarde), não anomalia.
            if anterior is not None:
                anterior_pct = (Decimal(str(anterior)) / Decimal(str(capacidade))) * 100
                if anterior_pct < limiar_pct:
                    return None

            # Heurística 2 — pico do dia foi baixo: usina nunca esteve
            # gerando "de verdade" hoje (dia muito nublado, orientação
            # ruim, sombra crônica, ou usina sub-instalada). "Cair pra 0"
            # nesse contexto não é anomalia — é continuação do quadro.
            inicio_dia_local = datetime.combine(
                hoje_local, datetime.min.time(), tzinfo=tz
            )
            pico = (
                LeituraUsina.objects
                .filter(usina=usina, coletado_em__gte=inicio_dia_local)
                .values_list("potencia_kw", flat=True)
                .order_by("-potencia_kw")
                .first()
            )
            if pico is not None:
                pico_pct = (Decimal(str(pico)) / Decimal(str(capacidade))) * 100
                if pico_pct < limiar_pct:
                    return None

        return Anomalia(
            severidade=self.severidade_padrao,
            mensagem=(
                f"Sem gerar em horário solar "
                f"({inicio:%H:%M}–{fim:%H:%M}) — potência {leitura.potencia_kw} kW."
            ),
            contexto={
                "potencia_kw": str(leitura.potencia_kw),
                "potencia_anterior_kw": str(anterior) if anterior is not None else None,
                "capacidade_kwp": str(capacidade) if capacidade else None,
                "janela_inicio": inicio.isoformat(),
                "janela_fim": fim.isoformat(),
                "janela_origem": origem_janela,
                "fuso_horario": usina.fuso_horario,
                "leitura_id": str(leitura.pk) if leitura.pk else None,
            },
        )
