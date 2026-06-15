---
phase: 07-clientes-premium
reviewed: 2026-06-15T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - backend/apps/monitoramento_ativo/models.py
  - backend/apps/monitoramento_ativo/serializers.py
  - backend/apps/monitoramento_ativo/views.py
  - backend/apps/alertas/models.py
  - backend/apps/alertas/motor.py
  - backend/apps/alertas/views.py
  - backend/apps/alertas/serializers.py
  - backend/apps/alertas/regras/monitoramento_premium_vencendo.py
  - backend/apps/core/models.py
  - backend/apps/core/serializers.py
  - frontend/src/hooks/use-monitoramento-ativo.ts
  - frontend/src/hooks/use-alertas.ts
  - frontend/src/pages/configuracoes/ConfiguracoesPage.tsx
  - frontend/src/components/trylab/Sidebar.tsx
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: resolved
resolution: "9 corrigidos (1 BLOCKER + 5 WARNING + 3 INFO), 2 deferidos/n-a (WR-05, IN-02), WR-06 mitigado por CR-01"
---

# Phase 07: Code Review Report

**Reviewed:** 2026-06-15
**Depth:** standard
**Files Reviewed:** 13 (config-listed) + supporting context files
**Status:** issues_found

## Summary

Reviewed the "clientes premium" (monitoramento ativo) feature: the new
`MonitoramentoAtivo` model + CRUD viewset, the `com_premium()` annotation and
`premium` alert filter, the motor gate change (garantia OR premium), the new
`monitoramento_premium_vencendo` rule, two new `ConfiguracaoEmpresa` fields,
plus the frontend config page, sidebar badge, and CRUD dialog/hooks.

Tenant isolation on **reads** is sound: `MonitoramentoAtivoViewSet` inherits
`EmpresaQuerysetMixin` (filters by `request.empresa`), and `com_premium()`
correlates on `usina_id` (a usina belongs to exactly one empresa, so the
`Exists` cannot leak across tenants). The motor gate (`_usina_monitorada`) is
correctly covered by `select_related("garantia", "monitoramento_ativo")` and
the new rule returns `None` when there is no premium contract, so existing
`garantia_vencendo` behavior is preserved.

The headline defect is a **cross-tenant write / IDOR** on `MonitoramentoAtivo`
create: the `usina` field is an unscoped `PrimaryKeyRelatedField`, so an
admin of empresa A can attach a premium contract to a usina of empresa B.
Beyond that: several correctness/robustness gaps around missing backend
validation (`meses=0`, premium-days ordering), a timezone mismatch in
`date.today()`, and an `update_fields` edge case.

## Critical Issues

### CR-01: Cross-tenant write — `usina` not scoped to `request.empresa` on create

**File:** `backend/apps/monitoramento_ativo/serializers.py:14-30`, `backend/apps/monitoramento_ativo/views.py:33-41`
**Issue:**
`MonitoramentoAtivoSerializer` exposes `usina` as a plain writable field. DRF's
`ModelSerializer` builds it as a `PrimaryKeyRelatedField` with the **default
unscoped queryset** (`Usina.objects.all()`). `EmpresaQuerysetMixin.perform_create`
only sets `empresa=empresa_do_request(...)` on the `MonitoramentoAtivo` row — it
does **not** validate that the referenced `usina` belongs to that empresa.

Consequence: an authenticated admin of empresa A can `POST /api/monitoramento-ativo/`
with `usina=<id de uma usina da empresa B>`. The row is created with
`empresa=A` but `usina` pointing at B's plant. This is a cross-tenant write
(IDOR). It also creates a data-integrity inconsistency (`MonitoramentoAtivo.empresa`
≠ `usina.empresa`) and, because `_usina_monitorada` / `com_premium()` key off
`usina_id`, it can silently turn on monitoring / premium classification for
another tenant's plant.

The CLAUDE.md rule is explicit: "Views/querysets devem filtrar por
`request.empresa` — nunca confiar em parâmetro do cliente." The `usina` PK here
is exactly such a client-supplied parameter, and it is currently trusted.

The same gap exists for **update** (PATCH can repoint `usina`), though the
existing row is at least already empresa-scoped by `get_queryset`.

**Fix:** Scope the `usina` related-field queryset to the request's empresa.
Add a `get_serializer_context`/`__init__` filter, or validate in the serializer:

```python
# serializers.py
class MonitoramentoAtivoSerializer(serializers.ModelSerializer):
    ...
    def validate_usina(self, usina):
        empresa = self.context["request"].empresa or self.context["request"].user.empresa
        if usina.empresa_id != empresa.id:
            raise serializers.ValidationError("Usina não pertence à sua empresa.")
        return usina
```

(or override `get_fields` to set `self.fields["usina"].queryset =
Usina.objects.da_empresa(empresa)` so it 404s instead of leaking existence).
Confirm `request.empresa` is populated; under JWT use `empresa_do_request`
from `apps.core.api` as the other views do.

## Warnings

### WR-01: `meses` accepts 0 — `fim_em == inicio_em`, no backend lower bound

**File:** `backend/apps/monitoramento_ativo/models.py:30,49-55`
**Issue:**
`meses = PositiveIntegerField()` permits `0` (PositiveIntegerField allows 0).
With `meses=0`, `_somar_meses` returns `inicio_em` unchanged, producing a
zero-length contract. The frontend dialog enforces `min=1` and validates
`mesesNum < 1`, but the API has no such guard — a direct API client (or the
`criar`/`atualizar` hook, which forwards `meses` verbatim) can persist
`meses=0`. A zero-duration "active" contract that expires the day it starts is
almost certainly not intended and will produce confusing
`monitoramento_premium_vencendo`/gate behavior.

**Fix:** Add `validators=[MinValueValidator(1)]` to the model field (and a
matching serializer-level `min_value=1`), mirroring the front-end rule so the
backend is authoritative.

### WR-02: No backend validation that `monitoramento_premium_critico_dias < aviso_dias`

**File:** `backend/apps/core/models.py:36-48`, `backend/apps/core/serializers.py:8-44`
**Issue:**
The frontend `ConfiguracoesPage` enforces
`monitoramento_premium_critico_dias < monitoramento_premium_aviso_dias` via a
Zod `.refine`. The backend (`ConfiguracaoEmpresaSerializer` /
`ConfiguracaoEmpresa` model) has **no** equivalent validation — no `clean()`,
no serializer `validate()`. A direct PATCH (or a future client) can set
`critico_dias >= aviso_dias`. In `monitoramento_premium_vencendo.avaliar`, if
`critico >= aviso`, the `dias <= critico` branch (AVISO) effectively swallows
the `<= aviso` INFO band or inverts the escalation, defeating the intended
two-stage severity. Same latent issue exists for the pre-existing
`garantia_critico_dias`/`garantia_aviso_dias` pair (not introduced here, but
the new fields replicate the gap).

**Fix:** Add a `validate()` to `ConfiguracaoEmpresaSerializer`:

```python
def validate(self, attrs):
    crit = attrs.get("monitoramento_premium_critico_dias",
                     getattr(self.instance, "monitoramento_premium_critico_dias", None))
    aviso = attrs.get("monitoramento_premium_aviso_dias",
                      getattr(self.instance, "monitoramento_premium_aviso_dias", None))
    if crit is not None and aviso is not None and crit >= aviso:
        raise serializers.ValidationError(
            {"monitoramento_premium_critico_dias": "Deve ser menor que o aviso prévio."})
    return attrs
```

### WR-03: `date.today()` ignores `TIME_ZONE` — date boundary off by up to a day

**File:** `backend/apps/monitoramento_ativo/models.py:64-70`, `backend/apps/alertas/models.py:51-54,185-188`, `backend/apps/monitoramento_ativo/views.py:25-29`
**Issue:**
`is_active`, `dias_restantes`, the `com_premium()` SQL subquery (`fim_em__gte=date.today()`),
the `premium` property fallback, and the status filter all use `date.today()`.
`date.today()` returns the **OS-local** date, which in a typical Docker
container is UTC — not the project's `TIME_ZONE = "America/Sao_Paulo"`
(UTC-3). Between 21:00 and 23:59 local time, UTC has already rolled to the
next calendar day, so a contract whose `fim_em` is "today" (local) will be
treated as expired ~3h early, and `dias_restantes` can be off by one. This is
the same pattern as the existing `Garantia` model, but it is now duplicated
across the model property, the rule context, AND a raw SQL filter, magnifying
inconsistency.

**Fix:** Use `django.utils.timezone.localdate()` everywhere a "today" date is
needed under `USE_TZ=True`:

```python
from django.utils import timezone
...
return timezone.localdate() <= self.fim_em        # is_active
fim_em__gte=timezone.localdate()                   # com_premium subquery / status filter
```

### WR-04: `save(update_fields=...)` recomputes `fim_em` but not from persisted `inicio_em`/`meses`

**File:** `backend/apps/monitoramento_ativo/models.py:57-62`
**Issue:**
`save()` always recomputes `fim_em` from the **in-memory** `self.inicio_em` /
`self.meses` and force-adds `fim_em` to `update_fields`. If a caller does a
partial update like
`ma.valor_mensal = x; ma.save(update_fields=["valor_mensal"])` on an instance
where `inicio_em`/`meses` were not reloaded (e.g. a stale instance, or one
where only some fields were mutated), `fim_em` is rewritten from whatever
`self.inicio_em`/`self.meses` currently hold — which may differ from the DB —
silently corrupting `fim_em`. The DRF flow is safe today (PATCH builds a fresh
instance), but the model contract is fragile and the forced inclusion of
`fim_em` masks the problem. The DRF `resolver`/`reconhecer`-style partial
saves elsewhere in the codebase show this `update_fields` pattern is used.

**Fix:** Either recompute only when `inicio_em`/`meses` are in `update_fields`,
or document/guarantee callers always carry a fresh instance. Minimal safer
version:

```python
def save(self, *args, **kwargs):
    update_fields = kwargs.get("update_fields")
    if update_fields is None or {"inicio_em", "meses"} & set(update_fields):
        self.fim_em = self._somar_meses(self.inicio_em, self.meses)
        if update_fields is not None:
            kwargs["update_fields"] = set(update_fields) | {"fim_em"}
    super().save(*args, **kwargs)
```

### WR-05: `_aplicar` resolves only ONE open alert — UniqueConstraint excludes `reconhecido`

**File:** `backend/apps/alertas/motor.py:144-162`, `backend/apps/alertas/views.py:90-97`
**Issue:**
`_aplicar` queries `estado=EstadoAlerta.ABERTO` only. The partial
`UniqueConstraint` (`condition=Q(estado='aberto')`) also only covers `aberto`.
A user can move an alert to `reconhecido` via the `reconhecer` action. While
that alert is `reconhecido`, the motor sees "nenhum aberto" and can `create` a
second open alert for the same `(usina, inversor, regra)` — the constraint
does not block it because the reconhecido row is excluded from the partial
index. Result: duplicate live alerts for one condition. This is a
pre-existing motor design point, but the premium work adds another
always-firing rule path and the `premium` badge/filter will surface such
duplicates to the operator. Worth confirming intended.

**Fix:** Decide whether `reconhecido` should count as "open" for the
invariant. If yes, broaden the constraint condition to
`Q(estado__in=["aberto", "reconhecido"])` and the `_aplicar` lookup
accordingly; if no, document that reconhecer can spawn a parallel alert.

### WR-06: `MonitoramentoAtivoFilter` exposes `usina` filter unscoped in `Meta.fields`

**File:** `backend/apps/monitoramento_ativo/views.py:13-30`
**Issue:**
`Meta.fields = ("usina", "provedor", "status")` auto-generates a `usina`
exact-match filter. The queryset is empresa-scoped by `EmpresaQuerysetMixin`,
so this does not leak data — but combined with CR-01 (a row may exist whose
`usina` belongs to another empresa), filtering by `usina` returns rows whose
`usina_id` is a foreign-tenant plant. Low severity on its own; flagged because
it interacts with CR-01 and because relying on the mixin for isolation while
also exposing the raw `usina` PK is exactly the pattern that produced CR-01.

**Fix:** After CR-01 is fixed (usina always same empresa), this is benign.
Otherwise consider validating/scoping the filter input.

## Info

### IN-01: `MonitoramentoAtivo` model has no `clean()` validating `empresa == usina.empresa`

**File:** `backend/apps/monitoramento_ativo/models.py:11-62`
**Issue:** There is no model-level invariant that `self.empresa_id ==
self.usina.empresa_id`. Adding a `clean()` (and calling it in serializer
`validate`) would be a defense-in-depth backstop for CR-01 and any future
write path (admin, shell, data import).
**Fix:** Add `clean()` raising `ValidationError` when
`self.usina.empresa_id != self.empresa_id`.

### IN-02: `severidade_padrao=INFO` but rule never emits INFO-floor as default-overridable

**File:** `backend/apps/alertas/regras/monitoramento_premium_vencendo.py:23-27`
**Issue:** `severidade_dinamica=True` means the admin override is ignored, yet
`severidade_padrao = SeveridadeAlerta.INFO` is still declared and surfaced in
`_serializar_linha` as `severidade_default`. The UI disables the select for
dynamic rules, so this is cosmetic, but the declared default is misleading
(the rule emits INFO or AVISO dynamically, never a fixed INFO). Mirrors
`garantia_vencendo`; noting for consistency.
**Fix:** None required; optionally document that `severidade_padrao` is the
floor only.

### IN-03: `dataFimPreview` in the dialog uses JS `setMonth`, diverging from backend `_somar_meses`

**File:** `frontend/src/components/monitoramento-ativo/MonitoramentoAtivoFormDialog.tsx:76-81`
**Issue:** The preview uses `Date.setMonth(getMonth()+n)`, which **overflows**
day-of-month (e.g. Jan 31 + 1 month → Mar 3 in JS), whereas the backend
`_somar_meses` clamps to the last valid day (Jan 31 + 1 → Feb 28). For
end-of-month start dates the previewed "Data fim prevista" will not match the
persisted `fim_em`, confusing the operator.
**Fix:** Compute the preview by mirroring the clamp logic, or drop the preview
and show the server-returned `data_fim` after save.

### IN-04: `use-monitoramento-ativo` swallows error detail; `valor_mensal` typed loosely

**File:** `frontend/src/hooks/use-monitoramento-ativo.ts:97-99`
**Issue:** `catch {}` discards the API error entirely and shows a generic
string, so a 400 from new backend validation (WR-01/WR-02) won't surface its
message to the user (the dialog has the same `catch {}` at line 125 of the
dialog). Minor UX/observability gap.
**Fix:** Capture the error and extract `response.data` like
`ConfiguracoesPage.extrairErroApi` does.

---

## Resolução (aplicada após o review)

| ID | Severidade | Status | O que foi feito |
|----|-----------|--------|------------------|
| CR-01 | BLOCKER | ✅ Corrigido | `validate_usina` em `MonitoramentoAtivoSerializer` escopa a usina à empresa do request (`empresa_do_request`). Aplicado também ao `GarantiaSerializer` (mesma falha pré-existente). + `clean()` no model como defesa em profundidade (IN-01). |
| WR-01 | WARNING | ✅ Corrigido | `MinValueValidator(1)` no campo `meses` (migration `0002`); DRF passa a rejeitar `meses=0` (400). |
| WR-02 | WARNING | ✅ Corrigido | `validate()` em `ConfiguracaoEmpresaSerializer` exige `critico < aviso` para premium **e** garantia. |
| WR-03 | WARNING | ✅ Corrigido | `timezone.localdate()` substitui `date.today()` no model, no `com_premium()`, na property `premium` e no filtro de status. |
| WR-04 | WARNING | ✅ Corrigido | `save()` só recalcula `fim_em` quando `inicio_em`/`meses` mudam (guard em `update_fields`). |
| IN-01 | INFO | ✅ Corrigido | `clean()` valida `empresa == usina.empresa`. |
| IN-03 | INFO | ✅ Corrigido | Preview `dataFimPreview` espelha o clamp de dia do backend (`_somar_meses`). |
| IN-04 | INFO | ✅ Corrigido | Dialog extrai a mensagem de erro da API (`extrairErroApi`) em vez de engolir. |
| WR-05 | WARNING | ⏸️ Deferido | Invariante `reconhecido` vs `UniqueConstraint` é design pré-existente do motor, fora do escopo desta feature. Documentado para decisão futura. |
| WR-06 | WARNING | ✅ Mitigado | Benigno após CR-01 (linhas sempre da mesma empresa). |
| IN-02 | INFO | ⏸️ N/A | Cosmético; espelha `garantia_vencendo`. Sem mudança. |

**Testes de regressão adicionados:** escopo anti-IDOR e `meses=0` (`apps/monitoramento_ativo/tests/test_serializer_escopo.py`); validação `critico < aviso` premium (`apps/core/tests/test_configuracoes_api.py`). Suíte: **216 passed**. Frontend build verde.

---

## Narrative Findings (AI reviewer)

All findings above are narrative (no structural pre-pass was provided).

**Verified safe (no defect):**
- `com_premium()` / `Alerta.premium` correlate on `usina_id` only — does **not**
  leak across tenants because a usina has exactly one empresa, and the outer
  `Alerta` queryset is empresa-scoped by `EmpresaQuerysetMixin`/`AlertaViewSet`.
- The motor gate change (`_usina_monitorada` = garantia OR premium) is covered
  by `select_related("garantia", "monitoramento_ativo")` (motor.py:322); both
  reverse-1:1 accesses use `getattr(..., None)` so a missing relation does not
  raise. `monitoramento_premium_vencendo` returns `None` without a premium
  contract, preserving `garantia_vencendo` semantics.
- The `premium` alert filter (`BooleanFilter(field_name="_premium_anotado")`)
  reads the annotation applied in `AlertaViewSet.queryset.com_premium()`; the
  sidebar premium count goes through the same empresa-scoped endpoint.
- `_somar_meses` year-rollover and day-clamp logic is correct and tested.

---

_Reviewed: 2026-06-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
