/**
 * Hook adapter de alertas — converte os payloads da nossa API REST
 * (`Alerta` em `lib/types.ts`) para o formato `AlertaResumo`/`AlertaDetalhe`
 * esperado pelos componentes portados do firmasolar.
 *
 * Mapeamentos:
 *   estado:    aberto       → ativo
 *              reconhecido  → ativo  (ainda em andamento)
 *              resolvido    → resolvido
 *   nivel:     critico      → critico
 *              aviso        → aviso
 *              info         → info
 *
 * A nossa API atual não expõe categoria/origem/sugestão/equipamento_sn —
 * preenchidos com strings vazias para manter compat das interfaces.
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Alerta, Paginated } from '@/lib/types'
import type {
  AlertaDetalhe,
  AlertaResumo,
  EstadoAlerta,
  InversorAfetado,
  NivelAlerta,
  PaginatedAlertas,
} from '@/types/alertas'

interface UseAlertasParams {
  estado?: EstadoAlerta | string
  nivel?: NivelAlerta | string
  origem?: string
  provedor?: string
  categoria?: string
  busca?: string
  usina?: string
  page?: number
}

interface UseAlertasResult {
  data: PaginatedAlertas | null
  loading: boolean
  error: string | null
  refetch: () => void
}

function mapEstadoParaApi(antigo?: string): string | undefined {
  // antigo: ativo/resolvido → novo: aberto/resolvido. "ativo" no antigo cobre
  // alertas em andamento (no novo: aberto + reconhecido). Filtramos apenas
  // por 'aberto' aqui — alertas reconhecidos não aparecem como "ativos" no
  // filtro, mas continuam sendo exibidos individualmente quando consultados.
  if (antigo === 'ativo') return 'aberto'
  if (antigo === 'resolvido') return 'resolvido'
  return undefined
}

function mapNivelParaApi(antigo?: string): string | undefined {
  if (antigo === 'critico') return 'critico'
  if (antigo === 'aviso') return 'aviso'
  if (antigo === 'info') return 'info'
  return undefined
}

function severidadeParaNivel(severidade: string): NivelAlerta {
  if (severidade === 'critico') return 'critico'
  if (severidade === 'aviso') return 'aviso'
  return 'info'
}

function estadoParaAntigo(estado: string): EstadoAlerta {
  if (estado === 'resolvido') return 'resolvido'
  return 'ativo'
}

function paraResumo(a: Alerta): AlertaResumo {
  const ctx = (a.contexto ?? {}) as Record<string, unknown>
  const agregado = ctx.agregado === true
  const qtdAfetados = typeof ctx.qtd_inversores_afetados === 'number'
    ? (ctx.qtd_inversores_afetados as number)
    : undefined
  return {
    id: String(a.id),
    usina: String(a.usina),
    usina_nome: a.usina_nome,
    usina_provedor: a.usina_provedor ?? '',
    usina_id_provedor: a.usina_id_externo ?? '',
    origem: 'interno',
    categoria: a.regra,
    categoria_efetiva: a.regra,
    mensagem: a.mensagem,
    nivel: severidadeParaNivel(a.severidade),
    estado: estadoParaAntigo(a.estado),
    inicio: a.aberto_em,
    fim: a.resolvido_em,
    com_garantia: false,
    criado_em: a.aberto_em,
    atualizado_em: a.atualizado_em,
    agregado,
    qtd_inversores_afetados: qtdAfetados,
  }
}

function paraDetalhe(a: Alerta): AlertaDetalhe {
  const ctx = (a.contexto ?? {}) as Record<string, unknown>
  const inversores = Array.isArray(ctx.inversores)
    ? (ctx.inversores as InversorAfetado[])
    : undefined
  const totalUsina = typeof ctx.total_inversores_da_usina === 'number'
    ? (ctx.total_inversores_da_usina as number)
    : undefined
  const resumo = paraResumo(a)
  return {
    ...resumo,
    catalogo_alarme: null,
    id_alerta_provedor: '',
    equipamento_sn: a.inversor_serie ?? '',
    sugestao: '',
    anotacoes: '',
    agregado: resumo.agregado,
    qtd_inversores_afetados: resumo.qtd_inversores_afetados,
    total_inversores_da_usina: totalUsina,
    inversores_afetados: inversores,
  }
}

export function useAlertas(params: UseAlertasParams = {}): UseAlertasResult {
  const [data, setData] = useState<PaginatedAlertas | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchAlertas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const apiParams: Record<string, string | number> = {}
      const estado = mapEstadoParaApi(params.estado)
      const severidade = mapNivelParaApi(params.nivel)
      if (estado) apiParams.estado = estado
      if (severidade) apiParams.severidade = severidade
      if (params.provedor) apiParams.provedor = params.provedor
      if (params.busca) apiParams.search = params.busca
      if (params.usina) apiParams.usina = params.usina
      if (params.page) apiParams.page = params.page
      // categoria / origem não têm equivalente direto no backend novo —
      // ignorados de propósito (a regra já cobre o filtro principal).

      const response = await api.get<Paginated<Alerta>>('/alertas/', { params: apiParams })
      setData({
        count: response.data.count,
        next: response.data.next,
        previous: response.data.previous,
        results: response.data.results.map(paraResumo),
      })
    } catch (err) {
      console.error('[useAlertas] falha ao carregar /alertas/', err)
      setError('Erro ao carregar alertas')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)])

  useEffect(() => {
    void fetchAlertas()
  }, [fetchAlertas])

  return { data, loading, error, refetch: fetchAlertas }
}

interface UseAlertaResult {
  data: AlertaDetalhe | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useAlerta(id: string): UseAlertaResult {
  const [data, setData] = useState<AlertaDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAlerta = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get<Alerta>(`/alertas/${id}/`)
      setData(paraDetalhe(response.data))
    } catch (err) {
      console.error(`[useAlerta] falha ao carregar /alertas/${id}/`, err)
      setError('Erro ao carregar alerta')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchAlerta()
  }, [fetchAlerta])

  return { data, loading, error, refetch: fetchAlerta }
}
