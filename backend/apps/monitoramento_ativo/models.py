from __future__ import annotations

from calendar import monthrange
from datetime import date

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from apps.empresas.models import EscopoEmpresa


class MonitoramentoAtivo(EscopoEmpresa):
    """Contrato de monitoramento ativo (premium) de uma usina.

    Diferente da garantia, o cliente premium paga uma mensalidade para que o
    problema seja resolvido com rapidez. É independente da garantia: uma usina
    pode ter garantia, monitoramento ativo, ambos ou nenhum. Tanto a garantia
    ativa quanto o monitoramento ativo ligam o monitoramento da usina no motor
    de alertas (ver `apps.alertas.motor`).

    `fim_em` é PERSISTIDO (recalculado no `save()` a partir de `inicio_em` +
    `meses`), ao contrário de `Garantia.fim_em` que é property. Isso permite
    filtrar alertas premium em SQL — ver
    `apps.alertas.models.AlertaQuerySet.com_premium`.
    """

    usina = models.OneToOneField(
        "usinas.Usina", on_delete=models.CASCADE, related_name="monitoramento_ativo"
    )
    inicio_em = models.DateField()
    meses = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    fim_em = models.DateField(editable=False)
    valor_mensal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Mensalidade do contrato premium (registro do contrato; opcional).",
    )
    contratante = models.CharField(max_length=120, blank=True, default="")
    observacoes = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Monitoramento ativo"
        verbose_name_plural = "Monitoramentos ativos"

    @staticmethod
    def _somar_meses(inicio: date, meses: int) -> date:
        total = inicio.month - 1 + meses
        ano = inicio.year + total // 12
        mes = total % 12 + 1
        dia = min(inicio.day, monthrange(ano, mes)[1])
        return date(ano, mes, dia)

    def clean(self) -> None:
        """Backstop: o contrato e a usina precisam ser da mesma empresa.

        Defesa em profundidade para qualquer caminho de escrita (admin, shell,
        importação). A API já valida em `MonitoramentoAtivoSerializer`.
        """
        super().clean()
        if self.usina_id and self.empresa_id and self.usina.empresa_id != self.empresa_id:
            raise ValidationError(
                {"usina": "Usina não pertence à mesma empresa do contrato."},
            )

    def save(self, *args, **kwargs):
        # Só recalcula `fim_em` quando os campos de origem mudam — evita
        # corromper `fim_em` num save parcial de outro campo a partir de uma
        # instância potencialmente desatualizada.
        update_fields = kwargs.get("update_fields")
        if update_fields is None or {"inicio_em", "meses"} & set(update_fields):
            self.fim_em = self._somar_meses(self.inicio_em, self.meses)
            if update_fields is not None:
                kwargs["update_fields"] = set(update_fields) | {"fim_em"}
        super().save(*args, **kwargs)

    @property
    def is_active(self) -> bool:
        return timezone.localdate() <= self.fim_em

    @property
    def dias_restantes(self) -> int:
        return (self.fim_em - timezone.localdate()).days
