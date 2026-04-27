// Tipos das entidades expostas pela API. Mantém-se em sincronia com os
// serializers em backend/apps/<app>/serializers.py.

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type Severidade = "info" | "aviso" | "critico";
export type EstadoAlerta = "aberto" | "reconhecido" | "resolvido";
export type TipoProvedor = "solis" | "hoymiles" | "fusionsolar" | "solarman" | "auxsol" | "foxess";
export type StatusGarantia = "ativa" | "vencida" | "sem_garantia";
export type EstadoLeitura = "online" | "offline" | "alerta" | "construcao";
export type StatusSincronizacao = "sucesso" | "parcial" | "erro" | "auth_erro" | "";
export type CanalNotificacao = "web" | "email" | "webhook" | "whatsapp";

// ── Usinas / Inversores ──────────────────────────────────────────────────

export interface UsinaResumo {
  id: number;
  nome: string;
  id_externo: string;
  cidade: string;
  estado: string;
  capacidade_kwp: string | null;
  tipo_equipamento: string;
  expoe_dados_inversor: boolean;
  provedor_tipo: TipoProvedor | null;
  provedor_rotulo: string | null;
  conta_provedor: number;
  is_active: boolean;
  ultima_leitura_em: string | null;
  status_garantia: StatusGarantia;
  qtd_inversores: number;
  qtd_alertas_abertos: number;
}

export interface Usina {
  id: number;
  nome: string;
  id_externo: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  latitude: string | null;
  longitude: string | null;
  fuso_horario: string;
  capacidade_kwp: string | null;
  comissionada_em: string | null;
  tipo_equipamento: string;
  expoe_dados_inversor: boolean;
  tensao_ac_limite_v: string;
  tensao_ac_limite_minimo_v: string;
  frequencia_minimo_hz: string;
  frequencia_maximo_hz: string;
  provedor_tipo: TipoProvedor | null;
  provedor_rotulo: string | null;
  conta_provedor: number;
  is_active: boolean;
  ultima_leitura_em: string | null;
  status_garantia: StatusGarantia;
  created_at: string;
  updated_at: string;
}

export interface Inversor {
  id: number;
  usina: number;
  usina_nome: string;
  id_externo: string;
  numero_serie: string;
  modelo: string;
  tipo: "inversor" | "microinversor";
  potencia_nominal_kw: string | null;
  qtd_mppts_esperados: number | null;
  temperatura_limite_c: string | null;
  is_active: boolean;
  ultima_leitura_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeituraUsina {
  id: number;
  usina: number;
  usina_nome: string;
  coletado_em: string;
  medido_em: string | null;
  potencia_kw: string;
  energia_hoje_kwh: string;
  energia_mes_kwh: string | null;
  energia_total_kwh: string;
  status: EstadoLeitura;
  qtd_inversores_total: number | null;
  qtd_inversores_online: number | null;
}

export interface LeituraInversor {
  id: number;
  usina: number;
  usina_nome: string;
  inversor: number;
  inversor_serie: string;
  coletado_em: string;
  medido_em: string | null;
  estado: EstadoLeitura;
  pac_kw: string;
  energia_hoje_kwh: string;
  energia_total_kwh: string;
  tensao_ac_v: string | null;
  corrente_ac_a: string | null;
  frequencia_hz: string | null;
  tensao_dc_v: string | null;
  corrente_dc_a: string | null;
  temperatura_c: string | null;
  soc_bateria_pct: string | null;
  strings_mppt: unknown;
}

// ── Alertas ──────────────────────────────────────────────────────────────

export interface Alerta {
  id: number;
  usina: number;
  usina_nome: string;
  inversor: number | null;
  inversor_serie: string | null;
  regra: string;
  severidade: Severidade;
  estado: EstadoAlerta;
  mensagem: string;
  contexto: Record<string, unknown>;
  aberto_em: string;
  resolvido_em: string | null;
  atualizado_em: string;
}

// ── Provedores ───────────────────────────────────────────────────────────

export interface ContaProvedor {
  id: number;
  tipo: TipoProvedor;
  tipo_label: string;
  rotulo: string;
  intervalo_coleta_minutos: number;
  is_active: boolean;
  precisa_atencao: boolean;
  ultima_sincronizacao_em: string | null;
  ultima_sincronizacao_status: StatusSincronizacao;
  ultima_sincronizacao_erro: string;
  cache_token_expira_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContaProvedorInput {
  tipo: TipoProvedor;
  rotulo: string;
  credenciais: Record<string, string>;
  intervalo_coleta_minutos?: number;
  is_active?: boolean;
}

// ── Coleta ───────────────────────────────────────────────────────────────

export interface LogColeta {
  id: number;
  conta_provedor: number;
  conta_provedor_tipo: TipoProvedor;
  conta_provedor_rotulo: string;
  status: StatusSincronizacao;
  qtd_usinas: number;
  qtd_inversores: number;
  qtd_leituras_usina: number;
  qtd_leituras_inversor: number;
  qtd_alertas_abertos: number;
  qtd_alertas_resolvidos: number;
  detalhe_erro: string;
  duracao_ms: number;
  iniciado_em: string;
  finalizado_em: string | null;
}

// ── Garantia ─────────────────────────────────────────────────────────────

export interface Garantia {
  id: number;
  usina: number;
  usina_nome: string;
  inicio_em: string;
  meses: number;
  fim_em: string;
  is_active: boolean;
  dias_restantes: number;
  fornecedor: string;
  observacoes: string;
  created_at: string;
  updated_at: string;
}

// ── Notificações ─────────────────────────────────────────────────────────

export interface RegraNotificacao {
  id: number;
  nome: string;
  canal: CanalNotificacao;
  severidades: Severidade[];
  tipos_alerta: string[];
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface EntregaNotificacao {
  id: number;
  regra: number | null;
  regra_nome: string | null;
  alerta: number;
  alerta_regra: string;
  alerta_usina_nome: string;
  canal: CanalNotificacao;
  destino: string;
  status: string;
  tentativas: number;
  ultimo_erro: string;
  enviado_em: string | null;
  created_at: string;
}

export interface EndpointWebhook {
  id: number;
  url: string;
  tipos_evento: string[];
  is_active: boolean;
  created_at: string;
}

// ── Usuários ─────────────────────────────────────────────────────────────

export interface UsuarioCompleto {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  telefone: string;
  papel: "administrador" | "operacional";
  empresa: string;
  empresa_nome: string;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
}

// ── Configuração ─────────────────────────────────────────────────────────

export interface ConfiguracaoEmpresa {
  id: number;
  empresa: string;
  garantia_padrao_meses: number;
  garantia_aviso_dias: number;
  garantia_critico_dias: number;
  horario_solar_inicio: string; // HH:MM:SS
  horario_solar_fim: string;
  alerta_sem_comunicacao_minutos: number;
  alerta_dado_ausente_coletas: number;
  subdesempenho_limite_pct: string;
  queda_rendimento_pct: string;
  temperatura_limite_c: string;
  potencia_minima_avaliacao_kw: string;
  inversor_offline_coletas_minimas: number;
  sem_geracao_queda_abrupta_pct: string;
  retencao_leituras_dias: number;
  updated_at: string;
}

// ── Dashboard ────────────────────────────────────────────────────────────

export interface DashboardKpis {
  usinas: { total: number; ativas: number };
  inversores: { total: number; ativos: number };
  alertas_abertos: { total: number; critico: number; aviso: number; info: number };
  capacidade_kwp: string;
  energia_hoje_kwh: string;
  potencia_atual_kw: string;
}

export interface PontoGeracaoDiaria {
  dia: string;
  energia_kwh: number;
}

export interface RankingFabricante {
  provedor: TipoProvedor;
  energia_kwh: number;
  capacidade_kwp: number;
  qtd_usinas: number;
  eficiencia_kwh_kwp: number;
}
