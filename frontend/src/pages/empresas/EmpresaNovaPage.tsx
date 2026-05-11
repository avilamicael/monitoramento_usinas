import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useCriarEmpresa } from '@/features/superadmin/api'
import type { EmpresaInput } from '@/features/superadmin/types'
import { extrairErroApi } from '@/features/superadmin/utils'
import { Card } from '@/components/trylab/primitives'
import { EmpresaForm } from './EmpresaForm'

export default function EmpresaNovaPage() {
  const navigate = useNavigate()
  const criar = useCriarEmpresa()

  async function handleSubmit(dados: EmpresaInput) {
    try {
      const nova = await criar.mutateAsync(dados)
      toast.success(`Empresa "${nova.nome}" criada.`)
      navigate(`/empresas/${nova.id}`)
    } catch (err) {
      toast.error(extrairErroApi(err, 'Erro ao criar empresa.'))
    }
  }

  return (
    <div className="tl-scr">
      <header className="tl-scr-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="tl-crumb">
            <Link
              to="/empresas"
              className="tl-link-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ArrowLeftIcon className="size-3.5" /> Empresas
            </Link>
            <span>/</span>
            <span>Nova</span>
          </div>
          <h1 style={{ margin: '6px 0 0' }}>Nova empresa</h1>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 12,
              color: 'var(--tl-muted-fg)',
              maxWidth: 720,
              lineHeight: 1.5,
            }}
          >
            Cadastre o cliente. Depois crie o primeiro usuário administrador na
            aba "Usuários".
          </p>
        </div>
      </header>

      <Card>
        <EmpresaForm
          onSubmit={handleSubmit}
          onCancel={() => navigate('/empresas')}
          salvando={criar.isPending}
        />
      </Card>
    </div>
  )
}
