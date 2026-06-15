# Monitoramento de Usinas Solares

## What This Is

Plataforma SaaS multi-empresa de **monitoramento ativo** de usinas solares fotovoltaicas. O sistema coleta dados de 6 provedores diferentes (Solis, Hoymiles, FusionSolar, Solarman, Auxsol, Foxess), gera alertas a partir das leituras (não dos alarmes nativos dos provedores) e informa o operador da empresa quando algo precisa de atenção. Substitui um sistema legado (`firmasolar`) com volume comprovado de 6 contas, 267 usinas e 659 inversores rodando em produção.

## Core Value

**Informar com confiança quando uma usina precisa de atenção — sem falso positivo, sem ruído.** O sistema observa e avisa; nunca tenta consertar nada. A diferenciação concreta é a redução do churn de alertas <1h (era 12.8% no sistema antigo, 46% no Solis) gerando alertas próprios a partir das leituras canônicas em vez de consumir os alarmes nativos dos provedores.

## Requirements

### Validated

<!-- Inferido do codebase atual — funcionando em dev contra 6 contas reais desde 2026-04-25. -->

- ✓ **Multi-tenancy por `empresa_id`** (shared schema com mixin `EscopoEmpresa` + middleware) — existing
- ✓ **6 adapters de provedores** (Solis HMAC, Hoymiles nonce+protobuf, FusionSolar XSRF, Solarman JWT, Auxsol Bearer, Foxess MD5) com 44 testes em fixtures reais — existing
- ✓ **Motor de coleta Celery** com ingestão idempotente (`UniqueConstraint(usina, coletado_em)`), retry com backoff, scheduler dinâmico via signals — existing
- ✓ **Motor de alertas tri-state** (Anomalia/False/None) com 12 regras configuráveis + escalada "todos afetados" + severidade dinâmica — existing
- ✓ **API REST completa** (19 endpoints sob `/api/`, OpenAPI/Swagger, JWT com rotação) — existing
- ✓ **Frontend com páginas reais** (dashboard, usinas, inversores, alertas, configuração empresa, configuração regras, usuários, /docs do produto) — existing
- ✓ **Autenticação multi-perfil** (administrador / operacional) com `Usuario` herdando `AbstractUser` — existing
- ✓ **Cripto Fernet de credenciais** (`ContaProvedor.credenciais_enc` + `cache_token_enc`) — existing
- ✓ **Retenção configurável** de leituras + task diária de limpeza — existing
- ✓ **Documentação do produto em `/docs`** servida pelo frontend para o operador — existing
- ✓ **Deploy em produção dev** na `trylab-vps` coletando das 6 contas reais — existing

### Active

<!-- Milestone 1 — Hardening & Estabilização. Auditoria primeiro, depois correções. -->

- [ ] **HARD-01**: Code review profissional do backend e frontend produzindo lista priorizada de débitos
- [ ] **HARD-02**: Security review cobrindo OWASP Top 10 + débitos conhecidos do `CONCERNS.md`
- [ ] **HARD-03**: Validação de alertas — confirmar que cada uma das 12 regras dispara/resolve corretamente contra dados reais coletados
- [ ] **HARD-04**: Validação de provedores — confirmar que os 6 adapters retornam dados corretos (Fusion/Foxess `medido_em`, Auxsol token refresh, drift de unidades)
- [ ] **HARD-05**: Correção dos críticos de segurança do audit (`.pem`/`.mcp.json` fora do `.gitignore`, `SECRET_KEY` default, `saida_bruta.txt` no git, rotação Fernet)
- [ ] **HARD-06**: Performance do motor de alertas — eliminar N+1 (~1.5k queries/ciclo) em `apps/alertas/motor.py`
- [ ] **HARD-07**: Correção da violação da regra do null em `apps/coleta/ingestao.py:152-155,252-254` (0 sendo usado como sentinela onde deveria ser `None`)
- [ ] **HARD-08**: Correção do bug cosmético do `LogColeta` (contadores zerados — auditoria imprecisa)
- [ ] **HARD-09**: F12 pendente — `medido_em=None` quando Fusion/Foxess não expõem (hoje cai pra `datetime.now()`, faz `sem_comunicacao` nunca disparar)
- [ ] **HARD-10**: F12 pendente — Auxsol token refresh mais agressivo (12h teóricos, mas auth_erro/24h observado)
- [ ] **HARD-11**: F12 pendente — irradiação NASA por `lat/lon` substituindo `horario_solar_*` fixo
- [ ] **HARD-12**: UX da página de alertas — agrupamento, filtros, histórico do alerta, ações em massa

### Out of Scope

<!-- Decisões explícitas. Não re-adicionar sem reabrir a discussão. -->

- **Auto-remediação / ações corretivas** — Nunca. O sistema apenas informa; quem age é o operador. Decisão estratégica do produto.
- **Alarmes nativos dos provedores** (alarmList, warn_data) — Descartados como entidade. Davam 12.8% de churn <1h. Permanecem em `raw` só pra auditoria.
- **Notificações funcionais** (envio real de email/webhook/WhatsApp) — Backend hoje é só scaffold + UI promete. Vai pro **M2** (próximo milestone), não M1.
- **App mobile** — Futuro distante. Não tocado em M1 nem M2.
- **Acesso de cliente final à própria usina** (segundo perfil de usuário) — Futuro distante; hoje só operador/admin da empresa. Não tocado em M1 nem M2.
- **Billing / cobrança SaaS** — Lá pra frente, depois das features do produto estabilizarem. Escopo a definir.
- **Bilhete/contas de luz / cálculo de ROI** — Não é monitoramento; vira outro produto.

## Context

- **Substituição de sistema legado**: o produto está portando 6 contas, 267 usinas e 659 inversores do `firmasolar` (rodando há anos em produção). Volume de operação é conhecido.
- **Filosofia central de alertas**: alertas são gerados pelo backend a partir das leituras canônicas, **nunca** consumidos dos provedores. Razão concreta: churn <1h de 12.8% (46% no Solis) no sistema antigo. Reescrita garante controle de threshold, histerese implícita por tri-state e calibração por empresa/usina.
- **Convenção de naming híbrida**: PT-BR para domínio (modelos, campos, enums, URLs, labels); inglês para universais (`id`, `is_active`, `created_at`, `slug`, `secret`, `raw`, `config`) e nomes de libs/componentes React. Apps Python sem acento/cedilha (`notificacoes`, `alertas`).
- **Documentação ao usuário em `/docs`**: regra obrigatória — qualquer mudança que afete comportamento, regra, threshold ou texto da UI exige revisão das páginas em `frontend/src/pages/docs/` no mesmo PR.
- **Calibrações já aplicadas (F12 parcial, 2026-04-26)**: defaults de subdesempenho 30→15%, subtensão 200→190 V, guard de potência mínima 0.5 kW pra regras elétricas, `inversor_offline` exige 3 coletas consecutivas, `sem_geracao_horario_solar` só dispara em queda abrupta (anterior >5% capacidade). Tudo configurável por empresa/usina via `ConfiguracaoEmpresa`/`Usina`.
- **Estado atual de validação**: ainda validando se os dados coletados estão corretos contra realidade (operador). Justifica a Fase de auditoria do M1.
- **Status por fase original**: ✅ F1–F11 baseline, models, adapters, coleta, alertas, 12 regras, ambiente de dev coletando. **F12 parcial** (calibrações aplicadas, 3 itens pendentes). API REST completa em F14.
- **Bugs catalogados** em `docs/bugs/` (abertos) e `docs/bugs/resolvidos/` (arquivados). `CONCERNS.md` do codebase map tem inventário consolidado de tech-debt.

## Constraints

- **Tech stack backend**: Django 5 + DRF + Celery/Redis + Postgres 16, Python 3.12 (container) — **Não migrar para outras stacks; reescrita custaria muito**
- **Tech stack frontend**: Vite + React 19 + TS + Tailwind v4 + shadcn — **Mesmo motivo**
- **Infra**: VPS HostGator BR (`trylab-vps`, 8GB RAM em prod, mas histórico de OOM em build Vite — swap permanente recomendado). Nginx fica na VPS, fora do compose — **Necessidade conhecida da hospedagem brasileira (LGPD, latência para clientes BR)**
- **Multi-tenancy**: shared schema por `empresa_id`; toda model com escopo herda `EscopoEmpresa`. Views/querysets **sempre** filtram por `request.empresa` — nunca confiar em parâmetro do cliente — **Constraint de segurança, não negociável**
- **Idempotência da ingestão**: `coletado_em = arredondar_janela(now, 10min)` garante que re-execução não duplica — **Habilita retry sem corrupção**
- **Cripto Fernet de credenciais**: `CHAVE_CRIPTOGRAFIA` no `.env`, nunca em código. `credenciais_enc` e `cache_token_enc` sempre JSON+Fernet — **Compliance LGPD; rotação da chave é parte do M1**
- **Timezone**: `America/Sao_Paulo`, `USE_TZ=True`, datetimes sempre aware — **Inversores reportam em local time; horário solar depende disso**
- **Política de docs**: alteração que mude regra/threshold/comportamento exige revisão de `frontend/src/pages/docs/` no mesmo PR — **Documentação é parte do produto, não anexo**
- **Compatibilidade com produção dev**: VPS já coleta de 6 contas reais. Migrations destrutivas precisam de plano de rollout — **Não derrubar coleta**

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Substituir alarmes nativos por motor próprio de regras | Churn <1h de 12.8% (46% no Solis) no sistema antigo era inaceitável | ✓ Good — calibrações F12 já reduziram FP comprovado |
| Adapter pattern com unidades canônicas (kW, kWh, V, A, Hz, °C) | 6 provedores com unidades e contratos diferentes; centraliza normalização | ✓ Good — todos os 6 portados com 44 testes |
| Tri-state nas regras (`Anomalia`/`False`/`None`) | Dado ausente não pode resolver/fechar alerta aberto erroneamente | ✓ Good — eliminou classe inteira de FP |
| Multi-tenancy shared schema (não schema-per-tenant) | Volume previsto (dezenas de empresas) não justifica complexidade de schema-per-tenant | ✓ Good — funciona em produção |
| API REST completa **antes** de tocar no frontend | Evita vertical slice premature; backend amadurece sem retrabalho de UI | ✓ Good — 19 endpoints OpenAPI, frontend portado depois |
| Defaults de threshold configuráveis por empresa/usina, nunca hardcoded | Cada empresa tem rede diferente (BT/AT, regional); hardcode gera ruído | ✓ Good — F12 validou o princípio |
| Auditoria + validação **antes** de hardening em M1 | Time ainda validando dados em produção; corrigir sem mapa é desperdício | — Pending (Fase 1 do M1) |
| Sistema **só informa**, nunca remedia | Decisão de produto/responsabilidade; auto-ação na rede elétrica = risco | ✓ Good — define limite claro |
| Hospedar na `trylab-vps` (HostGator BR) | LGPD + latência para clientes brasileiros + custo | — Pending (OOM no Vite ainda é gargalo) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-12 after initialization*
