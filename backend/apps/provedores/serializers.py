from __future__ import annotations

from rest_framework import serializers

from .cripto import criptografar
from .models import ContaProvedor


class ContaProvedorSerializer(serializers.ModelSerializer):
    """Serializer principal — NUNCA expõe `credenciais_enc` ou `cache_token_enc`.

    Para criar/editar credenciais, use o campo write-only `credenciais` (dict).
    Ele é criptografado e gravado em `credenciais_enc` no save.
    """

    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    credenciais = serializers.JSONField(
        write_only=True,
        required=False,
        help_text=(
            "Credenciais em texto plano por tipo de provedor. Solis: "
            '{"api_key", "app_secret"}; Hoymiles/FusionSolar: {"username", '
            '"password"}; etc. É criptografado e nunca devolvido na resposta.'
        ),
    )

    class Meta:
        model = ContaProvedor
        fields = (
            "id",
            "tipo",
            "tipo_label",
            "rotulo",
            "credenciais",
            "intervalo_coleta_minutos",
            "is_active",
            "precisa_atencao",
            "ultima_sincronizacao_em",
            "ultima_sincronizacao_status",
            "ultima_sincronizacao_erro",
            "cache_token_expira_em",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "tipo_label",
            "precisa_atencao",
            "ultima_sincronizacao_em",
            "ultima_sincronizacao_status",
            "ultima_sincronizacao_erro",
            "cache_token_expira_em",
            "created_at",
            "updated_at",
        )

    def create(self, validated_data):
        credenciais = validated_data.pop("credenciais", None)
        if not credenciais:
            raise serializers.ValidationError(
                {"credenciais": "Obrigatório ao criar uma conta de provedor."}
            )
        validated_data["credenciais_enc"] = criptografar(credenciais)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        credenciais = validated_data.pop("credenciais", None)
        if credenciais:
            validated_data["credenciais_enc"] = criptografar(credenciais)
        return super().update(instance, validated_data)
