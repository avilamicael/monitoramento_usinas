---
title: Tasks de sincronização perdidas no startup do worker quando há muitas vencidas simultâneas
descoberto_em: 2026-05-09
severidade: importante
status: aberto
tags: [bug, coleta, celery, scheduler, robustez, boot]
---

# Tasks de coleta podem ser perdidas no boot do worker

## Sintoma

Após restart do stack (deploy, migração, recover de OOM, reboot da VPS), parte das tarefas `apps.coleta.tasks.sincronizar_conta_provedor` fica sem rodar — a coleta volta a funcionar só na próxima janela natural do `intervalo_coleta_minutos` (até 1h depois para os intervalos default).

Reproduzido durante a migração AWS → HostGator em 2026-05-09: dos 6 provedores, 3 (auxsol, fusionsolar, solis) ficaram sem rodar até serem enfileirados manualmente. Os outros 3 (foxess, hoymiles, solarman) rodaram com sucesso no boot.

Não há erro nos adapters — todos funcionam quando enfileirados manualmente via `task.delay()` ou executados síncrono no shell.

## Cenário

1. Stack restartado.
2. Beat (`django_celery_beat.schedulers.DatabaseScheduler`) lê os `PeriodicTask` da tabela e encontra **N tasks vencidas** (todas com `last_run_at` muito anterior ao `every`, normalmente porque o stack ficou parado por horas).
3. Beat enfileira as N na fila Redis quase simultaneamente.
4. Worker ainda está finalizando boot (`mingle: searching for neighbors`, conexão Redis, prefork de processos com `--concurrency=2`).
5. Algumas mensagens são consumidas e processadas; outras se perdem nesse intervalo curto entre o despacho da beat e a prontidão completa do worker.
6. Como a `last_run_at` foi atualizada pela beat **no momento do despacho** (e não da execução), o próximo cálculo de "vencimento" considera que aquela task já rodou — não há retry automático.

A partir desse ponto, a próxima execução natural só acontece após `intervalo_coleta_minutos`, criando um gap de até 60 min para coletas de provedores com intervalo de 1h e até 30 min para o foxess.

## Hipótese de causa raiz

Race entre `DatabaseScheduler.apply_async()` e o readiness do worker. Sem ack manual e sem `task_acks_late=True`, mensagens despachadas durante o startup podem ser ack’d antes da tarefa rodar de fato (especialmente com `--concurrency=2` + 6 mensagens chegando em rajada).

Não foi reproduzido em runtime estável — só no boot.

## Próximos passos (quando for fixar)

Em ordem de simplicidade vs robustez:

1. **`task_acks_late = True` + `worker_prefetch_multiplier = 1`** em `config/celery.py`. Mensagens só são ack’d depois de execução com sucesso; reentregas funcionam quando o worker morre antes de terminar. Custo zero, mas não cobre o caso onde o ack-late falha por outros motivos.

2. **Lock distribuído por conta no Redis (`SET NX EX`)** no início de `sincronizar_conta_provedor`. Se já estiver rodando ou recém-rodada, retorna no-op. Garante idempotência e permite enfileirar a mesma task várias vezes sem efeito colateral. Custo: 1 chamada Redis por execução.

3. **Job de "self-healing" no beat**: além das `PeriodicTask` por conta, um job a cada 5 min que varre `ContaProvedor.is_active=True` cuja `ultima_sincronizacao_em` é mais antiga que `intervalo_coleta_minutos * 1.5` e enfileira retry. Cobre não só esse cenário mas também provedor que voltou após manutenção. Custo: query leve a cada 5 min.

4. **Reset da `last_run_at` no startup do beat** (forçar reavaliação). Mais agressivo, dispara muitas tasks de uma vez no boot — pode amplificar o problema, não recomendo.

Recomendado: combinar **(1) + (3)**. (1) é defensiva universal e tem custo zero. (3) garante recovery em qualquer cenário de "task perdida", incluindo este e outros que ainda não conhecemos.

## Mitigação imediata (até o fix)

Após qualquer restart do stack:

```bash
docker compose exec backend python manage.py shell -c "
from apps.coleta.tasks import sincronizar_conta_provedor
from apps.provedores.models import ContaProvedor
for c in ContaProvedor.objects.filter(is_active=True):
    sincronizar_conta_provedor.delay(c.id)
    print(f'enfileirado {c.tipo}')
"
```

## Arquivos relevantes

- `backend/apps/coleta/tasks.py::sincronizar_conta_provedor` — função alvo do lock.
- `backend/apps/coleta/signals.py` — gerencia as `PeriodicTask`.
- `backend/config/celery.py` — onde colocar `task_acks_late` / `worker_prefetch_multiplier`.
