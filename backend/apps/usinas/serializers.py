from __future__ import annotations

from datetime import date

from rest_framework import serializers

from .models import Usina


class UsinaListSerializer(serializers.ModelSerializer):
    """Versão enxuta para listagem — sem dados elétricos pesados."""

    provedor_tipo = serializers.CharField(source="conta_provedor.tipo", read_only=True)
    provedor_rotulo = serializers.CharField(source="conta_provedor.rotulo", read_only=True)
    status_garantia = serializers.SerializerMethodField()
    qtd_inversores = serializers.IntegerField(read_only=True)
    qtd_alertas_abertos = serializers.IntegerField(read_only=True)

    class Meta:
        model = Usina
        fields = (
            "id",
            "nome",
            "id_externo",
            "cidade",
            "estado",
            "capacidade_kwp",
            "tipo_equipamento",
            "expoe_dados_inversor",
            "provedor_tipo",
            "provedor_rotulo",
            "conta_provedor",
            "is_active",
            "ultima_leitura_em",
            "status_garantia",
            "qtd_inversores",
            "qtd_alertas_abertos",
        )

    def get_status_garantia(self, usina) -> str:
        garantia = getattr(usina, "garantia", None)
        if garantia is None:
            return "sem_garantia"
        if garantia.fim_em < date.today():
            return "vencida"
        return "ativa"


class UsinaDetalhadaSerializer(serializers.ModelSerializer):
    """Versão completa para detalhe e atualização (PUT/PATCH)."""

    provedor_tipo = serializers.CharField(source="conta_provedor.tipo", read_only=True)
    provedor_rotulo = serializers.CharField(source="conta_provedor.rotulo", read_only=True)
    status_garantia = serializers.SerializerMethodField()

    class Meta:
        model = Usina
        fields = (
            "id",
            "nome",
            "id_externo",
            "endereco",
            "bairro",
            "cidade",
            "estado",
            "cep",
            "latitude",
            "longitude",
            "fuso_horario",
            "capacidade_kwp",
            "comissionada_em",
            "tipo_equipamento",
            "expoe_dados_inversor",
            # thresholds elétricos
            "tensao_ac_limite_v",
            "tensao_ac_limite_minimo_v",
            "frequencia_minimo_hz",
            "frequencia_maximo_hz",
            # provedor
            "provedor_tipo",
            "provedor_rotulo",
            "conta_provedor",
            # estado
            "is_active",
            "ultima_leitura_em",
            "status_garantia",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "id_externo",
            "provedor_tipo",
            "provedor_rotulo",
            "ultima_leitura_em",
            "status_garantia",
            "created_at",
            "updated_at",
        )

    def get_status_garantia(self, usina) -> str:
        garantia = getattr(usina, "garantia", None)
        if garantia is None:
            return "sem_garantia"
        if garantia.fim_em < date.today():
            return "vencida"
        return "ativa"
