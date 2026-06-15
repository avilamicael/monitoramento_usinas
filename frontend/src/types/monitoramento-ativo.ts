/**
 * Tipos do domínio Monitoramento Ativo (cliente premium). Segue o mesmo
 * formato adaptado usado por Garantia: o hook `use-monitoramento-ativo.ts`
 * converte o payload da API atual (`/monitoramento-ativo/`) para estas
 * interfaces.
 *
 * Mapeamento API → tipo adaptado:
 *   - `usina` (id numérico) → `usina_id` (string)
 *   - `inicio_em` (YYYY-MM-DD) → `data_inicio`
 *   - `fim_em` → `data_fim`
 *   - `is_active` (derivado de fim_em) → `ativa`
 *   - `created_at` / `updated_at` → `criado_em` / `atualizado_em`
 */

export interface MonitoramentoAtivoUsina {
  id: string
  usina_id: string
  usina_nome: string
  data_inicio: string
  meses: number
  valor_mensal: string | null
  contratante: string
  observacoes: string
  data_fim: string
  dias_restantes: number
  ativa: boolean
  criado_em: string
  atualizado_em: string
}

export interface MonitoramentoAtivoInput {
  data_inicio: string
  meses: number
  valor_mensal?: string | null
  contratante?: string
  observacoes?: string
}

export interface PaginatedMonitoramentosAtivos {
  count: number
  next: string | null
  previous: string | null
  results: MonitoramentoAtivoUsina[]
}
