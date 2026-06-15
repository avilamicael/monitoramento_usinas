from __future__ import annotations

from rest_framework import serializers

from apps.core.api import empresa_do_request

from .models import Garantia


class GarantiaSerializer(serializers.ModelSerializer):
    usina_nome = serializers.CharField(source="usina.nome", read_only=True)
    fim_em = serializers.DateField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    dias_restantes = serializers.IntegerField(read_only=True)

    def validate_usina(self, usina):
        """Garante que a usina referenciada é da empresa do request (anti-IDOR).

        Sem isso, um admin da empresa A poderia anexar garantia a uma usina da
        empresa B. Regra do CLAUDE.md: nunca confiar em parâmetro do cliente.
        """
        request = self.context.get("request")
        empresa = empresa_do_request(request) if request is not None else None
        if empresa is None or usina.empresa_id != empresa.pk:
            raise serializers.ValidationError(
                "Usina não pertence à sua empresa."
            )
        return usina

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
