"""Serializers para o painel superadmin (cross-tenant).

Diferentes dos serializers comuns:
- `EmpresaSerializerSuperadmin` aceita criar empresas com slug e métricas
  agregadas (usuarios/usinas count) na listagem.
- `UsuarioSerializerSuperadmin` aceita escolher `empresa` por id e `papel`
  livremente (incluindo `superadmin`). Trata `password` com `set_password`.
"""
from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from django.utils.text import slugify
from rest_framework import serializers

from apps.empresas.models import Empresa
from apps.usuarios.models import PapelUsuario, Usuario


class EmpresaSerializerSuperadmin(serializers.ModelSerializer):
    """Lista/cria/edita Empresa com métricas agregadas (read-only)."""

    qtd_usuarios = serializers.IntegerField(read_only=True)
    qtd_usinas = serializers.IntegerField(read_only=True)
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = Empresa
        fields = (
            "id",
            "nome",
            "slug",
            "cnpj",
            "cidade",
            "uf",
            "is_active",
            "qtd_usuarios",
            "qtd_usinas",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "qtd_usuarios", "qtd_usinas", "created_at", "updated_at")

    def validate_uf(self, value: str) -> str:
        return (value or "").upper()

    def validate(self, attrs):
        # Auto-gera slug a partir do nome se não fornecido (ou veio em branco).
        slug = (attrs.get("slug") or "").strip()
        if not slug:
            base = slugify(attrs.get("nome") or (self.instance.nome if self.instance else ""))
            if not base:
                raise serializers.ValidationError({"nome": "Nome é obrigatório."})
            slug = base
            i = 2
            qs = Empresa.objects.filter(slug=slug)
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            while qs.exists():
                slug = f"{base}-{i}"
                i += 1
                qs = Empresa.objects.filter(slug=slug)
                if self.instance is not None:
                    qs = qs.exclude(pk=self.instance.pk)
            attrs["slug"] = slug
        return attrs


class UsuarioSerializerSuperadmin(serializers.ModelSerializer):
    """Cria/edita Usuario com `empresa` e `papel` livres (write).

    Lê-se com `empresa_nome` agregado pra UI.
    """

    empresa = serializers.PrimaryKeyRelatedField(
        queryset=Empresa.objects.all(),
        allow_null=True,
        required=False,
    )
    empresa_nome = serializers.CharField(source="empresa.nome", read_only=True)
    papel = serializers.ChoiceField(choices=PapelUsuario.choices)
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=False,
        validators=[validate_password],
        style={"input_type": "password"},
    )

    class Meta:
        model = Usuario
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "telefone",
            "papel",
            "empresa",
            "empresa_nome",
            "password",
            "is_active",
            "date_joined",
            "last_login",
        )
        read_only_fields = ("id", "empresa_nome", "date_joined", "last_login")

    def validate(self, attrs):
        # Na criação, password é obrigatório.
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({"password": "Senha é obrigatória na criação."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        empresa = validated_data.pop("empresa", None)
        usuario = Usuario(**validated_data)
        usuario.empresa = empresa
        usuario.set_password(password)
        usuario.save()
        return usuario

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if password:
            instance.set_password(password)
        instance.save()
        return instance
