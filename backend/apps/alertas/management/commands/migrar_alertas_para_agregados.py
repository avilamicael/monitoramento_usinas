"""Fecha alertas legados por inversor das regras que viraram agregadoras.

Quando uma regra `RegraInversor` ganha `agregar_por_usina=True`, o motor
passa a emitir 1 alerta por usina (com `inversor=NULL`) consolidando todos
os inversores afetados — em vez do antigo "1 alerta por inversor". Os
alertas pré-existentes (com `inversor` preenchido) ficam órfãos: nenhum
ciclo do motor vai resolvê-los porque a busca pelo "alerta atual" agora
ignora o eixo `inversor`.

Este comando varre todas as regras agregadoras (lidas de
`RegraInversor.agregar_por_usina`) e move os alertas abertos com
`inversor!=NULL` para `estado=resolvido`. O próximo ciclo do motor
recriará no formato agregado quando a anomalia ainda existir.

Uso:

    docker compose exec backend python manage.py migrar_alertas_para_agregados --dry-run
    docker compose exec backend python manage.py migrar_alertas_para_agregados
    docker compose exec backend python manage.py migrar_alertas_para_agregados --regra sobretensao_ac

Idempotente: rodar duas vezes não faz nada na segunda — sem alerta legado
para fechar, o comando informa "nada a fazer".
"""
from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.alertas.models import Alerta, EstadoAlerta
from apps.alertas.regras import RegraInversor, regras_registradas

# Mensagem usada para auditoria nos alertas fechados pelo command.
MOTIVO_RESOLUCAO = (
    "Alerta legado fechado por `migrar_alertas_para_agregados` — a regra "
    "passou a emitir um único alerta por usina consolidando todos os "
    "inversores afetados. O próximo ciclo do motor recriará agregado se "
    "a anomalia ainda existir."
)


def _regras_agregadoras() -> list[str]:
    """Carrega todas as regras e devolve nomes das que são agregadoras."""
    # Mesmo import que `motor._carregar_regras` faz, pra ativar `@registrar`.
    from apps.alertas.regras import (  # noqa: F401
        dado_eletrico_ausente,
        frequencia_anomala,
        garantia_vencendo,
        inversor_offline,
        queda_rendimento,
        sem_comunicacao,
        sem_geracao_horario_solar,
        sobretensao_ac,
        string_mppt_zerada,
        subdesempenho,
        subtensao_ac,
        temperatura_alta,
    )

    nomes: list[str] = []
    for regra_cls in regras_registradas():
        if not issubclass(regra_cls, RegraInversor):
            continue
        if getattr(regra_cls, "agregar_por_usina", False):
            nomes.append(regra_cls.nome)
    return nomes


class Command(BaseCommand):
    help = (
        "Fecha alertas abertos por inversor de regras que viraram "
        "agregadoras. Idempotente."
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Apenas mostra quais alertas seriam fechados, sem persistir.",
        )
        parser.add_argument(
            "--regra",
            default=None,
            help=(
                "Limita o cleanup a uma regra específica. Sem essa flag, "
                "processa todas as regras com `agregar_por_usina=True`."
            ),
        )

    def handle(self, *args, **opts) -> None:
        dry_run = bool(opts["dry_run"])
        regra_filtro = (opts.get("regra") or "").strip() or None

        regras_alvo = _regras_agregadoras()
        if regra_filtro:
            if regra_filtro not in regras_alvo:
                self.stdout.write(
                    self.style.WARNING(
                        f"Regra '{regra_filtro}' não está marcada como "
                        f"`agregar_por_usina=True`. Regras agregadoras: "
                        f"{regras_alvo}."
                    )
                )
                return
            regras_alvo = [regra_filtro]

        if not regras_alvo:
            self.stdout.write(
                "Nenhuma regra com `agregar_por_usina=True` registrada — "
                "nada a fazer."
            )
            return

        self.stdout.write(f"Regras agregadoras alvo: {regras_alvo}")

        # Alertas abertos com `inversor!=NULL` daquelas regras → legados.
        alertas_qs = Alerta.objects.filter(
            regra__in=regras_alvo,
            estado=EstadoAlerta.ABERTO,
            inversor__isnull=False,
        ).select_related("usina", "inversor")

        total = alertas_qs.count()
        if total == 0:
            self.stdout.write(
                "Nenhum alerta legado por inversor encontrado — nada a fazer."
            )
            return

        self.stdout.write(
            f"{total} alerta(s) legado(s) a fechar:"
        )
        for alerta in alertas_qs[:200]:
            self.stdout.write(
                f"  · #{alerta.pk} regra={alerta.regra} "
                f"usina='{alerta.usina.nome}' "
                f"inversor={alerta.inversor_id} "
                f"aberto_em={alerta.aberto_em.isoformat()}"
            )
        if total > 200:
            self.stdout.write(f"  ... (+{total - 200} omitidos)")

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
            self.style.SUCCESS(
                f"{atualizados} alerta(s) legado(s) fechado(s). O próximo "
                f"ciclo do motor recriará no formato agregado se a anomalia "
                f"ainda persistir."
            )
        )
