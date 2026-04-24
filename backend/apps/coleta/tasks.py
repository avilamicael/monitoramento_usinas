"""Tasks Celery da coleta.

`sincronizar_conta_provedor(conta_id)` é a task chamada pelo beat ou
manualmente. Responsabilidades:

1. Abre `LogColeta` e marca `iniciado_em`.
2. Decripta credenciais via Fernet, carrega cache de token se houver.
3. Instancia o adapter correspondente a `ContaProvedor.tipo`.
4. Coleta dados (`buscar_usinas` + `buscar_inversores` por usina).
5. Chama `ingerir_ciclo` dentro de transação atômica.
6. Persiste cache de token atualizado (se o adapter usa sessão).
7. Atualiza `ContaProvedor.ultima_sincronizacao_*`.
8. Fecha `LogColeta` com contadores e `finalizado_em`.
9. Dispara motor de alertas pós-coleta (em commit, não inline).
"""
from __future__ import annotations

import logging
import time

from celery import shared_task
from django.db import transaction
from django.utils import timezone as djtz

from apps.alertas.motor import avaliar_empresa_em_commit
from apps.provedores.adapters.base import (
    BaseAdapter,
    ErroAutenticacaoProvedor,
    ErroProvedor,
    ErroRateLimitProvedor,
)
from apps.provedores.adapters.registry import adapter_para
from apps.provedores.cripto import descriptografar
from apps.provedores.models import ContaProvedor, StatusSincronizacao

from .ingestao import ingerir_ciclo
from .models import LogColeta

logger = logging.getLogger(__name__)


def _instanciar_adapter(conta: ContaProvedor) -> BaseAdapter:
    """Decripta credenciais + cache de token e devolve o adapter pronto."""
    credenciais = descriptografar(conta.credenciais_enc)
    if conta.cache_token_enc:
        credenciais = {**credenciais, **descriptografar(conta.cache_token_enc)}
    classe = adapter_para(conta.tipo)
    return classe(credenciais)


@shared_task(
    bind=True,
    autoretry_for=(ErroRateLimitProvedor,),
    retry_backoff=True,
    retry_backoff_max=3600,
    max_retries=3,
)
def sincronizar_conta_provedor(self, conta_id: int) -> dict:
    """Sincroniza uma `ContaProvedor`. Retorna um dict sumarizado
    (útil quando chamado manualmente ou por chain)."""
    inicio = time.time()
    resultado = None

    try:
        conta = ContaProvedor.objects.select_related("empresa").get(pk=conta_id)
    except ContaProvedor.DoesNotExist:
        logger.warning("sincronizar_conta_provedor: conta %s não existe.", conta_id)
        return {"status": "erro", "msg": "conta não existe"}

    if not conta.is_active:
        logger.info("conta %s inativa — pulando.", conta_id)
        return {"status": "inativa"}

    log = LogColeta.objects.create(
        empresa=conta.empresa,
        conta_provedor=conta,
        status=StatusSincronizacao.SUCESSO,  # provisório; ajustado abaixo
    )
    status_final = StatusSincronizacao.SUCESSO
    detalhe_erro = ""

    try:
        adapter = _instanciar_adapter(conta)
        expoe_inv = adapter.capacidades.expoe_inversores

        usinas_dados = adapter.buscar_usinas()
        inversores_por_usina: dict[str, list] = {}
        if expoe_inv:
            for u in usinas_dados:
                try:
                    inversores_por_usina[u.id_externo] = adapter.buscar_inversores(
                        u.id_externo
                    )
                except ErroRateLimitProvedor:
                    raise  # deixa o retry do Celery tratar
                except ErroProvedor as exc:
                    logger.warning(
                        "%s: buscar_inversores falhou para usina %s — %s",
                        conta.tipo, u.id_externo, exc,
                    )
                    status_final = StatusSincronizacao.PARCIAL
                    detalhe_erro = f"inversores {u.id_externo}: {exc}"

        resultado = ingerir_ciclo(
            conta,
            usinas_dados,
            inversores_por_usina,
            expoe_dados_inversor=expoe_inv,
        )

        # Atualiza token se o adapter guardou sessão
        from apps.provedores.cripto import criptografar
        novo_cache = adapter.obter_cache_token()
        if novo_cache:
            conta.cache_token_enc = criptografar(novo_cache)

        conta.ultima_sincronizacao_em = djtz.now()
        conta.ultima_sincronizacao_status = status_final
        conta.ultima_sincronizacao_erro = detalhe_erro
        conta.precisa_atencao = False
        conta.save(
            update_fields=[
                "cache_token_enc",
                "ultima_sincronizacao_em",
                "ultima_sincronizacao_status",
                "ultima_sincronizacao_erro",
                "precisa_atencao",
                "updated_at",
            ]
        )

        # Dispara motor de alertas pós-commit (fora da transação da coleta).
        avaliar_empresa_em_commit(conta.empresa_id)

    except ErroAutenticacaoProvedor as exc:
        logger.error("%s: auth falhou — %s", conta.tipo, exc)
        status_final = StatusSincronizacao.AUTH_ERRO
        detalhe_erro = str(exc)
        ContaProvedor.objects.filter(pk=conta.pk).update(
            precisa_atencao=True,
            ultima_sincronizacao_em=djtz.now(),
            ultima_sincronizacao_status=status_final,
            ultima_sincronizacao_erro=detalhe_erro,
        )
    except ErroRateLimitProvedor:
        status_final = StatusSincronizacao.PARCIAL
        detalhe_erro = "rate limit — retry agendado"
        raise
    except ErroProvedor as exc:
        logger.exception("%s: erro inesperado", conta.tipo)
        status_final = StatusSincronizacao.ERRO
        detalhe_erro = str(exc)
    except Exception as exc:  # noqa: BLE001 — quer capturar qualquer coisa
        logger.exception("coleta: erro não-provedor")
        status_final = StatusSincronizacao.ERRO
        detalhe_erro = f"{type(exc).__name__}: {exc}"
    finally:
        duracao_ms = int((time.time() - inicio) * 1000)
        resultado_dict = {
            "usinas": resultado.usinas_vistas if resultado else 0,
            "inversores": resultado.inversores_vistos if resultado else 0,
            "leituras_usina": resultado.leituras_usina_criadas if resultado else 0,
            "leituras_inversor": resultado.leituras_inversor_criadas if resultado else 0,
        }
        LogColeta.objects.filter(pk=log.pk).update(
            status=status_final,
            duracao_ms=duracao_ms,
            detalhe_erro=detalhe_erro,
            finalizado_em=djtz.now(),
            qtd_usinas=resultado_dict["usinas"],
            qtd_inversores=resultado_dict["inversores"],
            qtd_leituras_usina=resultado_dict["leituras_usina"],
            qtd_leituras_inversor=resultado_dict["leituras_inversor"],
        )

    return {
        "conta_id": conta_id,
        "status": status_final,
        "duracao_ms": duracao_ms,
        **resultado_dict,
    }


@shared_task
def limpar_leituras_expiradas() -> dict:
    """Task diária que apaga `LeituraUsina` e `LeituraInversor` mais velhas
    que `ConfiguracaoEmpresa.retencao_leituras_dias` de cada empresa.

    Alertas não são afetados.
    """
    from datetime import timedelta

    from apps.core.models import ConfiguracaoEmpresa
    from apps.monitoramento.models import LeituraInversor, LeituraUsina

    removidas_usina = 0
    removidas_inversor = 0
    now = djtz.now()

    for config in ConfiguracaoEmpresa.objects.select_related("empresa"):
        limite = now - timedelta(days=config.retencao_leituras_dias)
        ru, _ = LeituraUsina.objects.filter(
            empresa=config.empresa, coletado_em__lt=limite
        ).delete()
        ri, _ = LeituraInversor.objects.filter(
            empresa=config.empresa, coletado_em__lt=limite
        ).delete()
        removidas_usina += ru
        removidas_inversor += ri

    logger.info(
        "limpar_leituras: removidas_usina=%d removidas_inversor=%d",
        removidas_usina, removidas_inversor,
    )
    return {
        "removidas_usina": removidas_usina,
        "removidas_inversor": removidas_inversor,
    }
