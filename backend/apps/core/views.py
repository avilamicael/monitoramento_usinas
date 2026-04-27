from __future__ import annotations

from rest_framework import mixins, viewsets
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


class ConfiguracaoEmpresaViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Configuração singleton da empresa autenticada.

    Sempre 1:1 com `Empresa` — o list devolve apenas a configuração da
    empresa do request. Update permitido só para administradores.
    """

    queryset = ConfiguracaoEmpresa.objects.all()
    serializer_class = ConfiguracaoEmpresaSerializer
    permission_classes = [AdminEmpresaOuSomenteLeitura]

    def get_queryset(self):
        empresa = empresa_do_request(self.request)
        if empresa is None:
            return ConfiguracaoEmpresa.objects.none()
        return ConfiguracaoEmpresa.objects.filter(empresa=empresa)
