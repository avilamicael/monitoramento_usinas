# Estados & feedback (empty / loading / erro / onboarding / toast)

Estados são onde o "shadcn padrão" mais entrega cara de IA. Princípios e padrões validados no sketch 004.

## Princípios não-negociáveis

1. **PT-BR humano em toda UI** — nada de "threshold", "rate limit", "status code" sem traduzir contexto. Se o operador final lê, não pode ser jargão técnico cru.
2. **Empty/erro sempre tem CTA óbvia + caminho secundário** — primária ("Conectar conta") + alternativa ("Cadastrar manualmente" / "Limpar busca" / "Voltar").
3. **Loading espelha estrutura final** — skeletons reproduzem largura/altura/grid do conteúdo. Spinner genérico nunca substitui skeleton de tabela ou card.
4. **Erro mostra evidência sem stack trace** — código HTTP, timestamp, contagem de tentativas. Stack trace fica em `LogColeta` server-side, jamais em UI.
5. **Toast inclui números reais** — "8 usinas · 23 inversores · 156 leituras em 4,2s" em vez de "Sucesso!".
6. **Estados positivos** (zero alertas, tudo ok) usam verde + dado factual em vez de tristeza ("nenhum alerta encontrado").
7. **Estados especiais do domínio** explicam *quais regras* / *quais provedores* estão afetados — operador não fica adivinhando o que mudou.
8. **"Não é problema do seu lado"** pra erros de provedor/infra — distinção clara entre erro de configuração (operador resolve) e erro externo (esperar passar).

## Empty state

### Estrutura padrão

```html
<div class="empty-state">
  <div class="empty-icon">⚡</div>
  <div class="empty-title">Nenhuma usina cadastrada ainda</div>
  <div class="empty-msg">
    Pra começar, conecte uma conta de provedor (Solis, Hoymiles, FusionSolar, etc)
    e nós sincronizamos automaticamente as usinas e inversores que ela enxergar.
  </div>
  <div class="empty-actions">
    <button class="btn btn-primary">Conectar conta de provedor</button>
    <button class="btn">Cadastrar manualmente</button>
  </div>
</div>
```

```css
.empty-state { text-align: center; max-width: 360px; margin: 0 auto; padding: 24px 0; }
.empty-icon {
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--color-primary-soft); color: var(--color-primary-soft-text);
  display: grid; place-items: center; margin: 0 auto 16px;
  font-family: var(--font-mono); font-weight: 600; font-size: 20px;
}
.empty-icon.neutral { background: var(--color-info-soft);    color: var(--color-info-soft-text); }
.empty-icon.success { background: var(--color-success-soft); color: var(--color-success-soft-text); }
.empty-icon.danger  { background: var(--color-danger-soft);  color: var(--color-danger-soft-text); }
.empty-title { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; margin-bottom: 6px; }
.empty-msg   { font-size: 13px; color: var(--color-text-muted); line-height: 1.55; margin-bottom: 16px; }
```

### Variações por contexto

| Contexto | Cor do ícone | Tom da mensagem | CTAs |
|---|---|---|---|
| **Empresa nova / zero recursos** | `primary` (cobre/âmbar) | Convite, explica o porquê | Caminho automático + manual |
| **Tudo ok (zero alertas)** | `success` (verde) | Status factual com números | Histórico ↗ (link secundário) |
| **Filtro vazio (busca)** | `neutral` (cinza) | "Nenhum X com '{termo}'" + sugestão de outros campos | "Limpar busca" |
| **Aba vazia (sub-página)** | `neutral` | CTA explica *benefício*, não só "Adicionar" | "+ Cadastrar X" |

### Copy patterns

✅ **Sim:**
- "Nenhuma usina cadastrada ainda" (concreto)
- "Adicione a garantia da usina e nós avisamos 30 dias antes do vencimento" (CTA com benefício)
- "Verifique se digitou o serial correto ou tente buscar por nome da usina, modelo do inversor ou ID do provedor"

❌ **Não:**
- "No data" / "Nothing here yet" (genérico shadcn default)
- "Adicionar item" sem contexto (CTA sem benefício)
- "Nenhum resultado encontrado" sem mostrar termo nem sugerir alternativa

## Loading state — skeletons

### Princípio: espelhar estrutura final

Skeletons reproduzem **larguras realistas** dos elementos finais:

```css
@keyframes shimmer {
  0%   { background-position: -300px 0; }
  100% { background-position:  300px 0; }
}
.sk {
  background: var(--skeleton-base);
  background-image: linear-gradient(90deg, var(--skeleton-base) 0%, var(--skeleton-shine) 50%, var(--skeleton-base) 100%);
  background-size: 600px 100%;
  animation: shimmer 1.4s linear infinite;
  border-radius: 3px;
  display: inline-block;
}
.sk-line   { display: block; height: 11px; margin-bottom: 8px; }
.sk-num    { height: 28px; width: 120px; }
.sk-bar    { height: 4px; }
.sk-circle { width: 24px; height: 24px; border-radius: 50%; }
.sk-pill   { height: 18px; width: 56px; border-radius: 999px; }
```

Tokens de skeleton (light + dark):
```css
:root      { --skeleton-base: #ececea; --skeleton-shine: #f5f5f3; }
.dark      { --skeleton-base: #1c2027; --skeleton-shine: #262a32; }
```

### Skeletons-padrão para o produto

| Tela | Estrutura do skeleton |
|---|---|
| **KPIs** (4 cards) | Cada card: `sk-line label (80px)` + `sk-num (28px)` + `sk-line meta (variável)` |
| **Tabela usinas** | Header com 6 `sk-line` curtas; linhas com `sk-line wide + sk-line narrow` na 1ª col, `sk-pill` no status, `sk-line` num + `sk-pill` badge |
| **Detalhe inversor** | `sk-line` título + `sk-line` meta; grid 3×N de cards `metric` com `sk-line label + sk-line value` |

### Loading "vivo" — estados com tempo conhecido

Quando a espera tem causa específica e duração estimada (ex: aguardando primeira coleta de uma conta nova), use **pulse animation** em vez de skeleton:

```css
@keyframes pulse {
  0%, 100% { transform: scale(1);   opacity: 0.4; }
  50%      { transform: scale(1.4); opacity: 0;   }
}
.pulse-wrap { position: relative; width: 56px; height: 56px; margin: 0 auto 16px; }
.pulse-dot { position: absolute; inset: 0; border-radius: 50%; background: var(--color-primary); opacity: 0.15; }
.pulse-dot.ring { animation: pulse 1.8s ease-out infinite; opacity: 0.4; }
.pulse-dot.ring.delayed { animation-delay: 0.6s; }
.pulse-core {
  position: absolute; inset: 16px;
  background: var(--color-primary); border-radius: 50%;
  display: grid; place-items: center;
  color: #fff; font-weight: 700; font-size: 13px; z-index: 2;
}
.dark .pulse-core { color: #18181b; }
```

Usar com mensagem como "A próxima coleta acontece em **3 min**. A partir daí você verá geração em tempo quase real, com pontos a cada **10 min**." — sempre com **estimativa concreta** pra reduzir ansiedade.

## Erro

### Hero error state (página inteira inacessível)

```html
<div class="error-state">
  <div class="error-icon">!</div>
  <div class="error-title">Credenciais rejeitadas pelo provedor</div>
  <div class="error-msg">
    O Solis devolveu <span class="mono">401 Unauthorized</span> nas últimas
    <span class="num">3 tentativas</span>. Isso costuma significar que a senha
    foi alterada na plataforma deles.
  </div>
  <div class="error-detail">
    última tentativa · 14:30:12 BRT · POST /v1/api/login → 401
  </div>
  <div class="error-actions">
    <button class="btn btn-primary">Atualizar credenciais</button>
    <button class="btn">Pausar sincronização</button>
  </div>
</div>
```

```css
.error-state { text-align: center; max-width: 420px; margin: 0 auto; padding: 24px 0; }
.error-icon {
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--color-danger-soft); color: var(--color-danger-soft-text);
  display: grid; place-items: center; margin: 0 auto 16px;
  font-weight: 700; font-size: 22px;
}
.error-title { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; margin-bottom: 6px; }
.error-msg   { font-size: 13px; color: var(--color-text-muted); line-height: 1.55; margin-bottom: 12px; }
.error-detail {
  background: var(--color-surface-2); border: 1px solid var(--color-border);
  border-radius: 4px; padding: 8px 12px;
  font-family: var(--font-mono); font-size: 11px;
  color: var(--color-text-muted); margin-bottom: 16px;
  text-align: left; word-break: break-all;
}
```

**Estrutura sempre:** título (o que aconteceu) → mensagem (hipótese plausível em PT-BR) → evidência mono (técnica) → 2 ações.

### Banner inline (degradação parcial)

Quando parte do sistema falha mas a tela ainda é útil:

```html
<div class="banner warn">
  <div class="banner-icon">!</div>
  <div class="banner-body">
    <div class="banner-title">2 contas com falha de sincronização</div>
    <div class="banner-msg">FusionSolar (recife-01) e Hoymiles (juazeiro-02) estão fora do ar. Os dados em tela podem estar desatualizados em até 47 min.</div>
  </div>
  <div class="banner-action"><button class="btn btn-sm">Ver detalhes</button></div>
</div>
```

```css
.banner {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 12px 16px; border-radius: 4px;
  border: 1px solid; font-size: 13px;
}
.banner-icon { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; font-size: 11px; font-weight: 700; }
.banner-body  { flex: 1; }
.banner-title { font-weight: 600; margin-bottom: 2px; }
.banner-msg   { color: var(--color-text-muted); line-height: 1.5; }
.banner-action{ margin-left: auto; flex-shrink: 0; }

.banner.warn   { background: var(--color-warn-soft);   border-color: var(--color-warn-soft-text);   color: var(--color-warn-soft-text); }
.banner.warn   .banner-icon { background: var(--color-warn);   color: #fff; }
.banner.danger { background: var(--color-danger-soft); border-color: var(--color-danger-soft-text); color: var(--color-danger-soft-text); }
.banner.danger .banner-icon { background: var(--color-danger); color: #fff; }
.banner.info   { background: var(--color-info-soft);   border-color: var(--color-info-soft-text);   color: var(--color-info-soft-text); }
.banner.info   .banner-icon { background: var(--color-info);   color: #fff; }
```

**Quando usar banner vs hero error:**
- Banner: "ainda dá pra trabalhar, só com X afetado" — fica acima do conteúdo, não esconde
- Hero error: "essa tela toda parou" — substitui o conteúdo

**Severidade do banner = severidade do efeito no operador**:
- `warn`: dado pode estar defasado mas a maioria funciona
- `danger`: feature core bloqueada (ex: chave de criptografia ausente)
- `info`: aviso sem urgência (ex: "manutenção programada amanhã 22h")

### Erro de provedor (terceiro)

Tom específico **"não é problema do seu lado"** desativa ansiedade do operador:

```
"O provedor Solis está retornando 500 Internal Server Error em todas as
42 contas nos últimos 12 min. Não é problema do seu lado — estamos
aguardando o serviço deles voltar."

[ Status page do Solis ↗ ]   [ Ignorar até resolver ]
```

## Onboarding

### Welcome card com checklist

```html
<div class="onboarding">
  <div class="onboarding-eyebrow">Bem-vindo · 1 de 4</div>
  <div class="onboarding-title">Vamos colocar suas usinas no monitoramento</div>
  <div class="onboarding-msg">
    Em <strong>3 passos curtos</strong> você terá leituras a cada 10 min e
    alertas chegando na sua caixa. Você pode pausar e voltar a qualquer momento.
  </div>
  <div class="checklist">
    <div class="check-item current">
      <div class="check-circle">1</div>
      <div class="check-text">
        Conectar conta de provedor
        <div class="sub">Solis, Hoymiles, FusionSolar e mais 3</div>
      </div>
      <div class="check-status">~2 min</div>
    </div>
    <!-- ... -->
  </div>
</div>
```

```css
.onboarding { text-align: center; max-width: 560px; margin: 0 auto; padding: 32px 24px; }
.onboarding-eyebrow {
  display: inline-block;
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--color-primary); font-weight: 700;
  background: var(--color-primary-soft); padding: 3px 10px;
  border-radius: 999px; margin-bottom: 14px;
}
.onboarding-title { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 8px; line-height: 1.15; }
.onboarding-msg   { font-size: 14px; color: var(--color-text-muted); line-height: 1.6; margin-bottom: 24px; }

.checklist {
  text-align: left; max-width: 380px; margin: 0 auto 24px;
  border: 1px solid var(--color-border); border-radius: 6px;
  background: var(--color-surface-2); overflow: hidden;
}
.check-item {
  display: grid; grid-template-columns: auto 1fr auto; gap: 12px;
  padding: 12px 14px; align-items: center;
}
.check-item + .check-item { border-top: 1px solid var(--color-border); }
.check-circle {
  width: 18px; height: 18px; border-radius: 50%;
  border: 1.5px solid var(--color-border-strong);
  display: grid; place-items: center;
  font-size: 10px; color: var(--color-text-subtle);
}
.check-circle.done { background: var(--color-success); border-color: var(--color-success); color: #fff; }
.dark .check-circle.done { color: #18181b; }
.check-text   { font-size: 13px; }
.check-text .sub { font-size: 11px; color: var(--color-text-muted); }
.check-status { font-size: 11px; color: var(--color-text-muted); font-family: var(--font-mono); }
.check-item.current { background: color-mix(in srgb, var(--color-primary-soft) 40%, transparent); }
.check-item.current .check-circle { border-color: var(--color-primary); color: var(--color-primary); }
.check-item.pending .check-text { color: var(--color-text-muted); }
```

**Princípio anti-ansiedade:**
- Cada passo tem **tempo estimado** ("~2 min")
- Sinaliza quais são **opcionais** ("opcional" no lugar do tempo)
- "Você pode pausar e voltar" deixa claro que não é destrutivo
- "Pular onboarding" sempre disponível

## Toast / notificação

```html
<div class="toast">
  <div class="toast-icon success">✓</div>
  <div class="toast-body">
    <div class="toast-title">Coleta concluída</div>
    <div class="toast-msg">8 usinas · 23 inversores · 156 leituras gravadas em 4,2s</div>
    <div class="toast-meta">há 12s · log #4827</div>
  </div>
  <button class="toast-close">✕</button>
</div>
```

```css
.toast {
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: 6px; padding: 12px 14px; box-shadow: var(--shadow-md);
  display: flex; align-items: flex-start; gap: 10px;
  width: 360px;
}
.toast-icon { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; font-size: 12px; font-weight: 700; color: #fff; }
.dark .toast-icon { color: #18181b; }
.toast-icon.success { background: var(--color-success); }
.toast-icon.danger  { background: var(--color-danger); }
.toast-icon.warn    { background: var(--color-warn); }
.toast-icon.info    { background: var(--color-info); }
.toast-body  { flex: 1; min-width: 0; }
.toast-title { font-size: 13px; font-weight: 600; line-height: 1.35; }
.toast-msg   { font-size: 12px; color: var(--color-text-muted); margin-top: 2px; line-height: 1.45; }
.toast-meta  { font-family: var(--font-mono); font-size: 10px; color: var(--color-text-subtle); margin-top: 4px; }
.toast-close { color: var(--color-text-subtle); font-size: 14px; padding: 0 4px; }
.toast-close:hover { color: var(--color-text); }
```

### Padrão "Desfazer inline" pra ações reversíveis

Em vez de modal de confirmação, executa imediatamente e mostra toast com **Desfazer (5s)**:

```html
<div class="toast">
  <div class="toast-icon info">i</div>
  <div class="toast-body">
    <div class="toast-title">Alerta resolvido manualmente</div>
    <div class="toast-msg">"Temperatura alta · INV-03" · vai reabrir se a condição persistir.</div>
    <div style="margin-top:6px;">
      <button class="btn btn-sm btn-link">Desfazer</button>
    </div>
  </div>
  <button class="toast-close">✕</button>
</div>
```

**Quando usar Desfazer inline vs modal de confirmação:**
- Desfazer inline: ação reversível em ≤ 5s (resolver alerta, arquivar usina, desativar regra)
- Modal: ação destrutiva permanente (deletar conta de provedor, apagar empresa)

## Estados especiais do domínio

Casos que não cabem em "empty/loading/error" mas têm tratamento próprio.

### Garantia expirada → quais regras desativam

```
[banner warn]
Garantia expirada em 12 abr 2024
Esta usina não dispara alertas de manutenção desde então.
Atualize a garantia pra reativar o monitoramento da regra `garantia_vencendo`.
[Atualizar garantia]

(Demais regras (sem comunicação, temperatura, subdesempenho) continuam ativas.)
```

### Alerta de regra desativada (R2 do CLAUDE.md)

Quando uma regra é desativada via `/configuracao/regras`, alertas existentes dela **não fecham automaticamente**. UI carrega o contexto:

```html
<div class="alert-row info" style="background:var(--color-surface-2); border:1px dashed var(--color-border-strong);">
  <!-- ... conteúdo do alerta ... -->
  <span class="badge info">regra desativada</span>
</div>
<p class="annotation">
  Quando uma regra é desativada, alertas existentes dela <strong>não fecham
  automaticamente</strong> — ficam visíveis com o badge "regra desativada"
  pra operador resolver.
</p>
```

### Empresa inteira sem comunicação

Banner danger no topo + breakdown por provedor (operador entende se é seu lado ou rede geral):

```
[banner danger] Coleta global parada há 1h 23min
[ver log da coleta]

┌────────────┬────────────┬───────────────────┐
│ Solis      │ Hoymiles   │ FusionSolar       │
│ timeout    │ timeout    │ connection refused│
│ 23 erros   │ 12 erros   │                   │
└────────────┴────────────┴───────────────────┘
```

## Anti-patterns rejeitados

### ❌ "No data" + ícone de caixinha vazia

Genérico shadcn-default. **Sempre explica o porquê** + caminho.

### ❌ Spinner anônimo no meio da tela

Skeleton específico ao conteúdo final (KPI, tabela, card) é sempre superior. Spinner só pode aparecer em ações inline (botão "Salvando...").

### ❌ Stack trace em UI

`TypeError: Cannot read property 'x' of undefined` é falha de quem programou. Em UI: "Não foi possível carregar — tente novamente". Stack trace fica em `LogColeta` server-side.

### ❌ "Sucesso!" sem dado

`"Saved!"` não confirma nada. `"Coleta concluída · 8 usinas · 23 inversores · 156 leituras em 4,2s"` confirma com evidência.

### ❌ Modal de confirmação pra tudo

`"Tem certeza que quer X?"` antes de cada ação cria fricção. Pra ações reversíveis, **execute + Desfazer inline** é melhor UX. Modal só pra destruição permanente.

### ❌ Empty positivo com ícone vermelho/cinza

"Nenhum alerta aberto" é positivo — usar verde + status factual ("267 usinas dentro dos limites · última verificação há 2 min"). Cinza ou vermelho falsamente sinalizam problema.

## Origin

- Sketch: 004-estados (showroom único, approved)
- Source: `sources/004-estados/index.html`
