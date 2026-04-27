import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Garantia, Paginated } from "@/lib/types";

export interface FiltrosGarantias {
  page?: number;
  search?: string;
  provedor?: string;
  status?: string;
  ordering?: string;
}

export function useGarantias(filtros: FiltrosGarantias) {
  return useQuery({
    queryKey: ["garantias", filtros],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      Object.entries(filtros).forEach(([k, v]) => {
        if (v !== undefined && v !== "") params[k] = v as string | number;
      });
      const res = await api.get<Paginated<Garantia>>("/garantia/", { params });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useCriarGarantia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: { usina: number; inicio_em: string; meses: number; fornecedor?: string; observacoes?: string }) =>
      (await api.post<Garantia>("/garantia/", dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["garantias"] }),
  });
}

export function useAtualizarGarantia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<Garantia> }) =>
      (await api.patch<Garantia>(`/garantia/${id}/`, dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["garantias"] }),
  });
}
