/**
 * Tipos de analytics — espelho de
 * `firmasolar/frontend/admin/src/types/analytics.ts`.
 *
 * Os componentes de dashboard portados consomem essas formas de dado.
 * Os hooks em `features/dashboard/api.ts` adaptam nossa API REST atual
 * (que usa formato diferente) para esses tipos.
 */

export interface EnergiaResumo {
  energia_total_kwh: number;
}

export interface AlertasResumo {
  critico: number;
  aviso: number;
  info: number;
}

export interface ProvedorPotencia {
  provedor: string;
  energia_hoje_kwh: number;
}

export interface PotenciaResponse {
  energia_hoje_geral_kwh: number;
  kwh_por_kwp_geral: number;
  por_provedor: ProvedorPotencia[];
}

export interface ProvedorRanking {
  provedor: string;
  inversores_ativos: number;
}

export interface RankingResponse {
  ranking: ProvedorRanking[];
}

export interface MapaUsina {
  id: number;
  nome: string;
  latitude: number;
  longitude: number;
  status: string;
}

export interface GeracaoDiariaItem {
  dia: string;
  energia_kwh: number;
  usinas_coletadas: number;
}

export interface GeracaoDiaria {
  geracao: GeracaoDiariaItem[];
}
