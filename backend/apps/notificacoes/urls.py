from rest_framework.routers import DefaultRouter

from .views import EndpointWebhookViewSet, EntregaNotificacaoViewSet, RegraNotificacaoViewSet

router = DefaultRouter()
router.register("regras", RegraNotificacaoViewSet, basename="regra_notificacao")
router.register("entregas", EntregaNotificacaoViewSet, basename="entrega_notificacao")
router.register("webhooks", EndpointWebhookViewSet, basename="endpoint_webhook")

urlpatterns = router.urls
