from __future__ import annotations

from rest_framework import serializers

from .models import Inversor


class InversorSerializer(serializers.ModelSerializer):
    usina_nome = serializers.CharField(source="usina.nome", read_only=True)

    class Meta:
        model = Inversor
        fields = (
            "id",
            "usina",
            "usina_nome",
            "id_externo",
            "numero_serie",
            "modelo",
            "tipo",
            "potencia_nominal_kw",
            "qtd_mppts_esperados",
            "temperatura_limite_c",
            "tipo_ligacao",
            "is_active",
            "ultima_leitura_em",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "id_externo",
            "usina_nome",
            "ultima_leitura_em",
            "created_at",
            "updated_at",
        )
