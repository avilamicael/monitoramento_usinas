# Pitfalls — M1 Hardening & Estabilização

**Domínio:** SaaS Django/DRF/Celery multi-tenant em fase de hardening retroativo (brownfield, produção dev coletando 6 contas reais)
**Researched:** 2026-05-12
**Escopo:** Riscos específicos do *tipo* de trabalho do M1 — não duplica o inventário do `CONCERNS.md`, foca em como *fazer* o hardening sem quebrar coisa.

**Fases do M1 referenciadas:**

- **Audit** — code review + security audit (HARD-01, HARD-02)
- **Security** — correções críticas + rotação Fernet (HARD-05)
- **Motor** — validação de alertas/regras + N+1 + bugs de ingestão (HARD-03, HARD-06, HARD-07, HARD-08)
- **Calibração** — validação dos 6 adapters + ajustes finos das regras (HARD-04, HARD-09, HARD-10, HARD-11)
- **UX** — agrupamento/filtros/histórico de alertas (HARD-12)

---

## Pitfalls Críticos

Mistakes que custariam dias de retrabalho, vazamento entre tenants ou regressão silenciosa em produção.

### Pitfall 1: Audit produzir 200 findings e ninguém triar

**O que dá errado:** Roda `bandit -r backend/` + `semgrep --config=auto` cego, junta com `pip-audit`, gera relatório de 80–200 findings. Sem triagem prévia, vira "todos importantes / nenhum importante" e o relatório morre.

**Por que acontece:** Bandit em projeto Django gera muito ruído conhecido — `B101 (assert)` em testes, `B113 (timeout)` em adapters que já têm timeout via session, `B104 (bind all interfaces)` em `0.0.0.0` de dev. Semgrep default catches `python.django.security.audit.*` que pega templates mesmo onde o frontend é SPA (sem renderização Django). Indústria reporta ~20% de falsos positivos em SAST cru — Semgrep com Assistant filtra 60%, sem assistente sobra 100% no seu colo.

**Sinais de aviso:**
- Relatório com mais de 30 findings de mesma rule
- Findings em `migrations/` (sempre tem código autogen "suspeito")
- Findings em `tests/` (asserts, hardcoded passwords de fixture)
- Time olhando o PDF "depois" e nunca olhando

**Consequências:** Audit vira teatro. Real problem (ex.: `SECRET_KEY` com default, `.mcp.json` untracked) some no meio de 150 falsos positivos. Operador perde fé que audit é útil.

**Prevenção (acionável):**
1. **Antes de rodar a tool, escrever `.banditrc` / `.semgrepignore`** excluindo `migrations/`, `tests/`, `*.test.ts`, `docs/amostras-firmasolar/`. Já sabe que ali tem ruído.
2. **Configurar nível mínimo:** `bandit -ll` (low+) ou `-lll` (medium+). Skipa `B101` (assert).
3. **Triagem em duas passadas:** primeira passada = classificar `CRÍTICO / IMPORTANTE / RUÍDO / FALSO POSITIVO` no próprio relatório, sem abrir o código. Segunda passada = investigar só CRÍTICO + IMPORTANTE. Documentar regras descartadas em `docs/audit/regras-descartadas.md` pra próxima rodada não revisitar.
4. **`CONCERNS.md` já tem 6 itens críticos catalogados** (.pem/.mcp.json fora do `.gitignore`, `SECRET_KEY` default, `saida_bruta.txt`, Fernet sem rotação, etc). Validar primeiro se o audit confirma esses 6 antes de aceitar findings novos — se a tool não pegou o que você já sabe que tem, recalibrar a tool.
5. **Comparar com OWASP Top 10 dirigido**, não scan cego. M1 já cita "OWASP Top 10" — fazer uma checklist de 10 itens, cada um com 1–2 queries específicas (`grep -r "DEBUG = True"`, "tem CSRF em endpoint não-DRF?", "rate limit em endpoints de auth?").

**Fase:** Audit (HARD-01, HARD-02)

---

### Pitfall 2: Migration `null=True` em campos de leitura quebra histórico

**O que dá errado:** HARD-07 vai trocar `default=0` → `null=True, blank=True` em `LeituraUsina.pac_kw`, `potencia_kw`, `energia_hoje_kwh`, `energia_total_kwh` (e equivalentes em `LeituraInversor`). Sem cuidado, o `makemigrations` gera `ALTER COLUMN ... DROP NOT NULL` que ok, mas o dado histórico continua com `0` real. Não distingue mais "provedor reportou zero" de "ingestão antiga colapsou null em 0".

**Por que acontece:**
- `null=True` afeta esquema, não dados existentes.
- Linhas antigas com `0` ficam `0`, não viram `NULL`.
- Regras downstream (queda_rendimento, subdesempenho, dashboard) passam a ler valores mistos: dado novo respeita null, dado velho mente como zero. **Pior dos dois mundos.**

**Sinais de aviso:**
- PR que muda model field sem migration de backfill
- Ausência de teste regressão lendo dado antigo + novo
- Dashboard mostrando "0 kWh" pra horas que antes mostravam corretamente

**Consequências:** Bug `geracao-horaria-cache-inversor-offline` (resolvido) volta com cara nova. Operador vê dashboard inconsistente, perde confiança nos números. Regras `subdesempenho` e `queda_rendimento` ainda mais ruidosas porque agora "metade dos dados é null, metade é zero falso".

**Prevenção (acionável):**
1. **Decidir explicitamente o que fazer com histórico:**
   - Opção A: Deixar histórico como está, documentar "leituras pré-migration podem ter `0` no lugar de `null`". Adicionar campo `null` é forward-only.
   - Opção B: Backfill com heurística — `UPDATE leitura_inversor SET pac_kw=NULL WHERE pac_kw=0 AND ...` (qual condição? difícil distinguir).
   - **Recomendado: Opção A**, mas **só vale a pena se o cutoff for marcado em uma migration discreta** (ex.: `0029_cutoff_null_semantics.py` com comentário datado).
2. **Migration em fases para zero downtime na VPS:**
   - Step 1 (deploy 1): `null=True` na model, **mantém `default=0` no código de ingestão** (preserva semântica antiga).
   - Step 2 (deploy 2): remove `or 0` de `ingestao.py:152-155,252-254`. Agora null novo realmente entra como null.
   - Step 3 (não desejável, opcional): migration de backfill se algum consumidor pedir.
3. **Adicionar `assertNumQueries` + teste com leitura de `LeituraUsina` antiga (factory com `pac_kw=0`) e nova (`pac_kw=None`)** no caminho `DashboardGeracaoHorariaView`, `queda_rendimento.avaliar`, `subdesempenho.avaliar`. Garante que os 3 consumidores tratam `None` antes de tratar `0`.
4. **Não fazer SET NOT NULL em campo de leitura.** Append-only com retenção; restrição muda performance da insert e não compensa.

**Fase:** Motor (HARD-07 explicitamente)

---

### Pitfall 3: Otimizar N+1 do motor sem benchmark = regressão em outra query

**O que dá errado:** HARD-06 troca os `_ultima_leitura_*().order_by("-coletado_em").first()` por `Subquery(OuterRef("pk"))` global. Sem benchmark antes/depois, descobre só em produção que (a) a query nova é lenta para empresas pequenas (1 usina → overhead do subquery > N+1) ou (b) a empresa grande melhorou mas o motor diário (`avaliar_alertas_diarios`) ficou pior porque a estratégia não casa com `queda_rendimento`.

**Por que acontece:**
- `Subquery` com `OuterRef` em Postgres pode ser eficiente ou pesado dependendo de índice. Sem `EXPLAIN ANALYZE`, é fé.
- Motor tem 2 caminhos (ciclo normal + diário); otimização que ajuda um pode degradar o outro.
- 267 usinas hoje. Numa empresa com 5 usinas, o overhead da query consolidada pode ser maior que 5 queries simples.

**Sinais de aviso:**
- PR de "otimização" sem antes/depois numérico
- `EXPLAIN` ausente do PR description
- Otimização aplicada uniformemente sem testar com tenant pequeno

**Consequências:** Regressão silenciosa em empresa pequena (a maioria, hoje). Motor passa a demorar mais. Pior: muda comportamento sutil — `order_by` com `.first()` em Subquery requer índice composto certo (`(usina_id, coletado_em DESC)`), se faltar, full scan.

**Prevenção (acionável):**
1. **Antes de tocar `motor.py`, rodar baseline:**
   ```python
   from django.db import connection, reset_queries
   from django.conf import settings
   settings.DEBUG = True  # ou usar django.test.utils.CaptureQueriesContext
   reset_queries()
   avaliar_empresa(empresa_teste.id)
   print(len(connection.queries), "queries")
   ```
   Rodar 3 vezes: empresa pequena (1 usina, 1 inversor), média (10 usinas, 30 inversores), grande (50+ usinas, 150+ inversores). Salvar baseline em `docs/performance/motor-baseline-2026-05-XX.md`.
2. **Aplicar `assertNumQueries(N)` como teste de regressão** em `apps/alertas/tests/test_motor_performance.py`. Travar o número.
3. **Usar a mesma técnica do `DashboardKpisView`** (já existe em `apps/core/dashboard.py:53-62`) — não inventar abordagem nova; consistência reduz risco.
4. **Garantir índice composto antes da otimização:** `Index(fields=["usina", "-coletado_em"])` em `LeituraUsina` e equivalente em `LeituraInversor`. Migration discreta antes de tocar query. **Se o índice já existe**, documentar; **se não existe**, criá-lo com `CREATE INDEX CONCURRENTLY` na migration (não trava append).
5. **Não otimizar `queda_rendimento` no mesmo PR.** É outro caminho de query (7 dias), merece PR separado com baseline próprio.
6. **Aceitar manter N+1** se o ganho for marginal pra empresa grande e a complexidade aumentar muito. CONCERNS.md já marca como "tolerável hoje". Documentar a decisão se ficar.

**Fase:** Motor (HARD-06)

---

### Pitfall 4: Calibração de regra por reclamação isolada gera over-fit

**O que dá errado:** Operador da Empresa X reclama "alerta `subtensao_ac` dispara demais". Reação reflexa: baixar threshold global de 200V → 190V em `ConfiguracaoEmpresa`. Empresa Y, que estava OK com 200V, deixa de receber alertas legítimos porque a rede dela é diferente. Pior: aplicar a mudança em todas as empresas mesmo (já aconteceu na F12 — defaults 30%→15% subdesempenho, 200→190 V subtensao).

**Por que acontece:**
- Threshold "default" é tentação. Mexe um número, todas as empresas mudam.
- Sem dado quantitativo sobre quantos alertas são FP vs verdadeiros, a calibração é por sensação.
- Empresa que reclama é geralmente a maior/mais barulhenta, não necessariamente a representativa.
- Operador não diferencia "regra errada" de "rede dele tem problema crônico".

**Sinais de aviso:**
- Mudança de threshold sem analisar histórico de alertas (`SELECT regra, COUNT(*), AVG(EXTRACT(EPOCH FROM resolvido_em - aberto_em)) FROM alertas GROUP BY regra`)
- "Vamos abaixar pra parar de incomodar" como justificativa
- Calibração aplicada antes de validar que o adapter está retornando dado correto (HARD-04 pendente)
- Operadora que pede ajuste não consegue dizer "qual leitura específica disparou que não deveria"

**Consequências:** Engessa regra que estava certa. Empresa Y deixa de receber alerta legítimo. Threshold vira chumbo: ninguém vai subir de novo depois ("tava funcionando"). Operador acumula configurações conflitantes (override em `Inversor`, override em `Usina`, default em `ConfiguracaoEmpresa`) e ninguém sabe mais qual está ativo.

**Prevenção (acionável):**
1. **Antes de mexer threshold, validar a leitura.** HARD-04 (validação dos 6 adapters) **precede** HARD-03/calibração. Adapter retornando V errado ≠ regra mal calibrada.
2. **Análise quantitativa antes de mudar:**
   - Quantos alertas dessa regra abriram nos últimos 30 dias?
   - Qual % resolveu em <1h (provável FP)?
   - Em quantas empresas distintas dispara?
   - Há concentração em 1–2 usinas (problema local) ou espalhado (regra ruim)?
   Script utilitário: `python manage.py analisar_regra subtensao_ac --dias=30`.
3. **Calibrar por escopo correto:**
   - 1 usina afetada → override em `Usina` (não tocar default)
   - 1 empresa afetada → override em `ConfiguracaoEmpresa` da empresa (não tocar regra)
   - Espalhado em várias empresas → considerar mexer no default da regra
4. **Documentar a calibração no PR + na doc do produto** (`DocsConfiguracoesPage`). Sem registro, calibração é "achismo a posteriori".
5. **Não desativar regra como remédio para ruído.** CLAUDE.md já fala isso. Rebaixar severidade ou ajustar limite primeiro.
6. **Calibrar com janela de teste:** mudar default, monitorar por 1 semana antes de considerar fechado. Operador precisa ver o efeito num ciclo real.

**Fase:** Calibração (HARD-04 precede HARD-03; HARD-09/10/11 são correções de adapter, não calibração)

---

### Pitfall 5: Validação de adapters com mock = falso senso de segurança

**O que dá errado:** HARD-04 (validar 6 adapters) tenta fechar testes só com `vcr` cassettes ou `responses` mocks. Cassettes ficam stale, contract drift do provedor passa batido. A regressão real só aparece em produção semanas depois.

**Por que acontece:**
- Provedores chineses (Solis, Hoymiles, Foxess, Solarman) mudam payload silenciosamente. CONCERNS.md menciona "schema corrompido não é exercitado".
- 15+ `except Exception` em adapters mascaram mudança de schema.
- VCR cassettes gravadas hoje rodam felizes mês que vem, mesmo se o provedor virou o campo de `Inverters` para `inverterList`.
- Token cache (Hoymiles, FusionSolar) expira no mundo real mas a cassette nunca expira.

**Sinais de aviso:**
- Suite de testes do adapter passa há meses sem refresh de fixtures
- Nenhum teste hit a API real, mesmo manual
- `cache_token_enc` no banco com `cache_token_expira_em` no passado
- `LogColeta.precisa_atencao=True` em conta marcando "auth falhou" mas testes verdes

**Consequências:** Adapter funciona em CI, quebra em prod. Operador descobre 24h depois quando a conta marca `precisa_atencao`. Pior: o adapter pode estar parcialmente quebrado (retornando dado incompleto, com campo crítico em `None` falso), e os testes não pegam porque a cassette tem o campo certo.

**Prevenção (acionável):**
1. **Teste em 3 camadas:**
   - **Unit (mock):** parsing de payload conhecido → normalização correta. Cobre 90% dos casos, roda em CI.
   - **Integration (cassette):** ciclo completo `buscar_usinas()` com fixture real. Roda em CI, **com data de gravação visível** (`# gravado em 2026-XX-YY`).
   - **Contract (hit real):** uma vez por semana via CI agendado, **uma conta de cada provedor** (não todas), só `buscar_usinas()`, comparando schema do retorno (não valores). Falha se campo crítico sumiu.
2. **Refresh sistemático de cassettes:** task manual mensal em `docs/manutencao/refresh-cassettes.md`. Cada cassette tem header com `gravado_em` e `valido_ate` (3 meses padrão).
3. **Mutação de cassettes pra cenários de erro:** corromper campos críticos da cassette gravada para testar `except Exception` paths. Ex.: deletar `pac` da resposta Solis → o adapter deve retornar `pac_kw=None` (não `0`).
4. **Validação cruzada produção dev vs realidade:** HARD-04 inclui comparação dos dados coletados com leitura manual no portal do provedor. Operador olha "monitoramento mostra 12 kW agora, painel Solis mostra 12 kW agora?". Sem essa, mock vs realidade nunca fecha.
5. **Cuidado com cache de credencial em testes.** Hoymiles e FusionSolar persistem token em `cache_token_enc`. Teste que reusa fixture pode dar verde com token expirado. Cobrir cenário "token expirou, deve relogar" explicitamente.
6. **Race condition do `cache_token_enc`:** se 2 ciclos de coleta da mesma conta rodarem em paralelo (race do scheduler), ambos podem tentar gravar token diferente. Teste com `transaction.atomic` ou row lock.

**Fase:** Calibração (HARD-04 prioritário, HARD-09/10/11 derivam dele)

---

## Pitfalls Moderados

Erros que prejudicam o M1 mas não causam vazamento/regressão crítica.

### Pitfall 6: Audit detecta `superadmin` cross-tenant sem audit log

**O que dá errado:** Audit pega que `EhSuperadmin` permite cross-tenant via `/api/superadmin/*` (architecture.md menciona). Sem log de **quem** acessou **qual empresa**, fica "admin com poder de leitura ilimitado". OWASP A01 (Broken Access Control) + LGPD (princípio de necessidade) violados.

**Sinais de aviso:**
- Endpoints `/api/superadmin/*` sem decorator de auditoria
- `request.user` superadmin tocando `Empresa.objects.all()` sem rastro
- Logs do Django apenas em nível INFO sem evento "superadmin acessou empresa X"

**Prevenção:**
1. Mixin `SuperadminAuditMixin` que registra cada GET/POST em endpoint `/api/superadmin/` com `(user, empresa_alvo, ação, timestamp)`.
2. Modelo `LogAcessoSuperadmin` com `empresa` (FK), `usuario`, `acao`, `endpoint`, `criado_em`.
3. Página `/configuracao/auditoria` lista (visível só pra superadmin, mas também consultável por admin da empresa).
4. **Decisão pendente:** se admin da empresa consegue ver "quem superadmin entrou na minha empresa". Recomendado: sim, transparência LGPD.

**Fase:** Audit (descobre) + Security (corrige)

### Pitfall 7: `git status` sujo + push protection passa de novo

**O que dá errado:** `.mcp.json` e `monitoramento_firmasolar.pem` no working tree (visível em `git status` agora). Se um `git add -A` por engano, vão pro stage. Push protection do GitHub pegou antes — pode não pegar de novo (regra mudou ou arquivo diferente).

**Sinais de aviso:**
- `.gitignore` sem `*.pem`, sem `.mcp.json`
- `git status` recorrentemente mostrando arquivos sensíveis
- Hábito de `git add -A` em PRs

**Prevenção:**
1. Adicionar `*.pem`, `.mcp.json`, `*.crt`, `*.key`, `id_rsa*` ao `.gitignore` (raiz e por subdiretório se aplicável).
2. **Pre-commit hook com `gitleaks`** rodando local antes do push. Já gratuito, ferramenta open source.
3. Documentar em CLAUDE.md o que NÃO commitar — já tem nota sobre `.pem`, expandir.
4. Rodar `gitleaks detect` no histórico pelo menos uma vez antes de tornar o repo público (CONCERNS.md já recomenda).

**Fase:** Security (HARD-05)

### Pitfall 8: Rotação Fernet sem MultiFernet = downtime

**O que dá errado:** HARD-05 / CONCERNS.md falam de rotação Fernet. Implementação ingênua: `manage.py rotacionar_chave_fernet --chave-antiga=X --chave-nova=Y` lendo tudo, descriptografando com antiga, encriptando com nova, gravando. Durante a transação, qualquer coleta em paralelo lê com a chave errada.

**Sinais de aviso:**
- Comando de rotação que não usa `MultiFernet`
- Ausência de janela de manutenção planejada
- Sem teste de "credencial encriptada com chave antiga + chave nova ativa = decrypta OK"

**Prevenção:**
1. Migrar `apps/provedores/cripto.py` pra `MultiFernet`. Lista de chaves: `[chave_nova, chave_antiga]`. Decripta tentando primeiro a nova, fallback antiga. Encripta sempre com a primeira.
2. Suporte a 2 chaves no `.env` (`CHAVE_CRIPTOGRAFIA` + `CHAVE_CRIPTOGRAFIA_ANTERIOR`).
3. Comando `manage.py rotacionar_chave_fernet` itera `ContaProvedor` e re-encripta linha por linha (não em uma transação só) — ideal idempotente. Pode rodar enquanto coleta acontece (cada save reusa a chave nova).
4. Depois de rotacionar tudo, remove `CHAVE_CRIPTOGRAFIA_ANTERIOR` em deploy seguinte.

**Fase:** Security (HARD-05 — rotação Fernet)

### Pitfall 9: Self-healing de Celery boot mascarando bug real

**O que dá errado:** CONCERNS.md propõe "job de self-healing no beat varrendo `ContaProvedor.is_active` com `ultima_sincronizacao_em > intervalo*1.5`". Sem cuidado, o job camufla um bug estrutural (Celery acks_late mal configurado) — sintoma some, causa fica.

**Sinais de aviso:**
- Self-healing reagendando >30% das tasks por ciclo
- Métrica de "tasks recuperadas pelo healing" subindo
- Time concluindo "self-healing está funcionando" sem investigar por quê precisa

**Prevenção:**
1. Self-healing tem que **logar `logger.warning`** sempre que recupera task. Métrica visível.
2. Antes do self-healing, **confirmar `CELERY_TASK_ACKS_LATE=True` está aplicado** (CONCERNS.md menciona "confirmar que está sendo aplicado" — duvidoso). Inspecionar com `celery -A config inspect conf | grep acks`.
3. Combinar com `worker_prefetch_multiplier=1` (já recomendado). Self-healing só pra cobrir casos restantes.
4. Alerta interno (Slack/email/log estruturado) se self-healing dispara >5x por ciclo — sinal de bug real.

**Fase:** Motor (não está no M1 explicitamente, mas é prereq para confiabilidade)

### Pitfall 10: UX de alertas com agrupamento esconde sinal

**O que dá errado:** HARD-12 quer "agrupamento, filtros, histórico". Agrupar alertas por usina é tentador, mas agrupa também alertas heterogêneos (subtensão de inversor A + temperatura alta de inversor B + sem comunicação da usina). Operador vê "3 alertas em Usina X" e clica num só, perde os outros 2.

**Sinais de aviso:**
- Agrupamento implementado antes de definir contrato de "alerta similar"
- Card de grupo mostrando só severidade do mais alto (esconde diversidade)
- Métricas de "alertas tratados" caindo, "alertas não vistos" subindo

**Prevenção:**
1. Agrupar **só dentro da mesma regra** (`subtensao_ac` em vários inversores da mesma usina) — preservar diversidade. CLAUDE.md já cobre escalada "todos afetados" — UX deve respeitar essa semântica.
2. Card de grupo sempre mostra: regra, contagem, severidade máxima E quantidade por severidade.
3. Filtros precisam de **estado vazio explícito** — "nenhum alerta com esse filtro" precisa estar bem claro, senão operador acha que está OK quando filtro está ativo.
4. Histórico de alerta resolvido **não some por padrão** — operador precisa poder rever "abriu, fechou, abriu de novo" mesmo sem filtro especial.
5. Atualizar `frontend/src/pages/docs/DocsRegrasPage.tsx` e/ou `DocsComoFuncionaPage.tsx` explicando o agrupamento. Política obrigatória de docs (CLAUDE.md).

**Fase:** UX (HARD-12)

---

## Pitfalls Menores

### Pitfall 11: Stub `apps/provedores/tasks.py` removido com `PeriodicTask` legada apontando

**O que dá errado:** CONCERNS.md sugere remover `apps/provedores/tasks.py` (stub deprecated). Se a VPS de produção dev tem alguma `PeriodicTask` antiga apontando pra `apps.provedores.tasks.sincronizar_conta_provedor`, dropar o módulo levanta `ImportError` no beat boot.

**Prevenção:** Antes de remover, query `SELECT name, task FROM django_celery_beat_periodictask` na VPS. Se referencia o nome antigo, atualizar OU adicionar `@shared_task(name=...)` no novo apontando pro velho, depois remover.

**Fase:** Audit (descobre) + Motor (limpa)

### Pitfall 12: Backfill de `Garantia` desbloqueia alertas legados em massa

**O que dá errado:** Se a regra "usina sem garantia não gera alertas" é aplicada agora e algumas usinas históricas não têm `Garantia` registrada, o motor está silencioso pra elas. Quando alguém cria `Garantia` retroativa (ou roda migration de backfill), o motor passa a avaliar todas e **abre dezenas de alertas crônicos** ao mesmo tempo.

**Prevenção:** Antes de qualquer migration que crie `Garantia` em massa, rodar `avaliar_empresa(empresa_id, dry_run=True)` pra contar quantos alertas abririam. Se for alto, escalonar (uma empresa por vez) ou marcar como "já resolvido" pra histórico.

**Fase:** Motor (HARD-03 toca regra `garantia_vencendo`)

### Pitfall 13: Frontend rebuild OOM durante deploy de hardening

**O que dá errado:** CLAUDE.md alerta sobre OOM no Vite build. Hardening tipicamente toca código (incluindo frontend para UX HARD-12), exige rebuild. Se ninguém aumentou swap permanente ainda (escopo de M1 não menciona), próximo deploy reproduz o OOM. Decisão: VPS HostGator BR é constraint não negociável; swap é correção pontual.

**Prevenção:**
1. Adicionar swap permanente de 2GB no procedimento de deploy (não no escopo de hardening, mas é prereq operacional). Documentar em `docs/operacoes/setup-vps.md` se não existe.
2. Antes de qualquer deploy frontend, verificar `free -m` → confirmar swap ativo.
3. Considerar build local + upload `dist/` em vez de build na VPS, mas isso muda fluxo. Documentar trade-off.

**Fase:** Operacional (transversal)

### Pitfall 14: Esquecer de atualizar `/docs/` no PR

**O que dá errado:** CLAUDE.md tem regra obrigatória — toda alteração de regra/threshold/UX exige revisão de `frontend/src/pages/docs/*`. M1 vai mexer em threshold de regras (HARD-04) e UX (HARD-12). PR sem atualizar docs viola política e descalibra o que o operador vê.

**Prevenção:**
1. Checklist no template de PR: "Mudei regra/threshold? Atualizei `DocsRegrasPage.tsx`?".
2. Em revisão de PR, primeira pergunta: "Onde está a mudança em `frontend/src/pages/docs/`?".
3. Se não houver mudança visível pro usuário, escrever isso no PR description ("Mudança interna, sem impacto no produto, doc não precisa atualizar").

**Fase:** Transversal (todas)

---

## Avisos por Fase do M1

| Fase | Pitfalls mais relevantes | Mitigação prioritária |
|------|--------------------------|------------------------|
| Audit (HARD-01, 02) | #1 (falso positivo), #6 (superadmin sem log), #7 (.pem) | Triagem dupla, baseline em CONCERNS.md, `.banditrc`/`.semgrepignore` cedo |
| Security (HARD-05) | #7 (gitignore), #8 (Fernet rotação) | MultiFernet desde o início, pre-commit gitleaks |
| Motor (HARD-03, 06, 07, 08) | #2 (null vs 0), #3 (N+1 sem benchmark), #12 (garantia backfill) | Benchmark assertNumQueries antes, migration em fases, dry-run em mass-ops |
| Calibração (HARD-04, 09, 10, 11) | #4 (over-fit), #5 (mock só) | Validar adapter ANTES de regra; testes em 3 camadas (unit/cassette/real) |
| UX (HARD-12) | #10 (agrupamento esconde) | Preservar diversidade dentro de grupo; atualizar docs |
| Transversal | #13 (OOM), #14 (docs sync), #9 (self-healing camuflar bug) | Swap permanente; checklist PR; logging de healing |

## Sequenciamento crítico

A ordem importa pra evitar desperdício:

1. **Audit (HARD-01, 02)** primeiro — sem mapa, hardening é tiro no escuro. Triagem rigorosa pra não inflacionar lista.
2. **Security (HARD-05)** logo em seguida — itens críticos baratos (`.gitignore`, `SECRET_KEY`) primeiro; rotação Fernet exige planejamento (MultiFernet) e pode rodar em paralelo com Motor.
3. **Calibração de adapter (HARD-04)** antes de Calibração de regra (HARD-03). Adapter retornando V errado = regra dispara certo. Não tunear regra em cima de dado torto.
4. **HARD-09/10/11** (correções de adapter — `medido_em=None`, Auxsol refresh, NASA irradiação) compõem HARD-04. Não tratar como independentes.
5. **Motor N+1 (HARD-06)** com baseline antes; pode esperar Calibração.
6. **HARD-07 (null vs 0)** em migration multi-step. Não fazer junto com HARD-06 pra não misturar mudanças de schema com mudanças de query.
7. **UX (HARD-12)** por último — depende de Calibração estável (UX em cima de dado errado calibra mal).

## Sources

### Multi-tenant security
- [Multi-Tenant Audit Logging Architecture Mistakes (DEV)](https://dev.to/robertatkinson3570/multi-tenant-audit-logging-the-architecture-mistakes-we-made-3m8f) — confirma defense-in-depth (não confiar só em filter)
- [PostgreSQL RLS Django Multi-Tenant Security 2026 (Medium)](https://medium.com/django-journal/complete-guide-to-postgresql-rls-in-django-multi-tenant-security-2026-874deafe877f) — RLS como camada extra
- [Secure Multi-Tenancy in SaaS (DZone)](https://dzone.com/articles/secure-multi-tenancy-saas-developer-checklist) — checklist de isolamento

### N+1 e benchmarking
- [Django ORM Deep Dive — Solving N+1](https://buildsmartengineering.substack.com/p/the-django-orm-deep-dive-solving) — exemplos antes/depois
- [Django ORM Performance (TheOrangeOne)](https://theorangeone.net/posts/django-orm-performance/) — `assertNumQueries` como regressão guard
- [Automating Performance Testing in Django (TestDriven)](https://testdriven.io/blog/django-performance-testing/) — baseline first

### SAST noise
- [Semgrep — AI noise filtering 95% alignment](https://semgrep.dev/blog/2025/announcing-ai-noise-filtering-and-triage-memories/) — confirma 20%+ FP rate em SAST cru
- [Semgrep — 60% triage automation](https://semgrep.dev/blog/2025/semgrep-is-confidently-handling-60-of-all-triage-for-users-without-reducing-coverage/) — escala de problema

### Migrations sem downtime
- [Django Zero-Downtime Migrations (Vinta)](https://www.vintasoftware.com/blog/django-zero-downtime-guide) — pattern expand/contract
- [Squawk — Adding NOT NULL safely](https://squawkhq.com/docs/adding-not-nullable-field) — `NOT VALID CHECK` strategy
- [django-pg-zero-downtime-migrations](https://github.com/tbicr/django-pg-zero-downtime-migrations) — ferramenta de lock-aware migrations

### Celery confiabilidade
- [10 Essential Lessons for Celery Production (Medium)](https://medium.com/@hankehly/10-essential-lessons-for-running-celery-workloads-in-production-720ce5a05a17) — acks_late, prefetch
- [The Many Problems with Celery (Steve Dignam)](https://steve.dignam.xyz/2023/05/20/many-problems-with-celery/) — bug stories de race

### Fernet rotação
- [Cryptography Fernet docs — MultiFernet](https://cryptography.io/en/latest/fernet/) — API oficial de rotação
- [django-fernet-encrypted-fields](https://github.com/jazzband/django-fernet-encrypted-fields) — referência de implementação

### Alert tuning
- [Solving Noisy Alerts (BetterStack)](https://betterstack.com/community/guides/monitoring/best-practices-alert-fatigue/) — duration modifiers, silencing como sintoma
- [Alert Tuning Best Practices (Prophet Security)](https://www.prophetsecurity.ai/blog/security-operations-center-soc-best-practices-alert-tuning) — calibração quantitativa
- [Why Threshold-Based Alerts Fail (HVAC)](https://hvacknowitall.com/blog/why-threshold-based-alerts-fail-in-commercial-hvac) — paralelo com sensor data drift

### Mock vs real API
- [Mocking Web Services with VCR (relaxdiego)](https://relaxdiego.com/2013/06/mocking-web-services-with-vcr.html) — cassettes stale
- [Contract Testing API Reliability (Zuplo)](https://zuplo.com/learning-center/guide-to-contract-testing-for-api-reliability) — 70% de falhas em produção apesar de CI verde
- [Automated Contract Testing — Detecting API Drift](https://instatunnel.substack.com/p/automated-contract-testing-how-to)

### Brownfield refactor
- [Refactoring Legacy Django Without Breaking Production (DEV)](https://dev.to/myroslavmokhammadabd/refactoring-a-legacy-django-codebase-without-breaking-production-1ee0)
- [Top 10 Django Developer Mistakes (Toptal)](https://www.toptal.com/django/django-top-10-mistakes)

---

*Confidence: MEDIUM-HIGH. Pitfalls específicos cruzam CONCERNS.md (HIGH confidence — codebase real) e padrões da indústria (MEDIUM — verificados em múltiplas fontes). Pitfall #4 e #5 são especialmente confiantes — alinham com calibração F12 já documentada no projeto.*
