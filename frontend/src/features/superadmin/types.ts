/**
 * Tipos da API superadmin (cross-tenant).
 *
 * Match dos serializers em backend/apps/superadmin/serializers.py.
 */
import type { Papel } from "@/features/auth/useAuth";

export interface EmpresaSuperadmin {
  id: string;
  nome: string;
  slug: string;
  cnpj: string;
  cidade: string;
  uf: string;
  is_active: boolean;
  qtd_usuarios: number;
  qtd_usinas: number;
  created_at: string;
  updated_at: string;
}

export interface EmpresaInput {
  nome: string;
  slug?: string;
  cnpj?: string;
  cidade?: string;
  uf?: string;
  is_active?: boolean;
}

export interface UsuarioSuperadmin {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  telefone: string;
  papel: Papel;
  empresa: string | null;
  empresa_nome: string | null;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
}

export interface UsuarioInput {
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  telefone?: string;
  papel: Papel;
  empresa: string | null;
  password?: string;
  is_active?: boolean;
}
