from __future__ import annotations

from django.db import models

from apps.empresas.models import EscopoEmpresa


class TipoEquipamento(models.TextChoices):
    INVERSOR = "inversor", "Inversor"
    MICROINVERSOR = "microinversor", "Microinversor"
    INDEFINIDO = "indefinido", "Indefinido"


class Usina(EscopoEmpresa):
    """Usina solar cadastrada por uma empresa.

    `conta_provedor` + `id_externo` identificam a usina no sistema do
    provedor. `id_externo` pode ficar vazio até o primeiro sync descobrir
    as usinas disponíveis na conta.

    `expoe_dados_inversor` determina se o worker deve também criar
    `Inversor` + `LeituraInversor` a cada coleta, ou apenas `LeituraUsina`.
    Hoymiles e provedores que só retornam agregado na usina ficam com
    `False`; a coleta ainda vale mas só popula dados de usina.
    """

    conta_provedor = models.ForeignKey(
        "provedores.ContaProvedor",
        on_delete=models.PROTECT,
        related_name="usinas",
    )
    id_externo = models.CharField(max_length=128, blank=True, default="")

    nome = models.CharField(max_length=200)
    endereco = models.CharField(max_length=500, blank=True, default="")
    cidade = models.CharField(max_length=120, blank=True, default="")
    estado = models.CharField(max_length=2, blank=True, default="")
    cep = models.CharField(max_length=10, blank=True, default="")
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True,
        help_text="Preenchido manualmente ou via geocoding (fora do MVP).",
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True,
    )
    fuso_horario = models.CharField(
        max_length=50, blank=True, default="America/Sao_Paulo",
    )

    capacidade_kwp = models.DecimalField(
        max_digits=10, decimal_places=3, null=True, blank=True,
        help_text="Valor do provedor. Validar > 0; FusionSolar às vezes devolve 0.008 (bug).",
    )
    comissionada_em = models.DateField(null=True, blank=True)

    tipo_equipamento = models.CharField(
        max_length=20,
        choices=TipoEquipamento.choices,
        default=TipoEquipamento.INDEFINIDO,
        help_text="Preenchido pelo adapter ou pelo usuário.",
    )
    expoe_dados_inversor = models.BooleanField(
        default=False,
        help_text=(
            "Se True, o worker coleta também dados por inversor (tabelas "
            "`Inversor` e `LeituraInversor`). Valor derivado de "
            "`CapacidadesProvedor` no adapter na primeira coleta."
        ),
    )

    # Limite de sobretensão AC usado pela regra `sobretensao_ac`.
    # Varia por região da rede — default 240 V funciona pro Brasil mas pode
    # ser ajustado por usina via interface de admin.
    tensao_ac_limite_v = models.DecimalField(
        max_digits=5, decimal_places=1, default=240,
    )

    is_active = models.BooleanField(default=True)
    ultima_leitura_em = models.DateTimeField(
        null=True, blank=True,
        help_text="Cache denormalizado de `LeituraUsina.medido_em` mais recente.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Usina"
        verbose_name_plural = "Usinas"
        indexes = [
            models.Index(fields=["empresa", "is_active"]),
            models.Index(fields=["conta_provedor", "id_externo"]),
            models.Index(fields=["empresa", "ultima_leitura_em"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=("conta_provedor", "id_externo"),
                condition=~models.Q(id_externo=""),
                name="usina_unique_id_externo_por_conta",
            ),
        ]

    def __str__(self) -> str:
        return self.nome
