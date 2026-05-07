# Sketch Wrap-Up Summary

**Date:** 2026-05-07
**Sketches processed:** 4
**Design areas:** identidade-visual, padroes-de-tela, estados-e-feedback
**Skill output:** `./.claude/skills/sketch-findings-monitoramento-usinas/`

## Included Sketches

| #   | Name               | Winner             | Design Area              |
| --- | ------------------ | ------------------ | ------------------------ |
| 001 | direcao-visual     | A · Industrial     | identidade-visual        |
| 002 | telas-operacionais | approved           | padroes-de-tela          |
| 003 | dark-mode          | B · Calibrado      | identidade-visual        |
| 004 | estados            | approved           | estados-e-feedback       |

## Excluded Sketches

Nenhum.

## Design Direction

**Industrial.** Denso, monoespaçado em números, acento âmbar/cobre. Tira a cara de IA do shadcn padrão escolhendo decisões fortes em poucas alavancas:

- **Tipografia** — Geist (UI) + Geist Mono (números, IDs, timestamps) com `font-variant-numeric: tabular-nums` em todo dado técnico
- **Acento** — cobre/âmbar `#b45309` em light (narrativa "energia/condutor"), recalibrado pra amber-500 `#f59e0b` em dark
- **Severidades dessaturadas** — info=slate, aviso=âmbar, crítico=tijolo `#991b1b`. Em dark: red-500 `#ef4444` mais brilhante
- **Geometria** — raio 3-6px (sutil, quase reto), bordas finas, sombras quase nulas (definição vem da borda)
- **Densidade** — font-size base 13px, espaçamento via grid de 4px. Operador tria 14+ alertas

## Key Decisions

### Layout
- App shell: sidebar 240px + topbar 56px + main com padding 24px/32px
- Sidebar nav-item ativo: `inset 2px 0 0 var(--color-primary)` (linha cobre à esquerda)
- Hero da usina: 5 KPIs separados por divisor vertical (sem cards individuais)
- Detalhe split 1.4fr/1fr (conteúdo principal + sidebar de contexto)
- Tabela densa, hover-row, sem zebra-stripes

### Componentes
- Severidade comunicada por **2 sinais** (cor + ícone, ou cor + barra-vertical 3px em rows)
- Badge: UPPERCASE, tracking 0.04em, font-size 11px, border-radius pill
- Status dot: 6px com halo de `box-shadow: 0 0 0 2px color-mix()`
- Tabs internas: underline 2px cobre, sem fundo
- Lista de alertas agrupada por usina com headers colapsáveis e num-pill por severidade
- Painel lateral sticky pra detalhes de item selecionado

### Estados
- Empty: ícone soft 56px + título + msg contextual + 2 CTAs
- Empty positivo (zero alertas): verde + dado factual
- Loading: skeletons espelham estrutura final (não spinner genérico)
- Loading "vivo" com pulse animation só pra esperas com tempo conhecido
- Erro: evidência (HTTP code, timestamp, contagem) sem stack trace
- Banner inline pra degradação parcial; hero error pra falha total
- Toast: dado real ("8 usinas · 156 leituras em 4,2s")
- Ações reversíveis: Desfazer inline (5s) substitui modal de confirmação

### Tom (PT-BR)
- "Não é problema do seu lado" pra erros de provedor
- Tempos estimados em onboarding ("~2 min") reduz ansiedade
- Estados especiais (regra desativada, garantia expirada) explicam *quais regras estão afetadas*
- Nunca "threshold", "rate limit", "status code" sem traduzir contexto

## Anti-patterns rejeitados (resumo)

- ❌ Tons zerados puros (`oklch sem chroma`) — é literalmente o look "shadcn default genérico"
- ❌ Inter como fonte primária — Geist é mais distinto
- ❌ Acento azul `#3b82f6` shadcn default
- ❌ Severidade vermelho-tomate `#ef4444` em fundo claro (vira tijolo `#991b1b`)
- ❌ Sombras pesadas / bordas grossas
- ❌ UPPERCASE em texto corrido / títulos longos
- ❌ Cards individuais pra cada KPI no hero
- ❌ Severidade só por cor (acessibilidade)
- ❌ Filtros em modal/drawer
- ❌ "No data" + ícone de caixinha vazia
- ❌ Spinner anônimo no meio da tela
- ❌ Stack trace em UI
- ❌ "Sucesso!" sem dado
- ❌ Modal de confirmação pra ações reversíveis

## Próximos passos sugeridos

1. **`/gsd-plan-phase`** — planejar a fase de redesign visual real (que arquivos editar, em que ordem)
2. **Considerar provisão de swap** na VPS (1.9GB RAM atual) antes do primeiro deploy do bundle novo — build do Vite consome muita memória e já causou OOM
