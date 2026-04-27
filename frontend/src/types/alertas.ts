/**
 * Tipos de alertas — espelho de
 * `firmasolar/frontend/admin/src/types/alertas.ts` (versão simplificada).
 *
 * Os hooks adaptam o `Alerta` da nossa API (em `lib/types.ts`) para o
 * `AlertaResumo` esperado pelos componentes portados.
 */

export type NivelAlerta = "critico" | "importante" | "aviso" | "info";
export type EstadoAlertaAntigo = "ativo" | "resolvido" | "ignorado";

export interface AlertaResumo {
  id: string;
  usina_nome: string;
  mensagem: string;
  estado: string;
  nivel: NivelAlerta | string;
  inicio: string;
  fim: string | null;
}

export interface AlertasListResponse {
  count: number;
  results: AlertaResumo[];
}
