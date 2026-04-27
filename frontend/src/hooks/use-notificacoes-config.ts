/**
 * Hook adapter para a `GestaoNotificacoesPage`.
 *
 * O backend novo expõe `/notificacoes/regras/` (CRUD de `RegraNotificacao`).
 * Cada regra tem (canal, severidades[], tipos_alerta[], config{}, is_active).
 *
 * Para preservar o spirit visual da página antiga (1 card por canal),
 * mapeamos cada `RegraNotificacao` para `ConfiguracaoNotificacao` e usamos
 * a primeira regra encontrada por canal como "configuração ativa daquele
 * canal". Regras adicionais para o mesmo canal continuam coexistindo no
 * backend, mas a página mostra apenas uma.
 *
 * O destinatário fica em `regra.config.destinatarios` (string crua) — esse
 * é o contrato implícito que combinamos com o backend para esta página.
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Paginated, RegraNotificacao, Severidade } from '@/lib/types'
import {
  flagsParaSeveridades,
  severidadesParaFlags,
  type CanalNotificacao,
  type ConfiguracaoNotificacao,
  type ConfiguracaoNotificacaoPayload,
} from '@/types/notificacoes-config'

interface ApiResp<T> { results?: T[] }

const NOME_PADRAO: Record<CanalNotificacao, string> = {
  email: 'Notificações por e-mail',
  whatsapp: 'Notificações por WhatsApp',
  webhook: 'Notificações por Webhook',
}

function extrairDestinatarios(config: Record<string, unknown> | undefined): string {
  if (!config) return ''
  const dest = config.destinatarios
  if (typeof dest === 'string') return dest
  if (Array.isArray(dest)) return dest.filter((x) => typeof x === 'string').join('\n')
  return ''
}

function paraConfiguracao(r: RegraNotificacao): ConfiguracaoNotificacao | null {
  // Página antiga só conhece email/whatsapp/webhook. 'web' é ignorado.
  if (r.canal !== 'email' && r.canal !== 'whatsapp' && r.canal !== 'webhook') return null
  const flags = severidadesParaFlags(r.severidades)
  return {
    id: r.id,
    canal: r.canal,
    nome: r.nome,
    ativo: r.is_active,
    destinatarios: extrairDestinatarios(r.config),
    ...flags,
    tipos_alerta: r.tipos_alerta,
    created_at: r.created_at,
  }
}

function extrairErro(err: unknown, fallback: string): string {
  const e = err as { response?: { status?: number; data?: unknown } }
  if (e?.response?.status === 403) return 'Apenas administradores podem gerenciar notificações.'
  const data = e?.response?.data
  if (data && typeof data === 'object') {
    const detail = (data as Record<string, unknown>).detail
    if (typeof detail === 'string') return detail
    const partes = Object.entries(data as Record<string, unknown>).map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: ${v.join(' ')}`
      return `${k}: ${String(v)}`
    })
    if (partes.length) return partes.join('\n')
  }
  return fallback
}

export function useNotificacoesConfig() {
  const [data, setData] = useState<ConfiguracaoNotificacao[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await api.get<RegraNotificacao[] | ApiResp<RegraNotificacao> | Paginated<RegraNotificacao>>(
        '/notificacoes/regras/',
      )
      const results = Array.isArray(resp.data)
        ? resp.data
        : (resp.data as ApiResp<RegraNotificacao>).results ?? []
      const adapted = results
        .map(paraConfiguracao)
        .filter((c): c is ConfiguracaoNotificacao => c !== null)
      setData(adapted)
    } catch (err) {
      setError(extrairErro(err, 'Erro ao carregar configuração.'))
    } finally {
      setLoading(false)
    }
  }, [])

  const criar = useCallback(async (canal: CanalNotificacao, payload: ConfiguracaoNotificacaoPayload) => {
    const severidades: Severidade[] = flagsParaSeveridades(payload)
    const body = {
      nome: payload.nome ?? NOME_PADRAO[canal],
      canal,
      severidades,
      tipos_alerta: payload.tipos_alerta ?? [],
      config: { destinatarios: payload.destinatarios },
      is_active: payload.ativo,
    }
    const resp = await api.post<RegraNotificacao>('/notificacoes/regras/', body)
    await refetch()
    const adapted = paraConfiguracao(resp.data)
    if (!adapted) throw new Error('Canal retornado pelo backend não é suportado pela página.')
    return adapted
  }, [refetch])

  const atualizar = useCallback(async (id: number, payload: ConfiguracaoNotificacaoPayload) => {
    const severidades: Severidade[] = flagsParaSeveridades(payload)
    const body: Record<string, unknown> = {
      severidades,
      config: { destinatarios: payload.destinatarios },
      is_active: payload.ativo,
    }
    if (payload.nome !== undefined) body.nome = payload.nome
    if (payload.tipos_alerta !== undefined) body.tipos_alerta = payload.tipos_alerta
    const resp = await api.patch<RegraNotificacao>(`/notificacoes/regras/${id}/`, body)
    await refetch()
    const adapted = paraConfiguracao(resp.data)
    if (!adapted) throw new Error('Canal retornado pelo backend não é suportado pela página.')
    return adapted
  }, [refetch])

  const remover = useCallback(async (id: number) => {
    await api.delete(`/notificacoes/regras/${id}/`)
    await refetch()
  }, [refetch])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch, criar, atualizar, remover, extrairErro }
}
