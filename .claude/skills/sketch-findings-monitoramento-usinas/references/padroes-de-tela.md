# Padrões de tela & layout

Estruturas e componentes validados nos sketches 001 e 002. Referência pra implementação real.

## App shell — sidebar fixa + main

```
┌─────────────┬──────────────────────────────────────────┐
│             │  topbar (h=56, breadcrumb · search · user)│
│   sidebar   ├──────────────────────────────────────────┤
│   (240px)   │                                          │
│             │  main (padding 24px 32px)                │
│             │                                          │
└─────────────┴──────────────────────────────────────────┘
```

```css
.app { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
.sidebar { background: var(--color-surface); border-right: 1px solid var(--color-border); padding: 20px 14px; }
.topbar { height: 56px; background: var(--color-surface); border-bottom: 1px solid var(--color-border);
          display: flex; align-items: center; justify-content: space-between; padding: 0 24px; }
.main { padding: 24px 32px 64px; }
```

### Sidebar nav

- Brand no topo (logo 24px + nome + linha-fina)
- Grupos com `nav-label` (UPPERCASE 10px tracking 0.08)
- Items com ícone 16px (opacity 0.75) + texto + opcional badge à direita
- Ativo tem `box-shadow: inset 2px 0 0 var(--color-primary)` (linha cobre à esquerda) e `padding-left: 12px` (compensa)

```css
.nav-item.active {
  background: var(--color-surface-2);
  color: var(--color-text);
  box-shadow: inset 2px 0 0 var(--color-primary);
  padding-left: 12px;
  border-radius: 0 4px 4px 0;
}
```

Nada de fundo-color sólido com cor primária no item ativo (vira "outro app"). A linha vertical é o sinal.

### Topbar

- Esquerda: breadcrumb com separador `/` em opacity 0.4
- Direita: search (estilo "input fake" — fundo surface-2, kbd `⌘K`), botão de ação contextual, user-chip (avatar gradiente + nome em pílula)

## Hero da página detalhe

Estrutura para página de detalhe (usina, conta, etc):

```
┌────────────────────────────────────────────────┐
│  Nome grande           [↻ Sync] [Editar] [⋮]    │
│  • Online · meta · meta · meta                  │
├────────────────────────────────────────────────┤
│ KPI │ KPI │ KPI │ KPI │ KPI                     │  ← sem cards individuais!
└────────────────────────────────────────────────┘
```

**Decisão chave do sketch 002:** os 5 KPIs do hero **não** ficam em cards separados. São colunas separadas por divisor vertical (`border-right: 1px solid var(--color-border)`) dentro do mesmo card hero. Resultado: alta densidade, leitura horizontal natural ("Pot atual / Hoje / Mês / Acumulado / Alertas").

```css
.hero-stats {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 0;
  border-top: 1px solid var(--color-border);
  margin: 0 -24px -20px;        /* "stretch" pra borda do card */
  padding: 16px 24px;
}
.hero-stat {
  padding: 0 16px;
  border-right: 1px solid var(--color-border);
}
.hero-stat:first-child { padding-left: 0; }
.hero-stat:last-child  { border-right: none; padding-right: 0; }

.hero-stat-label {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--color-text-muted); font-weight: 600; margin-bottom: 4px;
}
.hero-stat-value {
  font-family: var(--font-mono);
  font-size: 22px; font-weight: 500;
  letter-spacing: -0.015em; line-height: 1;
}
.hero-stat-unit {
  font-size: 11px; color: var(--color-text-muted);
  margin-left: 3px; font-family: var(--font-sans); font-weight: 400;
}
.hero-stat-meta { font-size: 11px; color: var(--color-text-muted); margin-top: 6px; }
```

## KPIs do dashboard (com sparkline)

Diferente do hero (denso, sem cards), os KPIs do dashboard são **cards individuais com sparkline**:

```html
<div class="kpi">
  <div class="kpi-label">Geração hoje</div>
  <div><span class="kpi-value">12.483</span><span class="kpi-unit">kWh</span></div>
  <div class="kpi-meta"><span class="kpi-trend-up">▲ 8,2%</span> vs ontem</div>
  <svg class="kpi-spark" viewBox="0 0 200 24" preserveAspectRatio="none">
    <polyline fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--color-success)" points="0,22 20,20 ..."/>
  </svg>
</div>
```

```css
.kpi {
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: 6px; padding: 16px; box-shadow: var(--shadow-sm);
}
.kpi-label {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--color-text-muted); font-weight: 600; margin-bottom: 6px;
}
.kpi-value {
  font-family: var(--font-mono);
  font-size: 28px; font-weight: 500;
  letter-spacing: -0.02em; line-height: 1.05;
  font-feature-settings: "tnum";
}
.kpi-unit { font-size: 13px; color: var(--color-text-muted); margin-left: 4px; font-family: var(--font-sans); }
.kpi-trend-up   { color: var(--color-success); font-weight: 600; }
.kpi-trend-down { color: var(--color-danger); font-weight: 600; }
.kpi-spark { display: block; width: 100%; height: 24px; margin-top: 10px; }
```

## Tabela densa com hover-row

```css
table.usinas thead th {
  text-align: left;
  font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--color-text-muted);
  padding: 10px 16px;
  background: var(--color-surface-2);
  border-bottom: 1px solid var(--color-border);
}
table.usinas tbody td {
  padding: 11px 16px;
  font-size: 13px;
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}
table.usinas tbody tr:last-child td { border-bottom: none; }
table.usinas tbody tr:hover { background: var(--color-surface-2); cursor: pointer; }
```

**Sem zebra-stripes**. Hover é o sinal de "linha clicável". Border-bottom 1px é suficiente pra separar.

### Cap-bar inline na tabela

Pra mostrar % capacidade dentro da célula sem ocupar coluna extra:

```html
<td class="num">75,0 <span class="muted">kWp</span>
  <div class="cap-bar"><div class="cap-fill" style="width:38%"></div></div>
</td>
```

```css
.cap-bar { width: 100%; height: 4px; background: var(--color-surface-2);
           border-radius: 999px; overflow: hidden; margin-top: 4px; }
.cap-fill { height: 100%; background: var(--color-primary); }
```

## Tabs internas (página de detalhe)

```html
<div class="tab-bar">
  <button class="tab active">Visão geral</button>
  <button class="tab">Inversores <span class="tab-count">6</span></button>
  <button class="tab">Alertas <span class="tab-count">3</span></button>
  <button class="tab">Histórico</button>
  <button class="tab">Garantia</button>
  <button class="tab">Configuração</button>
</div>
```

```css
.tab-bar { display: flex; align-items: center; border-bottom: 1px solid var(--color-border); margin-bottom: 20px; }
.tab {
  padding: 10px 16px; font-size: 13px; font-weight: 500;
  color: var(--color-text-muted);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 0.15s ease;
  display: inline-flex; align-items: center; gap: 6px;
}
.tab:hover  { color: var(--color-text); }
.tab.active { color: var(--color-text); border-bottom-color: var(--color-primary); font-weight: 600; }

.tab-count {
  font-size: 10px; padding: 1px 6px;
  background: var(--color-surface-2);
  border-radius: 999px;
  font-weight: 500; color: var(--color-text-muted);
  font-family: var(--font-mono);
}
.tab.active .tab-count { background: var(--color-primary-soft); color: var(--color-primary-soft-text); }
```

Linha cobre embaixo da tab ativa, sem fundo. Contador em pill mono.

## Range selector (gráfico)

```html
<div class="range-selector">
  <button class="range-btn">1H</button>
  <button class="range-btn active">HOJE</button>
  <button class="range-btn">7D</button>
  <button class="range-btn">30D</button>
  <button class="range-btn">ANO</button>
</div>
```

```css
.range-selector { display: inline-flex; gap: 0; border: 1px solid var(--color-border); border-radius: 4px; overflow: hidden; }
.range-btn { padding: 4px 10px; font-size: 11px; font-weight: 500;
             color: var(--color-text-muted); border-right: 1px solid var(--color-border); }
.range-btn:last-child { border-right: none; }
.range-btn:hover { background: var(--color-surface-2); }
.range-btn.active { background: var(--color-primary-soft); color: var(--color-primary-soft-text); }
```

## Gráfico SVG inline (potência ao longo do dia)

A direção industrial **sustenta visualização de dado em SVG inline** sem precisar de lib pesada. Padrão validado:

- Linha de potência em `var(--color-primary)`, stroke-width 2
- Área sob a curva com gradient soft do primary (opacity 0.18 → 0)
- Linha de capacidade nominal tracejada `stroke-dasharray="4,4" opacity="0.4"`
- Anotação inline no ponto atual: dot duplo (4px sólido + 8px halo opacity 0.2) + label mono ao lado
- X-axis labels em `Geist Mono 9px color-text-subtle`

Ver `sources/002-telas-operacionais/index.html` (variant A · linhas 470-510 do SVG).

**Quando usar lib**: se precisar de tooltips ricos, zoom, brushing — Recharts ou Visx. Mas o gráfico estilo "sparkline com anotação" deve ser SVG inline (mais leve, customização total dos tokens).

## Painel split (detalhe)

Layout 1.4fr / 1fr pra detalhe + sidebar de contexto:

```css
.split { display: grid; grid-template-columns: 1.4fr 1fr; gap: 24px; align-items: start; }
@media (max-width: 1100px) { .split { grid-template-columns: 1fr; } }
```

Lado esquerdo: conteúdo principal (gráfico, lista de inversores).
Lado direito: painéis de contexto (info, alertas abertos, atividade).

## Lista de alertas agrupada por usina

Padrão complexo do sketch 002 variant B. Estrutura:

```
┌──────────────────────────────────────────────────┐
│ ▼ Usina São José II · Petrolina · PE             │  ← group-head clicável
│   [1 crítico] [2 aviso]                          │
├──────────────────────────────────────────────────┤
│ │ Temperatura alta · INV-03      [crítico] 14:30 │  ← alert-row com sev-bar
│ │ String MPPT zerada · INV-03    [aviso]   14:30 │
│ │ Subdesempenho · INV-05         [aviso]   14:00 │
└──────────────────────────────────────────────────┘
```

```css
.group-head {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 16px;
  background: var(--color-surface-2);
  border-bottom: 1px solid var(--color-border);
  font-size: 12px; cursor: pointer; user-select: none;
}
.group-head:hover { background: color-mix(in srgb, var(--color-primary-soft) 20%, var(--color-surface-2)); }
.group-caret { font-size: 10px; color: var(--color-text-muted); transition: transform 0.15s; }
.group-collapsed .group-caret { transform: rotate(-90deg); }
.group-name { font-weight: 600; color: var(--color-text); }
.group-loc  { color: var(--color-text-muted); font-size: 11px; }
.group-counts {
  margin-left: auto; display: flex; gap: 6px;
  font-family: var(--font-mono); font-size: 11px; color: var(--color-text-muted);
}

.num-pill { padding: 1px 7px; border-radius: 999px; font-weight: 600; }
.num-pill.critico { background: var(--color-danger-soft); color: var(--color-danger-soft-text); }
.num-pill.aviso   { background: var(--color-warn-soft);   color: var(--color-warn-soft-text); }
.num-pill.info    { background: var(--color-info-soft);   color: var(--color-info-soft-text); }
```

### Alert row com barra-vertical

```css
.alert-row {
  display: grid;
  grid-template-columns: auto 1fr auto auto auto;  /* sev-bar | main | badge | time | actions */
  gap: 14px; padding: 12px 16px; align-items: center;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer; transition: background 0.15s;
}
.alert-row:hover { background: var(--color-surface-2); }
.alert-row.selected {
  background: color-mix(in srgb, var(--color-primary-soft) 30%, var(--color-surface));
  box-shadow: inset 2px 0 0 var(--color-primary);
}

.alert-sev-bar { width: 3px; height: 32px; border-radius: 2px; background: var(--color-info); }
.alert-row.critico .alert-sev-bar { background: var(--color-danger); }
.alert-row.aviso   .alert-sev-bar { background: var(--color-warn); }
.alert-row.info    .alert-sev-bar { background: var(--color-info); }

.alert-main-msg { font-size: 13px; font-weight: 500; line-height: 1.35; }
.alert-main-meta {
  font-size: 11px; color: var(--color-text-muted); margin-top: 2px;
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
}

.rule-tag {
  font-size: 10px; padding: 1px 6px; border-radius: 3px;
  background: var(--color-surface-2); color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  font-family: var(--font-mono); font-weight: 500;
}

.alert-time-cell {
  font-family: var(--font-mono); font-size: 11px; color: var(--color-text-muted);
  white-space: nowrap; text-align: right; min-width: 80px;
}
.alert-time-cell .duration { font-size: 10px; opacity: 0.7; display: block; margin-top: 1px; }

.alert-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s; }
.alert-row:hover .alert-actions { opacity: 1; }
```

### Painel lateral fixo (alerta selecionado)

```css
.side-panel {
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: 6px; padding: 16px; box-shadow: var(--shadow-sm);
  position: sticky; top: 60px;       /* gruda no topo durante scroll */
}
```

Conteúdo: badge + sub título · seções com `border-top` (Detalhes da leitura, Histórico 7d em sparkline-bar, Ação sugerida). Cada seção começa com `font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em` como label.

## Filtros — chip toggle + select

Mistura híbrida funciona: chips pros estados visualmente importantes (estado, severidade), select pra opções secundárias (agrupar por, provedor).

```css
.chip-toggle {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; font-size: 11px; font-weight: 500;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer; transition: all 0.15s;
}
.chip-toggle:hover { border-color: var(--color-border-strong); color: var(--color-text); }
.chip-toggle.active {
  background: var(--color-primary-soft);
  color: var(--color-primary-soft-text);
  border-color: transparent;
}
.chip-toggle .chip-count { font-family: var(--font-mono); font-size: 10px; opacity: 0.6; }
```

## Anti-patterns rejeitados

### ❌ Cards individuais pra cada KPI no hero

Foi tentado em todas as direções iniciais. Vira ruído visual com 5 cards. **Divisor vertical** (border-right) dentro de 1 card só é mais denso e sustentável.

### ❌ Severidade só por cor de fundo da row

Operadores com daltonismo / monitores com gama ruim perdem o sinal. **Sempre 2 sinais**: barra-vertical de cor + badge.

### ❌ Badges grandes (>12px font-size)

Badge é metadado. `font-size: 11px` + `padding: 2px 8px` é o teto. Se o badge for tão importante quanto o texto principal, **não é badge** — é heading da row.

### ❌ Filtros em modal/drawer

Filtros sempre inline (toolbar acima da lista). Operador filtra dezenas de vezes — abrir modal cada vez é fricção. Usar drawer só pra "filtros avançados raros".

### ❌ Tabs com pílulas coloridas no fundo

Underscore (border-bottom 2px) é o padrão do produto. Pílulas chapadas no fundo da tab vão competir com badges de severidade.

## Origin

- Sketch: 002-telas-operacionais
- Source: `sources/002-telas-operacionais/index.html`
- Variant A: detalhe usina · Variant B: /alertas cheia
