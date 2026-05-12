# Architecture Patterns — Milestone 1: Hardening

**Domain:** Brownfield Django/DRF SaaS multi-tenant em fase de hardening
**Researched:** 2026-05-12
**Mode:** Ecosystem (foco em padrões aplicáveis ao M1)

> **Premissa**: a arquitetura macro já está consolidada (multi-tenancy `EscopoEmpresa`, 6 adapters, motor Celery, motor tri-state, API REST com JWT). Este documento NÃO propõe substituir nada — propõe **reorganizar/reforçar** o que existe, adicionando 4 capacidades transversais que ainda faltam: **audit instrumentado**, **eval framework**, **isolation enforcement automatizado** e **calibração com feedback loop**.

## Recommended Architecture (overlay sobre o stack atual)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                          CAMADAS EXISTENTES (intocadas)                   │
│  Frontend SPA  ─────►  DRF /api/*  ─────►  Models (EscopoEmpresa)         │
│                                              │                            │
│                Celery beat ───► sincronizar_conta_provedor                 │
│                                              │                            │
│                              ingerir_ciclo (idempotente)                   │
│                                              │ on_commit                  │
│                                              ▼                            │
│                                   avaliar_empresa (motor)                  │
└──────────────────────────────────────────────────────────────────────────┘
                                  │   ▲                ▲
                                  │   │ assertions     │ baselines
                                  ▼   │                │
┌──────────────────────────────────────────────────────────────────────────┐
│                  NOVAS CAMADAS DO MILESTONE 1 (overlay)                   │
│                                                                            │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────┐  │
│  │ A. AUDIT LAYER   │   │ B. EVAL HARNESS  │   │ C. TENANCY GUARDS    │  │
│  │  (read-only)     │   │  (offline replay)│   │  (test-time + RT)    │  │
│  ├──────────────────┤   ├──────────────────┤   ├──────────────────────┤  │
│  │ • audit reports  │   │ • golden fixtures│   │ • pytest matrix de    │  │
│  │   em             │   │   (LeituraUsina/ │   │   cross-tenant leak   │  │
│  │   .planning/     │   │    Inversor      │   │ • assertQuerysetScope │  │
│  │   audit/         │   │    snapshots)    │   │   helper              │  │
│  │ • bandit/ruff    │   │ • run_offline_   │   │ • CI gate: nenhum     │  │
│  │   /pyupgrade     │   │   motor(empresa, │   │   ViewSet sem         │  │
│  │ • django-silk    │   │   janela)        │   │   EmpresaModelViewSet │  │
│  │   profiles       │   │ • baseline       │   │ • PostgreSQL RLS      │  │
│  │ • baseline       │   │   scoring        │   │   opcional (defense   │  │
│  │   scoring        │   │   (precision/    │   │   in depth)           │  │
│  │   (priorização)  │   │    recall)       │   │                       │  │
│  └────────┬─────────┘   └────────┬─────────┘   └──────────┬───────────┘  │
│           │ flags                │ scores                 │ violations    │
│           ▼                      ▼                        ▼              │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  D. CALIBRATION FEEDBACK LOOP (write para ConfiguracaoEmpresa)    │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │  • Alerta.churn_lt_1h métricas por empresa/regra                  │    │
│  │  • Sugestão de threshold (P95 das leituras) — humano aprova       │    │
│  │  • UI futura em /configuracao/regras com "sugerido"               │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Componentes (escopo do M1)

| Componente | Responsabilidade | Comunica com |
|------------|------------------|--------------|
| **A. Audit Layer** | Produzir relatório priorizado de débitos (segurança, perf, dívida). Não muta código nem dados. | Lê todo o código fonte; escreve em `.planning/audit/<data>/`. |
| **B. Eval Harness** | Re-rodar motor de alertas contra fixtures históricas; produzir score por regra (precision/recall, churn <1h). | Lê snapshots de `LeituraUsina`/`LeituraInversor`; instancia motor isolado; escreve scores em `.planning/eval/`. |
| **C. Tenancy Guards** | Garantir que toda query escopada filtra por `empresa_id` — em test-time (pytest matrix) e opcionalmente em runtime (RLS PG). | Lê todos os ViewSets e managers; falha CI quando detecta violação. |
| **D. Calibration Loop** | Ler distribuição real de leituras + churn de alertas; sugerir thresholds; humano aprova em `/configuracao/regras`. | Lê `LeituraUsina` agregadas + `Alerta` resolvidos; escreve sugestões em tabela nova `SugestaoCalibragem`. |
| **E. Resilience Layer** (opcional) | Circuit breaker em adapter por `ContaProvedor` quando provedor está derrubado por muito tempo. | Wrapping em `apps/coleta/tasks.py::_instanciar_adapter`; lê/escreve `ContaProvedor.precisa_atencao`. |

### Direção do data flow (estrita)

```text
Audit Layer:        Código       → Audit Report     → Lista priorizada de fixes
Eval Harness:       Histórico DB → Replay offline   → Score por regra/empresa
Tenancy Guards:     Test fixtures → Matrix de leak  → CI gate (bloqueia PR)
Calibration Loop:   DB agregado  → Sugestão        → UI humana aprova → ConfigEmpresa
Resilience:         Adapter erro → Circuit state   → Skip task → Alerta operacional
```

**Invariante de unidirecionalidade**: nenhum desses 5 componentes escreve em modelos de domínio sem aprovação humana. Audit produz markdown; Eval produz scores; Tenancy Guards quebram CI; Calibração propõe (não aplica). Resilience é o único que muta `ContaProvedor.precisa_atencao`, e isso já é comportamento existente em `apps/coleta/tasks.py:147-156`.

## Pattern 1: Audit-First Brownfield Hardening

**What:** Antes de corrigir, **mapear** o débito existente com ferramentas determinísticas + revisão humana, e produzir um único documento priorizado. Cada fix subsequente referencia o relatório.

**Why for M1:** o `CONCERNS.md` já é metade desse mapa — bem feito, mas heterogêneo (alguns itens com `files`, outros com `severity`, outros narrativos). M1 começa em HARD-01/HARD-02 com **auditoria sistemática** que normaliza isso, adiciona dimensões faltantes (test coverage real medido, complexidade ciclomática, latência por endpoint) e produz uma lista numerada que vira backlog do milestone.

**When:** Phase 1 do M1 (fundação para tudo). Os fixes só começam em Phase 2.

**Toolchain recomendada** (Python + Django):

| Dimensão | Ferramenta | O que mede | Output |
|----------|-----------|------------|--------|
| Segurança estática | `bandit` (CWE), `pip-audit` (CVE em deps), `gitleaks` (segredos no histórico) | Padrões inseguros, deps vulneráveis, credenciais em git | SARIF + markdown |
| Lint/estilo | `ruff` (já em uso) | Detritos, complexidade, naming | Já integrado |
| Type coverage | `mypy --strict` ou `pyright` em modo report | % do código com tipos completos | Score por módulo |
| Test coverage | `coverage.py` + `pytest --cov` | Linhas/branches cobertos | XML + badge |
| Performance | `django-silk` (em dev), `django-debug-toolbar` | Queries por endpoint, N+1, latência | Profile sessions |
| Schema drift | `python manage.py makemigrations --check` no CI | Migrations não commitadas | Boolean gate |
| Multi-tenant lint | grep estruturado por `objects.filter(`/`objects.get(` sem `da_empresa`/`empresa=` (custom AST script) | Quem ignora o mixin | Lista de violations |
| Frontend lint | `eslint`, `tsc --noEmit`, `vite-bundle-visualizer` | Erros TS, peso do bundle | Reports |

**Baseline scoring**: cada item do audit recebe `(severidade, esforço, blast_radius)` numa escala 1-3. Score = severidade × blast_radius / esforço. Top-N viram tarefas das fases seguintes do M1. Modelo prático: ordem do M1 = ordem decrescente de score, com agrupamento por área (segurança junta, perf junta).

**Implicação de ordem de build**: TUDO no M1 que faz alteração depende de Phase 1 (audit). Sem o report, fixes viram tiro no escuro e podem entrar em conflito com a calibração futura.

**Anti-pattern**: "vamos consertando enquanto fazemos as features" — gera churn de PR + retrabalho. M1 inteiro é hardening explícito.

## Pattern 2: Eval Harness para Regras de Alerta (replay offline)

**What:** Um harness que recebe `(empresa_id, janela_temporal)`, recria o estado de `LeituraUsina`/`LeituraInversor` daquela janela, roda o motor em modo "dry-run" (não persiste `Alerta`), e produz um relatório `{regra → contagem de Anomalia/False/None, churn <1h, precision contra golden}`.

**Why for M1:** HARD-03 ("validação de alertas") sem harness vira leitura manual de logs — improdutiva e não reproduzível. Sistema antigo tinha 12.8% churn <1h. Sem mecanismo de medir, o time não sabe se as calibrações F12 reduziram esse número ou apenas mudaram a forma do problema.

**Estrutura (Django nativo, sem nova dependência)**:

```python
# apps/alertas/eval/harness.py (novo)
def replay_motor(
    empresa_id: UUID,
    inicio: datetime,
    fim: datetime,
    regras_subset: list[str] | None = None,
    dry_run: bool = True,
) -> ReplayReport:
    """
    Re-roda o motor contra leituras históricas, sem persistir Alerta.
    Retorna por-regra: anomalies, falses, nones, churn_lt_1h, top_contextos.
    """
```

**Golden dataset** (manual, pequeno, alto sinal): `.planning/eval/golden/<empresa>/<periodo>.jsonl` com casos rotulados pelo operador:
- "Em 2026-04-15 10h, usina X estava de fato em sobretensão" (verdadeiro positivo esperado)
- "Em 2026-04-22 18h, queda às 18h é fim de tarde, não anomalia" (verdadeiro negativo esperado)
- 20-50 casos por empresa, curados manualmente, são suficientes para começar.

**Scoring**:
- **Precision por regra** = `TP / (TP + FP)` contra golden
- **Recall por regra** = `TP / (TP + FN)`
- **Churn <1h por regra** = `% alertas com (resolvido_em - aberto_em) < 1h` em dados reais
- **Distribuição de severidade** por empresa
- **Anomalias agregadas** (regras com `agregar_por_usina=True`) — confirmar que não está abrindo 1 por inversor

**Patterns canônicos** (vindos do mundo de eval de modelos):
1. **Snapshot inputs, version outputs**: fixture é imutável; rodar a v1 do motor + v2 do motor contra o mesmo snapshot e diff dos relatórios mostra o efeito de uma mudança de regra/threshold.
2. **Slice por empresa**: cada empresa tem rede diferente (BT/AT, fabricantes mistos). Score agregado esconde isso; segmentar por `empresa_id`.
3. **Replay com tempo congelado**: usar `freezegun` ou `mock_now()` para que regras que dependem de "agora" (`sem_comunicacao`, `garantia_vencendo`) avaliem como se o ciclo fosse no `medido_em` do snapshot.
4. **Histórico de scores**: cada run do harness escreve em `eval/runs/<timestamp>.json` — comparação ao longo do M1 documenta o progresso.

**Component boundary**: o harness vive em `apps/alertas/eval/`, importa `motor` e `regras`, mas **não** importa nada de `apps/coleta` (não puxa adapter, não fala com provedor). Dependência única: leituras já no DB. Inversão limpa para evitar acoplamento.

**Implicação de ordem**: Phase 2 do M1 (validação) depende deste harness. Construir o harness antes de tentar julgar se HARD-09 / HARD-10 / HARD-11 foram resolvidos.

## Pattern 3: Eliminar N+1 no Motor — Bulk Evaluation com Preload

**What:** Substituir `_ultima_leitura_usina(usina)` (1 query por chamada) por `_carregar_ultimas_leituras(empresa)` (2 queries totais, retorna `dict[usina_id, LeituraUsina]` e `dict[inversor_id, LeituraInversor]`). Regras recebem o dict como parte do `config`/contexto, em vez de chamarem helpers que disparam query.

**Why for M1:** HARD-06 documenta ~1.5k queries por ciclo do motor (267 usinas + 659 inversores cada uma fazendo `order_by(-coletado_em).first()`). Tolerável hoje, blocker em 5×.

**Padrão SQL**: `Subquery(OuterRef("pk"))` em `LeituraUsina` filtrando pela usina pai e ordenado descrescente. Já é o padrão usado em `apps/core/dashboard.py:53-62` — replicar.

```python
# apps/alertas/motor.py (refactor)
def _carregar_ultimas_leituras_usinas(empresa_id: UUID) -> dict[UUID, LeituraUsina]:
    ultima = LeituraUsina.objects.filter(
        usina=OuterRef("pk"),
        usina__empresa_id=empresa_id,
    ).order_by("-coletado_em")
    usinas = Usina.objects.filter(
        empresa_id=empresa_id, is_active=True
    ).annotate(
        ultima_leitura_id=Subquery(ultima.values("id")[:1])
    )
    leituras = LeituraUsina.objects.in_bulk(
        usinas.values_list("ultima_leitura_id", flat=True)
    )
    return {u.id: leituras.get(u.ultima_leitura_id) for u in usinas}
```

**Resultado esperado**: 1.5k queries → ~4 queries (2 para usinas, 2 para inversores). Validar com `django.test.utils.CaptureQueriesContext` em teste de regressão.

**Patterns relacionados a evitar**:
- **N+1 disfarçada de "DataLoader"**: alguns blog posts vendem o padrão DataLoader de GraphQL para Django. Para volume atual (centenas a baixos milhares de objetos), o `Subquery`+`in_bulk` nativo já basta. DataLoader (com cache request-scoped) só compensa em GraphQL onde múltiplos resolvers pedem o mesmo dado.
- **Window functions em Python**: `FIRST_VALUE(...) OVER (PARTITION BY usina_id ORDER BY coletado_em DESC)` é uma alternativa SQL elegante. Vale para o dashboard `geracao_horaria` (HARD documentado em CONCERNS), não tanto pro motor (onde `Subquery` + dict é mais legível).
- **Cache em memória sem invalidação**: tentação de usar `functools.cache` no motor. NÃO fazer — o motor é executado por worker Celery long-lived; o cache cresce sem teto (já há precedente em `_CACHE_JANELA_ASTRAL` listado em CONCERNS).

**Implicação de ordem**: vem depois da Phase 1 (audit) — o audit pode revelar outros N+1 não documentados (ex.: dashboards). Fazer todos de uma vez é mais eficiente que iteração.

## Pattern 4: Tenant Isolation Guards em CI

**What:** Bateria de testes pytest que, para cada ViewSet escopado, **cria 2 empresas**, autentica como user da empresa A e tenta atacar recursos da empresa B (list, retrieve, update, delete). Falha se qualquer rota retornar 200/204.

**Why for M1:** `EmpresaModelViewSet` é a defesa primária, mas é manual — uma view nova que esqueça de herdar dele vaza silenciosamente. `apps/empresas/` não tem testes de middleware (gap listado em CONCERNS). HARD-02 (security review) exige cobertura sistemática, não pontual.

**Patterns conhecidos**:

### 4.1 Test matrix automatizada

```python
# tests/security/test_tenant_isolation.py (novo)
@pytest.mark.parametrize("viewset", _todos_viewsets_escopados())
@pytest.mark.parametrize("acao", ["list", "retrieve", "update", "delete"])
def test_cross_tenant_blocked(viewset, acao, empresa_a, empresa_b, ...):
    # cria objeto na empresa_b
    # autentica como user da empresa_a
    # tenta executar acao
    # assert 404 (não 403 — 403 confirma existência)
```

Discovery dos viewsets via introspect do URL conf. Esse padrão é robusto contra adição de novas views sem teste.

### 4.2 Helper `assertQuerysetScoped`

Pattern simples: helper que captura SQL emitido pelo ViewSet e verifica que `WHERE empresa_id = ...` está presente. Usar `django.test.utils.CaptureQueriesContext` + regex sobre SQL.

### 4.3 PostgreSQL Row-Level Security (RLS) como defense-in-depth (opcional)

Plus avançado — define policy no PG:
```sql
ALTER TABLE coleta_logcoleta ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON coleta_logcoleta
  USING (empresa_id = current_setting('app.current_empresa')::uuid);
```
Middleware faz `SET LOCAL app.current_empresa = '<uuid>'` por request. Mesmo bug em código não vaza — PG bloqueia.

**Para o M1, decisão recomendada**: NÃO adotar RLS no M1 (custo de migração alto, todas as queries de superadmin precisam de `BYPASS RLS`). Adotar 4.1 + 4.2 (puro pytest), e listar RLS como roadmap M2/M3 se vier auditoria externa exigindo.

### 4.4 Lint customizado para `objects.filter(`

Script `ruff`/AST que falha CI quando alguma view chama `Model.objects.filter(...)` direto em modelo escopado, em vez de `.da_empresa(...)`. Whitelist explícita (`apps/superadmin/*`, management commands).

**Component boundary**: tudo em `tests/security/` (sem código em `apps/`). Sem dependência reversa do código de produção para os testes.

**Implicação de ordem**: rodar essa bateria em Phase 1 (audit) — captura o baseline de violations existentes; o relatório do audit já chega com a lista. Fixes virem em Phase 2/3.

## Pattern 5: Calibração Contínua de Regras (feedback loop)

**What:** Métricas operacionais (churn <1h, alertas por dia por empresa, distribuição de leituras nos thresholds) viram **sugestões de calibração** apresentadas na UI `/configuracao/regras`. Humano (admin da empresa) aprova ou descarta. Sistema não muta thresholds automaticamente.

**Why for M1:** F12 já mostrou que cada empresa tem ruído diferente. Calibrações foram aplicadas globalmente (defaults), mas o produto exige overrides por empresa. Sem feedback loop, o operador descobre os limites ideais por tentativa e erro.

**Padrão (vindo de SRE / alert fatigue)**:

| Etapa | O que fazer | Onde |
|-------|-------------|------|
| Coletar | Para cada `(empresa, regra)`: P50/P95/P99 da grandeza monitorada (tensão, freq, temp) nos últimos 30 dias | Task Celery diária, escreve em `apps/alertas/models.py::SugestaoCalibragem` (nova) |
| Comparar | Threshold atual vs P95 real | Mesma task |
| Sugerir | "Threshold 242V está no P30 das tuas leituras — sugerimos 246V (P95)" | UI em `/configuracao/regras` (badge) |
| Aprovar | Admin clica "aplicar" → atualiza `ConfiguracaoEmpresa.*` | Endpoint REST |
| Auditar | Mudança fica em `LogConfiguracao` (nova model simples) | Histórico visível |

**Anti-pattern crítico**: NUNCA auto-aplicar sugestões. Em segurança elétrica, threshold é decisão consciente do operador. Sistema só informa; só humano calibra. Coerente com a filosofia do produto ("sistema informa, nunca remedia").

**Métricas de qualidade da calibração** (rodar no eval harness):
- **Churn <1h por regra** antes e depois da calibração → meta operacional do M1 (<5%?)
- **Alertas/dia/empresa** → meta de "não inundar" (definir junto com operador)
- **Coverage** (regras desativadas) → ideal: poucas regras desativadas, muitas com threshold ajustado

**Component boundary**:
- `apps/alertas/calibracao.py` (novo, agregação SQL)
- `apps/alertas/models.py::SugestaoCalibragem` (nova tabela: `regra_nome`, `campo`, `valor_atual`, `valor_sugerido`, `evidencia` JSON, `criada_em`, `aplicada_em`, `descartada_em`)
- UI em `frontend/src/pages/configuracao/RegrasPage.tsx` (existente — adiciona seção)

**Implicação de ordem**: depende de Phase 2 (eval harness — pra ter as métricas) e Phase 3 (correção de N+1 — pra agregação SQL ser viável). É Phase 4 do M1.

## Pattern 6: Circuit Breaker para Adapters (opcional)

**What:** Quando um `ContaProvedor` falha N vezes seguidas com `ErroProvedor` (não auth, não rate limit), entrar em **estado open**: skip do task ciclo, marcar `precisa_atencao=True`, manter por T minutos, depois half-open (1 tentativa-canário). Hoje o retry com backoff existe (`autoretry_for`, `retry_backoff_max=3600`), mas não há circuit breaker — uma usina/conta down faz o worker queimar retries 3x cada ciclo durante horas.

**Why for M1 (opcional):** decisão de produto. Se já existe `precisa_atencao` sendo setada em `ErroAutenticacaoProvedor`, ampliar para outros tipos é incremental. Pesar contra "podemos esperar M2".

**Library**: `pybreaker` (madura, sync, sem dependência de event loop). Wrapping em `apps/coleta/tasks.py::_instanciar_adapter` ou no chamador da task.

```python
# apps/coleta/circuit_breaker.py (novo, opcional)
from pybreaker import CircuitBreaker
_breakers: dict[UUID, CircuitBreaker] = {}

def get_breaker(conta_id: UUID) -> CircuitBreaker:
    if conta_id not in _breakers:
        _breakers[conta_id] = CircuitBreaker(
            fail_max=5, reset_timeout=600  # 10min
        )
    return _breakers[conta_id]
```

**Anti-pattern**: estado do breaker em memória do worker. Em produção com >1 worker, cada um tem seu estado isolado — o breaker abre/fecha de forma inconsistente. Solução: persistir em `ContaProvedor.estado_circuito` + `circuito_aberto_ate`. Pior caso: estado vive no Redis (mas adiciona acoplamento). Para o volume atual (1 worker, --concurrency=2 conforme CONCERNS), memória vale; para crescer, persistir.

**Implicação de ordem**: Phase 5 ou jogado pra M2. NÃO bloqueia outras fases.

## Phase Ordering (sugestão para o roadmap)

```text
Phase 1: AUDIT (foundation)
  ↓ produz: relatório priorizado, golden dataset inicial, violations de tenancy
Phase 2: VALIDATION (Eval harness + provider validation)
  ↓ produz: scoring base, regras validadas contra dados reais
Phase 3: CRITICAL FIXES (segurança + null + LogColeta + boot self-healing)
  ↓ produz: itens de severidade alta do audit fechados
Phase 4: PERFORMANCE (N+1, dashboard, queries pesadas)
  ↓ produz: motor com 4 queries em vez de 1.5k, dashboards <500ms
Phase 5: CALIBRATION & UX (feedback loop + UI alertas + irradiação NASA)
  ↓ produz: sugestões por empresa, agrupamento de alertas, lat/lon driven
[Phase 6 opcional: RESILIENCE — circuit breaker se decidir incluir]
```

**Dependências críticas**:
- Phase 1 produz o **input** para todas as outras (sem audit, fix vira hipótese)
- Phase 2 produz o **measurement** (sem eval, calibração é palpite)
- Phase 3 desbloqueia Phase 4 (N+1 não pode ser otimizada com violação do null misturada)
- Phase 5 depende de 1+2+4 (precisa do audit, do harness e do motor performático)

**Pontos onde acumular evidência** (artefatos que sobrevivem ao milestone):
- `.planning/audit/<data>/REPORT.md` — referência permanente do baseline
- `.planning/eval/golden/<empresa>/` — golden dataset versionado (cresce com o tempo)
- `.planning/eval/runs/<timestamp>.json` — histórico de runs do harness
- `tests/security/` — bateria viva, roda em CI a cada PR
- `apps/alertas/models.py::SugestaoCalibragem` — histórico de sugestões em produção

## Anti-Patterns to Avoid (específicos do M1)

### 1. "Big-bang refactor" do motor de alertas
**What:** Reescrever `motor.py` inteiro para resolver N+1 + suporte a calibração + métricas, tudo num PR.
**Why bad:** Quebra a regra do tri-state acidentalmente; rollback impossível; testes não cobrem todas as combinações novas.
**Instead:** PR isolados — primeiro N+1 (mesma semântica, melhor SQL); depois métricas (read-only); depois calibração (nova UI/endpoint). Cada PR com teste de regressão usando o harness do Phase 2.

### 2. Substituir `EscopoEmpresa` por `django-tenants` schema-per-tenant
**What:** Migrar pra schema-per-tenant para "garantir" isolation.
**Why bad:** Reescrever todas as queries, todos os ViewSets, perder o queryset cross-tenant de superadmin, complicar backups. Volume atual (poucas dezenas de empresas) não justifica. Decision já registrada em PROJECT.md ("Key Decisions").
**Instead:** Reforçar o shared-schema existente com Pattern 4 (Tenant Isolation Guards) + RLS opcional para defense-in-depth no M3+.

### 3. Auto-tuning de thresholds
**What:** Algoritmo que, a partir do P95 das leituras, atualiza `ConfiguracaoEmpresa.*` automaticamente.
**Why bad:** Sistema deixa de ser determinístico do ponto de vista do operador; alerta crítico de tensão pode silenciar sozinho porque "P95 mudou". Quebra a filosofia "sistema só informa".
**Instead:** Sempre sugerir, nunca aplicar. UI com badge "sugerido — aplicar?".

### 4. Substituir 6 adapters por um adapter genérico
**What:** Tentar abstrair as 6 implementações em um único adapter "config-driven".
**Why bad:** Cada provedor tem auth, paginação, encoding e erros muito diferentes. Solis HMAC vs Hoymiles Argon2-nonce + protobuf são fundamentalmente diferentes. Custo > benefício, e CLAUDE.md já documenta padrão maduro pra adicionar provedor novo.
**Instead:** Aceitar a duplicação. O `BaseAdapter` + `unidades.py` + registry já é a abstração certa.

### 5. Cobrir tudo com testes E2E (frontend Playwright)
**What:** Phase de testes que tenta cobrir todos os fluxos frontend com Playwright.
**Why bad:** E2E é caro de manter; cobrir 100% gera flakiness e CI lento. CONCERNS diz "considerar pelo menos smoke tests com Playwright/Vitest nos fluxos críticos".
**Instead:** 3-5 smokes (login, ver dashboard, abrir alerta, configurar regra) + Vitest para componentes críticos. Resto fica para M2+.

## Scalability Considerations (escopo M1)

| Concern | Hoje (6 empresas, 267 usinas) | M1 alvo | Crescimento M2-M3 (50 empresas, 2k usinas) |
|---------|-------------------------------|---------|-------------------------------------------|
| Motor por ciclo | ~1.5k queries / segundos | ~4 queries / <1s | Mesma estratégia, lock por empresa pra paralelizar |
| Dashboard `geracao_horaria` | aceitável (poucos segundos) | aceitável | window function em SQL puro |
| Boot do worker | tasks perdidas (1h de atraso) | self-healing implementado | self-healing testado em CI |
| RAM da VPS | 1.9GB, OOM em deploy | swap permanente 2GB | dedicar instância de build separada |
| Crescimento de `Alerta`/`LogColeta` | crescem sem teto | adicionar retenção de logs (90d) | particionamento por mês |

## Sources

- [The pros and cons of the Strangler architecture pattern (Red Hat)](https://www.redhat.com/en/blog/pros-and-cons-strangler-architecture-pattern) — observability como pré-requisito de qualquer refactor brownfield
- [Strangler fig pattern (Thoughtworks)](https://www.thoughtworks.com/en-us/insights/articles/embracing-strangler-fig-pattern-legacy-modernization-part-three) — instrumentar o legado antes de mover
- [Django Security OWASP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Django_Security_Cheat_Sheet.html) — checklist canônico de audit Django
- [Django REST Framework Cheat Sheet (OWASP)](https://cheatsheetseries.owasp.org/cheatsheets/Django_REST_Framework_Cheat_Sheet.html) — DRF security baseline
- [Django Security Audit Checklist (Fusionbox)](https://www.fusionbox.com/blog/detail/a-simple-checklist-for-a-django-security-code-audit/647/) — checklist prático para hardening
- [Secure Multi-Tenancy in SaaS (DZone)](https://dzone.com/articles/secure-multi-tenancy-saas-developer-checklist) — patterns de isolation enforcement
- [Django Subquery and OuterRef Mastery (Stanza)](https://www.stanza.dev/courses/django-orm-mastery/aggregation-annotation/django-orm-mastery-subquery-outerref) — pattern canônico do Subquery+OuterRef para N+1
- [Complex Django filters with Subquery (Better Simple)](https://www.better-simple.com/django/2025/01/01/complex-django-filters-with-subquery/) — exemplo aplicado
- [PyBreaker (PyPI)](https://pypi.org/project/pybreaker/) — circuit breaker maduro Python (decisão: opcional no M1)
- [circuitbreaker (PyPI)](https://pypi.org/project/circuitbreaker/) — alternativa mais leve
- [Implementing Circuit Breaker for Resilient API Calls](https://www.johal.in/implementing-circuit-breaker-pattern-for-resilient-api-calls-in-python/) — fundamentos
- [Golden Datasets for Reliable AI Evaluation](https://www.getmaxim.ai/articles/building-a-golden-dataset-for-ai-evaluation-a-step-by-step-guide/) — versionado, curado manualmente, fonte da verdade
- [Golden datasets: Creating evaluation standards (Statsig)](https://www.statsig.com/perspectives/golden-datasets-evaluation-standards) — princípios aplicáveis fora de ML
- [Alert fatigue solutions for DevOps teams (incident.io)](https://incident.io/blog/alert-fatigue-solutions-for-dev-ops-teams-in-2025-what-works) — calibração contínua baseada em P95
- [Alert Fatigue in SRE and DevOps (Sensu)](https://sensu.io/blog/alert-fatigue-in-sre-and-devops) — feedback loop como mecanismo primário
- [Why PostgreSQL RLS Is the Right Approach to Django Multitenancy (DEV)](https://dev.to/dvoraj75/why-postgresql-row-level-security-is-the-right-approach-to-django-multitenancy-3e1m) — defense-in-depth (decisão: deixar para roadmap futuro)
- [Building a Multi-tenant App with Django (TestDriven.io)](https://testdriven.io/blog/django-multi-tenant/) — comparação shared schema vs schema-per-tenant
- [Testing API Security on Django DRF (OWASP guide)](https://wawaziphil.medium.com/testing-api-security-on-a-django-drf-backend-a-comprehensive-guide-following-owasp-guidelines-ccc5be18ee13) — testes automatizados de OWASP top10
- [Django Database Access Optimization](https://docs.djangoproject.com/en/4.1/ref/models/expressions/) — referência oficial para Subquery/Window

---

*Architecture research: 2026-05-12*
