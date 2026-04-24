from django.apps import AppConfig


class ProvedoresConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.provedores"
    verbose_name = "Provedores"

    def ready(self) -> None:
        # Importa todos os adapters para que o decorator `@registrar` execute
        # e popule o registro em tempo de boot. Cada subpacote em
        # `apps/provedores/adapters/<tipo>/` deve ser listado aqui.
        from apps.provedores.adapters import (  # noqa: F401
            auxsol,
            foxess,
            fusionsolar,
            hoymiles,
            solarman,
            solis,
        )
