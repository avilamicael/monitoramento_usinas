from __future__ import annotations

from celery import shared_task


@shared_task
def sincronizar_conta_provedor(conta_id: int) -> None:
    """Coleta dados de uma `ContaProvedor` específica.

    Agendamento é configurado em `django_celery_beat` via admin.
    Implementação real usará `adapter_para(conta.tipo)(conta)` e persistirá
    as leituras em `monitoramento`.
    """
    raise NotImplementedError
