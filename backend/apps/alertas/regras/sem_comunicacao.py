"""Regra `sem_comunicacao` — abre alerta se a usina não reporta há tempo
demais.

Threshold vem de `ConfiguracaoEmpresa.alerta_sem_comunicacao_minutos`
(default 1440 min = 24h após calibração 2026-04-27). Enquanto
`Usina.ultima_leitura_em` (= `medido_em` da última leitura) está dentro
da janela, tudo ok. Quando passa do limite, abre `aviso`. Quando passa
de 2× o limite, escala pra `critico`.

Particularidades:
- Comparação SEMPRE usa `medido_em` (timestamp do provedor), nunca
  `coletado_em` (timestamp da nossa coleta). A coleta pode rodar com
  sucesso e devolver leitura velha (provedor cacheado/Wi-Fi caído com
  resposta 200 OK estável). Só `medido_em` reflete se o equipamento de
  fato reportou.
- Se a usina nunca coletou ou o provedor não expõe `medido_em`
  (`ultima_leitura_em is None`), retorna `None` — a regra não avalia
  enquanto não houver linha de base. Provedores sem `medido_em`
  (FusionSolar, Foxess) cobertos por `sem_geracao_horario_solar`/
  `dado_eletrico_ausente`.
- Se a usina está `is_active=False`, retorna `None` — sem coleta esperada.

Essa é a regra que substitui toda a lógica de `s_uoff` supression do
sistema antigo: não precisa mais porque o sinal é a nossa ausência de
dados, não uma flag esquisita do provedor.
"""
from __future__ import annotations

import zoneinfo
from datetime import timedelta

from django.utils import timezone as djtz

from apps.alertas.models import SeveridadeAlerta

from .base import Anomalia, RegraUsina, registrar


def _formatar_local(dt, fuso: str) -> str:
    """dd/mm hh:mm no fuso da usina (default America/Sao_Paulo)."""
    try:
        tz = zoneinfo.ZoneInfo(fuso or "America/Sao_Paulo")
    except zoneinfo.ZoneInfoNotFoundError:
        tz = zoneinfo.ZoneInfo("America/Sao_Paulo")
    return dt.astimezone(tz).strftime("%d/%m %H:%M")


@registrar
class SemComunicacao(RegraUsina):
    nome = "sem_comunicacao"
    severidade_padrao = SeveridadeAlerta.AVISO

    def avaliar(self, usina, leitura, config) -> Anomalia | None | bool:
        if not usina.is_active:
            return None
        if usina.ultima_leitura_em is None:
            return None

        limite_min = config.alerta_sem_comunicacao_minutos
        agora = djtz.now()
        idade = agora - usina.ultima_leitura_em

        if idade <= timedelta(minutes=limite_min):
            return False

        # Escala pra crítico depois de 2× o limite.
        severidade = (
            SeveridadeAlerta.CRITICO
            if idade > timedelta(minutes=limite_min * 2)
            else SeveridadeAlerta.AVISO
        )
        minutos_sem_dado = int(idade.total_seconds() // 60)
        horas_sem_dado = minutos_sem_dado / 60
        ultima_str = _formatar_local(usina.ultima_leitura_em, usina.fuso_horario)
        return Anomalia(
            severidade=severidade,
            mensagem=(
                f"Sem leitura nova há {horas_sem_dado:.1f} horas "
                f"(última: {ultima_str})."
            ),
            contexto={
                "ultima_leitura_em": usina.ultima_leitura_em.isoformat(),
                "minutos_sem_dado": minutos_sem_dado,
                "limite_minutos": limite_min,
            },
        )
