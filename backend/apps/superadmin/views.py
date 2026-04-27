"""ViewSets do painel superadmin (cross-tenant).

Diferenciais em relação aos ViewSets comuns:

- **Não filtram por `request.empresa`**. Superadmin vê e edita todas as
  empresas e usuários do sistema.
- Apenas `papel = superadmin` tem acesso (permissão `EhSuperadmin`).
- Tag `superadmin` no Swagger pra separar dos endpoints comuns.

Soft delete: o `destroy` padrão do DRF foi sobrescrito para marcar
`is_active=False` em vez de remover do banco — preserva histórico de
leituras, alertas e logs ligados à empresa.
"""
from __future__ import annotations

from django.db.models import Count
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.response import Response

from apps.empresas.models import Empresa
from apps.usuarios.models import Usuario
from apps.usuarios.permissions import EhSuperadmin

from .serializers import (
    EmpresaSerializerSuperadmin,
    UsuarioSerializerSuperadmin,
)


@extend_schema_view(
    list=extend_schema(tags=["superadmin"]),
    retrieve=extend_schema(tags=["superadmin"]),
    create=extend_schema(tags=["superadmin"]),
    update=extend_schema(tags=["superadmin"]),
    partial_update=extend_schema(tags=["superadmin"]),
    destroy=extend_schema(tags=["superadmin"]),
)
class EmpresaSuperadminViewSet(viewsets.ModelViewSet):
    """CRUD cross-tenant de Empresas (apenas superadmin)."""

    serializer_class = EmpresaSerializerSuperadmin
    permission_classes = [EhSuperadmin]
    filterset_fields = ("is_active", "uf")
    search_fields = ("nome", "slug", "cnpj", "cidade")
    ordering_fields = ("nome", "created_at", "updated_at")
    ordering = ("nome",)

    def get_queryset(self):
        return (
            Empresa.objects.all()
            .annotate(
                qtd_usuarios=Count("usuarios", distinct=True),
                qtd_usinas=Count("usinas_usina_set", distinct=True),
            )
        )

    def destroy(self, request, *args, **kwargs):
        """Soft delete — marca empresa como inativa."""
        empresa = self.get_object()
        empresa.is_active = False
        empresa.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema_view(
    list=extend_schema(tags=["superadmin"]),
    retrieve=extend_schema(tags=["superadmin"]),
    create=extend_schema(tags=["superadmin"]),
    update=extend_schema(tags=["superadmin"]),
    partial_update=extend_schema(tags=["superadmin"]),
    destroy=extend_schema(tags=["superadmin"]),
)
class UsuarioSuperadminViewSet(viewsets.ModelViewSet):
    """CRUD cross-tenant de Usuários (apenas superadmin).

    Filtros suportados via query string:
        ?empresa=<uuid>
        ?papel=<superadmin|administrador|operacional>
        ?is_active=true|false
    """

    queryset = Usuario.objects.all().select_related("empresa")
    serializer_class = UsuarioSerializerSuperadmin
    permission_classes = [EhSuperadmin]
    filterset_fields = ("empresa", "papel", "is_active")
    search_fields = ("username", "email", "first_name", "last_name")
    ordering_fields = ("username", "date_joined", "last_login")
    ordering = ("username",)

    def destroy(self, request, *args, **kwargs):
        """Soft delete — desativa o usuário em vez de remover."""
        usuario = self.get_object()
        usuario.is_active = False
        usuario.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)
