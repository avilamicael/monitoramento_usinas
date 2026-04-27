/**
 * Tipos do domínio Provedor (formato compatível com componentes
 * portados do firmasolar antigo). O hook `use-provedores.ts` faz a
 * adaptação a partir dos payloads da API atual (`/provedores/` e
 * `/coleta/logs/`).
 *
 * Mapeamento API → tipo antigo:
 *   - `tipo` → `provedor`
 *   - `tipo_label` → `provedor_display`
 *   - `is_active` → `ativo`
 *   - `ultima_coleta` é montada a partir do último `/coleta/logs/`
 *   - `usa_token_manual` é derivado do `tipo` (solis e foxess são stateless)
 *   - `token_status` é derivado de `cache_token_expira_em`
 *   - meta de provedores é hardcoded (a API não expõe endpoint /meta/)
 */

export interface UltimaColeta {
  status: 'sucesso' | 'parcial' | 'erro' | 'auth_erro'
  usinas_coletadas: number
  inversores_coletados: number
  alertas_sincronizados: number
  duracao_ms: number
  iniciado_em: string
  detalhe_erro: string
}

export interface TokenStatus {
  configurado: boolean
  expira_em?: string | null
  dias_restantes?: number | null
  erro?: string
}

export interface CredencialProvedor {
  id: string
  provedor: string
  provedor_display: string
  rotulo: string
  ativo: boolean
  precisa_atencao: boolean
  intervalo_coleta_minutos: number
  credenciais_preview: Record<string, string> | null
  token_status: TokenStatus | null
  usa_token_manual: boolean
  ultima_coleta: UltimaColeta | null
  criado_em: string
  atualizado_em: string
}

export interface CampoProvedor {
  chave: string
  label: string
  tipo: 'texto' | 'senha'
}

export interface ProvedorMeta {
  valor: string
  label: string
  campos: CampoProvedor[]
  usa_token_manual: boolean
}

export interface ProvedoresMetaResponse {
  provedores: ProvedorMeta[]
  intervalo_minimo_minutos: number
}

export interface CredencialWritePayload {
  provedor?: string
  rotulo?: string
  ativo?: boolean
  precisa_atencao?: boolean
  intervalo_coleta_minutos?: number
  credenciais?: Record<string, string>
  token_jwt?: string
}
