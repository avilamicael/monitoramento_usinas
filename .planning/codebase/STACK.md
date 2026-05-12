# Technology Stack

**Analysis Date:** 2026-05-12

## Languages

**Primary:**
- Python 3.12 — backend (Django/DRF/Celery). Pinned via `python:3.12-slim` base image in `backend/Dockerfile` and `target-version = "py312"` in `backend/pyproject.toml`.
- TypeScript ~6.0 — frontend (React 19 + Vite). See `frontend/package.json`.

**Secondary:**
- SQL (PostgreSQL 16 dialect) — migrations under `backend/apps/*/migrations/`.
- CSS — Tailwind v4 directives + shadcn theme tokens in `frontend/src/index.css` and `frontend/src/styles/trylab.css`.
- Dockerfile, Compose YAML, Makefile — orchestration in repo root and `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`, `docker-compose.override.yml`, `Makefile`.

## Runtime

**Environment:**
- Backend container: `python:3.12-slim` (`backend/Dockerfile`). Host machine has Python 3.10 — dev direto sem Docker quebra; sempre via `docker compose exec backend ...`.
- Frontend container (dev): `node:20-alpine`, multi-stage with `deps → dev | builder → prod (nginx:1.27-alpine)` (`frontend/Dockerfile`).
- Production web server: `gunicorn 23.*` (`config.wsgi:application`, 3 workers — `backend/Dockerfile` CMD).
- Reverse proxy in production: Nginx fora do compose, na VPS. `frontend/Dockerfile` stage `prod` também tem Nginx 1.27-alpine embutido servindo `dist/`.

**Package Manager:**
- Python: `pip` (no Poetry/uv). Two manifests: `backend/requirements.txt` (prod) + `backend/requirements-dev.txt` (extends prod). Build arg `INSTALL_DEV=true` injeta dev deps em dev container.
- Node: `npm` (lockfile `frontend/package-lock.json` presente).

## Frameworks

**Core (backend):**
- Django 5.1.* — `backend/config/settings/base.py`. `AUTH_USER_MODEL = "usuarios.Usuario"`.
- Django REST Framework 3.15.* — viewsets, serializers; `DEFAULT_PERMISSION_CLASSES = IsAuthenticated`.
- djangorestframework-simplejwt 5.3.* — JWT auth (`SIMPLE_JWT` em `base.py`: access 30min, refresh 7d, rotação habilitada).
- django-cors-headers 4.6.* — middleware no topo de `MIDDLEWARE`.
- django-filter 24.* — backend de filtros padrão do DRF.
- drf-spectacular 0.28.* — OpenAPI schema + Swagger UI em `/api/schema/swagger/`.
- Celery 5.4.* + redis broker — `backend/config/celery.py`, `CELERY_BROKER_URL=redis://redis:6379/0`, `CELERY_RESULT_BACKEND=redis://redis:6379/1`.
- django-celery-beat 2.7.* — `CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"` (scheduler em banco, dinâmico via signals).

**Core (frontend):**
- React 19.2.5 + react-dom 19.2.5.
- Vite 8.0.10 + `@vitejs/plugin-react` 6.0.1 — dev server na porta 5173, proxy `/api → backend:8000`.
- TypeScript ~6.0.2 (`ignoreDeprecations: "6.0"`).
- React Router 7.1.1 — `BrowserRouter` via `createBrowserRouter` em `frontend/src/routes/router.tsx`.
- TanStack React Query 5.62.0 — único `QueryClient` em `frontend/src/main.tsx` (staleTime 30s, sem refetch on window focus).
- Tailwind CSS v4.0.0 via `@tailwindcss/vite` 4.0.0 — `@theme` em `frontend/src/index.css`, sem `tailwind.config.*`.
- shadcn 4.7.0 + Radix UI primitives (`@radix-ui/react-*` 1.x/2.x) — `frontend/components.json` define style `radix-nova`, iconLibrary `lucide`, aliases `@/components`, `@/lib`, `@/hooks`.
- react-hook-form 7.74 + zod 3.25 + `@hookform/resolvers` 5.2 — formulários.
- axios 1.7.9 — cliente HTTP em `frontend/src/lib/api.ts` com refresh JWT automático.
- Zustand 5.0.2 — store local (token persistido em localStorage, ver `frontend/src/features/auth/token-store.ts`).
- Recharts 3.8.1 — gráficos (dashboard).
- sonner 2.0.7 — toasts.
- date-fns 4.1.0 — datas/formatação no frontend.
- next-themes 0.4.6 — dark mode.
- lucide-react 0.468.0 — ícones.
- cmdk 1.1.1 — command palette.

**Testing:**
- Backend: pytest 8.* + pytest-django 4.9.* + pytest-cov 6.* + factory-boy 3.3.* (`requirements-dev.txt`). Config em `backend/pyproject.toml` (`DJANGO_SETTINGS_MODULE=config.settings.dev`, `--reuse-db`). Fixtures globais em `backend/conftest.py`.
- Frontend: sem framework de teste configurado em `package.json` (não há vitest/jest/playwright instalados).

**Build/Dev:**
- Ruff 0.8.* — lint + format do backend (`pyproject.toml` `[tool.ruff]`: line-length 100, target py312, select `E,F,W,I,N,UP,B,DJ,SIM,RUF`, ignora `E501`; migrations excluídas).
- ESLint 10.2.1 + typescript-eslint 8.58.2 + eslint-plugin-react-hooks 7.1.1 + eslint-plugin-react-refresh 0.5.2 (`frontend/eslint.config.js`, flat config).
- Prettier 3.4.2 — formatação do frontend.
- ipython 8.* — shell Django interativo.
- django-debug-toolbar 4.4.* — só em dev (`config/settings/dev.py` adiciona em `INSTALLED_APPS` + `MIDDLEWARE`).

## Key Dependencies

**Critical:**
- `cryptography==44.*` — Fernet symmetric encryption de credenciais e tokens de provedores em `apps.provedores.cripto`. Chave em `settings.CHAVE_CRIPTOGRAFIA` (env `CHAVE_CRIPTOGRAFIA`).
- `argon2-cffi==23.*` — hash Argon2id usado no fluxo de login v3 do Hoymiles (`apps/provedores/adapters/hoymiles/autenticacao.py`).
- `astral==3.2.*` — cálculo de nascer/pôr do sol por usina (lat/lon) usado na regra `sem_geracao_horario_solar` (`apps/alertas/regras/`). Fallback: janela fixa em `ConfiguracaoEmpresa`.
- `psycopg[binary]==3.2.*` — driver Postgres (psycopg3, não psycopg2).
- `requests==2.32.*` — cliente HTTP usado por TODOS os adapters de provedores e pelo geocoder Nominatim. `httpx==0.27.*` está no `requirements.txt` mas no momento não aparece importado em código de aplicação.
- `gunicorn==23.*` — WSGI server em prod.

**Infrastructure:**
- `django-environ==0.11.*` — leitura de `.env` em `config/settings/base.py` (`environ.Env.read_env(BASE_DIR / ".env")`).
- `redis==5.2.*` — cliente Python redis (broker + backend Celery).
- `celery[redis]==5.4.*` — orquestração de coleta.

## Configuration

**Environment:**
- `backend/.env` (existe, gitignored) — carregado por `environ.Env.read_env`. Template: `backend/.env.example`. Variáveis: `DJANGO_SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CHAVE_CRIPTOGRAFIA` (Fernet), `POSTGRES_DB/USER/PASSWORD/HOST/PORT`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `EMAIL_BACKEND/HOST/PORT/HOST_USER/HOST_PASSWORD/USE_TLS`, `DEFAULT_FROM_EMAIL`, `LOG_LEVEL`.
- `.env.example` na raiz do repo também presente (não inspecionado em detalhe — provavelmente para compose).
- Settings split: `config/settings/base.py` (compartilhado), `dev.py` (DEBUG + debug-toolbar + CORS_ALLOW_ALL), `prod.py` (HSTS, SECURE_PROXY_SSL_HEADER, cookies seguros).
- `DJANGO_SETTINGS_MODULE`: `config.settings.dev` no compose, `config.settings.prod` em produção.

**Locale / Timezone:**
- `LANGUAGE_CODE = "pt-br"`, `TIME_ZONE = "America/Sao_Paulo"`, `USE_TZ = True`. Datetimes sempre aware. `CELERY_TIMEZONE = TIME_ZONE`.

**Build:**
- Backend: `backend/pyproject.toml` (Ruff + pytest). `backend/Dockerfile` multistage simples (base com apt deps `build-essential libpq-dev curl`).
- Frontend: `frontend/vite.config.ts` (alias `@ → ./src`, proxy `/api → VITE_API_PROXY || http://localhost:8000`), `frontend/tsconfig.json` referencia `tsconfig.app.json` e `tsconfig.node.json`, `frontend/components.json` config do shadcn, `frontend/eslint.config.js` flat config, `frontend/nginx.conf` config do stage `prod`.

**Frontend env vars:**
- `VITE_API_PROXY` (Vite dev proxy target — default `http://localhost:8000`).
- `VITE_API_URL` (axios `baseURL` — default `/api`, ver `frontend/src/lib/api.ts`).

## Platform Requirements

**Development:**
- Docker + Docker Compose. Stack subida via `make up`. Acesso: backend `http://localhost:8000` (Swagger em `/api/schema/swagger/`), frontend `http://localhost:5173`.
- `make migrate / makemigrations / createsuperuser / test / shell / lint / fmt` empacotam comandos via `docker compose exec`.
- `docker-compose.override.yml` (gitignored) está presente no worktree atual — expõe backend em `:8010` e desabilita serviço `frontend` do compose (front rodado fora do container nesse worktree).

**Production:**
- VPS HostGator BR (Linux, 8GB no `trylab-vps`; alvo de deploy é `monitoramento.trylab.com.br`). Nota: documento `CLAUDE.md` cita VPS com 1.9GB sem swap permanente — caso real é a `trylab-vps` (8GB). O ponto operacional: build do Vite estourou memória em deploy anterior → swap temporário foi solução.
- Nginx na VPS faz proxy `/api → backend:8000` e serve build estático do frontend.
- Overlay `docker-compose.prod.yml` (referenciado em `CLAUDE.md`, não inspecionado aqui) muda serviço `frontend` para `target: prod` (Nginx interno servindo `dist/` copiado para a imagem).
- Banco: Postgres 16 (`postgres:16-alpine`), volume nomeado `postgres_data`.
- Cache/broker: Redis 7 (`redis:7-alpine`).

---

*Stack analysis: 2026-05-12*
