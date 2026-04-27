"""Management command — geocoding em lote das usinas sem lat/lon.

Idempotente. Respeita o rate limit do Nominatim (1 req/s) automaticamente
através de `apps.usinas.geocode._aplicar_rate_limit`. Loga progresso a
cada 10 usinas processadas.

Uso:
    python manage.py geocode_usinas            # aplica
    python manage.py geocode_usinas --dry-run  # não persiste
    python manage.py geocode_usinas --empresa <slug>  # filtra empresa
"""
from __future__ import annotations

from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.usinas.geocode import (
    GeocodeError,
    GeocodeNaoEncontrado,
    geocode_por_cep,
    geocode_por_endereco,
)
from apps.usinas.models import Usina


class Command(BaseCommand):
    help = "Geocoding em lote para usinas sem latitude/longitude."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Resolve mas não salva no banco.",
        )
        parser.add_argument(
            "--empresa", default=None,
            help="Filtra por slug de empresa.",
        )
        parser.add_argument(
            "--limite", type=int, default=None,
            help="Processa no máximo N usinas (útil pra testar).",
        )

    def handle(self, *args, **opts):
        dry_run: bool = opts["dry_run"]
        slug: str | None = opts["empresa"]
        limite: int | None = opts["limite"]

        qs = Usina.objects.filter(latitude__isnull=True, longitude__isnull=True)
        if slug:
            qs = qs.filter(empresa__slug=slug)
        if limite:
            qs = qs[:limite]

        total = qs.count() if not limite else min(limite, qs.count())
        self.stdout.write(f"Processando {total} usina(s) sem lat/lon...")
        if dry_run:
            self.stdout.write(self.style.WARNING("[dry-run] não vai persistir."))

        ok = sem_dados = nao_encontrado = falha = 0

        for idx, usina in enumerate(qs.iterator(), 1):
            tem_endereco = bool(
                (usina.endereco or "").strip()
                or (usina.cidade or "").strip()
                or (usina.estado or "").strip()
            )
            tem_cep = bool((usina.cep or "").strip())
            if not tem_endereco and not tem_cep:
                sem_dados += 1
                if idx % 10 == 0:
                    self._log_progresso(idx, total, ok, nao_encontrado, falha, sem_dados)
                continue

            try:
                if tem_endereco:
                    resultado = geocode_por_endereco(
                        endereco=usina.endereco,
                        bairro=getattr(usina, "bairro", "") or "",
                        cidade=usina.cidade,
                        estado=usina.estado,
                        cep=usina.cep,
                    )
                else:
                    resultado = geocode_por_cep(usina.cep)
            except GeocodeNaoEncontrado:
                nao_encontrado += 1
            except GeocodeError as exc:
                falha += 1
                self.stderr.write(self.style.ERROR(
                    f"  usina {usina.pk} '{usina.nome}': {exc}"
                ))
            else:
                ok += 1
                if not dry_run:
                    Usina.objects.filter(pk=usina.pk).update(
                        latitude=Decimal(str(resultado.latitude)),
                        longitude=Decimal(str(resultado.longitude)),
                    )

            if idx % 10 == 0:
                self._log_progresso(idx, total, ok, nao_encontrado, falha, sem_dados)

        self.stdout.write(self.style.SUCCESS(
            f"Concluído. ok={ok} nao_encontrado={nao_encontrado} "
            f"falha={falha} sem_dados={sem_dados} (dry_run={dry_run})"
        ))

    def _log_progresso(self, idx, total, ok, nao_encontrado, falha, sem_dados):
        self.stdout.write(
            f"  [{idx}/{total}] ok={ok} nao_encontrado={nao_encontrado} "
            f"falha={falha} sem_dados={sem_dados}"
        )
