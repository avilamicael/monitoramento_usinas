import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ContaProvedor, ContaProvedorInput, Paginated } from "@/lib/types";

export function useProvedores() {
  return useQuery({
    queryKey: ["provedores"],
    queryFn: async () =>
      (await api.get<Paginated<ContaProvedor>>("/provedores/", { params: { page_size: 100 } })).data,
  });
}

export function useCriarProvedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: ContaProvedorInput) =>
      (await api.post<ContaProvedor>("/provedores/", dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["provedores"] }),
  });
}

export function useAtualizarProvedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<ContaProvedorInput> }) =>
      (await api.patch<ContaProvedor>(`/provedores/${id}/`, dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["provedores"] }),
  });
}

export function useExcluirProvedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/provedores/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["provedores"] }),
  });
}

export function useColetarAgora() {
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<{ task_id: string; conta_id: string }>(`/provedores/${id}/coletar_agora/`)).data,
  });
}
