// Tipos consumidos pela `NotificacoesPage` (inbox de eventos).
//
// O backend novo NÃO possui inbox in-app por usuário. Esta `Notificacao`
// é um adapter visual sobre `EntregaNotificacao` (`/notificacoes/entregas/`),
// que é o log de envios de notificações disparadas pelas regras.
//
// Por consequência:
//   - `lida` é sempre `false` (não há marcação de leitura);
//   - `apenas_staff` é sempre `false`;
//   - `nivel` cai para `'info'` por padrão (severidade real depende
//     de buscar o alerta — feito sob demanda quando aplicável).

export type TipoNotificacao = 'alerta' | 'sistema' | 'garantia' | 'outro'
export type NivelNotificacao = 'info' | 'aviso' | 'importante' | 'critico'

export interface Notificacao {
  id: string
  titulo: string
  mensagem: string
  tipo: TipoNotificacao
  nivel: NivelNotificacao
  link: string
  apenas_staff: boolean
  criado_em: string
  lida: boolean
}

export interface PaginatedNotificacoes {
  count: number
  next: string | null
  previous: string | null
  results: Notificacao[]
}
