from __future__ import annotations

from django.db import models

from apps.empresas.models import EscopoEmpresa


class StatusLeitura(models.TextChoices):
    """Status normalizado — cada adapter traduz o valor nativo do provedor
    para um destes."""

    ONLINE = "online", "Online"
    OFFLINE = "offline", "Offline"
    ALERTA = "alerta", "Alerta"
    CONSTRUCAO = "construcao", "Em construção"


class TipoLigacao(models.TextChoices):
    """Tipo de ligação AC do inversor.

    - `monofasico`: apenas uma fase ativa (fase-neutro), tensão útil 127/220V.
    - `bifasico`: rede 220V brasileira entre 2 fases vivas (sem neutro útil);
      tensão útil é a de linha (`ab_u` ≈ 220V).
    - `trifasico`: três fases ativas, tensão útil fase-neutro (380/220Y).
    """

    MONOFASICO = "monofasico", "Monofásico"
    BIFASICO = "bifasico", "Bifásico"
    TRIFASICO = "trifasico", "Trifásico"


class LeituraUsina(EscopoEmpresa):
    """Snapshot agregado de uma usina num instante. Append-only — nunca
    atualizado depois de criado.

    Idempotência: `UniqueConstraint(usina, coletado_em)`. O worker arredonda
    `coletado_em` para a janela da coleta (ex.: múltiplo de N minutos) para
    que duas execuções no mesmo ciclo não criem leituras duplicadas.
    """

    usina = models.ForeignKey(
        "usinas.Usina", on_delete=models.CASCADE, related_name="leituras"
    )

    coletado_em = models.DateTimeField(
        help_text="Timestamp da nossa coleta, arredondado para a janela de ingestão.",
    )
    medido_em = models.DateTimeField(
        null=True, blank=True,
        help_text=(
            "Timestamp reportado pelo provedor quando disponível. Pode ser "
            "null (FusionSolar, Foxess). Preferido para análise temporal real."
        ),
    )

    potencia_kw = models.DecimalField(
        max_digits=12, decimal_places=3, default=0,
    )
    energia_hoje_kwh = models.DecimalField(
        max_digits=12, decimal_places=3, default=0,
    )
    energia_mes_kwh = models.DecimalField(
        max_digits=12, decimal_places=3, null=True, blank=True,
        help_text="Foxess não expõe — fica null.",
    )
    energia_total_kwh = models.DecimalField(
        max_digits=14, decimal_places=3, default=0,
    )

    status = models.CharField(
        max_length=20,
        choices=StatusLeitura.choices,
        default=StatusLeitura.ONLINE,
    )
    qtd_inversores_total = models.PositiveIntegerField(null=True, blank=True)
    qtd_inversores_online = models.PositiveIntegerField(null=True, blank=True)

    raw = models.JSONField(
        default=dict, blank=True,
        help_text="Payload bruto do provedor, preservado para auditoria e debug.",
    )

    class Meta:
        verbose_name = "Leitura de usina"
        verbose_name_plural = "Leituras de usina"
        indexes = [
            models.Index(fields=["usina", "-coletado_em"]),
            models.Index(fields=["empresa", "-coletado_em"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=("usina", "coletado_em"),
                name="leitura_usina_unica_por_janela",
            ),
        ]
        ordering = ("-coletado_em",)


class LeituraInversor(EscopoEmpresa):
    """Snapshot de um inversor num instante. Append-only.

    Só é criada para inversores de usinas com `expoe_dados_inversor=True`.
    Campos elétricos são todos nullable — o worker NÃO preenche com 0 quando
    o provedor não expõe. Isso é crucial pras regras de alerta: `null` não
    equivale a "ok", equivale a "não avaliar" — evita falso positivo e falso
    negativo em provedores com dados parciais (Hoymiles sem freq/Iac/temp).
    """

    usina = models.ForeignKey(
        "usinas.Usina", on_delete=models.CASCADE, related_name="leituras_inversores",
    )
    inversor = models.ForeignKey(
        "inversores.Inversor", on_delete=models.CASCADE, related_name="leituras",
    )

    coletado_em = models.DateTimeField()
    medido_em = models.DateTimeField(null=True, blank=True)

    estado = models.CharField(
        max_length=20,
        choices=StatusLeitura.choices,
        default=StatusLeitura.ONLINE,
    )
    pac_kw = models.DecimalField(
        max_digits=10, decimal_places=3, default=0,
        help_text="Potência CA instantânea. 0 é válido (noite, standby).",
    )
    energia_hoje_kwh = models.DecimalField(
        max_digits=12, decimal_places=3, default=0,
    )
    energia_total_kwh = models.DecimalField(
        max_digits=14, decimal_places=3, default=0,
    )

    # ── Elétricos (null quando provedor não expõe) ────────────────────────
    tensao_ac_v = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
    )
    corrente_ac_a = models.DecimalField(
        max_digits=8, decimal_places=3, null=True, blank=True,
    )
    frequencia_hz = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
    )
    tensao_dc_v = models.DecimalField(
        max_digits=7, decimal_places=2, null=True, blank=True,
    )
    corrente_dc_a = models.DecimalField(
        max_digits=8, decimal_places=3, null=True, blank=True,
    )
    temperatura_c = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
    )
    soc_bateria_pct = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="% de carga da bateria; só para inversores híbridos (Solis).",
    )

    tipo_ligacao = models.CharField(  # noqa: DJ001
        max_length=20,
        choices=TipoLigacao.choices,
        null=True, blank=True,
        help_text=(
            "Tipo de ligação AC inferido pelo adapter (monofasico, bifasico, "
            "trifasico). Null quando o adapter não consegue classificar."
        ),
    )
    eletrica_ac = models.JSONField(
        null=True, blank=True, default=None,
        help_text=(
            "Detalhe elétrico AC por fase. Schema (todas as chaves opcionais): "
            '{"fases_neutro": {"a": V, "b": V, "c": V}, '
            '"linhas": {"ab": V, "bc": V, "ca": V}, '
            '"correntes": {"a": A, "b": A, "c": A}, '
            '"fator_potencia": float, "potencia_reativa_kvar": float}.'
        ),
    )

    strings_mppt = models.JSONField(
        default=list, blank=True,
        help_text=(
            "Lista normalizada: "
            '[{"indice": 1, "tensao_v": 39.0, "corrente_a": 6.73, "potencia_w": 262.9}, ...]. '
            "Slots zerados (Solis preenche 32 mesmo com só 2 ativos) podem ser "
            "omitidos pelo adapter para economizar espaço."
        ),
    )

    raw = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "Leitura de inversor"
        verbose_name_plural = "Leituras de inversor"
        indexes = [
            models.Index(fields=["inversor", "-coletado_em"]),
            models.Index(fields=["empresa", "-coletado_em"]),
            models.Index(fields=["usina", "-coletado_em"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=("inversor", "coletado_em"),
                name="leitura_inversor_unica_por_janela",
            ),
        ]
        ordering = ("-coletado_em",)
