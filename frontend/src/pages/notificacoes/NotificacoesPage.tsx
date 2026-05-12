import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BellIcon, CheckCheckIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useNotificacoes } from '@/hooks/use-notificacoes'
import type { NivelNotificacao, Notificacao } from '@/types/notificacoes'
import { Card, Pill } from '@/components/trylab/primitives'

const NIVEL_LABEL: Record<NivelNotificacao, string> = {
  critico: 'Crítico',
  aviso: 'Aviso',
  info: 'Info',
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const PAGE_SIZE = 20

export default function NotificacoesPage() {
  const [apenasNaoLidas, setApenasNaoLidas] = useState(false)
  const [page, setPage] = useState(1)
  const { data, loading, error, marcarLida, marcarTodasLidas } = useNotificacoes({
    apenasNaoLidas,
    page,
  })

  async function handleMarcarTodas() {
    try {
      await marcarTodasLidas()
      toast.success('Todas as notificações marcadas como lidas.')
    } catch {
      toast.error('Erro ao marcar notificações.')
    }
  }

  async function handleClicar(n: Notificacao) {
    if (!n.lida) {
      try {
        await marcarLida(n.id)
      } catch {
        /* ignore */
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE))
  const resultados = data?.results ?? []

  return (
    <div className="tl-scr">
      <header className="tl-scr-head">
        <div>
          <div className="tl-crumb">Monitoramento <span>/</span> Notificações</div>
          <h1 style={{ margin: 0 }}>Notificações</h1>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 12,
              color: 'var(--tl-muted-fg)',
            }}
          >
            Eventos recentes do sistema — alertas, garantias e avisos operacionais.
          </p>
        </div>
        <div className="tl-head-actions">
          <button
            type="button"
            className="tl-btn"
            onClick={() => void handleMarcarTodas()}
            disabled={loading}
          >
            <CheckCheckIcon className="size-3.5" /> Marcar todas como lidas
          </button>
        </div>
      </header>

      <div className="tl-ftoolbar">
        <div className="tl-ftabs">
          <button
            type="button"
            className={'tl-ftab' + (!apenasNaoLidas ? ' active' : '')}
            onClick={() => {
              setApenasNaoLidas(false)
              setPage(1)
            }}
          >
            Todas
          </button>
          <button
            type="button"
            className={'tl-ftab' + (apenasNaoLidas ? ' active' : '')}
            onClick={() => {
              setApenasNaoLidas(true)
              setPage(1)
            }}
          >
            Não lidas
          </button>
        </div>
      </div>

      {error && (
        <Card>
          <div style={{ padding: 18, color: 'var(--tl-crit)', fontSize: 12.5 }}>{error}</div>
        </Card>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 76,
                borderRadius: 10,
                background: 'var(--tl-card-bg)',
                border: '1px solid var(--tl-card-bd)',
              }}
            />
          ))}
        </div>
      ) : resultados.length === 0 ? (
        <Card>
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              color: 'var(--tl-muted-fg)',
              fontSize: 13,
            }}
          >
            <BellIcon className="size-8" style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <p style={{ margin: 0 }}>
              Nenhuma notificação{apenasNaoLidas ? ' não lida' : ''} no momento.
            </p>
          </div>
        </Card>
      ) : (
        <div className="tl-aulist">
          {resultados.map((n) => (
            <NotificacaoItem key={n.id} notificacao={n} onClick={() => void handleClicar(n)} />
          ))}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 4px',
          }}
        >
          <span className="tl-muted tl-small">
            Página {page} de {totalPages}
          </span>
          <div className="tl-pager">
            <button
              type="button"
              className="tl-btn"
              disabled={!data?.previous}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹ Anterior
            </button>
            <button
              type="button"
              className="tl-btn"
              disabled={!data?.next}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NotificacaoItem({
  notificacao: n,
  onClick,
}: {
  notificacao: Notificacao
  onClick: () => void
}) {
  const sev = n.nivel
  const conteudo = (
    <>
      <span className="tl-aualert-sev" data-sev={sev}>
        {NIVEL_LABEL[sev]}
      </span>
      <div className="tl-aualert-body">
        <div className="tl-aualert-h">
          <strong>{n.titulo}</strong>
          <em>{formatarDataHora(n.criado_em)}</em>
        </div>
        <div className="tl-aualert-d">{n.mensagem}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {!n.lida && <Pill tone="ok">Nova</Pill>}
        {n.apenas_staff && <Pill tone="ghost">Staff</Pill>}
      </div>
    </>
  )
  return n.link ? (
    <Link
      to={n.link}
      onClick={onClick}
      className="tl-aualert"
      data-sev={sev}
      style={{
        opacity: n.lida ? 0.65 : 1,
      }}
    >
      {conteudo}
    </Link>
  ) : (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="tl-aualert"
      data-sev={sev}
      style={{ opacity: n.lida ? 0.65 : 1, cursor: 'pointer' }}
    >
      {conteudo}
    </div>
  )
}
