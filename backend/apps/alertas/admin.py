from django.contrib import admin

from .models import ConfiguracaoRegra


@admin.register(ConfiguracaoRegra)
class ConfiguracaoRegraAdmin(admin.ModelAdmin):
    list_display = ("empresa", "regra_nome", "ativa", "severidade", "updated_at")
    list_filter = ("empresa", "ativa", "severidade")
    search_fields = ("regra_nome",)
