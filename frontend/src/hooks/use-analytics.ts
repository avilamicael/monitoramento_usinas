/**
 * Hooks de analytics adaptados para a API REST atual
 * (`/api/dashboard/*`). Espelha a interface dos hooks do antigo
 * (firmasolar) — `{ data, loading, error, refetch }` — para os componentes
 * de dashboard portados não precisarem mudar.
 *
 * Mapeamentos:
 * - useEnergiaResumo() → soma `qtd_inversores_total` * energia? Não:
 *   usamos `energia_hoje_kwh` do `/api/dashboard/kpis/`. Não temos
 *   "energia_total_kwh" cumulativa pronta — calculamos somando da maior
 *   `LeituraUsina.energia_total_kwh` por usina (endpoint novo a fazer)
 *   ou por enquanto reusa `energia_hoje_kwh` como proxy.
 * - useAlertasResumo() → mapeia `alertas_abertos.{critico,aviso,info}`
 *   1:1 com os 3 níveis reais do backend.
 * - useAnalyticsPotencia() → adapta `top_fabricantes` (energia_kwh por
 *   provedor) + `kpis.energia_hoje_kwh` para `PotenciaResponse`.
 * - useAnalyticsRanking() → adapta `top_fabricantes` para
 *   ranking por inversores (que não temos por provedor; usa qtd_usinas
 *   como proxy).
 * - useGeracaoDiaria() → adapta `geracao_diaria` em `GeracaoDiaria`.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AlertasResumo,
  EnergiaResumo,
  GeracaoDiaria,
  PotenciaResponse,
  RankingResponse,
} from "@/types/analytics";

const POLL_INTERVAL = 10 * 60 * 1000;

interface DashboardKpis {
  usinas: { total: number; ativas: number };
  inversores: { total: number; ativos: number };
  alertas_abertos: { total: number; critico: number; aviso: number; info: number };
  capacidade_kwp: string;
  energia_hoje_kwh: string;
  potencia_atual_kw: string;
}

interface PontoGeracao {
  dia: string;
  energia_kwh: number;
}

interface RankingFabricante {
  provedor: string;
  energia_kwh: number;
  capacidade_kwp: number;
  qtd_usinas: number;
  eficiencia_kwh_kwp: number;
}

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

interface HookShape<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function compatHook<T>(query: { data: T | undefined; isLoading: boolean; error: unknown; refetch: () => void }, errMsg: string): HookShape<T> {
  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? errMsg : null,
    refetch: () => void query.refetch(),
  };
}

// ── Energia (cards superiores) ──────────────────────────────────────────

export function useEnergiaResumo(): HookShape<EnergiaResumo> {
  const q = useQuery({
    queryKey: ["dashboard", "energia"],
    queryFn: async () => {
      // Soma energia_total_kwh da última LeituraUsina por usina.
      // Como não há endpoint dedicado, somamos via top_fabricantes
      // (energia_kwh acumulada de 7d) — proxy razoável até criarmos um.
      const top = (await api.get<RankingFabricante[]>("/dashboard/top_fabricantes/", { params: { dias: 365 } })).data;
      const total = top.reduce((sum, t) => sum + (t.energia_kwh || 0), 0);
      return { energia_total_kwh: total } satisfies EnergiaResumo;
    },
    refetchInterval: POLL_INTERVAL,
  });
  return compatHook(q, "Erro ao carregar energia total");
}

// ── Alertas resumo (cards de severidade) ────────────────────────────────

export function useAlertasResumo(): HookShape<AlertasResumo> {
  const q = useQuery({
    queryKey: ["dashboard", "alertas-resumo"],
    queryFn: async () => {
      const k = (await api.get<DashboardKpis>("/dashboard/kpis/")).data;
      return {
        critico: k.alertas_abertos.critico,
        aviso: k.alertas_abertos.aviso,
        info: k.alertas_abertos.info,
      } satisfies AlertasResumo;
    },
    refetchInterval: POLL_INTERVAL,
  });
  return compatHook(q, "Erro ao carregar alertas");
}

// ── Potência por provedor (pizza + agregados) ───────────────────────────

export function useAnalyticsPotencia(): HookShape<PotenciaResponse> {
  const q = useQuery({
    queryKey: ["dashboard", "potencia"],
    queryFn: async () => {
      const [kpis, top] = await Promise.all([
        api.get<DashboardKpis>("/dashboard/kpis/").then((r) => r.data),
        api.get<RankingFabricante[]>("/dashboard/top_fabricantes/", { params: { dias: 1 } }).then((r) => r.data),
      ]);
      const energiaHoje = num(kpis.energia_hoje_kwh);
      const capTotal = num(kpis.capacidade_kwp);
      return {
        energia_hoje_geral_kwh: energiaHoje,
        kwh_por_kwp_geral: capTotal > 0 ? energiaHoje / capTotal : 0,
        por_provedor: top.map((t) => ({
          provedor: t.provedor,
          energia_hoje_kwh: t.energia_kwh,
        })),
      } satisfies PotenciaResponse;
    },
    refetchInterval: POLL_INTERVAL,
  });
  return compatHook(q, "Erro ao carregar dados de potencia");
}

// ── Ranking de fabricantes ──────────────────────────────────────────────

export function useAnalyticsRanking(): HookShape<RankingResponse> {
  const q = useQuery({
    queryKey: ["dashboard", "ranking"],
    queryFn: async () => {
      const top = (await api.get<RankingFabricante[]>("/dashboard/top_fabricantes/", { params: { dias: 7 } })).data;
      return {
        ranking: top
          .sort((a, b) => b.qtd_usinas - a.qtd_usinas)
          .map((t) => ({ provedor: t.provedor, inversores_ativos: t.qtd_usinas })),
      } satisfies RankingResponse;
    },
    refetchInterval: POLL_INTERVAL,
  });
  return compatHook(q, "Erro ao carregar ranking de fabricantes");
}

// ── Geração diária (área chart) ─────────────────────────────────────────

export function useGeracaoDiaria(dias = 30): HookShape<GeracaoDiaria> {
  const q = useQuery({
    queryKey: ["dashboard", "geracao-diaria", dias],
    queryFn: async () => {
      const pontos = (await api.get<PontoGeracao[]>("/dashboard/geracao_diaria/", { params: { dias } })).data;
      return {
        geracao: pontos.map((p) => ({
          dia: p.dia,
          energia_kwh: num(p.energia_kwh),
          usinas_coletadas: 0, // não temos por dia ainda; placeholder
        })),
      } satisfies GeracaoDiaria;
    },
    refetchInterval: POLL_INTERVAL,
  });
  return compatHook(q, "Erro ao carregar geração diária");
}
