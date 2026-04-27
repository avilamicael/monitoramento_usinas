"""Data migration — atualiza tensao_ac_limite_minimo_v de 200 para 190.

Calibração 2026-04-26: 200V era ruído pra rede 220V±10% (faixa real 198-242V).
190V só dispara em subtensão de fato. Aplica apenas onde ainda for 200.
"""
from __future__ import annotations

from decimal import Decimal

from django.db import migrations


def aplicar_calibracao(apps, schema_editor):
    Usina = apps.get_model("usinas", "Usina")
    Usina.objects.filter(tensao_ac_limite_minimo_v=Decimal("200.0")).update(
        tensao_ac_limite_minimo_v=Decimal("190.0")
    )


def reverter(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("usinas", "0004_alter_usina_tensao_ac_limite_minimo_v"),
    ]

    operations = [
        migrations.RunPython(aplicar_calibracao, reverter),
    ]
