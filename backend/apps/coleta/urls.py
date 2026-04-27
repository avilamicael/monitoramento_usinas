from rest_framework.routers import DefaultRouter

from .views import LogColetaViewSet

router = DefaultRouter()
router.register("logs", LogColetaViewSet, basename="log_coleta")

urlpatterns = router.urls
