from __future__ import annotations

from django.db import models

from apps.empresas.models import EscopoEmpresa


class LeituraUsina(EscopoEmpresa):
    """Leitura pontual de uma usina. Escrita é append-only via worker."""

    usina = models.ForeignKey(
        "usinas.Usina", on_delete=models.CASCADE, related_name="leituras"
    )
    medido_em = models.DateTimeField()
    potencia_atual_kw = models.DecimalField(
        max_digits=12, decimal_places=3, null=True, blank=True
    )
    energia_hoje_kwh = models.DecimalField(
        max_digits=12, decimal_places=3, null=True, blank=True
    )
    energia_total_kwh = models.DecimalField(
        max_digits=14, decimal_places=3, null=True, blank=True
    )
    status = models.CharField(max_length=40, blank=True, default="")
    bruto = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "Leitura de usina"
        verbose_name_plural = "Leituras de usina"
        indexes = [
            models.Index(fields=["usina", "-medido_em"]),
            models.Index(fields=["empresa", "-medido_em"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=("usina", "medido_em"),
                name="leitura_unica_por_usina_timestamp",
            ),
        ]
