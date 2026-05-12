<!-- refreshed: 2026-05-12 -->
# Architecture

**Analysis Date:** 2026-05-12

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  Vite + React 19 + TanStack Query + react-router-dom         │
│  `frontend/src/main.tsx`  →  `frontend/src/routes/router.tsx`│
├──────────────────┬──────────────────┬───────────────────────┤
│  Pages           │   Features       │    UI components       │
│ `src/pages/*`    │  `src/features/*`│   `src/components/ui/` │
└────────┬─────────┴────────┬─────────┴───────────┬───────────┘
         │ axios (JWT Bearer, auto refresh)       │
         ▼                                        │
┌─────────────────────────────────────────────────────────────┐
│                Django REST Framework (HTTP :8000)            │
│  `config/urls.py` → `apps.*/urls.py` → DRF ViewSets          │
│  Multi-tenant gate: `apps/empresas/middleware.py` +          │
│  `apps/core/api.py::EmpresaModelViewSet` (escopo automático) │
├─────────────────────────────────────────────────────────────┤
│   Models (multi-tenant via `EscopoEmpresa` mixin)            │
│   Empresa, Usuario, Usina, Inversor, ContaProvedor,          │
│   LeituraUsina, LeituraInversor, Alerta, Garantia, …         │
└──────────────┬────────────────────────────┬─────────────────┘
               │                            │
               ▼                            ▼
┌──────────────────────────────┐  ┌────────────────────────────┐
│   PostgreSQL 16              │  │   Redis 7 (broker/result)   │
│   (todas as leituras append- │  │   `redis://redis:6379/0|1`  │
│    only, retenção por dias)  │  └─────────────┬──────────────┘
└──────────────────────────────┘                │
                                                ▼
┌─────────────────────────────────────────────────────────────┐
│           Celery worker + Celery beat (DB scheduler)          │
│  `backend/config/celery.py`                                  │
│  - `apps.coleta.tasks.sincronizar_conta_provedor(conta_id)`  │
│  - `apps.coleta.tasks.avaliar_alertas_diarios` (cron 21h UTC) │
│  - `apps.coleta.tasks.limpar_leituras_expiradas` (cron 03h)  │
│  Scheduler dinâmico em `apps/coleta/signals.py` mantém       │
│  `django_celery_beat.PeriodicTask` sincronizada com cada     │
│  `ContaProvedor` ativa.                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Adapters de provedores (1 pacote / provedor)    │
│  `apps/provedores/adapters/<tipo>/{adapter,autenticacao,    │
│   consultas}.py`  registrados via `@registrar` em            │
│  `apps/provedores/adapters/registry.py`                      │
│  Contrato em `apps/provedores/adapters/base.py`              │
│  Unidades em `apps/provedores/adapters/unidades.py`          │
│  → solis, hoymiles, fusionsolar, solarman, auxsol, foxess    │
└──────────────────────┬──────────────────────────────────────┘
                       │ DadosUsina / DadosInversor (kW, kWh, V, A, Hz, °C)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│       Ingestão idempotente (`apps/coleta/ingestao.py`)       │
│  - `arredondar_janela(now, 10min)` reutilizado no ciclo     │
│  - `UniqueConstraint(usina, coletado_em)` e                  │
│    `UniqueConstraint(inversor, coletado_em)`                 │
│  - Roda em `@transaction.atomic`                             │
└──────────────────────┬──────────────────────────────────────┘
                       │ `transaction.on_commit`
                       ▼
┌─────────────────────────────────────────────────────────────┐
│        Motor de alertas (`apps/alertas/motor.py`)            │
│  `avaliar_empresa(empresa_id)` itera regras registradas      │
│  contra a última leitura de cada Usina/Inversor.             │
│  Tri-state: `Anomalia` (abre/atualiza), `False` (resolve),   │
│  `None` (não avalia). 1 alerta aberto / (usina, inversor,    │
│  regra) garantido por `UniqueConstraint` parcial.            │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `EmpresaMiddleware` | Injeta `request.empresa` no request a partir do usuário autenticado | `backend/apps/empresas/middleware.py` |
| `EscopoEmpresa` (mixin) | Adiciona FK `empresa` + manager `EscopoEmpresaManager.da_empresa()` em todos os modelos com escopo | `backend/apps/empresas/models.py` |
| `EmpresaModelViewSet` | Filtra `queryset` por `request.empresa` e preenche `empresa` em `perform_create` | `backend/apps/core/api.py` |
| `PertenceEmpresa` / `AdminEmpresaOuSomenteLeitura` / `EhSuperadmin` | Permissões DRF baseadas em `Usuario.papel` | `backend/apps/usuarios/permissions.py` |
| `BaseAdapter` | Contrato ABC dos adapters (`buscar_usinas`, `buscar_inversores`, `obter_cache_token`, `recalibrar_usinas`) | `backend/apps/provedores/adapters/base.py` |
| Registry de adapters | `@registrar` + `adapter_para(tipo)` resolve adapter por `ContaProvedor.tipo` | `backend/apps/provedores/adapters/registry.py` |
| `sincronizar_conta_provedor` | Task Celery que orquestra 1 ciclo de coleta (decripta credenciais, chama adapter, ingere, agenda alertas, persiste token) | `backend/apps/coleta/tasks.py` |
| `ServicoIngestao` / `ingerir_ciclo` | Upsert idempotente de Usina/Inversor + LeituraUsina/LeituraInversor em `@transaction.atomic`, cria garantia padrão | `backend/apps/coleta/ingestao.py` |
| Signals do scheduler | Mantém `PeriodicTask` em sync com `ContaProvedor` ativa (post_save/post_delete) | `backend/apps/coleta/signals.py` |
| `avaliar_empresa` (motor de alertas) | Roda regras tri-state contra a última leitura de cada alvo, mantém invariante "1 aberto / (usina, inversor, regra)" | `backend/apps/alertas/motor.py` |
| Regras de alerta | Subclasses de `RegraUsina`/`RegraInversor` decoradas com `@registrar`, retornam `Anomalia | False | None` | `backend/apps/alertas/regras/<nome>.py` |
| `ConfiguracaoRegra` | Override por empresa de `ativa` / `severidade` por regra | `backend/apps/alertas/models.py` |
| `ConfiguracaoEmpresa` | Defaults globais por empresa (garantia, thresholds, horário solar, retenção) | `backend/apps/core/models.py` |
| Frontend `api` (axios) | Cliente HTTP com JWT bearer + interceptor de refresh automático em 401 | `frontend/src/lib/api.ts` |
| `useAuth` | Login/logout, carrega `Usuario` via `GET /api/usuarios/me/`, mantém estado de autenticação | `frontend/src/features/auth/useAuth.ts` |
| `router.tsx` | Define todas as rotas; `ProtectedRoute` e `SuperadminRoute` envelopam o app | `frontend/src/routes/router.tsx` |
| `AppLayout` | Sidebar (`trylab/Sidebar.tsx`) + `<Outlet/>`, define título da página | `frontend/src/components/layout/AppLayout.tsx` |

## Pattern Overview

**Overall:** Django MTV + DRF REST API + SPA cliente em React. Backend organizado em **apps por domínio** com **multi-tenancy por linha** (`empresa_id` em todas as tabelas escopadas). Integração com provedores externos via **Adapter pattern com registry**. Coleta e alertas desacoplados em **pipeline Celery**.

**Key Characteristics:**
- Multi-tenant shared-schema (uma instância, uma DB, um esquema; isolamento por `empresa_id` em runtime via mixin + middleware + ViewSet base)
- Adapter pattern: cada provedor é um pacote isolado; o core conhece só `BaseAdapter`/`DadosUsina`/`DadosInversor`
- Pipeline orientado a eventos: coleta → ingestão (transação) → `on_commit` → motor de alertas
- Política sem histerese para alertas: 1 alerta aberto por `(usina, inversor, regra)`, abre/atualiza/resolve em uma única decisão tri-state
- Append-only para leituras (`LeituraUsina`, `LeituraInversor`); janela de coleta arredondada garante idempotência
- Convenção PT-BR para domínio, inglês para campos universais (`id`, `is_active`, `created_at`, `slug`, `url`, etc.)

## Layers

**Apresentação (frontend SPA):**
- Purpose: UI in-app, autenticação JWT, dashboards, formulários, docs do produto
- Location: `frontend/src/`
- Contains: páginas (`pages/`), features de domínio (`features/`), componentes (`components/`), hooks (`hooks/`), libs (`lib/`)
- Depends on: API REST do backend (`/api/*`)
- Used by: usuários finais via navegador

**API REST (DRF):**
- Purpose: CRUD de domínio, autenticação JWT, agregações de dashboard, ações customizadas (resolver alerta, geocode, etc.)
- Location: `backend/apps/*/views.py` + `backend/apps/*/urls.py`
- Contains: ViewSets que herdam de `EmpresaModelViewSet`/`EmpresaReadOnlyViewSet`/`EmpresaListUpdateViewSet` em `backend/apps/core/api.py`
- Depends on: Camada de modelos + permissões
- Used by: frontend e integrações externas (Swagger em `/api/schema/swagger/`)

**Modelos (ORM):**
- Purpose: persistência multi-tenant, regras de banco (constraints, unique parciais, indexes)
- Location: `backend/apps/<dominio>/models.py`
- Contains: subclasses de `EscopoEmpresa` (`Usina`, `Inversor`, `ContaProvedor`, `LeituraUsina`, `LeituraInversor`, `Alerta`, `Garantia`, `LogColeta`, `RegraNotificacao`, `EntregaNotificacao`, `EndpointWebhook`), + entidades de plataforma sem escopo (`Empresa`, `Usuario`, `ConfiguracaoEmpresa`, `ConfiguracaoRegra`)
- Depends on: PostgreSQL 16
- Used by: views, tasks, motor, ingestão

**Pipeline assíncrono (Celery):**
- Purpose: coleta periódica, motor de alertas pós-coleta, tasks diárias (retenção, garantia, queda rendimento)
- Location: `backend/apps/coleta/tasks.py`, `backend/apps/coleta/signals.py`, `backend/apps/alertas/motor.py`
- Contains: tasks `sincronizar_conta_provedor`, `avaliar_alertas_diarios`, `limpar_leituras_expiradas`
- Depends on: Redis (broker + result backend), `django_celery_beat` (scheduler em banco)
- Used by: agendado por beat; `avaliar_empresa_em_commit` agenda inline após coleta

**Adapters de provedores:**
- Purpose: traduzir respostas nativas em `DadosUsina`/`DadosInversor` (unidades canônicas)
- Location: `backend/apps/provedores/adapters/<tipo>/`
- Contains: módulos `adapter.py` (concretiza `BaseAdapter`), `autenticacao.py` (login/HMAC/refresh), `consultas.py` (HTTP raw), `protobuf.py` (Hoymiles)
- Depends on: `BaseAdapter`, `Capacidades`, `unidades.py`
- Used by: `apps/coleta/tasks.py::_instanciar_adapter`

## Data Flow

### Ciclo de coleta (caminho primário)

1. **Beat dispara** `sincronizar_conta_provedor(conta_id)` no intervalo configurado em `ContaProvedor.intervalo_coleta_minutos` (`backend/apps/coleta/tasks.py:51`).
2. **Task abre `LogColeta`** com `status=SUCESSO` provisório e marca `iniciado_em` (`backend/apps/coleta/tasks.py:74`).
3. **Decripta credenciais + cache token** via Fernet em `apps/provedores/cripto.py` (`backend/apps/coleta/tasks.py:42`).
4. **Instancia adapter** com `adapter_para(conta.tipo)` (`backend/apps/coleta/tasks.py:48`).
5. **Adapter coleta**: `buscar_usinas()` + `buscar_inversores(id_externo)` por usina (`backend/apps/coleta/tasks.py:86-103`).
6. **Hook `recalibrar_usinas`** permite reconciliar agregados (ex.: Hoymiles soma inversores quando agregador do provedor está atrasado) (`backend/apps/coleta/tasks.py:107`).
7. **`ingerir_ciclo` em `@transaction.atomic`** (`backend/apps/coleta/ingestao.py:285`):
   - `coletado_em = arredondar_janela(now, 10min)` reaproveitado em todas as leituras do ciclo
   - upsert de `Usina` por `(conta_provedor, id_externo)`
   - cria `Garantia` na primeira coleta com `meses=ConfiguracaoEmpresa.garantia_padrao_meses`
   - cria `LeituraUsina` com `get_or_create(usina, coletado_em)` (idempotente)
   - upsert de `Inversor` + `LeituraInversor` quando `expoe_dados_inversor=True`
   - `Usina.ultima_leitura_em` recebe `medido_em` (NUNCA `coletado_em`) — sinal usado por `sem_comunicacao`
8. **Persiste cache de token** atualizado em `ContaProvedor.cache_token_enc` via `criptografar(novo_cache)` (`backend/apps/coleta/tasks.py:118-126`).
9. **Atualiza `ContaProvedor.ultima_sincronizacao_*`** e limpa `precisa_atencao` (`backend/apps/coleta/tasks.py:128-142`).
10. **`avaliar_empresa_em_commit(empresa_id)`** agenda motor de alertas pós-commit via `transaction.on_commit` (`backend/apps/alertas/motor.py:400`).
11. **Finally bloc** atualiza `LogColeta` com contadores, `status_final`, `duracao_ms`, `finalizado_em` (`backend/apps/coleta/tasks.py:177-186`).

### Motor de alertas (síncrono, após commit)

1. `avaliar_empresa(empresa_id)` chamado em `on_commit` callback (`backend/apps/alertas/motor.py:265`).
2. Carrega regras via `_carregar_regras()` que força import dos módulos em `apps/alertas/regras/*.py`.
3. Lê `ConfiguracaoEmpresa` e overrides em `ConfiguracaoRegra` (1 query batched) (`backend/apps/alertas/motor.py:276-285`).
4. Filtra regras desativadas pela empresa; remove `REGRAS_DIARIAS` (`garantia_vencendo`, `queda_rendimento`) que rodam só na task diária.
5. Itera usinas ativas com garantia ativa (`backend/apps/alertas/motor.py:299-310`).
6. Para cada usina: avalia regras de escopo `USINA` contra `LeituraUsina` mais recente; aplica `_aplicar()`:
   - `Anomalia + nenhum aberto` → cria `Alerta` (`aberto_em=now`)
   - `Anomalia + aberto` → atualiza `severidade/mensagem/contexto`, preserva `aberto_em`
   - `False + aberto` → move para `estado=resolvido`, seta `resolvido_em`
   - `False + nenhum aberto` → noop
   - `None` → noop (regra inaplicável, dado ausente)
7. Para inversores ativos: avalia regras de escopo `INVERSOR`. Quando `agregar_por_usina=True`, consolida respostas via `_aplicar_agregado()` em 1 alerta com `inversor=NULL`; escala severidade para `severidade_se_todos_afetados` quando 100% dos inversores afetados.
8. Override de severidade pulado para regras `severidade_dinamica=True` (`sem_comunicacao`, `garantia_vencendo`, regras agregadas com escalada).

### Tasks diárias

1. **`limpar_leituras_expiradas`** (cron 03:00 UTC, `apps/coleta/signals.py:76-87`): apaga `LeituraUsina`/`LeituraInversor` mais velhas que `ConfiguracaoEmpresa.retencao_leituras_dias` de cada empresa. Alertas e logs não são afetados.
2. **`avaliar_alertas_diarios`** (cron 21:00 UTC, `apps/coleta/signals.py:89-100`): chama `avaliar_empresa(empresa_id, apenas_diarias=True)` para todas as empresas ativas; roda só `garantia_vencendo` e `queda_rendimento`.

### Autenticação (frontend → backend)

1. Usuário envia `POST /api/auth/token/` com `username`/`password` (`backend/config/urls.py:13`).
2. Backend retorna `{access, refresh}` (JWT SimpleJWT, access 30min, refresh 7d com rotação).
3. Frontend guarda tokens em `localStorage` (`frontend/src/features/auth/token-store.ts`).
4. Axios interceptor adiciona `Authorization: Bearer ...` em toda request (`frontend/src/lib/api.ts:8-14`).
5. Em 401, interceptor tenta `refreshAccessToken()` em mutex (`refreshing` promise) e retenta a requisição original (`frontend/src/lib/api.ts:32-49`).
6. `useAuth.load()` chama `GET /api/usuarios/me/` para resolver `Usuario` + `Empresa` (`frontend/src/features/auth/useAuth.ts:19-33`).

**State Management:**
- Frontend: TanStack Query (`@tanstack/react-query`) para dados remotos; `staleTime: 30s`, `refetchOnWindowFocus: false`. Estado local com `useState`. Sem store global pra dados de domínio.
- Backend: stateless por request (sessão JWT). Adapters statefuls (Hoymiles, FusionSolar) persistem token em `ContaProvedor.cache_token_enc` entre ciclos.

## Key Abstractions

**`EscopoEmpresa` (mixin de modelo):**
- Purpose: marca um modelo como multi-tenant. Injeta `empresa = FK(Empresa)` e o manager `EscopoEmpresaManager` com `.da_empresa(empresa)`.
- Examples: `Usina`, `Inversor`, `ContaProvedor`, `LeituraUsina`, `LeituraInversor`, `Alerta`, `Garantia`, `LogColeta`, `RegraNotificacao`, `EntregaNotificacao`, `EndpointWebhook` (`backend/apps/empresas/models.py:39`)
- Pattern: Mixin abstrato Django (`class Meta: abstract = True`)

**`BaseAdapter` + `DadosUsina`/`DadosInversor`/`MpptString`:**
- Purpose: contrato comum dos provedores. Adapter recebe credenciais descriptografadas, expõe `buscar_usinas()` / `buscar_inversores()` retornando dataclasses normalizadas em kW/kWh/V/A/Hz/°C.
- Examples: `backend/apps/provedores/adapters/{solis,hoymiles,fusionsolar,solarman,auxsol,foxess}/adapter.py`
- Pattern: ABC + dataclasses + registry. Decorator `@registrar` em `apps/provedores/adapters/registry.py` + carregamento via `apps/provedores/apps.py::ready()`.

**Regra de alerta (`RegraUsina` / `RegraInversor`):**
- Purpose: avaliar uma condição contra a última leitura de um alvo. Retorno tri-state determina ação do motor.
- Examples: 12 regras em `backend/apps/alertas/regras/<nome>.py` (`sem_comunicacao`, `sobretensao_ac`, `subtensao_ac`, `frequencia_anomala`, `temperatura_alta`, `inversor_offline`, `string_mppt_zerada`, `dado_eletrico_ausente`, `sem_geracao_horario_solar`, `subdesempenho`, `queda_rendimento`, `garantia_vencendo`)
- Pattern: ABC + decorator `@registrar` em `apps/alertas/regras/base.py:53`. Carga lazy em `motor.py::_carregar_regras()`.

**`EmpresaQuerysetMixin` + `EmpresaModelViewSet`:**
- Purpose: enforce de tenancy na camada de API. Reescreve `get_queryset` para filtrar por `request.empresa` e `perform_create` para preencher `empresa` automaticamente.
- Examples: `apps/usinas/views.py::UsinaViewSet`, `apps/alertas/views.py::AlertaViewSet`, todos os ViewSets de domínio
- Pattern: Mixin DRF + `viewsets.ModelViewSet`/`ReadOnlyModelViewSet` em `backend/apps/core/api.py:31`.

**`Anomalia` (dataclass):**
- Purpose: payload da resposta positiva de uma regra (severidade + mensagem legível + contexto JSON com snapshot dos valores)
- Examples: retornado por `regra.avaliar()` quando condição dispara (`backend/apps/alertas/regras/base.py:36`)
- Pattern: dataclass simples consumida pelo motor para popular `Alerta`

## Entry Points

**HTTP API:**
- Location: `backend/config/urls.py` (raiz `urlpatterns`) + `apps/<dominio>/urls.py` (sub-routers DRF)
- Triggers: requests HTTP em `:8000` (gunicorn em prod, runserver em dev)
- Responsibilities: autenticação JWT, CRUD com tenancy, ações customizadas (resolver/reconhecer alerta, ativar/desativar usina, geocode, etc.)

**Frontend SPA:**
- Location: `frontend/src/main.tsx` → `RouterProvider` → `frontend/src/routes/router.tsx`
- Triggers: navegação em `:5173` (dev) ou Nginx servindo `dist/` (prod)
- Responsibilities: render UI, autenticação, fetch via TanStack Query

**Tasks Celery (worker):**
- Location: `backend/config/celery.py` (`Celery("monitoramento")`) + `apps/coleta/tasks.py`
- Triggers: beat dispara `PeriodicTask` (intervalo dinâmico por conta + crons fixos diários); chamada manual via `task.delay(...)` ou `task.apply_async(...)`
- Responsibilities: coleta de provedores, motor de alertas, retenção, alertas diários

**Beat (scheduler):**
- Location: container `beat` rodando `celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler`
- Triggers: signals `post_save`/`post_delete` em `ContaProvedor` (`apps/coleta/signals.py`) mantêm `PeriodicTask` em sincronia
- Responsibilities: agendar tasks periódicas a partir de tabela `django_celery_beat_periodictask`

**Django management commands:**
- Location: `backend/apps/<dominio>/management/commands/*.py`
- Triggers: `python manage.py <comando>` via `make` ou `docker compose exec backend`
- Responsibilities: criar superadmin, geocodificar usinas, migrar alertas legados, atualizar `cache_token_expira_em`, recalibrar alertas de tensão

## Architectural Constraints

- **Threading:** Django sob runserver (dev) é single-threaded por request; em prod usa o worker do gunicorn (sync). Tasks Celery rodam em workers separados (default pré-fork, várias conexões PG simultâneas).
- **Global state:** Registro de adapters (`_REGISTRO` em `apps/provedores/adapters/registry.py`) e registro de regras (`_REGISTRO` em `apps/alertas/regras/base.py`) são dicts module-level populados em boot via `apps/provedores/apps.py::ready()` e `motor.py::_carregar_regras()`.
- **Multi-tenancy:** TODA query em modelo que herda `EscopoEmpresa` DEVE filtrar por `request.empresa`. ViewSets herdam de `EmpresaModelViewSet` (em `apps/core/api.py`) que faz isso automaticamente. Nunca confiar em `empresa` vindo do payload do cliente.
- **Idempotência da coleta:** `coletado_em` é arredondado para janela (10min) e ingestão usa `get_or_create`. Re-execução do mesmo ciclo não duplica leituras.
- **Invariante de alerta:** `UniqueConstraint` parcial `(usina, inversor, regra) WHERE estado='aberto'` garante 1 alerta aberto por chave em `apps/alertas/models.py:117-122`.
- **`AUTH_USER_MODEL`:** `usuarios.Usuario` (`AbstractUser` customizado). Nunca usar `django.contrib.auth.models.User`.
- **Timezone:** `TIME_ZONE = "America/Sao_Paulo"`, `USE_TZ = True`. Datetimes sempre aware. Adapters convertem timestamps do provedor para UTC.
- **Unidades canônicas (adapters):** kW, kWh, V, A, Hz, °C. `unidades.py` faz a conversão; nunca passar valores nativos pra cima.
- **Null ≠ zero (adapters):** Campo que o provedor não expõe vira `None`; `0` é valor legítimo. Crítico para regras tri-state que retornam `None` quando dado ausente.
- **Credenciais criptografadas:** `ContaProvedor.credenciais_enc` e `cache_token_enc` são JSON Fernet. Acesso só via `apps/provedores/cripto.py::criptografar/descriptografar`.
- **Configurações por settings:** `DJANGO_SETTINGS_MODULE=config.settings.dev` (dev) ou `config.settings.prod`. `config/settings/base.py` é a base comum.

## Anti-Patterns

### Confiar em `empresa` vinda do cliente

**What happens:** ViewSet aceita `empresa_id` no payload de criação ou em `?empresa=` no querystring sem rebaixar para `request.empresa`.
**Why it's wrong:** Quebra o isolamento multi-tenant — um operador da empresa A pode ler/escrever na empresa B passando o `id` certo.
**Do this instead:** Herdar de `EmpresaModelViewSet` em `backend/apps/core/api.py:45`. O mixin filtra `queryset` por `request.empresa` em `get_queryset()` e preenche `empresa` em `perform_create()` automaticamente. Para casos cross-tenant legítimos (`/api/superadmin/*`), usar `EhSuperadmin` em `backend/apps/usuarios/permissions.py:25`.

### Consumir alertas nativos do provedor

**What happens:** Adapter inclui o campo `alarmList`/`warn_data` do provedor em `DadosUsina` e o motor abre alertas a partir dele.
**Why it's wrong:** Experiência prévia (sistema antigo `firmasolar`) mostrou 12.8% de churn em <1h (46% no Solis) — alarmes nativos são ruidosos e inconsistentes. Documentado em `backend/apps/provedores/adapters/base.py:9-12`.
**Do this instead:** Adapters NÃO consomem alertas nativos. Se o provedor expõe, fica em `raw` (auditoria) e nunca vira entidade. Alertas são derivados das leituras pelo motor em `backend/apps/alertas/regras/`.

### Usar `0` como sentinela em valor numérico ausente

**What happens:** Adapter retorna `pac_kw=0` quando o provedor não expõe o campo.
**Why it's wrong:** `0` é leitura legítima (noite, standby). Regras que verificam `if pac_kw == 0` disparam falso positivo. Regras tri-state usam `None` para sinalizar "não avaliar".
**Do this instead:** Retornar `None` em qualquer campo opcional do `DadosUsina`/`DadosInversor`. Ver tipo `Decimal | None` nos dataclasses em `backend/apps/provedores/adapters/base.py:73-157`.

### Atualizar `ultima_leitura_em` com `coletado_em`

**What happens:** Ingestão preenche `Usina.ultima_leitura_em = coletado_em` para garantir um valor.
**Why it's wrong:** Mascara o sinal de Wi-Fi caído. A API do provedor responde 200 OK com cache mesmo com o datalogger offline. Só `medido_em` (timestamp do provedor) reflete se o equipamento de fato reportou. Documentado em `backend/apps/coleta/ingestao.py:163-171`.
**Do this instead:** `Usina.ultima_leitura_em` recebe apenas `dados.medido_em`. Se o provedor não expõe, fica `null` e a regra `sem_comunicacao` retorna `None` (não avalia).

### Fechar alerta de regra desativada por silêncio

**What happens:** Admin desativa a regra `sobretensao_ac` em `/configuracao/regras`. O motor para de avaliar; alertas pré-existentes ficam "órfãos" e algum código tenta fechá-los automaticamente.
**Why it's wrong:** Perde-se a sinalização visual para o operador. Decisão de produto: alertas abertos de uma regra desativada ficam congelados (não são fechados por silêncio) e a UI mostra badge "regra desativada".
**Do this instead:** Usar a property `Alerta.regra_desativada` (consulta `ConfiguracaoRegra` para `(empresa, regra)`) — `backend/apps/alertas/models.py:130-153`. Em listagens, anotar via `Alerta.objects.com_regra_desativada()` pra evitar N+1.

### Adicionar provedor sem registrar em `apps.py::ready()`

**What happens:** Cria-se `apps/provedores/adapters/<novo>/adapter.py` com `@registrar`, mas não atualiza `apps/provedores/apps.py::ProvedoresConfig.ready()`.
**Why it's wrong:** O decorador só executa quando o módulo é importado. Sem o import em `ready()`, o registry fica vazio para o novo provedor e `adapter_para(tipo)` levanta `KeyError`.
**Do this instead:** Após criar `apps/provedores/adapters/<novo>/`, adicionar `from . import <novo>` em `backend/apps/provedores/apps.py:13-20` E adicionar o valor ao enum `TipoProvedor` em `backend/apps/provedores/models.py:8`.

## Error Handling

**Strategy:** Hierarquia de exceções customizadas em adapters (`ErroProvedor`, `ErroAutenticacaoProvedor`, `ErroRateLimitProvedor` em `backend/apps/provedores/adapters/base.py:22-31`); task Celery captura por tipo e mapeia para `StatusSincronizacao`.

**Patterns:**
- `ErroRateLimitProvedor` → Celery `autoretry_for` + `retry_backoff_max=3600` + `max_retries=3` (`backend/apps/coleta/tasks.py:53-57`)
- `ErroAutenticacaoProvedor` → marca `ContaProvedor.precisa_atencao=True` para intervenção manual (`backend/apps/coleta/tasks.py:147-156`)
- `ErroProvedor` parcial em `buscar_inversores` → `status=PARCIAL`, `detalhe_erro` populado, ciclo continua (`backend/apps/coleta/tasks.py:96-102`)
- Exceção em regra de alerta individual → `logger.exception(...)` e continua iterando demais regras (`backend/apps/alertas/motor.py:318-320`)
- Frontend axios → interceptor de 401 com refresh transparente; demais erros borbulham para hooks TanStack Query (`frontend/src/lib/api.ts:32-49`)

## Cross-Cutting Concerns

**Logging:** `LOGGING` em `backend/config/settings/base.py:167-180`. Handler `console` com formatter `verbose`. Nível por env (`LOG_LEVEL`, default INFO). Loggers nomeados via `logging.getLogger(__name__)` em cada módulo.

**Validation:** DRF serializers em `apps/<dominio>/serializers.py`. `clean()` em modelos críticos (`ConfiguracaoRegra.clean` valida que `regra_nome` está registrada — `backend/apps/alertas/models.py:214-232`). Validação de intervalo mínimo de coleta em `apps/provedores/serializers.py` consultando `Capacidades.intervalo_minimo_minutos`.

**Authentication:** JWT via `rest_framework_simplejwt`. Configurações em `SIMPLE_JWT` (`backend/config/settings/base.py:134-141`). Acesso 30min, refresh 7d, rotação habilitada.

**Authorization:** Permissões em `backend/apps/usuarios/permissions.py`:
- `PertenceEmpresa` — autenticado + tem empresa
- `AdminEmpresaOuSomenteLeitura` — leitura para todos da empresa, escrita só `is_admin_empresa`
- `EhSuperadmin` — acesso cross-tenant (`/api/superadmin/*`)

**Multi-tenancy enforcement:** Combinação de:
1. `EmpresaMiddleware` (`apps/empresas/middleware.py`) injeta `request.empresa`
2. `EscopoEmpresa` mixin nos modelos
3. `EmpresaQuerysetMixin` em todos os ViewSets de domínio
4. `empresa_do_request()` resolve empresa do request (sessão ou JWT)

**Audit:** `LogColeta` registra cada ciclo de coleta (`backend/apps/coleta/models.py`). `EntregaNotificacao` registra cada notificação enviada (`backend/apps/notificacoes/models.py:33`).

**Encryption:** Fernet (`apps/provedores/cripto.py`) protege credenciais e tokens de provedor. Chave em `CHAVE_CRIPTOGRAFIA` (env). Nunca ler/gravar texto puro nesses campos.

---

*Architecture analysis: 2026-05-12*
