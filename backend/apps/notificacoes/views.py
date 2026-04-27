from __future__ import annotations

from django_filters import rest_framework as filters

from apps.core.api import EmpresaModelViewSet, EmpresaReadOnlyViewSet

from .models import EndpointWebhook, EntregaNotificacao, RegraNotificacao
from .serializers import (
    EndpointWebhookSerializer,
    EntregaNotificacaoSerializer,
    RegraNotificacaoSerializer,
)


class RegraNotificacaoViewSet(EmpresaModelViewSet):
    queryset = RegraNotificacao.objects.all()
    serializer_class = RegraNotificacaoSerializer
    filterset_fields = ("canal", "is_active")
    search_fields = ("nome",)
    ordering_fields = ("nome", "created_at")
    ordering = ("nome",)


class EndpointWebhookViewSet(EmpresaModelViewSet):
    queryset = EndpointWebhook.objects.all()
    serializer_class = EndpointWebhookSerializer
    filterset_fields = ("is_active",)
    ordering = ("-created_at",)


class EntregaNotificacaoFilter(filters.FilterSet):
    desde = filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="gte")
    ate = filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="lte")

    class Meta:
        model = EntregaNotificacao
        fields = ("regra", "alerta", "canal", "status", "desde", "ate")


class EntregaNotificacaoViewSet(EmpresaReadOnlyViewSet):
    queryset = EntregaNotificacao.objects.all().select_related(
        "alerta", "alerta__usina", "regra"
    )
    serializer_class = EntregaNotificacaoSerializer
    filterset_class = EntregaNotificacaoFilter
    ordering_fields = ("created_at", "enviado_em")
    ordering = ("-created_at",)
