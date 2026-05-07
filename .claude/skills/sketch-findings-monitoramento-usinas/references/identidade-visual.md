# Identidade visual & tema

Decisões finalizadas pra direção **Industrial** (sketches 001 + 003). Tudo o que entra em `frontend/src/index.css` e nos tokens shadcn.

## Decisão central

Direção **Industrial** — denso, monoespaçado em números, acento âmbar/cobre. Vibe Linear/Vercel/Grafana. Vencedor sobre Editorial (Fraunces serif + verde-musgo) e Brutalist-leve (Geist 800 UPPERCASE + amarelo elétrico).

**Por que venceu:**
- Cabe muito conteúdo na tela sem cansar (operador tria 14+ alertas)
- Números técnicos (`82,1 °C`, `218,4 V`, `12.483 kWh`) respiram bem em Geist Mono tabular
- Severidades dessaturadas comunicam urgência sem virar tomate
- Cobre/âmbar narra "energia/condutor" sem clichê eco

**Por que as outras perderam:**
- Editorial: bonito mas tom "blog/revista" não cabe num operacional 24h
- Brutalist: identidade forte mas cansa em uso prolongado; UPPERCASE quebra densidade

## Tokens light (default do produto)

```css
:root {
  /* Background & superfícies */
  --color-bg: #f7f7f5;            /* não branco puro — neutro frio */
  --color-surface: #ffffff;
  --color-surface-2: #fafaf8;     /* hover de tabela, fundo de input */
  --color-border: #e3e3df;
  --color-border-strong: #c9c9c3; /* hover, ênfase */

  /* Texto */
  --color-text: #18181b;
  --color-text-muted: #6b6b65;    /* labels, metadados */
  --color-text-subtle: #9a9a93;   /* timestamps, helpers */

  /* Acento — cobre/âmbar */
  --color-primary: #b45309;       /* amber-700 — botões, links, marca */
  --color-primary-hover: #92400e;
  --color-primary-soft: #fef3c7;  /* fundo de badge, KPI ativo */
  --color-primary-soft-text: #78350f;

  /* Severidades — dessaturadas, calibradas pro contexto operacional */
  --color-info: #475569;          /* slate-600 — info é só visibilidade */
  --color-info-soft: #f1f5f9;
  --color-info-soft-text: #334155;

  --color-warn: #b45309;          /* alinhado ao primary */
  --color-warn-soft: #fef3c7;
  --color-warn-soft-text: #78350f;

  --color-danger: #991b1b;        /* tijolo, não tomate */
  --color-danger-soft: #fee2e2;
  --color-danger-soft-text: #7f1d1d;

  --color-success: #15803d;
  --color-success-soft: #dcfce7;
  --color-success-soft-text: #166534;

  /* Status (estados de equipamento) */
  --color-online: #15803d;
  --color-offline: #9a9a93;       /* offline = subtle, não vermelho */
}
```

## Tokens dark (calibrado — sketch 003 winner B)

```css
.dark {
  /* Background com toque sutil de azul, não preto puro */
  --color-bg: #0e1014;
  --color-surface: #16191e;
  --color-surface-2: #1c2027;
  --color-border: #262a32;
  --color-border-strong: #3a3f4a;

  --color-text: #ececef;
  --color-text-muted: #a0a4ad;
  --color-text-subtle: #6b6f78;

  /* Acento recalibrado: cobre #b45309 fica saturado em dark — sobe pra amber-500 */
  --color-primary: #f59e0b;
  --color-primary-hover: #fbbf24;
  --color-primary-soft: #2a200a;       /* amber escuro */
  --color-primary-soft-text: #fbbf24;

  --color-info: #94a3b8;
  --color-info-soft: #1a1f29;
  --color-info-soft-text: #cbd5e1;

  --color-warn: #f59e0b;
  --color-warn-soft: #2a200a;
  --color-warn-soft-text: #fbbf24;

  --color-danger: #ef4444;             /* red-500 — mais legível em dark */
  --color-danger-soft: #2a1212;
  --color-danger-soft-text: #fca5a5;

  --color-success: #22c55e;
  --color-success-soft: #0a2018;
  --color-success-soft-text: #86efac;

  --color-online: #22c55e;
  --color-offline: #6b6f78;
}
```

## Tipografia

```css
:root {
  --font-sans: 'Geist Variable', system-ui, sans-serif;     /* já no projeto */
  --font-mono: 'Geist Mono Variable', ui-monospace, monospace; /* ADICIONAR */
  --font-display: var(--font-sans);                          /* mesmo Geist, peso 600 */

  /* Densidade técnica — base 13px (não 14px do shadcn default) */
  --text-xs: 11px;
  --text-sm: 12px;
  --text-base: 13px;
  --text-md: 14px;
  --text-lg: 16px;
  --text-xl: 20px;
  --text-2xl: 26px;
  --text-3xl: 34px;

  --tracking-tight: -0.02em;
  --tracking-wide: 0.04em;
}

body {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: 1.5;
  letter-spacing: -0.005em;
  font-feature-settings: "ss01", "cv11", "tnum";
  -webkit-font-smoothing: antialiased;
}
```

**Instalar Geist Mono:**
```bash
cd frontend && npm install @fontsource-variable/geist-mono
```

E em `frontend/src/index.css` (no topo):
```css
@import "@fontsource-variable/geist-mono";
```

## Geometria

```css
:root {
  --radius-sm: 3px;      /* pílulas pequenas */
  --radius-md: 4px;      /* botões, inputs */
  --radius-lg: 6px;      /* cards, surfaces */
  --radius-pill: 9999px; /* badges, status chips */

  /* shadcn já gera os outros via calc — manter */
}
```

Raios curtos transmitem "técnico/preciso". Evitar `--radius` ≥ 8px (vira marketing/SaaS genérico).

## Sombras

```css
:root {
  --shadow-sm: 0 1px 0 rgba(0,0,0,0.04);
  --shadow-md: 0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03);
  --shadow-lg: 0 4px 12px rgba(0,0,0,0.06);
}

.dark {
  --shadow-sm: 0 1px 0 rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03);
}
```

**Princípio:** sombras quase imperceptíveis — definição vem da borda, não da sombra. Nunca usar `--shadow` com `blur > 16px` ou `opacity > 0.1` no light.

## Mapeamento pra tokens shadcn existentes

Os componentes shadcn em `frontend/src/components/ui/` consomem variáveis como `--background`, `--foreground`, `--primary`, etc. Mapeamento sugerido (em `frontend/src/index.css`):

| shadcn token | Industrial light | Industrial dark |
|---|---|---|
| `--background` | `#f7f7f5` | `#0e1014` |
| `--foreground` | `#18181b` | `#ececef` |
| `--card` | `#ffffff` | `#16191e` |
| `--card-foreground` | `#18181b` | `#ececef` |
| `--popover` | `#ffffff` | `#16191e` |
| `--primary` | `#b45309` | `#f59e0b` |
| `--primary-foreground` | `#ffffff` | `#18181b` |
| `--secondary` | `#fafaf8` | `#1c2027` |
| `--muted` | `#fafaf8` | `#1c2027` |
| `--muted-foreground` | `#6b6b65` | `#a0a4ad` |
| `--accent` | `#fef3c7` | `#2a200a` |
| `--accent-foreground` | `#78350f` | `#fbbf24` |
| `--destructive` | `#991b1b` | `#ef4444` |
| `--border` | `#e3e3df` | `#262a32` |
| `--input` | `#e3e3df` | `#262a32` |
| `--ring` | `#b45309` | `#f59e0b` |
| `--radius` | `0.375rem` (6px) | `0.375rem` (6px) |

Manter os tokens em **oklch** ou **hex** — escolher um e ser consistente. O index.css atual usa oklch; pode-se converter os hex acima ou manter hex e adaptar `@theme inline`. **Prefira hex** pra acertar a calibração visual com os sketches.

**Tokens novos** (não existem no shadcn padrão, adicionar no `@theme inline`):
- `--color-warn`, `--color-warn-soft`, `--color-warn-soft-text` (severidade aviso)
- `--color-info`, `--color-info-soft`, `--color-info-soft-text` (severidade info)
- `--color-success`, `--color-success-soft` (estados positivos, status online)
- `--color-online`, `--color-offline` (status de equipamento)
- `--color-text-muted`, `--color-text-subtle` (níveis de hierarquia textual; shadcn só tem `--muted-foreground`)
- `--font-mono` (Geist Mono)

## Padrões obrigatórios em componentes

### Números técnicos

**Sempre** em `font-mono` com `tabular-nums`:

```css
.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
```

Tudo que é métrica, ID, timestamp, código (`82,1 °C`, `INV-03`, `14:30`, `1A23B45C67D`) usa essa classe. Layouts em tabela ficam alinhados sem hack.

### Status dot

```html
<span class="status">
  <span class="status-dot"></span>
  Online
</span>
```

```css
.status-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--color-online);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-online) 20%, transparent);
}
.status.offline .status-dot {
  background: var(--color-offline);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-offline) 20%, transparent);
}
```

O `box-shadow` cria um halo sutil — não usar `border` (descentraliza pixel).

### Severidade comunicada por 2 sinais

**Acessibilidade não-negociável**: severidade nunca depende só de cor. Em qualquer lugar que a severidade aparece, deve ter pelo menos 2 sinais:

- Badge: cor de fundo + ícone (`!`, `⚠`, `i`) + texto ("crítico", "aviso")
- Linha de tabela: barra-vertical-3px de cor + badge no canto
- Ícone de alerta: caixa com background colorido + glifo (`!` pra crítico, `⚠` pra aviso, `i` pra info)

```css
/* Barra de severidade vertical em rows */
.alert-sev-bar {
  width: 3px; height: 32px; border-radius: 2px;
  background: var(--color-info);
}
.alert-row.critico .alert-sev-bar { background: var(--color-danger); }
.alert-row.aviso   .alert-sev-bar { background: var(--color-warn); }
.alert-row.info    .alert-sev-bar { background: var(--color-info); }
```

### Badge

```css
.badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px;
  font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.04em;
  border-radius: var(--radius-pill);
}
.badge.aviso   { background: var(--color-warn-soft);    color: var(--color-warn-soft-text); }
.badge.critico { background: var(--color-danger-soft);  color: var(--color-danger-soft-text); }
.badge.info    { background: var(--color-info-soft);    color: var(--color-info-soft-text); }
.badge.ok      { background: var(--color-success-soft); color: var(--color-success-soft-text); }
```

`UPPERCASE + tracking 0.04em` é o "som" técnico do produto. Não usar em texto corrido — só em badges/labels/section-titles.

## Anti-patterns (rejeitados durante sketches)

### ❌ Tons zerados puros (oklch sem chroma)

O `index.css` atual usa `oklch(1 0 0)`, `oklch(0.145 0 0)` etc — completamente neutro sem cromaticidade. **Isso é literalmente o look "shadcn default genérico"** que queremos evitar. O fundo `#f7f7f5` (industrial) tem chroma sutil que dá calor sem virar amarelado. Trocar isso é a maior alavanca de "tirar a cara de IA".

### ❌ Inter como fonte primária

Geist é mais distinto, já está no projeto, e seu mono casa visualmente. Não voltar pro Inter.

### ❌ Acento azul (#3b82f6 default shadcn)

Azul é "o jeans da web" — todo mundo usa. Cobre/âmbar dá narrativa de domínio (energia/painel solar/condutor) sem virar clichê eco-verde.

### ❌ Severidade vermelho-tomate puro (#ef4444 em light)

Em fundo claro, `#ef4444` "grita" desproporcional. Tijolo `#991b1b` é assertivo sem ser ansiogênico. Em dark, o `#ef4444` funciona porque o fundo escuro neutraliza.

### ❌ Bordas grossas / sombras pesadas

Definição visual vem de **borda fina + tipografia + tabular-nums alinhados**, não de sombras drama. `border: 1px solid var(--color-border)` + `box-shadow: 0 1px 0 rgba(0,0,0,0.04)` é o teto. Sombras `0 4px 12px rgba(0,0,0,0.1)+` viram "marketing".

### ❌ UPPERCASE em texto corrido / títulos longos

Brutalist tentou e ficou cansativo. UPPERCASE só em:
- Section labels (`OPERAÇÃO`, `CONFIGURAÇÃO` na sidebar — 1 palavra)
- Badges de severidade (`CRÍTICO`, `AVISO`)
- Column headers da tabela

## Origin

- Sketches: 001-direcao-visual (winner A), 003-dark-mode (winner B)
- Sources: `sources/001-direcao-visual/`, `sources/003-dark-mode/`
- Theme files: `sources/themes/industrial.css`
