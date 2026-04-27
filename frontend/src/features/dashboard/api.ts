import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Alerta,
  DashboardKpis,
  PontoGeracaoDiaria,
  RankingFabricante,
} from "@/lib/types";

export function useDashboardKpis() {
  return useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: async () => (await api.get<DashboardKpis>("/dashboard/kpis/")).data,
    refetchInterval: 60_000,
  });
}

export function useGeracaoDiaria(dias = 30) {
  return useQuery({
    queryKey: ["dashboard", "geracao_diaria", dias],
    queryFn: async () =>
      (await api.get<PontoGeracaoDiaria[]>("/dashboard/geracao_diaria/", { params: { dias } })).data,
  });
}

export function useTopFabricantes(dias = 7) {
  return useQuery({
    queryKey: ["dashboard", "top_fabricantes", dias],
    queryFn: async () =>
      (await api.get<RankingFabricante[]>("/dashboard/top_fabricantes/", { params: { dias } })).data,
  });
}

export function useAlertasCriticos(limite = 10) {
  return useQuery({
    queryKey: ["dashboard", "alertas_criticos", limite],
    queryFn: async () =>
      (await api.get<Alerta[]>("/dashboard/alertas_criticos/", { params: { limite } })).data,
    refetchInterval: 60_000,
  });
}
