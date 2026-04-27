from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import UsinaViewSet, geocode_view

router = DefaultRouter()
router.register("", UsinaViewSet, basename="usina")

urlpatterns = [
    path("geocode/", geocode_view, name="usinas-geocode"),
    *router.urls,
]
