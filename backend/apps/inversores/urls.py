from rest_framework.routers import DefaultRouter

from .views import InversorViewSet

router = DefaultRouter()
router.register("", InversorViewSet, basename="inversor")

urlpatterns = router.urls
