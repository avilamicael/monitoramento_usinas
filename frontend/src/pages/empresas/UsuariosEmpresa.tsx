import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import {
  useAtualizarUsuarioSuperadmin,
  useCriarUsuarioSuperadmin,
  useExcluirUsuarioSuperadmin,
  useUsuariosSuperadmin,
} from '@/features/superadmin/api'
import type {
  UsuarioInput,
  UsuarioSuperadmin,
} from '@/features/superadmin/types'
import { extrairErroApi } from '@/features/superadmin/utils'
import { Card, Pill, type PillTone } from '@/components/trylab/primitives'
import { Confirm } from '@/components/trylab/Confirm'
import { UsuarioFormDialog } from './UsuarioFormDialog'

interface Props {
  empresaId: string
}

export function UsuariosEmpresa({ empresaId }: Props) {
  const { data, isLoading, error } = useUsuariosSuperadmin(empresaId)
  const criar = useCriarUsuarioSuperadmin()
  const atualizar = useAtualizarUsuarioSuperadmin()
  const excluir = useExcluirUsuarioSuperadmin()

  const [target, setTarget] = useState<UsuarioSuperadmin | 'novo' | null>(null)
  const [acaoId, setAcaoId] = useState<number | null>(null)
  const [alvoInativar, setAlvoInativar] = useState<UsuarioSuperadmin | null>(null)

  async function handleSubmit(dados: UsuarioInput, id: number | null) {
    if (id) {
      await atualizar.mutateAsync({ id, dados })
    } else {
      await criar.mutateAsync({ ...dados, empresa: empresaId })
    }
  }

  async function confirmarInativar() {
    if (!alvoInativar) return
    const u = alvoInativar
    setAlvoInativar(null)
    setAcaoId(u.id)
    try {
      await excluir.mutateAsync(u.id)
      toast.success('Usuário inativado.')
    } catch (err) {
      toast.error(extrairErroApi(err, 'Erro ao inativar usuário.'))
    } finally {
      setAcaoId(null)
    }
  }

  if (error) {
    return (
      <Card>
        <div style={{ padding: 18, color: 'var(--tl-crit)', fontSize: 12.5 }}>
          {extrairErroApi(error, 'Erro ao carregar usuários.')}
        </div>
      </Card>
    )
  }

  const usuarios = data?.results ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: 'var(--tl-muted-fg)',
          }}
        >
          Usuários cadastrados nesta empresa.
        </p>
        <button
          type="button"
          className="tl-btn-primary"
          onClick={() => setTarget('novo')}
          style={{ fontSize: 11.5, padding: '6px 11px' }}
        >
          <PlusIcon className="size-3" />
          Novo usuário
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                height: 48,
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
              gridTemplateColumns: '1.2fr 1.4fr 1.6fr 1fr 0.8fr 100px',
            }}
          >
            <span>Usuário</span>
            <span>Nome</span>
            <span>E-mail</span>
            <span>Papel</span>
            <span>Status</span>
            <span style={{ textAlign: 'right' }}>Ações</span>
          </div>
          {usuarios.length === 0 ? (
            <div className="tl-ftable-empty">Nenhum usuário nesta empresa.</div>
          ) : (
            usuarios.map((u) => {
              const em = acaoId === u.id
              const nome =
                [u.first_name, u.last_name].filter(Boolean).join(' ') || '—'
              const papelTone: PillTone =
                u.papel === 'superadmin'
                  ? 'crit'
                  : u.papel === 'administrador'
                    ? 'warn'
                    : 'ghost'
              const papelLabel =
                u.papel === 'superadmin'
                  ? 'Superadmin'
                  : u.papel === 'administrador'
                    ? 'Administrador'
                    : 'Operacional'
              return (
                <div
                  key={u.id}
                  className="tl-ftable-tr"
                  style={{
                    gridTemplateColumns: '1.2fr 1.4fr 1.6fr 1fr 0.8fr 100px',
                    cursor: 'default',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{u.username}</span>
                  <span>{nome}</span>
                  <span className="tl-cell-loc">{u.email || '—'}</span>
                  <span>
                    <Pill tone={papelTone}>{papelLabel}</Pill>
                  </span>
                  <span>
                    <Pill tone={u.is_active ? 'ok' : 'ghost'}>
                      {u.is_active ? 'Ativo' : 'Inativo'}
                    </Pill>
                  </span>
                  <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="tl-icon-btn"
                      onClick={() => setTarget(u)}
                      disabled={em}
                      title="Editar"
                      aria-label={`Editar ${u.username}`}
                    >
                      <PencilIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="tl-icon-btn"
                      onClick={() => setAlvoInativar(u)}
                      disabled={em || !u.is_active}
                      title="Inativar"
                      aria-label={`Inativar ${u.username}`}
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
        usuario={target && target !== 'novo' ? target : null}
        empresaId={empresaId}
        open={target !== null}
        onClose={() => setTarget(null)}
        onSubmit={handleSubmit}
      />

      <Confirm
        open={!!alvoInativar}
        title="Inativar usuário?"
        description={
          alvoInativar ? (
            <>
              Inativar o usuário{' '}
              <strong style={{ color: 'var(--tl-fg)' }}>{alvoInativar.username}</strong>?
              O acesso é bloqueado mas o histórico é preservado.
            </>
          ) : null
        }
        confirmLabel="Inativar"
        destructive
        onConfirm={() => void confirmarInativar()}
        onCancel={() => setAlvoInativar(null)}
      />
    </div>
  )
}
