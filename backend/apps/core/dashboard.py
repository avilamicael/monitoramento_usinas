"""Endpoints agregados para o dashboard.

Sempre filtram pela empresa do request — nada vaza entre tenants.
"""
from __future__ import annotations

from datetime import timedelta

from django.db.models import Count, OuterRef, Q, Subquery, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone as djtz
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.alertas.models import Alerta, EstadoAlerta, SeveridadeAlerta
from apps.core.api import empresa_do_request
from apps.inversores.models import Inversor
from apps.monitoramento.models import LeituraUsina
from apps.usinas.models import Usina


def _empresa_ou_403(request):
    empresa = empresa_do_request(request)
    if empresa is None:
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Usuário sem empresa associada.")
    return empresa


class DashboardKpisView(APIView):
    """Cartões de topo do dashboard:
    - usinas (total / ativas)
    - inversores (total / ativos)
    - alertas (abertos por severidade)
    - capacidade total instalada (kWp)
    - energia hoje (kWh) — soma da última leitura por usina hoje
    - potência atual (kW) — soma da potência da última leitura
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        empresa = _empresa_ou_403(request)
        agora = djtz.now()
        inicio_dia = agora.replace(hour=0, minute=0, second=0, microsecond=0)

        usinas_qs = Usina.objects.filter(empresa=empresa)
        inversores_qs = Inversor.objects.filter(empresa=empresa)
        alertas_abertos = Alerta.objects.filter(empresa=empresa, estado=EstadoAlerta.ABERTO)

        # Última leitura por usina (hoje) — pra somar potencia/energia
        ultima_leitura_id = (
            LeituraUsina.objects.filter(usina=OuterRef("pk"), coletado_em__gte=inicio_dia)
            .order_by("-coletado_em")
            .values("pk")[:1]
        )
        leituras_recentes = LeituraUsina.objects.filter(
            pk__in=Subquery(
                usinas_qs.annotate(ult=Subquery(ultima_leitura_id)).values("ult")
            )
        )
        agregado = leituras_recentes.aggregate(
            energia_kwh=Sum("energia_hoje_kwh"),
            potencia_kw=Sum("potencia_kw"),
        )

        capacidade = usinas_qs.aggregate(s=Sum("capacidade_kwp"))["s"] or 0

        return Response({
            "usinas": {
                "total": usinas_qs.count(),
                "ativas": usinas_qs.filter(is_active=True).count(),
            },
            "inversores": {
                "total": inversores_qs.count(),
                "ativos": inversores_qs.filter(is_active=True).count(),
            },
            "alertas_abertos": {
                "total": alertas_abertos.count(),
                "critico": alertas_abertos.filter(severidade=SeveridadeAlerta.CRITICO).count(),
                "aviso": alertas_abertos.filter(severidade=SeveridadeAlerta.AVISO).count(),
                "info": alertas_abertos.filter(severidade=SeveridadeAlerta.INFO).count(),
            },
            "capacidade_kwp": str(capacidade),
            "energia_hoje_kwh": str(agregado["energia_kwh"] or 0),
            "potencia_atual_kw": str(agregado["potencia_kw"] or 0),
        })


class DashboardGeracaoDiariaView(APIView):
    """Série temporal de geração diária (últimos N dias, default 30)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        empresa = _empresa_ou_403(request)
        try:
            dias = int(request.query_params.get("dias", "30"))
        except (TypeError, ValueError):
            dias = 30
        dias = max(1, min(365, dias))
        desde = djtz.now() - timedelta(days=dias)

        # Por dia, soma da MAIOR energia_hoje_kwh por usina (energia_hoje é
        # cumulativa intra-dia; o pico do dia é o total daquele dia).
        from django.db.models import Max
        qs = (
            LeituraUsina.objects.filter(empresa=empresa, coletado_em__gte=desde)
            .annotate(dia=TruncDate("coletado_em"))
            .values("dia", "usina_id")
            .annotate(maxima=Max("energia_hoje_kwh"))
        )
        por_dia: dict = {}
        for r in qs:
            por_dia.setdefault(r["dia"], 0)
            por_dia[r["dia"]] += float(r["maxima"] or 0)

        serie = [{"dia": dia.isoformat(), "energia_kwh": valor} for dia, valor in sorted(por_dia.items())]
        return Response(serie)


class DashboardTopFabricantesView(APIView):
    """Ranking de provedores por geração total nos últimos N dias (default 7)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        empresa = _empresa_ou_403(request)
        try:
            dias = int(request.query_params.get("dias", "7"))
        except (TypeError, ValueError):
            dias = 7
        dias = max(1, min(365, dias))
        desde = djtz.now() - timedelta(days=dias)

        from django.db.models import Max
        # Para cada (usina, dia), pega o pico de energia_hoje_kwh; agrupa por
        # provedor da usina. Aproximação: somatório dos picos por dia.
        qs = (
            LeituraUsina.objects.filter(empresa=empresa, coletado_em__gte=desde)
            .annotate(dia=TruncDate("coletado_em"))
            .values("usina_id", "dia", "usina__conta_provedor__tipo", "usina__capacidade_kwp")
            .annotate(maxima=Max("energia_hoje_kwh"))
        )
        por_provedor: dict = {}
        for r in qs:
            tipo = r["usina__conta_provedor__tipo"]
            if not tipo:
                continue
            por_provedor.setdefault(tipo, {"energia_kwh": 0.0, "capacidade_kwp": 0.0, "usinas": set()})
            por_provedor[tipo]["energia_kwh"] += float(r["maxima"] or 0)
            por_provedor[tipo]["usinas"].add(r["usina_id"])

        # Capacidade por provedor
        for tipo, dados in por_provedor.items():
            cap = (
                Usina.objects.filter(empresa=empresa, conta_provedor__tipo=tipo)
                .aggregate(s=Sum("capacidade_kwp"))["s"] or 0
            )
            dados["capacidade_kwp"] = float(cap)
            dados["qtd_usinas"] = len(dados["usinas"])
            dados["eficiencia_kwh_kwp"] = (
                dados["energia_kwh"] / dados["capacidade_kwp"]
                if dados["capacidade_kwp"] > 0 else 0
            )
            del dados["usinas"]

        ranking = [
            {"provedor": tipo, **dados}
            for tipo, dados in sorted(por_provedor.items(), key=lambda kv: -kv[1]["energia_kwh"])
        ]
        return Response(ranking)


class DashboardAlertasCriticosView(APIView):
    """Lista os N alertas críticos abertos mais recentes (default 10)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        empresa = _empresa_ou_403(request)
        try:
            limite = int(request.query_params.get("limite", "10"))
        except (TypeError, ValueError):
            limite = 10
        limite = max(1, min(100, limite))

        from apps.alertas.serializers import AlertaSerializer
        qs = (
            Alerta.objects.filter(
                empresa=empresa,
                estado=EstadoAlerta.ABERTO,
                severidade=SeveridadeAlerta.CRITICO,
            )
            .select_related("usina", "inversor")
            .order_by("-aberto_em")[:limite]
        )
        return Response(AlertaSerializer(qs, many=True).data)
