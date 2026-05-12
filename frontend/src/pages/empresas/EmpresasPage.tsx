import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { useEmpresasSuperadmin, useExcluirEmpresa } from '@/features/superadmin/api'
import { extrairErroApi } from '@/features/superadmin/utils'
import type { EmpresaSuperadmin } from '@/features/superadmin/types'
import { Card, Pill } from '@/components/trylab/primitives'
import { Confirm } from '@/components/trylab/Confirm'

export default function EmpresasPage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useEmpresasSuperadmin()
  const excluir = useExcluirEmpresa()
  const [acaoId, setAcaoId] = useState<string | null>(null)
  const [alvoInativar, setAlvoInativar] = useState<EmpresaSuperadmin | null>(null)

  async function confirmarInativar() {
    if (!alvoInativar) return
    const e = alvoInativar
    setAlvoInativar(null)
    setAcaoId(e.id)
    try {
      await excluir.mutateAsync(e.id)
      toast.success('Empresa inativada.')
    } catch (err) {
      toast.error(extrairErroApi(err, 'Erro ao inativar empresa.'))
    } finally {
      setAcaoId(null)
    }
  }

  if (error) {
    return (
      <div className="tl-scr">
        <header className="tl-scr-head">
          <div>
            <div className="tl-crumb">Superadmin <span>/</span> Empresas</div>
            <h1 style={{ margin: 0 }}>Empresas</h1>
          </div>
        </header>
        <Card>
          <div style={{ padding: 18, color: 'var(--tl-crit)', fontSize: 12.5 }}>
            {extrairErroApi(error, 'Erro ao carregar empresas.')}
          </div>
        </Card>
      </div>
    )
  }

  const empresas = data?.results ?? []

  return (
    <div className="tl-scr">
      <header className="tl-scr-head">
        <div>
          <div className="tl-crumb">Superadmin <span>/</span> Empresas</div>
          <h1 style={{ margin: 0 }}>Empresas</h1>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 12,
              color: 'var(--tl-muted-fg)',
              maxWidth: 720,
              lineHeight: 1.5,
            }}
          >
            Onboarding e gestão de clientes da Firma Solar.
          </p>
        </div>
        <div className="tl-head-actions">
          <button
            type="button"
            className="tl-btn-primary"
            onClick={() => navigate('/empresas/nova')}
          >
            <PlusIcon className="size-3.5" />
            Nova empresa
          </button>
        </div>
      </header>

      {isLoading ? (
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
              gridTemplateColumns: '1.6fr 1.2fr 1fr 100px 100px 0.9fr 90px',
            }}
          >
            <span>Nome</span>
            <span>Slug</span>
            <span>Cidade/UF</span>
            <span style={{ textAlign: 'right' }}>Usuários</span>
            <span style={{ textAlign: 'right' }}>Usinas</span>
            <span>Status</span>
            <span style={{ textAlign: 'right' }}>Ações</span>
          </div>
          {empresas.length === 0 ? (
            <div className="tl-ftable-empty">Nenhuma empresa cadastrada.</div>
          ) : (
            empresas.map((e) => {
              const em = acaoId === e.id
              const cidadeUf = [e.cidade, e.uf].filter(Boolean).join('/') || '—'
              return (
                <div
                  key={e.id}
                  className="tl-ftable-tr"
                  style={{
                    gridTemplateColumns: '1.6fr 1.2fr 1fr 100px 100px 0.9fr 90px',
                    cursor: 'default',
                  }}
                >
                  <span>
                    <Link
                      to={`/empresas/${e.id}`}
                      style={{
                        color: 'var(--tl-fg)',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      {e.nome}
                    </Link>
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--tl-muted-fg)',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {e.slug}
                  </span>
                  <span className="tl-cell-loc">{cidadeUf}</span>
                  <span
                    style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {e.qtd_usuarios}
                  </span>
                  <span
                    style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {e.qtd_usinas}
                  </span>
                  <span>
                    <Pill tone={e.is_active ? 'ok' : 'ghost'}>
                      {e.is_active ? 'Ativa' : 'Inativa'}
                    </Pill>
                  </span>
                  <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="tl-icon-btn"
                      onClick={() => navigate(`/empresas/${e.id}`)}
                      disabled={em}
                      title="Editar"
                      aria-label={`Editar ${e.nome}`}
                    >
                      <PencilIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="tl-icon-btn"
                      onClick={() => setAlvoInativar(e)}
                      disabled={em || !e.is_active}
                      title="Inativar"
                      aria-label={`Inativar ${e.nome}`}
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

      <Confirm
        open={!!alvoInativar}
        title="Inativar empresa?"
        description={
          alvoInativar ? (
            <>
              Inativar a empresa{' '}
              <strong style={{ color: 'var(--tl-fg)' }}>{alvoInativar.nome}</strong>?
              Os dados são preservados — a empresa pode ser reativada depois pela
              API.
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
