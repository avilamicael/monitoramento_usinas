import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { EndpointWebhook, EntregaNotificacao, Paginated, RegraNotificacao } from "@/lib/types";

export function useRegrasNotificacao() {
  return useQuery({
    queryKey: ["notificacoes", "regras"],
    queryFn: async () =>
      (await api.get<Paginated<RegraNotificacao>>("/notificacoes/regras/", { params: { page_size: 100 } })).data,
  });
}

export function useCriarRegraNotificacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: Omit<RegraNotificacao, "id" | "created_at">) =>
      (await api.post<RegraNotificacao>("/notificacoes/regras/", dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes", "regras"] }),
  });
}

export function useAtualizarRegraNotificacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<RegraNotificacao> }) =>
      (await api.patch<RegraNotificacao>(`/notificacoes/regras/${id}/`, dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes", "regras"] }),
  });
}

export function useExcluirRegraNotificacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/notificacoes/regras/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes", "regras"] }),
  });
}

export function useEntregasNotificacao(params: { page?: number; status?: string } = {}) {
  return useQuery({
    queryKey: ["notificacoes", "entregas", params],
    queryFn: async () =>
      (await api.get<Paginated<EntregaNotificacao>>("/notificacoes/entregas/", { params })).data,
  });
}

export function useWebhooks() {
  return useQuery({
    queryKey: ["notificacoes", "webhooks"],
    queryFn: async () =>
      (await api.get<Paginated<EndpointWebhook>>("/notificacoes/webhooks/", { params: { page_size: 100 } })).data,
  });
}
