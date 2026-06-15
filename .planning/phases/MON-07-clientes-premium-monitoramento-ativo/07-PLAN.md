---
phase: 07-clientes-premium
plan: 01
type: execute
wave: 1
depends_on: []
status: done
retroactive: true
autonomous: true
requirements: [PREM-01, PREM-02, PREM-03, PREM-04, PREM-05, PREM-06]
files_modified:
  # Backend — model/CRUD MonitoramentoAtivo (PREM-01)
  - backend/apps/monitoramento_ativo/models.py
  - backend/apps/monitoramento_ativo/serializers.py
  - backend/apps/monitoramento_ativo/views.py
  - backend/apps/monitoramento_ativo/urls.py
  - backend/apps/monitoramento_ativo/apps.py
  - backend/apps/monitoramento_ativo/migrations/0001_initial.py
  - backend/apps/monitoramento_ativo/migrations/0002_alter_monitoramentoativo_meses.py
  - backend/config/urls.py
  - backend/config/settings/base.py
  # Backend — gate do motor (PREM-02)
  - backend/apps/alertas/motor.py
  # Backend — flag premium em Alerta + filtro/tela (PREM-03)
  - backend/apps/alertas/models.py
  - backend/apps/alertas/views.py
  - backend/apps/alertas/serializers.py
  # Backend — regra de vencimento + limites configuráveis (PREM-04)
  - backend/apps/alertas/regras/monitoramento_premium_vencendo.py
  - backend/apps/core/models.py
  - backend/apps/core/serializers.py
  - backend/apps/core/migrations/0007_configuracaoempresa_monitoramento_premium_aviso_dias_and_more.py
  # Backend — anti-IDOR pré-existente (code review)
  - backend/apps/garantia/serializers.py
  # Frontend — CRUD + tela premium + configurações (PREM-03, PREM-05)
  - frontend/src/types/monitoramento-ativo.ts
  - frontend/src/types/alertas.ts
  - frontend/src/lib/types.ts
  - frontend/src/hooks/use-monitoramento-ativo.ts
  - frontend/src/hooks/use-alertas.ts
  - frontend/src/hooks/use-alertas-stats.ts
  - frontend/src/pages/monitoramento-ativo/MonitoramentoAtivoPage.tsx
  - frontend/src/components/monitoramento-ativo/MonitoramentoAtivoFormDialog.tsx
  - frontend/src/pages/alertas/AlertasPage.tsx
  - frontend/src/pages/alertas/AlertasPremiumPage.tsx
  - frontend/src/pages/configuracoes/ConfiguracoesPage.tsx
  - frontend/src/components/trylab/Sidebar.tsx
  - frontend/src/routes/router.tsx
  # Docs do produto (PREM-05)
  - frontend/src/pages/docs/DocsPremiumPage.tsx
  - frontend/src/pages/docs/DocsComoFuncionaPage.tsx
  - frontend/src/pages/docs/DocsRegrasPage.tsx
  - frontend/src/pages/docs/DocsConfiguracoesPage.tsx
  - frontend/src/pages/docs/DocsHomePage.tsx
  - frontend/src/components/docs/docs-data.ts
  # Testes (PREM-06)
  - backend/apps/monitoramento_ativo/tests/test_model.py
  - backend/apps/monitoramento_ativo/tests/test_serializer_escopo.py
  - backend/apps/alertas/tests/test_motor_gate_premium.py
  - backend/apps/alertas/tests/test_monitoramento_premium_vencendo.py
  - backend/apps/core/tests/test_configuracoes_api.py

must_haves:
  truths:
    # SC-1 — CRUD MonitoramentoAtivo escopado por empresa (anti-IDOR)
    - "Admin pode criar/editar/listar contrato de monitoramento ativo (1:1 com Usina) escopado à sua empresa"
    - "Admin da empresa A NÃO consegue criar contrato em usina da empresa B (POST/PATCH com usina de outro tenant rejeitado)"
    - "fim_em é persistido a partir de inicio_em + meses (não property)"
    # SC-2 — gate do motor garantia OU premium
    - "Motor avalia usina com garantia ativa OU monitoramento ativo vigente; sem nenhum dos dois, coleta mas não gera alerta"
    - "Comportamento da garantia preservado: garantia_vencendo retorna None quando não há garantia"
    # SC-3 — flag premium + tela /alertas-premium
    - "Alerta expõe premium (derivado via Exists, sem N+1); GET /api/alertas/?premium=true filtra premium"
    - "Existe rota /alertas-premium e badge 'Premium' na lista geral de alertas"
    # SC-4 — regra diária de vencimento + limites
    - "Regra diária monitoramento_premium_vencendo dispara INFO ≤30d / AVISO ≤7d"
    - "ConfiguracaoEmpresa tem monitoramento_premium_aviso_dias/_critico_dias, validados (critico < aviso) no backend"
    # SC-5 — docs do produto
    - "Doc /docs/premium criada e registrada na sidebar; DocsComoFunciona/DocsRegras/DocsConfiguracoes e a tela de Configurações refletem garantia OU premium"
    # SC-6 — testes verdes + review resolvido
    - "Suíte backend verde (216 passed) e 07-REVIEW.md com findings resolvidos (1 BLOCKER IDOR + warnings)"
  artifacts:
    - path: "backend/apps/monitoramento_ativo/models.py"
      provides: "Model MonitoramentoAtivo (1:1 Usina, fim_em persistido, clean() anti-IDOR, MinValueValidator(1))"
      contains: "class MonitoramentoAtivo"
    - path: "backend/apps/monitoramento_ativo/serializers.py"
      provides: "validate_usina escopado à empresa do request (anti-IDOR CR-01)"
      contains: "def validate_usina"
    - path: "backend/apps/monitoramento_ativo/views.py"
      provides: "MonitoramentoAtivoViewSet (EmpresaModelViewSet) + filtro status/provedor"
      contains: "class MonitoramentoAtivoViewSet"
    - path: "backend/apps/alertas/motor.py"
      provides: "_usina_monitorada (garantia OU premium) + REGRAS_DIARIAS"
      contains: "_usina_monitorada"
    - path: "backend/apps/alertas/models.py"
      provides: "AlertaQuerySet.com_premium (Exists) + Alerta.premium"
      contains: "def com_premium"
    - path: "backend/apps/alertas/regras/monitoramento_premium_vencendo.py"
      provides: "Regra diária INFO/AVISO, severidade_dinamica=True"
      contains: "class MonitoramentoPremiumVencendo"
    - path: "backend/apps/core/models.py"
      provides: "Campos monitoramento_premium_aviso_dias / _critico_dias"
      contains: "monitoramento_premium_aviso_dias"
    - path: "backend/apps/core/serializers.py"
      provides: "validate() exigindo critico < aviso (premium e garantia)"
      contains: "def validate"
    - path: "frontend/src/pages/alertas/AlertasPremiumPage.tsx"
      provides: "Tela /alertas-premium reusando AlertasPage via prop premium"
    - path: "frontend/src/pages/monitoramento-ativo/MonitoramentoAtivoPage.tsx"
      provides: "Página CRUD de contratos premium"
    - path: "frontend/src/pages/docs/DocsPremiumPage.tsx"
      provides: "Doc /docs/premium do produto"
  key_links:
    - from: "backend/apps/alertas/motor.py"
      to: "usina.monitoramento_ativo"
      via: "select_related + getattr no gate _usina_monitorada"
      pattern: "monitoramento_ativo"
    - from: "backend/apps/alertas/views.py"
      to: "AlertaQuerySet.com_premium"
      via: ".com_premium() no queryset + BooleanFilter(_premium_anotado)"
      pattern: "com_premium|_premium_anotado"
    - from: "backend/apps/monitoramento_ativo/serializers.py"
      to: "empresa_do_request"
      via: "validate_usina compara usina.empresa_id com empresa do request"
      pattern: "empresa_do_request"
    - from: "frontend/src/routes/router.tsx"
      to: "AlertasPremiumPage / MonitoramentoAtivoPage"
      via: "rotas /alertas-premium e /monitoramento-ativo"
      pattern: "alertas-premium|monitoramento-ativo"
---

<objective>
RETROATIVO — documenta a Phase 7 (Clientes Premium / Monitoramento Ativo) que JÁ FOI
implementada, testada (216 testes backend verdes, build frontend verde) e revisada
(07-REVIEW.md status=resolved). Não há código novo a escrever.

Feature aditiva: adiciona um segundo tipo de contrato por usina — monitoramento ativo
(cliente premium) — independente da garantia. O motor passa a monitorar usina com
garantia ativa OU premium vigente; alertas de usinas premium são marcados (`premium`),
ganham tela dedicada `/alertas-premium`, e uma regra diária avisa o vencimento do contrato.

Purpose: servir de régua de verificação goal-backward — `/gsd:execute-phase` em modo
validação confirma que cada task já está satisfeita pelos arquivos reais; o verify
checa os 6 success criteria do ROADMAP.
Output: nenhum artefato novo (todos já existem); este plano cataloga os artefatos reais.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md

NOTA: este plano é retroativo. Todas as tasks estão `<status>done</status>`.
O executor NÃO deve reimplementar — apenas confirmar que os arquivos referenciados
existem e satisfazem os `<verify>`. Qualquer divergência vira finding, não reescrita.
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/MON-07-clientes-premium-monitoramento-ativo/07-CONTEXT.md
@.planning/phases/MON-07-clientes-premium-monitoramento-ativo/07-REVIEW.md
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1 (SC-1): Model + CRUD MonitoramentoAtivo escopado por empresa (anti-IDOR) [PREM-01]</name>
  <status>done</status>
  <files>backend/apps/monitoramento_ativo/models.py, backend/apps/monitoramento_ativo/serializers.py, backend/apps/monitoramento_ativo/views.py, backend/apps/monitoramento_ativo/urls.py, backend/apps/monitoramento_ativo/apps.py, backend/apps/monitoramento_ativo/migrations/0001_initial.py, backend/apps/monitoramento_ativo/migrations/0002_alter_monitoramentoativo_meses.py, backend/config/urls.py, backend/config/settings/base.py, backend/apps/garantia/serializers.py</files>
  <action>
    Implementado o app `apps.monitoramento_ativo` espelhando `apps.garantia` (D-05, D-06).
    Model `MonitoramentoAtivo(EscopoEmpresa)`: `usina = OneToOneField(Usina, related_name="monitoramento_ativo")`,
    `inicio_em`, `meses = PositiveIntegerField(validators=[MinValueValidator(1)])` (WR-01),
    `fim_em = DateField(editable=False)` PERSISTIDO (D-07) via `save()` que recalcula de
    `_somar_meses(inicio_em, meses)` apenas quando `inicio_em`/`meses` entram em `update_fields`
    (WR-04), campos extras `valor_mensal`, `contratante`, `observacoes`. `clean()` valida
    `usina.empresa_id == empresa_id` (IN-01 defesa em profundidade). `is_active`/`dias_restantes`
    usam `timezone.localdate()` (WR-03).
    Serializer `validate_usina` escopa a usina à empresa do request via `empresa_do_request`
    (CR-01 BLOCKER — anti-IDOR; D-10). ViewSet herda `EmpresaModelViewSet`; filtro status/provedor.
    Registrado em `INSTALLED_APPS` (settings/base.py:48) e `config/urls.py` (`/api/monitoramento-ativo/`).
    A mesma correção anti-IDOR foi aplicada ao `GarantiaSerializer.validate_usina` (mesma falha pré-existente).
  </action>
  <verify>
    <automated>docker compose exec -T backend pytest apps/monitoramento_ativo/tests/test_serializer_escopo.py apps/monitoramento_ativo/tests/test_model.py -q</automated>
  </verify>
  <done>POST/PATCH com usina de outro tenant retorna 400; meses=0 rejeitado; fim_em persistido = inicio_em + meses; `/api/monitoramento-ativo/` escopado por empresa.</done>
</task>

<task type="auto">
  <name>Task 2 (SC-2): Gate do motor garantia OU premium, garantia preservada [PREM-02]</name>
  <status>done</status>
  <files>backend/apps/alertas/motor.py</files>
  <action>
    `_usina_monitorada(usina)` retorna True quando há garantia ativa OU `monitoramento_ativo`
    vigente (D-02). O queryset de usinas em `avaliar_empresa()` usa
    `select_related("garantia", "monitoramento_ativo")` e ambos os acessos reverse-1:1 usam
    `getattr(..., None)` para não levantar quando a relação está ausente. Usina sem garantia
    nem premium continua sendo coletada mas não gera alerta (early-continue no loop). Nenhuma
    mudança no comportamento de garantia.
  </action>
  <verify>
    <automated>docker compose exec -T backend pytest apps/alertas/tests/test_motor_gate_premium.py -q</automated>
  </verify>
  <done>Usina só-premium é avaliada; usina sem nenhum contrato é pulada; `garantia_vencendo` retorna None sem garantia.</done>
</task>

<task type="auto">
  <name>Task 3 (SC-3): Flag premium derivada em Alerta + filtro + tela /alertas-premium [PREM-03]</name>
  <status>done</status>
  <files>backend/apps/alertas/models.py, backend/apps/alertas/views.py, backend/apps/alertas/serializers.py, frontend/src/pages/alertas/AlertasPremiumPage.tsx, frontend/src/pages/alertas/AlertasPage.tsx, frontend/src/routes/router.tsx, frontend/src/components/trylab/Sidebar.tsx, frontend/src/hooks/use-alertas.ts, frontend/src/hooks/use-alertas-stats.ts, frontend/src/types/alertas.ts</files>
  <action>
    `AlertaQuerySet.com_premium()` anota `_premium_anotado = Exists(MonitoramentoAtivo vigente
    da usina)` em 1 query, correlacionando por `usina_id` (D-08, padrão de `regra_desativada`,
    sem N+1; não vaza entre tenants pois usina tem exatamente uma empresa e o queryset externo
    é escopado). `Alerta.premium` property lê a anotação quando presente, senão 1 query fallback.
    `AlertaViewSet.queryset` aplica `.com_premium()`; `AlertaFilter.premium =
    BooleanFilter(field_name="_premium_anotado")` → `GET /api/alertas/?premium=true`.
    Serializer expõe `premium` read-only.
    Frontend: `AlertasPremiumPage` reusa `AlertasPage` via prop `premium` (D-04, zero duplicação);
    rota `/alertas-premium` em router.tsx; badge "Premium" na lista geral; contador na Sidebar (D-03).
  </action>
  <verify>
    <automated>docker compose exec -T backend pytest apps/alertas/tests/ -q -k "premium"</automated>
    <human-check>Abrir /alertas-premium: lista só alertas de usinas premium; badge "Premium" aparece na lista geral /alertas.</human-check>
  </verify>
  <done>`?premium=true` filtra; rota /alertas-premium existe; badge na lista geral; sem N+1 (Exists).</done>
</task>

<task type="auto">
  <name>Task 4 (SC-4): Regra diária monitoramento_premium_vencendo + limites configuráveis [PREM-04]</name>
  <status>done</status>
  <files>backend/apps/alertas/regras/monitoramento_premium_vencendo.py, backend/apps/core/models.py, backend/apps/core/serializers.py, backend/apps/core/migrations/0007_configuracaoempresa_monitoramento_premium_aviso_dias_and_more.py</files>
  <action>
    Regra `MonitoramentoPremiumVencendo(RegraUsina)` espelhando `garantia_vencendo` (D-09):
    `severidade_dinamica=True` (override de admin ignorado, só `ativa` respeitado). Tri-state:
    sem contrato premium ou vencido → `None`; `dias > aviso` → `False`; `dias <= critico` →
    AVISO; senão INFO. Registrada via `@registrar` + import em `_carregar_regras`; faz parte de
    `REGRAS_DIARIAS` (roda só na task diária).
    Dois campos novos em `ConfiguracaoEmpresa`: `monitoramento_premium_aviso_dias` (30),
    `monitoramento_premium_critico_dias` (7), migration 0007.
    `ConfiguracaoEmpresaSerializer.validate()` exige `critico < aviso` para premium E garantia (WR-02).
  </action>
  <verify>
    <automated>docker compose exec -T backend pytest apps/alertas/tests/test_monitoramento_premium_vencendo.py apps/core/tests/test_configuracoes_api.py -q</automated>
  </verify>
  <done>Regra dispara INFO ≤30d / AVISO ≤7d; PATCH com critico >= aviso rejeitado (400) para premium e garantia.</done>
</task>

<task type="auto">
  <name>Task 5 (SC-5): Docs do produto + tela de Configurações refletem garantia OU premium [PREM-05]</name>
  <status>done</status>
  <files>frontend/src/pages/docs/DocsPremiumPage.tsx, frontend/src/pages/docs/DocsComoFuncionaPage.tsx, frontend/src/pages/docs/DocsRegrasPage.tsx, frontend/src/pages/docs/DocsConfiguracoesPage.tsx, frontend/src/pages/docs/DocsHomePage.tsx, frontend/src/components/docs/docs-data.ts, frontend/src/pages/configuracoes/ConfiguracoesPage.tsx, frontend/src/pages/monitoramento-ativo/MonitoramentoAtivoPage.tsx, frontend/src/components/monitoramento-ativo/MonitoramentoAtivoFormDialog.tsx, frontend/src/hooks/use-monitoramento-ativo.ts, frontend/src/types/monitoramento-ativo.ts, frontend/src/lib/types.ts, frontend/src/routes/router.tsx</files>
  <action>
    Política de docs obrigatória do CLAUDE.md cumprida no mesmo PR:
    - Nova `DocsPremiumPage.tsx` (/docs/premium) registrada em `docs-data.ts` e router.tsx, link em `DocsHomePage`.
    - `DocsComoFuncionaPage` atualizada (gate garantia OU premium liga o monitoramento).
    - `DocsRegrasPage` ganha card da regra `monitoramento_premium_vencendo`.
    - `DocsConfiguracoesPage` documenta os dois limites premium (texto amigável, sem nomes técnicos de campo).
    - `ConfiguracoesPage.tsx` expõe os limites premium com validação Zod `critico < aviso` (extrairErroApi para mostrar erro 400 do backend — IN-04).
    - Página CRUD `/monitoramento-ativo` (espelha Garantias) com `valor_mensal`/`contratante`;
      `MonitoramentoAtivoFormDialog` com preview de `fim_em` espelhando o clamp do backend (IN-03).
    Estilo PT-BR voltado ao operador.
  </action>
  <verify>
    <automated>cd frontend && npm run build</automated>
    <human-check>Abrir /docs/premium (existe e registrada na sidebar de docs); /docs/regras tem card premium; /configuracoes mostra os dois limites premium; /monitoramento-ativo lista/cria contratos.</human-check>
  </verify>
  <done>Build frontend verde; /docs/premium registrada; docs Como funciona/Regras/Configurações e tela de Configurações refletem garantia OU premium.</done>
</task>

<task type="auto">
  <name>Task 6 (SC-6): Suíte backend verde + code review resolvido [PREM-06]</name>
  <status>done</status>
  <files>backend/apps/monitoramento_ativo/tests/test_model.py, backend/apps/monitoramento_ativo/tests/test_serializer_escopo.py, backend/apps/alertas/tests/test_motor_gate_premium.py, backend/apps/alertas/tests/test_monitoramento_premium_vencendo.py, backend/apps/core/tests/test_configuracoes_api.py, .planning/phases/MON-07-clientes-premium-monitoramento-ativo/07-REVIEW.md</files>
  <action>
    Testes de regressão adicionados cobrindo: escopo anti-IDOR + meses=0
    (test_serializer_escopo.py), modelo/`_somar_meses`/fim_em (test_model.py), gate do motor
    garantia OU premium (test_motor_gate_premium.py), faixas INFO/AVISO da regra
    (test_monitoramento_premium_vencendo.py), validação `critico < aviso` premium
    (test_configuracoes_api.py). Code review (07-REVIEW.md) executado: 1 BLOCKER (CR-01 IDOR) +
    6 WARNING + 4 INFO; resolução: 9 corrigidos, WR-05/IN-02 deferidos/n-a, WR-06 mitigado por
    CR-01. Suíte: 216 passed.
  </action>
  <verify>
    <automated>docker compose exec -T backend pytest -q 2>&1 | tail -3</automated>
  </verify>
  <done>Suíte backend verde (216 passed); 07-REVIEW.md status=resolved com tabela de resolução.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| cliente → API (`/api/monitoramento-ativo/`) | PK `usina` chega do cliente — não confiável |
| cliente → API (`/api/configuracoes/`) | limites premium chegam do cliente — não confiáveis |
| cliente → API (`/api/alertas/?premium=`) | filtro premium sobre dados escopados por empresa |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-01 | Elevation of Privilege (IDOR) | `MonitoramentoAtivoSerializer.usina` | mitigate | `validate_usina` escopa a usina à empresa do request (`empresa_do_request`); `clean()` no model como backstop. CR-01 resolvido + regressão em `test_serializer_escopo.py`. |
| T-07-02 | Tampering | `ConfiguracaoEmpresa` limites premium | mitigate | `validate()` exige `critico < aviso` (premium e garantia); regressão em `test_configuracoes_api.py`. |
| T-07-03 | Information Disclosure | `com_premium()` cross-tenant | accept | `Exists` correlaciona por `usina_id`; usina tem exatamente uma empresa e o queryset externo é escopado por `EmpresaQuerysetMixin` — não vaza (verificado no review). |
| T-07-04 | Tampering | `meses=0` contrato degenerado | mitigate | `MinValueValidator(1)` no model + DRF rejeita (400). WR-01 resolvido. |
| T-07-05 | Repudiation/Integrity | `save(update_fields)` corrompe `fim_em` | mitigate | recalcula `fim_em` só quando `inicio_em`/`meses` mudam. WR-04 resolvido. |
| T-07-SC | Tampering | npm/pip installs | accept | Sem novas dependências de pacote nesta fase (feature usa libs já presentes). Sem audit de legitimidade necessária. |
</threat_model>

<verification>
Checagens de fase (todas devem passar contra os arquivos REAIS já implementados):

1. Backend completo: `docker compose exec -T backend pytest -q` → 216 passed.
2. Anti-IDOR: `pytest apps/monitoramento_ativo/tests/test_serializer_escopo.py` verde.
3. Gate do motor: `pytest apps/alertas/tests/test_motor_gate_premium.py` verde.
4. Regra + limites: `pytest apps/alertas/tests/test_monitoramento_premium_vencendo.py apps/core/tests/test_configuracoes_api.py` verde.
5. Build frontend: `cd frontend && npm run build` verde.
6. Rotas presentes: grep `alertas-premium` e `monitoramento-ativo` em `frontend/src/routes/router.tsx`.
7. Doc registrada: grep `premium` em `frontend/src/components/docs/docs-data.ts`.
8. Review resolvido: `07-REVIEW.md` frontmatter `status: resolved`.
</verification>

<success_criteria>
Os 6 success criteria do ROADMAP Phase 7 estão satisfeitos pelos arquivos referenciados:
1. CRUD MonitoramentoAtivo (1:1 Usina) escopado por empresa, anti-IDOR, fim_em persistido. ✅
2. Gate garantia OU premium em `_usina_monitorada`; garantia preservada. ✅
3. Alerta.premium via Exists (sem N+1); `?premium=true`; /alertas-premium + badge. ✅
4. Regra diária INFO ≤30d/AVISO ≤7d; limites validados (critico < aviso). ✅
5. /docs/premium + Como funciona/Regras/Configurações + tela Configurações refletem garantia OU premium. ✅
6. Suíte backend verde (216) + 07-REVIEW.md resolved. ✅
</success_criteria>

<output>
Plano retroativo — nenhum SUMMARY novo necessário. `/gsd:execute-phase` em modo validação
confirma cada task; o verify checa os 6 success criteria contra os arquivos reais.
</output>
