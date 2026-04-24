from django.apps import AppConfig
from django.db.models.signals import post_migrate


def _criar_task_limpeza(sender, **kwargs):
    """Hook post_migrate — garante a task diária de retenção sem tocar
    no banco durante a inicialização dos apps."""
    from .signals import garantir_task_limpeza_diaria

    garantir_task_limpeza_diaria()


class ColetaConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.coleta"
    verbose_name = "Coleta"

    def ready(self) -> None:
        # Registra signals de sincronização ContaProvedor ↔ PeriodicTask.
        from . import signals  # noqa: F401

        post_migrate.connect(_criar_task_limpeza, sender=self)
