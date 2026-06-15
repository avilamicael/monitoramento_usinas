/**
 * Hook adapter de monitoramento ativo (cliente premium) — converte os
 * payloads da nossa API REST (`/monitoramento-ativo/`) para a forma usada
 * pelos componentes (`types/monitoramento-ativo.ts`). Espelha
 * `use-garantias.ts`, acrescentando os campos `valor_mensal` e
 * `contratante`.
 *
 * - `useMonitoramentoAtivo({...})` retorna a lista (com paginação opcional) +
 *   helpers CRUD (`criar`, `atualizar`, `remover`).
 * - `paraMonitoramentoAtivo()` faz o mapeamento de campos (exportado para
 *   uso direto na página).
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { MonitoramentoAtivo as MonitoramentoAtivoApi, Paginated } from '@/lib/types'
import type {
  MonitoramentoAtivoInput,
  MonitoramentoAtivoUsina,
  PaginatedMonitoramentosAtivos,
} from '@/types/monitoramento-ativo'

interface UseMonitoramentoAtivoParams {
  usina?: string | number
  provedor?: string
  status?: 'ativa' | 'vencida'
  search?: string
  page?: number
  page_size?: number
  ordering?: string
}

interface UseMonitoramentoAtivoResult {
  data: PaginatedMonitoramentosAtivos | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  criar: (
    usinaId: string | number,
    payload: MonitoramentoAtivoInput,
  ) => Promise<MonitoramentoAtivoUsina>
  atualizar: (id: string, payload: MonitoramentoAtivoInput) => Promise<MonitoramentoAtivoUsina>
  remover: (id: string) => Promise<void>
}

/**
 * Converte um item de `/monitoramento-ativo/` para o formato esperado pelos
 * componentes.
 */
export function paraMonitoramentoAtivo(m: MonitoramentoAtivoApi): MonitoramentoAtivoUsina {
  return {
    id: String(m.id),
    usina_id: String(m.usina),
    usina_nome: m.usina_nome,
    data_inicio: m.inicio_em,
    meses: m.meses,
    valor_mensal: m.valor_mensal ?? null,
    contratante: m.contratante ?? '',
    observacoes: m.observacoes ?? '',
    data_fim: m.fim_em,
    dias_restantes: m.dias_restantes,
    ativa: m.is_active,
    criado_em: m.created_at,
    atualizado_em: m.updated_at,
  }
}

export function useMonitoramentoAtivo(
  params: UseMonitoramentoAtivoParams = {},
): UseMonitoramentoAtivoResult {
  const [data, setData] = useState<PaginatedMonitoramentosAtivos | null>(null)
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
      if (params.ordering) apiParams.ordering = params.ordering
      if (params.status) apiParams.status = params.status

      const response = await api.get<Paginated<MonitoramentoAtivoApi>>('/monitoramento-ativo/', {
        params: apiParams,
      })
      setData({
        count: response.data.count,
        next: response.data.next,
        previous: response.data.previous,
        results: response.data.results.map(paraMonitoramentoAtivo),
      })
    } catch {
      setError('Erro ao carregar monitoramentos ativos')
    } finally {
      setLoading(false)
    }
    // JSON.stringify evita loop infinito quando params é objeto literal recriado a cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)])

  useEffect(() => {
    void fetch()
  }, [fetch])

  const criar = useCallback(
    async (usinaId: string | number, payload: MonitoramentoAtivoInput) => {
      const body: Record<string, unknown> = {
        usina: typeof usinaId === 'string' ? Number(usinaId) : usinaId,
        inicio_em: payload.data_inicio,
        meses: payload.meses,
      }
      if (payload.valor_mensal !== undefined) body.valor_mensal = payload.valor_mensal
      if (payload.contratante !== undefined) body.contratante = payload.contratante
      if (payload.observacoes !== undefined) body.observacoes = payload.observacoes
      const resp = await api.post<MonitoramentoAtivoApi>('/monitoramento-ativo/', body)
      return paraMonitoramentoAtivo(resp.data)
    },
    [],
  )

  const atualizar = useCallback(async (id: string, payload: MonitoramentoAtivoInput) => {
    const body: Record<string, unknown> = {
      inicio_em: payload.data_inicio,
      meses: payload.meses,
    }
    if (payload.valor_mensal !== undefined) body.valor_mensal = payload.valor_mensal
    if (payload.contratante !== undefined) body.contratante = payload.contratante
    if (payload.observacoes !== undefined) body.observacoes = payload.observacoes
    const resp = await api.patch<MonitoramentoAtivoApi>(`/monitoramento-ativo/${id}/`, body)
    return paraMonitoramentoAtivo(resp.data)
  }, [])

  const remover = useCallback(async (id: string) => {
    await api.delete(`/monitoramento-ativo/${id}/`)
  }, [])

  return { data, loading, error, refetch: fetch, criar, atualizar, remover }
}
