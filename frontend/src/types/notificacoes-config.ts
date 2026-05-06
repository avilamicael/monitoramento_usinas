// Tipos consumidos pela `GestaoNotificacoesPage`.
//
// O backend antigo expunha "configuração por canal" agregada (um registro
// `email`/`whatsapp`/`webhook` com lista de destinatários e flags de
// severidade). O backend novo expõe `RegraNotificacao` em
// `/notificacoes/regras/`: cada regra é uma combinação (canal, severidades,
// tipos_alerta, destino em `config`).
//
// Para preservar o spirit visual da página, mapeamos cada `RegraNotificacao`
// como uma `ConfiguracaoNotificacao`. A página continua agrupando por canal,
// mas opera sobre regras individuais (1 regra por canal/destino).

import type { Severidade } from '@/lib/types'

// Canais usados na página (subset de CanalNotificacao do backend, sem 'web').
export type CanalNotificacao = 'email' | 'whatsapp' | 'webhook'

// Forma adaptada — preserva os campos esperados pelos componentes antigos
// e adiciona `nome`/`tipos_alerta` que vêm da API real.
export interface ConfiguracaoNotificacao {
  id: number
  canal: CanalNotificacao
  nome: string
  ativo: boolean
  destinatarios: string
  notificar_critico: boolean
  notificar_aviso: boolean
  notificar_info: boolean
  tipos_alerta: string[]
  created_at: string
}

// Payload de criação/atualização aceito pela página.
export interface ConfiguracaoNotificacaoPayload {
  ativo: boolean
  destinatarios: string
  notificar_critico: boolean
  notificar_aviso: boolean
  notificar_info: boolean
  // Opcionais — a página pode passar `nome` e `tipos_alerta` se quiser.
  nome?: string
  tipos_alerta?: string[]
}

// Mapeamento direto entre `Severidade` (backend: 'info'|'aviso'|'critico')
// e os flags da página. 1:1 — sem categoria "importante".
export function severidadesParaFlags(severidades: Severidade[]): {
  notificar_critico: boolean
  notificar_aviso: boolean
  notificar_info: boolean
} {
  return {
    notificar_critico: severidades.includes('critico'),
    notificar_aviso: severidades.includes('aviso'),
    notificar_info: severidades.includes('info'),
  }
}

export function flagsParaSeveridades(payload: ConfiguracaoNotificacaoPayload): Severidade[] {
  const out: Severidade[] = []
  if (payload.notificar_critico) out.push('critico')
  if (payload.notificar_aviso) out.push('aviso')
  if (payload.notificar_info) out.push('info')
  return out
}
