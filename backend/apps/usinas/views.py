from __future__ import annotations

from django.db.models import Count, Q
from django_filters import rest_framework as filters
from rest_framework import status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.alertas.models import EstadoAlerta
from apps.core.api import EmpresaModelViewSet

from .geocode import (
    GeocodeError,
    GeocodeNaoEncontrado,
    geocode_por_cep,
    geocode_por_endereco,
)
from .models import Usina
from .serializers import UsinaDetalhadaSerializer, UsinaListSerializer


class UsinaFilter(filters.FilterSet):
    """Filtros expostos pela API. Suporta:

    - `?conta_provedor=<uuid>` — filtra por conta específica.
    - `?provedor=<tipo>` — filtra por tipo de provedor (solis, hoymiles, …).
    - `?status_garantia=ativa|vencida|sem_garantia` — derivado de `garantia`.
    - `?is_active=true|false` — usinas ativas.
    """

    provedor = filters.CharFilter(field_name="conta_provedor__tipo")
    status_garantia = filters.CharFilter(method="filtrar_status_garantia")

    class Meta:
        model = Usina
        fields = ("conta_provedor", "provedor", "is_active", "expoe_dados_inversor")

    def filtrar_status_garantia(self, queryset, name, value):
        from datetime import date
        hoje = date.today()
        if value == "sem_garantia":
            return queryset.filter(garantia__isnull=True)
        # `fim_em` é property; precisa filtrar por data calculada — Garantia
        # não armazena `fim_em`. Para evitar SQL custom, usa um filtro Python
        # quando o conjunto for pequeno; em produção real isso vira coluna.
        ids = [u.pk for u in queryset.select_related("garantia") if (
            (u.garantia is not None and (u.garantia.fim_em >= hoje) == (value == "ativa"))
        )]
        return queryset.filter(pk__in=ids)


class UsinaViewSet(EmpresaModelViewSet):
    queryset = Usina.objects.all().select_related("conta_provedor", "garantia")
    filterset_class = UsinaFilter
    search_fields = ("nome", "cidade", "estado", "id_externo")
    ordering_fields = ("nome", "capacidade_kwp", "ultima_leitura_em", "created_at")
    ordering = ("nome",)

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.annotate(
            qtd_inversores=Count("inversores", distinct=True),
            qtd_alertas_abertos=Count(
                "alertas",
                filter=Q(alertas__estado=EstadoAlerta.ABERTO),
                distinct=True,
            ),
        )

    def get_serializer_class(self):
        if self.action == "list":
            return UsinaListSerializer
        return UsinaDetalhadaSerializer

    @action(detail=True, methods=["post"])
    def desativar(self, request, pk=None):
        usina = self.get_object()
        usina.is_active = False
        usina.save(update_fields=["is_active"])
        return Response({"is_active": usina.is_active})

    @action(detail=True, methods=["post"])
    def ativar(self, request, pk=None):
        usina = self.get_object()
        usina.is_active = True
        usina.save(update_fields=["is_active"])
        return Response({"is_active": usina.is_active})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def geocode_view(request):
    """Resolve `{cep}` ou `{endereco, bairro, cidade, estado, cep}` em
    `{latitude, longitude, endereco_normalizado}` via Nominatim.

    - 200: payload `{latitude, longitude, endereco_normalizado}`.
    - 400: query inválida (faltando dados / CEP malformado).
    - 404: Nominatim não encontrou nada para a query.
    - 503: timeout ou erro de rede contra o Nominatim.
    """
    body = request.data or {}
    cep = (body.get("cep") or "").strip()
    endereco = (body.get("endereco") or "").strip()
    bairro = (body.get("bairro") or "").strip()
    cidade = (body.get("cidade") or "").strip()
    estado = (body.get("estado") or "").strip()

    try:
        if endereco or cidade or estado:
            resultado = geocode_por_endereco(
                endereco=endereco,
                bairro=bairro,
                cidade=cidade,
                estado=estado,
                cep=cep,
            )
        elif cep:
            resultado = geocode_por_cep(cep)
        else:
            return Response(
                {"detail": "Informe `cep` ou `endereco`+`cidade`+`estado`."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    except GeocodeNaoEncontrado as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
    except GeocodeError as exc:
        return Response(
            {"detail": f"Falha ao consultar serviço de geocoding: {exc}"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response(
        {
            "latitude": resultado.latitude,
            "longitude": resultado.longitude,
            "endereco_normalizado": resultado.endereco_normalizado,
        }
    )
