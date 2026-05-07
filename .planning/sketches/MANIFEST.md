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
| 004 | estados            | Como tratar empty/loading/erro/onboarding sem virar shadcn padrão? | — | empty-state, loading, error, onboarding |

## Direção Vencedora

**Industrial** (sketch 001/A): Geist + Geist Mono, paleta neutro-fria com acento âmbar/cobre (`#b45309`), raio sutil 3-6px, severidades dessaturadas (info=slate `#475569`, aviso=âmbar `#b45309`, crítico=tijolo `#991b1b`). Densidade alta (font-size base 13px). Tabela compacta, números técnicos com `font-variant-numeric: tabular-nums` em Geist Mono. Sparklines minimalistas nos KPIs.

Tokens canônicos em `.planning/sketches/themes/industrial.css` — pronto para ser portado pra `frontend/src/index.css` quando passar pra implementação.
