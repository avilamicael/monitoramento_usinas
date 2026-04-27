from __future__ import annotations

from apps.core.api import EmpresaModelViewSet

from .models import Inversor
from .serializers import InversorSerializer


class InversorViewSet(EmpresaModelViewSet):
    queryset = Inversor.objects.all().select_related("usina")
    serializer_class = InversorSerializer
    filterset_fields = ("usina", "tipo", "is_active")
    search_fields = ("numero_serie", "modelo", "id_externo", "usina__nome")
    ordering_fields = ("numero_serie", "ultima_leitura_em", "created_at")
    ordering = ("usina__nome", "numero_serie")
