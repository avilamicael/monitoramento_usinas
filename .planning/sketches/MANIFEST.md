---
created: 2026-05-07
---

# Sketch Manifest

## Design Direction

Tirar a "cara de IA" do dashboard de monitoramento de usinas solares — produto B2B operacional onde o usuário-alvo é um técnico/operador olhando severidades de alertas, números elétricos (kW, V, Hz, °C) e estado de inversores. Hoje usa shadcn + Tailwind v4 + Geist com tokens neutros zerados (oklch sem chroma), o que dá visual genérico de template. Identidade própria deve vir de **decisões fortes em poucas alavancas**: tipografia com personalidade, paleta com 1-2 acentos calibrados pro domínio (energia, severidade), e sistema de espaçamento/raio próprio.

## Reference Points

- **Linear, Vercel dashboard, Grafana** — denso, técnico, monoespaçado em números
- **Stripe docs, Posthog, Plain** — editorial, serif display, off-white quente
- **Cal.com, Railway** — brutalist-leve, tipografia pesada, cores chapadas

## Constraints

- Stack: React 19 + Tailwind v4 + shadcn (componentes existentes precisam absorver mudança via tokens CSS)
- Domínio: severidade (`info` / `aviso` / `crítico`), status (`online` / `offline`), números elétricos
- PT-BR no UI; nada de inglês em labels do operador

## Sketches

| #   | Name             | Design Question                                                              | Winner | Tags                       |
| --- | ---------------- | ---------------------------------------------------------------------------- | ------ | -------------------------- |
| 001 | direcao-visual   | Qual direção visual (industrial/editorial/brutalist) cabe melhor no produto? | **A · Industrial** | typography, palette, brand |
| 002 | telas-operacionais | A direção industrial sustenta detalhe de usina (com gráfico) e /alertas (28 itens)? | — | layout, detail-page, alerts, density |
| 003 | dark-mode          | Como a direção industrial vira dark? O cobre sobrevive ou precisa recalibrar? | **B · Calibrado** | dark-mode, palette |
| 004 | estados            | Como tratar empty/loading/erro/onboarding sem virar shadcn padrão? | **approved** | empty-state, loading, error, onboarding |

## Decisões consolidadas (after 004)

**Identidade visual fixada:**
- Tipografia: Geist (UI) + Geist Mono (números, IDs, timestamps)
- Acento light: cobre/âmbar `#b45309` · soft `#fef3c7` · texto soft `#78350f`
- Acento dark: amber-500 `#f59e0b` · soft `#2a200a` · texto soft `#fbbf24`
- Severidades light: info `#475569` · aviso `#b45309` · crítico `#991b1b` · sucesso `#15803d`
- Severidades dark: info `#94a3b8` · aviso `#f59e0b` · crítico `#ef4444` · sucesso `#22c55e`
- Background light: `#f7f7f5` (não branco puro), surface `#ffffff`, border `#e3e3df`
- Background dark: `#0e1014` (toque sutil de azul), surface `#16191e`, border `#262a32`
- Raios: `--radius-sm 3px`, `--radius-md 4px`, `--radius-lg 6px` (sutil, quase reto)
- Densidade: font-size base 13px (não 14px shadcn default)
- Sombras: quase imperceptíveis — definição vem da borda

**Padrões de componentes:**
- Números técnicos sempre com `font-variant-numeric: tabular-nums` em Geist Mono
- Tabelas com hover `var(--color-surface-2)`, sem zebra-stripes
- Status com `box-shadow: 0 0 0 2px color-mix()` no dot (halo sutil)
- Sidebar nav-item ativo tem `box-shadow: inset 2px 0 0 var(--color-primary)` à esquerda
- Badges com `text-transform: uppercase` + `letter-spacing: 0.04em` (compacto técnico)
- Severidade comunicada por **pelo menos 2 sinais**: cor + barra-vertical (em rows) ou cor + ícone (em badges)
- Tabs internas: `border-bottom: 2px solid var(--color-primary)` no ativo, sem fundo

**Padrões de estado:**
- Empty: ícone (56px, soft) + título + mensagem contextual + 2 CTAs (1 primária, 1 alternativa/link)
- Loading: skeleton espelha estrutura final — nada de spinner genérico
- Erro: evidência factual (HTTP code, timestamp, contagem) sem stack trace
- Toast: dado real ("8 usinas · 156 leituras em 4,2s") em vez de "Sucesso!"
- Ações destrutivas: Desfazer inline no toast (5s) substitui modal de confirmação
- Pulse animation só em estados com tempo conhecido (aguardando primeira coleta, próximo ciclo em 3min)
- Banner inline pra degradação parcial; hero error state pra falha total

**Regras de tom:**
- PT-BR humano em toda UI — nada de "threshold", "rate limit", "status code" sem traduzir
- "Não é problema do seu lado" pra erros infra (provedor)
- Tempo estimado em onboarding ("~2 min") reduz ansiedade
- Estados especiais (regra desativada, garantia expirada) explicam *quais regras estão afetadas*

## Direção Vencedora

**Industrial** (sketch 001/A): Geist + Geist Mono, paleta neutro-fria com acento âmbar/cobre (`#b45309`), raio sutil 3-6px, severidades dessaturadas (info=slate `#475569`, aviso=âmbar `#b45309`, crítico=tijolo `#991b1b`). Densidade alta (font-size base 13px). Tabela compacta, números técnicos com `font-variant-numeric: tabular-nums` em Geist Mono. Sparklines minimalistas nos KPIs.

Tokens canônicos em `.planning/sketches/themes/industrial.css` — pronto para ser portado pra `frontend/src/index.css` quando passar pra implementação.
