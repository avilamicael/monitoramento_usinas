/**
 * Hook adapter de alertas — espelha a interface do antigo
 * (`{ data: { results }, loading, error, refetch }`) consumindo
 * `/api/alertas/`. Mapeia severidade/estado da nossa API para nivel/estado
 * do antigo.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Alerta, Paginated } from "@/lib/types";
import type { AlertaResumo, AlertasListResponse, NivelAlerta } from "@/types/alertas";

interface FiltroAntigo {
  estado?: "ativo" | "resolvido" | "ignorado";
  nivel?: NivelAlerta;
  page?: number;
}

function mapEstado(antigo?: string): string | undefined {
  // antigo: ativo/resolvido/ignorado → novo: aberto/resolvido/reconhecido
  if (antigo === "ativo") return "aberto";
  if (antigo === "resolvido") return "resolvido";
  if (antigo === "ignorado") return "reconhecido";
  return undefined;
}

function mapNivel(antigo?: string): string | undefined {
  // antigo: critico/importante/aviso/info → novo: critico/aviso/info
  if (antigo === "critico") return "critico";
  if (antigo === "importante" || antigo === "aviso") return "aviso";
  if (antigo === "info") return "info";
  return undefined;
}

function paraResumo(a: Alerta): AlertaResumo {
  return {
    id: String(a.id),
    usina_nome: a.usina_nome,
    mensagem: a.mensagem,
    estado: a.estado === "aberto" ? "ativo" : a.estado === "reconhecido" ? "ignorado" : "resolvido",
    nivel: a.severidade,
    inicio: a.aberto_em,
    fim: a.resolvido_em,
  };
}

interface HookShape {
  data: AlertasListResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAlertas(filtros: FiltroAntigo = {}): HookShape {
  const q = useQuery({
    queryKey: ["alertas-resumo", filtros],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      const estado = mapEstado(filtros.estado);
      const severidade = mapNivel(filtros.nivel);
      if (estado) params.estado = estado;
      if (severidade) params.severidade = severidade;
      if (filtros.page) params.page = filtros.page;
      params.page_size = 25;
      const res = await api.get<Paginated<Alerta>>("/alertas/", { params });
      return {
        count: res.data.count,
        results: res.data.results.map(paraResumo),
      } satisfies AlertasListResponse;
    },
  });
  return {
    data: q.data ?? null,
    loading: q.isLoading,
    error: q.error ? "Erro ao carregar alertas" : null,
    refetch: () => void q.refetch(),
  };
}
