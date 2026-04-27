from __future__ import annotations

from rest_framework import serializers

from .models import EndpointWebhook, EntregaNotificacao, RegraNotificacao


class RegraNotificacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegraNotificacao
        fields = (
            "id",
            "nome",
            "canal",
            "severidades",
            "tipos_alerta",
            "config",
            "is_active",
            "created_at",
        )
        read_only_fields = ("id", "created_at")


class EntregaNotificacaoSerializer(serializers.ModelSerializer):
    alerta_regra = serializers.CharField(source="alerta.regra", read_only=True)
    alerta_usina_nome = serializers.CharField(source="alerta.usina.nome", read_only=True)
    regra_nome = serializers.CharField(source="regra.nome", read_only=True, default=None)

    class Meta:
        model = EntregaNotificacao
        fields = (
            "id",
            "regra",
            "regra_nome",
            "alerta",
            "alerta_regra",
            "alerta_usina_nome",
            "canal",
            "destino",
            "status",
            "tentativas",
            "ultimo_erro",
            "enviado_em",
            "created_at",
        )
        read_only_fields = fields  # entregas são geradas pelo worker, read-only.


class EndpointWebhookSerializer(serializers.ModelSerializer):
    secret = serializers.CharField(write_only=True)

    class Meta:
        model = EndpointWebhook
        fields = (
            "id",
            "url",
            "secret",
            "tipos_evento",
            "is_active",
            "created_at",
        )
        read_only_fields = ("id", "created_at")
