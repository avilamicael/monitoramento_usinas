from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import PapelUsuario, Usuario


class UsuarioSerializer(serializers.ModelSerializer):
    """Serializer principal — usado em /me/ e listagem por admin."""

    empresa_nome = serializers.CharField(source="empresa.nome", read_only=True)

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
            "is_active",
            "date_joined",
            "last_login",
        )
        read_only_fields = ("id", "empresa", "empresa_nome", "date_joined", "last_login")


class UsuarioCreateSerializer(serializers.ModelSerializer):
    """Criação por admin: aceita senha em texto puro (write-only)."""

    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )
    first_name = serializers.CharField(required=True, allow_blank=False)

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
            "password",
            "is_active",
        )
        read_only_fields = ("id",)

    def create(self, validated_data):
        from apps.core.api import empresa_do_request

        password = validated_data.pop("password")
        usuario = Usuario(**validated_data)
        usuario.set_password(password)
        usuario.empresa = empresa_do_request(self.context["request"])
        usuario.save()
        return usuario


class UsuarioUpdateSerializer(serializers.ModelSerializer):
    """Atualização: senha opcional, demais campos editáveis pelo admin."""

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
            "username",
            "email",
            "first_name",
            "last_name",
            "telefone",
            "papel",
            "password",
            "is_active",
        )

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class TrocarSenhaSerializer(serializers.Serializer):
    """Endpoint /me/trocar_senha/ — usuário troca a própria senha."""

    senha_atual = serializers.CharField(write_only=True, style={"input_type": "password"})
    nova_senha = serializers.CharField(
        write_only=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )

    def validate_senha_atual(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Senha atual incorreta.")
        return value
