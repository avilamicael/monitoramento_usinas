# Phase 01 — Redesign visual (Industrial)

**Status:** Pronto pra execução
**Criado:** 2026-05-07
**Skill auto-load:** `sketch-findings-monitoramento-usinas` (já em CLAUDE.md)
**Equivalente em `docs/PLANO.md`:** F9 (próxima fase após F8)

## Goal

Tirar a "cara de IA" do frontend portando a direção visual **Industrial** validada nos sketches 001-004 pra `frontend/`. A interface absorve a mudança principalmente via troca de tokens em `index.css` (efeito imediato em todos os componentes shadcn). Componentes específicos do domínio (KpiCard com sparkline, AlertRow com sev-bar vertical, EmptyState/ErrorState com tom PT-BR) entram sob demanda nas refatorações de página.

## Non-goals

- Não muda regras de alerta, motor de coleta, modelos de dados, API do backend
- Não muda comportamento de garantia, configuração de empresa, política de retenção
- Não introduz lib nova de gráfico (Recharts/Visx) — sparklines/charts ficam em SVG inline
- Não documenta nada novo em `frontend/src/pages/docs/` (regras não mudam — política do CLAUDE.md)

## Scope

| Inclui | Não inclui |
|---|---|
| Tokens light + dark em `index.css` | Mudança de UX (fluxos, navegação) |
| Geist Mono como segunda fonte | Substituir shadcn por outra lib |
| Customização de Badge, Table, Button | Migração de Tailwind v4 |
| Componentes próprios (KpiCard, AlertRow, EmptyState, ErrorState) | Lib de gráficos |
| Refator das páginas Dashboard, UsinasPage, UsinaDetalhe, AlertasPage | Páginas de configuração/usuários (visual já razoável, baixa prioridade) |
| Dark mode com toggle persistido | Tema customizável por usuário (cores próprias) |
| Validação visual com Playwright | Acessibilidade WCAG completa (escopo F10) |

## Dependências

- Skill `sketch-findings-monitoramento-usinas` em `.claude/skills/` (já existe — gerado em 2026-05-07)
- `frontend/src/index.css` baseline atual (oklch zerado) — vai ser substituído
- VPS: provisionar swap permanente **antes** do primeiro deploy (1.9GB RAM atual já causou OOM no build do Vite)

## Tarefas (commits)

Ordem otimizada pra cada commit deixar o estado consistente (build passa, type-check passa, app sobe). Tracks A–E podem ser paralelizados se houver mais de uma pessoa; linear se for solo.

---

### F9/C1 — `chore(deploy): provisionar swap permanente de 2GB na VPS`

**Por que primeiro:** Bug conhecido no CLAUDE.md. Se o swap não estiver provisionado **antes** de chegar a hora do primeiro deploy do bundle novo, build do Vite vai matar a VPS por OOM e SSH fica inacessível. É mais barato fazer agora do que descobrir no deploy.

**O que fazer (na VPS, via SSH `ssh monitoramento-vps`):**

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

**Aceite:**
- `free -h` mostra `Swap: 2.0Gi` ou similar
- Linha presente em `/etc/fstab` (sobrevive reboot)

**Rollback:** `sudo swapoff /swapfile && sudo rm /swapfile` + remover linha do fstab.

**Estimativa:** 10 min.

---

### F9/C2 — `feat(frontend): instalar Geist Mono`

```bash
cd frontend && npm install @fontsource-variable/geist-mono
```

Adicionar no topo de `frontend/src/index.css` (perto do `@import "@fontsource-variable/geist"`):

```css
@import "@fontsource-variable/geist-mono";
```

**Aceite:**
- `cd frontend && npm run build` passa sem erro
- DevTools mostra `Geist Mono Variable` carregada na rede ao abrir `localhost:5173`

**Estimativa:** 5 min.

---

### F9/C3 — `feat(frontend): tokens da direção industrial em index.css (light + dark)`

**Arquivo:** `frontend/src/index.css`

**Mudanças** (ver `Skill("sketch-findings-monitoramento-usinas")` → `references/identidade-visual.md` pra valores exatos):

1. No `@theme inline` adicionar tokens novos:
   - `--font-mono: 'Geist Mono Variable', ui-monospace, monospace;`
   - `--color-warn`, `--color-warn-soft`, `--color-warn-soft-text`
   - `--color-info`, `--color-info-soft`, `--color-info-soft-text`
   - `--color-success`, `--color-success-soft`, `--color-success-soft-text`
   - `--color-online`, `--color-offline`
   - `--color-text-muted`, `--color-text-subtle`

2. Em `:root` substituir todos os valores oklch por hex calibrados:
   ```
   --background: #f7f7f5;       --foreground: #18181b;
   --card: #ffffff;             --card-foreground: #18181b;
   --primary: #b45309;          --primary-foreground: #ffffff;
   --secondary: #fafaf8;        --secondary-foreground: #18181b;
   --muted: #fafaf8;            --muted-foreground: #6b6b65;
   --accent: #fef3c7;           --accent-foreground: #78350f;
   --destructive: #991b1b;
   --border: #e3e3df;           --input: #e3e3df;            --ring: #b45309;
   --radius: 0.375rem;          /* 6px */
   --sidebar: #ffffff;
   /* + tokens novos warn/info/success/online/offline/text-muted/text-subtle */
   ```

3. Em `.dark` análogo com tokens dark calibrados:
   ```
   --background: #0e1014;       --foreground: #ececef;
   --card: #16191e;             --card-foreground: #ececef;
   --primary: #f59e0b;          --primary-foreground: #18181b;
   --secondary: #1c2027;
   --muted: #1c2027;            --muted-foreground: #a0a4ad;
   --accent: #2a200a;           --accent-foreground: #fbbf24;
   --destructive: #ef4444;
   --border: #262a32;           --input: #262a32;            --ring: #f59e0b;
   /* + warn/info/success dark */
   ```

4. Em `body` adicionar `font-feature-settings: "ss01", "cv11", "tnum";` e mudar font-size base pra 13px (pode ser via Tailwind config ou direto no CSS).

5. Adicionar utility class `.num`:
   ```css
   .num {
     font-family: var(--font-mono);
     font-feature-settings: "tnum";
     font-variant-numeric: tabular-nums;
   }
   ```

**Aceite:**
- `cd frontend && npm run build` passa
- Subir `make up` e abrir cada rota principal: dashboard, /usinas, /usinas/:id, /alertas, /configuracoes — nenhuma quebra visual catastrófica
- Botão primary aparece em cobre (#b45309), não preto/azul
- Cards têm `border-radius: 6px`, não maior

**Validação visual:** Playwright snapshot de cada rota principal pré e pós, comparar lado-a-lado.

**Rollback:** `git revert F9/C3` — `index.css` volta ao estado oklch.

**Estimativa:** 1-2h (incluindo ajustes finos por rota).

---

### F9/C4 — `feat(frontend): customizar shadcn Badge/Table/Button para densidade industrial`

Ajustes nos componentes em `frontend/src/components/ui/`:

**`badge.tsx`:**
- Adicionar `text-transform: uppercase`
- `letter-spacing: 0.04em`
- Reduzir font-size pra 11px
- Variantes novas: `aviso`, `critico`, `info`, `ok` (mapeando pros tokens warn/danger/info/success-soft)

**`table.tsx`:**
- Header: `text-transform: uppercase`, `letter-spacing: 0.06em`, font-size 10px, color muted-foreground, background secondary
- Row hover: background secondary, cursor pointer
- Sem zebra-stripe

**`button.tsx`:**
- Confirmar `border-radius: var(--radius-md)` (4px) em variant default
- Variante `link` ganha cor primary

**Aceite:**
- Badges com `crítico` aparecem em background `#fee2e2` com texto `#7f1d1d`, uppercase
- Tabelas têm header em uppercase pequeno + hover-row em vez de zebra
- `frontend/src/pages/alertas/AlertasPage.tsx` rendera com badges atualizados sem mudar JSX
- Type-check (`npm run typecheck` ou similar) passa

**Estimativa:** 1h.

---

### F9/C5 — `feat(frontend): componentes próprios — StatusDot, SeverityBadge refinado, KpiCard`

Criar em `frontend/src/components/dashboard/` (ou usar o `SeveridadeBadge.tsx` existente como ponto de partida):

**`StatusDot.tsx`:**
```tsx
export function StatusDot({ status }: { status: 'online' | 'offline' }) {
  return <span className={`inline-block size-1.5 rounded-full ${status === 'online' ? 'bg-[var(--color-online)]' : 'bg-[var(--color-offline)]'}`} style={{ boxShadow: `0 0 0 2px color-mix(in srgb, var(--color-${status}) 20%, transparent)` }} />;
}
```

**`SeveridadeBadge.tsx` (refinar o existente):**
- Garantir 2 sinais: cor + ícone glifo (`!`, `⚠`, `i`) + texto

**`KpiCard.tsx`:**
- Props: `label`, `value`, `unit`, `meta`, `trend` (opcional `up/down/null`), `sparkline` (opcional `number[]`)
- Renderiza com Geist Mono no value, sparkline em SVG inline com cor configurável
- Ver `references/padroes-de-tela.md` seção "KPIs do dashboard" pro CSS exato

**Aceite:**
- Importar e usar `<KpiCard>` numa página de teste (pode ser uma rota provisória `/sketches`) — visual igual ao sketch 001 variant A
- Type-check passa
- Snapshot Playwright: `<KpiCard label="Geração hoje" value="12.483" unit="kWh" trend="up" />` com sparkline cobre

**Estimativa:** 2-3h.

---

### F9/C6 — `feat(frontend): EmptyState, ErrorState, Skeletons compartilhados`

Criar em `frontend/src/components/states/`:

**`EmptyState.tsx`:**
- Props: `icon` (string ou componente), `title`, `message` (ReactNode pra suportar `<span>` formatado), `actions` (ReactNode), `tone` (`primary | neutral | success | danger`)
- Layout central, max-width 360px, ícone 56px com background soft

**`ErrorState.tsx`:**
- Props: `title`, `message`, `evidence` (string opcional, renderizado em mono code-block), `actions` (ReactNode)
- Variante hero (página inteira) e inline (banner)

**`Banner.tsx`:**
- Props: `severity` (`warn | danger | info`), `title`, `message`, `action` (ReactNode opcional)

**Skeleton helpers** (estender o `skeleton.tsx` shadcn existente):
- `<SkeletonKpi />` — reproduz estrutura de KpiCard
- `<SkeletonTable rows={6} />` — reproduz tabela densa
- `<SkeletonInverterCard />` — reproduz detalhe de inversor

Adicionar tokens skeleton em `index.css`:
```css
:root { --skeleton-base: #ececea; --skeleton-shine: #f5f5f3; }
.dark { --skeleton-base: #1c2027; --skeleton-shine: #262a32; }
```

E animation `@keyframes shimmer` (ver `references/estados-e-feedback.md`).

**Aceite:**
- Página de teste `/sketches/states` mostra cada estado lado-a-lado igual ao sketch 004
- Type-check passa

**Estimativa:** 2-3h.

---

### F9/C7 — `refactor(frontend): aplicar EmptyState/ErrorState/Skeletons em páginas existentes`

Substituir nos arquivos de página:

| Arquivo | Mudança |
|---|---|
| `pages/usinas/UsinasPage.tsx` | Empty state quando `usinas.length === 0`; SkeletonTable enquanto carregando; ErrorState pra falha de query |
| `pages/alertas/AlertasPage.tsx` | Empty state positivo (verde) quando zero alertas abertos; SkeletonTable; ErrorState |
| `pages/notificacoes/...` | EmptyState quando vazio |
| `pages/garantias/...` | EmptyState com CTA contextual |
| `pages/dashboard/...` | SkeletonKpi pros 4 KPIs principais |

Onde já tinha "Nenhum registro" cru / loader genérico, substituir.

**Aceite:**
- Cada rota lista, ao desconectar internet (devtools throttle offline), mostra ErrorState com retry
- Cada rota lista, sem dados, mostra EmptyState contextual (não "No data")
- Skeletons aparecem durante o primeiro carregamento (visível com throttling 3G)

**Estimativa:** 2-3h.

---

### F9/C8 — `refactor(frontend): hero e tabs internas em UsinaDetalhePage`

**Arquivo:** `frontend/src/pages/usinas/UsinaDetalhePage.tsx`

**Estrutura nova:**
1. Hero card com:
   - Linha 1: nome grande + status dot + meta (cidade · provedor · capacidade · desde) + botões `Sincronizar | Editar | ⋮`
   - Linha 2: 5 KPIs separados por divisor vertical (não 5 cards) — Pot atual / Hoje / Mês / Acumulado / Alertas

2. Tab bar com 6 tabs: Visão geral / Inversores (count) / Alertas (count) / Histórico / Garantia / Configuração

3. Layout split 1.4fr/1fr na tab "Visão geral":
   - Esquerda: gráfico SVG inline de potência ao longo do dia (range selector 1H/HOJE/7D/30D/ANO) + lista de inversores
   - Direita: card "Informações" + card "Alertas abertos" + card "Atividade recente"

Padrões CSS exatos: `references/padroes-de-tela.md` seções "Hero da página detalhe", "Tabs internas", "Painel split".

**Aceite:**
- Visual bate com sketch 002 variant A
- Tabs trocam conteúdo (mesmo que algumas mostrem placeholder)
- Range selector troca o gráfico (pode usar dados mock por enquanto)
- INV com temperatura > limite aparece com fundo soft-danger na lista
- Responsivo: split vira coluna única abaixo de 1100px

**Estimativa:** 4-6h.

---

### F9/C9 — `refactor(frontend): página /alertas com agrupamento + sev-bar + painel lateral`

**Arquivo:** `frontend/src/pages/alertas/AlertasPage.tsx`

**Estrutura nova:**
1. Toolbar: chips de filtro (Estado: Aberto/Resolvido/Todos · Severidade: Crítico/Aviso/Info) + selects (Agrupar por: Usina/Regra/Severidade/Sem · Provedor)

2. Sumário inline: "22 visíveis · tempo médio aberto 1h 47min"

3. Lista agrupada por usina (default), grupo head clicável (colapsa) com `num-pill` por severidade

4. Cada alert-row:
   - Barra-vertical 3px de severidade (sev-bar)
   - Mensagem + meta (rule-tag mono)
   - Badge severidade
   - Timestamp absoluto + duração relativa
   - Ações inline em hover (↗ ir / ✓ resolver)
   - Estado `selected` com inset shadow primary

5. Side panel sticky pra detalhes do alerta selecionado:
   - Detalhes da leitura
   - Histórico 7d em sparkline-bar SVG
   - Ação sugerida + botões

**Aceite:**
- Visual bate com sketch 002 variant B
- Click em alert-row seleciona + popula side panel
- Click no group-head colapsa/expande
- Filtros funcionam (mesmo que sejam client-side por enquanto)
- Responsivo: side panel some abaixo de 1180px (vira drawer mobile? — backlog)

**Estimativa:** 4-6h.

---

### F9/C10 — `feat(frontend): toggle dark mode com persistência`

**Arquivos:**
- Adicionar hook `useDarkMode()` em `frontend/src/lib/` que aplica/remove `.dark` no `<html>` e persiste em `localStorage`
- Botão toggle na topbar (`app-sidebar.tsx` ou novo componente em `components/layout/`)
- Default: respeitar `prefers-color-scheme` do sistema na primeira visita

**Aceite:**
- Click no toggle alterna light↔dark sem flash (FOUC)
- Reload preserva preferência
- Devtools mostra `class="dark"` no `<html>` quando ativo
- Toggle funciona em todas as rotas

**Estimativa:** 1h.

---

### F9/C11 — `chore(frontend): validação visual com Playwright`

**Arquivos:**
- `frontend/tests/visual/` (novo)
- Test snapshots de:
  - Dashboard (light + dark)
  - UsinasPage com 5 usinas mockadas
  - UsinaDetalhePage com 6 inversores
  - AlertasPage com 28 alertas agrupados (light + dark)
  - Empty states (zero usinas, zero alertas)
  - Error state (falha de rede)

Comparar com referências dos sketches em `.planning/sketches/00X-*/index.html` (referência visual, não pixel-perfect).

**Aceite:**
- `npm run test:visual` passa
- Snapshots commitados em `frontend/tests/visual/__screenshots__/`
- Visual bate com sketches em ≥90% dos elementos-chave

**Estimativa:** 2-3h.

---

## Verification (fim da fase)

Antes de marcar F9 como ✅:

1. ☐ Tokens light + dark portados pra `index.css`, todas as rotas absorvem sem regressão funcional
2. ☐ Geist Mono carregando, números técnicos com `tabular-nums`
3. ☐ Badges, tabelas, botões refletem direção industrial
4. ☐ Componentes próprios (`KpiCard`, `StatusDot`, `EmptyState`, `ErrorState`, `SkeletonX`) criados e cobertos por uso real em pelo menos 2 páginas cada
5. ☐ Empty/loading/erro state em pelo menos: Usinas, Alertas, Dashboard, UsinaDetalhe
6. ☐ Hero novo da UsinaDetalhePage com 5 KPIs sem cards, tabs internas funcionais, split 1.4fr/1fr
7. ☐ AlertasPage com agrupamento por usina, filtros chip+select, sev-bar vertical, painel lateral
8. ☐ Dark mode com toggle persistido, sem FOUC
9. ☐ Playwright snapshots passam em light + dark
10. ☐ VPS com swap permanente provisionado **antes** do deploy
11. ☐ Build de produção (`npm run build`) gera bundle ≤ baseline atual (sem regressão de tamanho significativa — ±20% aceitável)
12. ☐ Deploy em produção sem OOM
13. ☐ Documentação no `frontend/src/pages/docs/` revisada — política CLAUDE.md exige mesmo que mudança seja só visual, mas neste caso provavelmente nada precisa mudar (regras/configuração não foram tocadas)

## Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Token novo quebra componente shadcn raro | Médio | Testar todas as rotas após F9/C3, listar quebras antes de F9/C4 |
| Geist Mono atrasa LCP (mais 1 fonte) | Baixo | `font-display: swap` (default do fontsource), preload se necessário |
| Refator do AlertasPage muda comportamento sutilmente | Médio | F9/C9 deve preservar 100% da lógica de query/filtro existente — só muda render |
| OOM no deploy do bundle novo | Médio (já aconteceu) | F9/C1 (swap) é pré-requisito hard antes de qualquer deploy |
| Regressão visual em rota não-coberta pelos sketches (Configurações, Provedores, etc) | Médio | F9/C7 cobre só páginas listadas; outras páginas absorvem só os tokens — fazer audit visual rápido após F9/C3 |
| Playwright snapshots flaky por antialiasing | Baixo | Usar threshold ≥5% nos snapshots; comparar elementos-chave (cor, layout) e não pixel-perfect |

## Rollback

Cada commit é atômico — `git revert F9/CX` deve devolver o estado anterior. Específicos:

- **F9/C3 (tokens)** é o de maior blast radius — se a paleta industrial não convencer em produção, basta reverter esse commit e os outros continuam consistentes (componentes próprios + states funcionam com a paleta original também).
- **F9/C8 (UsinaDetalhePage)** e **F9/C9 (AlertasPage)** são refators pesados — manter o git log limpo facilita revert seletivo se uma das duas der problema.

## Open questions

1. ❓ **Lib de gráfico** pra histórico 7d/30d (curva de geração com tooltips, zoom): manter SVG inline ou trazer Recharts? Sugestão: começar SVG inline (sketch 002 prova que cabe), avaliar Recharts se aparecer requisito de tooltip rico.

2. ❓ **Auto-refresh** da AlertasPage (re-fetch a cada N segundos): faz parte dessa fase ou backlog? Sugestão: backlog (F10) — escopo aqui é só visual.

3. ❓ **Mobile**: a fase atual mantém o produto desktop-first como hoje. Mobile real (drawer no lugar de side panel, sidebar colapsável) é fase própria.

## Próximos passos após F9

- **F10 — Acessibilidade & polimento** — auditoria WCAG, focus states, aria-labels, navegação por teclado, contraste em dark
- **F11 — Mobile** — drawer, sidebar collapse, layout responsivo real
- **F12 — Notificações in-app** — toast com Desfazer (sketch 004 padrão pronto)

---

## Como executar essa fase

Não tem `gsd-sdk query` funcional pra rodar `/gsd-execute-phase` automaticamente. Executar **manual ou com `/gsd-quick`** por commit:

```bash
# Pré-requisito (fora da máquina dev):
ssh monitoramento-vps  # provisionar swap (F9/C1)

# Local:
cd frontend && npm install @fontsource-variable/geist-mono   # F9/C2

# Edição interativa em sequência F9/C3 → C11
# Cada commit:
#   1. Implementar mudança
#   2. make up + verificação visual
#   3. git commit padrão Conventional Commits
```

Skill `sketch-findings-monitoramento-usinas` carrega automaticamente quando você ou um agente Claude começar a editar arquivos do `frontend/` — vai fornecer tokens exatos, padrões CSS prontos pra colar, e a lista de anti-patterns pra não regredir pra "cara de IA" durante a implementação.
