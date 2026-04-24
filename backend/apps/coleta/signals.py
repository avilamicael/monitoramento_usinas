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


def garantir_task_limpeza_diaria() -> None:
    """Cria a task diária de retenção de leituras (03:00 UTC) se não existir.

    Chamada do `apps.coleta.apps.ColetaConfig.ready()` — idempotente."""
    crontab, _ = CrontabSchedule.objects.get_or_create(
        minute="0",
        hour="3",
        day_of_week="*",
        day_of_month="*",
        month_of_year="*",
    )
    PeriodicTask.objects.get_or_create(
        name="apps.coleta::limpar_leituras_expiradas",
        defaults={
            "crontab": crontab,
            "task": NOME_TASK_LIMPEZA,
            "enabled": True,
        },
    )
