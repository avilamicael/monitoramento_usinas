# Análise do relatório de alertas — veredito para alpha

**Data**: 2026-04-30
**Contexto**: revisão do `docs/relatorio-alertas-nativos-vs-sistema-novo.md` para decidir se sobe na VPS em fase alpha. Foco subsequente do projeto: segurança e multiempresas.
**Documento-base**: `docs/relatorio-alertas-nativos-vs-sistema-novo.md` (2026-04-29).

---

## Veredito: pode subir pra alpha — com 1 ressalva e 1 aviso

O documento é sólido, baseado em dados reais (74 alertas nativos vs 12 internos de produção, p50/médias medidas). A tese central — *"alertas vêm da leitura, nunca do provedor"* — está validada empiricamente nos 6 provedores. Pode subir na VPS sem refatorar o motor, **desde que prepare uma explicação para 1 caso visualmente embaraçoso** (item P0 abaixo).

---

## P0 — antes de focar em outras áreas

**Os 4 alertas Solarman críticos abertos há 200–727h** são o único item que pode envergonhar na primeira demo:

- Não é bug do motor. São usinas realmente offline há 9–30 dias (`Patrãozin`, `Francisco e Mari`, `FÁBIO SOUZA`, `ANDERSON ESPINDOLA`).
- O dono do sistema vai abrir o painel, ver "crítico há 30 dias" e pensar que tem coisa quebrada.
- **Mitigação mínima pra subir**:
  - **(a)** marcar essas 4 usinas como `is_active=False` manualmente após confirmar (5 min de SQL/shell), ou
  - **(b)** adicionar uma nota no painel/release-notes explicando que o motor está fazendo o trabalho dele e a próxima fase é escalonamento operacional.
- **Sem isso, vai parecer um sistema que abre alerta e esquece.**

---

## O que o documento errou ou está desatualizado (verificado contra o código)

| Item do doc | Realidade no código | Ação |
|---|---|---|
| **Recomendação #5** (FoxESS `status` quebrado, ajustar adapter) | Já feita. `apps/provedores/adapters/foxess/adapter.py:331-336` usa `_fault_ativo(variaveis)` do `real/query` como fonte de truth, não o campo `status` da listagem. | Nenhuma — já está correto. |
| **Recomendação #7** (`string_mppt_zerada` retornaria `False` quando deveria `None`) | Já correta. `apps/alertas/regras/string_mppt_zerada.py:41-42` retorna `None` quando `len(strings) < 2`. | Nenhuma — risco descrito não existe. |
| `CLAUDE.md` cita `parar_alerta_apos_dias` em `ConfiguracaoEmpresa` | Campo **não existe** no model `apps/core/models.py:9-126`. | Não é blocker. Corrigir CLAUDE.md ou criar o campo ao implementar a recomendação #6 do doc. |

---

## Categorias que NÃO estamos deixando passar

A matriz §5 do documento confirma com dados o que importa: **nenhuma categoria semântica do nativo está sem cobertura interna**.

- Os alertas que o nativo dá e nós não damos são todos validadamente lixo: NO-Grid 73× p50=300s da Solis, AuxSol 96% <1h.
- Os que o nativo NÃO dá e nós damos são justamente os úteis: frequência, temperatura, MPPT por string, dado ausente, sem geração em horário solar, queda de rendimento, garantia, sem comunicação no Solarman.

A análise é correta — não há gap semântico real.

---

## O que o documento NÃO cobriu e vale pensar antes da VPS

1. **Camada de notificação** — o documento discute *geração* de alertas, não *entrega*. Hoje o operador precisa abrir o painel para ver. Pra alpha tudo bem (você é o operador), mas o "dono" vai perguntar — tenha resposta pronta ("próxima fase: e-mail/webhook na criação do alerta crítico").
2. **Retenção de alertas resolvidos** — 119 resolvidos no histórico recente, sem política. Vai inflar a tabela. Não é blocker pra alpha, mas decida se quer arquivar/podar após N dias.
3. **Visualização de severidade temporal** — `severidade=crítico` é estático no `Alerta`. Para o operador, "crítico há 1h" e "crítico há 30 dias" são problemas diferentes. UI ou ordenação por idade resolve sem tocar no motor.
4. **`LogColeta` vs `medido_em`** — recomendação #4 do doc (validar coleta das 6 usinas Solis com `1D4C2`) é importante mas mais como auditoria interna. Não bloqueia alpha.

---

## Plano sugerido (ordem)

| Quando | Item | Esforço | Por quê |
|---|---|---|---|
| **Antes do deploy** | Resolver os 4 Solarman (inativar usina ou anotar publicamente) | 5 min | Único item visualmente embaraçoso |
| **Antes do deploy** | Cruzar 3 usinas Solis com `1D4C3` sticky vs `subdesempenho` interno (rec #2 do doc) | ~30 min de query | Validar que não é falso negativo do motor |
| **Pós deploy (próxima sprint)** | Escalonamento `sem_comunicacao` >7d (rec #1 do doc) | P | Resolve o caso de raiz dos 4 Solarman |
| **Pós deploy** | Camada de notificação básica (email/webhook) | M | Pré-requisito do "dono receber alerta sem abrir painel" |
| **Quando voltar aos alertas** | Tabela `AlertaNativoAuditoria` (rec #3 do doc) | M | Não bloqueia nada; útil pra calibração futura |
| **Quando voltar aos alertas** | Auto-inativar usinas mortas (rec #6 do doc) | M | Higiene operacional, mas precisa de fluxo reversível |

---

## Resumo pro dono do sistema

> O sistema interno cobre todos os tipos de alerta úteis dos 6 provedores e ainda 6 categorias que **nenhum** provedor expõe (frequência, temperatura, MPPT por string, dado ausente, queda de rendimento, garantia). Nos casos em que o provedor dá alerta, mediu-se que >50% seria ruído (96% no AuxSol, p50=5min). Os 4 alertas críticos que aparecem "antigos" no painel são usinas realmente offline há semanas — o motor está correto; falta só a camada de escalonamento/notificação, que entra na próxima fase. Pode entrar em alpha; foco subsequente vai pra segurança e multiempresas.

---

## Onde retomar

- Documento-base: `docs/relatorio-alertas-nativos-vs-sistema-novo.md`
- Código relevante:
  - `backend/apps/alertas/regras/sem_comunicacao.py` — regra que disparou os 4 Solarman críticos
  - `backend/apps/alertas/regras/inversor_offline.py` — carência de 3 coletas, agregar por usina
  - `backend/apps/alertas/regras/string_mppt_zerada.py` — já com `None` correto
  - `backend/apps/provedores/adapters/foxess/adapter.py` — já usa `_fault_ativo` correto
  - `backend/apps/core/models.py` — `ConfiguracaoEmpresa` (sem `parar_alerta_apos_dias`)
- Próxima ação ao retomar: decidir entre (a) inativar as 4 usinas Solarman ou (b) escrever release-note explicativa antes do deploy.
