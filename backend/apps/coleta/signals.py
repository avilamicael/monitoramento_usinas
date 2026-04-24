"""Signals que mantêm o `django-celery-beat` sincronizado com as
`ContaProvedor`.

Cada conta ativa tem sua própria `PeriodicTask` com `IntervalSchedule`
baseado em `intervalo_coleta_minutos`. Mudanças na conta atualizam a task;
desativação a deleta.

A task de limpeza global (`limpar_leituras_expiradas`) é criada no
`ready()` do app.
"""
from __future__ import annotations

import json
import logging

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django_celery_beat.models import CrontabSchedule, IntervalSchedule, PeriodicTask

from apps.provedores.models import ContaProvedor

logger = logging.getLogger(__name__)

NOME_TASK_COLETA = "apps.coleta.tasks.sincronizar_conta_provedor"
NOME_TASK_LIMPEZA = "apps.coleta.tasks.limpar_leituras_expiradas"
NOME_TASK_ALERTAS_DIARIOS = "apps.coleta.tasks.avaliar_alertas_diarios"


def _nome_periodic(conta: ContaProvedor) -> str:
    return f"coleta::{conta.empresa_id}::{conta.tipo}::{conta.pk}"


@receiver(post_save, sender=ContaProvedor)
def sincronizar_agendamento(sender, instance: ContaProvedor, **kwargs) -> None:
    """Cria/atualiza/desativa a `PeriodicTask` conforme estado da conta."""
    nome = _nome_periodic(instance)

    if not instance.is_active:
        PeriodicTask.objects.filter(name=nome).update(enabled=False)
        return

    intervalo, _ = IntervalSchedule.objects.get_or_create(
        every=max(1, instance.intervalo_coleta_minutos),
        period=IntervalSchedule.MINUTES,
    )
    defaults = {
        "interval": intervalo,
        "task": NOME_TASK_COLETA,
        "args": json.dumps([instance.pk]),
        "enabled": True,
    }
    pt, criada = PeriodicTask.objects.get_or_create(name=nome, defaults=defaults)
    if not criada:
        campos = []
        for k, v in defaults.items():
            if getattr(pt, k) != v:
                setattr(pt, k, v)
                campos.append(k)
        if campos:
            pt.save(update_fields=campos + ["date_changed"])


@receiver(post_delete, sender=ContaProvedor)
def remover_agendamento(sender, instance: ContaProvedor, **kwargs) -> None:
    PeriodicTask.objects.filter(name=_nome_periodic(instance)).delete()


def garantir_tasks_diarias() -> None:
    """Cria as tasks Celery Beat diárias se não existirem (idempotente).

    Chamada via `post_migrate` em `ColetaConfig.ready()`. Horários em UTC:
    - 03:00 UTC (00:00 BRT) → limpar_leituras_expiradas (retenção de leituras).
    - 21:00 UTC (18:00 BRT) → avaliar_alertas_diarios (garantia + queda
      rendimento), depois do fim do horário solar.
    """
    cron_03 = CrontabSchedule.objects.get_or_create(
        minute="0", hour="3",
        day_of_week="*", day_of_month="*", month_of_year="*",
    )[0]
    PeriodicTask.objects.get_or_create(
        name="apps.coleta::limpar_leituras_expiradas",
        defaults={
            "crontab": cron_03,
            "task": NOME_TASK_LIMPEZA,
            "enabled": True,
        },
    )

    cron_21 = CrontabSchedule.objects.get_or_create(
        minute="0", hour="21",
        day_of_week="*", day_of_month="*", month_of_year="*",
    )[0]
    PeriodicTask.objects.get_or_create(
        name="apps.coleta::avaliar_alertas_diarios",
        defaults={
            "crontab": cron_21,
            "task": NOME_TASK_ALERTAS_DIARIOS,
            "enabled": True,
        },
    )


# Alias mantido pra compat com o apps.py (que chama esta função no
# post_migrate). Após a migração, qualquer chamador externo pode
# importar `garantir_tasks_diarias` direto.
garantir_task_limpeza_diaria = garantir_tasks_diarias
