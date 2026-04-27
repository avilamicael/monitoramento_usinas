from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="usuario",
            name="papel",
            field=models.CharField(
                choices=[
                    ("superadmin", "Superadmin"),
                    ("administrador", "Administrador"),
                    ("operacional", "Operacional"),
                ],
                default="operacional",
                max_length=20,
            ),
        ),
    ]
