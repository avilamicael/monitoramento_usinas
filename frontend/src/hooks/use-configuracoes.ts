/**
 * Hook adapter de configurações — converte entre o backend novo
 * (`core.ConfiguracaoEmpresa`, singleton por empresa) e o formato antigo
 * usado pela `ConfiguracoesPage`.
 *
 * Conversões importantes:
 * - `dias_sem_comunicacao_pausar` (DIAS) ↔ `alerta_sem_comunicacao_minutos` (MINUTOS)
 *   Ida: dias = round(min / 1440); volta: min = dias * 1440.
 * - O endpoint é `/configuracao/` (singular) e retorna paginado com sempre 1 resultado.
 *   Pegamos `results[0]` e fazemos PATCH em `/configuracao/{id}/`.
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { ConfiguracaoSistema, ConfiguracaoSistemaUpdate } from '@/types/configuracoes'

const MINUTOS_POR_DIA = 1440

interface ConfiguracaoApi {
  id: number
  empresa: string
  garantia_padrao_meses: number
  garantia_aviso_dias: number
  garantia_critico_dias: number
  horario_solar_inicio: string
  horario_solar_fim: string
  alerta_sem_comunicacao_minutos: number
  alerta_dado_ausente_coletas: number
  subdesempenho_limite_pct: string | number
  queda_rendimento_pct: string | number
  temperatura_limite_c: string | number
  potencia_minima_avaliacao_kw: string | number
  inversor_offline_coletas_minimas: number
  sem_geracao_queda_abrupta_pct: string | number
  retencao_leituras_dias: number
  updated_at: string
}

interface PaginatedConfig {
  results?: ConfiguracaoApi[]
}

interface UseConfiguracoesResult {
  data: ConfiguracaoSistema | null
  loading: boolean
  error: string | null
  saving: boolean
  refetch: () => Promise<void>
  atualizar: (payload: ConfiguracaoSistemaUpdate) => Promise<ConfiguracaoSistema>
}

function extrairErro(err: unknown, fallback: string): string {
  const e = err as { response?: { status?: number; data?: Record<string, unknown> } }
  if (e?.response?.status === 403) return 'Você não tem permissão para acessar as configurações.'
  const data = e?.response?.data
  if (data && typeof data === 'object') {
    const campos = Object.entries(data)
      .map(([chave, valor]) => {
        const msg = Array.isArray(valor) ? valor.join(' ') : String(valor)
        return `${chave}: ${msg}`
      })
      .join('\n')
    if (campos) return campos
  }
  return fallback
}

function paraConfigUI(c: ConfiguracaoApi): ConfiguracaoSistema {
  return {
    id: c.id,
    dias_sem_comunicacao_pausar: Math.max(1, Math.round(c.alerta_sem_comunicacao_minutos / MINUTOS_POR_DIA)),
    meses_garantia_padrao: c.garantia_padrao_meses,
    dias_aviso_garantia_proxima: c.garantia_aviso_dias,
    dias_aviso_garantia_urgente: c.garantia_critico_dias,
    atualizado_em: c.updated_at,
    subdesempenho_limite_pct: c.subdesempenho_limite_pct,
    queda_rendimento_pct: c.queda_rendimento_pct,
    temperatura_limite_c: c.temperatura_limite_c,
    potencia_minima_avaliacao_kw: c.potencia_minima_avaliacao_kw,
    inversor_offline_coletas_minimas: c.inversor_offline_coletas_minimas,
    sem_geracao_queda_abrupta_pct: c.sem_geracao_queda_abrupta_pct,
    retencao_leituras_dias: c.retencao_leituras_dias,
    alerta_dado_ausente_coletas: c.alerta_dado_ausente_coletas,
    horario_solar_inicio: c.horario_solar_inicio,
    horario_solar_fim: c.horario_solar_fim,
  }
}

function paraPayloadApi(payload: ConfiguracaoSistemaUpdate): Partial<ConfiguracaoApi> {
  const out: Partial<ConfiguracaoApi> = {}
  if (payload.dias_sem_comunicacao_pausar !== undefined) {
    out.alerta_sem_comunicacao_minutos = payload.dias_sem_comunicacao_pausar * MINUTOS_POR_DIA
  }
  if (payload.meses_garantia_padrao !== undefined) {
    out.garantia_padrao_meses = payload.meses_garantia_padrao
  }
  if (payload.dias_aviso_garantia_proxima !== undefined) {
    out.garantia_aviso_dias = payload.dias_aviso_garantia_proxima
  }
  if (payload.dias_aviso_garantia_urgente !== undefined) {
    out.garantia_critico_dias = payload.dias_aviso_garantia_urgente
  }
  // Campos novos passam direto (já estão nos nomes corretos do backend)
  if (payload.subdesempenho_limite_pct !== undefined) out.subdesempenho_limite_pct = payload.subdesempenho_limite_pct
  if (payload.queda_rendimento_pct !== undefined) out.queda_rendimento_pct = payload.queda_rendimento_pct
  if (payload.temperatura_limite_c !== undefined) out.temperatura_limite_c = payload.temperatura_limite_c
  if (payload.potencia_minima_avaliacao_kw !== undefined) out.potencia_minima_avaliacao_kw = payload.potencia_minima_avaliacao_kw
  if (payload.inversor_offline_coletas_minimas !== undefined) out.inversor_offline_coletas_minimas = payload.inversor_offline_coletas_minimas
  if (payload.sem_geracao_queda_abrupta_pct !== undefined) out.sem_geracao_queda_abrupta_pct = payload.sem_geracao_queda_abrupta_pct
  if (payload.retencao_leituras_dias !== undefined) out.retencao_leituras_dias = payload.retencao_leituras_dias
  if (payload.alerta_dado_ausente_coletas !== undefined) out.alerta_dado_ausente_coletas = payload.alerta_dado_ausente_coletas
  if (payload.horario_solar_inicio !== undefined) out.horario_solar_inicio = payload.horario_solar_inicio
  if (payload.horario_solar_fim !== undefined) out.horario_solar_fim = payload.horario_solar_fim
  return out
}

export function useConfiguracoes(): UseConfiguracoesResult {
  const [data, setData] = useState<ConfiguracaoSistema | null>(null)
  const [configId, setConfigId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get<PaginatedConfig | ConfiguracaoApi[]>('/configuracao/')
      const results = Array.isArray(response.data) ? response.data : (response.data.results ?? [])
      const primeiro = results[0]
      if (!primeiro) {
        setError('Nenhuma configuração encontrada para esta empresa.')
        return
      }
      setConfigId(primeiro.id)
      setData(paraConfigUI(primeiro))
    } catch (err) {
      setError(extrairErro(err, 'Erro ao carregar configurações'))
    } finally {
      setLoading(false)
    }
  }, [])

  const atualizar = useCallback(
    async (payload: ConfiguracaoSistemaUpdate) => {
      if (configId === null) {
        throw new Error('Configuração ainda não carregada.')
      }
      setSaving(true)
      try {
        const apiPayload = paraPayloadApi(payload)
        const response = await api.patch<ConfiguracaoApi>(`/configuracao/${configId}/`, apiPayload)
        const adaptada = paraConfigUI(response.data)
        setData(adaptada)
        return adaptada
      } finally {
        setSaving(false)
      }
    },
    [configId],
  )

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, saving, refetch, atualizar }
}
