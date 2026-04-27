/**
 * Tipos do domínio Garantia (formato compatível com componentes
 * portados do firmasolar antigo). O hook `use-garantias.ts` faz a
 * adaptação a partir do payload da API atual (`/garantia/`).
 *
 * Mapeamento API → tipo antigo:
 *   - `usina` (id numérico) → `usina_id` (string)
 *   - `inicio_em` (YYYY-MM-DD) → `data_inicio`
 *   - `fim_em` → `data_fim`
 *   - `is_active` (derivado de fim_em) → `ativa`
 *   - `created_at` / `updated_at` → `criado_em` / `atualizado_em`
 */

export interface GarantiaUsina {
  id: string
  usina_id: string
  usina_nome: string
  data_inicio: string
  meses: number
  observacoes: string
  data_fim: string
  dias_restantes: number
  ativa: boolean
  criado_em: string
  atualizado_em: string
}

export interface GarantiaInput {
  data_inicio: string
  meses: number
  observacoes?: string
  fornecedor?: string
}

export interface PaginatedGarantias {
  count: number
  next: string | null
  previous: string | null
  results: GarantiaUsina[]
}
