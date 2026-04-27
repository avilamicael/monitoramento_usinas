/**
 * Tipos de configuração no formato esperado pela UI antiga (firmasolar).
 *
 * Adapter sobre o backend novo (`core.ConfiguracaoEmpresa`):
 * - Os 4 campos antigos correspondem a:
 *   - `dias_sem_comunicacao_pausar` (DIAS) ↔ `alerta_sem_comunicacao_minutos` (MINUTOS, 1d=1440min)
 *   - `meses_garantia_padrao` ↔ `garantia_padrao_meses`
 *   - `dias_aviso_garantia_proxima` ↔ `garantia_aviso_dias`
 *   - `dias_aviso_garantia_urgente` ↔ `garantia_critico_dias`
 * - Os campos novos abaixo (regras de alerta) são opcionais e usados pela
 *   seção estendida da página de configurações.
 */
export interface ConfiguracaoSistema {
  // ID da configuração no backend novo (precisamos para o PATCH)
  id?: number
  // Mapeados do backend novo
  dias_sem_comunicacao_pausar: number
  meses_garantia_padrao: number
  dias_aviso_garantia_proxima: number
  dias_aviso_garantia_urgente: number
  atualizado_em: string
  // Campos novos opcionais (regras de alerta) — formato decimal vem como string da API
  subdesempenho_limite_pct?: string | number
  queda_rendimento_pct?: string | number
  temperatura_limite_c?: string | number
  potencia_minima_avaliacao_kw?: string | number
  inversor_offline_coletas_minimas?: number
  sem_geracao_queda_abrupta_pct?: string | number
  retencao_leituras_dias?: number
  alerta_dado_ausente_coletas?: number
  horario_solar_inicio?: string
  horario_solar_fim?: string
}

export type ConfiguracaoSistemaUpdate = Partial<Omit<ConfiguracaoSistema, 'atualizado_em' | 'id'>>
