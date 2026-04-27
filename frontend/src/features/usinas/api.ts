import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Inversor,
  Paginated,
  Usina,
  UsinaResumo,
} from "@/lib/types";

export interface FiltrosUsinas {
  page?: number;
  search?: string;
  provedor?: string;
  status_garantia?: string;
  is_active?: boolean | "";
  ordering?: string;
}

export function useUsinas(filtros: FiltrosUsinas) {
  return useQuery({
    queryKey: ["usinas", filtros],
    queryFn: async () => {
      const params: Record<string, string | number | boolean> = {};
      if (filtros.page) params.page = filtros.page;
      if (filtros.search) params.search = filtros.search;
      if (filtros.provedor) params.provedor = filtros.provedor;
      if (filtros.status_garantia) params.status_garantia = filtros.status_garantia;
      if (filtros.is_active !== undefined && filtros.is_active !== "")
        params.is_active = filtros.is_active;
      if (filtros.ordering) params.ordering = filtros.ordering;
      const res = await api.get<Paginated<UsinaResumo>>("/usinas/", { params });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useUsina(id: string | number | undefined) {
  return useQuery({
    queryKey: ["usina", id],
    queryFn: async () => (await api.get<Usina>(`/usinas/${id}/`)).data,
    enabled: id != null,
  });
}

export function useInversoresDaUsina(usinaId: string | number | undefined) {
  return useQuery({
    queryKey: ["inversores", { usina: usinaId }],
    queryFn: async () => {
      const res = await api.get<Paginated<Inversor>>("/inversores/", {
        params: { usina: usinaId, page_size: 100 },
      });
      return res.data.results;
    },
    enabled: usinaId != null,
  });
}

export function useAtualizarUsina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<Usina> }) => {
      const res = await api.patch<Usina>(`/usinas/${id}/`, dados);
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["usinas"] });
      qc.setQueryData(["usina", String(data.id)], data);
    },
  });
}

export function useToggleAtivaUsina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativar }: { id: number; ativar: boolean }) => {
      const action = ativar ? "ativar" : "desativar";
      const res = await api.post<{ is_active: boolean }>(`/usinas/${id}/${action}/`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usinas"] });
      qc.invalidateQueries({ queryKey: ["usina"] });
    },
  });
}
