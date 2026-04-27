from __future__ import annotations

from rest_framework import serializers

from .models import Garantia


class GarantiaSerializer(serializers.ModelSerializer):
    usina_nome = serializers.CharField(source="usina.nome", read_only=True)
    fim_em = serializers.DateField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    dias_restantes = serializers.IntegerField(read_only=True)

    class Meta:
        model = Garantia
        fields = (
            "id",
            "usina",
            "usina_nome",
            "inicio_em",
            "meses",
            "fim_em",
            "is_active",
            "dias_restantes",
            "fornecedor",
            "observacoes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "usina_nome",
            "fim_em",
            "is_active",
            "dias_restantes",
            "created_at",
            "updated_at",
        )
