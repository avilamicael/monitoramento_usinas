# Research Synthesis — M1 Hardening & Estabilização

**Project:** Monitoramento Solar Fotovoltaico SaaS Multi-Tenant
**Synthesized:** 2026-05-12
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, PROJECT.md
**Overall confidence:** HIGH (brownfield com baseline em produção dev, decisões fundadoras já validadas)

---

## 1. TL;DR

- **Sequência confirmada:** Audit (mapa) → Security críticos rápidos → Calibração de Adapter (HARD-04) → Motor (validação + N+1 + null) → Calibração de Regras → UX. Inverter qualquer pareto cima/baixo causa retrabalho mensurável.
- **Eval harness é o pivot do milestone:** sem replay offline contra fixtures históricas, "validar regras" vira leitura manual de log; com ele, calibração ganha score precision/recall por empresa e churn <1h vira métrica de aceitação.
- **HARD-04 PRECEDE HARD-03:** adapter retornando dado errado faz regra calibrar em cima de torto. Ordem invertida no roadmap = retrabalho garantido.
- **N+1 do motor é Subquery+OuterRef puro Django** (padrão já usado em `apps/core/dashboard.py:53-62`) — não precisa de biblioteca nova, mas precisa de baseline `assertNumQueries` + índice composto `(usina, -coletado_em)` antes do refactor.
- **Tooling resolvido:** bandit+semgrep+pip-audit+gitleaks+trufflehog (todos OSS) cobre security audit; Sentry SaaS free tier (5k errors/mês) cobre observability; pvlib+NASA POWER cobre HARD-11. NÃO usar Datadog, Snyk, DefectDojo, django-tenants, ou auto-tuning.

---

## 2. Sequenciamento do M1 (ordem com pré-requisitos cruzados)

```text
Phase 1 — AUDIT (foundation, sem fix)
  HARD-01 + HARD-02 com triagem dupla obrigatória
  Outputs: .planning/audit/<data>/REPORT.md priorizado, baseline de N queries do motor,
           bateria inicial de tenancy guards (test matrix descobrindo viewsets)
  Gate: relatório priorizado por score (severidade × blast_radius / esforço)

Phase 2 — SECURITY CRÍTICOS (paralelo barato)
  HARD-05 parcial: .gitignore (*.pem, .mcp.json), SECRET_KEY default, saida_bruta.txt
  Pré-requisito: nenhum (estes são quick wins do audit)
  Gate: gitleaks limpo no histórico + pre-commit hook ativo

Phase 3 — EVAL HARNESS + VALIDAÇÃO DE ADAPTERS
  HARD-04 (validar 6 adapters contra produção real) + harness offline (apps/alertas/eval/)
  HARD-09 (Fusion/Foxess medido_em=None), HARD-10 (Auxsol refresh), HARD-11 (NASA POWER)
  Pré-requisito: Phase 1 (audit identifica gaps), Phase 2 (Fernet seguro)
  Gate: 3 camadas de teste por adapter (unit/cassette/contract-real-semanal) + golden dataset
        com 20-50 casos rotulados por empresa

Phase 4 — MOTOR (validação + perf + correctness)
  HARD-03 (validação 12 regras via harness), HARD-06 (N+1), HARD-07 (null vs 0 multi-step),
  HARD-08 (LogColeta counters)
  Pré-requisito: Phase 3 (adapter retornando dado correto + harness pra validar)
  Gate: motor com <10 queries/ciclo, assertNumQueries em CI, regras com precision validada

Phase 5 — CALIBRAÇÃO + UX
  Calibration feedback loop (sugestões em /configuracao/regras), HARD-12 (agrupamento/filtros)
  Pré-requisito: Phase 4 (motor performático + regras validadas), Phase 3 (golden dataset)
  Gate: churn <1h reduzido em N% por empresa, UI documentada em /docs

Phase 6 — Fernet rotation (pode paralelizar com 4 ou 5)
  HARD-05 parcial: MultiFernet + comando idempotente de rotação
  Pré-requisito: MultiFernet ANTES de qualquer rotação (evita downtime)
  Gate: 2 chaves coexistem, decrypt fallback testado
```

### Pré-requisitos não-óbvios (mapa de dependências cruzadas)

| Item | Depende de | Motivo |
|------|------------|--------|
| HARD-03 (validação regras) | HARD-04 (validação adapters) | Calibrar regra em cima de dado de adapter errado fixa o errado |
| HARD-06 (N+1 fix) | Phase 1 (audit) + índice `(usina, -coletado_em)` | Otimização sem benchmark/índice = regressão silenciosa em empresa pequena |
| HARD-07 (null vs 0) | Migration multi-step (não junto com HARD-06) | Misturar mudança de schema com mudança de query = rollback impossível |
| Rotação Fernet | MultiFernet em `apps/provedores/cripto.py` ANTES | Rotação ingênua sem MultiFernet causa downtime em coleta em paralelo |
| Calibration loop | Phase 3 (harness) + Phase 4 (N+1) | Métricas P95 sem agregação eficiente = task lenta; sem score = sugestão sem evidência |
| HARD-12 (UX agrupamento) | Phase 4 (motor estável) + docs sync | UX em cima de motor barulhento calibra mal; CLAUDE.md exige doc no mesmo PR |
| HARD-11 (NASA POWER) | Model `IrradianciaDiaria` + task diária 04:00 | Não chamar API por usina por coleta (267 × 6 × 365 = ~580k calls/ano) |

---

## 3. Stack adicional (versões por fase)

### Phase 1 — Audit (dev-deps, instalação imediata)

```python
# backend/requirements-dev.txt
bandit[toml]==1.8.*          # SAST Python; .banditrc skipa migrations/tests
pip-audit==2.7.*             # CVE em deps (PyPA oficial, OSV.dev)
semgrep==1.*                 # SAST cross-file (rulesets p/django, p/owasp-top-ten)
django-silk==5.3.*           # profiling Celery + Django (dev/staging)
nplusone==1.0.*              # detector N+1 em CI
```

Binários (não-pip):
- **gitleaks** 8.x — pre-commit hook + CI
- **trufflehog** 3.x — CI com `--results=verified` (testa credencial viva)

### Phase 2 — Security runtime

```python
# backend/requirements.txt
django-axes==8.3.*           # brute-force lockout em /api/auth/token/
django-csp==4.0.*            # CSP middleware (Django 6+ tem nativo)
django-ratelimit==4.1.*      # rate limit decorator (DRF throttle pra REST)
# MultiFernet já incluso em cryptography 44.x (zero install)
```

### Phase 3 — Observability + Solar

```python
# backend/requirements.txt
sentry-sdk[django,celery]==2.*   # errors + tracing; free tier 5k/mês
pvlib==0.13.*                    # HARD-11 — get_nasa_power(), solarposition
pandas==2.*                      # transitive de pvlib
```

### Médio prazo (M2 prep, NÃO instalar em M1)

```python
django-anymail[amazon-ses]==15.0.*   # ESP abstraction
django-celery-email==3.0.*           # async email backend
```

### Longo prazo (escala 50+ empresas)

```python
opentelemetry-distro[otlp]==1.*
celery-exporter, django-prometheus, structlog
```

---

## 4. Padrões arquiteturais por fase

| Fase | Padrão | Onde aplicar | Anti-pattern a evitar |
|------|--------|--------------|----------------------|
| Audit | **Audit-First Brownfield** (mapa antes de fix, scoring 1-3 × 1-3 / 1-3) | `.planning/audit/<data>/REPORT.md` | "vamos consertando enquanto fazemos" (PR churn) |
| Audit | **Tenant Isolation Test Matrix** (pytest paramétrico × viewsets × ações) | `tests/security/test_tenant_isolation.py` | RLS no M1 (custo alto, BYPASS RLS chato em superadmin) — fica pra M3+ |
| Security | **MultiFernet rotation** (lista de chaves, decrypt fallback) | `apps/provedores/cripto.py` | rotação single-key com transação grande |
| Phase 3 | **Eval Harness** (replay offline com tempo congelado via freezegun) | `apps/alertas/eval/harness.py` | "ler logs no Sentry e tentar inferir" |
| Phase 3 | **Golden Dataset versionado** (20-50 casos rotulados/empresa, imutável) | `.planning/eval/golden/<empresa>/*.jsonl` | golden dataset gigante curado por ML — começa pequeno |
| Phase 3 | **3 camadas de teste por adapter** (unit / cassette com data / contract real semanal) | `apps/provedores/adapters/<nome>/tests/` | só cassettes — stale silently |
| Motor | **Subquery + OuterRef + in_bulk** (não prefetch_related, não DataLoader) | `apps/alertas/motor.py::_carregar_ultimas_leituras_*` | `functools.cache` em worker long-lived (vaza memória, ver `_CACHE_JANELA_ASTRAL`) |
| Motor | **Migration null=True em 2 deploys** (schema → código ingestão) | `apps/coleta/ingestao.py:152-155,252-254` | makemigrations + remover `or 0` no mesmo PR (mistura semânticas) |
| Motor | **`assertNumQueries` como regression guard** com 3 cenários (1/10/50 usinas) | `apps/alertas/tests/test_motor_performance.py` | otimizar sem baseline numérico antes/depois |
| Calibração | **Sugestão, nunca auto-aplicação** (P95 → badge na UI → admin aprova) | `apps/alertas/calibracao.py` + nova model `SugestaoCalibragem` | auto-tuning silencioso (fere filosofia "só informa") |
| Calibração | **Override por escopo correto** (Inversor → Usina → Empresa → default) | cascading já existe, reforçar em UI | mexer default global por 1 reclamação |
| UX | **Agrupamento intra-regra apenas** (preservar diversidade) | HARD-12 em `frontend/src/pages/alertas/` | agrupar por usina (esconde regras heterogêneas) |
| Observability | **Sentry tags por empresa + provedor** + scrub em `before_send` | `config/settings/base.py`, `apps/empresas/middleware.py` | enviar `credenciais_enc`/`cache_token_enc` pro Sentry (LGPD) |

---

## 5. Pitfalls mapeados por fase (top 3 cada)

### Audit (Phase 1)
1. **Audit produz 200 findings e ninguém triar** → `.banditrc`/`.semgrepignore` cedo (skipa migrations, tests, docs/amostras). Triagem dupla: classificar tudo (CRÍTICO/IMPORTANTE/RUÍDO/FP) antes de abrir código.
2. **Superadmin cross-tenant sem audit log** → novo `LogAcessoSuperadmin` + mixin `SuperadminAuditMixin`. Visível para admin da empresa (transparência LGPD).
3. **`git status` sujo (.pem, .mcp.json)** → adicionar ao `.gitignore` antes de qualquer outra ação; pre-commit gitleaks obrigatório.

### Security (Phase 2 + Phase 6)
1. **Rotação Fernet sem MultiFernet = downtime** → migrar `apps/provedores/cripto.py` PRIMEIRO; lista de chaves `[nova, antiga]`; remoção da antiga em deploy seguinte.
2. **`SECRET_KEY` default em prod** → audit confirma; quick-win do Phase 2.
3. **Push protection passa de novo** → gitleaks no pre-commit + trufflehog `--only-verified` no CI.

### Phase 3 — Adapter Validation + Harness
1. **Validação de adapter só com mock = falso senso de segurança** → 3 camadas obrigatórias (unit/cassette com `gravado_em`/contract real semanal). Cassettes com header de validade (3 meses).
2. **Race do `cache_token_enc`** (Hoymiles, FusionSolar) — 2 ciclos paralelos sobrescrevem token → row lock ou `transaction.atomic` no save do token.
3. **Stub `apps/provedores/tasks.py` removido com `PeriodicTask` legada apontando** → query `django_celery_beat_periodictask` na VPS ANTES de deletar.

### Motor (Phase 4)
1. **Migration null=True quebra histórico** → multi-step (schema → ingestão remove `or 0`). Documentar cutoff. Não fazer `SET NOT NULL`. Teste de regressão com leitura antiga (0) e nova (None).
2. **N+1 sem benchmark = regressão em outra query** → baseline com 3 cenários (1/10/50 usinas) em `docs/performance/motor-baseline-<data>.md`; índice composto `(usina, -coletado_em)` com `CREATE INDEX CONCURRENTLY` ANTES do refactor.
3. **Backfill de `Garantia` desbloqueia alertas legados em massa** → dry-run `avaliar_empresa(empresa_id, dry_run=True)` ANTES; escalonar por empresa ou marcar histórico como "já resolvido".

### Calibração + UX (Phase 5)
1. **Calibração por reclamação isolada gera over-fit global** → análise quantitativa antes (`SELECT regra, COUNT(*), AVG(EXTRACT(EPOCH FROM resolvido_em - aberto_em)) FROM alertas`); override no escopo correto; janela de 1 semana antes de fechar.
2. **Self-healing de Celery boot mascara bug real** → confirmar `CELERY_TASK_ACKS_LATE=True` aplicado ANTES; `logger.warning` em toda recuperação; alerta se >5x/ciclo.
3. **Agrupamento de alertas esconde diversidade** → agrupar só intra-regra; card mostra regra + contagem + distribuição de severidade; `frontend/src/pages/docs/DocsRegrasPage.tsx` documentada no mesmo PR.

### Transversal (todas as fases)
- **Esquecer `/docs` no PR** → checklist obrigatório (CLAUDE.md regra).
- **OOM no rebuild Vite** → swap permanente 2GB documentado em `docs/operacoes/setup-vps.md`.

---

## 6. Decisões já travadas (não reabrir no planejamento)

| Decisão | Confidência | Justificativa |
|---------|-------------|---------------|
| Manter stack atual (Django 5 + DRF + Celery + Postgres + Vite + React 19) | HIGH | Em produção dev funcionando; reescrita custaria muito |
| Shared schema + `EscopoEmpresa` (NÃO django-tenants) | HIGH | Volume previsto (dezenas) não justifica; RLS opcional fica para M3+ |
| 6 adapters separados (NÃO abstrair em "config-driven") | HIGH | Solis HMAC vs Hoymiles Argon2+protobuf são fundamentalmente diferentes |
| Tri-state nas regras + carência por coletas consecutivas (NÃO histerese clássica) | HIGH | Validado em produção; F12 reduziu FP comprovado |
| Defaults configuráveis por empresa/usina (cascata Inversor→Usina→Empresa→regra) | HIGH | F12 validou; CLAUDE.md documenta |
| Sentry SaaS free tier (NÃO self-hosted, NÃO Datadog) | HIGH (custo) | Self-hosted exige 4 serviços extras na VPS 1.9GB; Datadog é caro+lock-in |
| bandit + semgrep + pip-audit + gitleaks + trufflehog (NÃO Snyk, NÃO DefectDojo) | HIGH | Todos OSS, padrão de mercado 2026 |
| pvlib + NASA POWER (NÃO Solcast, NÃO SolarAnywhere) | HIGH | Grátis, suficiente para gating "tem irradiância ou não"; Solcast só se demanda real-time aparecer |
| Subquery+OuterRef nativo (NÃO DataLoader, NÃO views materializadas) | HIGH | Padrão já em `apps/core/dashboard.py`; consistência reduz risco |
| Sistema só informa, nunca remedia (sem auto-tuning, sem auto-remediação) | HIGH | Decisão estratégica fundadora; calibração sugere, humano aprova |
| Sentry com scrub de `credenciais_enc`/`cache_token_enc` em `before_send` | HIGH | LGPD; cláusula DPA com Sentry Inc aceita p/ stack traces+IDs |
| RLS PostgreSQL fica para M3+ (defense-in-depth) | HIGH | Custo de migração alto, BYPASS RLS chato em superadmin; M1 usa test matrix |
| Auto-aplicação de calibração: NUNCA | HIGH | Quebra filosofia "só informa"; threshold elétrico é decisão consciente |

---

## 7. Open questions (precisam decisão antes/durante planejamento)

| Questão | Por que importa | Resolver quando |
|---------|-----------------|-----------------|
| **HARD-11 MVP vs full** — começar com `pvlib.solarposition` (zero calls externas) ou já implementar NASA POWER + `IrradianciaDiaria`? | Define escopo de Phase 3. MVP economiza ~2 dias mas deixa HARD-11 parcial. | Antes do roadmapper definir Phase 3 |
| **Golden dataset: quem rotula?** | Sem operador comprometido, golden vira mock. | Antes de iniciar Phase 3 — possível: começar com 1 empresa "voluntária" |
| **Métrica de aceitação de churn <1h** — alvo é <5%? <10%? por regra ou agregado? | Define quando Phase 5 (calibração) está "completo". | Antes de Phase 5; idealmente no fim do audit |
| **Circuit breaker (Pattern 6)**: incluir no M1 ou deixar pra M2? | Já existe `precisa_atencao` para auth; expansão é incremental. | Decisão do roadmapper — recomendado adiar pra M2 (não bloqueia outras fases) |
| **Sentry tag de empresa: nome ou UUID?** | LGPD considera nome de empresa dado pessoal de PJ? Provavelmente não, mas UUID é mais seguro. | Implementação Phase 3 |
| **Frequência do contract test real** — semanal? diário? por commit? | Custa rate limit dos provedores; STACK.md propõe semanal. | Implementação Phase 3 |
| **Resolver alertas órfãos** — regra desativada com alerta aberto. UI já cobre? | Documentado em CLAUDE.md como decisão R2, mas pode ter gap em UX HARD-12. | Phase 5 (UX) |
| **VPS swap permanente** — escopo de M1 ou operacional separado? | OOM no rebuild Vite afeta deploy. | Resolver fora do M1 (operacional), referenciar em `docs/operacoes/` |

---

## 8. Backlog implications (M2-M7)

### M2 — Notificações funcionais (próximo após M1)
**Pré-requisitos herdados do M1:** Sentry funcionando, motor estável, Fernet rotacionada.
**Stack a adicionar:** `django-anymail[amazon-ses]==15.0.*` + `django-celery-email==3.0.*`. ESP: Postmark (DX) ou Amazon SES `sa-east-1` (custo). WhatsApp: Meta Cloud API direto (free até 1k conversas/mês), NÃO Twilio.
**Pitfalls antecipados:** SSRF em webhooks (validar URL contra `localhost`/IPs privados); janela de silêncio + digest evitam spam.
**Ordem:** worker email → webhook executor → config "quem recebe o quê" → WhatsApp Meta → janela silêncio → digest diário.

### M3 — Relatório PDF mensal + Performance Ratio
**Pré-requisitos:** M2 worker de email; HARD-11 NASA POWER completo; campo `tarifa_kwh` em `ConfiguracaoEmpresa`.
**Stack:** WeasyPrint ou Playwright headless para PDF; pvlib + pandas já no M1.
**Tese central BR:** SolarView monetiza isso explicitamente — maior alavanca comercial do produto no mercado brasileiro.

### M4 — Calibração automática avançada + degradação
**Pré-requisitos:** ≥1 ano de histórico + golden dataset maduro. Pode pular se ROI não justificar.

### M5 — Portal do cliente final + integrações
**Pré-requisitos:** novo papel `cliente_final` em `Usuario.papel`; vínculo 1:N Usuario↔Usina; restrição agressiva de queryset por usina. Possível subdomínio branded.

### M6 — App mobile PWA + Web Push
**Stack:** Service Worker + manifest + VAPID keys. NÃO nativo iOS/Android.

### M7 — Bilhetagem SaaS
**Pré-requisitos:** modelos `Plano`/`Assinatura`/`Fatura`; Pagar.me ou Asaas (BR); enforcement + conformidade fiscal BR (ISS, nota fiscal de serviço).

### Anti-features mantidos (não re-adicionar)
- Auto-remediação na rede elétrica; consumo de alarmes nativos; CRM de vendas; ROI/TIR/payback; SMS no BR; app nativo iOS/Android; multi-idioma; histerese clássica; ML pra predição de falha em M2-M4.

---

## 9. Confidence Assessment

| Área | Confidence | Notas |
|------|------------|-------|
| Stack (audit, observability, solar) | HIGH | Padrões de mercado 2026 confirmados; OSS bem mantido |
| Features (table stakes + diferenciadores BR) | HIGH | SolarView/SolarMarket/Solytic confirmam; mercado BR bem caracterizado |
| Architecture (Audit-first + Eval Harness + Tenancy Guards) | HIGH | Padrões maduros (Strangler Fig, alert fatigue SRE, OWASP Django) |
| Pitfalls (15 catalogados) | HIGH | Cruzam CONCERNS.md + indústria; F12 valida pitfall #4 |
| Sentry SaaS free tier | MEDIUM | Custo confirmado mas cota pode mudar; LGPD/DPA pendente |
| WhatsApp via Meta Cloud API (M2) | LOW | Mercado BR muda rápido |
| Golden dataset com operador | MEDIUM | Depende de buy-in organizacional |
| Métrica de aceitação de churn <1h | LOW | Não definida ainda |

### Gaps identificados (validar durante planejamento)
1. **Operador "voluntário" para golden dataset** — quem rotula 20-50 casos por empresa?
2. **Métrica concreta de "regra calibrada"** — alvo % FP, alvo de churn, alvo de "alertas/dia/empresa".
3. **Frequência aceitável de contract test real** — detecção precoce vs rate limit provedores chineses.
4. **Decisão de escopo HARD-11** — MVP solarposition vs full NASA POWER+IrradianciaDiaria (~2 dias).
5. **VPS swap permanente** — quem executa? Está fora do M1 mas é prereq.
