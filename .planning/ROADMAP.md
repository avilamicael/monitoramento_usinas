# Roadmap: Monitoramento de Usinas Solares — M1 Hardening

## Overview

Milestone 1 do produto SaaS multi-tenant de monitoramento solar. Sistema já está em produção dev na `trylab-vps` coletando de 6 contas reais; este milestone **não muda funcionalidade do produto** — estabiliza o que existe. A jornada é: (1) audit produz o mapa priorizado de débitos, (2) quick-wins de segurança fecham os critical findings rápidos, (3) validação dos 6 adapters + eval harness offline garantem que o dado canônico está correto antes de calibrar regras em cima, (4) motor de alertas ganha performance + correctness com baselines mensuráveis, (5) loop de calibração + UX de alertas + sync da doc do produto fecham o ciclo "informa com confiança", (6) rotação de Fernet entra em paralelo a partir da Phase 4 (depende só de Phase 2 ter `SECRET_KEY` saneada).

Sequência respeita pré-requisitos cruzados confirmados em `research/SUMMARY.md`: adapter correto antes de validar regras, baseline de queries antes de N+1 fix, migration `null=True` antes de remover `or 0` na ingestão.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Audit Foundation** — Mapa priorizado de débitos (SAST, deps, secrets, tenancy matrix, baseline de queries) sem mudar produção
- [ ] **Phase 2: Security Críticos (Quick Wins)** — Fechar critical findings rápidos do audit (`.gitignore`, `SECRET_KEY`, rate limit, axes, CSP, Sentry, pre-commit)
- [ ] **Phase 3: Validação de Adapters + Eval Harness** — 3 camadas de teste por adapter + golden dataset rotulado + `medido_em=None` no Fusion/Foxess + Auxsol token refresh + irradiação real
- [ ] **Phase 4: Motor — Performance + Correctness + Validação** — Índice composto, N+1 fix com `<10` queries/ciclo, migration `null=True` multi-step, validação de precision/recall via harness
- [ ] **Phase 5: Calibração + UX Alertas** — Sugestões de calibragem (P95 → admin aprova, NUNCA auto-aplica) + agrupamento intra-regra + sync `/docs`
- [ ] **Phase 6: Fernet Rotation (Paralelo)** — `MultiFernet` + comando idempotente de rotação sem downtime (paralelizável com Phase 4/5)

## Phase Details

### Phase 1: Audit Foundation

**Goal**: Produzir mapa priorizado de débitos técnicos e de segurança ANTES de qualquer fix, com baseline mensurável das áreas críticas (motor de alertas, tenant isolation). Saída orienta priorização das fases subsequentes; nada de produção muda.
**Depends on**: Nothing (first phase)
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05, AUDIT-06
**Success Criteria** (what must be TRUE):

  1. Existe `.planning/audit/2026-05/REPORT.md` com findings classificados em 4 buckets (CRÍTICO / IMPORTANTE / RUÍDO / FP) e priorizados por score `severidade × blast_radius / esforço`
  2. `pytest tests/security/test_tenant_isolation.py` cobre matriz paramétrica (todos os viewsets × cross-tenant read/write/delete) e passa 100% — gaps identificados viram findings no REPORT
  3. Existe `docs/performance/motor-baseline-2026-05.md` com `assertNumQueries` medido para 3 cenários (1, 10, 50 usinas) — número-alvo do Phase 4 derivado daqui
  4. `gitleaks` + `trufflehog --only-verified` rodam limpos no histórico do git (zero positivos verificados); CVEs de deps catalogados com triagem de exploitability

**Plans**: TBD

### Phase 2: Security Críticos (Quick Wins)

**Goal**: Fechar os critical findings rápidos do audit antes de tocar em código de produto — defesa em profundidade básica (lockout, rate limit, headers, scrub de Sentry) + impedir vazamento futuro (`.gitignore`, pre-commit, fail-fast em `SECRET_KEY`).
**Depends on**: Phase 1
**Requirements**: SEC-01, SEC-02, SEC-05, SEC-06, SEC-07, SEC-08, SEC-09
**Success Criteria** (what must be TRUE):

  1. `git status` na working tree não lista `.mcp.json`/`*.pem`/`saida_bruta.txt` como untracked após `git clean -fdx` em ambiente limpo; pre-commit com `gitleaks` impede push de secret
  2. Tentar 6 logins inválidos em `/api/auth/token/` causa lockout `django-axes`; endpoints sensíveis (auth, reset senha) bloqueiam ao exceder throttle DRF
  3. Resposta HTTP de qualquer endpoint inclui CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`; produção que sobe sem `DJANGO_SECRET_KEY` no env falha imediatamente no boot (não usa default inseguro)
  4. Erro forçado em ciclo de coleta aparece no Sentry com tag `empresa_id` + `provedor`; payload de erro NUNCA contém `credenciais_enc`/`cache_token_enc`/`password`/`secret` (verificado em teste do `before_send`)

**Plans**: TBD

### Phase 3: Validação de Adapters + Eval Harness

**Goal**: Garantir que o dado canônico (`DadosUsina`/`DadosInversor`) que sai dos 6 adapters reflete realidade — pré-requisito não-negociável para calibrar regras na Phase 4/5. Construir eval harness offline + golden dataset rotulado pela operação que viram a régua de aceitação de TODA mudança no motor daqui pra frente. Resolve HARD-09 (`medido_em=None` em Fusion/Foxess), HARD-10 (Auxsol refresh), HARD-11 (irradiação real).
**Depends on**: Phase 1 (gaps identificados), Phase 2 (Fernet seguro pra rodar contra credenciais reais)
**Requirements**: ADAP-01, ADAP-02, ADAP-03, ADAP-04, ADAP-05, ADAP-06, ADAP-07, ADAP-08, ADAP-09, ADAP-10
**Success Criteria** (what must be TRUE):

  1. Cada um dos 6 adapters (Solis, Hoymiles, FusionSolar, Solarman, Auxsol, Foxess) tem 3 camadas de teste passando: unit, cassette com header `gravado_em` (validade 3 meses), e contract test real semanal — relatório por adapter em `docs/validacao-adapters/`
  2. FusionSolar e Foxess retornam `medido_em=None` quando o provedor não expõe o timestamp (validado em cassette); regra `sem_comunicacao` passa a disparar nessas usinas onde antes ficava silenciada por `datetime.now()` fallback
  3. Eval harness `apps/alertas/eval/harness.py::replay_motor(empresa_id, janela)` reproduz determinísticamente um período histórico com `freezegun`; rodar contra golden dataset (≥20 casos rotulados por operador em ≥1 empresa voluntária) produz tabela precision/recall por regra
  4. HARD-11 entregue: regra `sem_geracao_horario_solar` consulta elevação solar via `pvlib.solarposition` para usinas com `lat/lon`; model `IrradianciaDiaria` populada por task diária NASA POWER (1 chamada/usina/dia, não por coleta); janela astral fixa só atua como fallback quando `lat/lon` ausente

**Plans**: TBD

### Phase 4: Motor — Performance + Correctness + Validação

**Goal**: Motor de alertas passa de ~1.5k queries/ciclo (medido em Phase 1) para `<10` queries/ciclo com regression guard em CI; convenção do `null` deixa de ser violada na ingestão (multi-step migration); contadores do `LogColeta` viram fiéis; 12 regras passam pela régua de precision/recall do golden dataset montado no Phase 3.
**Depends on**: Phase 3 (dado correto + harness + baseline de Phase 1)
**Requirements**: MOTR-01, MOTR-02, MOTR-03, MOTR-04, MOTR-05, MOTR-06, MOTR-07, MOTR-08
**Success Criteria** (what must be TRUE):

  1. `assertNumQueries` em CI prova que `avaliar_empresa()` faz `<10` queries em 50-usinas (vs baseline de Phase 1); índice composto `(usina, -coletado_em)` criado via `CREATE INDEX CONCURRENTLY` sem derrubar coleta em produção dev
  2. Sequência multi-step concluída: deploy A torna campos elétricos de `LeituraUsina`/`LeituraInversor` `null=True` (sem mudar código de ingestão); deploy B remove `or 0` em `apps/coleta/ingestao.py:152-155,252-254`. Histórico antigo (com `0`) preservado, novas leituras distinguem "provedor reportou zero" de "campo ausente"
  3. Cada uma das 12 regras tem score precision/recall medido contra golden dataset (relatório por regra × empresa em `docs/validacao-regras/`); regras com precision <X% (alvo definido no Phase 1) viram input para Phase 5 (sugestões de calibragem)
  4. `LogColeta` em `/api/coleta/logs/` mostra contadores reais (`qtd_alertas_abertos`, `qtd_alertas_resolvidos`) do ciclo; cache módulo-level de janela astral substituído por cache com TTL/maxsize explícito (não vaza memória no worker long-lived)

**Plans**: TBD

### Phase 5: Calibração + UX Alertas

**Goal**: Fechar o loop "informa com confiança": sistema gera sugestões de calibragem baseadas em P95 amostral por regra/empresa e expõe na UI pra admin aprovar manualmente (NUNCA auto-aplica — fere a filosofia "só informa"); página de alertas ganha agrupamento intra-regra + filtros + ações em massa pra reduzir fadiga do operador. Sync obrigatório com `frontend/src/pages/docs/` no mesmo PR (regra de CLAUDE.md).
**Depends on**: Phase 4 (motor estável + precision medida), Phase 3 (golden dataset)
**Requirements**: CALI-01, CALI-02, CALI-03, CALI-04, CALI-05
**Success Criteria** (what must be TRUE):

  1. Model `SugestaoCalibragem` populada por task diária `apps/alertas/calibracao.py::gerar_sugestoes` agrega P50/P95/P99 + churn <1h por regra; admin vê badge em `/configuracao/regras` e aprova/rejeita manualmente — nenhuma sugestão é auto-aplicada (verificado em teste)
  2. Página `/alertas` agrupa alertas intra-regra (preserva diversidade entre regras) com filtros (regra, severidade, usina, período), histórico do alerta (transições aberto→atualizado→resolvido) e ações em massa (resolver, reconhecer)
  3. `DocsRegrasPage.tsx` e `DocsComoFuncionaPage.tsx` atualizados no mesmo PR descrevendo (a) loop de sugestão de calibragem em PT-BR voltado ao operador, (b) novo agrupamento da página de alertas; sem termos em inglês (`override`, `threshold`)
  4. Churn <1h por regra/empresa medido pelo harness antes/depois das calibrações aprovadas pelo admin diminui em relação ao baseline de Phase 4 (alvo % definido no fim do Phase 1; tese central do produto validada)

**Plans**: TBD
**UI hint**: yes

### Phase 6: Fernet Rotation (Paralelo)

**Goal**: Dar capacidade de rotacionar `CHAVE_CRIPTOGRAFIA` em produção SEM downtime na coleta, em resposta a incidente ou cadência preventiva. Paralelizável com Phase 4 e Phase 5 — depende só de Phase 2 (`SECRET_KEY` saneada). Substitui a nota em `apps/provedores/cripto.py:8` ("rotação fora deste escopo").
**Depends on**: Phase 2 (security baseline)
**Requirements**: SEC-03, SEC-04
**Success Criteria** (what must be TRUE):

  1. `apps/provedores/cripto.py` aceita `[chave_nova, chave_antiga]` via `MultiFernet`; descriptografia funciona com qualquer chave da lista; encriptação usa sempre a primeira; teste prova decrypt-fallback contra credencial encriptada com chave antiga
  2. `python manage.py rotacionar_chave_fernet` é idempotente — re-execução não corrompe dados, processa em batch (transação por `ContaProvedor`), reportando progresso; aborta com erro claro se `CHAVE_CRIPTOGRAFIA` não estiver com lista de 2 chaves
  3. Runbook em `docs/operacoes/rotacao-fernet.md` cobre o procedimento completo: gerar nova chave → adicionar à frente → rodar comando → remover antiga → restart. Coleta dos 6 provedores continua durante a rotação (validado em dev contra todas as contas)

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5. Phase 6 paralelizável a partir do início do Phase 4.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Audit Foundation | 0/TBD | Not started | - |
| 2. Security Críticos (Quick Wins) | 0/TBD | Not started | - |
| 3. Validação de Adapters + Eval Harness | 0/TBD | Not started | - |
| 4. Motor — Performance + Correctness + Validação | 0/TBD | Not started | - |
| 5. Calibração + UX Alertas | 0/TBD | Not started | - |
| 6. Fernet Rotation (Paralelo) | 0/TBD | Not started | - |

### Phase 7: Clientes Premium (Monitoramento Ativo)

**Goal:** Adicionar contratos pagos de "monitoramento ativo" (cliente premium) por usina, independentes da garantia. O motor passa a monitorar usinas com garantia ativa **OU** monitoramento ativo vigente; alertas de usinas premium são marcados (`premium`) e ganham tela dedicada `/alertas-premium`; nova regra diária avisa o vencimento do contrato. **Fase de FEATURE DE PRODUTO — fora da sequência de hardening do M1** (que é só estabilização). Aditiva: não altera comportamento de garantia, só amplia o gate do motor.
**Requirements**: PREM-01 (CRUD MonitoramentoAtivo escopado por empresa), PREM-02 (gate motor garantia OU premium), PREM-03 (flag `premium` + tela `/alertas-premium`), PREM-04 (regra `monitoramento_premium_vencendo` + limites configuráveis), PREM-05 (docs `/docs/premium` + configurações), PREM-06 (testes verdes + code review resolvido)
**Depends on:** Nothing (feature aditiva, independente do M1 hardening)
**Success Criteria** (what must be TRUE):
  1. CRUD de `MonitoramentoAtivo` (1:1 com `Usina`) por empresa, com `usina` escopada ao `request.empresa` (anti-IDOR) — admin da empresa A não cria contrato em usina da empresa B; `fim_em` persistido a partir de `inicio_em + meses`
  2. `avaliar_empresa()` avalia usinas com garantia ativa OU `monitoramento_ativo` vigente (`_usina_monitorada`); comportamento de garantia preservado (`garantia_vencendo` retorna None sem garantia)
  3. `Alerta` expõe `premium` (derivado via `Exists`, sem N+1); `GET /api/alertas/?premium=true` filtra; existe `/alertas-premium` e badge "Premium" na lista geral
  4. Regra diária `monitoramento_premium_vencendo` (INFO ≤30d / AVISO ≤7d) com `monitoramento_premium_aviso_dias`/`_critico_dias` em `ConfiguracaoEmpresa`, validados (`critico < aviso`) no backend
  5. Doc `/docs/premium` criada e registrada; `DocsComoFuncionaPage`/`DocsRegrasPage`/`DocsConfiguracoesPage` e a tela de Configurações refletem garantia **ou** premium
  6. Suíte backend verde (216) e `07-REVIEW.md` com findings resolvidos (1 BLOCKER IDOR + warnings)
**Plans:** 1/1 complete
**Status:** ✅ Done (verified 6/6 — 2026-06-15)

Plans:

- [x] 07-PLAN.md — Clientes Premium (Monitoramento Ativo) — `done` (retroativo; verificado em 07-VERIFICATION.md, 216 testes + build verdes)
