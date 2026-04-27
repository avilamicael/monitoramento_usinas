/**
 * Hook adapter de garantias — converte os payloads da nossa API REST
 * (`/garantia/`) para a forma esperada pelos componentes portados
 * do firmasolar antigo (`types/garantias.ts`).
 *
 * - `useGarantias({...})` retorna a lista (com paginação opcional) +
 *   helpers CRUD (`criar`, `atualizar`, `remover`).
 * - `paraGarantia()` faz o mapeamento de campos (exportado para uso
 *   direto na `GarantiasPage`, que carrega TODAS as garantias e
 *   indexa por `usina_id` em um Map).
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Garantia as GarantiaApi, Paginated } from '@/lib/types'
import type {
  GarantiaInput,
  GarantiaUsina,
  PaginatedGarantias,
} from '@/types/garantias'

interface UseGarantiasParams {
  usina?: string | number
  provedor?: string
  status?: 'ativa' | 'vencida'
  search?: string
  page?: number
  page_size?: number
  // Compat com o uso antigo: 'ativas'/'vencendo'/'vencidas' são
  // mapeados aqui para o filtro `status` do backend novo.
  filtro?: 'ativas' | 'vencendo' | 'vencidas'
}

interface UseGarantiasResult {
  data: PaginatedGarantias | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  criar: (usinaId: string | number, payload: GarantiaInput) => Promise<GarantiaUsina>
  atualizar: (id: string, payload: GarantiaInput) => Promise<GarantiaUsina>
  remover: (id: string) => Promise<void>
}

/**
 * Converte um item de `/garantia/` para o formato esperado pelos
 * componentes antigos.
 */
export function paraGarantia(g: GarantiaApi): GarantiaUsina {
  return {
    id: String(g.id),
    usina_id: String(g.usina),
    usina_nome: g.usina_nome,
    data_inicio: g.inicio_em,
    meses: g.meses,
    observacoes: g.observacoes ?? '',
    data_fim: g.fim_em,
    dias_restantes: g.dias_restantes,
    ativa: g.is_active,
    criado_em: g.created_at,
    atualizado_em: g.updated_at,
  }
}

function mapearFiltro(filtro?: 'ativas' | 'vencendo' | 'vencidas'): 'ativa' | 'vencida' | undefined {
  if (filtro === 'ativas' || filtro === 'vencendo') return 'ativa'
  if (filtro === 'vencidas') return 'vencida'
  return undefined
}

export function useGarantias(params: UseGarantiasParams = {}): UseGarantiasResult {
  const [data, setData] = useState<PaginatedGarantias | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const apiParams: Record<string, string | number | boolean> = {}
      if (params.usina != null) apiParams.usina = String(params.usina)
      if (params.provedor) apiParams.provedor = params.provedor
      if (params.search) apiParams.search = params.search
      if (params.page) apiParams.page = params.page
      if (params.page_size) apiParams.page_size = params.page_size
      const status = params.status ?? mapearFiltro(params.filtro)
      if (status) apiParams.status = status

      const response = await api.get<Paginated<GarantiaApi>>('/garantia/', { params: apiParams })
      setData({
        count: response.data.count,
        next: response.data.next,
        previous: response.data.previous,
        results: response.data.results.map(paraGarantia),
      })
    } catch {
      setError('Erro ao carregar garantias')
    } finally {
      setLoading(false)
    }
    // JSON.stringify evita loop infinito quando params é objeto literal recriado a cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)])

  useEffect(() => {
    void fetch()
  }, [fetch])

  const criar = useCallback(async (usinaId: string | number, payload: GarantiaInput) => {
    const body: Record<string, unknown> = {
      usina: typeof usinaId === 'string' ? Number(usinaId) : usinaId,
      inicio_em: payload.data_inicio,
      meses: payload.meses,
    }
    if (payload.observacoes !== undefined) body.observacoes = payload.observacoes
    if (payload.fornecedor !== undefined) body.fornecedor = payload.fornecedor
    const resp = await api.post<GarantiaApi>('/garantia/', body)
    return paraGarantia(resp.data)
  }, [])

  const atualizar = useCallback(async (id: string, payload: GarantiaInput) => {
    const body: Record<string, unknown> = {
      inicio_em: payload.data_inicio,
      meses: payload.meses,
    }
    if (payload.observacoes !== undefined) body.observacoes = payload.observacoes
    if (payload.fornecedor !== undefined) body.fornecedor = payload.fornecedor
    const resp = await api.patch<GarantiaApi>(`/garantia/${id}/`, body)
    return paraGarantia(resp.data)
  }, [])

  const remover = useCallback(async (id: string) => {
    await api.delete(`/garantia/${id}/`)
  }, [])

  return { data, loading, error, refetch: fetch, criar, atualizar, remover }
}
