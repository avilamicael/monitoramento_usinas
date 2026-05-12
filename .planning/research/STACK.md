# Technology Stack — Adições para Milestone 1 (Hardening & Estabilização)

**Project:** Monitoramento de Usinas Solares
**Researched:** 2026-05-12
**Mode:** Stack additions (NÃO substituição) para stack já em produção
**Overall confidence:** HIGH

## Contexto da Pesquisa

A stack-fundamental (Django 5.1 + DRF 3.15 + Celery 5.4 + Redis + Postgres 16 + Vite + React 19 + Tailwind v4 + shadcn) está **consolidada, em produção** e fora de discussão. Esta pesquisa identifica **bibliotecas auxiliares** que devem ser **adicionadas** durante o M1 Hardening para resolver 4 grupos de problemas conhecidos:

1. **Security audit retroativo** (HARD-02, HARD-05)
2. **Eliminar N+1 no motor de regras** (HARD-06)
3. **Substituir janela horário solar fixa por irradiação real** (HARD-11)
4. **Observability do motor de alertas** (cobertura geral, derivada de HARD-03 e Fragile Areas)
5. **Bônus stack-adjacent**: entrega real de notificações para preparar M2

**Princípio guia:** o que **adicionar**, não o que reescrever. Cada recomendação tem justificativa "por que essa biblioteca, não X" e "quando NÃO usar".

---

## 1. Security Audit Retroativo

### Recomendado: hybrid Bandit + Semgrep + pip-audit + gitleaks

| Ferramenta | Versão atual | Tipo | Custo |
|------------|-------------|------|-------|
| **bandit** | 1.8.x (PyCQA) | SAST Python local | Zero, dev-dep |
| **semgrep** | 1.x (Cloud/CLI) | SAST cross-file com taint analysis | Free tier generoso, paid pro |
| **pip-audit** | 2.7.x (PyPA oficial) | Dependency CVE scan (PEP 691, OSV.dev) | Zero, dev-dep |
| **gitleaks** | 8.x (binary Go) | Secret scan no git (history + pre-commit) | Zero |
| **trufflehog** | 3.x (binary Go) | Secret scan + verificação de credencial viva | Zero |
| **safety** | 3.x | Dependency CVE (alternativa) | Free tier + paid |

### Justificativa por ferramenta

**bandit (HIGH confidence)** — É o oficial da PyCQA, zero config, roda em segundos no pre-commit. Captura `assert` statements, `hardcoded_password_string`, weak crypto (MD5, SHA1), uso de `eval`/`exec`, requests com `verify=False`, etc. Limitação: análise por arquivo, não rastreia taint entre módulos. **Quando NÃO usar:** sozinho, para validar input de usuário que passa por camadas — vai perder maioria das injection vulnerabilities.

**semgrep (HIGH confidence)** — Cross-file taint analysis com rulesets específicos para Django/DRF (`p/django`, `p/python`, `p/owasp-top-ten`, `p/security-audit`). Detecta o que bandit perde: SQL injection cruzando módulos, XSS via context propagation, IDOR (sem `request.empresa` no filter). **2026 benchmark**: 92% recall, 12s/10k LoC. Pode rodar local sem cloud. **Quando NÃO usar:** se time não tem tempo de afinar regras (alta taxa de FP nos primeiros runs).

**pip-audit (HIGH confidence)** — Mantido pela PyPA (Python Packaging Authority), usa banco OSV.dev (mesma fonte que GitHub Dependabot). Consome `requirements.txt` direto. Tem `--strict` que retorna exit code não-zero em qualquer vuln. **Quando NÃO usar:** se você prefere `safety` — funcionalmente equivalente, pip-audit é o oficial.

**gitleaks (HIGH confidence)** — Padrão de mercado para pre-commit. Detecta `*.pem`, `SECRET_KEY`, Fernet keys, tokens AWS/GCP, etc. Sub-segundo em diffs típicos. **Crítico para este projeto:** `CONCERNS.md` já lista `.mcp.json` e `*.pem` na working tree, e há histórico de Push Protection do GitHub bloqueando OSS URL em `saida_bruta.txt`. Adicionar pre-commit hook é defesa em profundidade.

**trufflehog (HIGH confidence)** — Complementa gitleaks no CI/CD com `--results=verified` que **testa se a credencial está viva** (chama API do provedor com o token achado). Reduz drasticamente o ruído de FPs históricos. **Quando usar:** após gitleaks no pre-commit, em CI para varrer histórico antes de pushes longos.

### Recomendação operacional

```
Pre-commit (rápido, local):    gitleaks + bandit + ruff
CI (mais profundo, no PR):     semgrep + pip-audit + trufflehog --only-verified
Job semanal (full history):    trufflehog --since-commit=<antigo>
```

**Instalação proposta:**
```bash
# backend/requirements-dev.txt — adicionar:
bandit[toml]==1.8.*
pip-audit==2.7.*
semgrep==1.*  # opcional local; preferir rodar no CI

# Pre-commit hooks via .pre-commit-config.yaml (criar):
# - gitleaks (binary)
# - bandit
# - ruff (já tem)
```

### Pacotes Django runtime (não scanners) para hardening

| Pacote | Versão | Por que adicionar | Quando NÃO usar |
|--------|--------|-------------------|-----------------|
| **django-axes** | **8.3.1** (jazzband, fev/2026) | Brute-force lockout em `/api/auth/token/`. JWT atual sem rate limit — operador desavisado vira alvo de credential stuffing. | Se for usar `django-ratelimit` na view de login com `key='post:username'` (mais simples). Axes ganha em UX (admin vê locked accounts + audit log) e em integrar com auth backend. |
| **django-csp** | **4.0** (Mozilla, Django 5 compatível) | Frontend Vite/React serve via Nginx + carrega assets de domínio próprio. CSP estrito mata XSS de injection em campos free-form (mensagens de alerta, nome de usina). | Django 6+ tem CSP nativo — em **2-3 anos** quando migrar pra Django 6 LTS, pode remover. Hoje (Django 5.1), continua sendo a opção. |
| **django-ratelimit** | **4.1.0** (production/stable) | Throttle por IP/user em endpoints sensíveis. `CONCERNS.md` lista `/api/usinas/geocode/` como vetor (DoS na quota Nominatim da VPS). | DRF tem `UserRateThrottle` e `AnonRateThrottle` nativos — use eles para throttle por endpoint REST. django-ratelimit é melhor para views não-DRF e key composta (post:username). |
| **MultiFernet** (já incluso em `cryptography`) | 44.x (já no projeto) | Habilita rotação de `CHAVE_CRIPTOGRAFIA` sem downtime (chaves múltiplas em paralelo, antiga decrypts, nova encrypts). HARD-05 menciona isso. | N/A — sempre usar quando rotação importa. |

### Anti-recomendações

- **NÃO adicionar django-allauth** — auth atual (simplejwt + Usuario custom) funciona; M1 é hardening, não refactor de auth.
- **NÃO adicionar Snyk** — proprietário, paid, sobreposição grande com pip-audit. Avalie só se a empresa adquirir.
- **NÃO adicionar DefectDojo** — overkill para um SaaS de 6 contas. Útil em escala grande de descobertas, não nesse contexto.

---

## 2. Eliminar N+1 no Motor de Regras

### Recomendado: padrão Subquery+OuterRef + django-silk em dev + nplusone-py em CI

A solução do N+1 em `apps/alertas/motor.py` **não é uma biblioteca** — é uma reorganização do código usando construções ORM que **já existem** no Django. O `CONCERNS.md` já diz que `DashboardKpisView` em `apps/core/dashboard.py:53-62` usa a técnica corretamente; basta replicar.

### Padrão canônico para o motor

```python
# Em avaliar_empresa(empresa_id), antes do loop:
from django.db.models import OuterRef, Subquery

# 1 query: pré-calcula última leitura por usina
ultima_leitura_usina = LeituraUsina.objects.filter(
    usina=OuterRef("pk")
).order_by("-coletado_em").values("id")[:1]

usinas_anotadas = Usina.objects.filter(
    empresa_id=empresa_id, is_active=True
).annotate(
    ultima_leitura_id=Subquery(ultima_leitura_usina),
).select_related("empresa")

# 1 query adicional para hidratar as leituras pelos IDs:
leituras_map = LeituraUsina.objects.in_bulk(
    [u.ultima_leitura_id for u in usinas_anotadas if u.ultima_leitura_id]
)
# Mesmo padrão para inversores → leitura_inversor_map
```

**Resultado:** 1.5k queries → ~6 queries por ciclo (1 para usinas, 1 para leituras_usina, 1 para inversores, 1 para leituras_inversor, 1 para `ConfiguracaoRegra` da empresa, 1 para `ConfiguracaoEmpresa`).

### Ferramentas de detecção/profiling

| Ferramenta | Versão | Uso | Quando |
|-----------|--------|-----|--------|
| **django-debug-toolbar** | 4.4.* (já no projeto) | Painel HTML com queries por request. Já configurado em `config/settings/dev.py`. | Dev local, requests REST. **NÃO** funciona pra task Celery. |
| **django-silk** | **5.3.x** (jazzband, 2026) | Profiling persistente em SQLite/Postgres. Funciona pra task Celery (decorar `@silk_profile` ou middleware). Dashboard em `/silk/`. | Dev + staging. Pode ficar em prod com `SILKY_INTERCEPT_PERCENT=1` para amostragem. |
| **nplusone** | 1.0.0 | Detector dedicado de N+1 em tempo de desenvolvimento. Loga warning quando vê acesso lazy a related. | CI/dev — não roda em prod. |
| **django-cprofile-middleware** | 1.x | cProfile por request → flame graph. Útil para profundidade do call stack. | Pontual, quando suspeitar de hot loop em Python além do ORM. |

**Recomendação operacional para HARD-06:**

1. Adicionar `django-silk` em dev (instalar, configurar middleware + `SILKY_PYTHON_PROFILER=True`).
2. Reproduzir o ciclo do motor com `python manage.py shell` chamando `avaliar_empresa()` direto.
3. Refatorar `_ultima_leitura_usina` / `_ultima_leitura_inversor` para retornarem dicts pré-calculados via Subquery+OuterRef, passados como parâmetro pro loop de regras.
4. Adicionar teste de regressão: `with self.assertNumQueries(LIMITE):` em `apps/alertas/tests/` que executa `avaliar_empresa()` contra fixture de 5 usinas × 10 inversores.
5. Verificar ganho via `silk` antes/depois.

### Anti-recomendações

- **NÃO usar `prefetch_related`** sozinho para "última leitura" — ele carrega TODAS as leituras, não a última. Subquery+OuterRef é a forma correta para "1 related por pai".
- **NÃO partir para `raw SQL` ou views materializadas** — Subquery resolve em SQL eficiente; otimizações exóticas só se motor permanecer slow após o refactor.
- **NÃO instalar Scout APM / New Relic** ainda — overkill para escala atual (6 empresas, ~300 usinas). Reavalie ao chegar em 50+ empresas.

---

## 3. Irradiação Real Substituindo Janela Solar Fixa (HARD-11)

### Recomendado: pvlib-python com `iotools.get_nasa_power` + cache de irradiância por usina

**Stack atual relevante:**
- `astral==3.2.*` já no projeto, calcula nascer/pôr do sol (`apps/alertas/regras/_helpers.py`). Cache module-level por `(lat_round, lon_round, dia)` — `CONCERNS.md` aponta leak.
- Fallback: `ConfiguracaoEmpresa.horario_solar_inicio/fim` (08:00-18:00 default).

**Lacuna real:** "horário solar" ≠ "tem irradiância suficiente para gerar". Manhã enevoada às 9h ou chuva forte às 14h são "horário solar" pelo astral, mas a usina não gera nada legitimamente — daí o false-positive de `sem_geracao_horario_solar`.

### Biblioteca recomendada: pvlib-python

| Pacote | Versão | Status | Por que |
|--------|--------|--------|---------|
| **pvlib** | 0.13.x stable (0.15.x em dev) | Production-ready (mantida pelo Sandia Labs + comunidade científica) | Padrão de mercado do setor solar. `pvlib.iotools.get_nasa_power()` retorna GHI/DNI/DHI/temp_air/wind_speed direto. |
| **pandas** | 2.x (transitive de pvlib) | Já é padrão | pvlib retorna `DataFrame` indexado por timestamp. |
| **numpy** | 2.x (transitive de pvlib) | Já é padrão | pvlib usa numpy internamente. |

**API NASA POWER** (grátis, sem chave, sem rate limit oficial publicado, mas use cache agressivo):

```python
from pvlib.iotools import get_nasa_power
import pandas as pd

df, meta = get_nasa_power(
    latitude=usina.latitude,
    longitude=usina.longitude,
    start=pd.Timestamp('2026-05-12', tz='America/Sao_Paulo'),
    end=pd.Timestamp('2026-05-12', tz='America/Sao_Paulo'),
    parameters=['ghi'],  # global horizontal irradiance (W/m²)
)
# df['ghi'] >> 100 W/m² ≈ "tem sol suficiente pra gerar"
```

### Arquitetura proposta para HARD-11

**NÃO chamar NASA POWER por usina por coleta.** Volume: 267 usinas × 6 coletas/dia × 365 = ~580k calls/ano → vai cair em rate limit.

**Padrão recomendado:**

1. **Model novo:** `IrradianciaDiaria(usina, dia, ghi_por_hora JSONB, fonte='nasa_power', atualizado_em)`.
2. **Task Celery diária** (cron 04:00 local, antes do primeiro ciclo solar): baixa irradiância das últimas 48h para todas as usinas ativas via batch chamadas ao NASA POWER. NASA POWER tem latência de ~2 dias para dados D-1 ficarem prontos — então usar **previsão** (NASA POWER Climatology / forecast) **ou** apenas média histórica do mês para o dia atual.
3. **Cache em memória do worker** (TTL = 4h) para evitar query repetida na mesma execução do motor.
4. **Regra `sem_geracao_horario_solar` refatorada:**
   - Se `IrradianciaDiaria` disponível → usar `ghi_por_hora[hora_local] >= 100 W/m²` como gating.
   - Fallback: `astral` (atual) — preserva comportamento se download NASA falhou.
   - Último fallback: `ConfiguracaoEmpresa.horario_solar_inicio/fim` fixo.

**Alternativa mais simples (MVP de HARD-11):** ignorar NASA POWER por agora; manter `astral` mas adicionar guard de "irradiância estimada por elevação solar". `pvlib.solarposition.get_solarposition(time, lat, lon)` retorna `apparent_elevation` — sol abaixo de 10° = baixa irradiância natural, não gera anomalia. Custo: 0 calls externas.

### Anti-recomendações

- **NÃO usar SolarAnywhere / Solcast / NREL NSRDB** ainda — caros (pay-per-call ou licença), valor marginal para o problema. NASA POWER é grátis e suficiente para gating "tem sol ou não".
- **NÃO substituir `astral`** — ele é mantido por 1 autor (`CONCERNS.md`), mas continua funcionando. Use como **fallback**, não substitua.
- **NÃO fazer cálculo de irradiância em Python puro** ("céu claro de Bird & Hulstrom") — pvlib já implementa, com validação científica.

---

## 4. Observability do Motor de Alertas

### Recomendado: Sentry SaaS + Sentry SDK Celery + (futuro) OpenTelemetry

| Pacote | Versão | Custo | Status | Para que |
|--------|--------|-------|--------|----------|
| **sentry-sdk[django,celery]** | 2.x | Free tier: 5k errors + 10k transactions/mês; paid Team $26/mês | Production-ready (Sentry Inc) | Errors + performance + distributed tracing Django→Celery em uma SDK. |
| **opentelemetry-distro[otlp]** | 1.x | Open source, sem custo de SDK | Maturidade alta | Tracing distribuído vendor-neutral. Usar quando crescer pra multi-VPS ou quiser trocar de backend. |
| **opentelemetry-instrumentation-django** | 0.x | OSS | Estável | Spans automáticos por request Django. |
| **opentelemetry-instrumentation-celery** | 0.x | OSS | Estável | Spans automáticos por task Celery, propagação de trace_id. |
| **django-prometheus** | 2.3.x | OSS | Estável | Counter/Histogram de requests Django, query stats. |
| **celery-exporter** (danihodovic) | 0.10.x | OSS | Production | Métricas Prometheus de Celery (task latency, success/fail, queue depth). |
| **structlog** | 24.x | OSS | Production | Logs estruturados JSON, melhor para Sentry/Grafana Loki. |

### Recomendação concreta para M1

**Início simples (M1):**
- Adicionar `sentry-sdk[django,celery]==2.*` em `requirements.txt`.
- Inicializar em `config/settings/base.py` com `traces_sample_rate=0.1` (10% de transactions, ajustar depois).
- Tag de empresa: `sentry_sdk.set_tag("empresa_id", str(request.empresa.id))` em `EmpresaMiddleware`.
- Tag de provedor: `sentry_sdk.set_tag("provedor", conta.tipo)` em `sincronizar_conta_provedor`.
- Custom event de motor: `sentry_sdk.capture_message(...)` quando `_aplicar_agregado` muda severidade — vira evento auditável.

**Justificativa Sentry SaaS (vs self-hosted):**
- **Self-hosted requer Postgres + Redis + Kafka + ClickHouse** (4 serviços adicionais na VPS de 1.9GB). Inviável.
- **Free tier (5k errors/mês)** cabe folgado: 6 empresas, ~10-50 erros/dia se tudo correr mal = ~1500/mês.
- **LGPD:** Sentry tem cláusula DPA (Data Processing Addendum); para dados de operador não-sensíveis (stack traces, IDs), é aceitável. Cuidar do `before_send` para scrub de campos sensíveis (`credenciais_enc`, `cache_token_enc`).

**Futuro (M2 ou M3):**
- Adicionar OpenTelemetry quando quiser trocar Sentry por self-hosted (Tempo + Grafana) ou rodar multi-backend.
- Adicionar `celery-exporter` + Prometheus + Grafana quando quiser dashboard operacional (queue depth, task durations).

### Alertas operacionais (não-produto) recomendados

| Alerta | Onde definir | Severidade |
|--------|--------------|-----------|
| Task `sincronizar_conta_provedor` falha 3× consecutivas | Sentry alert rule | High |
| `LogColeta` aberto há > 30min | Custom Sentry event ou Celery beat task | High |
| Tempo total de `avaliar_empresa` > 60s | Sentry transaction threshold | Medium |
| 5xx em endpoint `/api/auth/token/` | Sentry default | High |
| Worker Celery sem heartbeat há > 5min | celery-exporter + alertmanager (futuro) | Critical |

### Anti-recomendações

- **NÃO usar Datadog/New Relic** — caro ($30+/host/mês), vendor lock-in, valor marginal vs Sentry no estágio atual.
- **NÃO adicionar log shipping (Elasticsearch / Loki)** ainda — `docker compose logs` cobre o caso atual. Reavalie quando tiver múltiplos hosts.
- **NÃO usar Flower** — bom para dev/inspeção manual, mas não substitui Prometheus para alertas. Sem ssl + auth, vira porta aberta na VPS.

---

## 5. Stack-Adjacente: Preparação para M2 (Notificações)

`CONCERNS.md` deixa claro que entrega de notificações é o maior feature-gap visível. Pesquisado aqui para que M1 não feche decisões que travem M2.

### Recomendado: django-anymail + django-celery-email + (já tem Celery)

| Pacote | Versão | Por que |
|--------|--------|---------|
| **django-anymail** | **15.0** (15.x estável) | Abstrai ESPs (Amazon SES, Postmark, Mailgun, Resend, Brevo, SendGrid, etc) atrás do `django.core.mail` padrão. Trocar de provider = trocar `EMAIL_BACKEND`, sem reescrever templates. Bem mantido (atualização recente). |
| **django-celery-email** | 3.0.x | Backend `djcelery_email.backends.CeleryEmailBackend` que enfileira o envio. **Crítico**: email NUNCA bloqueia o motor de alertas. |
| **anymail-webhooks** (parte do django-anymail) | (incluso) | Recebe webhooks de bounce/complaint/delivered do ESP. Permite UI mostrar "entregue" / "rebotado" no `EntregaNotificacao`. |

### ESPs recomendadas para SaaS Brasil 2026

| Provider | Custo | Vantagem | Desvantagem |
|----------|-------|----------|-------------|
| **Amazon SES** | $0.10 / 1k emails | Mais barato. Region `sa-east-1` em São Paulo (latência baixa). | Setup chato (sandbox release, DKIM/SPF, bounce handling manual). |
| **Postmark** | $15/mês a 10k emails | Foco em transacional (entrega rápida, sem marketing). Templates inline. | Dólar; sem region BR. |
| **Resend** | Free tier 3k/mês, depois $20/mês | Moderno, DX excelente, React Email templates. | Empresa nova (2023), risco de viability. |
| **Brevo** (ex-Sendinblue) | Free 300/dia (limita marketing), pay-as-you-go | Tem suporte WhatsApp Business via API. | UI confusa, foco em marketing. |

**Recomendação:** começar com **Postmark** (DX e foco transacional) ou **Amazon SES** (custo). Anymail abstrai — pode trocar depois.

### Webhook delivery

Para webhooks (HTTP POST de alerta a sistemas externos do cliente), **não precisa biblioteca**:
- Usar `requests` (já está no projeto) com timeout + retry.
- Task Celery `enviar_webhook(entrega_id)` com `retry_backoff=True, max_retries=5`.
- Validação de URL (SSRF prevention): bloquear `localhost`, `169.254.*`, IPs privados antes de POST. Lib: **`ipaddress` stdlib** ou **`validators==0.34.*`**.

### Anti-recomendações para M2

- **NÃO usar Twilio direto para WhatsApp** — comprou a API oficial Meta e ficou caro ($0.05+ por mensagem). Avaliar **Z-API** (gateway brasileiro, baseado em browser automation do WhatsApp Web, mais barato porém menos confiável) ou **Whatsapp Cloud API direto** (free tier limitado por número).
- **NÃO usar django-saas-email** — abstração desnecessária; anymail + celery cobre.
- **NÃO usar dramatiq** — você já tem Celery; trocar custaria muito por ganho marginal.

---

## Resumo: O Que Adicionar ao `requirements.txt`

### Imediato (M1 Hardening)

```python
# backend/requirements.txt
sentry-sdk[django,celery]==2.*       # error monitoring + tracing
django-axes==8.3.*                   # brute-force lockout
django-csp==4.0.*                    # CSP middleware
django-ratelimit==4.1.*              # rate limit decorator-based
pvlib==0.13.*                        # solar irradiance + NASA POWER (HARD-11)
pandas==2.*                          # transitive de pvlib (já pode estar)

# backend/requirements-dev.txt
bandit[toml]==1.8.*                  # SAST Python (CI + pre-commit)
pip-audit==2.7.*                     # CVE em deps
semgrep==1.*                         # SAST cross-file (CI preferencial)
django-silk==5.3.*                   # profiling Celery + Django (dev/staging)
nplusone==1.0.*                      # detector N+1 em CI/test
```

Binários (não-pip), instalar via brew/apt ou container:
- **gitleaks** (pre-commit + CI)
- **trufflehog** (CI, varredura periódica)

### Médio prazo (M2 Notificações)

```python
# backend/requirements.txt
django-anymail[amazon-ses]==15.0.*   # ou [postmark], [resend]
django-celery-email==3.0.*           # async email backend
```

### Longo prazo (escala)

```python
# Quando chegar em ~50 empresas / 1000 usinas:
opentelemetry-distro[otlp]==1.*
opentelemetry-instrumentation-django
opentelemetry-instrumentation-celery
celery-exporter (binary)             # Prometheus metrics
django-prometheus==2.3.*
structlog==24.*
```

---

## Confidence Assessment

| Recomendação | Confidence | Justificativa |
|--------------|------------|---------------|
| bandit + semgrep + pip-audit hybrid | HIGH | Padrão de mercado 2026 amplamente documentado; alinhamento com PyPA/OWASP |
| gitleaks + trufflehog | HIGH | 51k+ stars combinado; recomendação universal em DevSecOps |
| django-axes 8.3.x | HIGH | Versão fev/2026 confirmada no PyPI; jazzband mantido |
| django-csp 4.0 | HIGH | Mozilla; release notes confirma Django 5 compat |
| django-ratelimit 4.1.0 | HIGH | Production/Stable classificação no PyPI |
| Subquery+OuterRef pattern | HIGH | Padrão ORM oficial Django, já usado em `DashboardKpisView` no próprio projeto |
| django-silk para Celery | HIGH | jazzband, ativamente mantido |
| pvlib + get_nasa_power | HIGH | Sandia Labs + comunidade científica solar; padrão setor |
| Sentry SaaS Free tier | MEDIUM | Custo confirmado mas cota pode mudar; LGPD/DPA pontos a confirmar com Sentry Inc |
| Amazon SES sa-east-1 | HIGH | AWS region São Paulo confirmada; padrão de mercado |
| django-anymail 15.0 | HIGH | Versão estável atual confirmada na docs oficial |
| OpenTelemetry maturidade | MEDIUM | OSS bom mas integrações ainda evolvem; recomendado mas só "quando crescer" |
| Whatsapp via Z-API vs Cloud API | LOW | Mercado BR muda rápido; reavaliar quando M2 começar |

---

## Sources

### Security audit
- [Semgrep vs Bandit: Python Security Scanning Compared (2026)](https://dev.to/rahulxsingh/semgrep-vs-bandit-python-security-scanning-compared-2026-5e5j)
- [15 Python Security Tools Senior Developers Use in 2026](https://medium.com/@inprogrammer/15-python-security-tools-senior-developers-trust-in-2026-8068bf5fe09d)
- [DevSecOps Pipelines: Semgrep Python SAST Scans 2026](https://www.johal.in/devsecops-pipelines-semgrep-python-sast-scans-2026/)
- [Bandit official docs](https://bandit.readthedocs.io/)
- [pip-audit on PyPI](https://pypi.org/project/pip-audit/)
- [django-axes 8.3.1 on PyPI](https://pypi.org/project/django-axes/)
- [django-csp 4.0 docs](https://django-csp.readthedocs.io/en/latest/)
- [django-ratelimit 4.1.0 docs](https://django-ratelimit.readthedocs.io/)
- [Gitleaks vs TruffleHog 2026 Benchmarks](https://appsecsanta.com/sast-tools/gitleaks-vs-trufflehog)
- [detect-secrets vs Gitleaks vs TruffleHog vs GitGuardian (2026)](https://devsecops.ae/secrets-scanners-comparison-2026/)

### N+1 / ORM performance
- [The Dramatic Benefits of Django Subqueries and Annotations](https://hansonkd.medium.com/the-dramatic-benefits-of-django-subqueries-and-annotations-4195e0dafb16)
- [Django ORM Performance: Avoiding N+1 Queries (2026)](https://medium.com/@ritheshvr/django-orm-is-not-slow-youre-probabily-just-using-it-wrong-d0b0fb883e03)
- [Django Query Expressions documentation](https://docs.djangoproject.com/en/5.1/ref/models/expressions/)
- [django-silk on GitHub](https://github.com/jazzband/django-silk)
- [Python Performance Measurement Tools (Scout)](https://www.scoutapm.com/blog/python-profilers/)

### Solar irradiance / pvlib
- [pvlib-python documentation](https://pvlib-python.readthedocs.io/en/stable/)
- [pvlib.iotools.get_nasa_power](https://pvlib-python.readthedocs.io/en/latest/reference/generated/pvlib.iotools.get_nasa_power.html)
- [pvlib iotools — Open-source Python for solar irradiance data (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S0038092X23007260)
- [NASA POWER API docs](https://power.larc.nasa.gov/docs/services/api/temporal/daily/)
- [Top Python Libraries for Solar PV Modeling 2026](https://www.prasunbarua.com/2026/04/top-python-libraries-for-solar-pv.html)

### Observability
- [Sentry for Celery integration docs](https://docs.sentry.io/platforms/python/integrations/celery/)
- [Sentry self-hosted vs SaaS docs](https://sentry.zendesk.com/hc/en-us/articles/39647157386139)
- [How Much Does Sentry Cost? 2026 Pricing Guide](https://pcxio.com/how-much-does-sentry-cost-the-2026-developer-pricing-guide/)
- [Django Error Tracking and Performance Monitoring with Sentry](https://hodovi.cc/blog/django-error-tracking-and-performance-monitoring-with-sentry/)
- [OpenTelemetry Django guide (Uptrace)](https://uptrace.dev/guides/opentelemetry-django)
- [OpenTelemetry Celery instrumentation](https://uptrace.dev/guides/opentelemetry-celery)
- [danihodovic/celery-exporter on GitHub](https://github.com/danihodovic/celery-exporter)
- [Celery Monitoring with Prometheus and Grafana](https://hodovi.cc/blog/celery-monitoring-with-prometheus-and-grafana/)

### Notifications (M2 prep)
- [django-anymail on PyPI](https://pypi.org/project/django-anymail/)
- [django-anymail full docs](https://anymail.dev/en/stable/)
- [django-celery-email on PyPI](https://pypi.org/project/django-celery-email/)
- [Django Send Email Tutorial 2026 (Mailtrap)](https://mailtrap.io/blog/django-send-email/)

---

*Stack research — additions for M1 Hardening: 2026-05-12*
