"""Fecha alertas de subtensão obsoletos após recalibração da tensão nominal.

Quando o admin reclassifica uma usina de 220 V para 110 V (na realidade
127 V), os thresholds de `subtensao_ac` caem de ~190 V para ~108 V e os
alertas que estavam abertos sob o critério antigo passam a ser falsos
positivos — esses inversores reportam tensão de fase ~110–127 V,
perfeitamente normal para a rede 127 V.

Este comando varre todas as usinas com `tensao_nominal_v=110` e fecha os
alertas abertos da regra `subtensao_ac`, marcando-os como resolvidos com
mensagem de auditoria.

Uso:

    python manage.py recalibrar_alertas_tensao --dry-run
    python manage.py recalibrar_alertas_tensao
    python manage.py recalibrar_alertas_tensao --regra subtensao_ac

Idempotente: rodar duas vezes não faz nada na segunda.
"""
from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.alertas.models import Alerta, EstadoAlerta
from apps.usinas.models import TensaoNominalV, Usina

MOTIVO_RESOLUCAO = (
    "Calibração automática — usina reclassificada como rede 127 V "
    "(tensão nominal 110 V). Threshold de subtensão recalculado, alerta "
    "obsoleto fechado por `recalibrar_alertas_tensao`."
)


class Command(BaseCommand):
    help = (
        "Fecha alertas de subtensão obsoletos em usinas reclassificadas "
        "como rede 110 V (nominal efetivo 127 V)."
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Apenas mostra quais alertas seriam fechados, sem persistir.",
        )
        parser.add_argument(
            "--regra",
            default="subtensao_ac",
            help=(
                "Nome da regra cujos alertas devem ser fechados "
                "(default: subtensao_ac)."
            ),
        )

    def handle(self, *args, **opts) -> None:
        dry_run = bool(opts["dry_run"])
        regra = opts["regra"].strip()

        usinas_110v = Usina.objects.filter(tensao_nominal_v=TensaoNominalV.V110)
        total_usinas = usinas_110v.count()
        if total_usinas == 0:
            self.stdout.write(
                "Nenhuma usina com `tensao_nominal_v=110` encontrada — nada a fazer."
            )
            return

        alertas_qs = Alerta.objects.filter(
            usina__in=usinas_110v,
            regra=regra,
            estado=EstadoAlerta.ABERTO,
        ).select_related("usina")

        total = alertas_qs.count()
        if total == 0:
            self.stdout.write(
                f"{total_usinas} usina(s) em 110 V — nenhum alerta aberto da "
                f"regra '{regra}' a fechar."
            )
            return

        self.stdout.write(
            f"{total_usinas} usina(s) em 110 V — {total} alerta(s) aberto(s) "
            f"da regra '{regra}' a fechar."
        )

        for alerta in alertas_qs:
            self.stdout.write(
                f"  · alerta #{alerta.pk} usina='{alerta.usina.nome}' "
                f"inversor={alerta.inversor_id} aberto_em={alerta.aberto_em.isoformat()}"
            )

        if dry_run:
            self.stdout.write(self.style.WARNING("[dry-run] Nada foi alterado."))
            return

        agora = timezone.now()
        with transaction.atomic():
            atualizados = alertas_qs.update(
                estado=EstadoAlerta.RESOLVIDO,
                resolvido_em=agora,
                mensagem=MOTIVO_RESOLUCAO,
            )

        self.stdout.write(
            self.style.SUCCESS(f"{atualizados} alerta(s) fechado(s) com sucesso.")
        )
