from __future__ import annotations

from django.utils import timezone
from django_filters import rest_framework as filters

from apps.core.api import EmpresaModelViewSet

from .models import MonitoramentoAtivo
from .serializers import MonitoramentoAtivoSerializer


class MonitoramentoAtivoFilter(filters.FilterSet):
    """Filtros: por provedor da usina, status (ativa/vencida)."""

    provedor = filters.CharFilter(field_name="usina__conta_provedor__tipo")
    status = filters.CharFilter(method="filtrar_status")

    class Meta:
        model = MonitoramentoAtivo
        fields = ("usina", "provedor", "status")

    def filtrar_status(self, queryset, name, value):
        # `fim_em` é coluna real — dá pra filtrar direto em SQL (sem iterar).
        hoje = timezone.localdate()
        if value == "ativa":
            return queryset.filter(fim_em__gte=hoje)
        if value == "vencida":
            return queryset.filter(fim_em__lt=hoje)
        return queryset


class MonitoramentoAtivoViewSet(EmpresaModelViewSet):
    queryset = MonitoramentoAtivo.objects.all().select_related(
        "usina", "usina__conta_provedor"
    )
    serializer_class = MonitoramentoAtivoSerializer
    filterset_class = MonitoramentoAtivoFilter
    search_fields = ("usina__nome", "contratante")
    ordering_fields = ("inicio_em", "fim_em", "meses", "valor_mensal", "usina__nome")
    ordering = ("usina__nome",)
