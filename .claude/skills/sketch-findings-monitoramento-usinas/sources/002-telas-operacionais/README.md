---
sketch: 002
name: telas-operacionais
question: "A direção industrial sustenta as duas telas mais densas do produto: detalhe da usina (com gráfico) e /alertas (com 28 alertas, filtros, agrupamento)?"
winner: null
tags: [layout, detail-page, alerts, density]
---

# Sketch 002: Telas operacionais

## Design Question

A direção industrial vencedora do sketch 001 foi validada num dashboard com volume modesto (5-6 linhas de tabela, 5 alertas). Sustenta as telas que de fato consomem o tempo do operador?

- **Detalhe de usina** — hero com 5 KPIs, gráfico de geração, lista de inversores com 6 itens, painéis laterais (info, alertas abertos, atividade), tabs internas.
- **Página /alertas cheia** — 28 alertas agrupados por usina, filtros por estado/severidade/agrupamento, painel lateral de detalhe do alerta selecionado.

## How to View

```
explorer.exe .planning\sketches\002-telas-operacionais\index.html
```

Tabs `1` (detalhe usina) e `2` (alertas).

## Variants

- **A · Detalhe da usina** — hero com 5 KPIs separados por divisor vertical (não cards), tabs internas (Visão geral / Inversores / Alertas / Histórico / Garantia / Configuração), grid 1.5fr/1fr com gráfico SVG inline (potência ao longo do dia, com ceiling de capacidade) + lista de inversores na esquerda, painéis (info, alertas abertos, atividade) na direita. INV-03 destacado em fundo soft-danger por estar com temperatura alta.

- **B · Página /alertas** — toolbar com chips de filtro (Aberto/Resolvido/Todos · Crítico/Aviso/Info) + selects de agrupamento e provedor + sumário ("22 visíveis · tempo médio aberto 1h 47min"). Lista agrupada por usina com headers colapsáveis e contagem por severidade. Cada linha tem barra de severidade vertical de 3px (substitui o badge dependente de cor sozinha), nome+contexto, badge de severidade, timestamp absoluto + duração relativa, ações inline em hover. Painel lateral fixo mostra detalhes do alerta selecionado: leitura, histórico de 7 dias em sparkline-bar, ação sugerida.

## What to Look For

1. **A barra de severidade vertical** (3px no início de cada alert-row) — comunica severidade sem depender só do badge colorido? Ajuda a varrer a lista visualmente?
2. **Agrupamento por usina** — colapsado vs expandido, contagem com num-pills no header. Faz sentido como default ou prefere lista plana?
3. **Painel lateral** — informações sobre o alerta selecionado (histórico, ação sugerida) merecem espaço fixo na lateral, ou viram drawer/modal?
4. **Hero da usina** — 5 KPIs separados por divisor vertical (sem cards individuais) — fica claro ou parece compactado demais?
5. **Gráfico SVG inline** — paleta industrial sustenta visualização de dado (linha cobre, área gradient soft, ceiling tracejado, anotação inline)? Ou precisa de uma lib (Recharts/Visx) que vai ter cara própria?
6. **Tabs internas** vs **subnav lateral** — Detalhe da usina usa tabs no topo (Visão geral / Inversores / Alertas / Histórico / Garantia / Configuração). Cabe? Ou tem coisas demais?
7. **INV-03 destacado** na lista de inversores (fundo `color-mix` de soft-danger) — sutil e funcional, ou ruído?
8. **Filtros como chips** vs selects — chips são mais visíveis mas ocupam espaço. Mistura híbrida funciona?

## Decision Log

_(preencher após decidir)_

- Vale a direção: ?
- Coisas a manter: ?
- Coisas a refinar: ?
