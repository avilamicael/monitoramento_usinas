from __future__ import annotations

from datetime import time

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
        default=60,
        help_text="Minutos sem `medido_em` antes de abrir alerta.",
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
        default=30,
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
