# Codebase Concerns

**Analysis Date:** 2026-05-12

Este documento inventaria dívida técnica, bugs conhecidos, fragilidades operacionais e gaps de cobertura que outras fases do GSD podem precisar atacar. Itens já catalogados em `docs/bugs/` aparecem aqui como referência cruzada — o material primário continua naquela pasta. Itens novos identificados pelo mapeamento estão sinalizados como tal.

## Tech Debt

**Stub deprecated em `apps.provedores.tasks`:**
- Issue: existe uma task duplicada `sincronizar_conta_provedor` com `raise NotImplementedError` que conflita conceitualmente com a implementação real em `apps.coleta.tasks`. Risco real se algum scheduler/manual chamar o caminho errado pelo nome (Celery autodiscover pega ambas).
- Files: `backend/apps/provedores/tasks.py` (lines 1-14) vs `backend/apps/coleta/tasks.py:51-193`
- Impact: ruído de descoberta — `celery worker -l info` mostra duas tasks com nomes diferentes mas conceito sobreposto. Se alguém enfileirar `apps.provedores.tasks.sincronizar_conta_provedor` por engano, levanta exception.
- Fix approach: remover o arquivo `apps/provedores/tasks.py` inteiro (já é puramente histórico) ou marcar como `@shared_task(name=...)` apontando pra implementação real. PT: vale conferir se `django_celery_beat.PeriodicTask` em produção referencia o nome antigo antes de remover.

**`LogColeta` cosmético com contadores zerados:**
- Issue: campos `qtd_alertas_abertos`/`qtd_alertas_resolvidos` de `LogColeta` sempre fecham com 0, porque `avaliar_empresa_em_commit(empresa_id)` é fire-and-forget via `transaction.on_commit` e o log já fechou antes do motor rodar.
- Files: `backend/apps/coleta/tasks.py:145` (chamada descartada), `backend/apps/alertas/motor.py:393-397` (retorno do motor não consumido), `backend/apps/coleta/models.py` (definição dos campos)
- Impact: auditoria imprecisa em `/api/coleta/logs/`. Sem efeito funcional — alertas seguem sendo abertos/resolvidos normalmente.
- Fix approach: ver `docs/bugs/logcoleta-contadores-zerados.md`. Recomendação registrada: remover os campos (ninguém usa) ou promover `avaliar_empresa_em_commit` a task Celery recebendo `log_coleta_id` pra atualizar pós-execução.
- Severidade: cosmético (registro em `docs/bugs/`).

**Convenção do `null` violada na ingestão:**
- Issue: a regra documentada em `apps/provedores/adapters/base.py:79` e CLAUDE.md é "campo ausente = `None`, nunca `0` como sentinela". Mas `ServicoIngestao._criar_leitura_usina` e `_criar_leitura_inversor` colapsam `None → 0` em `potencia_kw`, `pac_kw`, `energia_hoje_kwh`, `energia_total_kwh` antes de persistir, porque os campos do model têm `default=0` (não `null=True`).
- Files: `backend/apps/coleta/ingestao.py:152-155, 252-254`; modelos em `backend/apps/monitoramento/models.py` (campos sem `null=True`)
- Impact: regras downstream que olham essas colunas (motor, dashboard) não conseguem distinguir "provedor reportou 0" de "provedor não expôs". O bug `geracao-horaria-cache-inversor-offline` (resolvido) mostra como esse colapso atrapalha agregações. Outros pontos que dependem dessa distinção (ex.: queda_rendimento, subdesempenho) ainda estão expostos.
- Fix approach: tornar os campos `null=True, blank=True` em `LeituraUsina`/`LeituraInversor` e remover os `or 0`. Migration cuidadosa: provavelmente quer manter `null=True` mas sem alterar histórico (dado antigo continua `0`). Documentar a transição em CLAUDE.md.
- Severidade: importante (afeta semântica de várias regras + dashboard).

**Cache de janela astral é módulo-level sem invalidação:**
- Issue: `_CACHE_JANELA_ASTRAL` em `apps/alertas/regras/_helpers.py:41` é um dict module-level cacheando `(lat_round, lon_round, dia_iso) → janela`. Cresce indefinidamente enquanto o worker viver e nunca é limpo.
- Files: `backend/apps/alertas/regras/_helpers.py:41,71-72,97`
- Impact: vazamento lento de memória no worker Celery (uma entrada por usina × dia executado). 267 usinas × 365 dias ≈ 100k entradas/ano. Cada entrada é pequena (dois `time`), provavelmente sub-MB em escala atual, mas cresce.
- Fix approach: trocar por `functools.lru_cache(maxsize=2048)` ou limpar entradas com `dia < hoje - 1` periodicamente.
- Severidade: baixa hoje, importante se número de usinas crescer.

**Stub `sincronizar_conta_provedor` antigo:** ver "Stub deprecated em `apps.provedores.tasks`" acima.

**TODO pendente — heurística bifásica do Solis:**
- Issue: em `apps/provedores/adapters/solis/adapter.py:91`, comentário registra que a soma `uAc1 + uAc2` em inversor bifásico Solis é estimada (~225–230V em rede 220V) e pode disparar `subtensao_ac` falsa se uma usina específica calibrar diferente.
- Files: `backend/apps/provedores/adapters/solis/adapter.py:80-95`
- Impact: ruído potencial em uma usina Solis bifásica específica. Solução prevista pelo autor: override de `tensao_ac_limite_minimo_v` por inversor.
- Fix approach: monitorar alertas `subtensao_ac` em usinas Solis bifásicas; se aparecerem falsos, criar override por inversor (ou ajustar a heurística pra usar média ponderada).

## Known Bugs

**Tasks de coleta perdidas no boot do worker (importante, em aberto):**
- Symptoms: após restart do stack (deploy, OOM, reboot da VPS), parte das `sincronizar_conta_provedor` fica sem rodar até o próximo ciclo natural (até 1h depois). Reproduzido na migração AWS→HostGator em 2026-05-09: 3 dos 6 provedores ficaram parados.
- Files: `backend/apps/coleta/tasks.py:58` (task alvo), `backend/apps/coleta/signals.py:34` (PeriodicTask), `backend/config/celery.py` (config do Celery)
- Trigger: muitas `PeriodicTask` vencidas simultaneamente no boot + `--concurrency=2` + ack imediato. Race entre `DatabaseScheduler.apply_async()` e readiness do worker; mensagens são ack'd antes da execução.
- Workaround: enfileirar manualmente após restart (snippet em `docs/bugs/coleta-tasks-perdidas-no-boot.md`).
- Fix approach: combinar `task_acks_late=True` + `worker_prefetch_multiplier=1` em `config/celery.py` (já tem `CELERY_TASK_ACKS_LATE = True` em `settings/base.py:156` — confirmar que está sendo aplicado) com job de "self-healing" no beat varrendo `ContaProvedor.is_active` com `ultima_sincronizacao_em > intervalo*1.5`.
- Severidade: importante. Cada restart pode atrasar coleta por 60min em alguns provedores.

**Hoymiles offline-com-pac>0 (resolvido em 2026-05-07, commit anterior):**
- Status: resolvido. Adapter agora promove `estado=offline → online` quando `pac_kw>0`. Documentação em `docs/bugs/resolvidos/adapter-hoymiles-estado-vs-pac.md`.

**Bucket 00h do `geracao_horaria` inflado por cache chinês (resolvido em 2026-05-12, commit 960006b):**
- Status: resolvido. `DashboardGeracaoHorariaView` em `backend/apps/core/dashboard.py:122-177` agora trata a 1ª leitura do dia como baseline. Item de roadmap mais amplo (alinhar 4 adapters chineses ao `null-on-offline`) continua aberto — ver "Provedores chineses cacheiam `energia_hoje` à noite" abaixo.

## Security Considerations

**Arquivos sensíveis presentes na working tree mas NÃO commitados:**
- Risk: `.mcp.json` (config local Claude Code) e `monitoramento_firmasolar.pem` (chave SSH do sistema antigo) estão em `git status` como untracked. `.gitignore` cobre `.env*` e `.claude/*` mas não cobre `.mcp.json` ou `*.pem` no raiz do repo.
- Files: `/.mcp.json`, `/monitoramento_firmasolar.pem`, `.gitignore` (sem regra `*.pem` no nível raiz)
- Current mitigation: não rastreados pelo git; usuário não fez `git add` desses.
- Recommendations: adicionar `*.pem` e `.mcp.json` ao `.gitignore` para defesa em profundidade. Documentar em CLAUDE.md (já existe nota sobre `.pem`).

**`saida_bruta.txt` histórico potencialmente com payload assinado da OSS:**
- Risk: CLAUDE.md menciona que GitHub Push Protection já bloqueou um commit anterior com URL assinada do Alibaba OSS (CDN da Solis) embutida em `saida_bruta.txt`. O arquivo continua em git rastreado em `docs/amostras-firmasolar/saida_bruta.txt`.
- Files: `docs/amostras-firmasolar/saida_bruta.txt`
- Current mitigation: arquivo presumivelmente sanitizado no commit que passou pelo Push Protection. Não verificado neste mapeamento — leitura completa do conteúdo do arquivo evitada por política (poderia ainda conter token/URL viva).
- Recommendations: rodar `truffleHog` ou `gitleaks` no histórico antes de tornar o repo público. Considerar mover amostras pra `.gitignore` e referenciar arquivos externos.

**Credenciais de provedor encriptadas via Fernet — chave em `.env`:**
- Risk: `ContaProvedor.credenciais_enc` e `cache_token_enc` usam `CHAVE_CRIPTOGRAFIA` (Fernet). Vazamento dessa chave única expõe credenciais de todos os tenants (6 provedores × ~267 usinas × clientes).
- Files: `backend/apps/provedores/cripto.py:28-47`, `backend/config/settings/base.py:21`
- Current mitigation: chave em env, não em git. Comentário em `cripto.py:8` menciona "rotação: guardar chave antiga + nova, descriptografar com antiga e recriptografar com nova numa task one-off (fora deste escopo)".
- Recommendations: a task de rotação ainda não existe. Antes de qualquer suspeita de comprometimento, implementar `python manage.py rotacionar_chave_fernet` que aceita `--chave-antiga` e re-encripta todos os `credenciais_enc`/`cache_token_enc`. Considerar migrar pra `MultiFernet` (chaves múltiplas em paralelo) pra rotação sem downtime.

**`DEBUG=True` por padrão em `.env.example`:**
- Risk: `.env.example` envia `DEBUG=True` e `ALLOWED_HOSTS=*`. Se um operador copia direto pra prod, expõe páginas de erro do Django.
- Files: `backend/.env.example:2-3`
- Current mitigation: `settings/prod.py` hardcoda `DEBUG=False` independente do env, e força `ALLOWED_HOSTS=env("ALLOWED_HOSTS")` (sem default). Comentário em `CLAUDE.md` orienta `DJANGO_SETTINGS_MODULE=config.settings.prod` em produção.
- Recommendations: nenhuma ação imediata — `settings/prod.py` já é defensivo. Manter vigilância no deploy script pra garantir `DJANGO_SETTINGS_MODULE=config.settings.prod`.

**`SECRET_KEY` com default inseguro em desenvolvimento:**
- Risk: `SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-unsafe-secret-change-me")` em `settings/base.py:15`. Se prod der erro de env e cair no default, JWTs são preditíveis.
- Files: `backend/config/settings/base.py:15`
- Current mitigation: env-checker do `django-environ` levanta se faltar, exceto quando há default. `prod.py` não sobrescreve esse default — deveria.
- Recommendations: remover o `default=` no base.py (sempre exigir env) OU adicionar em `prod.py` uma asserção `assert SECRET_KEY != "dev-unsafe-secret-change-me"`. Custo zero, vale a pena.

**Geocode endpoint sem rate limit per-user:**
- Risk: `/api/usinas/geocode/` chama Nominatim externo. Tem rate limit local (1 req/s no processo via `Lock` em `geocode.py:32-43`) mas não tem rate limit por usuário. Um usuário malicioso pode esgotar a quota Nominatim do IP da VPS.
- Files: `backend/apps/usinas/views.py:100-145`, `backend/apps/usinas/geocode.py:36-43`
- Current mitigation: requer autenticação (`IsAuthenticated`), e o lock garante 1 req/s global.
- Recommendations: DRF throttle por user (`UserRateThrottle`) com algo como 30 chamadas/hora.

## Performance Bottlenecks

**N+1 latente no motor de alertas:**
- Problem: `avaliar_empresa()` itera usinas ativas, e pra cada uma chama `_ultima_leitura_usina()` (1 query) + lista inversores (1 query) + uma `_ultima_leitura_inversor()` por inversor. Com 267 usinas e ~659 inversores: ~1.5k queries por ciclo do motor.
- Files: `backend/apps/alertas/motor.py:101-115` (helpers), `motor.py:312, 346-349`
- Cause: cada `ultima_leitura_*` faz `order_by("-coletado_em").first()` em vez de aproveitar uma query agregada via `Subquery`/`LATERAL JOIN`.
- Improvement path: pré-calcular um dict `{usina_id: ultima_leitura}` e `{inversor_id: ultima_leitura}` em 2 queries usando `Subquery(OuterRef("pk"))` no início de `avaliar_empresa`. Mesma técnica já usada em `DashboardKpisView` (`backend/apps/core/dashboard.py:53-62`).
- Severidade: tolerável hoje (motor leva ~segundos), pesado se a base crescer 5×.

**Dashboard `geracao_horaria` carrega leitura de todas as usinas em memória:**
- Problem: `DashboardGeracaoHorariaView.get()` em `backend/apps/core/dashboard.py:143-177` faz uma query agregada e materializa `por_usina[usina_id][hora] = max` em Python antes de somar.
- Cause: agregação por hora local + lógica de baseline da 1ª leitura é difícil de expressar em SQL puro. Aceitável enquanto N=267 usinas; vira problema com N=1000+.
- Improvement path: mover o cálculo de baseline pra uma `window function` Postgres (`FIRST_VALUE(...) OVER (PARTITION BY usina_id ORDER BY hora)`) e fazer o sum direto no banco.

**`queda_rendimento` faz query pesada por usina:**
- Problem: cada usina ativa dispara um `LeituraUsina.objects.filter(usina=...).filter(...).aggregate(Max(...))` no motor diário.
- Files: `backend/apps/alertas/regras/queda_rendimento.py` (visto até linha 50)
- Cause: 7-day baseline é por usina; expressá-lo em uma query agregada com `GROUP BY usina` quebraria menos a abstração de "regra avalia 1 alvo".
- Improvement path: pré-calcular as baselines de todas as usinas em 1 query antes do loop em `avaliar_empresa` quando `apenas_diarias=True`.

**Dashboard top fabricantes faz query+capacidade por provedor:**
- Problem: `DashboardTopFabricantesView` em `dashboard.py:268-278` faz uma `aggregate(Sum)` adicional por tipo de provedor dentro do loop.
- Cause: separação do agregado de energia e capacidade.
- Improvement path: 1 query unindo as duas agregações via `annotate`.

## Fragile Areas

**Provedores chineses cacheiam `energia_hoje_kwh` à noite:**
- Files: `backend/apps/provedores/adapters/solarman/`, `foxess/`, `hoymiles/`, `solis/` (todos)
- Why fragile: o servidor do provedor devolve o último valor cacheado quando o inversor está offline (sol baixo, noite). Os adapters NÃO fazem `null-on-offline` como FusionSolar e Auxsol fazem. O bug `geracao-horaria-cache-inversor-offline` foi mitigado no consumidor (dashboard), mas outras agregações que consumirem `energia_hoje_kwh` ficam expostas.
- Safe modification: revisar qualquer view/regra que use `Max(energia_hoje_kwh)` ou diferenças intra-dia. Marcar mentalmente que o snapshot pode estar congelado.
- Test coverage: `apps/core/tests/test_configuracoes_api.py` cobre só configuração; não há teste de regressão para a heurística da baseline no dashboard ainda — está como TODO em `docs/bugs/resolvidos/geracao-horaria-cache-inversor-offline.md`.
- Roadmap longo prazo (também documentado): alinhar os 4 chineses ao `null-on-offline` (opção 4 do bug resolvido).

**Hoymiles `recalibrar_usinas` depende do alinhamento entre adapters:**
- Files: `backend/apps/provedores/adapters/base.py:228-241`, `backend/apps/provedores/adapters/hoymiles/adapter.py:200`
- Why fragile: `recalibrar_usinas` é um hook genérico em `BaseAdapter` mas hoje só Hoymiles implementa, pra contornar o agregador atrasado da plant. Se Hoymiles mudar a API e os micros pararem de bater com a usina, a `LeituraUsina.potencia_kw` divergir silenciosamente.
- Safe modification: testes em `apps/provedores/adapters/hoymiles/tests/test_normalizacao.py` cobrem a parte de normalização; cobertura específica de `recalibrar_usinas` é menor.
- Test coverage: parcial.

**Notification system é scaffolding, não está conectado:**
- Files: `backend/apps/notificacoes/` (models + viewsets), `frontend/src/pages/notificacoes/NotificacoesPage.tsx`, `frontend/src/hooks/use-notificacoes.ts`
- Why fragile: existem `RegraNotificacao`, `EndpointWebhook` e `EntregaNotificacao` no model + CRUD endpoint, mas **nenhum código backend cria registros de `EntregaNotificacao`** quando o motor abre/resolve um `Alerta`. Não há task que entregue e-mail/webhook. O frontend (`use-notificacoes.ts:1-12`) documenta explicitamente: "backend novo NÃO TEM inbox in-app por usuário, marcação como lida, filtro `apenas_nao_lidas`".
- Safe modification: usuário hoje vê a UI de Notificações sempre vazia. Operadores podem configurar regras/webhooks no admin, mas nada dispara. Documentação em `frontend/src/pages/docs/DocsComoFuncionaPage.tsx:294-297` promete "e-mail, WhatsApp, webhooks" — mensagem para o usuário desalinhada da realidade.
- Test coverage: zero — não há testes em `apps/notificacoes/`.
- Priority: alta. É um feature gap visível + promessa não cumprida na documentação do produto.

**Scheduler dinâmico via signals — sem testes:**
- Files: `backend/apps/coleta/signals.py` (post_save/post_delete em `ContaProvedor` → `PeriodicTask`)
- Why fragile: a sincronização Conta→PeriodicTask é silenciosa. Se o signal falhar (constraint, condição estranha de race), a conta fica criada mas sem coleta agendada. Não há observabilidade direta (admin precisa abrir `django_celery_beat.PeriodicTask` pra verificar).
- Safe modification: testar manualmente após mudanças em `intervalo_coleta_minutos`.
- Test coverage: aparentemente nenhum teste em `apps/coleta/` (não há `tests/`).

**Catch-all `except Exception` em vários adapters:**
- Files: `backend/apps/provedores/adapters/hoymiles/protobuf.py:84,92,120`; `auxsol/adapter.py:232`; `foxess/adapter.py:235,245,251,258`; `solarman/adapter.py:224`
- Why fragile: 15+ `except Exception: # noqa: BLE001` na camada de adapters. Maioria está marcada como "best-effort" (hidratação opcional, parsing de campo individual). Mas alguns silenciam erros importantes — uma mudança de schema do provedor pode passar despercebida.
- Safe modification: sempre que tocar adapter, considerar se o `except Exception` deveria ser mais específico ou pelo menos logar com `logger.warning`.
- Test coverage: testes de fixtures cobrem o caminho feliz; cenários de schema corrompido não são exercitados.

## Scaling Limits

**VPS produção (`trylab-vps`): 1.9GB RAM sem swap permanente.**
- Current capacity: backend + worker + beat + db Postgres 16 + redis + nginx convivem em ~1.5GB.
- Limit: build do Vite no frontend consome >1GB durante `vite build`. Já causou OOM em deploy anterior (corrigido com swap temporário 2GB). Se SSH ficar inacessível durante deploy do frontend, suspeitar de OOM antes de qualquer outra coisa.
- Scaling path: provisionar 1-2GB de swap permanente. Documentado em CLAUDE.md ("Gotchas") + project memory.
- Severidade: importante. Está mitigado por hábito ("aumentar swap antes de deploy de frontend") mas não tem garantia.

**Postgres sem retenção automática além de leituras:**
- Current capacity: `limpar_leituras_expiradas` (em `apps/coleta/tasks.py:218-252`) apaga `LeituraUsina` e `LeituraInversor` mais velhas que `retencao_leituras_dias` da empresa.
- Limit: `Alerta`, `LogColeta` e `EntregaNotificacao` crescem sem teto. `LogColeta` em produção já registrava 1176 registros (visto em `docs/bugs/logcoleta-contadores-zerados.md`); a 24 coletas/dia × 6 contas × N dias, satura no médio prazo.
- Scaling path: adicionar `LogColeta` à task de retenção (manter últimos 90 dias?). `Alerta` precisa de política — talvez "resolvidos com > 365 dias podem ser arquivados".
- Severidade: ainda baixa, mas operacionalmente vai virar.

**Motor de alertas é síncrono por empresa (sem paralelismo):**
- Current capacity: `avaliar_empresa()` é uma chamada inline. Com 5 empresas hoje, é desprezível.
- Limit: crescer para 50+ empresas com 100+ usinas cada significa um motor que demora minutos depois da coleta.
- Scaling path: hoje cada `ContaProvedor` dispara `avaliar_empresa_em_commit` no fim da coleta — múltiplas contas da mesma empresa disparam motor N vezes. Trocar por uma task Celery com lock por `empresa_id` (debounce 30s) economizaria trabalho.
- Severidade: baixa hoje, importante na escala.

## Dependencies at Risk

**Bibliotecas críticas e idade:**
- Files: `backend/requirements.txt`, `backend/requirements-dev.txt`
- Django 5.x, DRF, `cryptography` (Fernet), `astral`, `django-celery-beat`. Dependências atualizadas; nenhuma marcada como vulnerável publicamente. Mas:
  - `astral` (cálculo sunrise/sunset) é mantido por um único autor; se descontinuar, fallback existe (`ConfiguracaoEmpresa.horario_solar_inicio/fim`).
  - `cryptography` precisa ser monitorado por CVEs de Fernet.
  - `django-celery-beat` é a coluna do scheduler; tem histórico de breaking changes em majors.
- Impact: nenhum risco imediato. Documentar em CLAUDE.md alguma cadência (a cada release menor, rodar `pip list --outdated`).

**Nominatim (geocode) é externo e gratuito:**
- File: `backend/apps/usinas/geocode.py:28`
- Risk: política Nominatim é 1 req/s por IP, sem chave de API. Pode mudar (já mudou no passado). Sem fallback no código.
- Impact: se Nominatim mudar política, geocode quebra. UI tem retry manual mas não é graceful.
- Migration plan: documentar mapa de provedores alternativos (Google Geocoding API, MapBox) e estimar custo antes que vire urgência.

## Missing Critical Features

**Entrega de notificações:**
- Problem: ver "Notification system é scaffolding" em "Fragile Areas". Não há código backend que crie `EntregaNotificacao` quando um `Alerta` é criado/resolvido.
- Blocks: cliente que configura regra de e-mail/WhatsApp/webhook não recebe nada. Promessa quebrada em `DocsComoFuncionaPage.tsx`.
- Priority: alta.

**Rotação de chave Fernet:**
- Problem: ver "Credenciais de provedor encriptadas via Fernet" em "Security". Ainda não existe task `rotacionar_chave_fernet`.
- Blocks: resposta a incidente de chave vazada exige downtime + script manual.
- Priority: média (preventivo).

**Subdesempenho desativada por ruído:**
- File: `backend/apps/alertas/regras/subdesempenho.py`, teste `apps/alertas/tests/test_subdesempenho_desativada.py`
- Problem: regra implementada mas desativada por padrão porque gerava muito ruído (CLAUDE.md). Operadores não recebem nada do conceito de "produzindo abaixo do esperado".
- Blocks: detecção de subdesempenho persistente requer revisão manual hoje.
- Priority: baixa (consciente, com fallback de queda_rendimento).

**Self-healing de coleta no boot:**
- Problem: ver bug "Tasks de coleta perdidas no boot". Fix recomendado existe nas notes do bug, ainda não implementado.
- Blocks: cada restart do stack pode atrasar coleta de 1-3 provedores por até 60min.
- Priority: importante. Vale combinar com a próxima janela de manutenção.

**Página `/configuracao/regras` não fecha alertas órfãos:**
- Problem: documentado em "Configuração de regras pelo usuário" no CLAUDE.md. Quando admin desativa uma regra, alertas abertos pré-existentes daquela regra ficam com flag `regra_desativada` mas não fecham. UX espera ação manual.
- Blocks: lista de alertas pode acumular "fantasmas" depois de desativar regra.
- Priority: baixa (decisão de produto, não bug).

## Test Coverage Gaps

**`apps/coleta/` sem testes próprios:**
- What's not tested: ingestão, scheduling de PeriodicTask (signals), task `sincronizar_conta_provedor` end-to-end, task `limpar_leituras_expiradas`, task `avaliar_alertas_diarios`.
- Files: `backend/apps/coleta/` (não há subdir `tests/`)
- Risk: o coração do sistema (orquestração de coleta + retenção + motor agendado) só é validado em integração manual. Bug "tasks perdidas no boot" é justamente o tipo de coisa que cobertura aqui teria pego antes da prod.
- Priority: alta.

**`apps/empresas/` sem testes do middleware:**
- What's not tested: `EmpresaMiddleware` (injeção de `request.empresa`), comportamento quando user sem empresa, usuário não autenticado.
- Files: `backend/apps/empresas/middleware.py` (sem testes correspondentes)
- Risk: middleware é a base do multi-tenancy. Bug aqui = vazamento entre tenants.
- Priority: alta.

**`apps/notificacoes/` totalmente sem testes:**
- What's not tested: CRUD de regras, validação de severidades JSON, lookup de entregas.
- Files: `backend/apps/notificacoes/`
- Risk: baixa hoje (sistema não dispara nada). Vira alta no dia em que delivery for implementado.
- Priority: combinar com implementação de delivery.

**`apps/garantia/` sem testes:**
- What's not tested: criação automática de `Garantia` na 1ª coleta da usina, cálculo de data fim, integração com regra `garantia_vencendo`.
- Files: `backend/apps/garantia/`, integração em `backend/apps/coleta/ingestao.py:177-189`
- Risk: garantia controla se a usina recebe alertas (CLAUDE.md: "usinas sem garantia ativa não geram alertas"). Bug aqui silencia alertas inteiros.
- Priority: média-alta.

**Frontend sem testes:**
- What's not tested: todo o frontend. `find frontend/src -name "*.test.*"` retorna vazio.
- Files: `frontend/src/`
- Risk: regressões visuais e de fluxo passam batido. Hooks de notificação que viraram no-op não geram alerta nem em CI.
- Priority: média. Considerar pelo menos smoke tests com Playwright/Vitest nos fluxos críticos (login, ver dashboard, abrir alerta).

**Dashboard view sem teste de regressão para o fix do bucket 00h:**
- What's not tested: `DashboardGeracaoHorariaView.get()` com fixtures cobrindo cache chinês, null-on-offline e dia normal.
- Files: `backend/apps/core/tests/` tem só `test_configuracoes_api.py`.
- Risk: o fix de 2026-05-12 não tem teste de regressão — próximo refactor pode quebrar. Listado como TODO em `docs/bugs/resolvidos/geracao-horaria-cache-inversor-offline.md`.
- Priority: alta. Bug resolvido sem testes é bug que volta.

---

*Concerns audit: 2026-05-12*
