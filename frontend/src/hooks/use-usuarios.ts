/**
 * Hook adapter de usuários — converte os payloads do backend novo
 * (que usa `papel` em vez de `is_staff` / `is_superuser`) para o formato
 * esperado pelos componentes portados do firmasolar antigo.
 *
 * Mapeamento:
 *   - leitura: `is_staff = papel === 'administrador'`, `is_superuser = false`
 *   - escrita: `papel = is_staff ? 'administrador' : 'operacional'`
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { PapelUsuario, Usuario, UsuarioWrite } from '@/types/usuarios'

interface UsuarioApi {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  telefone?: string
  papel: PapelUsuario
  empresa?: string
  empresa_nome?: string
  is_active: boolean
  date_joined: string
  last_login: string | null
}

interface UsuarioWriteApi {
  username: string
  email: string
  first_name: string
  last_name: string
  telefone?: string
  papel: PapelUsuario
  is_active: boolean
  password?: string
}

interface ApiResp<T> {
  results?: T[]
}

function paraUsuario(u: UsuarioApi): Usuario {
  const isStaff = u.papel === 'administrador'
  return {
    id: u.id,
    username: u.username,
    email: u.email ?? '',
    first_name: u.first_name ?? '',
    last_name: u.last_name ?? '',
    is_staff: isStaff,
    is_superuser: false,
    is_active: u.is_active,
    last_login: u.last_login,
    date_joined: u.date_joined,
    papel: u.papel,
    telefone: u.telefone,
    empresa: u.empresa,
    empresa_nome: u.empresa_nome,
  }
}

function paraPayloadApi(payload: UsuarioWrite | Partial<UsuarioWrite>): Partial<UsuarioWriteApi> {
  const out: Partial<UsuarioWriteApi> = {}
  if (payload.username !== undefined) out.username = payload.username
  if (payload.email !== undefined) out.email = payload.email
  if (payload.first_name !== undefined) out.first_name = payload.first_name
  if (payload.last_name !== undefined) out.last_name = payload.last_name
  if (payload.telefone !== undefined) out.telefone = payload.telefone
  if (payload.is_active !== undefined) out.is_active = payload.is_active
  if (payload.password) out.password = payload.password
  // Deriva papel: prioriza explícito; senão deriva de is_staff
  if (payload.papel !== undefined) {
    out.papel = payload.papel
  } else if (payload.is_staff !== undefined) {
    out.papel = payload.is_staff ? 'administrador' : 'operacional'
  }
  return out
}

export function useUsuarios() {
  const [data, setData] = useState<Usuario[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await api.get<UsuarioApi[] | ApiResp<UsuarioApi>>('/usuarios/')
      const results = Array.isArray(resp.data) ? resp.data : (resp.data.results ?? [])
      setData(results.map(paraUsuario))
    } catch {
      setError('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }, [])

  const criar = useCallback(
    async (payload: UsuarioWrite) => {
      const apiPayload = paraPayloadApi(payload)
      // Garante campos obrigatórios na criação
      if (!apiPayload.papel) apiPayload.papel = 'operacional'
      if (apiPayload.is_active === undefined) apiPayload.is_active = true
      const resp = await api.post<UsuarioApi>('/usuarios/', apiPayload)
      await refetch()
      return paraUsuario(resp.data)
    },
    [refetch],
  )

  const atualizar = useCallback(
    async (id: number, payload: Partial<UsuarioWrite>) => {
      const apiPayload = paraPayloadApi(payload)
      const resp = await api.patch<UsuarioApi>(`/usuarios/${id}/`, apiPayload)
      await refetch()
      return paraUsuario(resp.data)
    },
    [refetch],
  )

  const remover = useCallback(
    async (id: number) => {
      await api.delete(`/usuarios/${id}/`)
      await refetch()
    },
    [refetch],
  )

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch, criar, atualizar, remover }
}

export function extrairErroUsuario(err: unknown, fallback: string): string {
  const e = err as { response?: { status?: number; data?: unknown } }
  if (e?.response?.status === 403) return 'Sem permissão para esta ação.'
  if (e?.response?.status === 400) {
    const data = e.response.data
    if (data && typeof data === 'object') {
      const detail = (data as Record<string, unknown>).detail
      if (typeof detail === 'string') return detail
      const partes = Object.entries(data as Record<string, unknown>).map(([k, v]) => {
        if (Array.isArray(v)) return `${k}: ${v.join(' ')}`
        return `${k}: ${String(v)}`
      })
      if (partes.length) return partes.join('\n')
    }
  }
  return fallback
}
