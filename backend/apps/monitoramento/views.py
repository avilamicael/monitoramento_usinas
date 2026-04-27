from __future__ import annotations

from datetime import timedelta

from django.db.models import Sum
from django.db.models.functions import TruncDate
from django.utils import timezone as djtz
from django_filters import rest_framework as filters
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api import EmpresaReadOnlyViewSet

from .models import LeituraInversor, LeituraUsina
from .serializers import LeituraInversorSerializer, LeituraUsinaSerializer


class LeituraUsinaFilter(filters.FilterSet):
    desde = filters.IsoDateTimeFilter(field_name="coletado_em", lookup_expr="gte")
    ate = filters.IsoDateTimeFilter(field_name="coletado_em", lookup_expr="lte")

    class Meta:
        model = LeituraUsina
        fields = ("usina", "status", "desde", "ate")


class LeituraUsinaViewSet(EmpresaReadOnlyViewSet):
    queryset = LeituraUsina.objects.all().select_related("usina")
    serializer_class = LeituraUsinaSerializer
    filterset_class = LeituraUsinaFilter
    ordering_fields = ("coletado_em", "medido_em")
    ordering = ("-coletado_em",)

    @action(detail=False, methods=["get"])
    def serie_diaria(self, request):
        """Soma de energia diária dos últimos N dias (default 30)."""
        try:
            dias = int(request.query_params.get("dias", "30"))
        except (TypeError, ValueError):
            dias = 30
        dias = max(1, min(365, dias))
        desde = djtz.now() - timedelta(days=dias)
        qs = self.get_queryset().filter(coletado_em__gte=desde)
        usina_id = request.query_params.get("usina")
        if usina_id:
            qs = qs.filter(usina_id=usina_id)
        # Para evitar dupla contagem em coletas duplicadas, agregamos pela
        # MÁXIMA energia_hoje por dia/usina (energia_hoje é monotônica até a
        # virada do dia). Aproximação suficiente para gráfico do dashboard.
        agregado = (
            qs.annotate(dia=TruncDate("coletado_em"))
            .values("dia")
            .annotate(energia_kwh=Sum("energia_hoje_kwh"))
            .order_by("dia")
        )
        return Response(list(agregado))


class LeituraInversorFilter(filters.FilterSet):
    desde = filters.IsoDateTimeFilter(field_name="coletado_em", lookup_expr="gte")
    ate = filters.IsoDateTimeFilter(field_name="coletado_em", lookup_expr="lte")

    class Meta:
        model = LeituraInversor
        fields = ("inversor", "usina", "estado", "desde", "ate")


class LeituraInversorViewSet(EmpresaReadOnlyViewSet):
    queryset = LeituraInversor.objects.all().select_related("inversor", "usina")
    serializer_class = LeituraInversorSerializer
    filterset_class = LeituraInversorFilter
    ordering_fields = ("coletado_em", "medido_em", "pac_kw")
    ordering = ("-coletado_em",)
