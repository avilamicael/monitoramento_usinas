/**
 * Tipos de alertas — espelho do antigo
 * (`firmasolar/frontend/admin/src/types/alertas.ts`).
 *
 * As interfaces refletem a forma esperada pelos componentes portados; o
 * adapter em `hooks/use-alertas.ts` converte o `Alerta` da nossa API
 * (em `lib/types.ts`) para `AlertaResumo`/`AlertaDetalhe`.
 */

export type EstadoAlerta = "ativo" | "resolvido"
export type NivelAlerta = "info" | "aviso" | "importante" | "critico"
export type OrigemAlerta = "provedor" | "interno"
export type CategoriaAlerta =
  | "tensao_zero"
  | "sobretensao"
  | "corrente_baixa"
  | "sem_geracao_diurna"
  | "sem_comunicacao"
  | "geracao_abaixo"
  | "geracao_acima"
  | "temperatura_alta"
  | "garantia_expirando"
  | "outro"

export interface AlertaResumo {
  id: string
  usina: string
  usina_nome: string
  usina_provedor: string
  usina_id_provedor: string
  origem: OrigemAlerta
  categoria: string
  categoria_efetiva: string
  mensagem: string
  nivel: NivelAlerta
  estado: EstadoAlerta
  inicio: string
  fim: string | null
  com_garantia: boolean
  criado_em: string
  atualizado_em: string
}

export interface AlertaDetalhe extends AlertaResumo {
  catalogo_alarme: number | null
  id_alerta_provedor: string
  equipamento_sn: string
  sugestao: string
  anotacoes: string
}

export interface AlertaPatch {
  estado?: EstadoAlerta
  anotacoes?: string
}

export interface PaginatedAlertas {
  count: number
  next: string | null
  previous: string | null
  results: AlertaResumo[]
}

// Compat com nome antigo usado por `AlertasPage` (espelha PaginatedAlertas).
export interface AlertasListResponse {
  count: number
  next?: string | null
  previous?: string | null
  results: AlertaResumo[]
}

// Labels centralizados. Inclui:
// - regras do motor de alertas interno (Alerta.regra) — fonte primária
// - categorias do catálogo legado / fallback de alertas do provedor
export const CATEGORIA_LABELS: Record<string, string> = {
  // Regras do motor (apps/alertas/regras/*)
  sobretensao_ac: "Sobretensão AC",
  subtensao_ac: "Subtensão AC",
  frequencia_anomala: "Frequência anômala",
  temperatura_alta: "Temperatura alta",
  inversor_offline: "Inversor offline",
  string_mppt_zerada: "String MPPT zerada",
  dado_eletrico_ausente: "Dado elétrico ausente",
  sem_comunicacao: "Sem comunicação",
  sem_geracao_horario_solar: "Sem geração em horário solar",
  subdesempenho: "Subdesempenho",
  queda_rendimento: "Queda de rendimento",
  garantia_vencendo: "Garantia vencendo",

  // Compat / catálogo legado
  tensao_zero: "Tensão zero",
  sobretensao: "Sobretensão",
  corrente_baixa: "Corrente baixa",
  sem_geracao_diurna: "Sem geração (dia)",
  geracao_abaixo: "Geração abaixo",
  geracao_acima: "Geração acima",
  garantia_expirando: "Garantia expirando",
  outro: "Outro",
  equipamento: "Equipamento",
  comunicacao: "Comunicação",
  rede_eletrica: "Rede elétrica",
  sistema_desligado: "Sistema desligado",
  preventivo: "Preventivo",
}
