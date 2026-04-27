from __future__ import annotations

from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.usuarios.permissions import AdminEmpresaOuSomenteLeitura

from .api import empresa_do_request
from .models import ConfiguracaoEmpresa
from .serializers import ConfiguracaoEmpresaSerializer


class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request):
        return Response({"status": "ok"})


class ConfiguracaoEmpresaView(GenericAPIView):
    """Configuração singleton da empresa autenticada.

    Endpoint sem ID — sempre 1:1 com `Empresa` resolvida do request.

    - `GET /api/configuracoes/`: retorna a configuração; cria com defaults
      se ainda não existir (`get_or_create`).
    - `PUT /api/configuracoes/`: substitui todos os campos editáveis.
    - `PATCH /api/configuracoes/`: atualiza parcialmente.

    Permissão: leitura para qualquer membro da empresa, escrita apenas
    para administradores.
    """

    serializer_class = ConfiguracaoEmpresaSerializer
    permission_classes = [AdminEmpresaOuSomenteLeitura]

    def _get_objeto(self):
        empresa = empresa_do_request(self.request)
        if empresa is None:
            return None
        config, _ = ConfiguracaoEmpresa.objects.get_or_create(empresa=empresa)
        return config

    def get(self, request, *args, **kwargs):
        config = self._get_objeto()
        if config is None:
            return Response(
                {"detail": "Empresa não resolvida do request."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(config)
        return Response(serializer.data)

    def put(self, request, *args, **kwargs):
        return self._atualizar(request, parcial=False)

    def patch(self, request, *args, **kwargs):
        return self._atualizar(request, parcial=True)

    def _atualizar(self, request, *, parcial: bool):
        config = self._get_objeto()
        if config is None:
            return Response(
                {"detail": "Empresa não resolvida do request."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(config, data=request.data, partial=parcial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
