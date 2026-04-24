# Plano de implementação

Lista ordenada de commits. Cada fase é um bloco temático; cada commit deve deixar o código em estado consistente (migrations válidas, testes rodam, pelo menos).

Termos: **Fx/Cy** = Fase x, Commit y. Riscos: quebra de migration mid-way, evitar.

## F1 — Baseline
- **F1/C1** — `chore: initial scaffold` — estado atual do repo (backend Django + frontend Vite + docker-compose + CLAUDE.md + docs).

## F2 — Expansão de modelos de domínio
Cada commit inclui migration gerada.
- **F2/C1** — `feat(core): retencao_leituras_dias em ConfiguracaoEmpresa` — user decide 90/180/365.
- **F2/C2** — `feat(provedores): ContaProvedor com intervalo + audit de sync` — `intervalo_coleta_minutos`, `ultima_sincronizacao_*`, criptografia Fernet.
- **F2/C3** — `feat(usinas): Usina com tipo_equipamento e flags de coleta` — `tipo_equipamento`, `expoe_dados_inversor`, `latitude`/`longitude` null, `ultima_leitura_em` cache.
- **F2/C4** — `feat(inversores): novo app com Inversor` — `tipo` (inversor/microinversor), `numero_serie`, `modelo`, `potencia_nominal_kw`, `qtd_mppts_esperados`.
- **F2/C5** — `feat(monitoramento): LeituraUsina e LeituraInversor completas` — todos os campos elétricos nullable + `strings_mppt` JSON.
- **F2/C6** — `feat(alertas): Alerta sem histerese` — constraint `UniqueConstraint(usina, inversor, regra, estado=aberto)`.
- **F2/C7** — `feat(coleta): LogColeta para auditoria` — novo app `coleta` com log por ciclo.

## F3 — Camada de adapters (infra sem provedor concreto ainda)
- **F3/C1** — `refactor(provedores): DadosUsina/DadosInversor/Capacidades` — contrato base robusto (portado e melhorado do antigo).
- **F3/C2** — `feat(provedores): criptografia Fernet de credenciais` — helpers `criptografar`/`descriptografar` + `CACHE_TOKEN` model.

## F4 — Primeiro adapter real (Solis)
Escolhido porque: tem todos os dados elétricos, apresenta churn de 46% no antigo (valida a lógica nova), HMAC stateless é mais simples que sessões.
- **F4/C1** — `feat(provedores/solis): autenticacao HMAC-SHA1`.
- **F4/C2** — `feat(provedores/solis): consultas (listar_usinas, listar_inversores)` — sem `listar_alertas` (descartados).
- **F4/C3** — `feat(provedores/solis): adapter normalizando para DadosUsina/DadosInversor`.
- **F4/C4** — `test(provedores/solis): unit tests com fixtures JSON reais` — usar amostras capturadas da VPS.

## F5 — Motor de coleta (Celery)
- **F5/C1** — `feat(coleta): ServicoIngestao com upsert idempotente` — baseado no antigo mas sem lógica de catalogo/supressao.
- **F5/C2** — `feat(coleta): task sincronizar_conta_provedor` — Celery task, cria LogColeta.
- **F5/C3** — `feat(coleta): beat agenda por intervalo_coleta_minutos` — django-celery-beat com scheduler dinâmico.

## F6 — Motor de alertas interno
- **F6/C1** — `feat(alertas): interface Regra + loader` — cada regra é um módulo com `avaliar(usina, leituras) -> [(severidade, mensagem, contexto)]`.
- **F6/C2** — `feat(alertas): regra sobretensao_ac` — ref implementation.
- **F6/C3** — `feat(alertas): regra sem_comunicacao` — usa `Usina.ultima_leitura_em`.
- **F6/C4** — `feat(alertas): motor orquestrador + hook pós-coleta` — roda todas as regras ativas, abre/fecha alertas.

## F7 — Docs e CLAUDE.md
- **F7/C1** — `docs: atualizar CLAUDE.md com arquitetura real` — refletir o que de fato ficou.
- **F7/C2** — `docs: guia de criação de adapter novo` — passo-a-passo para adicionar Hoymiles, Foxess, etc.

## F8 — Próximos provedores (fora deste plano inicial, backlog)
Portar ordem: Foxess → Hoymiles → Auxsol → Solarman (com fix do endpoint realtime) → FusionSolar (trata null como offline).

## Política de commits
- Mensagens em inglês, padrão Conventional Commits (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`).
- Cada commit deixa o código em estado consistente. Migrations não podem ser quebradas.
- Não commitar `.env`, `.pem`, `credentials.json`. `.gitignore` cuida.
- Co-Authored-By do Claude em todos os commits.

## Pontos de verificação
Ao fim de cada fase, parar e confirmar com o user antes de seguir:
- F1 → baseline no GitHub, usuário pode clonar.
- F2 → migrations aplicáveis, `python manage.py check` passa.
- F4 → `SolisAdapter` roda com credenciais reais contra a API e retorna `DadosUsina`/`DadosInversor` populados.
- F6 → coleta → ingestao → alertas em pipeline completo, 1 provedor funcionando end-to-end.
