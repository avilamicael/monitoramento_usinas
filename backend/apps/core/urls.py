from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .dashboard import (
    DashboardAlertasCriticosView,
    DashboardGeracaoDiariaView,
    DashboardKpisView,
    DashboardTopFabricantesView,
)
from .views import ConfiguracaoEmpresaViewSet, HealthView

router = DefaultRouter()
router.register("configuracao", ConfiguracaoEmpresaViewSet, basename="configuracao")

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("dashboard/kpis/", DashboardKpisView.as_view(), name="dashboard-kpis"),
    path("dashboard/geracao_diaria/", DashboardGeracaoDiariaView.as_view(), name="dashboard-geracao"),
    path("dashboard/top_fabricantes/", DashboardTopFabricantesView.as_view(), name="dashboard-top"),
    path("dashboard/alertas_criticos/", DashboardAlertasCriticosView.as_view(), name="dashboard-alertas"),
    path("", include(router.urls)),
]
