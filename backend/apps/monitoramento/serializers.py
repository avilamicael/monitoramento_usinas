from __future__ import annotations

from rest_framework import serializers

from .models import LeituraInversor, LeituraUsina


class LeituraUsinaSerializer(serializers.ModelSerializer):
    usina_nome = serializers.CharField(source="usina.nome", read_only=True)

    class Meta:
        model = LeituraUsina
        fields = (
            "id",
            "usina",
            "usina_nome",
            "coletado_em",
            "medido_em",
            "potencia_kw",
            "energia_hoje_kwh",
            "energia_mes_kwh",
            "energia_total_kwh",
            "status",
            "qtd_inversores_total",
            "qtd_inversores_online",
        )


class LeituraInversorSerializer(serializers.ModelSerializer):
    inversor_serie = serializers.CharField(source="inversor.numero_serie", read_only=True)
    usina_nome = serializers.CharField(source="usina.nome", read_only=True)

    class Meta:
        model = LeituraInversor
        fields = (
            "id",
            "usina",
            "usina_nome",
            "inversor",
            "inversor_serie",
            "coletado_em",
            "medido_em",
            "estado",
            "pac_kw",
            "energia_hoje_kwh",
            "energia_total_kwh",
            "tensao_ac_v",
            "corrente_ac_a",
            "frequencia_hz",
            "tensao_dc_v",
            "corrente_dc_a",
            "temperatura_c",
            "soc_bateria_pct",
            "strings_mppt",
        )
