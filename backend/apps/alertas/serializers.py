from __future__ import annotations

from rest_framework import serializers

from .models import Alerta


class AlertaSerializer(serializers.ModelSerializer):
    usina_nome = serializers.CharField(source="usina.nome", read_only=True)
    usina_provedor = serializers.CharField(source="usina.conta_provedor.tipo", read_only=True, default=None)
    usina_id_externo = serializers.CharField(source="usina.id_externo", read_only=True, default=None)
    inversor_serie = serializers.CharField(source="inversor.numero_serie", read_only=True, default=None)

    class Meta:
        model = Alerta
        fields = (
            "id",
            "usina",
            "usina_nome",
            "usina_provedor",
            "usina_id_externo",
            "inversor",
            "inversor_serie",
            "regra",
            "severidade",
            "estado",
            "mensagem",
            "contexto",
            "aberto_em",
            "resolvido_em",
            "atualizado_em",
        )
        read_only_fields = (
            "id",
            "usina",
            "usina_nome",
            "usina_provedor",
            "usina_id_externo",
            "inversor",
            "inversor_serie",
            "regra",
            "mensagem",
            "contexto",
            "aberto_em",
            "atualizado_em",
        )


class AlertaUpdateSerializer(serializers.ModelSerializer):
    """Atualizar manualmente um alerta — somente estado e severidade
    podem ser ajustados pelo operador (o motor de alertas é a fonte normal
    de mudanças). Útil para fechar manualmente um alerta investigado."""

    class Meta:
        model = Alerta
        fields = ("estado", "severidade", "resolvido_em")
