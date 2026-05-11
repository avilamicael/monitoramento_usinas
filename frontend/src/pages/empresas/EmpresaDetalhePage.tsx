import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  useAtualizarEmpresa,
  useEmpresaSuperadmin,
} from '@/features/superadmin/api'
import type { EmpresaInput } from '@/features/superadmin/types'
import { extrairErroApi } from '@/features/superadmin/utils'
import { Card } from '@/components/trylab/primitives'
import { EmpresaForm } from './EmpresaForm'
import { UsuariosEmpresa } from './UsuariosEmpresa'

type Aba = 'dados' | 'usuarios'

export default function EmpresaDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [aba, setAba] = useState<Aba>('dados')

  const { data: empresa, isLoading, error } = useEmpresaSuperadmin(id)
  const atualizar = useAtualizarEmpresa()

  async function handleSubmit(dados: EmpresaInput) {
    if (!id) return
    try {
      await atualizar.mutateAsync({ id, dados })
      toast.success('Empresa atualizada.')
    } catch (err) {
      toast.error(extrairErroApi(err, 'Erro ao atualizar empresa.'))
    }
  }

  if (error) {
    return (
      <div className="tl-scr">
        <header className="tl-scr-head">
          <div>
            <div className="tl-crumb">Superadmin <span>/</span> Empresas</div>
            <h1 style={{ margin: 0 }}>Erro</h1>
          </div>
        </header>
        <Card>
          <div style={{ padding: 18, color: 'var(--tl-crit)', fontSize: 12.5 }}>
            {extrairErroApi(error, 'Erro ao carregar empresa.')}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="tl-scr">
      <header className="tl-scr-head" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div className="tl-crumb">
            <Link
              to="/empresas"
              className="tl-link-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ArrowLeftIcon className="size-3.5" /> Empresas
            </Link>
            <span>/</span>
            <span>{empresa?.nome ?? '…'}</span>
          </div>
          <h1 style={{ margin: '6px 0 0' }}>{empresa?.nome ?? 'Empresa'}</h1>
          {empresa && (
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 11,
                color: 'var(--tl-muted-fg)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {empresa.slug}
            </p>
          )}
        </div>
      </header>

      {/* Tabs TryLab */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--tl-line-soft)',
          paddingBottom: 0,
        }}
      >
        <TabButton ativo={aba === 'dados'} onClick={() => setAba('dados')}>
          Dados
        </TabButton>
        <TabButton ativo={aba === 'usuarios'} onClick={() => setAba('usuarios')}>
          Usuários{empresa ? ` (${empresa.qtd_usuarios})` : ''}
        </TabButton>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 40,
                maxWidth: 640,
                borderRadius: 8,
                background: 'var(--tl-card-bg)',
                border: '1px solid var(--tl-card-bd)',
              }}
            />
          ))}
        </div>
      ) : aba === 'dados' && empresa ? (
        <Card>
          <EmpresaForm
            inicial={empresa}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/empresas')}
            salvando={atualizar.isPending}
          />
        </Card>
      ) : aba === 'usuarios' && id ? (
        <UsuariosEmpresa empresaId={id} />
      ) : null}
    </div>
  )
}

function TabButton({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 14px',
        fontSize: 12.5,
        fontWeight: 500,
        background: 'transparent',
        border: 0,
        borderBottom: ativo
          ? '2px solid var(--tl-accent)'
          : '2px solid transparent',
        marginBottom: -1,
        color: ativo ? 'var(--tl-fg)' : 'var(--tl-muted-fg)',
        cursor: 'pointer',
        transition: 'color 0.12s, border-color 0.12s',
      }}
    >
      {children}
    </button>
  )
}
