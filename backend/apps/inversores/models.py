from __future__ import annotations

from django.db import models

from apps.empresas.models import EscopoEmpresa


class TipoInversor(models.TextChoices):
    INVERSOR = "inversor", "Inversor"
    MICROINVERSOR = "microinversor", "Microinversor"


class Inversor(EscopoEmpresa):
    """Equipamento individual dentro de uma usina.

    Existe apenas para usinas com `usina.expoe_dados_inversor = True`. Cada
    `Inversor` acumula `LeituraInversor` append-only. Microinversor é modelado
    como `Inversor` com `tipo = microinversor` — Hoymiles tem 1 usina → N
    microinversores, cada um com 1-4 ports no JSON `strings_mppt` da leitura.
    """

    usina = models.ForeignKey(
        "usinas.Usina",
        on_delete=models.CASCADE,
        related_name="inversores",
    )
    id_externo = models.CharField(
        max_length=128,
        help_text="ID do inversor no provedor (SN ou ID interno).",
    )
    numero_serie = models.CharField(max_length=100, blank=True, default="")
    modelo = models.CharField(max_length=100, blank=True, default="")
    tipo = models.CharField(
        max_length=20,
        choices=TipoInversor.choices,
        default=TipoInversor.INVERSOR,
    )

    potencia_nominal_kw = models.DecimalField(
        max_digits=8, decimal_places=3, null=True, blank=True,
    )
    qtd_mppts_esperados = models.PositiveIntegerField(
        null=True, blank=True,
        help_text=(
            "Quantidade de strings/ports MPPT que este inversor tem. "
            "Usado pela regra `string_mppt_zerada` para saber quantos slots "
            "esperar em `LeituraInversor.strings_mppt`."
        ),
    )

    is_active = models.BooleanField(default=True)
    ultima_leitura_em = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Inversor"
        verbose_name_plural = "Inversores"
        constraints = [
            models.UniqueConstraint(
                fields=("usina", "id_externo"),
                name="inversor_unique_id_externo_por_usina",
            ),
        ]
        indexes = [
            models.Index(fields=["usina", "is_active"]),
            models.Index(fields=["empresa", "ultima_leitura_em"]),
        ]

    def __str__(self) -> str:
        return f"{self.numero_serie or self.id_externo} ({self.usina.nome})"
