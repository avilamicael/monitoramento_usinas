from __future__ import annotations

from datetime import date

from django_filters import rest_framework as filters

from apps.core.api import EmpresaModelViewSet

from .models import Garantia
from .serializers import GarantiaSerializer


class GarantiaFilter(filters.FilterSet):
    """Filtros: por provedor da usina, status (ativa/vencida)."""

    provedor = filters.CharFilter(field_name="usina__conta_provedor__tipo")
    status = filters.CharFilter(method="filtrar_status")

    class Meta:
        model = Garantia
        fields = ("usina", "provedor", "status")

    def filtrar_status(self, queryset, name, value):
        # `fim_em` é property — filtro precisa iterar.
        hoje = date.today()
        if value == "ativa":
            ids = [g.pk for g in queryset if g.fim_em >= hoje]
        elif value == "vencida":
            ids = [g.pk for g in queryset if g.fim_em < hoje]
        else:
            return queryset
        return queryset.filter(pk__in=ids)


class GarantiaViewSet(EmpresaModelViewSet):
    queryset = Garantia.objects.all().select_related("usina", "usina__conta_provedor")
    serializer_class = GarantiaSerializer
    filterset_class = GarantiaFilter
    search_fields = ("usina__nome", "fornecedor")
    ordering_fields = ("inicio_em", "meses", "usina__nome")
    ordering = ("usina__nome",)
