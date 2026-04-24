from __future__ import annotations

from django.db import models

from apps.empresas.models import EscopoEmpresa


class TipoProvedor(models.TextChoices):
    """Provedores suportados. Cada valor precisa ter um adapter em
    `apps.provedores.adapters.<tipo>` registrado via `@registrar`."""

    SOLIS = "solis", "Solis (Ginlong)"
    HOYMILES = "hoymiles", "Hoymiles S-Cloud"
    FUSIONSOLAR = "fusionsolar", "Huawei FusionSolar"
    SOLARMAN = "solarman", "Solarman Business"
    AUXSOL = "auxsol", "AuxSol Cloud"
    FOXESS = "foxess", "FoxESS Cloud"


class StatusSincronizacao(models.TextChoices):
    SUCESSO = "sucesso", "Sucesso"
    PARCIAL = "parcial", "Parcial"
    ERRO = "erro", "Erro"
    AUTH_ERRO = "auth_erro", "Erro de autenticação"


class ContaProvedor(EscopoEmpresa):
    """Credenciais da empresa para um provedor específico.

    Uma empresa pode ter mais de uma conta no mesmo provedor (ex.: múltiplos
    logins Fusion). Cada usina é vinculada a uma `ContaProvedor` para saber
    qual credencial usar na coleta.

    Campos `credenciais_enc` e `cache_token_enc` guardam JSONs criptografados
    com Fernet (ver `apps.provedores.cripto`). Nunca gravar ou ler credenciais
    em texto plano diretamente por este model.
    """

    tipo = models.CharField(max_length=32, choices=TipoProvedor.choices)
    rotulo = models.CharField(
        max_length=120, help_text="Nome amigável para identificar a conta."
    )

    credenciais_enc = models.TextField(
        help_text=(
            "JSON criptografado com Fernet. Shape depende do provedor: "
            '{"api_key", "app_secret"} (Solis), {"username", "password"} '
            "(Hoymiles/FusionSolar), etc. Usar `cripto.criptografar_credenciais`."
        ),
    )
    cache_token_enc = models.TextField(
        blank=True,
        default="",
        help_text=(
            "Token de sessão criptografado (Hoymiles, FusionSolar). "
            "Vazio quando o provedor é stateless (Solis HMAC-SHA1)."
        ),
    )
    cache_token_expira_em = models.DateTimeField(null=True, blank=True)

    intervalo_coleta_minutos = models.PositiveIntegerField(
        default=30,
        help_text=(
            "Intervalo entre coletas em minutos. Configurável pelo usuário, "
            "mas validador rejeita valores abaixo do mínimo declarado por "
            "`CapacidadesProvedor.intervalo_minimo_minutos` no adapter."
        ),
    )

    is_active = models.BooleanField(default=True)
    precisa_atencao = models.BooleanField(
        default=False,
        help_text="Marcado quando autenticação falha — exige intervenção manual.",
    )
    ultima_sincronizacao_em = models.DateTimeField(null=True, blank=True)
    ultima_sincronizacao_status = models.CharField(
        max_length=20,
        choices=StatusSincronizacao.choices,
        blank=True,
        default="",
    )
    ultima_sincronizacao_erro = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Conta de provedor"
        verbose_name_plural = "Contas de provedor"
        constraints = [
            models.UniqueConstraint(
                fields=("empresa", "tipo", "rotulo"),
                name="conta_provedor_unica_por_empresa",
            ),
        ]
        indexes = [
            models.Index(fields=["empresa", "tipo", "is_active"]),
            models.Index(fields=["is_active", "ultima_sincronizacao_em"]),
        ]

    def __str__(self) -> str:
        return f"{self.get_tipo_display()} — {self.rotulo}"
