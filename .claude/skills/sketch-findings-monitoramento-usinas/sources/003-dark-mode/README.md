---
sketch: 003
name: dark-mode
question: "Como a direção industrial vira modo escuro? O cobre #b45309 sobrevive em fundo escuro ou precisa recalibrar o acento?"
winner: "B"
tags: [dark-mode, palette, accessibility]
---

# Sketch 003: Modo escuro · direção industrial

## Design Question

Operação B2B costuma rodar muitas horas — dark mode importa. O cobre saturado `#b45309` que funciona bem em fundo claro pode ficar pesado/sujo em fundo escuro. As 3 variantes mostram abordagens diferentes pra resolver, mais a referência light pra comparar consistência de identidade entre os modos.

## How to View

```
explorer.exe .planning\sketches\003-dark-mode\index.html
```

Tabs `1` `2` `3` `4`.

## Variants

- **A · Espelho** — inversão direta sem calibração. Mantém `#b45309` como acento e severidades light-mode. Mostra **o que NÃO funciona**: cobre fica saturado/sujo, vermelho-tijolo do crítico perde leitura, severidades comprimidas. Útil só como referência negativa.

- **B · Calibrado** *(recomendação)* — fundo neutro escuro `#0e1014` com toque sutil de azul (não preto puro). Surface `#16191e`, surface-2 `#1c2027`. Acento recalibrado de `#b45309` → `#f59e0b` (amber-500, mais brilhante e legível em dark). Severidades subidas pra `red-500 #ef4444`, `green-500 #22c55e`, `slate-400`. Mantém narrativa "âmbar=energia" mas com cromatismo apropriado pra dark.

- **C · Console** — fundo quase preto `#050608`, bordas mais aparentes (`#1f2128`) que definem o layout no lugar de superfícies. Acento `#fb923c` (orange-400, mais quente/agressivo). Vibe Linear/Vercel/devops/infra. Identidade mais forte mas mais agressiva — pode cansar em uso prolongado.

- **↺ Light** — direção industrial vencedora do sketch 001 pra comparação imediata. Útil pra checar se a transição light↔dark mantém identidade.

## What to Look For

1. **Acento âmbar** — em qual cromatismo (`#b45309` espelho / `#f59e0b` amber / `#fb923c` orange) ele lê bem em dark sem ficar saturado?
2. **Severidade `crítico`** — em qual dos 3 darks o vermelho do KPI "14 alertas" e o badge "crítico" comunicam urgência sem ficar cobrindo a tela?
3. **Hierarquia de superfícies** — bg → surface → surface-2 — em qual variante a separação entre níveis fica clara sem precisar de bordas grossas? Console depende de borda; Calibrado depende de luminosidade.
4. **Consistência light↔dark** — alternando entre tabs 4 (light) e 2 (calibrado), a identidade ainda parece a mesma marca?
5. **Conforto prolongado** — qual cansa menos em 8h de operação? Espelho/Calibrado são mais "neutros"; Console é mais "infraestrutura/24h".
6. **Sparklines** — em qual variante os SVG de tendência (cobre/verde/vermelho) ficam legíveis sem virar manchinha?
7. **Gradient do avatar** — o avatar "MA" no canto superior direito usa o acento — em qual variante ele "marca" sem virar farol?

## Decision Log

_(preencher após decidir)_

- Variante escolhida: ?
- Manter ou descartar dark mode no roadmap inicial: ?
- Implementar agora ou deixar pra depois (toggle de usuário): ?
