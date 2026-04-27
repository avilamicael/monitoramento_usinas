from __future__ import annotations

from rest_framework import mixins, viewsets

from apps.core.api import empresa_do_request
from apps.usuarios.permissions import AdminEmpresaOuSomenteLeitura

from .models import Empresa
from .serializers import EmpresaSerializer


class EmpresaViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Empresa do usuário autenticado.

    Lista/recupera/atualiza apenas a própria empresa — multi-tenant não
    expõe outras. `request.empresa` é injetado por `EmpresaMiddleware`.
    """

    queryset = Empresa.objects.all()
    serializer_class = EmpresaSerializer
    permission_classes = [AdminEmpresaOuSomenteLeitura]

    def get_queryset(self):
        empresa = empresa_do_request(self.request)
        if empresa is None:
            return Empresa.objects.none()
        return Empresa.objects.filter(pk=empresa.pk)
