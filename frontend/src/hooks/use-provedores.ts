/**
 * Hook adapter de provedores — converte os payloads da nossa API REST
 * (`/provedores/` + `/coleta/logs/`) para o formato esperado pelos
 * componentes portados do firmasolar antigo (`types/provedores.ts`).
 *
 * - `useProvedores()` retorna a lista (já enriquecida com `ultima_coleta`
 *   buscada do `/coleta/logs/?conta_provedor={id}&ordering=-iniciado_em&page_size=1`)
 *   + `meta` hardcoded (a API não expõe `/meta/`).
 * - `forcarColeta()` chama `POST /provedores/{id}/coletar_agora/`.
 * - `extrairErroProvedor` é exportado para que páginas possam formatar
 *   erros de submissão consistentemente.
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type {
  ContaProvedor as ContaProvedorApi,
  LogColeta as LogColetaApi,
  Paginated,
  TipoProvedor,
} from '@/lib/types'
import type {
  CredencialProvedor,
  CredencialWritePayload,
  ProvedorMeta,
  ProvedoresMetaResponse,
  TokenStatus,
  UltimaColeta,
} from '@/types/provedores'

const STATELESS_PROVEDORES = new Set<TipoProvedor>(['solis', 'foxess'])

const META_PROVEDORES: ProvedorMeta[] = [
  {
    valor: 'solis',
    label: 'Solis',
    usa_token_manual: false,
    campos: [
      { chave: 'api_key', label: 'API Key', tipo: 'texto' },
      { chave: 'app_secret', label: 'App Secret', tipo: 'senha' },
    ],
  },
  {
    valor: 'hoymiles',
    label: 'Hoymiles',
    usa_token_manual: false,
    campos: [
      { chave: 'username', label: 'Usuário', tipo: 'texto' },
      { chave: 'password', label: 'Senha', tipo: 'senha' },
    ],
  },
  {
    valor: 'fusionsolar',
    label: 'FusionSolar',
    usa_token_manual: false,
    campos: [
      { chave: 'username', label: 'Usuário', tipo: 'texto' },
      { chave: 'password', label: 'Senha', tipo: 'senha' },
    ],
  },
  {
    valor: 'solarman',
    label: 'Solarman',
    usa_token_manual: true,
    campos: [
      { chave: 'token', label: 'Token JWT', tipo: 'senha' },
    ],
  },
  {
    valor: 'auxsol',
    label: 'AuxSol',
    usa_token_manual: false,
    campos: [
      { chave: 'username', label: 'Usuário', tipo: 'texto' },
      { chave: 'password', label: 'Senha', tipo: 'senha' },
    ],
  },
  {
    valor: 'foxess',
    label: 'FoxESS',
    usa_token_manual: false,
    campos: [
      { chave: 'api_key', label: 'API Key', tipo: 'senha' },
    ],
  },
]

const META_RESPONSE: ProvedoresMetaResponse = {
  provedores: META_PROVEDORES,
  intervalo_minimo_minutos: 10,
}

interface UseProvedoresResult {
  data: CredencialProvedor[] | null
  meta: ProvedoresMetaResponse | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  criar: (payload: CredencialWritePayload) => Promise<CredencialProvedor>
  atualizar: (id: string, payload: CredencialWritePayload) => Promise<CredencialProvedor>
  remover: (id: string) => Promise<void>
  forcarColeta: (id: string) => Promise<void>
}

function extrairErro(err: unknown, fallback: string): string {
  const e = err as { response?: { status?: number; data?: unknown } }
  if (e?.response?.status === 403) return 'Sem permissão — apenas administradores podem gerenciar provedores.'
  const data = e?.response?.data
  if (data && typeof data === 'object') {
    const detail = (data as Record<string, unknown>).detail
    if (typeof detail === 'string') return detail
    const partes = Object.entries(data as Record<string, unknown>).map(([chave, valor]) => {
      if (Array.isArray(valor)) return `${chave}: ${valor.join(' ')}`
      if (typeof valor === 'object' && valor !== null) return `${chave}: ${JSON.stringify(valor)}`
      return `${chave}: ${String(valor)}`
    })
    if (partes.length) return partes.join('\n')
  }
  return fallback
}

function calcularTokenStatus(
  cred: ContaProvedorApi,
  usaTokenManual: boolean,
): TokenStatus | null {
  if (!usaTokenManual) return null
  if (!cred.cache_token_expira_em) {
    return { configurado: false }
  }
  const expira = new Date(cred.cache_token_expira_em)
  const agora = new Date()
  const ms = expira.getTime() - agora.getTime()
  const dias = Math.floor(ms / (1000 * 60 * 60 * 24))
  return {
    configurado: true,
    expira_em: cred.cache_token_expira_em,
    dias_restantes: dias,
  }
}

function paraUltimaColetaDoLog(log: LogColetaApi | undefined, cred: ContaProvedorApi): UltimaColeta | null {
  // Preferimos o LogColeta quando disponível (tem contadores).
  if (log) {
    const status = (log.status || cred.ultima_sincronizacao_status || 'sucesso') as UltimaColeta['status']
    return {
      status,
      usinas_coletadas: log.qtd_usinas ?? 0,
      inversores_coletados: log.qtd_inversores ?? 0,
      alertas_sincronizados: (log.qtd_alertas_abertos ?? 0) + (log.qtd_alertas_resolvidos ?? 0),
      duracao_ms: log.duracao_ms ?? 0,
      iniciado_em: log.iniciado_em,
      detalhe_erro: log.detalhe_erro ?? '',
    }
  }
  // Fallback: usar só o que está em ContaProvedor (sem contadores).
  if (cred.ultima_sincronizacao_em && cred.ultima_sincronizacao_status) {
    return {
      status: cred.ultima_sincronizacao_status as UltimaColeta['status'],
      usinas_coletadas: 0,
      inversores_coletados: 0,
      alertas_sincronizados: 0,
      duracao_ms: 0,
      iniciado_em: cred.ultima_sincronizacao_em,
      detalhe_erro: cred.ultima_sincronizacao_erro ?? '',
    }
  }
  return null
}

async function buscarUltimoLog(contaId: number): Promise<LogColetaApi | undefined> {
  try {
    const res = await api.get<Paginated<LogColetaApi>>('/coleta/logs/', {
      params: {
        conta_provedor: contaId,
        ordering: '-iniciado_em',
        page_size: 1,
      },
    })
    return res.data.results[0]
  } catch {
    return undefined
  }
}

async function paraCredencial(cred: ContaProvedorApi): Promise<CredencialProvedor> {
  const usaTokenManual = !STATELESS_PROVEDORES.has(cred.tipo)
  const log = await buscarUltimoLog(cred.id)
  // `provedor_display` é o que aparece nos textos da UI. Se tem rótulo
  // distinto do label do tipo, mostra os dois para diferenciar contas
  // do mesmo provedor (ex: "Solis (Empresa X)").
  const display = cred.rotulo && cred.rotulo !== cred.tipo_label
    ? `${cred.tipo_label} (${cred.rotulo})`
    : cred.tipo_label
  return {
    id: String(cred.id),
    provedor: cred.tipo,
    provedor_display: display,
    rotulo: cred.rotulo,
    ativo: cred.is_active,
    precisa_atencao: cred.precisa_atencao,
    intervalo_coleta_minutos: cred.intervalo_coleta_minutos,
    // A API não devolve preview de credenciais (write-only criptografado).
    credenciais_preview: null,
    token_status: calcularTokenStatus(cred, usaTokenManual),
    usa_token_manual: usaTokenManual,
    ultima_coleta: paraUltimaColetaDoLog(log, cred),
    criado_em: cred.created_at,
    atualizado_em: cred.updated_at,
  }
}

function paraPayloadApi(payload: CredencialWritePayload): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (payload.provedor !== undefined) body.tipo = payload.provedor
  if (payload.rotulo !== undefined) body.rotulo = payload.rotulo
  if (payload.ativo !== undefined) body.is_active = payload.ativo
  if (payload.intervalo_coleta_minutos !== undefined) {
    body.intervalo_coleta_minutos = payload.intervalo_coleta_minutos
  }
  // Token manual entra como uma credencial `token` para o backend.
  if (payload.credenciais !== undefined) {
    body.credenciais = { ...payload.credenciais }
  }
  if (payload.token_jwt !== undefined && payload.token_jwt !== '') {
    const credenciais = (body.credenciais as Record<string, string> | undefined) ?? {}
    credenciais.token = payload.token_jwt
    body.credenciais = credenciais
  }
  return body
}

export function useProvedores(): UseProvedoresResult {
  const [data, setData] = useState<CredencialProvedor[] | null>(null)
  const [meta] = useState<ProvedoresMetaResponse>(META_RESPONSE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const lista = await api.get<ContaProvedorApi[] | Paginated<ContaProvedorApi>>('/provedores/')
      const payload = lista.data
      const results = Array.isArray(payload) ? payload : payload.results
      const credenciais = await Promise.all(results.map(paraCredencial))
      setData(credenciais)
    } catch (err) {
      setError(extrairErro(err, 'Erro ao carregar provedores'))
    } finally {
      setLoading(false)
    }
  }, [])

  const criar = useCallback(async (payload: CredencialWritePayload) => {
    const body = paraPayloadApi(payload)
    // Backend exige `rotulo` no create — usa o tipo como fallback se não informado.
    if (!body.rotulo && body.tipo) body.rotulo = String(body.tipo)
    const resp = await api.post<ContaProvedorApi>('/provedores/', body)
    const cred = await paraCredencial(resp.data)
    await refetch()
    return cred
  }, [refetch])

  const atualizar = useCallback(async (id: string, payload: CredencialWritePayload) => {
    const body = paraPayloadApi(payload)
    const resp = await api.patch<ContaProvedorApi>(`/provedores/${id}/`, body)
    const cred = await paraCredencial(resp.data)
    await refetch()
    return cred
  }, [refetch])

  const remover = useCallback(async (id: string) => {
    await api.delete(`/provedores/${id}/`)
    await refetch()
  }, [refetch])

  const forcarColeta = useCallback(async (id: string) => {
    await api.post(`/provedores/${id}/coletar_agora/`)
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, meta, loading, error, refetch, criar, atualizar, remover, forcarColeta }
}

export { extrairErro as extrairErroProvedor }
