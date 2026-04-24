from __future__ import annotations

from calendar import monthrange
from datetime import date

from django.db import models

from apps.empresas.models import EscopoEmpresa


class Garantia(EscopoEmpresa):
    """Garantia de uma usina. Prazo padrão vem de `core.ConfiguracaoEmpresa`
    mas pode ser sobrescrito por garantia."""

    usina = models.OneToOneField(
        "usinas.Usina", on_delete=models.CASCADE, related_name="garantia"
    )
    inicio_em = models.DateField()
    meses = models.PositiveIntegerField()
    fornecedor = models.CharField(max_length=120, blank=True, default="")
    observacoes = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Garantia"
        verbose_name_plural = "Garantias"

    @property
    def fim_em(self) -> date:
        total = self.inicio_em.month - 1 + self.meses
        ano = self.inicio_em.year + total // 12
        mes = total % 12 + 1
        dia = min(self.inicio_em.day, monthrange(ano, mes)[1])
        return date(ano, mes, dia)

    @property
    def is_active(self) -> bool:
        return date.today() <= self.fim_em

    @property
    def dias_restantes(self) -> int:
        return (self.fim_em - date.today()).days
