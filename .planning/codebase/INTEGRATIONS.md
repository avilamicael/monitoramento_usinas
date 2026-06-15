# External Integrations

**Analysis Date:** 2026-05-12

## APIs & External Services

### Provedores solares (adapters em `backend/apps/provedores/adapters/`)

Todos consumidos via `requests` (sync HTTP). Cada adapter implementa `BaseAdapter` (`apps/provedores/adapters/base.py`) e é registrado via `@registrar` (`apps/provedores/adapters/registry.py`). Carregamento em boot por `ProvedoresConfig.ready()` em `apps/provedores/apps.py`. Enum de tipos em `apps/provedores/models.py::TipoProvedor`.

**Regra geral:** alertas nativos dos provedores NÃO são consumidos (sistema antigo teve 12.8% churn médio, 46% no Solis). Raw do provedor é salvo em `DadosUsina.raw`/`DadosInversor.raw` para auditoria/debug.

**Solis (Ginlong) — `tipo=solis`:**
- Base URL: `https://www.soliscloud.com:13333` (`adapters/solis/consultas.py`).
- Auth: HMAC-SHA1 stateless por requisição (`Authorization: API <api_key>:<assinatura>`); assina string canônica `POST\n<md5_body>\n<content_type>\n<date>\n<path>` (`adapters/solis/autenticacao.py`).
- Credenciais (`ContaProvedor.credenciais_enc`): `{"api_key": "...", "app_secret": "..."}`.
- Cache token: não usa (stateless).
- Rate limit observado: 3 req/5s. Pausa `_PAUSA_ENTRE_DETALHES_S = 0.4s` entre chamadas N+1 para detalhe elétrico.
- `intervalo_minimo_minutos = 10`.
- Doc: https://www.soliscloud.com/doc/en/solis-cloud-api/

**Hoymiles S-Cloud — `tipo=hoymiles`:**
- Base URL: `https://neapi.hoymiles.com` (auth e dados; `Origin/Referer: https://global.hoymiles.com`).
- Auth: nonce + hash da senha. v1/v2: `md5(senha) + "." + sha256_b64(senha)`; v3: Argon2id hex com salt do servidor. Endpoints `/iam/pub/3/auth/pre-insp` e `/iam/pub/3/auth/login` (`adapters/hoymiles/autenticacao.py`).
- Credenciais: `{"username", "password"}`. Cache: `{"token": "3.xxx..."}` (vive semanas).
- Particularidade: parser protobuf custom para dados elétricos (citado em `CLAUDE.md`).
- `intervalo_minimo_minutos = 10`.

**Huawei FusionSolar — `tipo=fusionsolar`:**
- Base URL: `https://intl.fusionsolar.huawei.com/thirdData` (`adapters/fusionsolar/autenticacao.py`).
- Auth: XSRF session. `POST /login` com `{userName, systemCode}` → cookie `XSRF-TOKEN`. Re-login transparente em 401 / `failCode=305` / mensagem "login".
- Credenciais: `{"username", "system_code"}`. Cache: `{"xsrf_token": "..."}`.
- Unidades: MW → kWp convertido pelo adapter; null-on-offline preservado.
- failCode=407 = pediu janela < 30min — `intervalo_minimo_minutos = 60` (na verdade `60` no código, comentado como `30` em `base.py`).

**Solarman Business — `tipo=solarman`:**
- Base URL: `https://globalpro.solarmanpv.com` (`adapters/solarman/autenticacao.py`).
- Auth: JWT (cookie `tokenKey`) copiado manualmente do browser — login web protegido por Cloudflare Turnstile (não automatizado). Token vive ~60 dias. `validar_token` levanta `ErroAutenticacaoProvedor` quando expirado/próximo da expiração.
- Credenciais (informativo): `{"email", "password"}`. Cache (efetivo): `{"token": "eyJ..."}`.
- Endpoint crítico: `/device-s/device/{id}/stats/day` para campos elétricos (DV1-DV4, AV1, AC1, AF1, APo_t1, Etdy_ge0, AC_RDT_T1).
- `intervalo_minimo_minutos = 10`.

**AuxSol Cloud — `tipo=auxsol`:**
- Base URL: `https://eu.auxsolcloud.com` (`adapters/auxsol/autenticacao.py`).
- Auth: Bearer UUID. `POST /auxsol-api/auth/login` → `{data: {access_token: "uuid"}}`. Token vive 12h (`TOKEN_VALIDADE_S = 43200`); renovação 10min antes de expirar (`_MARGEM_RENOVACAO_S = 600`).
- Credenciais: `{"account", "password"}`. Cache: `{"token": "...", "obtido_em": epoch_s}`.
- `intervalo_minimo_minutos = 10`.

**FoxESS Cloud — `tipo=foxess`:**
- Base URL: `https://www.foxesscloud.com` (`adapters/foxess/consultas.py`).
- Auth: MD5 stateless (cache de hidratação de endpoints).
- Endpoints: `POST /op/v0/plant/list`, `GET /op/v0/plant/detail?id=<stationID>`, `POST /op/v0/device/list`.
- Rate limit: 1 req/s observado; 1440 chamadas por inversor por dia (`errno=40400`).
- `intervalo_minimo_minutos = 15`.
- Doc: https://www.foxesscloud.com/public/i18n/en/OpenApiDocument.html

### Geocoding

**Nominatim (OpenStreetMap):**
- URL: `https://nominatim.openstreetmap.org/search` (`backend/apps/usinas/geocode.py`).
- Auth: nenhuma (sem chave). User-Agent obrigatório: `monitoramento-firmasolar/1.0`.
- Rate limit: 1 req/s por IP (enforced por `Lock` global no processo, `_aplicar_rate_limit`).
- Cache: `lru_cache` em memória do processo.
- Usado pelo endpoint `POST /api/usinas/geocode/` e pelo management command `geocode_usinas`.

## Data Storage

**Databases:**
- PostgreSQL 16 (`postgres:16-alpine` no `docker-compose.yml`).
  - Connection: env `POSTGRES_DB / USER / PASSWORD / HOST / PORT` (defaults `monitoramento / monitoramento / monitoramento / db / 5432`).
  - Client: `psycopg[binary]==3.2.*` via `django.db.backends.postgresql`.
  - Shared-schema multi-tenant: toda model com escopo herda `EscopoEmpresa` (FK `empresa_id`). Ver `apps/empresas/models.py`.
  - Volume nomeado: `postgres_data` (compose).
  - Healthcheck: `pg_isready` a cada 10s.

**Cache / Broker:**
- Redis 7 (`redis:7-alpine`).
  - Broker Celery: `CELERY_BROKER_URL = redis://redis:6379/0`.
  - Result backend Celery: `CELERY_RESULT_BACKEND = redis://redis:6379/1`.
  - Sem Django cache framework configurado (`CACHES` não definido em `base.py`) — caching feito em memória de processo (`lru_cache` no geocoder).
  - Healthcheck: `redis-cli ping` a cada 10s.

**File Storage:**
- Local filesystem apenas. `STATIC_ROOT = BASE_DIR / "staticfiles"`, `MEDIA_ROOT = BASE_DIR / "media"` (`config/settings/base.py`). Sem S3/object storage.

**Token / credential storage:**
- `ContaProvedor.credenciais_enc` e `ContaProvedor.cache_token_enc`: JSON serializado e criptografado com Fernet (`cryptography`), chave em `settings.CHAVE_CRIPTOGRAFIA`. API em `apps/provedores/cripto.py` (`criptografar`, `descriptografar`, `parsear_exp_jwt`).
- Nunca gravar/ler em texto plano. Rotação de chave: descriptografar com antiga, recriptografar com nova em task one-off.

## Authentication & Identity

**App auth (usuários do sistema):**
- JWT via `djangorestframework-simplejwt`. `AUTH_USER_MODEL = "usuarios.Usuario"` (subclasse de `AbstractUser`).
- Endpoints: `POST /api/auth/token/` (`TokenObtainPairView`), `POST /api/auth/token/refresh/` (`TokenRefreshView`) — registrados em `backend/config/urls.py`.
- Config (`SIMPLE_JWT` em `config/settings/base.py`):
  - Access token: 30min.
  - Refresh token: 7 dias.
  - `ROTATE_REFRESH_TOKENS = True`, `BLACKLIST_AFTER_ROTATION = False`.
  - `AUTH_HEADER_TYPES = ("Bearer",)`.
  - `UPDATE_LAST_LOGIN = True`.
- Frontend: `frontend/src/lib/api.ts` injeta `Authorization: Bearer <access>` via interceptor request; interceptor response detecta `401`, dispara refresh único (singleton `refreshing`), reescreve header e re-tenta. Tokens em localStorage (`frontend/src/features/auth/token-store.ts`).
- Multi-tenant: middleware `apps.empresas.middleware.EmpresaMiddleware` (último no `MIDDLEWARE`) injeta `request.empresa` a partir de `request.user.empresa`. Views devem filtrar por `request.empresa`, nunca confiar em parâmetro do cliente.
- Permissions: `IsAuthenticated` global no DRF + `PertenceEmpresa` / `AdminEmpresaOuSomenteLeitura` em `apps.usuarios.permissions`.

**CORS:**
- `django-cors-headers` — `CORS_ALLOWED_ORIGINS` por env. Em dev: `CORS_ALLOW_ALL_ORIGINS = True` (`config/settings/dev.py`). `CORS_ALLOW_CREDENTIALS = True`.

**Provedor auth (terceiros):**
- Ver "APIs & External Services" acima. Estratégias por adapter: HMAC (Solis), nonce+Argon2/JWT-ish (Hoymiles), XSRF session (FusionSolar), Bearer UUID (Auxsol), JWT manual (Solarman), MD5 stateless (Foxess).

## Monitoring & Observability

**Error Tracking:**
- Nenhum (não há Sentry, Rollbar ou similar). Erros são apenas logados.

**Logs:**
- Stdlib `logging` configurado via `LOGGING` em `config/settings/base.py`: handler `console`, formatter `verbose` (`[asctime] LEVEL name — message`). Level controlado por env `LOG_LEVEL` (default `INFO`).
- `docker compose logs -f --tail=200` (alias `make logs`).
- Adapters logam: tempo de chamada (`duracao_ms`), erros de rede, 429 rate-limit, eventos de auth.
- `LogColeta` (`apps/coleta/models.py`) persiste auditoria de cada ciclo de coleta com contadores e status. Bug conhecido: contadores cosmeticamente zerados em alguns cenários (`docs/bugs/`).

**Metrics:**
- Nenhum sistema externo de métricas (sem Prometheus/Datadog/etc).

## CI/CD & Deployment

**Hosting:**
- VPS HostGator BR (`trylab-vps`). Domínios: `monitoramento.trylab.com.br`, `chat.trylab.com.br`.
- Stack containerizada via `docker-compose.yml` + overlay `docker-compose.prod.yml` (não inspecionado aqui).
- Nginx fora do compose, na VPS, faz proxy `/api → backend:8000` e serve build estático do frontend.

**CI Pipeline:**
- Nenhum CI configurado neste repositório (sem `.github/workflows/`, sem `.gitlab-ci.yml`, sem CircleCI).

**Deployment:**
- Backend/worker/beat: bind volume `./backend:/app` → restart do container basta.
- Frontend: rebuild da imagem necessário (não é bind volume em prod; bundle é gerado dentro da imagem stage `prod`).

## Environment Configuration

**Required env vars (`backend/.env`):**
- `DJANGO_SECRET_KEY` — secret do Django.
- `DEBUG` — bool.
- `ALLOWED_HOSTS` — lista.
- `CORS_ALLOWED_ORIGINS` — lista.
- `CHAVE_CRIPTOGRAFIA` — Fernet key (obrigatório para descriptografar credenciais de provedores). Gerar com `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
- `POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_HOST / POSTGRES_PORT`.
- `CELERY_BROKER_URL / CELERY_RESULT_BACKEND`.
- `EMAIL_BACKEND / EMAIL_HOST / EMAIL_PORT / EMAIL_HOST_USER / EMAIL_HOST_PASSWORD / EMAIL_USE_TLS / DEFAULT_FROM_EMAIL`.
- `LOG_LEVEL`.
- `DJANGO_SETTINGS_MODULE` (definido no compose: `config.settings.dev`).

**Required env vars (frontend):**
- `VITE_API_PROXY` (dev container, alvo do proxy `/api`).
- `VITE_API_URL` (opcional; default `/api`).

**Secrets location:**
- `backend/.env` (gitignored, presente localmente).
- `.env.example` template versionado em `backend/.env.example` e `.env.example` (raiz).
- Credenciais de provedores: criptografadas com Fernet em `ContaProvedor.credenciais_enc` e `ContaProvedor.cache_token_enc` (Postgres).
- Chave PEM `monitoramento_firmasolar.pem` (SSH para VPS) presente no worktree mas gitignored — nunca commitar.

## Webhooks & Callbacks

**Outgoing (notificações):**
- Model `apps.notificacoes.models.EndpointWebhook`:
  - `url` (URLField) — destino do webhook.
  - `secret` (CharField 128) — usado para assinar o payload.
  - `tipos_evento` (JSONField) — ex.: `["alerta.aberto"]`.
  - `is_active`.
- Model `apps.notificacoes.models.RegraNotificacao` define canal (`web | email | webhook | whatsapp`), severidades e tipos de alerta que disparam.
- Model `apps.notificacoes.models.EntregaNotificacao` é log de cada tentativa: `canal, destino, status, tentativas, ultimo_erro, enviado_em`.
- Despachante de envio (worker que dispara HTTP POST assinado para webhooks / `send_mail` para email) ainda NÃO implementado — não há código de execução de envio em `apps/notificacoes/` no estado atual (só models, serializers, views REST e migrations). Roadmap.

**Incoming:**
- Nenhum endpoint de webhook receivido (sem ingestão por callback dos provedores — coleta é 100% pull via Celery beat).

**Canal WhatsApp:**
- Reservado no enum `Canal.WHATSAPP` mas marcado "para futuro" no model.

## Email

**Backend:**
- `django.core.mail` configurado via env:
  - Dev: `django.core.mail.backends.console.EmailBackend` (default em `dev.py`).
  - Prod: SMTP via `EMAIL_HOST`, `EMAIL_PORT` (default 587), `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` (default True).
- `DEFAULT_FROM_EMAIL` em env (default `no-reply@monitoramento.local`).
- Uso atual: nenhuma chamada a `send_mail` ou `EmailMessage` encontrada no código de apps — backend está configurado mas não invocado (notificações por email ainda não implementam o envio efetivo).

## Astronomia / Horário Solar

**`astral==3.2.*`** — usada em regras de alerta para calcular `sunrise+1h` / `sunset-1h` por usina (lat/lon) no fuso da usina. Cache em memória da chamada `astral.sun.sun(...)` por usina+dia para evitar recálculo por inversor. Fallback quando `astral` levanta exceção (latitudes polares) ou usina sem lat/lon: janela fixa `ConfiguracaoEmpresa.horario_solar_inicio/fim`.

---

*Integration audit: 2026-05-12*
