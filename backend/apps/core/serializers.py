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
            # Monitoramento ativo / premium
            "monitoramento_premium_aviso_dias",
            "monitoramento_premium_critico_dias",
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

    def validate(self, attrs):
        """Garante que o dia 'crítico' é sempre menor que o 'aviso prévio'.

        Vale para garantia e para monitoramento premium. Como o PATCH é
        parcial, cai para o valor já persistido na instância quando o campo
        não vem no payload.
        """
        def _resolver(nome):
            if nome in attrs:
                return attrs[nome]
            return getattr(self.instance, nome, None)

        pares = (
            ("garantia_critico_dias", "garantia_aviso_dias"),
            ("monitoramento_premium_critico_dias", "monitoramento_premium_aviso_dias"),
        )
        for campo_critico, campo_aviso in pares:
            critico = _resolver(campo_critico)
            aviso = _resolver(campo_aviso)
            if critico is not None and aviso is not None and critico >= aviso:
                raise serializers.ValidationError(
                    {campo_critico: "Deve ser menor que o aviso prévio."},
                )
        return attrs
