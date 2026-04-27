from __future__ import annotations

from datetime import time
from decimal import Decimal

from django.db import models


class ConfiguracaoEmpresa(models.Model):
    """Configurações padrão por empresa. 1:1 com `empresas.Empresa`.

    Valores default que o sistema usa quando uma usina não define o seu
    próprio (ex.: garantia padrão, janela de alerta por falta de
    comunicação).
    """

    empresa = models.OneToOneField(
        "empresas.Empresa", on_delete=models.CASCADE, related_name="configuracao"
    )

    # ── Garantia ─────────────────────────────────────────────────────────
    garantia_padrao_meses = models.PositiveIntegerField(
        default=12,
        help_text="Meses de garantia padrão ao cadastrar uma usina nova.",
    )
    garantia_aviso_dias = models.PositiveIntegerField(
        default=30,
        help_text="Dias antes do fim da garantia para abrir alerta info.",
    )
    garantia_critico_dias = models.PositiveIntegerField(
        default=7,
        help_text="Dias antes do fim para escalar o alerta a aviso.",
    )

    # ── Horário solar (regra sem_geracao_horario_solar) ──────────────────
    horario_solar_inicio = models.TimeField(
        default=time(8, 0),
        help_text="Hora (fuso da usina) a partir da qual a usina deve estar gerando.",
    )
    horario_solar_fim = models.TimeField(
        default=time(18, 0),
        help_text="Hora limite até a qual a usina deve estar gerando.",
    )

    # ── Regras de alerta ─────────────────────────────────────────────────
    alerta_sem_comunicacao_minutos = models.PositiveIntegerField(
        default=1440,
        help_text=(
            "Minutos sem `medido_em` antes de abrir alerta. Default 24h "
            "(1440 min) — coleta pode rodar com sucesso e devolver leitura "
            "velha por horas se o provedor cachear, então 60 min gerava "
            "muito ruído. Configurável por empresa."
        ),
    )
    alerta_dado_ausente_coletas = models.PositiveIntegerField(
        default=10,
        help_text=(
            "Número de coletas consecutivas com campo elétrico null antes de "
            "abrir alerta `dado_eletrico_ausente`."
        ),
    )
    subdesempenho_limite_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=15,
        help_text="Abaixo desse % da capacidade instalada, abre subdesempenho.",
    )
    queda_rendimento_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=60,
        help_text="Abaixo desse % da média dos últimos 7 dias, abre queda_rendimento.",
    )
    temperatura_limite_c = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=75,
        help_text="Limite padrão de temperatura (°C) quando o Inversor não define.",
    )
    potencia_minima_avaliacao_kw = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        default=Decimal("0.5"),
        help_text=(
            "Potência AC mínima (kW) para avaliar regras elétricas por inversor "
            "(frequencia_anomala, subtensao_ac). Abaixo disso o inversor está "
            "em standby/transição e leituras de tensão/frequência não são "
            "confiáveis."
        ),
    )
    inversor_offline_coletas_minimas = models.PositiveSmallIntegerField(
        default=3,
        help_text=(
            "Número de coletas consecutivas em estado=offline antes de abrir "
            "alerta inversor_offline. Evita ruído de inversores que ligam/desligam "
            "em horários levemente diferentes."
        ),
    )
    sem_geracao_queda_abrupta_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("5"),
        help_text=(
            "% da capacidade na leitura imediatamente anterior. Se a anterior "
            "estava acima disso e agora a usina está em zero, é queda abrupta — "
            "abre sem_geracao_horario_solar. Senão (curva natural de fim de dia), "
            "não dispara."
        ),
    )

    # ── Retenção ─────────────────────────────────────────────────────────
    retencao_leituras_dias = models.PositiveIntegerField(
        default=90,
        help_text=(
            "Quantos dias de leituras (LeituraUsina / LeituraInversor) manter. "
            "Leituras mais antigas são apagadas por task diária. Alertas não são "
            "afetados."
        ),
    )

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuração da empresa"
        verbose_name_plural = "Configurações das empresas"
        ordering = ("empresa_id",)
