# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Comunicação em PT-BR. Nomes de domínio (modelos, tabelas, campos, URLs, enums) em PT-BR; termos universais (`id`, `is_active`, `created_at`, `slug`, `url`, `secret`, `api_key`/`api_secret`, `config`, `extra`, `raw`, `username`/`email`/`password` do `AbstractUser`) e nomes de libs/componentes React em inglês. Apps Python sem acento/cedilha (`notificacoes`).

## Skill auto-load

- **Sketch findings (decisões de design, tokens CSS, padrões visuais)** → `Skill("sketch-findings-monitoramento-usinas")`. Carregar sempre que estiver mexendo em frontend, criando/editando componentes, alterando `frontend/src/index.css`, ou implementando empty/loading/error states.

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

## Política de documentação (regra obrigatória)

A documentação do produto fica em `frontend/src/pages/docs/` e é visível para o usuário final em `/docs`. **Toda alteração que mude comportamento, regra, configuração, threshold, fluxo ou texto da interface exige revisão dessa documentação no mesmo PR.**

Páginas hoje (com a sidebar definida em `frontend/src/components/docs/docs-data.ts`):

- `DocsHomePage.tsx` — Visão geral
- `DocsComoFuncionaPage.tsx` — Como funciona (ciclo de coleta, motor de alertas, garantia liga/desliga monitoramento, fuso/horário solar)
- `DocsRegrasPage.tsx` — Regras de alertas (cards detalhados por regra, severidade, ação sugerida)
- `DocsProvedoresPage.tsx` — Provedores suportados, intervalo mínimo (1 h), particularidades
- `DocsConfiguracoesPage.tsx` — Configurações da empresa (garantia, horário solar, limites, retenção)
- `DocsFaqPage.tsx` — Perguntas frequentes

Primitives reutilizáveis em `frontend/src/components/docs/DocsContent.tsx`: `DocsArticle`, `DocsHeader`, `DocsSection`, `DocsSubsection`, `DocsParagraph`, `DocsList`, `Callout` (`info|aviso|dica`), `Kbd`, `AppLink` (link para rota do app, com underline).

**Checklist antes de fechar qualquer alteração:**

1. Mudei alguma regra de alerta? → atualizar o card correspondente em `DocsRegrasPage.tsx` (quando dispara, como interpretar, ação sugerida, onde ajustar) e a tabela em `DocsConfiguracoesPage.tsx` se mudou um limite default.
2. Mudei comportamento da coleta, motor, ingestão, ciclo de vida? → revisar `DocsComoFuncionaPage.tsx`.
3. Adicionei provedor novo ou mudei intervalo mínimo? → atualizar `DocsProvedoresPage.tsx`.
4. Adicionei campo novo em `ConfiguracaoEmpresa` ou `Usina`? → adicionar entrada em `DocsConfiguracoesPage.tsx` com nome amigável (sem o nome técnico do campo).
5. É um conceito totalmente novo (ex.: nova "aba" do produto)? → criar página nova em `pages/docs/`, registrar rota em `routes/router.tsx`, adicionar tópico em `docs-data.ts` e link em `DocsHomePage`.

**Estilo da doc**: PT-BR, voltado ao operador final. Não usar termos em inglês (`override`, `threshold`, `rate-limit`) — preferir "valor específico", "limite", "limite de chamadas". Não usar nomes técnicos de campos do model (`garantia_padrao_meses` etc) na doc do usuário. Não sugerir "desativar regra" como remédio para ruído — sempre prefirir "rebaixar severidade" ou "ajustar limite".

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

**Regras implementadas (12)** — todos os thresholds são configuráveis pelo usuário (frontend futuro lê/escreve em `Usina` e `ConfiguracaoEmpresa`):

| Regra | Escopo | Sev. | Threshold (default) | Local do threshold |
|---|---|---|---|---|
| `sobretensao_ac` | Inversor | info → aviso (todos) | 110% do nominal (220V→242V) | `Usina.tensao_ac_limite_v` ou derivado de `tensao_nominal_v` |
| `subtensao_ac` | Inversor | info → aviso (todos) | 91% do nominal (220V→200V) | `Usina.tensao_ac_limite_minimo_v` ou derivado de `tensao_nominal_v` |
| `frequencia_anomala` | Inversor | aviso → crítico (todos) | 59.5–60.5 Hz | `Usina.frequencia_minimo_hz` / `_maximo_hz` |
| `temperatura_alta` | Inversor | info → aviso (todos) | 75 °C | `Inversor.temperatura_limite_c` ou `ConfiguracaoEmpresa.temperatura_limite_c` |
| `inversor_offline` | Inversor | aviso → crítico (todos) | 3 coletas consecutivas em `estado=offline` | `ConfiguracaoEmpresa.inversor_offline_coletas_minimas` |
| `string_mppt_zerada` | Inversor | aviso → crítico (todos) | string em 0 enquanto outras geram | (lógica) |
| `dado_eletrico_ausente` | Inversor | aviso | 10 coletas null seguidas | `ConfiguracaoEmpresa.alerta_dado_ausente_coletas` |
| `sem_comunicacao` | Usina | aviso → crítico (>2× tempo) | 24h sem `medido_em` | `ConfiguracaoEmpresa.alerta_sem_comunicacao_minutos` |
| `sem_geracao_horario_solar` | Usina | crítico | potência ≈ 0 + queda abrupta (anterior > 5% capacidade) em horário solar | janela astral por usina (lat/lon) ou fallback `ConfiguracaoEmpresa.horario_solar_inicio/fim` |
| `subdesempenho` | Usina | info | < 15% da capacidade entre 10–15h locais | `ConfiguracaoEmpresa.subdesempenho_limite_pct` (regra desativada por padrão) |
| `queda_rendimento` | Usina | info | < 60% da média 7d (task diária) | `ConfiguracaoEmpresa.queda_rendimento_pct` |
| `garantia_vencendo` | Usina | info → aviso (>7d antes) | 30d/7d antes do fim (task diária) | `ConfiguracaoEmpresa.garantia_aviso_dias` / `_critico_dias` |

**Convenção severidade:** `info` = visibilidade, sem ação imediata. `aviso` = problema operacional que precisa atenção. `crítico` = derruba/compromete geração. **Escalada "→ X (todos)"** indica `severidade_se_todos_afetados` na regra (ver abaixo).

**Padrões / convenções das regras**:

1. **Tri-state estrito**: `Anomalia` (abre/atualiza), `False` (resolve aberto), `None` (não avalia — dado ausente, fora de escopo, em transição).
2. **Guard de potência mínima**: regras elétricas por inversor (`frequencia_anomala`, `subtensao_ac`) só avaliam se `pac_kw >= ConfiguracaoEmpresa.potencia_minima_avaliacao_kw` (default 0.5 kW). Inversor em standby reporta `freq=0`/`tensao=0` que não são anomalias reais — retorna `None` pra não abrir nem fechar alertas pré-existentes erroneamente.
3. **Curva natural vs queda abrupta** (`sem_geracao_horario_solar`): quando atual ≈ 0 em horário solar, compara com a leitura anterior. Se anterior < `sem_geracao_queda_abrupta_pct`% da capacidade (default 5%), é fim de tarde / início de manhã natural — não dispara. Se anterior estava acima, é queda abrupta — dispara crítico.
4. **Janela horário solar**: hoje é fixa por empresa (08:00–18:00 default, configurável). Roadmap: substituir por cálculo de irradiação NASA com `Usina.latitude`/`longitude`; janela fixa vira fallback quando lat/lon ausente.
5. **Carência por coletas consecutivas** (`inversor_offline`, `dado_eletrico_ausente`): em vez de disparar na 1ª coleta, exige N coletas consecutivas confirmando a condição. Configurável por empresa.
6. **Cascata de threshold**: regras de inversor leem primeiro `Inversor.<campo>` (override), caem para `Usina.<campo>`, depois `ConfiguracaoEmpresa.<campo>`, e por fim constante na regra. Permite override por equipamento sem replicar config global.
7. **Escalada "todos afetados"** (`severidade_se_todos_afetados`): regras agregadas (`agregar_por_usina=True`) podem declarar uma severidade superior aplicada quando 100% dos inversores da usina estão sob a mesma anomalia (sinal sistêmico vs perda parcial). Implementado em `_aplicar_agregado` no motor. Regras com escalada são marcadas `severidade_dinamica=True` automaticamente — admin não pode editar a severidade via `/configuracao/regras` (motor decide).
8. **Severidade dinâmica** (`severidade_dinamica=True`): regras que escalam internamente (`sem_comunicacao` por tempo, `garantia_vencendo` por proximidade do fim) ou via "todos afetados" (item 7) ignoram override do admin em `ConfiguracaoRegra.severidade`. Apenas `ativa/inativa` é respeitado para essas regras.

**Configuração de regras pelo usuário (`/configuracao/regras`)**:
- Model `apps/alertas/models.py::ConfiguracaoRegra` armazena overrides por `(empresa, regra_nome)` — `ativa` e `severidade`.
- Motor consulta uma vez por ciclo no início de `avaliar_empresa()`. Sem override, usa defaults da regra.
- Admin gerencia via página dedicada (`frontend/src/pages/configuracao/RegrasPage.tsx`). API REST sob `/api/alertas/configuracao-regras/`.
- Alertas abertos de uma regra desativada NÃO são fechados automaticamente — ficam com flag `regra_desativada` (computada via `Exists()` no queryset) e UI mostra badge para operador resolver manualmente. Decisão R2 em `docs/configuracao-regras/riscos-e-rollback.md`.

**Para adicionar uma regra nova**: criar `apps/alertas/regras/<nome>.py`, subclasse `RegraUsina` ou `RegraInversor` com `nome=...` e `severidade_padrao`, implementar `avaliar()`, adicionar `from . import <nome>` em `apps/alertas/motor.py::_carregar_regras()`. Se a regra precisa de novo threshold configurável, adicionar campo em `ConfiguracaoEmpresa` (config global por empresa) ou `Usina`/`Inversor` (override por equipamento) com `help_text` claro. A nova regra aparece automaticamente em `/configuracao/regras` (mesclada via `regras_registradas()`) — sem migration ou seed.

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
- **Frontend em produção precisa REBUILD** (não é bind volume). A VPS aplica overlay `docker-compose.prod.yml` que sobrescreve o serviço `frontend` para `target: prod` (Nginx servindo `dist/` copiado para dentro da imagem). Restart sozinho não regenera o bundle. Backend/worker/beat são bind volume e precisam só de `restart`.
- **VPS tem 1.9GB RAM sem swap permanente.** Build do Vite no frontend consome muita memória e já causou OOM em deploy anterior — solução foi swap temporário de 2GB. Recomendação registrada: provisionar 1-2GB de swap permanente. Se SSH ficar inacessível durante deploy do frontend, suspeitar de OOM antes de qualquer outra coisa.

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
- ✅ **Regras adicionais**: todas as 11 regras implementadas (`sem_geracao_horario_solar`, `inversor_offline`, `sobretensao_ac`, `subtensao_ac`, `frequencia_anomala`, `temperatura_alta`, `string_mppt_zerada`, `dado_eletrico_ausente`, `queda_rendimento`, `garantia_vencendo`). `subdesempenho` está implementada mas desativada por padrão (gerava ruído crônico).
- ✅ **Camadas API/UI**: serializers DRF, hooks React e páginas reais para usinas, alertas, inversores, notificações, configuração de empresa, gestão de usuários e configuração de regras.
- ✅ **Configuração de regras pelo usuário** (2026-05-06): admin gerencia ativa/severidade de cada regra via `/configuracao/regras` (ver seção 4 acima). Documentado em `docs/configuracao-regras/`.
- 📌 **Bugs conhecidos** em `docs/bugs/`: `LogColeta` cosmético com contadores zerados (auditoria imprecisa, sem efeito funcional). Bugs resolvidos arquivados em `docs/bugs/resolvidos/`.
