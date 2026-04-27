from rest_framework.routers import DefaultRouter

from .views import LeituraInversorViewSet, LeituraUsinaViewSet

router = DefaultRouter()
router.register("leituras_usina", LeituraUsinaViewSet, basename="leitura_usina")
router.register("leituras_inversor", LeituraInversorViewSet, basename="leitura_inversor")

urlpatterns = router.urls
