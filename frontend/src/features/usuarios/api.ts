import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Paginated, UsuarioCompleto } from "@/lib/types";

export function useUsuarios() {
  return useQuery({
    queryKey: ["usuarios"],
    queryFn: async () =>
      (await api.get<Paginated<UsuarioCompleto>>("/usuarios/", { params: { page_size: 100 } })).data,
  });
}

export interface UsuarioInput {
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  telefone?: string;
  papel: "administrador" | "operacional";
  password?: string;
  is_active?: boolean;
}

export function useCriarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: UsuarioInput) =>
      (await api.post<UsuarioCompleto>("/usuarios/", dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });
}

export function useAtualizarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<UsuarioInput> }) =>
      (await api.patch<UsuarioCompleto>(`/usuarios/${id}/`, dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });
}

export function useExcluirUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/usuarios/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });
}
