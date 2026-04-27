"""Bases reutilizáveis para a camada de API.

Toda ViewSet de model com escopo de empresa deve herdar de
`EmpresaModelViewSet` (ou variantes read-only) — isso garante que o queryset
seja filtrado pela empresa do usuário autenticado e que `empresa` seja
preenchido automaticamente em criação.

`EmpresaMiddleware` resolve `request.empresa` para requests com auth de
sessão (admin Django), mas para JWT (DRF) o middleware roda antes da
autenticação acontecer, então `request.empresa` fica `None`. As helpers
abaixo caem para `request.user.empresa` quando necessário.
"""
from __future__ import annotations

from rest_framework import mixins, viewsets

from apps.usuarios.permissions import AdminEmpresaOuSomenteLeitura, PertenceEmpresa


def empresa_do_request(request):
    """Resolve a empresa do request — middleware (sessão) ou user (JWT)."""
    empresa = getattr(request, "empresa", None)
    if empresa is not None:
        return empresa
    user = getattr(request, "user", None)
    if user is not None and user.is_authenticated:
        return getattr(user, "empresa", None)
    return None


class EmpresaQuerysetMixin:
    """Filtra `queryset` pela empresa do request e preenche `empresa` no save."""

    def get_queryset(self):
        qs = super().get_queryset()
        empresa = empresa_do_request(self.request)
        if empresa is None:
            return qs.none()
        return qs.filter(empresa=empresa)

    def perform_create(self, serializer):
        serializer.save(empresa=empresa_do_request(self.request))


class EmpresaModelViewSet(EmpresaQuerysetMixin, viewsets.ModelViewSet):
    """CRUD completo escopado por empresa, com permissão por papel.

    Leitura: qualquer membro da empresa.
    Escrita: apenas administradores (`is_admin_empresa`).
    """

    permission_classes = [AdminEmpresaOuSomenteLeitura]


class EmpresaReadOnlyViewSet(EmpresaQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """List + Retrieve escopado por empresa. Para entidades de auditoria
    (LogColeta, LeituraUsina, LeituraInversor, EntregaNotificacao)."""

    permission_classes = [PertenceEmpresa]


class EmpresaListUpdateViewSet(
    EmpresaQuerysetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """List + Retrieve + Update — sem create/delete. Útil para singletons
    como `ConfiguracaoEmpresa` (1:1 com Empresa)."""

    permission_classes = [AdminEmpresaOuSomenteLeitura]
