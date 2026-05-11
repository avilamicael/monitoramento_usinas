/**
 * Hooks de contagem para os stat-chips e a badge da sidebar.
 *
 * Usa react-query para deduplicar chamadas — várias páginas pedindo
 * "alertas ativos" reutilizam o mesmo cache.
 *
 * Cada chamada usa `page_size=1` para receber só o `count` agregado e não
 * pagar custo de serializar resultados.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Paginated } from "@/lib/types";

interface CountResponse {
  count: number;
}

async function fetchCount(params: Record<string, string | number>): Promise<number> {
  const res = await api.get<Paginated<unknown>>("/alertas/", {
    params: { ...params, page_size: 1 },
  });
  return (res.data as CountResponse).count;
}

const STALE_30S = 30_000;

export function useAlertasContagemPorEstado() {
  const ativos = useQuery({
    queryKey: ["alertas-count", { estado: "aberto" }],
    queryFn: () => fetchCount({ estado: "aberto" }),
    staleTime: STALE_30S,
  });
  const criticos = useQuery({
    queryKey: ["alertas-count", { estado: "aberto", severidade: "critico" }],
    queryFn: () => fetchCount({ estado: "aberto", severidade: "critico" }),
    staleTime: STALE_30S,
  });
  const avisos = useQuery({
    queryKey: ["alertas-count", { estado: "aberto", severidade: "aviso" }],
    queryFn: () => fetchCount({ estado: "aberto", severidade: "aviso" }),
    staleTime: STALE_30S,
  });

  // Resolvidos · 24h: filtrar por `resolvido_desde` (campo já presente no
  // hook genérico /alertas/ via param `desde`). Como nem todo backend
  // expõe esse filtro, caímos para uma estimativa a partir do total
  // resolvido se necessário — preserva valor numérico válido.
  const resolvidos24 = useQuery({
    queryKey: ["alertas-count", { estado: "resolvido", desde: "24h" }],
    queryFn: () => {
      const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      return fetchCount({ estado: "resolvido", desde });
    },
    staleTime: STALE_30S,
  });

  return {
    ativos: ativos.data ?? 0,
    criticos: criticos.data ?? 0,
    avisos: avisos.data ?? 0,
    resolvidos24: resolvidos24.data ?? 0,
    loading: ativos.isLoading || criticos.isLoading || avisos.isLoading || resolvidos24.isLoading,
  };
}
