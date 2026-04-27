from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/", include("apps.core.urls")),
    path("api/empresas/", include("apps.empresas.urls")),
    path("api/usuarios/", include("apps.usuarios.urls")),
    path("api/usinas/", include("apps.usinas.urls")),
    path("api/inversores/", include("apps.inversores.urls")),
    path("api/provedores/", include("apps.provedores.urls")),
    path("api/monitoramento/", include("apps.monitoramento.urls")),
    path("api/alertas/", include("apps.alertas.urls")),
    path("api/notificacoes/", include("apps.notificacoes.urls")),
    path("api/garantia/", include("apps.garantia.urls")),
    path("api/coleta/", include("apps.coleta.urls")),
    path("api/superadmin/", include("apps.superadmin.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/schema/swagger/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger"),
    path("api/schema/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

if settings.DEBUG:
    import debug_toolbar

    urlpatterns += [path("__debug__/", include(debug_toolbar.urls))]
