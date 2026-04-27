/**
 * Hooks de configuração da empresa — endpoint singleton.
 *
 * Consome `GET/PATCH /api/configuracoes/` (sem ID) — backend resolve a
 * empresa pelo `request.user.empresa` e usa `get_or_create` para devolver
 * defaults quando ainda não existe configuração persistida.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ConfiguracaoEmpresa } from "@/lib/types";

const QUERY_KEY = ["configuracoes"] as const;

export function useConfiguracaoEmpresa() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await api.get<ConfiguracaoEmpresa>("/configuracoes/");
      return res.data;
    },
  });
}

export function useAtualizarConfiguracao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: Partial<ConfiguracaoEmpresa>) => {
      const res = await api.patch<ConfiguracaoEmpresa>("/configuracoes/", dados);
      return res.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(QUERY_KEY, data);
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
