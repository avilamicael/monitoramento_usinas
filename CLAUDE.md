# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Projeto e comunicação em PT-BR. Nomes de domínio (modelos, tabelas, campos, URLs, enums) em PT-BR; termos universais (`id`, `is_active`, `created_at`, `slug`, `url`, `secret`, `api_key`, `api_secret`, `config`, `extra`, `raw`, `username`/`email`/`password` do `AbstractUser`) e nomes de libs/componentes React em inglês.

## Visão geral

Sistema multi-empresa (multi-tenant) de monitoramento de usinas solares. Cada `Empresa` cadastra suas usinas, conecta credenciais de provedores (Huawei FusionSolar, Solis, Sungrow…), e o backend coleta dados, dispara alertas e roteia notificações por canal (web, e-mail, webhook; WhatsApp planejado).

Monorepo:

- `backend/` — Django 5 + DRF + Celery, em `:8000`.
- `frontend/` — Vite + React 19 + TypeScript + Tailwind v4 + shadcn, em `:5173`.
- `docker-compose.yml` — sobe `db` (Postgres 16), `redis`, `backend`, `worker`, `beat`, `frontend`. Nginx fica fora (na VPS).

## Comandos mais usados

```bash
# Stack completo
make up                      # docker compose up -d
make logs                    # tail dos serviços
make down

# Backend
make migrate
make makemigrations
make createsuperuser
make test
make shell

# Rodar um teste específico
docker compose exec backend pytest apps/provedores/tests/test_adapters.py::test_foo -x

# Lint / formatação
make lint                    # ruff (backend) + eslint (frontend)
make fmt                     # ruff format + prettier

# Frontend isolado (sem Docker)
cd frontend && npm install && npm run dev
```

`.env` esperados: `backend/.env` (de `backend/.env.example`) e opcionalmente `.env` na raiz (docker-compose). Dev: `DJANGO_SETTINGS_MODULE=config.settings.dev`; prod: `config.settings.prod`.

Swagger: `http://localhost:8000/api/schema/swagger/`.

## Arquitetura — o que precisa ser lido junto

### Multi-tenancy por `empresa_id` (shared schema)

- `apps/empresas/models.py` define `Empresa` (UUID) + `EscopoEmpresa` (abstract) + `EscopoEmpresaManager` com `.da_empresa(empresa)`.
- **Toda model com escopo de empresa herda de `EscopoEmpresa`**, que injeta `empresa = FK(Empresa)`. Exemplos: `usinas.Usina`, `provedores.ContaProvedor`, `monitoramento.LeituraUsina`, `alertas.Alerta`, `notificacoes.*`, `garantia.Garantia`.
- `apps/empresas/middleware.py::EmpresaMiddleware` injeta `request.empresa` a partir de `request.user.empresa` após o JWT. **Views/querysets devem filtrar por `request.empresa` — nunca confiar em `empresa_id` vindo do cliente.**
- App `core` contém `ConfiguracaoEmpresa` (1:1 com `Empresa`): `garantia_padrao_meses`, `alerta_sem_comunicacao_minutos`, `parar_alerta_apos_dias`, `subdesempenho_limite_pct`. É onde vive o "quantos dias sem comunicar para parar o alerta".

### Integração com provedores — padrão adapter

Centro em `apps/provedores/adapters/`:

- `base.py::BaseAdapter` é a interface: `listar_usinas()` e `buscar_usina(id_externo)` retornam `SnapshotUsina` (dataclass normalizada).
- `registry.py` guarda `tipo → classe` via decorator `@registrar`. Use `adapter_para(tipo)` para instanciar.
- Cada provedor é um arquivo: `fusion.py`, `solis.py`, `sungrow.py`. **Para adicionar um provedor novo**: criar arquivo, decorar com `@registrar`, definir `tipo`, implementar os 2 métodos, adicionar o valor ao enum `TipoProvedor` em `apps/provedores/models.py`.
- Credenciais ficam em `provedores.ContaProvedor` (escopo de empresa). `extra: JSONField` acomoda campos específicos de cada API (tokens, region, etc.).
- **Polling, retry, persistência e enfileiramento ficam fora do adapter.** O adapter só traduz. O worker Celery (`apps/provedores/tasks.py::sincronizar_conta_provedor`) orquestra — agendamento via `django-celery-beat` (admin).

Existem provedores já implementados fora deste repo — portar para essa estrutura em vez de reescrever.

### Alertas e notificações

- `alertas.Alerta` é o evento detectado (`severidade` × `status` × `tipo`). Aberto pelo worker ao analisar `LeituraUsina` contra `ConfiguracaoEmpresa`.
- `notificacoes.RegraNotificacao` define para quem / qual canal mandar quando um alerta casa (por `severidades` e/ou `tipos_alerta`). `EntregaNotificacao` é o log de entrega.
- `notificacoes.EndpointWebhook` é webhook de saída — sistema envia eventos para URL do cliente com HMAC do `secret`.
- MVP: canais `web` e `email`. `whatsapp` está no enum mas não implementado.

### Frontend

- Entry: `src/main.tsx` → `QueryClientProvider` → `RouterProvider`.
- Roteamento: `src/routes/router.tsx` com `ProtectedRoute` protegendo o layout. Rota pública: `/login`.
- Layout `src/components/layout/AppLayout.tsx` é a sidebar + `<Outlet/>`. Items `adminOnly` só aparecem se `user.papel === "administrador"` (vindo de `GET /api/usuarios/me/`).
- Auth em `src/features/auth/`: `token-store.ts` (localStorage), `useAuth.ts` (hook), `lib/api.ts` (axios com refresh automático do JWT).
- shadcn via `components.json`, CSS vars em `src/index.css` (Tailwind v4 `@theme`). Gerar componente: `npx shadcn@latest add <componente>`.
- Alias `@/*` → `src/*` (em `vite.config.ts` e `tsconfig.json`).
- Dev: `vite.config.ts` faz proxy de `/api` para `http://localhost:8000` (ou `VITE_API_PROXY` no Docker, apontando para `http://backend:8000`).

### Fluxo típico de uma feature nova

1. Backend: model em `apps/<dominio>/models.py` (herdar `EscopoEmpresa` se aplicável) → `makemigrations` → view DRF com `permission_classes=[PertenceEmpresa]` (ou `AdminEmpresaOuSomenteLeitura`) de `apps.usuarios.permissions` → router em `apps/<dominio>/urls.py` → incluir em `config/urls.py`.
2. Frontend: hook em `src/features/<dominio>/` com `@tanstack/react-query` + `api` de `lib/api.ts` → página em `src/pages/<dominio>/` → registrar no `router.tsx` e no `NAV` de `AppLayout.tsx`.
3. **Sempre** filtrar queryset por `request.empresa`; em views DRF, sobrescrever `get_queryset`: `return Model.objects.da_empresa(self.request.empresa)`.

## Convenção de nomes (opção híbrida)

- **PT-BR**: nomes de apps, modelos (`Empresa`, `Usina`, `Alerta`), campos de domínio (`nome`, `capacidade_kwp`, `medido_em`, `aberto_em`, `severidade`, `papel`), URLs de API (`/api/empresas/`, `/api/usinas/`), valores de enum (`administrador`, `operacional`, `aberto`, `resolvido`, `critico`), rotas do frontend, labels da UI, docstrings.
- **Inglês** (universal/técnico): `id`, `is_active`, `created_at`, `updated_at`, `slug`, `url`, `secret`, `api_key`, `api_secret`, `config`, `extra`, `raw`, nomes próprios de libs/provedores (Fusion, Solis, Sungrow, Webhook, JWT, Celery), componentes/hooks React (`AppLayout`, `useAuth`, `DashboardPage`). Do `AbstractUser` do Django também: `username`, `email`, `password`, `first_name`, `last_name`.
- Apps e módulos Python sem acento/cedilha (`notificacoes`, não `notificações`) — evita dor de import. Strings e UI podem ter acento normalmente.

## Gotchas

- Python 3.12 dentro do container (host tem 3.10) — prefira `docker compose exec backend ...`.
- `AUTH_USER_MODEL = "usuarios.Usuario"` — nunca use `django.contrib.auth.models.User`.
- `TIME_ZONE = "America/Sao_Paulo"`, `USE_TZ = True`. Datetimes sempre aware.
- Ruff é a fonte única de lint/format no backend (`pyproject.toml`). Migrations ignoradas.
- JWT: access 30min, refresh 7 dias, com rotação. Endpoints: `POST /api/auth/token/` e `POST /api/auth/token/refresh/`.
- `ContaProvedor.senha`/`api_secret` ficam em texto por ora — antes de expor em prod, encriptar. **Não commitar credenciais de provedor em seeds.**
- Nginx instalado na VPS (fora do compose). O `frontend/Dockerfile` tem stage `prod` com Nginx embutido (serve `dist/`), mas no setup atual quem fala com a internet é o Nginx da VPS, fazendo proxy para `backend:8000` e servindo o build estático.
