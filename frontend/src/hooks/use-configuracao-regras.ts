/**
 * Hooks de configuração de regras do motor de alertas.
 *
 * Backend: ver `docs/configuracao-regras/api.md`.
 *
 * - `useConfiguracaoRegras`        — GET    /api/alertas/configuracao-regras/
 * - `useAtualizarConfiguracaoRegra` — PUT    /api/alertas/configuracao-regras/<regra_nome>/
 * - `useResetarConfiguracaoRegra`   — DELETE /api/alertas/configuracao-regras/<regra_nome>/
 * - `useResetarTodasConfiguracoes`  — POST   /api/alertas/configuracao-regras/reset-todos/
 *
 * Todas as mutations invalidam a query `["configuracao-regras"]`
 * (única chave usada nesse domínio) para que a página re-renderize com
 * os novos defaults.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  ConfiguracaoRegra,
  ConfiguracaoRegraPayload,
} from "@/types/configuracao-regras";

const QUERY_KEY = ["configuracao-regras"] as const;
const ENDPOINT_BASE = "/alertas/configuracao-regras/";

interface ListaResposta {
  results: ConfiguracaoRegra[];
}

/**
 * Extrai mensagem amigável de um erro do axios. Especializa o 403 com
 * texto sobre permissão, padrão estabelecido em `use-notificacoes-config`.
 */
export function extrairErroConfiguracaoRegra(err: unknown, fallback: string): string {
  const e = err as { response?: { status?: number; data?: unknown } };
  if (e?.response?.status === 403) {
    return "Apenas administradores podem editar regras.";
  }
  const data = e?.response?.data;
  if (data && typeof data === "object") {
    const detail = (data as Record<string, unknown>).detail;
    if (typeof detail === "string") return detail;
    const partes = Object.entries(data as Record<string, unknown>).map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: ${v.join(" ")}`;
      return `${k}: ${String(v)}`;
    });
    if (partes.length) return partes.join("\n");
  }
  return fallback;
}

export function useConfiguracaoRegras() {
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const resp = await api.get<ListaResposta>(ENDPOINT_BASE);
      return resp.data.results;
    },
  });

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error
      ? extrairErroConfiguracaoRegra(query.error, "Erro ao carregar configuração de regras.")
      : null,
    refetch: () => void query.refetch(),
  };
}

export function useAtualizarConfiguracaoRegra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      regra_nome,
      payload,
    }: {
      regra_nome: string;
      payload: ConfiguracaoRegraPayload;
    }) => {
      const resp = await api.put<ConfiguracaoRegra>(`${ENDPOINT_BASE}${regra_nome}/`, payload);
      return resp.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useResetarConfiguracaoRegra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (regra_nome: string) => {
      await api.delete(`${ENDPOINT_BASE}${regra_nome}/`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useResetarTodasConfiguracoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post(`${ENDPOINT_BASE}reset-todos/`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
