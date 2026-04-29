from __future__ import annotations

from django.contrib.auth.models import AbstractUser
from django.db import models


class PapelUsuario(models.TextChoices):
    SUPERADMIN = "superadmin", "Superadmin"
    ADMIN = "administrador", "Administrador"
    OPERACIONAL = "operacional", "Operacional"


class Usuario(AbstractUser):
    empresa = models.ForeignKey(
        "empresas.Empresa",
        on_delete=models.CASCADE,
        related_name="usuarios",
        null=True,
        blank=True,
    )
    papel = models.CharField(
        max_length=20,
        choices=PapelUsuario.choices,
        default=PapelUsuario.OPERACIONAL,
    )
    telefone = models.CharField(max_length=30, blank=True, default="")

    class Meta:
        verbose_name = "Usuário"
        verbose_name_plural = "Usuários"
        indexes = [models.Index(fields=["empresa", "papel"])]

    @property
    def is_admin_empresa(self) -> bool:
        # Superadmin tem todos os privilégios de admin de empresa, além do
        # acesso cross-tenant via /api/superadmin/*. Sem isso, ações
        # administrativas em endpoints normais (provedores, usinas, usuários)
        # retornam 403 pra superadmin — comportamento contraintuitivo.
        return self.papel in (PapelUsuario.ADMIN, PapelUsuario.SUPERADMIN)

    @property
    def is_superadmin(self) -> bool:
        return self.papel == PapelUsuario.SUPERADMIN
