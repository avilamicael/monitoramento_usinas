# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Comunicação em PT-BR. Nomes de domínio (modelos, tabelas, campos, URLs, enums) em PT-BR; termos universais (`id`, `is_active`, `created_at`, `slug`, `url`, `secret`, `api_key`/`api_secret`, `config`, `extra`, `raw`, `username`/`email`/`password` do `AbstractUser`) e nomes de libs/componentes React em inglês. Apps Python sem acento/cedilha (`notificacoes`).

## Visão geral

Sistema multi-empresa (multi-tenant) de monitoramento de usinas solares. Substitui o `firmasolar` antigo (`/home/micael/firmasolar`). Volume atual do antigo: 6 provedores, 267 usinas, 659 inversores — portar todos.

**Filosofia central**: alertas são **gerados pelo backend a partir das leituras**, nunca consumidos dos provedores. Os alarmes nativos davam 12.8% de churn <1h (46% no Solis) no sistema antigo — o `raw` do provedor só vira auditoria.

Monorepo:
- `backend/` — Django 5 + DRF + Celery/Redis + Postgres 16, em `:8000`.
- `frontend/` — Vite + React 19 + TS + Tailwind v4 + shadcn, em `:5173`.
- `docker-compose.yml` — `db`, `redis`, `backend`, `worker`, `beat`, `frontend`. Nginx fica na VPS, fora do compose.

## Comandos mais usados

```bash
make up                 # docker compose up -d
make logs               # tail dos serviços
make down
make migrate / make makemigrations / make createsuperuser
make test               # pytest dentro do container backend
make shell              # python manage.py shell

# Teste específico:
docker compose exec backend pytest apps/provedores/adapters/solis/tests/ -v

# Lint / formatação:
make lint / make fmt

# Frontend isolado:
cd frontend && npm install && npm run dev
```

`.env` esperados: `backend/.env` (copie `backend/.env.example` e gere `CHAVE_CRIPTOGRAFIA` com `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`) e opcionalmente `.env` na raiz (compose). Dev: `DJANGO_SETTINGS_MODULE=config.settings.dev`; prod: `config.settings.prod`.

Swagger: `http://localhost:8000/api/schema/swagger/`.

## Arquitetura — o que precisa ser lido junto

### 1. Multi-tenancy por `empresa_id` (shared schema)

- `apps/empresas/models.py` define `Empresa` (UUID) + mixin abstrato `EscopoEmpresa` + manager `EscopoEmpresaManager` com `.da_empresa(empresa)`.
- Toda model com escopo herda `EscopoEmpresa` que injeta `empresa = FK(Empresa)`: `Usina`, `Inversor`, `ContaProvedor`, `LeituraUsina`, `LeituraInversor`, `Alerta`, `Garantia`, `LogColeta`, notificações.
- `apps/empresas/middleware.py::EmpresaMiddleware` injeta `request.empresa` a partir de `request.user.empresa`. **Views/querysets devem filtrar por `request.empresa` — nunca confiar em parâmetro do cliente.**
- Configurações por empresa em `core.ConfiguracaoEmpresa` (1:1 com `Empresa`): `garantia_padrao_meses`, `alerta_sem_comunicacao_minutos`, `parar_alerta_apos_dias`, `subdesempenho_limite_pct`, `retencao_leituras_dias`.

### 2. Integração com provedores — padrão adapter

- Contrato em `apps/provedores/adapters/base.py`: `BaseAdapter` + `Capacidades` + dataclasses `DadosUsina`, `DadosInversor`, `MpptString`.
- Unidades canônicas: **kW, kWh, V, A, Hz, °C**. Todo adapter converte via `apps/provedores/adapters/unidades.py` (`w_para_kw`, `wh_para_kwh`, `mw_para_kw`, `ts_ms_para_datetime`, etc).
- **Regra do null**: campo que o provedor não expõe fica `None` — nunca `0` como sentinela. `0` significa "provedor reportou zero" (legítimo: noite, standby); `None` significa "não avaliar".
- Registry: `@registrar` decora a classe do adapter, `adapter_para(tipo)` devolve a classe. Import dos adapters em `apps/provedores/apps.py::ProvedoresConfig.ready()`.
- **Adapter NÃO consulta alertas nativos** (`alarmList`, `warn_data`, etc). Se o provedor tiver, fica em `raw` pra debug, nunca vira entidade.
- Credenciais em `ContaProvedor.credenciais_enc` (JSON + Fernet, via `apps/provedores/cripto.py`). Tokens de sessão (Hoymiles, FusionSolar) em `cache_token_enc`, atualizados pelo `adapter.obter_cache_token()` no fim da coleta.

**Para adicionar um provedor novo**: criar `apps/provedores/adapters/<nome>/{__init__.py, autenticacao.py, consultas.py, adapter.py}`, decorar com `@registrar`, adicionar `from . import <nome>` em `apps/provedores/apps.py::ready()`, adicionar ao enum `TipoProvedor`. Adapter atual pronto: **Solis** (HMAC stateless, 13 testes com fixtures reais).

### 3. Motor de coleta (Celery)

- `apps/coleta/tasks.py::sincronizar_conta_provedor(conta_id)` orquestra 1 ciclo:
  1. Abre `LogColeta` (iniciado_em).
  2. Decripta credenciais + cache token.
  3. Instancia o adapter, chama `buscar_usinas()` e `buscar_inversores()` por usina (se o adapter expõe).
  4. Chama `coleta.ingestao.ingerir_ciclo()` em `transaction.atomic()`.
  5. Re-encripta cache de token atualizado.
  6. Atualiza `ContaProvedor.ultima_sincronizacao_*`.
  7. Agenda `alertas.motor.avaliar_empresa_em_commit(empresa_id)`.
  8. Fecha `LogColeta` com contadores.
- Ingestão idempotente: `coletado_em = arredondar_janela(now, 10min)` reutilizado em todas as leituras; `UniqueConstraint(usina, coletado_em)` e `UniqueConstraint(inversor, coletado_em)` garantem que re-execução não duplica.
- Retry: `@shared_task(autoretry_for=(ErroRateLimitProvedor,), retry_backoff=True, retry_backoff_max=3600, max_retries=3)`. Auth falha marca `precisa_atencao=True`.
- **Scheduler dinâmico**: `apps/coleta/signals.py` (post_save/post_delete em `ContaProvedor`) mantém `django_celery_beat.PeriodicTask` sincronizada — cada conta ativa tem sua `PeriodicTask` com `IntervalSchedule` do `intervalo_coleta_minutos`. Mudou o intervalo → próximo save reassigna.
- Retenção: `apps/coleta/tasks.py::limpar_leituras_expiradas` roda diariamente (03:00 UTC via crontab criada em `post_migrate`) e apaga leituras mais velhas que `retencao_leituras_dias` de cada empresa. Alertas não são afetados.

### 4. Motor de alertas interno (sem histerese)

- Regras em `apps/alertas/regras/<nome>.py`. Cada regra subclasse `RegraUsina` ou `RegraInversor`, decorada com `@registrar`, implementa `avaliar(alvo, leitura, config)` devolvendo **tri-state**:
  - `Anomalia(severidade, mensagem, contexto)` → condição disparou.
  - `False` → condição falsa, dado presente (motor resolve alerta aberto).
  - `None` → regra inaplicável (dado ausente); motor pula — **não abre nem fecha**.
- Motor em `apps/alertas/motor.py::avaliar_empresa(empresa_id)` carrega regras, itera usinas+inversores ativos, aplica `_aplicar()`:
  - Anomalia + nenhum aberto → cria (`aberto_em=now`).
  - Anomalia + há aberto → atualiza `severidade`/`mensagem`/`contexto`; `aberto_em` preservado.
  - False + há aberto → move pra `resolvido`, seta `resolvido_em`.
  - None → noop.
- Invariante: no máximo 1 alerta aberto por `(usina, inversor, regra)`. Enforçado por `UniqueConstraint` parcial em `Alerta` (`condition=Q(estado='aberto')`).
- Regras já implementadas: `sobretensao_ac` (por inversor, threshold em `Usina.tensao_ac_limite_v`), `sem_comunicacao` (por usina, threshold em `ConfiguracaoEmpresa.alerta_sem_comunicacao_minutos`, escala pra crítico após 2× o limite).

**Para adicionar uma regra nova**: criar `apps/alertas/regras/<nome>.py`, subclasse `RegraUsina` ou `RegraInversor` com `nome=...` e `severidade_padrao`, implementar `avaliar()`, adicionar `from . import <nome>` em `apps/alertas/motor.py::_carregar_regras()`.

### 5. Frontend

- Entry: `src/main.tsx` → `QueryClientProvider` → `RouterProvider`.
- Roteamento: `src/routes/router.tsx`. `ProtectedRoute` protege o layout; rota pública: `/login`.
- Layout `src/components/layout/AppLayout.tsx` é a sidebar + `<Outlet/>`. Items `adminOnly` só aparecem se `user.papel === "administrador"` (`GET /api/usuarios/me/`).
- Auth em `src/features/auth/`: `token-store.ts` (localStorage), `useAuth.ts`, `lib/api.ts` (axios com refresh JWT automático).
- shadcn via `components.json`, CSS vars em `src/index.css` (Tailwind v4 `@theme`). Gerar componente: `npx shadcn@latest add <componente>`.
- Alias `@/*` → `src/*` em `vite.config.ts` e `tsconfig.json`.
- Dev: proxy `/api` → `http://localhost:8000` (ou `VITE_API_PROXY` no compose).

### 6. Fluxo típico de uma feature nova

**Backend**:
1. Model em `apps/<dominio>/models.py` (herdar `EscopoEmpresa` se aplicável) → `make makemigrations && make migrate`.
2. Se expõe API: view DRF com `permission_classes=[PertenceEmpresa]` (ou `AdminEmpresaOuSomenteLeitura`) de `apps.usuarios.permissions`; sobrescrever `get_queryset` para `return Model.objects.da_empresa(self.request.empresa)`.
3. Router em `apps/<dominio>/urls.py` → incluir em `config/urls.py`.

**Frontend**: hook em `src/features/<dominio>/` com `@tanstack/react-query` + `api` de `lib/api.ts` → página em `src/pages/<dominio>/` → registrar no `router.tsx` e no `NAV` de `AppLayout.tsx`.

## Convenção de nomes (opção híbrida)

- **PT-BR**: apps, modelos (`Empresa`, `Usina`, `Alerta`, `LogColeta`), campos de domínio (`nome`, `capacidade_kwp`, `medido_em`, `aberto_em`, `severidade`, `papel`), URLs de API (`/api/empresas/`, `/api/usinas/`), valores de enum (`administrador`, `operacional`, `aberto`, `resolvido`, `critico`, `online`, `offline`), rotas do frontend, labels da UI, docstrings, mensagens.
- **Inglês (universal/técnico)**: `id`, `is_active`, `created_at`, `updated_at`, `slug`, `url`, `secret`, `api_key`, `api_secret`, `config`, `extra`, `raw`, nomes próprios de libs/provedores (Fusion, Solis, Sungrow, Hoymiles, Foxess, Solarman, Auxsol, Webhook, JWT, Celery, Fernet), componentes/hooks React (`AppLayout`, `useAuth`, `DashboardPage`), e `username`/`email`/`password`/`first_name`/`last_name` (herdados do `AbstractUser`).
- Apps/módulos Python sem acento/cedilha (`notificacoes`, `alertas`, `garantia`) — dor de import. Strings/UI podem ter acento normalmente.

## Gotchas

- Python 3.12 no container. Dev direto sem Docker pode quebrar (host tem 3.10) — prefira `docker compose exec backend ...`.
- `AUTH_USER_MODEL = "usuarios.Usuario"` — nunca `django.contrib.auth.models.User`.
- `TIME_ZONE = "America/Sao_Paulo"`, `USE_TZ = True`. Datetimes sempre aware.
- Ruff é fonte única de lint/format no backend (`pyproject.toml`). Migrations ignoradas.
- JWT: access 30min, refresh 7 dias, rotação habilitada. Endpoints: `POST /api/auth/token/` e `POST /api/auth/token/refresh/`.
- **Nunca** commitar `.env`, `.pem`, credenciais. `.gitignore` cuida, mas GitHub Push Protection já bloqueou payload com URL assinada do Alibaba OSS (CDN da Solis) — se rodar `saida_bruta.txt` de novo, sanitizar antes.
- `ContaProvedor.credenciais_enc` e `cache_token_enc` são JSON encriptados com Fernet. Nunca ler/gravar texto puro.
- Nginx na VPS, fora do compose. `frontend/Dockerfile` tem stage `prod` com Nginx embutido (serve `dist/`) — útil pra outros cenários; no setup atual é o Nginx da VPS quem faz proxy pra `backend:8000` + serve build estático.

## Status por fase (`docs/PLANO.md`)

- ✅ **F1** baseline, **F2** expansão de models, **F3** base de adapters + unidades, **F4** Solis completo, **F5** motor de coleta (ingestão + task + scheduler dinâmico), **F6** motor de alertas (base + sobretensao_ac + sem_comunicacao + orquestrador), **F8** todos os 6 adapters portados (Solis, Hoymiles, FusionSolar, Solarman, Auxsol, Foxess).
- **44 testes passam** em `apps/provedores/adapters/` — fixtures reais da VPS + cenários sintéticos cobrindo normalização, unit conversion, status mapping, null preservation.
- **Adapters registrados (via `apps/provedores/apps.py::ready`)**:
  - `solis` — HMAC-SHA1 stateless (10min)
  - `hoymiles` — nonce-hash + Argon2, token persistido, parser protobuf custom para elétricos (10min)
  - `foxess` — MD5 stateless, cache de hidratação (15min)
  - `auxsol` — Bearer UUID 12h (10min)
  - `solarman` — JWT manual (Cloudflare Turnstile), **fix do `/device-s/device/{id}/stats/day`** acoplado (10min)
  - `fusionsolar` — XSRF session + re-login transparente, tratamento MW→kWp + null-on-offline (30min — failCode=407 abaixo)
- ⏳ **Regras adicionais**: `sem_geracao_horario_solar` (a que o usuário priorizou), `subdesempenho`, `inversor_offline`, `subtensao_ac`, `frequencia_anomala`, `temperatura_alta`, `string_mppt_zerada`, `queda_rendimento`, `garantia_vencendo`.
- ⏳ **Camadas API/UI**: serializers DRF por app, hooks React + páginas reais (hoje placeholders).
