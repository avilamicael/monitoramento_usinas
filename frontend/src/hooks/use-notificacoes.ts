/**
 * Hook adapter de notificações — converte payloads de
 * `/notificacoes/entregas/` (log de envios disparados pelas regras)
 * para a forma esperada pela `NotificacoesPage` antiga.
 *
 * O backend novo NÃO TEM:
 *   - inbox in-app por usuário,
 *   - marcação como lida (`marcarLida`/`marcarTodasLidas` viram no-op),
 *   - filtro `apenas_nao_lidas` (ignorado, sempre retorna todas).
 *
 * Mantemos a interface antiga para não quebrar a página, mas com esses
 * compromissos documentados.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import type { EntregaNotificacao, Paginated } from '@/lib/types'
import type { Notificacao, PaginatedNotificacoes } from '@/types/notificacoes'

const POLLING_MS = 60_000

interface UseNotificacoesOpts {
  apenasNaoLidas?: boolean
  page?: number
}

/**
 * Converte uma `EntregaNotificacao` para o formato `Notificacao`
 * esperado pela `NotificacoesPage`.
 */
function paraNotificacao(e: EntregaNotificacao): Notificacao {
  return {
    id: String(e.id),
    titulo: e.alerta_regra || 'Notificação',
    mensagem: `${e.alerta_usina_nome} via ${e.canal} → ${e.destino}`,
    tipo: 'alerta',
    nivel: 'info', // backend não retorna severidade na entrega; padrão visual
    link: `/alertas/${e.alerta}`,
    apenas_staff: false,
    criado_em: e.created_at,
    lida: false, // não há marcação de leitura no backend novo
  }
}

export function useNotificacoes({ apenasNaoLidas = false, page = 1 }: UseNotificacoesOpts = {}) {
  void apenasNaoLidas // mantido na assinatura, mas ignorado (sem inbox por usuário)

  const [data, setData] = useState<PaginatedNotificacoes | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string | number> = { page }
      const resp = await api.get<Paginated<EntregaNotificacao>>('/notificacoes/entregas/', { params })
      setData({
        count: resp.data.count,
        next: resp.data.next,
        previous: resp.data.previous,
        results: resp.data.results.map(paraNotificacao),
      })
    } catch {
      setError('Erro ao carregar notificações')
    } finally {
      setLoading(false)
    }
  }, [page])

  // No-op: backend novo não tem marcação como lida.
  const marcarLida = useCallback(async (_id: string) => {
    void _id
  }, [])

  const marcarTodasLidas = useCallback(async () => {
    /* no-op */
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch, marcarLida, marcarTodasLidas }
}

/**
 * Hook para o badge no sino do header. Como não há inbox por usuário,
 * usamos a contagem de entregas das últimas 24h como aproximação visual.
 */
export function useNotificacoesCount() {
  const [count, setCount] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const buscar = useCallback(async () => {
    try {
      const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const resp = await api.get<Paginated<EntregaNotificacao>>('/notificacoes/entregas/', {
        params: { created_at__gte: desde, page_size: 1 },
      })
      setCount(resp.data.count ?? 0)
    } catch {
      // Falha silenciosa: evita spam de toasts a cada poll
    }
  }, [])

  useEffect(() => {
    void buscar()
    timerRef.current = setInterval(() => { void buscar() }, POLLING_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [buscar])

  return { count, refetch: buscar }
}
