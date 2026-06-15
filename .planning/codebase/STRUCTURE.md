# Codebase Structure

**Analysis Date:** 2026-05-12

## Directory Layout

```
monitoramento_usinas/
├── backend/                            # Django 5 + DRF + Celery
│   ├── apps/
│   │   ├── alertas/                    # Motor de alertas + regras + Alerta model
│   │   │   ├── regras/                 # 1 arquivo por regra (sem_comunicacao.py, …)
│   │   │   ├── management/commands/    # fechar_alertas_obsoletos, migrar_alertas_para_agregados, recalibrar_alertas_tensao
│   │   │   ├── motor.py                # avaliar_empresa(empresa_id) — orquestra tri-state
│   │   │   ├── models.py               # Alerta, ConfiguracaoRegra, SeveridadeAlerta, EstadoAlerta
│   │   │   ├── labels.py               # rotular_regra(nome)
│   │   │   ├── views.py / serializers.py / urls.py
│   │   │   └── tests/
│   │   ├── coleta/                     # Pipeline Celery (coleta → ingestão → alertas)
│   │   │   ├── tasks.py                # sincronizar_conta_provedor, avaliar_alertas_diarios, limpar_leituras_expiradas
│   │   │   ├── ingestao.py             # ServicoIngestao + ingerir_ciclo (idempotente)
│   │   │   ├── signals.py              # post_save/post_delete em ContaProvedor → PeriodicTask
│   │   │   ├── models.py               # LogColeta
│   │   │   └── apps.py                 # ColetaConfig.ready() conecta signals + post_migrate
│   │   ├── core/                       # Configuração por empresa + base de API + dashboard
│   │   │   ├── api.py                  # EmpresaModelViewSet / EmpresaReadOnlyViewSet / EmpresaListUpdateViewSet
│   │   │   ├── dashboard.py            # APIViews agregados (kpis, geração horária, etc.)
│   │   │   ├── models.py               # ConfiguracaoEmpresa
│   │   │   └── serializers.py / views.py / urls.py
│   │   ├── empresas/                   # Tenant raiz
│   │   │   ├── models.py               # Empresa + EscopoEmpresa mixin + manager
│   │   │   ├── middleware.py           # EmpresaMiddleware (injeta request.empresa)
│   │   │   └── admin.py / serializers.py / views.py / urls.py
│   │   ├── garantia/                   # Garantia (1:1 com Usina)
│   │   ├── inversores/                 # Inversor (FK Usina)
│   │   ├── monitoramento/              # LeituraUsina, LeituraInversor (append-only)
│   │   ├── notificacoes/               # RegraNotificacao, EntregaNotificacao, EndpointWebhook
│   │   ├── provedores/                 # Integração com provedores externos
│   │   │   ├── adapters/
│   │   │   │   ├── base.py             # BaseAdapter, DadosUsina, DadosInversor, Capacidades, MpptString
│   │   │   │   ├── registry.py         # @registrar + adapter_para(tipo)
│   │   │   │   ├── unidades.py         # kw/kwh/v/a/hz/temp_c/ts_ms_para_datetime
│   │   │   │   ├── solis/              # adapter.py + autenticacao.py + consultas.py + tests/
│   │   │   │   ├── hoymiles/           # idem + protobuf.py
│   │   │   │   ├── fusionsolar/
│   │   │   │   ├── solarman/
│   │   │   │   ├── auxsol/
│   │   │   │   └── foxess/
│   │   │   ├── cripto.py               # Fernet criptografar/descriptografar + parsear_exp_jwt
│   │   │   ├── models.py               # ContaProvedor, TipoProvedor, StatusSincronizacao
│   │   │   ├── apps.py                 # ProvedoresConfig.ready() importa todos os adapters
│   │   │   ├── tasks.py / management/commands/
│   │   │   └── tests/
│   │   ├── superadmin/                 # Endpoints cross-tenant (papel=superadmin)
│   │   ├── usinas/                     # Usina (FK ContaProvedor) + geocode
│   │   │   ├── models.py               # Usina + TipoEquipamento + TensaoNominalV
│   │   │   ├── geocode.py              # Nominatim por CEP/endereço
│   │   │   └── management/commands/geocode_usinas.py
│   │   └── usuarios/                   # Usuario (AbstractUser) + permissions
│   ├── config/
│   │   ├── settings/                   # base.py, dev.py, prod.py
│   │   ├── urls.py                     # Roteamento raiz /api/*
│   │   ├── celery.py                   # app Celery
│   │   ├── wsgi.py / asgi.py
│   ├── scripts/                        # Scripts pontuais (não testes)
│   ├── conftest.py                     # Fixtures pytest globais
│   ├── manage.py
│   ├── pyproject.toml                  # Ruff + pytest config
│   ├── requirements.txt / requirements-dev.txt
│   ├── Dockerfile
│   └── .env                            # NÃO commitado (criar a partir de .env.example)
│
├── frontend/                           # Vite + React 19 + TS + Tailwind v4 + shadcn
│   ├── src/
│   │   ├── main.tsx                    # Entry — QueryClientProvider + TooltipProvider + RouterProvider
│   │   ├── index.css                   # Tailwind v4 @theme com CSS vars do shadcn
│   │   ├── routes/
│   │   │   ├── router.tsx              # createBrowserRouter — todas as rotas
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── SuperadminRoute.tsx
│   │   ├── pages/                      # Páginas top-level (1 pasta por domínio)
│   │   │   ├── auth/LoginPage.tsx
│   │   │   ├── dashboard/DashboardPage.tsx
│   │   │   ├── usinas/{UsinasPage,UsinaDetalhePage}.tsx
│   │   │   ├── alertas/{AlertasPage,AlertaDetalhePage}.tsx
│   │   │   ├── garantias/GarantiasPage.tsx
│   │   │   ├── provedores/ProvedoresPage.tsx
│   │   │   ├── notificacoes/{NotificacoesPage,GestaoNotificacoesPage}.tsx
│   │   │   ├── usuarios/UsuariosPage.tsx
│   │   │   ├── configuracoes/ConfiguracoesPage.tsx
│   │   │   ├── configuracao/RegrasPage.tsx
│   │   │   ├── empresas/               # superadmin only (EmpresasPage, EmpresaDetalhePage, EmpresaForm, ...)
│   │   │   └── docs/                   # /docs do produto — DocsHome, DocsComoFuncionaPage, DocsRegrasPage, …
│   │   ├── features/                   # Hooks/API client por domínio (camada de dados)
│   │   │   ├── auth/{token-store,useAuth,useIsSuperadmin}.ts
│   │   │   ├── alertas/api.ts          # useAlertas, useAlerta, useResolverAlerta, useReconhecerAlerta
│   │   │   ├── usinas/api.ts
│   │   │   ├── coleta/
│   │   │   ├── configuracoes/
│   │   │   ├── dashboard/
│   │   │   ├── garantias/
│   │   │   ├── notificacoes/
│   │   │   ├── provedores/
│   │   │   ├── superadmin/
│   │   │   └── usuarios/
│   │   ├── components/
│   │   │   ├── ui/                     # shadcn primitives (button, input, dialog, …)
│   │   │   ├── layout/                 # AppLayout.tsx (sidebar + main), DocsLayout.tsx
│   │   │   ├── trylab/                 # Tema "trylab" (Sidebar, SunBackground, UserMenu, …)
│   │   │   ├── docs/                   # docs-data.ts (sidebar) + DocsContent.tsx (primitives)
│   │   │   ├── dashboard/ alertas/ usinas/ garantias/ provedores/ notificacoes/ usuarios/
│   │   │   ├── configuracao-regras/
│   │   │   ├── icons/
│   │   │   ├── PageHeader.tsx / SeveridadeBadge.tsx / ScrollToTop.tsx
│   │   ├── hooks/                      # Hooks compartilhados (use-document-title, use-mobile, use-alertas-stats, …)
│   │   ├── lib/
│   │   │   ├── api.ts                  # axios instance + JWT bearer + refresh interceptor
│   │   │   ├── types.ts                # Tipos compartilhados (Paginated<T>, …)
│   │   │   ├── format.ts / utils.ts / constants.ts / provedores.ts
│   │   ├── types/                      # Tipos por domínio (alertas.ts, usinas.ts, …)
│   │   └── styles/trylab.css
│   ├── public/
│   ├── dist/                           # Build de prod (gerado por vite build)
│   ├── index.html
│   ├── package.json / package-lock.json
│   ├── vite.config.ts                  # Plugins react + tailwindcss + proxy /api
│   ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
│   ├── eslint.config.js
│   ├── components.json                 # shadcn config
│   ├── nginx.conf                      # usado pelo stage prod do Dockerfile
│   └── Dockerfile                      # multi-stage dev/prod
│
├── docs/                               # Documentação técnica do projeto (não /docs do produto)
│   ├── PLANO.md
│   ├── bugs/                           # Bugs ativos + resolvidos/
│   └── configuracao-regras/            # Decisões R1/R2 sobre /configuracao/regras
│
├── .planning/                          # Artefatos do GSD (planner/executor)
│   └── codebase/                       # Documentos deste mapper
│
├── docker-compose.yml                  # db, redis, backend, worker, beat, frontend
├── docker-compose.override.yml         # Overrides locais
├── Makefile                            # up/down/logs/migrate/test/lint/fmt
├── CLAUDE.md                           # Instruções principais do projeto
└── monitoramento_firmasolar.pem        # NÃO commitar — ignorado
```

## Directory Purposes

**`backend/apps/`:**
- Purpose: aplicações Django por domínio de negócio (1 app = 1 conjunto coeso de models, views, urls, serializers)
- Contains: 12 apps — `core`, `empresas`, `usuarios`, `usinas`, `inversores`, `provedores`, `monitoramento`, `alertas`, `notificacoes`, `garantia`, `coleta`, `superadmin`
- Key files: `models.py`, `views.py`, `serializers.py`, `urls.py`, `apps.py` em cada app

**`backend/apps/provedores/adapters/`:**
- Purpose: integração com provedores externos. 1 subpacote por provedor, contrato comum em `base.py`
- Contains: `base.py` (ABC + dataclasses), `registry.py` (`@registrar`), `unidades.py` (conversões), 6 subpacotes (`solis`, `hoymiles`, `fusionsolar`, `solarman`, `auxsol`, `foxess`)
- Key files: cada adapter tem `adapter.py` (BaseAdapter concretizado), `autenticacao.py` (login/HMAC), `consultas.py` (HTTP raw), `tests/` (fixtures reais)

**`backend/apps/alertas/regras/`:**
- Purpose: 1 arquivo por regra de alerta. Decorador `@registrar` popula registry consumido pelo motor
- Contains: `base.py` + 12 regras (`sem_comunicacao`, `sobretensao_ac`, `subtensao_ac`, `frequencia_anomala`, `temperatura_alta`, `inversor_offline`, `string_mppt_zerada`, `dado_eletrico_ausente`, `sem_geracao_horario_solar`, `subdesempenho`, `queda_rendimento`, `garantia_vencendo`) + helper `_helpers.py`
- Key files: `base.py` (`Regra`, `RegraUsina`, `RegraInversor`, `Anomalia`)

**`backend/apps/coleta/`:**
- Purpose: pipeline assíncrono (coleta → ingestão → alertas)
- Contains: `tasks.py`, `ingestao.py`, `signals.py`, `models.py` (LogColeta)
- Key files: `tasks.py::sincronizar_conta_provedor` (orquestrador), `ingestao.py::ingerir_ciclo` (atômico)

**`backend/config/`:**
- Purpose: configuração do projeto Django (não confundir com `core` que é app de domínio)
- Contains: `settings/{base,dev,prod}.py`, `urls.py`, `celery.py`, `wsgi.py`, `asgi.py`
- Key files: `settings/base.py` (configuração comum), `urls.py` (roteamento raiz)

**`frontend/src/pages/`:**
- Purpose: páginas top-level renderizadas pelo router. 1 pasta por domínio
- Contains: 1 ou mais componentes `*.tsx` por domínio; convenção `XPage.tsx` para tela e `XDetalhePage.tsx` para detalhe
- Key files: `dashboard/DashboardPage.tsx`, `usinas/UsinasPage.tsx`, etc.

**`frontend/src/features/`:**
- Purpose: camada de dados/lógica do domínio. Cada feature expõe hooks que encapsulam TanStack Query + axios
- Contains: `api.ts` (hooks) por domínio; `auth/` tem `token-store.ts`, `useAuth.ts`, `useIsSuperadmin.ts`
- Key files: `auth/useAuth.ts` (login/logout, `GET /usuarios/me/`), `alertas/api.ts`

**`frontend/src/components/`:**
- Purpose: componentes reutilizáveis
- Contains: `ui/` (shadcn primitives), `layout/` (`AppLayout`, `DocsLayout`), `trylab/` (tema custom), pastas por domínio (`alertas/`, `usinas/`, …), `docs/` (primitives da documentação)
- Key files: `layout/AppLayout.tsx`, `trylab/Sidebar.tsx`

**`frontend/src/lib/`:**
- Purpose: utilitários compartilhados (não específicos de domínio)
- Contains: `api.ts` (axios), `types.ts` (tipos compartilhados), `format.ts`, `utils.ts`, `constants.ts`, `provedores.ts`
- Key files: `api.ts` (cliente HTTP central com JWT + refresh)

**`docs/`:**
- Purpose: documentação técnica interna (decisões, bugs, plano) — NÃO confundir com `/docs` do produto (em `frontend/src/pages/docs/`)
- Contains: `PLANO.md` (status por fase), `bugs/` (ativos + `resolvidos/`), `configuracao-regras/` (decisões R1/R2)
- Generated: No
- Committed: Yes

**`.planning/codebase/`:**
- Purpose: documentos gerados por `/gsd-map-codebase` (este mapper) consumidos pelo planner/executor
- Contains: STACK.md, INTEGRATIONS.md, ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md
- Generated: Yes (por agente)
- Committed: opcional

## Key File Locations

**Entry Points:**
- `backend/manage.py`: CLI Django
- `backend/config/urls.py`: roteamento HTTP raiz (`/api/*`)
- `backend/config/celery.py`: app Celery `monitoramento`
- `backend/apps/coleta/tasks.py:51`: `sincronizar_conta_provedor` (task principal)
- `backend/apps/alertas/motor.py:265`: `avaliar_empresa` (motor de alertas)
- `frontend/src/main.tsx`: bootstrap React + providers
- `frontend/src/routes/router.tsx`: definição de todas as rotas SPA

**Configuration:**
- `backend/config/settings/base.py`: configuração comum (DRF, JWT, Celery, Postgres, Fernet)
- `backend/config/settings/dev.py`: overrides de dev
- `backend/config/settings/prod.py`: overrides de prod
- `backend/pyproject.toml`: Ruff (line-length 100, py312) + pytest (`--reuse-db`)
- `backend/.env`: variáveis de ambiente (não commitado)
- `docker-compose.yml`: serviços `db`, `redis`, `backend`, `worker`, `beat`, `frontend`
- `frontend/vite.config.ts`: plugins react + tailwindcss, proxy `/api` → backend, alias `@/*`
- `frontend/tsconfig.json`: paths `@/*` → `./src/*`
- `frontend/components.json`: shadcn (style `radix-nova`, icons lucide)
- `Makefile`: `up`, `down`, `migrate`, `test`, `lint`, `fmt`, `shell`, …

**Core Logic — Multi-tenancy:**
- `backend/apps/empresas/models.py:39`: `EscopoEmpresa` mixin (FK `empresa` + manager `.da_empresa()`)
- `backend/apps/empresas/middleware.py:8`: `EmpresaMiddleware` (injeta `request.empresa`)
- `backend/apps/core/api.py:31`: `EmpresaQuerysetMixin` + `EmpresaModelViewSet` (enforce em ViewSet)
- `backend/apps/usuarios/permissions.py`: `PertenceEmpresa`, `AdminEmpresaOuSomenteLeitura`, `EhSuperadmin`

**Core Logic — Adapters:**
- `backend/apps/provedores/adapters/base.py`: contrato `BaseAdapter` + dataclasses
- `backend/apps/provedores/adapters/registry.py`: `@registrar` + `adapter_para(tipo)`
- `backend/apps/provedores/adapters/unidades.py`: conversões para unidades canônicas
- `backend/apps/provedores/apps.py:9-20`: `ready()` força import dos 6 adapters
- `backend/apps/provedores/cripto.py`: Fernet `criptografar`/`descriptografar` + `parsear_exp_jwt`

**Core Logic — Coleta:**
- `backend/apps/coleta/tasks.py`: tasks Celery (`sincronizar_conta_provedor`, `avaliar_alertas_diarios`, `limpar_leituras_expiradas`)
- `backend/apps/coleta/ingestao.py`: `ServicoIngestao` + `ingerir_ciclo` (idempotente, `@transaction.atomic`)
- `backend/apps/coleta/signals.py`: sync `ContaProvedor` ↔ `PeriodicTask`

**Core Logic — Alertas:**
- `backend/apps/alertas/motor.py`: `avaliar_empresa` (tri-state, agregação por usina)
- `backend/apps/alertas/regras/base.py`: `Regra`, `RegraUsina`, `RegraInversor`, `Anomalia`, `@registrar`
- `backend/apps/alertas/models.py:43`: `Alerta` com `UniqueConstraint` parcial
- `backend/apps/alertas/models.py:156`: `ConfiguracaoRegra` (override por empresa)

**Testing:**
- `backend/conftest.py`: fixtures pytest globais
- `backend/apps/provedores/adapters/*/tests/`: testes por adapter (fixtures reais)
- `backend/apps/<dominio>/tests/`: testes do domínio
- `backend/pyproject.toml::[tool.pytest.ini_options]`: configuração

## Naming Conventions

**Files (Python):**
- snake_case sem acento/cedilha: `sem_comunicacao.py`, `garantia_vencendo.py`, `temperatura_alta.py`
- Apps Django sem acento: `notificacoes` (não `notificações`), `alertas`, `garantia`
- Tasks Celery vivem em `tasks.py`; signals em `signals.py`; modelos em `models.py`

**Files (Frontend TS/TSX):**
- Components: PascalCase `.tsx` — `AppLayout.tsx`, `UsinasPage.tsx`, `SeveridadeBadge.tsx`
- Hooks/utilities: kebab-case `.ts` ou `use-*` — `use-document-title.ts`, `use-alertas-stats.ts`, `token-store.ts`
- Feature data layers: `features/<dominio>/api.ts`
- Tipos: `types/<dominio>.ts`

**Diretórios:**
- Backend apps: PT-BR snake_case sem acento (`alertas`, `provedores`, `usinas`, `monitoramento`, `garantia`, `notificacoes`)
- Frontend pages/features/components: PT-BR (`alertas`, `usinas`, `configuracoes`)
- Adapters: nome do provedor em minúsculas (`solis`, `hoymiles`, `fusionsolar`, `solarman`, `auxsol`, `foxess`)

**Models (Django):**
- PascalCase em PT-BR: `Empresa`, `Usina`, `Inversor`, `ContaProvedor`, `LogColeta`, `LeituraUsina`, `LeituraInversor`, `Alerta`, `Garantia`, `RegraNotificacao`, `EntregaNotificacao`, `EndpointWebhook`
- Choices class: PascalCase + sufixo `TextChoices` ou `IntegerChoices` — `SeveridadeAlerta`, `EstadoAlerta`, `TipoProvedor`, `StatusSincronizacao`, `TensaoNominalV`

**Campos de model:**
- PT-BR snake_case para domínio: `nome`, `capacidade_kwp`, `medido_em`, `aberto_em`, `severidade`, `papel`, `intervalo_coleta_minutos`
- Inglês para universais: `id`, `is_active`, `created_at`, `updated_at`, `slug`, `url`, `secret`, `api_key`, `api_secret`, `config`, `extra`, `raw`
- Campos do `AbstractUser` preservam inglês: `username`, `email`, `password`, `first_name`, `last_name`

**URLs API:**
- PT-BR plural: `/api/usinas/`, `/api/alertas/`, `/api/provedores/`, `/api/notificacoes/`, `/api/empresas/`, `/api/usuarios/`
- Subrotas em PT-BR: `/api/alertas/configuracao-regras/`, `/api/usinas/geocode/`
- Auth/Swagger preservam termos universais: `/api/auth/token/`, `/api/schema/swagger/`

**Enum values:**
- PT-BR minúsculo: `aberto`, `resolvido`, `reconhecido`, `critico`, `aviso`, `info`, `online`, `offline`, `administrador`, `operacional`, `superadmin`, `monofasico`, `bifasico`, `trifasico`

**Adapter providers:**
- Sempre minúsculas, sem acento, sem espaço — match com `TipoProvedor.choices`: `solis`, `hoymiles`, `fusionsolar`, `solarman`, `auxsol`, `foxess`

## Where to Add New Code

**Nova feature de domínio (entidade nova):**
- Model: `backend/apps/<dominio>/models.py` — herdar `EscopoEmpresa` se for tenant-scoped
- Migration: `make makemigrations && make migrate`
- Serializer: `backend/apps/<dominio>/serializers.py`
- ViewSet: `backend/apps/<dominio>/views.py` — herdar de `EmpresaModelViewSet`/`EmpresaReadOnlyViewSet` em `backend/apps/core/api.py`
- URL: `backend/apps/<dominio>/urls.py` (DRF router) + incluir em `backend/config/urls.py`
- Frontend hook: `frontend/src/features/<dominio>/api.ts` (TanStack Query + `api` de `lib/api.ts`)
- Frontend page: `frontend/src/pages/<dominio>/<Dominio>Page.tsx`
- Registrar rota: `frontend/src/routes/router.tsx`
- Adicionar no menu: `frontend/src/components/trylab/Sidebar.tsx` (e `NAV` em `AppLayout` se houver mapping de título)
- Testes: `backend/apps/<dominio>/tests/`
- Doc do produto: `frontend/src/pages/docs/*.tsx` + `frontend/src/components/docs/docs-data.ts`

**Nova regra de alerta:**
- Arquivo: `backend/apps/alertas/regras/<nome>.py` — subclasse `RegraUsina` ou `RegraInversor`, decorador `@registrar`, definir `nome`, `severidade_padrao`, implementar `avaliar(alvo, leitura, config) -> Anomalia | False | None`
- Import: `backend/apps/alertas/motor.py::_carregar_regras` (adicionar `from apps.alertas.regras import <nome>  # noqa: F401`)
- Threshold configurável: adicionar campo em `ConfiguracaoEmpresa` (`backend/apps/core/models.py`) ou `Usina`/`Inversor`
- Doc do produto: card em `frontend/src/pages/docs/DocsRegrasPage.tsx` e tabela em `DocsConfiguracoesPage.tsx`
- Aparece automaticamente em `/configuracao/regras` (via `regras_registradas()`) — sem migration ou seed

**Novo provedor:**
- Pacote: `backend/apps/provedores/adapters/<nome>/{__init__.py, autenticacao.py, consultas.py, adapter.py, tests/}`
- Adapter: subclasse `BaseAdapter`, decorador `@registrar`, definir `tipo`, `capacidades`, implementar `buscar_usinas`/`buscar_inversores`/(opcional) `obter_cache_token`/`recalibrar_usinas`
- Enum: adicionar valor em `backend/apps/provedores/models.py::TipoProvedor`
- Import obrigatório: `backend/apps/provedores/apps.py::ProvedoresConfig.ready()`
- Testes: fixtures reais sanitizadas em `tests/`
- Doc do produto: entrada em `frontend/src/pages/docs/DocsProvedoresPage.tsx`

**Nova task Celery:**
- Function: `backend/apps/<dominio>/tasks.py` com `@shared_task`
- Agendamento estático: criar `PeriodicTask`/`CrontabSchedule` no `post_migrate` do app (padrão usado em `backend/apps/coleta/signals.py::garantir_tasks_diarias`)
- Agendamento dinâmico (por instância): usar signals `post_save`/`post_delete` (padrão de `backend/apps/coleta/signals.py::sincronizar_agendamento`)

**Novo componente UI (shadcn):**
- `cd frontend && npx shadcn@latest add <componente>` — gera em `frontend/src/components/ui/`

**Novo hook compartilhado (frontend):**
- `frontend/src/hooks/use-<nome>.ts` — kebab-case com prefixo `use-`

**Novo tipo de domínio (frontend):**
- `frontend/src/types/<dominio>.ts`

**Página de docs do produto nova:**
- `frontend/src/pages/docs/Docs<Topico>Page.tsx`
- Registrar em `frontend/src/routes/router.tsx` (sob `path: "docs"`)
- Adicionar tópico em `frontend/src/components/docs/docs-data.ts` (sidebar)
- Link em `DocsHomePage.tsx`

## Special Directories

**`backend/apps/*/migrations/`:**
- Purpose: histórico de schema gerado por Django
- Generated: Yes (via `make makemigrations`)
- Committed: Yes (parte do versionamento de schema)
- Notas: ruff ignora migrations (`extend-exclude = ["migrations"]`)

**`backend/apps/*/management/commands/`:**
- Purpose: comandos `manage.py` customizados
- Generated: No (manual)
- Committed: Yes
- Atual: `fechar_alertas_obsoletos`, `migrar_alertas_para_agregados`, `recalibrar_alertas_tensao` (alertas); `atualizar_expira_em_tokens` (provedores); `geocode_usinas` (usinas); `criar_superadmin` (superadmin)

**`frontend/node_modules/`:**
- Purpose: deps npm
- Generated: Yes (via `npm install`)
- Committed: No (gitignored)

**`frontend/dist/`:**
- Purpose: build de produção do Vite (servido por Nginx em prod)
- Generated: Yes (via `npm run build`)
- Committed: No (gitignored)

**`backend/.pytest_cache/` e `backend/.ruff_cache/`:**
- Purpose: caches de ferramentas
- Generated: Yes
- Committed: No (gitignored)

**`.planning/`:**
- Purpose: artefatos do GSD (planner/executor/codebase-mapper)
- Generated: Yes (por agentes)
- Committed: depende do fluxo do time

**`docs/`:**
- Purpose: documentação técnica do projeto
- Generated: No (manual)
- Committed: Yes
- Subdir `bugs/resolvidos/`: bugs arquivados após fix

---

*Structure analysis: 2026-05-12*
