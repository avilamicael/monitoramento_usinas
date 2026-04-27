from django.urls import path

from .dashboard import (
    DashboardAlertasCriticosView,
    DashboardGeracaoDiariaView,
    DashboardKpisView,
    DashboardTopFabricantesView,
)
from .views import ConfiguracaoEmpresaView, HealthView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("dashboard/kpis/", DashboardKpisView.as_view(), name="dashboard-kpis"),
    path("dashboard/geracao_diaria/", DashboardGeracaoDiariaView.as_view(), name="dashboard-geracao"),
    path("dashboard/top_fabricantes/", DashboardTopFabricantesView.as_view(), name="dashboard-top"),
    path("dashboard/alertas_criticos/", DashboardAlertasCriticosView.as_view(), name="dashboard-alertas"),
    path("configuracoes/", ConfiguracaoEmpresaView.as_view(), name="configuracoes"),
]
