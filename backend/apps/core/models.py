from __future__ import annotations

from django.db import models


class ConfiguracaoEmpresa(models.Model):
    """Configurações padrão por empresa. 1:1 com `empresas.Empresa`.

    Valores default que o sistema usa quando uma usina não define o seu
    próprio (ex.: garantia padrão, janela de alerta por falta de
    comunicação)."""

    empresa = models.OneToOneField(
        "empresas.Empresa", on_delete=models.CASCADE, related_name="configuracao"
    )
    garantia_padrao_meses = models.PositiveIntegerField(
        default=12,
        help_text="Meses de garantia padrão ao cadastrar uma usina nova.",
    )
    alerta_sem_comunicacao_minutos = models.PositiveIntegerField(
        default=60,
        help_text="Quantos minutos sem comunicação antes de abrir alerta.",
    )
    parar_alerta_apos_dias = models.PositiveIntegerField(
        default=7,
        help_text="Depois de quantos dias sem comunicação parar de gerar alertas.",
    )
    subdesempenho_limite_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=70,
        help_text="Percentual da capacidade esperada abaixo do qual alertar.",
    )
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
