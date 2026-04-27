/**
 * Tipos de usuário no formato esperado pela UI antiga (firmasolar).
 *
 * Adapter sobre o backend novo (`apps/usuarios.Usuario`):
 * - O backend novo NÃO TEM `is_staff` / `is_superuser`. Tem `papel` ('administrador' | 'operacional').
 * - Os hooks `use-usuarios` derivam `is_staff = papel === 'administrador'` e `is_superuser = false`.
 * - Campos extras (`papel`, `telefone`, `empresa`, `empresa_nome`) são opcionais para preservar
 *   compatibilidade visual com componentes antigos que não os referenciam.
 */
export type PapelUsuario = 'administrador' | 'operacional'

export interface Usuario {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  is_staff: boolean
  is_active: boolean
  is_superuser: boolean
  last_login: string | null
  date_joined: string
  // Campos do backend novo, opcionais para a UI antiga
  papel?: PapelUsuario
  telefone?: string
  empresa?: string
  empresa_nome?: string
}

export interface UsuarioWrite {
  username: string
  email: string
  first_name: string
  last_name: string
  is_staff: boolean
  is_active: boolean
  password?: string
  // Opcionais — derivados pelos hooks no envio
  papel?: PapelUsuario
  telefone?: string
}
