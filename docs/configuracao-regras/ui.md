---
title: Configuração de Regras — Interface Web
status: rascunho
tags: [planejamento, alertas, ui, frontend]
---

# Interface Web

Volta para [[index]]. API em [[api]].

## Rota

`/configuracao/regras` — protegida por `ProtectedRoute`. Item de menu visível apenas para `papel === "administrador"` (mesma flag `adminOnly` usada em outras rotas administrativas).

Posição na navegação: dentro do submenu **Configurações**, ao lado de "Notificações" e "Empresa".

## Layout proposto

Página única, tabela com 12 linhas (uma por regra). Cada linha:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Sobretensão AC                                                              │
│ Tensão AC acima do limite (240V)                                            │
│                                                                             │
│ [✓] Ativa     Severidade: [Info ▼]      [Resetar para padrão]               │
└─────────────────────────────────────────────────────────────────────────────┘
```

Visualmente:
- **Cabeçalho da linha**: nome legível da regra (ex: "Sobretensão AC") + descrição curta (1ª linha do docstring).
- **Toggle "Ativa"**: checkbox. Quando desligado, o select de severidade fica desabilitado/cinza.
- **Select "Severidade"**: 3 opções (Crítico / Aviso / Informativo). Para regras com `severidade_dinamica: true`, o select fica disabled e mostra texto "Gerenciada pela regra (escala com tempo)".
- **Badge "Padrão"**: discreto, à direita. Aparece quando `is_default: true`. Some quando o usuário muda algo.
- **Botão "Resetar para padrão"**: aparece só quando a regra tem override (`is_default: false`). Ao clicar, faz `DELETE` na API e a linha volta a mostrar o badge "Padrão".

## Ações de página

- **Botão "Resetar tudo"** no topo direito — abre modal de confirmação ("Isto apagará todas as suas customizações de severidade e estado. Continuar?") e chama `POST /reset-todos/`.
- **Indicador de salvamento**: cada mudança de severidade ou toggle dispara um PUT imediato (debounced ~300ms). Toast verde "Salvo" no canto.

## Comportamento de severidade dinâmica

Linhas com `severidade_dinamica: true` (`sem_comunicacao`, `garantia_vencendo`):

- Toggle **Ativa**: continua editável.
- Select **Severidade**: desabilitado, com tooltip "Esta regra escala automaticamente entre Aviso e Crítico conforme o tempo. Não pode ser fixada."
- Badge "Dinâmica" pequeno em vez do select.

## Hooks e queries

```typescript
// src/hooks/use-configuracao-regras.ts

export interface ConfiguracaoRegra {
  regra_nome: string
  ativa: boolean
  severidade: NivelAlerta
  is_default: boolean
  severidade_default: NivelAlerta
  ativa_default: boolean
  descricao: string
  severidade_dinamica: boolean
  configurada_em: string | null
}

export function useConfiguracaoRegras() { ... }
export function useAtualizarConfiguracaoRegra() { ... }   // PUT
export function useResetarConfiguracaoRegra() { ... }     // DELETE 1 regra
export function useResetarTodasConfiguracoes() { ... }    // POST /reset-todos
```

Padrão de cache do `@tanstack/react-query`: `queryKey: ["configuracao-regras"]`. Mutations invalidam essa key.

## Mockup textual

```
╔═══════════════════════════════════════════════════════════════════════╗
║  Configuração de Regras                          [Resetar tudo]       ║
║  Defina como cada regra do motor de alertas se comporta nesta empresa.║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  Sem geração em horário solar                                         ║
║  Usina parou de gerar abruptamente em pleno dia.                      ║
║  [✓] Ativa     Severidade: [Crítico ▼]                       [Padrão] ║
║                                                                       ║
║  Sem comunicação                                                      ║
║  Usina sem comunicação há mais de N minutos.                          ║
║  [✓] Ativa     Severidade: [Dinâmica]  ⓘ                     [Padrão] ║
║                                                                       ║
║  Inversor offline                                                     ║
║  Inversor desligado em horário solar (3+ coletas consecutivas).       ║
║  [✓] Ativa     Severidade: [Aviso ▼]                         [Padrão] ║
║                                                                       ║
║  Sobretensão AC                                                       ║
║  Tensão AC acima do limite (240V).                                    ║
║  [✓] Ativa     Severidade: [Crítico ▼]    [Resetar para padrão]       ║
║                                                                       ║
║  Temperatura alta                                                     ║
║  Inversor acima de 75°C.                                              ║
║  [✗] Ativa     Severidade: [Info ▼]       [Resetar para padrão]       ║
║                                                                       ║
║  ... (mais 7 linhas)                                                  ║
╚═══════════════════════════════════════════════════════════════════════╝
```

A linha "Temperatura alta" no exemplo ilustra uma regra desativada — toggle desligado, select cinza.

A linha "Sobretensão AC" ilustra uma regra customizada (severidade subida de Info para Crítico) — botão "Resetar para padrão" ativo.

## shadcn / componentes

- `Card` (já existe) para wrap geral.
- `Switch` (gerar com `npx shadcn@latest add switch`) para o toggle ativa.
- `Select` (já existe) para severidade.
- `Tooltip` para o ⓘ da regra dinâmica.
- `Dialog` para confirmação do reset total.
- `Badge` para "Padrão" e "Dinâmica".
- `Toast` (sonner — já em uso).

## Próximo: [[plano-execucao]]
