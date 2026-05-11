import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangleIcon,
  Loader2Icon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { ProvedorFormDialog } from '@/components/provedores/ProvedorFormDialog'
import { extrairErroProvedor, useProvedores } from '@/hooks/use-provedores'
import type { CredencialProvedor, CredencialWritePayload } from '@/types/provedores'
import { Card, Pill, type PillTone } from '@/components/trylab/primitives'
import { Confirm } from '@/components/trylab/Confirm'

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function tokenPill(cred: CredencialProvedor): ReactNode {
  const status = cred.token_status
  if (status === null) {
    return <span style={{ fontSize: 11, color: 'var(--tl-muted-fg)' }}>—</span>
  }
  if (!status.configurado) {
    return <Pill tone="crit">Sem token</Pill>
  }
  const dias = status.dias_restantes
  if (dias == null) return <Pill tone="ok">Válido</Pill>
  if (dias < 0) return <Pill tone="crit">Expirado</Pill>
  if (dias <= 7) return <Pill tone="crit">Expira em {dias}d</Pill>
  if (dias <= 14) return <Pill tone="warn">Expira em {dias}d</Pill>
  return <Pill tone="ok">{dias}d restantes</Pill>
}

function renderUltimaColeta(cred: CredencialProvedor): ReactNode {
  const u = cred.ultima_coleta
  if (!u) return <span style={{ fontSize: 11, color: 'var(--tl-muted-fg)' }}>Nunca coletado</span>
  const tone: 'ok' | 'warn' | 'crit' =
    u.status === 'sucesso' ? 'ok' : u.status === 'parcial' ? 'warn' : 'crit'
  const cor =
    tone === 'ok'
      ? 'oklch(0.78 0.13 150)'
      : tone === 'warn'
        ? 'oklch(0.78 0.16 75)'
        : 'oklch(0.7 0.22 25)'
  const linhaContagem =
    u.usinas_coletadas === 0 && u.inversores_coletados === 0
      ? 'nenhuma usina processada'
      : `${u.usinas_coletadas} usinas / ${u.inversores_coletados} inversores`
  return (
    <div style={{ fontSize: 11 }}>
      <div style={{ color: cor, fontWeight: 500 }}>{u.status}</div>
      <div style={{ color: 'var(--tl-muted-fg)' }}>{formatarDataHora(u.iniciado_em)}</div>
      <div style={{ color: 'var(--tl-muted-fg)' }}>{linhaContagem}</div>
    </div>
  )
}

export default function ProvedoresPage() {
  const { data, meta, loading, error, criar, atualizar, remover, forcarColeta } =
    useProvedores()
  const [formTarget, setFormTarget] = useState<CredencialProvedor | null | 'novo'>(null)
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<string | null>(null)
  const [removerAlvo, setRemoverAlvo] = useState<CredencialProvedor | null>(null)

  async function handleSubmit(payload: CredencialWritePayload, id: string | null) {
    if (id) await atualizar(id, payload)
    else await criar(payload)
  }

  async function handleForcarColeta(cred: CredencialProvedor) {
    setAcaoEmAndamento(cred.id)
    try {
      await forcarColeta(cred.id)
      toast.success(`Coleta do ${cred.provedor_display} disparada.`)
    } catch (err) {
      toast.error(extrairErroProvedor(err, 'Erro ao disparar coleta.'))
    } finally {
      setAcaoEmAndamento(null)
    }
  }

  async function handleToggleAtivo(cred: CredencialProvedor) {
    setAcaoEmAndamento(cred.id)
    try {
      await atualizar(cred.id, { ativo: !cred.ativo })
      toast.success(`Provedor ${cred.ativo ? 'desativado' : 'ativado'}.`)
    } catch (err) {
      toast.error(extrairErroProvedor(err, 'Erro ao atualizar provedor.'))
    } finally {
      setAcaoEmAndamento(null)
    }
  }

  async function confirmarRemover() {
    if (!removerAlvo) return
    const cred = removerAlvo
    setRemoverAlvo(null)
    setAcaoEmAndamento(cred.id)
    try {
      await remover(cred.id)
      toast.success('Provedor removido.')
    } catch (err) {
      toast.error(extrairErroProvedor(err, 'Erro ao remover provedor.'))
    } finally {
      setAcaoEmAndamento(null)
    }
  }

  if (error) {
    return (
      <div className="tl-scr">
        <header className="tl-scr-head">
          <div>
            <div className="tl-crumb">Configurações <span>/</span> Provedores</div>
            <h1 style={{ margin: 0 }}>Gestão de provedores</h1>
          </div>
        </header>
        <Card>
          <div style={{ padding: 18, color: 'var(--tl-crit)', fontSize: 12.5 }}>{error}</div>
        </Card>
      </div>
    )
  }

  const ativosJaCadastrados = new Set(data?.map((d) => d.provedor) ?? [])
  const podeCriar = meta && meta.provedores.some((p) => !ativosJaCadastrados.has(p.valor))
  const credenciais = data ?? []

  return (
    <div className="tl-scr">
      <header className="tl-scr-head">
        <div>
          <div className="tl-crumb">Configurações <span>/</span> Provedores</div>
          <h1 style={{ margin: 0 }}>Gestão de provedores</h1>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 12,
              color: 'var(--tl-muted-fg)',
              maxWidth: 720,
              lineHeight: 1.5,
            }}
          >
            Credenciais, intervalos e coleta por API de cada provedor.
          </p>
        </div>
        <div className="tl-head-actions">
          <button
            type="button"
            className="tl-btn-primary"
            onClick={() => setFormTarget('novo')}
            disabled={!podeCriar}
            title={!podeCriar ? 'Todos os provedores já estão cadastrados' : undefined}
          >
            <PlusIcon className="size-3.5" />
            Novo provedor
          </button>
        </div>
      </header>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 72,
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
            style={{ gridTemplateColumns: '1.4fr 1.4fr 0.9fr 1.1fr 1.6fr 220px' }}
          >
            <span>Provedor</span>
            <span>Status</span>
            <span>Intervalo</span>
            <span>Token</span>
            <span>Última coleta</span>
            <span style={{ textAlign: 'right' }}>Ações</span>
          </div>
          {credenciais.length === 0 ? (
            <div className="tl-ftable-empty">Nenhum provedor cadastrado</div>
          ) : (
            credenciais.map((cred) => {
              const em = acaoEmAndamento === cred.id
              const statusTone: PillTone = cred.ativo ? 'ok' : 'ghost'
              return (
                <div
                  key={cred.id}
                  className="tl-ftable-tr"
                  style={{
                    gridTemplateColumns: '1.4fr 1.4fr 0.9fr 1.1fr 1.6fr 220px',
                    cursor: 'default',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{cred.provedor_display}</span>
                  <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                    <Pill tone={statusTone}>{cred.ativo ? 'Ativo' : 'Inativo'}</Pill>
                    {cred.precisa_atencao && (
                      <Pill tone="crit">
                        <AlertTriangleIcon
                          className="size-3"
                          style={{ marginRight: 2 }}
                          aria-hidden
                        />
                        Atenção
                      </Pill>
                    )}
                  </span>
                  <span style={{ fontSize: 12 }}>{cred.intervalo_coleta_minutos} min</span>
                  <span>{tokenPill(cred)}</span>
                  <span>{renderUltimaColeta(cred)}</span>
                  <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="tl-icon-btn"
                      onClick={() => void handleForcarColeta(cred)}
                      disabled={em || !cred.ativo}
                      title={!cred.ativo ? 'Ative o provedor primeiro' : 'Forçar coleta agora'}
                    >
                      {em ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <PlayIcon className="size-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="tl-btn ghost"
                      onClick={() => void handleToggleAtivo(cred)}
                      disabled={em}
                      style={{ padding: '4px 9px', fontSize: 11 }}
                    >
                      {cred.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      type="button"
                      className="tl-icon-btn"
                      onClick={() => setFormTarget(cred)}
                      disabled={em}
                      title="Editar"
                    >
                      <PencilIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="tl-icon-btn"
                      onClick={() => setRemoverAlvo(cred)}
                      disabled={em}
                      title="Remover"
                    >
                      <Trash2Icon
                        className="size-3.5"
                        style={{ color: 'var(--tl-crit)' }}
                      />
                    </button>
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}

      <ProvedorFormDialog
        credencial={formTarget && formTarget !== 'novo' ? formTarget : null}
        meta={meta}
        open={formTarget !== null}
        onClose={() => setFormTarget(null)}
        onSubmit={handleSubmit}
      />

      <Confirm
        open={!!removerAlvo}
        title="Remover provedor?"
        description={
          removerAlvo ? (
            <>
              Remover{' '}
              <strong style={{ color: 'var(--tl-fg)' }}>
                {removerAlvo.provedor_display}
              </strong>
              ? A credencial e o cache de token serão apagados. As usinas
              coletadas permanecem no banco.
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
