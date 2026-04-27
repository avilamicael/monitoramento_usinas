from rest_framework.routers import DefaultRouter

from .views import UsinaViewSet

router = DefaultRouter()
router.register("", UsinaViewSet, basename="usina")

urlpatterns = router.urls
