"""Cria (idempotente) uma Empresa "Firma Solar" e um Usuario superadmin.

Uso:

    python manage.py criar_superadmin --username=micael --senha=<segredo>
    python manage.py criar_superadmin \
        --username=micael --senha=<segredo> \
        --empresa=firma-solar --email=micael@firmasolar.com.br

Comportamento:

- Cria a Empresa identificada pelo `--empresa` (slug) se não existir.
- Cria/atualiza o Usuario com `papel=superadmin` apontando pra essa empresa.
  Se já existir, redefine senha + papel + empresa (idempotente).
- Não interativo. Útil em provisionamento e CI.
"""
from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.empresas.models import Empresa
from apps.usuarios.models import PapelUsuario, Usuario


class Command(BaseCommand):
    help = "Cria (idempotente) Empresa Firma Solar + Usuario superadmin."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--username", required=True, help="Username do superadmin.")
        parser.add_argument("--senha", required=True, help="Senha em texto puro.")
        parser.add_argument(
            "--empresa",
            default="firma-solar",
            help="Slug da empresa interna (default: firma-solar).",
        )
        parser.add_argument(
            "--empresa-nome",
            default="Firma Solar",
            help="Nome da empresa interna (default: Firma Solar).",
        )
        parser.add_argument("--email", default="", help="E-mail do usuário (opcional).")
        parser.add_argument("--first-name", default="", help="Primeiro nome (opcional).")
        parser.add_argument("--last-name", default="", help="Sobrenome (opcional).")

    @transaction.atomic
    def handle(self, *args, **opts) -> None:
        username = opts["username"].strip()
        senha = opts["senha"]
        slug = opts["empresa"].strip()
        empresa_nome = opts["empresa_nome"].strip()

        if not username or not senha:
            raise CommandError("--username e --senha são obrigatórios.")

        empresa, criada = Empresa.objects.get_or_create(
            slug=slug,
            defaults={"nome": empresa_nome, "is_active": True},
        )
        if criada:
            self.stdout.write(self.style.SUCCESS(f"Empresa criada: {empresa.nome} ({empresa.slug})"))
        else:
            self.stdout.write(f"Empresa já existia: {empresa.nome} ({empresa.slug})")

        usuario, criado = Usuario.objects.get_or_create(
            username=username,
            defaults={
                "email": opts.get("email") or "",
                "first_name": opts.get("first_name") or "",
                "last_name": opts.get("last_name") or "",
                "papel": PapelUsuario.SUPERADMIN,
                "empresa": empresa,
                "is_active": True,
            },
        )
        # Idempotência: garante papel/empresa/senha mesmo se o user já existia.
        usuario.papel = PapelUsuario.SUPERADMIN
        usuario.empresa = empresa
        usuario.is_active = True
        usuario.set_password(senha)
        usuario.save()

        if criado:
            self.stdout.write(self.style.SUCCESS(f"Superadmin criado: {usuario.username}"))
        else:
            self.stdout.write(
                self.style.SUCCESS(f"Superadmin atualizado (senha redefinida): {usuario.username}")
            )
