from __future__ import annotations

from django_filters import rest_framework as filters

from apps.core.api import EmpresaReadOnlyViewSet

from .models import LogColeta
from .serializers import LogColetaSerializer


class LogColetaFilter(filters.FilterSet):
    desde = filters.IsoDateTimeFilter(field_name="iniciado_em", lookup_expr="gte")
    ate = filters.IsoDateTimeFilter(field_name="iniciado_em", lookup_expr="lte")
    provedor = filters.CharFilter(field_name="conta_provedor__tipo")

    class Meta:
        model = LogColeta
        fields = ("conta_provedor", "provedor", "status", "desde", "ate")


class LogColetaViewSet(EmpresaReadOnlyViewSet):
    queryset = LogColeta.objects.all().select_related("conta_provedor")
    serializer_class = LogColetaSerializer
    filterset_class = LogColetaFilter
    ordering_fields = ("iniciado_em", "duracao_ms")
    ordering = ("-iniciado_em",)
