from __future__ import annotations

from django.db import models

from apps.empresas.models import EscopoEmpresa


class SeveridadeAlerta(models.TextChoices):
    INFO = "info", "Informativo"
    AVISO = "aviso", "Aviso"
    CRITICO = "critico", "Crítico"


class StatusAlerta(models.TextChoices):
    ABERTO = "aberto", "Aberto"
    RECONHECIDO = "reconhecido", "Reconhecido"
    RESOLVIDO = "resolvido", "Resolvido"


class Alerta(EscopoEmpresa):
    usina = models.ForeignKey(
        "usinas.Usina", on_delete=models.CASCADE, related_name="alertas"
    )
    tipo = models.CharField(
        max_length=60,
        help_text="Ex.: sem_comunicacao, subdesempenho.",
    )
    severidade = models.CharField(max_length=20, choices=SeveridadeAlerta.choices)
    status = models.CharField(
        max_length=20, choices=StatusAlerta.choices, default=StatusAlerta.ABERTO
    )
    mensagem = models.TextField()
    contexto = models.JSONField(default=dict, blank=True)
    aberto_em = models.DateTimeField(auto_now_add=True)
    resolvido_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Alerta"
        verbose_name_plural = "Alertas"
        indexes = [
            models.Index(fields=["empresa", "status", "-aberto_em"]),
            models.Index(fields=["usina", "status"]),
        ]
