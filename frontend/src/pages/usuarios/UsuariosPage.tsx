import { useState } from 'react'
import { toast } from 'sonner'
import {
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { UsuarioFormDialog } from '@/components/usuarios/UsuarioFormDialog'
import { extrairErroUsuario, useUsuarios } from '@/hooks/use-usuarios'
import type { Usuario, UsuarioWrite } from '@/types/usuarios'
import { Card, Pill } from '@/components/trylab/primitives'
import { Confirm } from '@/components/trylab/Confirm'

function formatarData(iso: string | null): string {
  if (!iso) return 'Nunca'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function UsuariosPage() {
  const { data, loading, error, criar, atualizar, remover } = useUsuarios()
  const [formTarget, setFormTarget] = useState<Usuario | null | 'novo'>(null)
  const [acaoId, setAcaoId] = useState<number | null>(null)
  const [removerAlvo, setRemoverAlvo] = useState<Usuario | null>(null)

  async function handleSubmit(
    payload: UsuarioWrite | Partial<UsuarioWrite>,
    id: number | null,
  ) {
    if (id) await atualizar(id, payload)
    else await criar(payload as UsuarioWrite)
  }

  async function confirmarRemover() {
    if (!removerAlvo) return
    const u = removerAlvo
    setRemoverAlvo(null)
    setAcaoId(u.id)
    try {
      await remover(u.id)
      toast.success('Usuário removido.')
    } catch (err) {
      toast.error(extrairErroUsuario(err, 'Erro ao remover usuário.'))
    } finally {
      setAcaoId(null)
    }
  }

  if (error) {
    return (
      <div className="tl-scr">
        <header className="tl-scr-head">
          <div>
            <div className="tl-crumb">Configurações <span>/</span> Usuários</div>
            <h1 style={{ margin: 0 }}>Gestão de usuários</h1>
          </div>
        </header>
        <Card>
          <div style={{ padding: 18, color: 'var(--tl-crit)', fontSize: 12.5 }}>{error}</div>
        </Card>
      </div>
    )
  }

  const usuarios = data ?? []

  return (
    <div className="tl-scr">
      <header className="tl-scr-head">
        <div>
          <div className="tl-crumb">Configurações <span>/</span> Usuários</div>
          <h1 style={{ margin: 0 }}>Gestão de usuários</h1>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 12,
              color: 'var(--tl-muted-fg)',
              maxWidth: 720,
              lineHeight: 1.5,
            }}
          >
            Crie, edite ou remova usuários do sistema. Administradores têm acesso
            às páginas de gestão; superadmins podem alterar empresas.
          </p>
        </div>
        <div className="tl-head-actions">
          <button
            type="button"
            className="tl-btn-primary"
            onClick={() => setFormTarget('novo')}
          >
            <PlusIcon className="size-3.5" />
            Novo usuário
          </button>
        </div>
      </header>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 56,
                borderRadius: 10,
                background: 'var(--tl-card-bg)',
                border: '1px solid var(--tl-card-bd)',
              }}
            />
          ))}
        </div>
      ) : (
        <div className="tl-ftable">
          <div
            className="tl-ftable-thead"
            style={{
              gridTemplateColumns: '1.2fr 1.4fr 1.6fr 1fr 0.8fr 1fr 110px',
            }}
          >
            <span>Usuário</span>
            <span>Nome</span>
            <span>E-mail</span>
            <span>Perfil</span>
            <span>Status</span>
            <span>Último login</span>
            <span style={{ textAlign: 'right' }}>Ações</span>
          </div>
          {usuarios.length === 0 ? (
            <div className="tl-ftable-empty">Nenhum usuário cadastrado</div>
          ) : (
            usuarios.map((u) => {
              const em = acaoId === u.id
              const perfil = u.is_superuser
                ? 'super'
                : u.is_staff
                  ? 'admin'
                  : 'operador'
              const perfilTone: 'ok' | 'warn' | 'crit' | 'ghost' =
                perfil === 'super' ? 'crit' : perfil === 'admin' ? 'warn' : 'ghost'
              const perfilLabel =
                perfil === 'super' ? 'Superadmin' : perfil === 'admin' ? 'Admin' : 'Operador'
              return (
                <div
                  key={u.id}
                  className="tl-ftable-tr"
                  style={{
                    gridTemplateColumns: '1.2fr 1.4fr 1.6fr 1fr 0.8fr 1fr 110px',
                    cursor: 'default',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{u.username}</span>
                  <span>
                    {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                  </span>
                  <span className="tl-cell-loc">{u.email || '—'}</span>
                  <span>
                    <Pill tone={perfilTone}>{perfilLabel}</Pill>
                  </span>
                  <span>
                    <Pill tone={u.is_active ? 'ok' : 'ghost'}>
                      {u.is_active ? 'Ativo' : 'Inativo'}
                    </Pill>
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--tl-muted-fg)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatarData(u.last_login)}
                  </span>
                  <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="tl-icon-btn"
                      onClick={() => setFormTarget(u)}
                      disabled={em}
                      aria-label={`Editar ${u.username}`}
                      title="Editar"
                    >
                      <PencilIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="tl-icon-btn"
                      onClick={() => setRemoverAlvo(u)}
                      disabled={em}
                      aria-label={`Remover ${u.username}`}
                      title="Remover"
                    >
                      {em ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2Icon
                          className="size-3.5"
                          style={{ color: 'var(--tl-crit)' }}
                        />
                      )}
                    </button>
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}

      <UsuarioFormDialog
        usuario={formTarget && formTarget !== 'novo' ? formTarget : null}
        open={formTarget !== null}
        onClose={() => setFormTarget(null)}
        onSubmit={handleSubmit}
      />

      <Confirm
        open={!!removerAlvo}
        title="Remover usuário?"
        description={
          removerAlvo ? (
            <>
              Tem certeza que quer remover o usuário{' '}
              <strong style={{ color: 'var(--tl-fg)' }}>{removerAlvo.username}</strong>?
              Esta ação é irreversível.
            </>
          ) : null
        }
        confirmLabel="Remover"
        destructive
        onConfirm={() => void confirmarRemover()}
        onCancel={() => setRemoverAlvo(null)}
      />
    </div>
  )
}
