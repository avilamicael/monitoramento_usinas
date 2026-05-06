/**
 * Configuração de regras do motor de alertas, por empresa.
 *
 * Backend: `/api/alertas/configuracao-regras/` (ver
 * `docs/configuracao-regras/api.md`).
 *
 * O GET sempre retorna 12 linhas — uma por regra registrada — mesclando
 * defaults do código com os overrides salvos pela empresa logada.
 */
import type { NivelAlerta } from "@/types/alertas";

export interface ConfiguracaoRegra {
  /** Identificador interno da regra (ex.: "sobretensao_ac"). */
  regra_nome: string;
  /** Se a regra é avaliada pelo motor para esta empresa. */
  ativa: boolean;
  /** Severidade efetiva (override ou default da regra). */
  severidade: NivelAlerta;
  /** True quando não há override — usando defaults do código. */
  is_default: boolean;
  /** Severidade default fixada no código da regra. */
  severidade_default: NivelAlerta;
  /** Estado ativo default (sempre `true` no MVP). */
  ativa_default: boolean;
  /** Descrição curta vinda do docstring da regra. */
  descricao: string;
  /**
   * Quando `true`, a regra escala severidade internamente e a UI deve
   * desabilitar o select. Casos atuais: `sem_comunicacao`, `garantia_vencendo`.
   */
  severidade_dinamica: boolean;
  /** ISO datetime do último update do override, ou `null` se nunca configurada. */
  configurada_em: string | null;
}

/**
 * Payload aceito pelo `PUT /api/alertas/configuracao-regras/<regra_nome>/`.
 *
 * Em regras com `severidade_dinamica: true`, o backend ignora a `severidade`
 * mas o campo continua obrigatório no contrato — a UI envia o valor atual
 * para manter consistência.
 */
export interface ConfiguracaoRegraPayload {
  ativa: boolean;
  severidade: NivelAlerta;
}
