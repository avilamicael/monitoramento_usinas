/**
 * Página /configuracao/regras — gestão de regras do motor de alertas (TryLab).
 *
 * Lista as regras conhecidas; admin ativa/desativa e ajusta severidade.
 * "Resetar tudo" apaga todos os overrides da empresa de uma vez.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/useAuth'
import {
  extrairErroConfiguracaoRegra,
  useConfiguracaoRegras,
  useResetarTodasConfiguracoes,
} from '@/hooks/use-configuracao-regras'
import LinhaRegra from '@/components/configuracao-regras/LinhaRegra'
import { Card } from '@/components/trylab/primitives'
import { Confirm } from '@/components/trylab/Confirm'

export default function RegrasPage() {
  const { user } = useAuth()
  const podeEditar = user?.papel === 'administrador' || user?.papel === 'superadmin'
  const { data, loading, error, refetch } = useConfiguracaoRegras()
  const resetarTudo = useResetarTodasConfiguracoes()
  const [confirmAberto, setConfirmAberto] = useState(false)

  const haCustomizacoes = (data ?? []).some((r) => !r.is_default)
  const desativarBotaoReset = !podeEditar || !haCustomizacoes || resetarTudo.isPending

  function confirmarResetTudo() {
    setConfirmAberto(false)
    resetarTudo.mutate(undefined, {
      onSuccess: () => toast.success('Todas as regras foram restauradas para o padrão.'),
      onError: (err) =>
        toast.error(
          extrairErroConfiguracaoRegra(err, 'Erro ao restaurar todas as regras.'),
        ),
    })
  }

  return (
    <div className="tl-scr">
      <header className="tl-scr-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="tl-crumb">
            Configurações <span>/</span> Regras
          </div>
          <h1 style={{ margin: 0 }}>Configuração de regras</h1>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 12,
              color: 'var(--tl-muted-fg)',
              maxWidth: 720,
              lineHeight: 1.5,
            }}
          >
            Defina como cada regra do motor de alertas se comporta nesta empresa.
            {!podeEditar && ' Apenas administradores podem editar.'}
          </p>
        </div>
        <div className="tl-head-actions">
          <button
            type="button"
            className="tl-btn"
            onClick={() => setConfirmAberto(true)}
            disabled={desativarBotaoReset}
          >
            Resetar tudo
          </button>
        </div>
      </header>

      {error ? (
        <Card>
          <div style={{ padding: 18, fontSize: 12.5 }}>
            <span style={{ color: 'var(--tl-crit)' }}>{error}</span>{' '}
            <button type="button" className="tl-link-sm" onClick={refetch}>
              Tentar novamente
            </button>
          </div>
        </Card>
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                height: 78,
                borderRadius: 14,
                background: 'var(--tl-card-bg)',
                border: '1px solid var(--tl-card-bd)',
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data?.map((regra) => (
            <LinhaRegra
              key={regra.regra_nome}
              regra={regra}
              podeEditar={podeEditar}
            />
          ))}
        </div>
      )}

      <Confirm
        open={confirmAberto}
        title="Restaurar todas as regras?"
        description="Isto apagará todas as suas customizações de severidade e estado. Todas as regras voltarão aos defaults do sistema."
        confirmLabel="Resetar tudo"
        destructive
        onConfirm={confirmarResetTudo}
        onCancel={() => setConfirmAberto(false)}
      />
    </div>
  )
}
