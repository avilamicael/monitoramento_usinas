import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ConfiguracaoEmpresa, Paginated } from "@/lib/types";

export function useConfiguracao() {
  return useQuery({
    queryKey: ["configuracao"],
    queryFn: async () => {
      const res = await api.get<Paginated<ConfiguracaoEmpresa>>("/configuracao/");
      // singleton — sempre 1 resultado
      return res.data.results[0] ?? null;
    },
  });
}

export function useAtualizarConfiguracao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: number; dados: Partial<ConfiguracaoEmpresa> }) =>
      (await api.patch<ConfiguracaoEmpresa>(`/configuracao/${id}/`, dados)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["configuracao"] }),
  });
}
