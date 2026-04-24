from django.contrib import admin

from .models import Empresa


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ("nome", "slug", "is_active", "created_at")
    search_fields = ("nome", "slug", "cnpj")
    list_filter = ("is_active",)
