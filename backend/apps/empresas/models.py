from __future__ import annotations

import uuid

from django.db import models


class Empresa(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nome = models.CharField(max_length=200)
    slug = models.SlugField(max_length=100, unique=True)
    cnpj = models.CharField(max_length=20, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("nome",)
        verbose_name = "Empresa"
        verbose_name_plural = "Empresas"

    def __str__(self) -> str:
        return self.nome


class EscopoEmpresaQuerySet(models.QuerySet):
    def da_empresa(self, empresa: Empresa | None):
        if empresa is None:
            return self.none()
        return self.filter(empresa=empresa)


class EscopoEmpresaManager(models.Manager.from_queryset(EscopoEmpresaQuerySet)):
    pass


class EscopoEmpresa(models.Model):
    """Mixin abstrato para modelos que pertencem a uma empresa (multi-tenant)."""

    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)s_set",
    )

    objects = EscopoEmpresaManager()

    class Meta:
        abstract = True
