from __future__ import annotations

from django.utils import timezone as djtz
from django_filters import rest_framework as filters
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api import EmpresaQuerysetMixin
from apps.usuarios.permissions import AdminEmpresaOuSomenteLeitura

from .models import Alerta, EstadoAlerta
from .serializers import AlertaSerializer, AlertaUpdateSerializer


class AlertaFilter(filters.FilterSet):
    desde = filters.IsoDateTimeFilter(field_name="aberto_em", lookup_expr="gte")
    ate = filters.IsoDateTimeFilter(field_name="aberto_em", lookup_expr="lte")
    provedor = filters.CharFilter(field_name="usina__conta_provedor__tipo")

    class Meta:
        model = Alerta
        fields = (
            "estado",
            "severidade",
            "regra",
            "usina",
            "inversor",
            "provedor",
            "desde",
            "ate",
        )


class AlertaViewSet(
    EmpresaQuerysetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Read + PATCH. Alertas são criados/resolvidos pelo motor automaticamente.

    O endpoint PATCH/PUT permite que o operador feche manualmente um alerta
    (`estado=resolvido`) ou ajuste severidade. Não há criação manual.
    """

    queryset = Alerta.objects.all().select_related("usina", "inversor", "usina__conta_provedor")
    permission_classes = [AdminEmpresaOuSomenteLeitura]
    filterset_class = AlertaFilter
    search_fields = ("mensagem", "usina__nome", "inversor__numero_serie")
    ordering_fields = ("aberto_em", "atualizado_em", "severidade")
    ordering = ("-aberto_em",)

    def get_serializer_class(self):
        if self.action in ("update", "partial_update"):
            return AlertaUpdateSerializer
        return AlertaSerializer

    @action(detail=True, methods=["post"])
    def resolver(self, request, pk=None):
        """Marca o alerta como resolvido manualmente."""
        alerta = self.get_object()
        if alerta.estado != EstadoAlerta.RESOLVIDO:
            alerta.estado = EstadoAlerta.RESOLVIDO
            alerta.resolvido_em = djtz.now()
            alerta.save(update_fields=["estado", "resolvido_em", "atualizado_em"])
        return Response(AlertaSerializer(alerta).data)

    @action(detail=True, methods=["post"])
    def reconhecer(self, request, pk=None):
        """Marca o alerta como reconhecido (operador ciente, ainda não resolveu)."""
        alerta = self.get_object()
        if alerta.estado == EstadoAlerta.ABERTO:
            alerta.estado = EstadoAlerta.RECONHECIDO
            alerta.save(update_fields=["estado", "atualizado_em"])
        return Response(AlertaSerializer(alerta).data)
