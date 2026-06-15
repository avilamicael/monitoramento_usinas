# Phase 7: Clientes Premium (Monitoramento Ativo) - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Adicionar um segundo tipo de contrato por usina — **monitoramento ativo (cliente premium)** — pago via mensalidade, em que o operador se compromete a agir rápido sobre os alertas. É **aditivo** ao sistema existente: não muda o comportamento da garantia, apenas amplia o "gate" do motor de alertas e adiciona uma trilha visual dedicada para esses clientes.

**Em escopo:** model `MonitoramentoAtivo` + CRUD escopado por empresa; gate do motor (garantia OU premium); flag `premium` derivada em `Alerta` + filtro + tela `/alertas-premium` + badge; regra diária de vencimento do contrato; dois limites em `ConfiguracaoEmpresa`; docs do produto; tela de Configurações.

**Fora de escopo (fase futura):** disparo de notificação externa (e-mail/WhatsApp) ao criar/escalar alerta premium — a infra `apps/notificacoes` fica como gancho. Cobrança/billing real (valor mensal é só registro do contrato).
</domain>

<decisions>
## Implementation Decisions

### Relação com a garantia
- **D-01:** Premium é **independente** da garantia. Uma usina pode ter garantia, premium, ambos ou nenhum. (Decisão do usuário nesta sessão.)
- **D-02:** O motor passa a monitorar uma usina quando há **garantia ativa OU monitoramento ativo vigente** (`_usina_monitorada` em `apps/alertas/motor.py`). Sem nenhum dos dois, a usina segue sendo coletada mas não gera alerta. Comportamento de garantia preservado.

### Notificação
- **D-03:** Por enquanto **só dentro do sistema**: badge "Premium" na lista de alertas, tela dedicada `/alertas-premium`, contador na sidebar. E-mail/WhatsApp ficam para fase futura (gancho em `apps/notificacoes`).

### UX / superfície
- **D-04:** **Tela separada** `/alertas-premium` (não um filtro embutido na tela atual). Implementada reusando `AlertasPage` via prop `premium` — zero duplicação de lógica.
- **D-05:** CRUD de contratos premium em página própria `/monitoramento-ativo` (espelha a de Garantias), com campos extras `valor_mensal` e `contratante`.

### Modelagem
- **D-06:** Model nomeado **`MonitoramentoAtivo`** no app `apps/monitoramento_ativo`; label "Premium" na UI. (Domínio em PT-BR, conforme CLAUDE.md.)
- **D-07 (decisão técnica chave):** `fim_em` é **PERSISTIDO** (recalculado no `save()` a partir de `inicio_em + meses`), ao contrário de `Garantia.fim_em` que é `@property`. Motivo: permitir filtrar alertas premium em SQL via `Exists(fim_em__gte=hoje)` com paginação correta, em vez de iterar em Python.
- **D-08:** `premium` em `Alerta` é **derivado** (anotação `Exists` em `com_premium()`, sem N+1), não desnormalizado — segue o padrão de `regra_desativada`. Sempre reflete o contrato vigente.

### Regra de vencimento
- **D-09:** Incluir regra **diária** `monitoramento_premium_vencendo` (INFO ≤30 dias / AVISO ≤7 dias), `severidade_dinamica=True`. Limites em `ConfiguracaoEmpresa.monitoramento_premium_aviso_dias` / `_critico_dias`.

### Segurança (multi-tenancy)
- **D-10:** O campo `usina` no serializer é **escopado à empresa do request** (anti-IDOR) — admin da empresa A não cria contrato em usina da empresa B. Reforço com `clean()` no model e validação `critico < aviso` no backend. (Correções aplicadas após code review — ver `07-REVIEW.md`.)

### Claude's Discretion
- Número/posição exata dos itens na sidebar e estilo do badge; estrutura interna das páginas (reuso de `Pill`/`SortHeader`/`Card` existentes).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Especificação do produto / regras
- `CLAUDE.md` — convenções (PT-BR domínio, multi-tenancy por `empresa_id`, política de docs obrigatória, regra do null, padrão adapter/regra)
- `.planning/phases/MON-07-clientes-premium-monitoramento-ativo/07-REVIEW.md` — code review da implementação (1 BLOCKER IDOR + warnings) com tabela de resolução; **status: resolved**

### Código de referência (espelhado)
- `backend/apps/garantia/` — model/serializer/view/urls espelhados por `apps/monitoramento_ativo/`
- `backend/apps/alertas/regras/garantia_vencendo.py` — regra espelhada por `monitoramento_premium_vencendo.py`
- `backend/apps/alertas/motor.py` — gate `_usina_monitorada`, `REGRAS_DIARIAS`
- `frontend/src/pages/garantias/GarantiasPage.tsx` / `frontend/src/pages/alertas/AlertasPage.tsx` — telas espelhadas/reusadas

### Política de documentação
- `frontend/src/components/docs/docs-data.ts` + `frontend/src/pages/docs/` — toda mudança de comportamento exige sync das docs no mesmo PR (regra CLAUDE.md)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EmpresaModelViewSet` / `EmpresaQuerysetMixin` (`apps/core/api.py`): CRUD escopado por empresa.
- `EscopoEmpresa` (`apps/empresas/models.py`): mixin multi-tenant.
- `AlertaQuerySet.com_regra_desativada` (padrão `Exists`) → espelhado por `com_premium`.
- Frontend: `AlertasPage` (parametrizada com `premium`), `GarantiaFormDialog`/`GarantiasPage`, `Pill`/`SortHeader`/`Card`, hooks adapter `use-garantias`/`use-alertas`.

### Established Patterns
- Regras tri-state (`Anomalia`/`False`/`None`), `@registrar`, import em `_carregar_regras`.
- Severidade dinâmica ignora override do admin (só `ativa` é respeitado).
- Cascata de threshold (Inversor → Usina → ConfiguracaoEmpresa → constante).

### Integration Points
- `config/urls.py` (+`/api/monitoramento-ativo/`), `INSTALLED_APPS` (+`apps.monitoramento_ativo`).
- `motor.py` gate + `REGRAS_DIARIAS`.
- `AlertaViewSet.queryset` (`.com_premium()`) + `AlertaFilter` (`premium`).
- `router.tsx`, `Sidebar.tsx`, `ConfiguracoesPage.tsx`, docs.
</code_context>

<specifics>
## Specific Ideas

- Exemplo do usuário: "garantia + monitoramento ativo de 1 ano + 2 meses" → registra a duração somada em meses; o sistema calcula `fim_em`.
- Tela `/alertas-premium` é a "fila de prioridade" do operador (quem paga por agilidade).
</specifics>

<deferred>
## Deferred Ideas

- **Notificação externa premium** (e-mail/WhatsApp imediato ao criar/escalar alerta de usina premium) — fase futura, usando `apps/notificacoes` (`RegraNotificacao`/`EntregaNotificacao`).
- **SLA/tempo de resposta** medido por contrato premium — não modelado nesta fase.
- **Billing real** (cobrança da mensalidade) — `valor_mensal` é só registro; integração de pagamento fora de escopo.
- **IDOR em `GarantiaSerializer`**: mesma falha pré-existente foi corrigida junto (não era escopo, mas era a mesma classe de bug).
</deferred>

---

*Phase: 7-Clientes Premium (Monitoramento Ativo)*
*Context gathered: 2026-06-15*
