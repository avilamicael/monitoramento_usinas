---
sketch: 004
name: estados
question: "Como tratar empty / loading / erro / onboarding sem cair na 'cara de IA' do shadcn padrão?"
winner: null
tags: [empty-state, loading, error, skeleton, onboarding, toast]
---

# Sketch 004: Estados (empty / loading / erro / onboarding / especiais)

## Design Question

São os estados que mais entregam "shadcn default" — empty state genérico com "No data" + ícone de caixinha, loading com spinner anônimo, erro com "Something went wrong", toast "Success!". Como dar personalidade técnica e útil a cada um, alinhado à direção industrial?

Showroom único cobrindo 5 categorias, com botão de toggle light/dark (dark = calibrado, winner do sketch 003).

## How to View

```
explorer.exe .planning\sketches\004-estados\index.html
```

Use o botão `☀ Light` / `☾ Dark` no topo pra alternar modos. Use os links da nav superior pra pular entre seções.

## Conteúdo

### 1. Empty states
- **Zero usinas (empresa nova)** — explica o porquê + 2 caminhos (conectar conta automaticamente / cadastrar manual)
- **Zero alertas (positivo)** — verde + dado factual ("267 usinas dentro dos limites · última verificação há 2 min")
- **Filtro sem resultado** — mostra o termo buscado + sugestões
- **Aba sem nada** (Garantia) — CTA explica o benefício, não só "Adicionar"

### 2. Loading states
- **Skeleton de KPIs** — 4 caixas com label + número grande + meta line, espelhando o final
- **Skeleton de tabela** — 6 linhas com larguras realistas, header também skeleton
- **Skeleton de detalhe inversor** — cards de métrica, badge skeleton no canto
- **"Aguardando primeira coleta"** — pulso animado ao redor do core, contexto ("buscando usinas no Solis · 1-2min")

### 3. Erros
- **Credenciais rejeitadas** — evidência (3 tentativas, código 401, timestamp), hipótese ("senha foi alterada"), 2 ações
- **Falha de rede** — timeout 15s, retry primário
- **Banner inline (warn + danger)** — degradação parcial sem esconder a tela
- **Provedor offline** — distingue erro infra (não é seu problema) de erro de configuração

### 4. Onboarding
- **Welcome card** — checklist 3 passos com tempo estimado por passo + sinaliza opcionais
- **Usina recém-cadastrada** — "Aguardando primeira leitura · próxima coleta em 3min"

### 5. Toasts
- **Sucesso com contexto** — "Coleta concluída · 8 usinas · 23 inversores · 156 leituras em 4,2s"
- **Ação reversível** — Desfazer inline (substitui modal de confirmação)
- **Falha com retry** — código HTTP visível, dados preservados no formulário

### 6. Estados especiais do domínio
- **Garantia expirada** — banner explica quais regras estão afetadas
- **Alerta de regra desativada** — flag visível, instrução de "resolver manualmente" (regra R2 do CLAUDE.md)
- **Empresa inteira sem comunicação** — banner + breakdown por provedor (operador entende se é seu lado ou rede geral)

## Princípios consolidados

1. **Toda mensagem em PT-BR humano**, sem termos técnicos invisíveis ao operador (não usar `threshold`, `rate limit`, `status code` sem traduzir contexto).
2. **Empty/erro sempre tem CTA óbvia** + um caminho secundário ("Limpar busca", "Voltar", "Pausar").
3. **Loading espelha a estrutura final** — skeletons reproduzem largura/altura/grid do conteúdo. Nada de spinner genérico.
4. **Erro mostra evidência** — código HTTP, timestamp, contagem de tentativas — mas nunca stack trace.
5. **Toast inclui números reais** — "8 usinas · 23 inversores · 156 leituras em 4,2s" em vez de "Sucesso!".
6. **Estados positivos** (zero alertas) usam verde + dado factual em vez de tristeza ("nenhum alerta").
7. **Estados especiais** explicam *quais regras* / *quais provedores* estão afetados — operador não fica adivinhando.

## What to Look For

1. **Pulse animation** no "Aguardando primeira coleta" — cabe na direção industrial ou é "demais"?
2. **Severidade dos banners** (warn vs danger) — diferença lê?
3. **Toast com Desfazer** — substitui modal de confirmação em ações reversíveis?
4. **Checklist de onboarding** — clima certo (não-condescendente, com tempos) ou virou tutorial inglório?
5. **Banner em fundo soft** vs **hero error state** — quando usar cada um? Banner = degradação parcial; hero = página inteira inacessível.

## Decision Log

_(preencher após decidir)_

- Estados que vão pro produto inicial: ?
- Estados que ficam pra MVP+1: ?
- Pulse animation: usar ou descartar?
