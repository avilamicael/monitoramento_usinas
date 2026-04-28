from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("monitoramento", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="leiturainversor",
            name="tipo_ligacao",
            field=models.CharField(
                blank=True,
                choices=[
                    ("monofasico", "Monofásico"),
                    ("bifasico", "Bifásico"),
                    ("trifasico", "Trifásico"),
                ],
                help_text=(
                    "Tipo de ligação AC inferido pelo adapter (monofasico, bifasico, "
                    "trifasico). Null quando o adapter não consegue classificar."
                ),
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="leiturainversor",
            name="eletrica_ac",
            field=models.JSONField(
                blank=True,
                default=None,
                help_text=(
                    "Detalhe elétrico AC por fase. Schema (todas as chaves opcionais): "
                    '{"fases_neutro": {"a": V, "b": V, "c": V}, '
                    '"linhas": {"ab": V, "bc": V, "ca": V}, '
                    '"correntes": {"a": A, "b": A, "c": A}, '
                    '"fator_potencia": float, "potencia_reativa_kvar": float}.'
                ),
                null=True,
            ),
        ),
    ]
