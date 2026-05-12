# Requirements: Monitoramento de Usinas Solares — M1 Hardening & Estabilização

**Defined:** 2026-05-12
**Core Value:** Informar com confiança quando uma usina precisa de atenção — sem falso positivo, sem ruído.

## v1 Requirements

Requirements do **Milestone 1: Hardening & Estabilização**. Cada um mapeia para uma fase do roadmap. Ordem de fases respeita pré-requisitos cruzados identificados na pesquisa (`research/SUMMARY.md`).

### Audit (Phase 1 — foundation, sem fix)

- [ ] **AUDIT-01**: Rodar audit SAST do backend (bandit + semgrep com rulesets django/owasp-top-ten) com triagem dupla (CRÍTICO / IMPORTANTE / RUÍDO / FP)
- [ ] **AUDIT-02**: Rodar audit de dependências (pip-audit + npm audit) e produzir lista priorizada de CVEs
- [ ] **AUDIT-03**: Rodar audit de secrets (gitleaks + trufflehog com `--only-verified`) no histórico do git
- [ ] **AUDIT-04**: Test matrix de tenant isolation (pytest paramétrico × viewsets × ações cross-tenant)
- [ ] **AUDIT-05**: Baseline de performance do motor de alertas (assertNumQueries em 3 cenários: 1, 10, 50 usinas) documentado em `docs/performance/motor-baseline-2026-05.md`
- [ ] **AUDIT-06**: Relatório priorizado consolidado em `.planning/audit/2026-05/REPORT.md` (score = severidade × blast_radius / esforço)

### Security (Phase 2 — quick wins; Phase 6 — Fernet rotation)

- [ ] **SEC-01**: `.gitignore` cobre `*.pem`, `.mcp.json`, `saida_bruta.txt`, `**/credentials.json`
- [ ] **SEC-02**: `SECRET_KEY` sem default inseguro em produção (fail-fast se ausente)
- [ ] **SEC-03**: Refactor `apps/provedores/cripto.py` para `MultiFernet` (lista de chaves `[nova, antiga]` com decrypt fallback)
- [ ] **SEC-04**: Comando idempotente `manage.py rotacionar_chave_fernet` (re-encripta credenciais e tokens em batch, transação por `ContaProvedor`)
- [ ] **SEC-05**: pre-commit hook com gitleaks + trufflehog (impede push acidental)
- [ ] **SEC-06**: `django-axes` configurado em `/api/auth/token/` (brute-force lockout)
- [ ] **SEC-07**: `django-ratelimit` ou DRF throttle em endpoints sensíveis (auth, reset, troca de senha)
- [ ] **SEC-08**: Headers de segurança (CSP via `django-csp`, HSTS, X-Content-Type-Options, Referrer-Policy)
- [ ] **SEC-09**: Sentry SDK configurado com `before_send` scrubando `credenciais_enc`, `cache_token_enc`, `password`, `secret`

### Adapters (Phase 3 — validação + F12 pendente + harness)

- [ ] **ADAP-01**: Validar adapter Solis contra produção real (3 camadas: unit / cassette com `gravado_em` / contract semanal)
- [ ] **ADAP-02**: Validar adapter Hoymiles + fix race no save de `cache_token_enc`
- [ ] **ADAP-03**: Validar adapter FusionSolar + fix `medido_em=None` quando provedor não expõe (parte de HARD-09)
- [ ] **ADAP-04**: Validar adapter Foxess + fix `medido_em=None` quando provedor não expõe (parte de HARD-09)
- [ ] **ADAP-05**: Validar adapter Solarman contra produção real
- [ ] **ADAP-06**: Validar adapter Auxsol + token refresh mais agressivo (HARD-10 — 12h teóricos, mas auth_erro/24h observado)
- [ ] **ADAP-07**: Eval harness offline (`apps/alertas/eval/harness.py` com `replay_motor(empresa_id, janela)` + freezegun)
- [ ] **ADAP-08**: Golden dataset versionado em `.planning/eval/golden/<empresa>/*.jsonl` (20–50 casos rotulados pela operação)
- [ ] **ADAP-09**: HARD-11 — `pvlib.solarposition` substitui janela horário solar fixa por elevação solar real (gating por `lat/lon` da usina); janela astral fixa vira fallback
- [ ] **ADAP-10**: HARD-11 — model `IrradianciaDiaria` + task diária NASA POWER por usina (resolve "sem geração" com referência real, não janela horária)

### Motor (Phase 4 — performance + correctness + validação)

- [ ] **MOTR-01**: Índice composto `(usina, -coletado_em)` em `LeituraUsina` e `LeituraInversor` (`CREATE INDEX CONCURRENTLY` em migration RunSQL)
- [ ] **MOTR-02**: Eliminar N+1 em `apps/alertas/motor.py` via `Subquery + OuterRef + in_bulk` (HARD-06 — alvo: <10 queries/ciclo)
- [ ] **MOTR-03**: Migration `null=True` em campos elétricos de `LeituraUsina`/`LeituraInversor` (HARD-07 parte 1 — schema, sem mudar código de ingestão)
- [ ] **MOTR-04**: Remover `or 0` em `apps/coleta/ingestao.py:152-155,252-254` em deploy separado (HARD-07 parte 2)
- [ ] **MOTR-05**: Validar precision/recall das 12 regras via harness contra golden dataset (relatório por regra/empresa)
- [ ] **MOTR-06**: Fix `LogColeta` contadores zerados (HARD-08 — usar contadores reais do ciclo, não valores sentinela)
- [ ] **MOTR-07**: `assertNumQueries` em CI como regression guard no motor (3 cenários)
- [ ] **MOTR-08**: Substituir cache módulo-level em `apps/coleta/_helpers.py:41` por cache com TTL (Redis ou `lru_cache` com tamanho explícito)

### Calibração + UX (Phase 5)

- [ ] **CALI-01**: Nova model `SugestaoCalibragem` (FK `Empresa`, `Usina` ou `Inversor`, regra, campo, valor sugerido, P95 amostral, criada_em, aprovada_em, rejeitada_em)
- [ ] **CALI-02**: Task diária `apps/alertas/calibracao.py::gerar_sugestoes` agrega P50/P95/P99 das leituras + churn <1h por regra
- [ ] **CALI-03**: UI em `/configuracao/regras` mostra sugestões (badge), admin aprova/rejeita manualmente (NUNCA auto-aplica)
- [ ] **CALI-04**: HARD-12 — agrupamento intra-regra na página de alertas + filtros (regra, severidade, usina, período) + histórico do alerta + ações em massa
- [ ] **CALI-05**: Sync de `frontend/src/pages/docs/DocsRegrasPage.tsx` e `DocsComoFuncionaPage.tsx` com novos comportamentos (sugestões de calibração, agrupamento)

## v2 Requirements (Backlog — próximos milestones)

### M2 — Notificações funcionais

- **NOTF-01**: Worker Celery de envio de email com retry exponencial + dead-letter
- **NOTF-02**: Integração ESP (Amazon SES `sa-east-1` ou Postmark)
- **NOTF-03**: Executor de webhook com SSRF guard (bloqueia `localhost`, IPs privados, metadata endpoints)
- **NOTF-04**: Config granular "quem recebe o quê" (por usuário + por regra + por severidade)
- **NOTF-05**: Integração WhatsApp via Meta Cloud API (free tier até 1k conversas/mês)
- **NOTF-06**: Janela de silêncio configurável por empresa (não notifica entre X-Y)
- **NOTF-07**: Resumo diário (digest) configurável

### M3 — Relatório PDF mensal + Performance Ratio

- **REPT-01**: Performance Ratio calculado a partir de irradiância NASA POWER + capacidade nominal
- **REPT-02**: Template PDF mensal branded por empresa (logo, tarifa)
- **REPT-03**: Envio automático no dia X de cada mês para destinatários cadastrados
- **REPT-04**: Campo `tarifa_kwh` em `ConfiguracaoEmpresa` + preparação tarifa branca

### M5+ — Portal cliente final + integrações + PWA + billing
*(detalhes em `.planning/research/SUMMARY.md` seção 8)*

## Out of Scope (M1)

| Feature | Por que excluído |
|---------|------------------|
| Notificações funcionais (envio real) | M2; M1 foca em validar e estabilizar o motor primeiro |
| App mobile / PWA | Futuro distante; web cobre operador hoje |
| Acesso de cliente final (segundo papel `cliente_final`) | M5+; depende de produto estabilizado |
| Billing / cobrança SaaS | M7+; ainda em fase de desenvolvimento |
| Auto-remediação na rede elétrica | **NUNCA** — decisão estratégica fundadora ("sistema só informa") |
| Consumir alarmes nativos dos provedores (`alarmList`, `warn_data`) | **NUNCA** — Causa raiz do churn 12.8% no sistema antigo |
| ML/IA para anomalia | M4+ se ROI justificar; FP no M1 fere a tese central |
| Auto-tuning de thresholds | **NUNCA** — Sugestões sim, aplicação automática não |
| Histerese clássica nas regras | Substituído por tri-state + carência por coletas consecutivas (já validado em F12) |
| Migração para schema-per-tenant (django-tenants) | Volume previsto não justifica complexidade |
| Row-Level Security em Postgres | M3+ como defense-in-depth; M1 usa test matrix |
| Reescrita de stack (FastAPI, Next.js, etc) | Stack em produção dev funcionando; reescrita custaria muito |
| Novos provedores (Goodwe, Growatt, SMA) | Backlog separado; 6 atuais cobrem necessidades |
| Multi-idioma na UI | Mercado BR; quando vier internacionalização, é projeto separado |
| Self-hosted Sentry | VPS 1.9GB não suporta Postgres+Redis+Kafka+ClickHouse extras |
| Datadog/New Relic | Custo + lock-in; Sentry SaaS free tier basta |
| Snyk/DefectDojo | OSS tooling (bandit+semgrep+pip-audit+gitleaks+trufflehog) cobre M1 |
| Solcast/SolarAnywhere (irradiância paga) | NASA POWER grátis basta pra gating |
| Circuit breaker (pybreaker) | Adiado pra M2; `precisa_atencao` já cobre auth no M1 |
| Swap permanente na VPS | Operacional, fora do escopo de M1 (referência em `docs/operacoes/`) |

## Traceability

Preenchido pelo roadmapper. Cada requirement mapeia para exatamente uma fase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIT-01 | (pendente) | Pending |
| AUDIT-02 | (pendente) | Pending |
| AUDIT-03 | (pendente) | Pending |
| AUDIT-04 | (pendente) | Pending |
| AUDIT-05 | (pendente) | Pending |
| AUDIT-06 | (pendente) | Pending |
| SEC-01 | (pendente) | Pending |
| SEC-02 | (pendente) | Pending |
| SEC-03 | (pendente) | Pending |
| SEC-04 | (pendente) | Pending |
| SEC-05 | (pendente) | Pending |
| SEC-06 | (pendente) | Pending |
| SEC-07 | (pendente) | Pending |
| SEC-08 | (pendente) | Pending |
| SEC-09 | (pendente) | Pending |
| ADAP-01 | (pendente) | Pending |
| ADAP-02 | (pendente) | Pending |
| ADAP-03 | (pendente) | Pending |
| ADAP-04 | (pendente) | Pending |
| ADAP-05 | (pendente) | Pending |
| ADAP-06 | (pendente) | Pending |
| ADAP-07 | (pendente) | Pending |
| ADAP-08 | (pendente) | Pending |
| ADAP-09 | (pendente) | Pending |
| ADAP-10 | (pendente) | Pending |
| MOTR-01 | (pendente) | Pending |
| MOTR-02 | (pendente) | Pending |
| MOTR-03 | (pendente) | Pending |
| MOTR-04 | (pendente) | Pending |
| MOTR-05 | (pendente) | Pending |
| MOTR-06 | (pendente) | Pending |
| MOTR-07 | (pendente) | Pending |
| MOTR-08 | (pendente) | Pending |
| CALI-01 | (pendente) | Pending |
| CALI-02 | (pendente) | Pending |
| CALI-03 | (pendente) | Pending |
| CALI-04 | (pendente) | Pending |
| CALI-05 | (pendente) | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 0 (preenchido pelo roadmapper)
- Unmapped: 38 ⏳

---
*Requirements defined: 2026-05-12*
*Last updated: 2026-05-12 after initial definition*
