from __future__ import annotations

from django.db import models

from apps.empresas.models import EscopoEmpresa


class TipoProvedor(models.TextChoices):
    FUSION = "fusion", "Huawei FusionSolar"
    SOLIS = "solis", "Solis (Ginlong)"
    SUNGROW = "sungrow", "Sungrow iSolarCloud"
    # Adicionar aqui novos provedores conforme implementar o adapter.


class ContaProvedor(EscopoEmpresa):
    """Credenciais da empresa para um provedor específico.

    Uma empresa pode ter mais de uma conta no mesmo provedor (ex.: múltiplos
    logins Fusion). Cada usina é vinculada a uma `ContaProvedor` para saber
    qual credencial usar na coleta.
    """

    tipo = models.CharField(max_length=32, choices=TipoProvedor.choices)
    rotulo = models.CharField(max_length=120, help_text="Nome amigável para identificar a conta.")

    usuario = models.CharField(max_length=200, blank=True, default="")
    senha = models.CharField(max_length=500, blank=True, default="")
    api_key = models.CharField(max_length=500, blank=True, default="")
    api_secret = models.CharField(max_length=500, blank=True, default="")
    extra = models.JSONField(default=dict, blank=True, help_text="Campos específicos do provedor.")

    is_active = models.BooleanField(default=True)
    ultima_sincronizacao_em = models.DateTimeField(null=True, blank=True)
    ultima_sincronizacao_status = models.CharField(max_length=40, blank=True, default="")
    ultima_sincronizacao_erro = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Conta de provedor"
        verbose_name_plural = "Contas de provedor"
        unique_together = ("empresa", "tipo", "rotulo")
        indexes = [models.Index(fields=["empresa", "tipo", "is_active"])]

    def __str__(self) -> str:
        return f"{self.get_tipo_display()} — {self.rotulo}"
