/**
 * Hooks React Query do painel superadmin.
 *
 * Todas as queries/mutations apontam para `/api/superadmin/*` — gated por
 * `EhSuperadmin` no backend. Em caso de papel diferente, retorna 403.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Paginated } from "@/lib/types";

import type {
  EmpresaInput,
  EmpresaSuperadmin,
  UsuarioInput,
  UsuarioSuperadmin,
} from "./types";

// ── Empresas ──────────────────────────────────────────────────────────────

export function useEmpresasSuperadmin() {
  return useQuery({
    queryKey: ["superadmin", "empresas"],
    queryFn: async () =>
      (
        await api.get<Paginated<EmpresaSuperadmin>>("/superadmin/empresas/", {
          params: { page_size: 200 },
        })
      ).data,
  });
}

export function useEmpresaSuperadmin(id: string | undefined) {
  return useQuery({
    queryKey: ["superadmin", "empresas", id],
    queryFn: async () =>
      (await api.get<EmpresaSuperadmin>(`/superadmin/empresas/${id}/`)).data,
    enabled: !!id,
  });
}

export function useCriarEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: EmpresaInput) =>
      (await api.post<EmpresaSuperadmin>("/superadmin/empresas/", dados)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["superadmin", "empresas"] });
    },
  });
}

export function useAtualizarEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<EmpresaInput> }) =>
      (await api.patch<EmpresaSuperadmin>(`/superadmin/empresas/${id}/`, dados)).data,
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ["superadmin", "empresas"] });
      void qc.invalidateQueries({ queryKey: ["superadmin", "empresas", vars.id] });
    },
  });
}

export function useExcluirEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/superadmin/empresas/${id}/`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["superadmin", "empresas"] });
    },
  });
}

// ── Usuários (cross-tenant) ───────────────────────────────────────────────

export function useUsuariosSuperadmin(empresaId: string | undefined) {
  return useQuery({
    queryKey: ["superadmin", "usuarios", { empresa: empresaId ?? null }],
    queryFn: async () => {
      const params: Record<string, string | number> = { page_size: 200 };
      if (empresaId) params.empresa = empresaId;
      return (
        await api.get<Paginated<UsuarioSuperadmin>>("/superadmin/usuarios/", { params })
      ).data;
    },
  });
}

export function useCriarUsuarioSuperadmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: UsuarioInput) =>
      (await api.post<UsuarioSuperadmin>("/superadmin/usuarios/", dados)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["superadmin", "usuarios"] });
      void qc.invalidateQueries({ queryKey: ["superadmin", "empresas"] });
    },
  });
}

export function useAtualizarUsuarioSuperadmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<UsuarioInput> }) =>
      (await api.patch<UsuarioSuperadmin>(`/superadmin/usuarios/${id}/`, dados)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["superadmin", "usuarios"] });
    },
  });
}

export function useExcluirUsuarioSuperadmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/superadmin/usuarios/${id}/`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["superadmin", "usuarios"] });
      void qc.invalidateQueries({ queryKey: ["superadmin", "empresas"] });
    },
  });
}
