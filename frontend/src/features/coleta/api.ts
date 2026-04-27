import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LogColeta, Paginated } from "@/lib/types";

export interface FiltrosLogColeta {
  page?: number;
  conta_provedor?: number;
  provedor?: string;
  status?: string;
  desde?: string;
  ate?: string;
}

export function useLogsColeta(filtros: FiltrosLogColeta = {}) {
  return useQuery({
    queryKey: ["coleta", "logs", filtros],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      Object.entries(filtros).forEach(([k, v]) => {
        if (v !== undefined && v !== "") params[k] = v as string | number;
      });
      const res = await api.get<Paginated<LogColeta>>("/coleta/logs/", { params });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });
}
