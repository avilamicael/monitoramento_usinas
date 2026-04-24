from __future__ import annotations

from django.db import models

from apps.empresas.models import EscopoEmpresa
from apps.provedores.models import StatusSincronizacao


class LogColeta(EscopoEmpresa):
    """Auditoria de cada ciclo de coleta por `ContaProvedor`.

    Registrado pela task Celery no fim de cada execução. Permite responder:
    - Qual foi a última coleta bem-sucedida desta conta?
    - Quanto demorou?
    - Houve erros silenciosos (parcial)?
    """

    conta_provedor = models.ForeignKey(
        "provedores.ContaProvedor",
        on_delete=models.CASCADE,
        related_name="logs_coleta",
    )
    status = models.CharField(
        max_length=20,
        choices=StatusSincronizacao.choices,
    )

    qtd_usinas = models.PositiveIntegerField(default=0)
    qtd_inversores = models.PositiveIntegerField(default=0)
    qtd_leituras_usina = models.PositiveIntegerField(default=0)
    qtd_leituras_inversor = models.PositiveIntegerField(default=0)
    qtd_alertas_abertos = models.PositiveIntegerField(default=0)
    qtd_alertas_resolvidos = models.PositiveIntegerField(default=0)

    detalhe_erro = models.TextField(blank=True, default="")
    duracao_ms = models.PositiveIntegerField(default=0)

    iniciado_em = models.DateTimeField(auto_now_add=True)
    finalizado_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Log de coleta"
        verbose_name_plural = "Logs de coleta"
        indexes = [
            models.Index(fields=["conta_provedor", "-iniciado_em"]),
            models.Index(fields=["empresa", "status", "-iniciado_em"]),
        ]
        ordering = ("-iniciado_em",)

    def __str__(self) -> str:
        return f"{self.conta_provedor} — {self.status} @ {self.iniciado_em:%d/%m %H:%M}"
