import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Alerta, Paginated } from "@/lib/types";

export interface FiltrosAlertas {
  page?: number;
  search?: string;
  estado?: string;
  severidade?: string;
  regra?: string;
  usina?: number;
  inversor?: number;
  provedor?: string;
  desde?: string;
  ate?: string;
  ordering?: string;
}

export function useAlertas(filtros: FiltrosAlertas) {
  return useQuery({
    queryKey: ["alertas", filtros],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      Object.entries(filtros).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") params[k] = v as string | number;
      });
      const res = await api.get<Paginated<Alerta>>("/alertas/", { params });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useAlerta(id: string | number | undefined) {
  return useQuery({
    queryKey: ["alerta", id],
    queryFn: async () => (await api.get<Alerta>(`/alertas/${id}/`)).data,
    enabled: id != null,
  });
}

export function useResolverAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.post<Alerta>(`/alertas/${id}/resolver/`)).data,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["alertas"] });
      qc.setQueryData(["alerta", String(data.id)], data);
    },
  });
}

export function useReconhecerAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.post<Alerta>(`/alertas/${id}/reconhecer/`)).data,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["alertas"] });
      qc.setQueryData(["alerta", String(data.id)], data);
    },
  });
}
