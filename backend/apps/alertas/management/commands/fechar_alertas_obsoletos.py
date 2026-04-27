"""Fecha alertas abertos cujas regras não estão mais registradas no motor.

Uso:
    python manage.py fechar_alertas_obsoletos          # aplica
    python manage.py fechar_alertas_obsoletos --dry-run  # só preview

Quando uma regra é desregistrada (ex.: `subdesempenho` virou relatório),
os alertas abertos que ela criou ficam "órfãos" — o motor nunca mais vai
fechá-los porque não roda essa regra. Esse comando varre todos os alertas
em `estado=aberto`, identifica os que pertencem a regras desregistradas e
move pra `estado=resolvido` com `resolvido_em=now`.

Idempotente: rodar duas vezes não causa efeito colateral. A segunda
execução não encontra mais nada (o filtro `estado=aberto` exclui o que já
foi fechado).
"""
from __future__ import annotations

from collections import Counter

from django.core.management.base import BaseCommand
from django.utils import timezone as djtz

from apps.alertas.models import Alerta, EstadoAlerta
from apps.alertas.motor import _carregar_regras
from apps.alertas.regras import regras_registradas


class Command(BaseCommand):
    help = (
        "Fecha alertas abertos cuja regra não está mais registrada no motor. "
        "Usado quando uma regra é desativada (ex.: subdesempenho)."
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Apenas reporta o que seria fechado, sem alterar o banco.",
        )

    def handle(self, *args, **opts) -> None:
        dry_run: bool = opts["dry_run"]

        # Garante que todos os módulos de regras foram importados — só assim o
        # `_REGISTRO` reflete o estado real ("`@registrar` aplicado ou não").
        _carregar_regras()
        nomes_ativos = {r.nome for r in regras_registradas()}

        abertos = Alerta.objects.filter(estado=EstadoAlerta.ABERTO)
        nomes_em_uso = set(abertos.values_list("regra", flat=True).distinct())
        nomes_obsoletos = nomes_em_uso - nomes_ativos

        self.stdout.write(
            f"Regras registradas no motor: {sorted(nomes_ativos)}"
        )
        self.stdout.write(
            f"Regras com alerta aberto: {sorted(nomes_em_uso)}"
        )
        self.stdout.write(
            f"Regras obsoletas (alerta aberto sem regra registrada): "
            f"{sorted(nomes_obsoletos) or 'nenhuma'}"
        )

        if not nomes_obsoletos:
            self.stdout.write(self.style.SUCCESS("Nada a fechar."))
            return

        a_fechar = abertos.filter(regra__in=nomes_obsoletos)
        contagem = Counter(a_fechar.values_list("regra", flat=True))
        total = a_fechar.count()

        for regra, qtd in sorted(contagem.items()):
            self.stdout.write(f"  - {regra}: {qtd}")

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"[dry-run] Fecharia {total} alerta(s). Nada foi alterado."
                )
            )
            return

        atualizados = a_fechar.update(
            estado=EstadoAlerta.RESOLVIDO,
            resolvido_em=djtz.now(),
        )
        self.stdout.write(
            self.style.SUCCESS(f"Fechados {atualizados} alerta(s) obsoletos.")
        )
