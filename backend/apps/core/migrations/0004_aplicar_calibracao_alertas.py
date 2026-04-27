"""Data migration — aplica defaults novos a empresas que ainda usam os antigos.

Calibração 2026-04-26 (após dia de monitoramento):
- subdesempenho_limite_pct: 30 → 15 (apenas onde ainda for 30).

Os campos novos (potencia_minima_avaliacao_kw, inversor_offline_coletas_minimas,
sem_geracao_queda_abrupta_pct) já vêm com o default correto na criação; nada a
fazer aqui pra eles.
"""
from __future__ import annotations

from decimal import Decimal

from django.db import migrations


def aplicar_calibracao(apps, schema_editor):
    Configuracao = apps.get_model("core", "ConfiguracaoEmpresa")
    Configuracao.objects.filter(subdesempenho_limite_pct=Decimal("30")).update(
        subdesempenho_limite_pct=Decimal("15")
    )


def reverter(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_configuracaoempresa_inversor_offline_coletas_minimas_and_more"),
    ]

    operations = [
        migrations.RunPython(aplicar_calibracao, reverter),
    ]
