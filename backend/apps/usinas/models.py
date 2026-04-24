from __future__ import annotations

from django.db import models

from apps.empresas.models import EscopoEmpresa


class Usina(EscopoEmpresa):
    """Usina solar cadastrada por uma empresa.

    `conta_provedor` + `id_externo` identificam a usina no sistema do
    provedor. `id_externo` pode ficar vazio até o primeiro sync descobrir
    as usinas disponíveis na conta.
    """

    conta_provedor = models.ForeignKey(
        "provedores.ContaProvedor",
        on_delete=models.PROTECT,
        related_name="usinas",
    )
    id_externo = models.CharField(max_length=128, blank=True, default="")

    nome = models.CharField(max_length=200)
    cidade = models.CharField(max_length=120, blank=True, default="")
    estado = models.CharField(max_length=2, blank=True, default="")
    capacidade_kwp = models.DecimalField(
        max_digits=10, decimal_places=3, null=True, blank=True
    )
    comissionada_em = models.DateField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Usina"
        verbose_name_plural = "Usinas"
        indexes = [
            models.Index(fields=["empresa", "is_active"]),
            models.Index(fields=["conta_provedor", "id_externo"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=("conta_provedor", "id_externo"),
                condition=~models.Q(id_externo=""),
                name="usina_unique_id_externo_por_conta",
            ),
        ]

    def __str__(self) -> str:
        return self.nome
