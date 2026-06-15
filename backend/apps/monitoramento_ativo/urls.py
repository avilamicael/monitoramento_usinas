from rest_framework.routers import DefaultRouter

from .views import MonitoramentoAtivoViewSet

router = DefaultRouter()
router.register("", MonitoramentoAtivoViewSet, basename="monitoramento-ativo")

urlpatterns = router.urls
