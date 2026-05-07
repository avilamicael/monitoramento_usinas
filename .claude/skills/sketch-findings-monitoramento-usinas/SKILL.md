---
name: sketch-findings-monitoramento-usinas
description: Decisões de design validadas, tokens CSS, padrões HTML e direção visual do dashboard de monitoramento de usinas. Auto-loaded durante implementação de UI.
---

<context>

# Projeto: monitoramento_usinas

Sistema multi-empresa de monitoramento de usinas solares (267 usinas / 659 inversores na carteira atual). Stack: Django 5 backend + React 19 / Vite / Tailwind v4 / shadcn frontend, em PT-BR.

## Direção visual fixada — Industrial

Denso, monoespaçado em números, acento âmbar/cobre. Vibe Linear / Vercel dashboard / Grafana — tira a "cara de IA" do shadcn padrão sem virar brutalist gritado nem editorial fofinho.

**Decisões centrais:**
- Tipografia: **Geist** (UI) + **Geist Mono** (números, IDs, timestamps) — instalar `@fontsource-variable/geist-mono`
- Acento light: cobre/âmbar `#b45309` · soft `#fef3c7`
- Acento dark: amber-500 `#f59e0b` · recalibrado pra fundo escuro
- Severidades dessaturadas: info=slate · aviso=âmbar · crítico=tijolo `#991b1b` (light) / red-500 `#ef4444` (dark)
- Background light `#f7f7f5` (não branco puro), dark `#0e1014` (toque de azul, não preto)
- Raios curtos `3px / 4px / 6px`, bordas finas, sombras quase imperceptíveis
- Densidade alta: font-size base **13px** (não 14px do shadcn default)

**Sketches wrapped:** 2026-05-07

## Reference points

- Linear, Vercel dashboard, Grafana (vibe técnica densa)
- Stripe docs, Posthog (descartado — editorial não cabe no operacional)
- Cal.com, Railway (descartado — brutalist cansa em uso prolongado)

</context>

<design_direction>

## Resumo da direção

Industrial-técnico. **Identidade vem de poucas alavancas fortes**:
1. Geist + Geist Mono com `tabular-nums` em todo número técnico
2. Cobre/âmbar `#b45309` calibrado por cromatismo (light: cobre saturado; dark: amber-500 brilhante) — narrativa "energia/condutor" sem clichê eco
3. Severidades dessaturadas — comunicam urgência sem virar tomate ansiogênico
4. Densidade alta — operador tria 14+ alertas; respiração vem do espaçamento, não do font-size
5. Severidade comunicada por **2 sinais** (cor + ícone, ou cor + barra-vertical) — acessibilidade não-negociável
6. Sombras quase nulas — definição vem da borda

**Tudo o que vai pra `frontend/src/index.css` está em `references/identidade-visual.md` com os mapeamentos exatos pros tokens shadcn (`--background`, `--primary`, etc).**

</design_direction>

<findings_index>

## Áreas de design

| Área | Reference | Decisão chave |
|---|---|---|
| **Identidade visual & tema** | `references/identidade-visual.md` | Industrial light + dark calibrado, mapeamento completo pros tokens shadcn, anti-patterns rejeitados |
| **Padrões de tela & layout** | `references/padroes-de-tela.md` | App shell, hero da usina (5 KPIs sem cards), tabela densa, tabs internas, gráfico SVG inline, lista de alertas agrupada, painel lateral fixo |
| **Estados & feedback** | `references/estados-e-feedback.md` | Empty/loading/erro/onboarding/toast — princípios PT-BR humano, evidência sem stack, skeleton espelha estrutura, Desfazer inline |

## Theme files

- `sources/themes/industrial.css` — tokens light (winner sketch 001 variant A)
- `sources/themes/default.css` — alias pra industrial
- `sources/themes/editorial.css`, `sources/themes/brutalist.css` — direções rejeitadas (mantidos pra referência negativa)

Os tokens dark estão **inline em `references/identidade-visual.md`** (sketch 003 winner B · calibrado).

## Source files

- `sources/001-direcao-visual/index.html` — comparação 3 direções (winner A · Industrial)
- `sources/002-telas-operacionais/index.html` — detalhe usina + /alertas cheia
- `sources/003-dark-mode/index.html` — 3 abordagens dark (winner B · Calibrado)
- `sources/004-estados/index.html` — showroom de empty/loading/erro/onboarding/toast/especiais

## Quando carregar este skill

- Implementando ou refinando qualquer componente do `frontend/`
- Editando `frontend/src/index.css` ou os tokens shadcn
- Criando empty states, loading skeletons, error states ou toasts
- Modificando layouts (sidebar, topbar, hero, tabela, lista de alertas)
- Adicionando uma página nova ao `frontend/src/pages/`
- Decidindo paleta, tipografia, geometria, sombra ou densidade visual

</findings_index>

<metadata>

## Sketches processados

- 001-direcao-visual (winner: A · Industrial)
- 002-telas-operacionais (approved)
- 003-dark-mode (winner: B · Calibrado)
- 004-estados (approved)

</metadata>
