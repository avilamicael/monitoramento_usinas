from __future__ import annotations

from django.core.exceptions import ValidationError
from django.db import models

from apps.empresas.models import EscopoEmpresa


class SeveridadeAlerta(models.TextChoices):
    INFO = "info", "Informativo"
    AVISO = "aviso", "Aviso"
    CRITICO = "critico", "Crítico"


class EstadoAlerta(models.TextChoices):
    ABERTO = "aberto", "Aberto"
    RECONHECIDO = "reconhecido", "Reconhecido"
    RESOLVIDO = "resolvido", "Resolvido"


class Alerta(EscopoEmpresa):
    """Evento anômalo detectado pelo motor de alertas interno.

    Ciclo de vida sem histerese:
    - Condição verdadeira + nenhum alerta aberto → cria novo com `aberto_em=agora`.
    - Condição verdadeira + alerta já aberto → atualiza `mensagem`/`contexto`,
      preserva `aberto_em` original e incrementa `atualizado_em`.
    - Condição falsa + alerta aberto → move para `estado=resolvido`, seta
      `resolvido_em=agora`.
    - Condição falsa + nenhum alerta aberto → nada.

    Se condição reabrir depois, é criado um novo `Alerta` (novo `aberto_em`).
    Alertas resolvidos ficam preservados para histórico.

    Invariante: no máximo UM alerta aberto por `(usina, inversor, regra)`.
    Garantido pela `UniqueConstraint` parcial abaixo.
    """

    usina = models.ForeignKey(
        "usinas.Usina", on_delete=models.CASCADE, related_name="alertas",
    )
    inversor = models.ForeignKey(
        "inversores.Inversor",
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name="alertas",
        help_text=(
            "Preenchido quando a regra é por equipamento (ex.: "
            "inversor_offline, sobretensao_ac). Null para regras de usina "
            "(ex.: sem_geracao_horario_solar, sem_comunicacao)."
        ),
    )
    regra = models.CharField(
        max_length=60,
        help_text=(
            "Identificador da regra. Ex.: `sem_comunicacao`, `sobretensao_ac`, "
            "`sem_geracao_horario_solar`. Casa com o módulo em `alertas/regras/`."
        ),
    )

    severidade = models.CharField(max_length=20, choices=SeveridadeAlerta.choices)
    estado = models.CharField(
        max_length=20, choices=EstadoAlerta.choices, default=EstadoAlerta.ABERTO,
    )

    mensagem = models.TextField(
        help_text="Texto legível. Ex.: 'Tensão AC 251.3 V acima do limite (240 V).'",
    )
    contexto = models.JSONField(
        default=dict, blank=True,
        help_text=(
            "Snapshot dos valores que dispararam/atualizaram o alerta. Ex.: "
            '{"tensao_ac_v": 251.3, "limite": 240, "leitura_id": "..."}.'
        ),
    )

    aberto_em = models.DateTimeField(auto_now_add=True)
    resolvido_em = models.DateTimeField(null=True, blank=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Alerta"
        verbose_name_plural = "Alertas"
        indexes = [
            models.Index(fields=["empresa", "estado", "-aberto_em"]),
            models.Index(fields=["usina", "estado"]),
            models.Index(fields=["regra", "estado"]),
        ]
        constraints = [
            # Invariante principal: 1 alerta aberto por (usina, inversor, regra).
            # `inversor` pode ser null (regra de usina) — índice parcial cobre.
            models.UniqueConstraint(
                fields=("usina", "inversor", "regra"),
                condition=models.Q(estado="aberto"),
                name="alerta_unico_aberto_por_regra",
            ),
        ]
        ordering = ("-aberto_em",)

    def __str__(self) -> str:
        return f"{self.regra} [{self.severidade}] {self.usina.nome}"


class ConfiguracaoRegra(models.Model):
    """Override por empresa de defaults declarados em
    `apps/alertas/regras/<nome>.py`.

    Quando não há linha para uma regra/empresa, o motor usa os defaults
    da própria classe da regra (`severidade_padrao`, sempre ativa). Cada
    linha representa uma personalização explícita feita pelo admin da
    empresa: desativar a regra ou trocar a severidade padrão.

    Não herda `EscopoEmpresa` porque a tabela já tem o FK `empresa`
    explícito; o uso é sempre `ConfiguracaoRegra.objects.filter(empresa=...)`.
    """

    empresa = models.ForeignKey(
        "empresas.Empresa",
        on_delete=models.CASCADE,
        related_name="configuracoes_regra",
    )
    regra_nome = models.CharField(
        max_length=64,
        db_index=True,
        help_text=(
            "Identificador da regra. Casa com `cls.nome` em "
            "`apps/alertas/regras/<nome>.py`."
        ),
    )
    ativa = models.BooleanField(
        default=True,
        help_text="Quando False, o motor pula essa regra para a empresa.",
    )
    severidade = models.CharField(
        max_length=20,
        choices=SeveridadeAlerta.choices,
        help_text=(
            "Sobrescreve `severidade_padrao` da regra. Ignorado para regras "
            "com severidade dinâmica (ex.: `sem_comunicacao`, `garantia_vencendo`)."
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuração de regra"
        verbose_name_plural = "Configurações de regras"
        constraints = [
            models.UniqueConstraint(
                fields=("empresa", "regra_nome"),
                name="configuracaoregra_unica_por_empresa_regra",
            ),
        ]
        indexes = [
            models.Index(fields=("empresa", "regra_nome")),
        ]

    def __str__(self) -> str:
        estado = "ativa" if self.ativa else "inativa"
        return f"{self.regra_nome} [{self.severidade}/{estado}] {self.empresa_id}"

    def clean(self) -> None:
        """Valida que `regra_nome` corresponde a uma regra registrada.

        Import lazy para evitar ciclo: `apps.alertas.regras.base` importa
        `SeveridadeAlerta` deste módulo.
        """
        super().clean()
        from apps.alertas.regras import regras_registradas

        nomes_validos = {cls.nome for cls in regras_registradas()}
        if self.regra_nome not in nomes_validos:
            raise ValidationError(
                {
                    "regra_nome": (
                        f"Regra '{self.regra_nome}' não está registrada. "
                        f"Regras válidas: {sorted(nomes_validos)}."
                    ),
                },
            )
