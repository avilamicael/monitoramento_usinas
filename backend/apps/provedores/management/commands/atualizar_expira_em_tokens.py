"""Popula `ContaProvedor.cache_token_expira_em` retroativamente para
contas com token cacheado.

Por que existe: até a v atual, o motor de coleta gravava
`cache_token_enc` mas não preenchia `cache_token_expira_em`. O frontend
classificava esses provedores como "Sem token" mesmo coletando OK
(Solarman 103 usinas / 273 inversores, status sucesso). A partir
desta release, `tasks.py::sincronizar_conta_provedor` extrai o claim
`exp` do JWT no momento de salvar o cache. Este comando aplica a mesma
lógica em contas que já existem, sem precisar esperar uma coleta nova.

Uso:

    python manage.py atualizar_expira_em_tokens --dry-run
    python manage.py atualizar_expira_em_tokens

Idempotente: rodar duas vezes não muda nada na segunda vez (o valor já
estará persistido). Tokens não-JWT (Bearer UUID Auxsol, session
Hoymiles) ficam com `cache_token_expira_em=NULL` — o frontend mostra
"Válido" sem prazo nesses casos.
"""
from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.provedores.cripto import descriptografar, parsear_exp_jwt
from apps.provedores.models import ContaProvedor


class Command(BaseCommand):
    help = (
        "Atualiza `cache_token_expira_em` em todas as contas ativas com "
        "token cacheado, extraindo o claim `exp` do JWT quando aplicável."
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Apenas mostra o que seria atualizado, sem persistir.",
        )

    def handle(self, *args, **opts) -> None:
        dry_run: bool = opts["dry_run"]
        contas = ContaProvedor.objects.filter(is_active=True).exclude(
            cache_token_enc=""
        )

        atualizadas = 0
        sem_jwt = 0
        falhas = 0
        ja_certas = 0

        for conta in contas:
            try:
                cache = descriptografar(conta.cache_token_enc)
            except Exception as exc:  # noqa: BLE001
                self.stderr.write(
                    self.style.ERROR(
                        f"[{conta.tipo}/{conta.rotulo}] descriptografia falhou: {exc}"
                    )
                )
                falhas += 1
                continue

            token = cache.get("token") if isinstance(cache, dict) else None
            nova_expira = parsear_exp_jwt(token or "")

            if nova_expira is None:
                # Token opaco (não-JWT) — permanece null. Se já era null,
                # nada muda; se tinha valor errado, limpamos.
                if conta.cache_token_expira_em is None:
                    sem_jwt += 1
                    self.stdout.write(
                        f"[{conta.tipo}/{conta.rotulo}] token não-JWT — mantém null."
                    )
                    continue
                self.stdout.write(
                    f"[{conta.tipo}/{conta.rotulo}] token virou opaco — limpando expira_em."
                )
                if not dry_run:
                    conta.cache_token_expira_em = None
                    conta.save(update_fields=["cache_token_expira_em", "updated_at"])
                atualizadas += 1
                continue

            if conta.cache_token_expira_em == nova_expira:
                ja_certas += 1
                continue

            self.stdout.write(
                f"[{conta.tipo}/{conta.rotulo}] expira_em: "
                f"{conta.cache_token_expira_em} → {nova_expira.isoformat()}"
            )
            if not dry_run:
                conta.cache_token_expira_em = nova_expira
                conta.save(update_fields=["cache_token_expira_em", "updated_at"])
            atualizadas += 1

        prefixo = "[dry-run] " if dry_run else ""
        self.stdout.write(self.style.SUCCESS(
            f"{prefixo}atualizadas={atualizadas} ja_certas={ja_certas} "
            f"sem_jwt={sem_jwt} falhas={falhas}"
        ))
