---
sketch: 001
name: direcao-visual
question: "Qual direção visual cabe melhor no produto: industrial, editorial ou brutalist-leve?"
winner: "A"
tags: [typography, palette, brand, identity]
---

# Sketch 001: Direção visual

## Design Question

Tirar a "cara de IA" do shadcn padrão escolhendo uma direção visual com personalidade. As 3 variantes aplicam paleta, tipografia, espaçamento e raio diferentes ao mesmo conjunto de telas (dashboard + tabela usinas + detalhe inversor + alertas) pra você sentir cada direção em contexto operacional real.

## How to View

```
xdg-open .planning/sketches/001-direcao-visual/index.html
# ou no WSL:
explorer.exe .planning/sketches/001-direcao-visual/index.html
```

Use as tabs no topo ou as teclas `1` / `2` / `3` pra alternar entre as variantes.

## Variants

- **A · Industrial** — Geist + Geist Mono, paleta neutro-fria com acento âmbar/cobre (`#b45309`), raio sutil (3-6px), severidades dessaturadas (info=slate, aviso=âmbar, crítico=vermelho-tijolo). Densidade alta (font-size base 13px), KPIs com sparkline, tabela compacta. Vibe: Linear, Vercel dashboard, Grafana.

- **B · Editorial** — Fraunces (serif display) + Inter Tight (corpo), off-white quente cor papel (`#f8f5ee`), acento verde-musgo (`#3f5b3a`), raio generoso, números em serif tabular. Whitespace amplo, descrições por extenso ("há quarenta e sete minutos"), tom de revista impressa B2B sério. Vibe: Stripe docs, Posthog, Plain.

- **C · Brutalist-leve** — Geist Black/800 nos títulos (UPPERCASE), bordas pretas 2px, cantos retos, acento amarelo-elétrico (`#ffd60a`), KPIs chapados (geração=amarelo, alertas=vermelho), shadow-offset duro (`4px 4px 0 #1a1a1a`). Alta legibilidade, identidade forte e gritada. Vibe: Cal.com, Railway, Anti-design.

## What to Look For

Compare especificamente:

1. **Severidade visual** — qual badge de "crítico" comunica urgência sem ser aterrorizante? E "aviso" sem virar barulho?
2. **Números técnicos** — `82,1 °C`, `218,4 V`, `12.483 kWh`. Em qual variante eles "respiram" melhor? Os números são o conteúdo principal pro operador.
3. **Densidade vs respiração** — Industrial cabe ~6 linhas de tabela na dobra; Editorial ~3; Brutalist ~5. Quando o operador está triando 14 alertas, qual cansa menos?
4. **Personalidade vs profissionalismo** — Brutalist é o mais "instagramável" e o mais arriscado de cansar; Editorial é elegante mas pode parecer "blog"; Industrial é o mais seguro mas o que mais corre risco de virar "outro dashboard".
5. **Hierarquia tipográfica** — em qual o título "Visão geral" se diferencia o suficiente do título da seção "Usinas com atenção"?
6. **Consistência com domínio** — verde-musgo do Editorial flerta com "eco-responsável"; amarelo do Brutalist com "alta voltagem"; cobre do Industrial com "cobre/condutor". Qual narrativa cabe melhor?

## Decision Log

- **Direção escolhida:** A · Industrial — Geist + Geist Mono, paleta neutro-fria com acento âmbar/cobre, raio sutil, severidades dessaturadas.
- **Próximos refinamentos:** validar acento (cobre `#b45309` vs alternativas como verde-elétrico, azul-aço) e calibrar severidades sob carga (10+ alertas críticos lado-a-lado).
