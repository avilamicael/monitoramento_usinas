/**
 * Hook adapter de usinas — converte os payloads da nossa API REST
 * (em `lib/types.ts`) para a forma esperada pelos componentes portados
 * do firmasolar antigo (`types/usinas.ts`).
 *
 * - `useUsinas(params)` lista paginada (com filtros mapeados).
 * - `useUsina(id)` enriquece o detalhe com chamadas paralelas para
 *   inversores e leituras (último snapshot da usina + por inversor),
 *   já que a API atual não retorna esses dados aninhados em
 *   `/usinas/{id}/`.
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type {
  InversorResumo,
  PaginatedUsinas,
  SnapshotInversorResumo,
  SnapshotUsina,
  StatusGarantia,
  UsinaDetalhe,
  UsinaResumo,
} from '@/types/usinas'
import type {
  Inversor,
  LeituraInversor,
  LeituraUsina,
  Paginated,
  Usina as UsinaApi,
  UsinaResumo as UsinaResumoApi,
} from '@/lib/types'

interface UseUsinasParams {
  provedor?: string
  ativo?: boolean
  status_garantia?: StatusGarantia
  nome?: string
  page?: number
}

interface UseUsinasResult {
  data: PaginatedUsinas | null
  loading: boolean
  error: string | null
  refetch: () => void
}

function paraResumo(u: UsinaResumoApi): UsinaResumo {
  return {
    id: String(u.id),
    nome: u.nome,
    id_usina_provedor: u.id_externo,
    provedor: u.provedor_tipo ?? '',
    capacidade_kwp: u.capacidade_kwp ? Number(u.capacidade_kwp) : 0,
    ativo: u.is_active,
    endereco: '',
    cidade: u.cidade ?? '',
    telefone: '',
    status_garantia: u.status_garantia,
    criado_em: '',
    atualizado_em: u.ultima_leitura_em ?? '',
  }
}

export function useUsinas(params: UseUsinasParams = {}): UseUsinasResult {
  const [data, setData] = useState<PaginatedUsinas | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchUsinas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Mapear filtros antigos → novos
      const apiParams: Record<string, string | number | boolean> = {}
      if (params.provedor) apiParams.provedor = params.provedor
      if (params.status_garantia) apiParams.status_garantia = params.status_garantia
      if (params.nome) apiParams.search = params.nome
      if (typeof params.ativo === 'boolean') apiParams.is_active = params.ativo
      if (params.page) apiParams.page = params.page

      const response = await api.get<Paginated<UsinaResumoApi>>('/usinas/', { params: apiParams })
      setData({
        count: response.data.count,
        next: response.data.next,
        previous: response.data.previous,
        results: response.data.results.map(paraResumo),
      })
    } catch {
      setError('Erro ao carregar usinas')
    } finally {
      setLoading(false)
    }
  // JSON.stringify evita loop infinito quando params é objeto literal recriado a cada render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)])

  useEffect(() => {
    void fetchUsinas()
  }, [fetchUsinas])

  return { data, loading, error, refetch: fetchUsinas }
}

interface UseUsinaResult {
  data: UsinaDetalhe | null
  loading: boolean
  error: string | null
  refetch: () => void
}

function paraSnapshotUsina(l: LeituraUsina): SnapshotUsina {
  return {
    id: String(l.id),
    coletado_em: l.coletado_em,
    data_medicao: l.medido_em ?? l.coletado_em,
    potencia_kw: Number(l.potencia_kw),
    energia_hoje_kwh: Number(l.energia_hoje_kwh),
    energia_mes_kwh: l.energia_mes_kwh ? Number(l.energia_mes_kwh) : 0,
    energia_total_kwh: Number(l.energia_total_kwh),
    status: l.status,
    qtd_inversores: l.qtd_inversores_total ?? 0,
    qtd_inversores_online: l.qtd_inversores_online ?? 0,
    qtd_alertas: 0,
  }
}

function paraSnapshotInversor(l: LeituraInversor): SnapshotInversorResumo {
  // Mapeia o estado da API para o vocabulário antigo:
  // 'online' → 'normal', 'alerta' → 'aviso', resto → 'offline'.
  let estado: string = 'offline'
  if (l.estado === 'online') estado = 'normal'
  else if (l.estado === 'alerta') estado = 'aviso'

  return {
    coletado_em: l.coletado_em,
    estado,
    pac_kw: Number(l.pac_kw),
    energia_hoje_kwh: Number(l.energia_hoje_kwh),
    energia_total_kwh: Number(l.energia_total_kwh),
    tensao_ac_v: l.tensao_ac_v ? Number(l.tensao_ac_v) : null,
    corrente_ac_a: l.corrente_ac_a ? Number(l.corrente_ac_a) : null,
    tensao_dc_v: l.tensao_dc_v ? Number(l.tensao_dc_v) : null,
    corrente_dc_a: l.corrente_dc_a ? Number(l.corrente_dc_a) : null,
    frequencia_hz: l.frequencia_hz ? Number(l.frequencia_hz) : null,
    temperatura_c: l.temperatura_c ? Number(l.temperatura_c) : null,
    strings_mppt: (l.strings_mppt as Record<string, unknown>) ?? {},
    soc_bateria: l.soc_bateria_pct ? Number(l.soc_bateria_pct) : null,
  }
}

async function buscarUltimoSnapshotInversor(inversorId: number): Promise<SnapshotInversorResumo | null> {
  try {
    const res = await api.get<Paginated<LeituraInversor>>('/monitoramento/leituras_inversor/', {
      params: { inversor: inversorId, ordering: '-coletado_em', page_size: 1 },
    })
    const ultima = res.data.results[0]
    return ultima ? paraSnapshotInversor(ultima) : null
  } catch {
    return null
  }
}

async function buscarUltimoSnapshotUsina(usinaId: number): Promise<SnapshotUsina | null> {
  try {
    const res = await api.get<Paginated<LeituraUsina>>('/monitoramento/leituras_usina/', {
      params: { usina: usinaId, ordering: '-coletado_em', page_size: 1 },
    })
    const ultima = res.data.results[0]
    return ultima ? paraSnapshotUsina(ultima) : null
  } catch {
    return null
  }
}

export function useUsina(id: string): UseUsinaResult {
  const [data, setData] = useState<UsinaDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsina = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const usinaIdNum = Number(id)

      // Em paralelo: dados base + lista de inversores + último snapshot da usina
      const [resUsina, resInversores, snapshotUsina] = await Promise.all([
        api.get<UsinaApi>(`/usinas/${id}/`),
        api.get<Paginated<Inversor>>('/inversores/', {
          params: { usina: usinaIdNum, page_size: 100 },
        }),
        buscarUltimoSnapshotUsina(usinaIdNum),
      ])

      // Em paralelo: último snapshot de cada inversor
      const inversoresApi = resInversores.data.results
      const snapshots = await Promise.all(
        inversoresApi.map((inv) => buscarUltimoSnapshotInversor(inv.id)),
      )

      const inversores: InversorResumo[] = inversoresApi.map((inv, idx) => ({
        id: String(inv.id),
        numero_serie: inv.numero_serie,
        modelo: inv.modelo,
        id_inversor_provedor: inv.id_externo,
        ultimo_snapshot: snapshots[idx],
      }))

      const usina = resUsina.data

      const detalhe: UsinaDetalhe = {
        id: String(usina.id),
        nome: usina.nome,
        provedor: usina.provedor_tipo ?? '',
        capacidade_kwp: usina.capacidade_kwp ? Number(usina.capacidade_kwp) : 0,
        ativo: usina.is_active,
        fuso_horario: usina.fuso_horario,
        endereco: usina.endereco ?? '',
        cidade: usina.cidade ?? '',
        telefone: '',
        latitude: usina.latitude ? Number(usina.latitude) : null,
        longitude: usina.longitude ? Number(usina.longitude) : null,
        status_garantia: usina.status_garantia,
        tensao_sobretensao_v: Number(usina.tensao_ac_limite_v),
        ultimo_snapshot: snapshotUsina,
        inversores,
        criado_em: usina.created_at,
        atualizado_em: usina.updated_at,
      }

      setData(detalhe)
    } catch {
      setError('Erro ao carregar usina')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchUsina()
  }, [fetchUsina])

  return { data, loading, error, refetch: fetchUsina }
}
