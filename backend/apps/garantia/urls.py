from rest_framework.routers import DefaultRouter

from .views import GarantiaViewSet

router = DefaultRouter()
router.register("", GarantiaViewSet, basename="garantia")

urlpatterns = router.urls
