from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AlertaViewSet,
    ConfiguracaoRegraDetalheView,
    ConfiguracaoRegraResetView,
    ConfiguracaoRegraView,
)

router = DefaultRouter()
router.register("", AlertaViewSet, basename="alerta")

# IMPORTANTE: as rotas `configuracao-regras/*` precisam vir ANTES das URLs
# do router (que usam `<pk>` permissivo `[^/.]+`). Caso contrário o router
# trata `configuracao-regras` como um pk e nunca chega aqui. Dentro desse
# bloco, `reset-todos/` precisa vir ANTES de `<str:regra_nome>/` para não
# cair no detalhe procurando uma regra "reset-todos".
urlpatterns = [
    path(
        "configuracao-regras/",
        ConfiguracaoRegraView.as_view(),
        name="configuracao-regras-list",
    ),
    path(
        "configuracao-regras/reset-todos/",
        ConfiguracaoRegraResetView.as_view(),
        name="configuracao-regras-reset",
    ),
    path(
        "configuracao-regras/<str:regra_nome>/",
        ConfiguracaoRegraDetalheView.as_view(),
        name="configuracao-regras-detalhe",
    ),
]
urlpatterns += router.urls
