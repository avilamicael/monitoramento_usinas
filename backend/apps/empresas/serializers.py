from __future__ import annotations

from rest_framework import serializers

from .models import Empresa


class EmpresaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empresa
        fields = ("id", "nome", "slug", "cnpj", "is_active", "created_at", "updated_at")
        read_only_fields = ("id", "slug", "created_at", "updated_at")
