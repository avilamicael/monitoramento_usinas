from __future__ import annotations

from rest_framework.permissions import SAFE_METHODS, BasePermission


class PertenceEmpresa(BasePermission):
    """Usuário precisa estar autenticado e associado a uma empresa."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.empresa_id)


class AdminEmpresaOuSomenteLeitura(PertenceEmpresa):
    """Leitura: qualquer membro da empresa. Escrita: apenas administrador."""

    def has_permission(self, request, view) -> bool:
        if not super().has_permission(request, view):
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_admin_empresa


class EhSuperadmin(BasePermission):
    """Apenas usuários com `papel = superadmin` (time interno Firma Solar).

    Usado nas rotas `/api/superadmin/*` que operam **cross-tenant** —
    ignoram `request.empresa`, lendo/editando todas as empresas e usuários
    do sistema.
    """

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "is_superadmin", False)
        )
