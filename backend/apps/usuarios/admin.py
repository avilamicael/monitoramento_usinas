from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(DjangoUserAdmin):
    list_display = ("username", "email", "empresa", "papel", "is_active")
    list_filter = ("papel", "empresa", "is_active")
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Empresa & papel", {"fields": ("empresa", "papel", "telefone")}),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        ("Empresa & papel", {"fields": ("empresa", "papel", "telefone")}),
    )
