from rest_framework.routers import DefaultRouter

from .views import ContaProvedorViewSet

router = DefaultRouter()
router.register("", ContaProvedorViewSet, basename="conta_provedor")

urlpatterns = router.urls
