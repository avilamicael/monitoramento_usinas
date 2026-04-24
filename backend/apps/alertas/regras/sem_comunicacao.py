"""Regra `sem_comunicacao` — abre alerta se a usina não reporta há tempo
demais.

Threshold vem de `ConfiguracaoEmpresa.alerta_sem_comunicacao_minutos`
(default 60 min). Enquanto `Usina.ultima_leitura_em` está dentro da janela,
tudo ok. Quando passa do limite, abre `aviso`. Quando passa de 2× o limite,
escala pra `critico`.

Particularidades:
- Se a usina nunca coletou (`ultima_leitura_em is None`), retorna `None` —
  a regra não avalia enquanto não houver linha de base.
- Se a usina está `is_active=False`, retorna `None` — sem coleta esperada.

Essa é a regra que substitui toda a lógica de `s_uoff` supression do
sistema antigo: não precisa mais porque o sinal é a nossa ausência de
dados, não uma flag esquisita do provedor.
"""
from __future__ import annotations

from datetime import timedelta

from django.utils import timezone as djtz

from apps.alertas.models import SeveridadeAlerta

from .base import Anomalia, RegraUsina, registrar


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
        return Anomalia(
            severidade=severidade,
            mensagem=(
                f"Usina {usina.nome} sem comunicação há {minutos_sem_dado} min "
                f"(limite {limite_min} min)."
            ),
            contexto={
                "ultima_leitura_em": usina.ultima_leitura_em.isoformat(),
                "minutos_sem_dado": minutos_sem_dado,
                "limite_minutos": limite_min,
            },
        )
