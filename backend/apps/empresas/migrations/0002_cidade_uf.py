from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("empresas", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="empresa",
            name="cidade",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="empresa",
            name="uf",
            field=models.CharField(blank=True, default="", max_length=2),
        ),
    ]
