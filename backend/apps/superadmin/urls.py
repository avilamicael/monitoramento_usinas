from rest_framework.routers import DefaultRouter

from .views import EmpresaSuperadminViewSet, UsuarioSuperadminViewSet

router = DefaultRouter()
router.register("empresas", EmpresaSuperadminViewSet, basename="superadmin-empresa")
router.register("usuarios", UsuarioSuperadminViewSet, basename="superadmin-usuario")

urlpatterns = router.urls
