from __future__ import annotations

from django.db import models

from apps.empresas.models import EscopoEmpresa


class Canal(models.TextChoices):
    WEB = "web", "Web (in-app)"
    EMAIL = "email", "E-mail"
    WEBHOOK = "webhook", "Webhook"
    WHATSAPP = "whatsapp", "WhatsApp"  # reservado para futuro


class RegraNotificacao(EscopoEmpresa):
    """Define para quem e por qual canal mandar notificação quando um tipo
    de alerta disparar. Uma empresa pode ter várias regras (ex.: e-mail
    sempre, webhook só para críticos)."""

    nome = models.CharField(max_length=120)
    canal = models.CharField(max_length=20, choices=Canal.choices)
    severidades = models.JSONField(default=list, help_text="Lista de severidades que disparam.")
    tipos_alerta = models.JSONField(default=list, blank=True, help_text="Vazio = qualquer tipo.")
    config = models.JSONField(default=dict, blank=True, help_text="Endereços, URL do webhook, etc.")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Regra de notificação"
        verbose_name_plural = "Regras de notificação"


class EntregaNotificacao(EscopoEmpresa):
    """Log de cada notificação que tentamos enviar."""

    regra = models.ForeignKey(
        RegraNotificacao, on_delete=models.SET_NULL, null=True, related_name="entregas"
    )
    alerta = models.ForeignKey(
        "alertas.Alerta", on_delete=models.CASCADE, related_name="entregas"
    )
    canal = models.CharField(max_length=20, choices=Canal.choices)
    destino = models.CharField(max_length=500)
    status = models.CharField(max_length=20)  # enfileirado, enviado, falhou
    tentativas = models.PositiveIntegerField(default=0)
    ultimo_erro = models.TextField(blank=True, default="")
    enviado_em = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Entrega de notificação"
        verbose_name_plural = "Entregas de notificação"
        indexes = [models.Index(fields=["empresa", "-created_at", "status"])]


class EndpointWebhook(EscopoEmpresa):
    """Webhook de saída configurado pela empresa para receber eventos."""

    url = models.URLField()
    secret = models.CharField(max_length=128, help_text="Usado para assinar o payload.")
    tipos_evento = models.JSONField(default=list, help_text="Ex.: ['alerta.aberto'].")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Endpoint de webhook"
        verbose_name_plural = "Endpoints de webhook"
