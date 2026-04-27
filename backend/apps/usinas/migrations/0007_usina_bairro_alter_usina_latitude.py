# Generated for Workstream D — bairro + help_text de latitude.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("usinas", "0005_aplicar_calibracao_subtensao"),
    ]

    operations = [
        migrations.AddField(
            model_name="usina",
            name="bairro",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AlterField(
            model_name="usina",
            name="latitude",
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                help_text=(
                    "Preenchido manualmente, via geocoding (Nominatim) ou via "
                    "endpoint /api/usinas/geocode/. Usado pelo cálculo de "
                    "sunrise/sunset (astral) na regra sem_geracao_horario_solar."
                ),
                max_digits=9,
                null=True,
            ),
        ),
    ]
