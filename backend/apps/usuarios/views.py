from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.api import EmpresaQuerysetMixin

from .models import Usuario
from .permissions import PertenceEmpresa
from .serializers import (
    TrocarSenhaSerializer,
    UsuarioCreateSerializer,
    UsuarioSerializer,
    UsuarioUpdateSerializer,
)


class UsuarioViewSet(EmpresaQuerysetMixin, viewsets.ModelViewSet):
    """CRUD de usuários da empresa.

    - `GET /api/usuarios/me/` — usuário autenticado.
    - `POST /api/usuarios/me/trocar_senha/` — trocar a própria senha.
    - Demais ações exigem `papel = administrador`.
    """

    queryset = Usuario.objects.all().select_related("empresa")
    permission_classes = [IsAuthenticated]
    filterset_fields = ("papel", "is_active")
    search_fields = ("username", "email", "first_name", "last_name")
    ordering_fields = ("username", "date_joined", "last_login")
    ordering = ("username",)

    def get_serializer_class(self):
        if self.action == "create":
            return UsuarioCreateSerializer
        if self.action in ("update", "partial_update"):
            return UsuarioUpdateSerializer
        if self.action == "trocar_senha":
            return TrocarSenhaSerializer
        return UsuarioSerializer

    def get_permissions(self):
        # /me/ e /me/trocar_senha/ — qualquer membro da empresa.
        if self.action in ("me", "trocar_senha"):
            return [PertenceEmpresa()]
        # Demais ações: precisa estar na empresa, e escritas exigem admin.
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [PertenceEmpresa()]
        # Mutations: admin da empresa.
        return [PertenceEmpresa(), _SomenteAdmin()]

    @action(detail=False, methods=["get"])
    def me(self, request):
        return Response(UsuarioSerializer(request.user).data)

    @action(detail=False, methods=["post"], url_path="me/trocar_senha")
    def trocar_senha(self, request):
        serializer = TrocarSenhaSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["nova_senha"])
        request.user.save(update_fields=["password"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class _SomenteAdmin(PertenceEmpresa):
    """Permissão extra usada apenas em mutations de UsuarioViewSet."""

    def has_permission(self, request, view) -> bool:
        if not super().has_permission(request, view):
            return False
        return bool(request.user.is_admin_empresa)
