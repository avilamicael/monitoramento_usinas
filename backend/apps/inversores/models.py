from __future__ import annotations

from django.db import models

from apps.empresas.models import EscopoEmpresa


class TipoInversor(models.TextChoices):
    INVERSOR = "inversor", "Inversor"
    MICROINVERSOR = "microinversor", "Microinversor"


class TipoLigacao(models.TextChoices):
    """Tipo de ligação AC do inversor — derivado das fases-neutro reportadas
    pelo provedor. Detectado pelo adapter a cada coleta e persistido aqui
    quando o motor recebe uma classificação não-null. Preserva a última
    classificação válida mesmo quando o inversor fica offline (sem fases
    energizadas) e o adapter retorna null.
    """

    MONOFASICO = "monofasico", "Monofásica"
    BIFASICO = "bifasico", "Bifásica"
    TRIFASICO = "trifasico", "Trifásica"


class Inversor(EscopoEmpresa):
    """Equipamento individual dentro de uma usina.

    Existe apenas para usinas com `usina.expoe_dados_inversor = True`. Cada
    `Inversor` acumula `LeituraInversor` append-only. Microinversor é modelado
    como `Inversor` com `tipo = microinversor` — Hoymiles tem 1 usina → N
    microinversores, cada um com 1-4 ports no JSON `strings_mppt` da leitura.
    """

    usina = models.ForeignKey(
        "usinas.Usina",
        on_delete=models.CASCADE,
        related_name="inversores",
    )
    id_externo = models.CharField(
        max_length=128,
        help_text="ID do inversor no provedor (SN ou ID interno).",
    )
    numero_serie = models.CharField(max_length=100, blank=True, default="")
    modelo = models.CharField(max_length=100, blank=True, default="")
    tipo = models.CharField(
        max_length=20,
        choices=TipoInversor.choices,
        default=TipoInversor.INVERSOR,
    )

    potencia_nominal_kw = models.DecimalField(
        max_digits=8, decimal_places=3, null=True, blank=True,
    )
    qtd_mppts_esperados = models.PositiveIntegerField(
        null=True, blank=True,
        help_text=(
            "Quantidade de strings/ports MPPT que este inversor tem. "
            "Usado pela regra `string_mppt_zerada` para saber quantos slots "
            "esperar em `LeituraInversor.strings_mppt`."
        ),
    )
    temperatura_limite_c = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text=(
            "Limite de temperatura para regra `temperatura_alta`. "
            "Null = usa default de `ConfiguracaoEmpresa.temperatura_limite_c`."
        ),
    )
    tipo_ligacao = models.CharField(
        max_length=20,
        choices=TipoLigacao.choices,
        null=True,
        blank=True,
        help_text=(
            "Última classificação não-null vinda do adapter. Atualizado pela "
            "ingestão de coleta — preserva a classificação mesmo quando a "
            "leitura mais recente vem com tipo null (inversor offline / fim "
            "de tarde sem fases energizadas)."
        ),
    )

    is_active = models.BooleanField(default=True)
    ultima_leitura_em = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Inversor"
        verbose_name_plural = "Inversores"
        constraints = [
            models.UniqueConstraint(
                fields=("usina", "id_externo"),
                name="inversor_unique_id_externo_por_usina",
            ),
        ]
        indexes = [
            models.Index(fields=["usina", "is_active"]),
            models.Index(fields=["empresa", "ultima_leitura_em"]),
        ]

    def __str__(self) -> str:
        return f"{self.numero_serie or self.id_externo} ({self.usina.nome})"
