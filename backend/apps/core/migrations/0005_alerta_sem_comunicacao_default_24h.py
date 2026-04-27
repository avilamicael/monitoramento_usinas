"""Atualiza default de `alerta_sem_comunicacao_minutos` de 60 → 1440 (24h).

Calibração 2026-04-27. O default antigo (60 min) gerava ruído crônico
porque a coleta pode rodar com sucesso e devolver leitura velha por
horas (provedor cacheado, Wi-Fi caído com resposta 200 OK estável).

A migration NÃO sobrescreve valores já gravados — só o default é
alterado, e em seguida fazemos um UPDATE WHERE valor=60 para mover quem
ainda usa o default antigo. Empresas que customizaram (ex.: 30, 120) são
preservadas.
"""
from __future__ import annotations

from django.db import migrations, models


def aplicar_default_novo(apps, schema_editor):
    Configuracao = apps.get_model("core", "ConfiguracaoEmpresa")
    # Só atualiza quem ainda usa o default antigo (60 min). Quem
    # customizou pra outro valor é preservado.
    Configuracao.objects.filter(alerta_sem_comunicacao_minutos=60).update(
        alerta_sem_comunicacao_minutos=1440
    )


def reverter(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_aplicar_calibracao_alertas"),
    ]

    operations = [
        migrations.AlterField(
            model_name="configuracaoempresa",
            name="alerta_sem_comunicacao_minutos",
            field=models.PositiveIntegerField(
                default=1440,
                help_text=(
                    "Minutos sem `medido_em` antes de abrir alerta. Default 24h "
                    "(1440 min) — coleta pode rodar com sucesso e devolver leitura "
                    "velha por horas se o provedor cachear, então 60 min gerava "
                    "muito ruído. Configurável por empresa."
                ),
            ),
        ),
        migrations.RunPython(aplicar_default_novo, reverter),
    ]
