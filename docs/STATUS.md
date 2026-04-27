# STATUS — onde estamos e como retomar

> Documento dinâmico. Atualize após cada bloco grande de trabalho. Última atualização: 2026-04-26.

## TL;DR

Sistema multi-tenant de monitoramento de usinas solares. **Backend completo** (12 regras de alerta, 6 adapters validados em produção, motor de coleta + ingestão idempotente, Beat agendando dinamicamente). **Frontend ainda em placeholders**, **API REST não implementada**.

Repo: <https://github.com/avilamicael/monitoramento_usinas>. Container dev em pé desde 2026-04-25 coletando das 6 contas reais da VPS antiga (`firmasolar`).

## Comandos pra retomar

```bash
cd /home/micael/monitoramento

# Verificar estado dos containers
docker compose ps

# Se não estão rodando, subir (sem frontend pra economizar):
docker compose up -d db redis backend worker beat

# Logs ao vivo:
docker compose logs -f beat worker | tail -50

# Admin Django: http://127.0.0.1:8001/admin/  user=admin senha=admin

# Relatório do estado da coleta (rodar sempre que voltar):
docker compose exec backend python -c "
import django; django.setup()
from datetime import timedelta
from django.db.models import Count, Avg, F
from django.utils import timezone as djtz
from apps.coleta.models import LogColeta
from apps.monitoramento.models import LeituraUsina, LeituraInversor
from apps.usinas.models import Usina
from apps.inversores.models import Inversor
from apps.alertas.models import Alerta
desde = djtz.now() - timedelta(hours=24)
print('━━ COLETAS 24h ━━')
for r in LogColeta.objects.filter(iniciado_em__gte=desde).values('conta_provedor__tipo','status').annotate(n=Count('id'),dur=Avg('duracao_ms')).order_by('conta_provedor__tipo'):
    print(f'  {r[\"conta_provedor__tipo\"]:12} {r[\"status\"]:10} n={r[\"n\"]:3} dur={int(r[\"dur\"])}ms')
print(f'━━ ENTIDADES ━━')
print(f'  Usinas={Usina.objects.count()} Inversores={Inversor.objects.count()} Leituras_U={LeituraUsina.objects.count()} Leituras_I={LeituraInversor.objects.count()}')
print('━━ ALERTAS ━━')
for r in Alerta.objects.values('regra','severidade','estado').annotate(n=Count('id')).order_by('-n')[:15]:
    print(f'  {r[\"regra\"]:30} {r[\"severidade\"]:8} {r[\"estado\"]:10} n={r[\"n\"]}')
"
```

Porta override em `docker-compose.override.yml` (gitignored) — backend em **8001**, db/redis sem expor pro host (conflito com outros postgres/redis locais).

## Status por fase (ver `docs/PLANO.md` original)

✅ F1 baseline · F2 expansão de models · F3 base de adapters · F4 Solis · F5 motor de coleta · F6 motor de alertas (2 regras) · F8 5 adapters restantes · F9 validação real das 6 APIs · F10 12 regras + tasks diárias · F11 ambiente de dev coletando · **F12 calibrações pós-monitoramento (parcial — itens aplicados; Fusion/Foxess `medido_em` e Auxsol pendentes)**

### F12 — Calibrações aplicadas em 2026-04-26

Análise: dia inteiro (24/04 21:00 → 25/04 20:23 BRT) coletando em produção dev. Internet caiu às ~20h BRT do dia 25; análise feita só com dados anteriores à queda. **1282 alertas criados na janela**, padrão claro de ruído em bordas do dia.

| Regra | Antes | Depois | Onde |
|---|---|---|---|
| `subdesempenho` | default 30% | **default 15%** | `ConfiguracaoEmpresa.subdesempenho_limite_pct` |
| `subtensao_ac` | default 200 V | **default 190 V** | `Usina.tensao_ac_limite_minimo_v` |
| `frequencia_anomala` | avalia sempre que `frequencia_hz` ≠ None | **só avalia se `pac_kw ≥ potencia_minima_avaliacao_kw`** (default 0.5 kW) | guard novo |
| `subtensao_ac` | idem acima | **idem guard** | guard novo |
| `inversor_offline` | dispara na 1ª coleta offline | **exige N coletas consecutivas offline** (default 3) | `ConfiguracaoEmpresa.inversor_offline_coletas_minimas` |
| `sem_geracao_horario_solar` | sempre que potência ≈ 0 em horário solar | **só dispara se queda abrupta** (anterior > 5% capacidade) | `ConfiguracaoEmpresa.sem_geracao_queda_abrupta_pct` |

**Princípio guia**: todos os defaults são configuráveis via `ConfiguracaoEmpresa`/`Usina`. Frontend futuro lê `help_text` dos campos pra montar UI de configuração — sem hardcode.

**Impacto medido reavaliando alertas abertos contra as novas regras**: dos 69 `frequencia_anomala` abertos, 69 fechariam/seriam pulados. Dos 74 `subtensao_ac` abertos, 74 fechariam/seriam pulados. Praticamente todos os alertas dessas regras eram falsos positivos de inversor em standby (pac_kw=0 → tensao=0 / freq=0).

**Migrations aplicadas**:
- `core/0003_configuracaoempresa_inversor_offline_coletas_minimas_and_more` — adiciona `potencia_minima_avaliacao_kw`, `inversor_offline_coletas_minimas`, `sem_geracao_queda_abrupta_pct`; altera default `subdesempenho_limite_pct` 30→15.
- `core/0004_aplicar_calibracao_alertas` — data migration: empresas com `subdesempenho_limite_pct=30` viram 15.
- `usinas/0004_alter_usina_tensao_ac_limite_minimo_v` — altera default 200→190.
- `usinas/0005_aplicar_calibracao_subtensao` — data migration: usinas com 200 viram 190.

### F12 — Pendente

| Item | Detalhe |
|---|---|
| `medido_em=None` quando provedor não expõe (Fusion/Foxess) | Hoje adapters caem pra `datetime.now()` — `sem_comunicacao` nunca dispara nesses provedores |
| Auxsol token refresh mais agressivo | 12h teóricos, mas 1 auth_erro/24h durante monitoramento |
| Roadmap: irradiação NASA por lat/lon | Substituiria `horario_solar_*` para janela dinâmica precisa por usina; janela fixa vira fallback |

## Estratégia atual: API REST completa antes do frontend

Decidido em 2026-04-26: **toda a API REST do backend deve estar pronta antes de tocar no frontend**. Não vamos fazer vertical slice (API+UI por feature) — vamos fechar todo o backend primeiro, depois portar a UI inteira do antigo (`/home/micael/firmasolar/frontend/admin`). Memória: `~/.claude/projects/-home-micael-monitoramento/memory/estrategia_api_frontend.md`.

**✅ F14 — API REST completa** (2026-04-26): todos os 19 endpoints respondendo 200, swagger em `http://localhost:8001/api/schema/swagger/`, OpenAPI válido, multi-tenant via `empresa_do_request()` (resolve tanto sessão como JWT — middleware antigo só funcionava com sessão), 44 testes existentes passando.

| Endpoint | Verbos | Permissão | Filtros principais |
|---|---|---|---|
| `/api/auth/token/` + `/refresh/` | POST | qualquer | — (já existia) |
| `/api/usuarios/` | CRUD | admin | papel, is_active, search |
| `/api/usuarios/me/` | GET | autenticado | — |
| `/api/usuarios/me/trocar_senha/` | POST | autenticado | — |
| `/api/empresas/` | GET, PATCH | admin/leitura | — (própria empresa) |
| `/api/configuracao/` | GET, PATCH | admin/leitura | — (singleton da empresa) |
| `/api/usinas/` | CRUD + `ativar/desativar` | admin/leitura | provedor, conta_provedor, status_garantia, is_active, search, ordering |
| `/api/inversores/` | CRUD | admin/leitura | usina, tipo, is_active |
| `/api/provedores/` | CRUD + `coletar_agora` | admin/leitura | tipo, is_active, precisa_atencao |
| `/api/monitoramento/leituras_usina/` | GET | leitura | usina, status, desde, ate; action `serie_diaria` |
| `/api/monitoramento/leituras_inversor/` | GET | leitura | inversor, usina, estado, desde, ate |
| `/api/alertas/` | GET, PATCH + `resolver`/`reconhecer` | admin/leitura | estado, severidade, regra, usina, inversor, provedor, desde, ate |
| `/api/coleta/logs/` | GET | leitura | conta_provedor, provedor, status, desde, ate |
| `/api/garantia/` | CRUD | admin/leitura | usina, provedor, status (ativa/vencida) |
| `/api/notificacoes/regras/` | CRUD | admin/leitura | canal, is_active |
| `/api/notificacoes/entregas/` | GET | leitura | regra, alerta, canal, status, desde, ate |
| `/api/notificacoes/webhooks/` | CRUD | admin/leitura | is_active |
| `/api/dashboard/kpis/` | GET | autenticado | — |
| `/api/dashboard/geracao_diaria/?dias=N` | GET | autenticado | dias (1–365) |
| `/api/dashboard/top_fabricantes/?dias=N` | GET | autenticado | dias (1–365) |
| `/api/dashboard/alertas_criticos/?limite=N` | GET | autenticado | limite (1–100) |

**Volume real validado** (snapshot 2026-04-26): 264 usinas, 658 inversores, 6 provedores ativos, 11434 leituras de usina, 29854 leituras de inversor, 1579 alertas, 264 garantias.

**Padrão arquitetural novo** (`apps/core/api.py`):
- `empresa_do_request(request)` — resolve `request.empresa` (sessão) com fallback para `request.user.empresa` (JWT). **Use sempre essa helper, nunca `request.empresa` direto** — JWT autentica depois do middleware rodar, então `request.empresa` é `None` em endpoints DRF.
- `EmpresaModelViewSet` — CRUD com queryset filtrado por empresa; permissão default `AdminEmpresaOuSomenteLeitura` (leitura todos, escrita só admin).
- `EmpresaReadOnlyViewSet` — list+retrieve para auditoria (LeituraUsina/Inversor, LogColeta, EntregaNotificacao).
- `EmpresaListUpdateViewSet` — list+retrieve+update sem create/delete (singletons como `ConfiguracaoEmpresa`).
- Convenção de filtros: `?desde=ISO&ate=ISO` em todos os endpoints temporais; `?provedor=<tipo>` em endpoints com FK para conta_provedor.
- Credenciais (`ContaProvedor`) **nunca expostas** — campo `credenciais_enc` é write-only via `credenciais` (dict em texto plano que é criptografado no save).

**✅ F15 — UI completa** (2026-04-26): port do antigo (`/home/micael/firmasolar/frontend/admin`) para o novo, com 12 páginas funcionais consumindo a API REST. Validado no browser com login real, dados reais (264 usinas, 954 alertas, gráficos do Recharts).

| Página | Rota | Recurso consumido |
|---|---|---|
| `LoginPage` | `/login` | `/api/auth/token/` |
| `DashboardPage` | `/` | `/api/dashboard/{kpis,geracao_diaria,top_fabricantes,alertas_criticos}` |
| `UsinasPage` | `/usinas` | `/api/usinas/` (lista + filtros) |
| `UsinaDetalhePage` | `/usinas/:id` | `/api/usinas/{id}` + `/api/inversores/?usina=` + `/api/alertas/?usina=` |
| `AlertasPage` | `/alertas` | `/api/alertas/` (estado/severidade/regra/provedor/data) |
| `AlertaDetalhePage` | `/alertas/:id` | `/api/alertas/{id}/` + `resolver`/`reconhecer` |
| `GarantiasPage` | `/garantias` | `/api/garantia/` (status: ativa/vencida) |
| `ProvedoresPage` | `/provedores` | `/api/provedores/` + `coletar_agora` (form por tipo de provedor) |
| `NotificacoesPage` | `/notificacoes` | `/api/notificacoes/{regras,webhooks,entregas}` (3 abas) |
| `UsuariosPage` | `/usuarios` | `/api/usuarios/` (CRUD admin) |
| `ConfiguracoesPage` | `/configuracoes` | `/api/configuracao/` — **inclui aba "Regras de alerta" com os 8 thresholds globais** (lê `help_text` dos campos) |

**Stack final** (pareou com a do antigo): React 19, Vite 8, Tailwind v4, shadcn (24 componentes), Recharts 3, Sonner, axios + react-query, react-router 7. Convenção PT-BR aplicada (páginas em PT-BR, hooks/componentes shadcn em inglês).

**Padrão arquitetural F15**:
- `src/lib/types.ts` — tipos canônicos espelhando os serializers DRF.
- `src/lib/format.ts` — helpers PT-BR (`fmtKwh`, `fmtPct`, `fmtDataHora`, `fmtRelativo`, `rotuloProvedor`).
- `src/features/<dominio>/api.ts` — hooks react-query (`useUsinas`, `useAlertas`, `useDashboardKpis`…).
- `src/components/PageHeader.tsx`, `SeveridadeBadge.tsx`, `EstadoAlertaBadge.tsx` — UI compartilhada.
- `AppLayout` com 2 grupos (Monitoramento / Gestão), `adminOnly` filtra Usuários e Configurações.
- `vite.config.ts` usa `loadEnv` para ler `.env.local` (`VITE_API_PROXY=http://localhost:8001`).

⏳ **Próximas fases** (em ordem):

- **F12.x — Calibrações restantes**: `medido_em=None` em Fusion/Foxess, Auxsol refresh.
- **F13 — Testes unitários** das 10 regras novas (hoje só smoke-testadas).
- **F16 — Notificações**: hoje `notificacoes/models.py` tem RegraNotificacao/EntregaNotificacao/EndpointWebhook mas **nada conecta**. Worker precisa do envio real (e-mail console pra dev, SMTP/Mailgun/SES pra prod, webhook signed-HMAC).
- **F17 — Irradiação NASA** (roadmap): cálculo de janela solar dinâmica por usina via lat/lon — elimina falsos positivos de borda em `sem_geracao_horario_solar` mantendo a janela `horario_solar_*` como fallback.

## Decisões arquiteturais cristalizadas

Resumo (detalhes em `~/.claude/projects/-home-micael-monitoramento/memory/`):

- **Multi-tenancy** shared schema: `EscopoEmpresa` mixin + `EmpresaMiddleware`.
- **Convenção de nomes opção 3**: domínio em PT-BR (apps, modelos, URLs, enums, campos), termos universais em inglês (`id`, `is_active`, `created_at`, `slug`, `url`, `secret`, `api_key`, `extra`, `raw`, hooks/componentes React).
- **Alertas gerados no backend**, nunca consumidos do provedor. `raw` do provedor só pra debug.
- **Sem histerese**: 1ª coleta anômala abre, 1ª normal resolve. 1 alerta aberto por `(usina, inversor, regra)`.
- **Null ≠ ok**: regra retorna `None` (não avalia) quando dado ausente. Lacuna fechada por `dado_eletrico_ausente` (10 coletas null seguidas).
- **Threshold cascade**: Inversor → Usina → ConfiguracaoEmpresa → constante na regra.
- **Garantia**: usinas sem garantia ativa **não geram alertas**. Garantia é auto-criada na 1ª coleta com `garantia_padrao_meses` (default 12).
- **Idempotência da coleta**: `coletado_em` arredondado para janela de 10min; `UniqueConstraint(usina, coletado_em)`.
- **Credenciais Fernet** em `ContaProvedor.credenciais_enc` (e `cache_token_enc` pra sessões). Nunca texto puro.

## Provedores

6 portados, validados em produção, cobrem:

| Tipo | Auth | Cache token | Mín coleta | Status |
|---|---|---|---|---|
| solis | HMAC-SHA1 stateless | — | 10 min | ✅ |
| hoymiles | nonce + Argon2 | semanas | 10 min | ✅ (timeout 45s) |
| foxess | MD5 stateless | — | 15 min | ✅ |
| auxsol | Bearer 12h | 12h | 10 min | ✅ (1 auth_erro/24h) |
| solarman | JWT manual ~60d | até renovar | 10 min | ✅ (com fix `stats/day`) |
| fusionsolar | XSRF session | reusa | 30 min | ✅ (capacity MW→kWp + null-on-offline) |

Adapters em `backend/apps/provedores/adapters/<tipo>/`. Cada um: `autenticacao.py`, `consultas.py`, `adapter.py`, `tests/test_normalizacao.py` (44 testes verdes).

## Regras de alerta

Em `backend/apps/alertas/regras/`. Defaults pós-calibração F12 (2026-04-26):

```
sobretensao_ac          (inversor, crítico)        — Usina.tensao_ac_limite_v=240V
subtensao_ac            (inversor, aviso)          — Usina.tensao_ac_limite_minimo_v=190V + guard pac_kw≥0.5
frequencia_anomala      (inversor, aviso)          — 59.5–60.5 Hz + guard pac_kw≥0.5
temperatura_alta        (inversor, aviso)          — 75°C
inversor_offline        (inversor, aviso)          — N coletas consecutivas offline (default 3) + usina gerando
string_mppt_zerada      (inversor, aviso)
dado_eletrico_ausente   (inversor, aviso)          — N coletas null (default 10)
sem_comunicacao         (usina, aviso→crítico)     — 60min sem medido_em (escala 2×)
sem_geracao_horario_solar (usina, crítico)         — pot≈0 + queda abrupta (anterior > 5% capacidade)
subdesempenho           (usina, aviso)             — < 15% da capacidade entre 10–15h locais
queda_rendimento        (usina, aviso)             — task diária, < 60% média 7d
garantia_vencendo       (usina, info→aviso)        — task diária, 30d/7d antes
```

**Tudo configurável**: cada threshold tem campo correspondente em `ConfiguracaoEmpresa` (config global da empresa) e/ou `Usina`/`Inversor` (override por equipamento). Ver `apps/core/models.py::ConfiguracaoEmpresa` e `apps/usinas/models.py::Usina` para detalhes — `help_text` de cada campo descreve o efeito. Frontend de configuração futuro lerá esses fields para gerar UI.

**Convenções específicas**:
- Guard `potencia_minima_avaliacao_kw` (default 0.5 kW) protege regras elétricas de inversor (`subtensao_ac`, `frequencia_anomala`) contra leituras de standby (pac=0 → tensão/freq=0 que não são anomalias reais).
- `sem_geracao_horario_solar` distingue queda abrupta (dispara) de curva natural fim de tarde (não dispara) comparando com leitura anterior contra `sem_geracao_queda_abrupta_pct`.
- `inversor_offline` exige `inversor_offline_coletas_minimas` coletas consecutivas em `estado=offline` antes de abrir — evita ruído de inversores que ligam/desligam em horários diferentes do mesmo grupo.

Motor em `backend/apps/alertas/motor.py::avaliar_empresa(empresa_id, apenas_diarias=False)`. Disparado pós-coleta via `transaction.on_commit`.

Beat agendado:
- 1 `PeriodicTask` por `ContaProvedor` ativa (intervalo do `intervalo_coleta_minutos`)
- `avaliar_alertas_diarios` 21:00 UTC
- `limpar_leituras_expiradas` 03:00 UTC

## Acesso e credenciais

- **Repo**: `git@github.com:avilamicael/monitoramento_usinas.git` (HTTPS funciona via Git CLI normal).
- **VPS antiga (firmasolar)**: `ubuntu@monitoramento.firmasolar.com.br`, chave `/home/micael/firmasolar/monitoramento_firmasolar.pem`. Acessar só pra debug ou re-extrair credenciais. Nada vai pra git.
- **Admin local**: `http://127.0.0.1:8001/admin/` user `admin` senha `admin`.
- **`backend/.env`**: copiado de `.env.example`, com `CHAVE_CRIPTOGRAFIA` válida (Fernet). Não vai pro git.
- **6 contas em produção dev**: criadas via script efêmero em 2026-04-25 (script removido). Re-criar no futuro: pegar credenciais via `psql` da VPS (não via Django shell — chave Fernet diferente!) → decriptar com `Fernet(chave_vps)` → re-encriptar com `apps.provedores.cripto.criptografar` → salvar em `ContaProvedor`.

## Gotchas conhecidos

- `docker-compose.override.yml` é local (gitignored). Sem ele, portas 5432/6379/8000 conflitam com outros serviços do host.
- Solis `_detail.temp == 150.0` é sentinela de "sensor ausente"; adapter já filtra.
- Solis pode retornar dados elétricos antigos (~meses) com `state=2` (offline) — `medido_em` reflete isso, regras tratam.
- FusionSolar `capacity` < 100 = MW; ≥ 100 = kWp. Adapter trata em `_kwp_de_capacity()`.
- FusionSolar `run_state=0` → todos KPIs vêm null. Crítico não substituir por 0.
- Hoymiles cloud não expõe `corrente_ac_a` por microinversor. `frequencia_anomala`/`subtensao_ac` rodam, mas regras de corrente AC ficam inertes em Hoymiles.
- `medido_em` 100% reportado é enganoso — vários adapters caem pra `datetime.now()` no fallback (calibração pendente).

## Arquivos pra ler em ordem ao retomar

1. **Este arquivo** (`docs/STATUS.md`) — estado atual.
2. **`CLAUDE.md`** (raiz) — arquitetura.
3. **`docs/PLANO.md`** — plano original de fases.
4. **`docs/amostras-firmasolar/analise.md`** — descobertas das APIs reais.
5. **`docs/amostras-firmasolar/saida_bruta.txt`** — payloads sanitizados de cada provedor.
6. Memory em `~/.claude/projects/-home-micael-monitoramento/memory/`:
   - `project_monitoramento.md` — escopo e decisões
   - `alertas_decisoes.md` — semântica completa das 12 regras
   - `user_language.md` — convenção PT-BR/EN
