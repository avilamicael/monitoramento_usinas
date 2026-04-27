from __future__ import annotations

from rest_framework import serializers

from .models import ConfiguracaoEmpresa


class ConfiguracaoEmpresaSerializer(serializers.ModelSerializer):
    """Configuração global da empresa — thresholds das regras de alerta,
    janela de horário solar, retenção, garantia padrão.

    Todos os campos têm `help_text` no model — a UI lê para gerar a tela
    de configuração.
    """

    class Meta:
        model = ConfiguracaoEmpresa
        fields = (
            "id",
            "empresa",
            # Garantia
            "garantia_padrao_meses",
            "garantia_aviso_dias",
            "garantia_critico_dias",
            # Horário solar
            "horario_solar_inicio",
            "horario_solar_fim",
            # Regras de alerta
            "alerta_sem_comunicacao_minutos",
            "alerta_dado_ausente_coletas",
            "subdesempenho_limite_pct",
            "queda_rendimento_pct",
            "temperatura_limite_c",
            "potencia_minima_avaliacao_kw",
            "inversor_offline_coletas_minimas",
            "sem_geracao_queda_abrupta_pct",
            # Retenção
            "retencao_leituras_dias",
            "updated_at",
        )
        read_only_fields = ("id", "empresa", "updated_at")
