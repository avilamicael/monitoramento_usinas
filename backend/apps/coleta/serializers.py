from __future__ import annotations

from rest_framework import serializers

from .models import LogColeta


class LogColetaSerializer(serializers.ModelSerializer):
    conta_provedor_tipo = serializers.CharField(source="conta_provedor.tipo", read_only=True)
    conta_provedor_rotulo = serializers.CharField(source="conta_provedor.rotulo", read_only=True)

    class Meta:
        model = LogColeta
        fields = (
            "id",
            "conta_provedor",
            "conta_provedor_tipo",
            "conta_provedor_rotulo",
            "status",
            "qtd_usinas",
            "qtd_inversores",
            "qtd_leituras_usina",
            "qtd_leituras_inversor",
            "qtd_alertas_abertos",
            "qtd_alertas_resolvidos",
            "detalhe_erro",
            "duracao_ms",
            "iniciado_em",
            "finalizado_em",
        )
