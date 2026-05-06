---
title: LogColeta sempre fecha com qtd_alertas_abertos=0 e qtd_alertas_resolvidos=0
descoberto_em: 2026-05-06
severidade: cosmetico
status: aberto
tags: [bug, coleta, alertas, auditoria]
---

# `LogColeta` sempre com contadores de alertas zerados

## Sintoma

Todos os 1176 últimos `LogColeta` em produção fecharam com `qtd_alertas_abertos=0` e `qtd_alertas_resolvidos=0`, mesmo quando o motor de alertas abriu/resolveu alertas naquele ciclo. Visível em `/api/coleta/logs/`.

Não afeta funcionalidade — alertas são abertos/resolvidos normalmente. Só a auditoria fica imprecisa.

## Causa

`apps/coleta/tasks.py:140` chama `avaliar_empresa_em_commit(conta.empresa_id)` que agenda a avaliação via `transaction.on_commit` (fire-and-forget). O `LogColeta` é fechado **antes** da avaliação rodar, então os contadores nunca são preenchidos.

A função `motor.avaliar_empresa` em `apps/alertas/motor.py:379-382` retorna `{"abertos": ..., "resolvidos": ...}`, mas o resultado é descartado.

## Próximos passos (quando for fixar)

Opções:

1. **Promover `avaliar_empresa_em_commit` para uma Celery task** que recebe `log_coleta_id` e atualiza o `LogColeta` ao terminar. Custo: 1 task adicional por ciclo.

2. **Mover a avaliação para dentro da transação da ingestão** e atualizar `LogColeta` em sequência. Custo: ciclos ficam mais longos (avaliação síncrona), mas o número fica preciso. Risco: se a avaliação falhar, a coleta inteira faz rollback.

3. **Remover os campos `qtd_alertas_abertos`/`qtd_alertas_resolvidos`** se ninguém usa pra nada importante. Custo zero, perde-se pouca coisa.

Recomendado: opção 3 a menos que alguém precise dos contadores para relatório/dashboard. Se precisarem, opção 1.

## Arquivos relevantes

- `backend/apps/coleta/tasks.py:140` — chamada fire-and-forget.
- `backend/apps/alertas/motor.py:379-382` — retorno descartado.
- `backend/apps/coleta/models.py` — definição do `LogColeta`.

## Sem urgência

Não bloqueia nada. Levantado em 2026-05-06 durante investigação de alertas órfãos de `inversor_offline`.
