/**
 * Linha de configuração de uma regra do motor de alertas (TryLab).
 *
 * Salvamento automático:
 *  - Switch (ativar/desativar): salva no clique.
 *  - Select (severidade): debounce 300ms.
 *
 * Desativação de regra crítica abre Confirm extra (mitiga R4 dos
 * riscos-e-rollback).
 */
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2Icon, RotateCcwIcon } from 'lucide-react'
import {
  extrairErroConfiguracaoRegra,
  useAtualizarConfiguracaoRegra,
  useResetarConfiguracaoRegra,
} from '@/hooks/use-configuracao-regras'
import { CATEGORIA_LABELS, type NivelAlerta } from '@/types/alertas'
import type { ConfiguracaoRegra } from '@/types/configuracao-regras'
import { Card, Pill } from '@/components/trylab/primitives'
import { Select } from '@/components/trylab/Select'
import { Switch } from '@/components/trylab/Switch'
import { Confirm } from '@/components/trylab/Confirm'

const SEVERIDADE_OPCOES: Array<[NivelAlerta, string]> = [
  ['critico', 'Crítico'],
  ['aviso', 'Aviso'],
  ['info', 'Informativo'],
]

const DEBOUNCE_MS = 300

function nomeLegivel(regra_nome: string): string {
  return CATEGORIA_LABELS[regra_nome] ?? regra_nome
}

export interface LinhaRegraProps {
  regra: ConfiguracaoRegra
  podeEditar: boolean
}

export default function LinhaRegra({ regra, podeEditar }: LinhaRegraProps) {
  const atualizar = useAtualizarConfiguracaoRegra()
  const resetar = useResetarConfiguracaoRegra()

  const [ativa, setAtiva] = useState(regra.ativa)
  const [severidade, setSeveridade] = useState<NivelAlerta>(regra.severidade)
  const [confirmCritico, setConfirmCritico] = useState(false)

  useEffect(() => {
    setAtiva(regra.ativa)
    setSeveridade(regra.severidade)
  }, [regra.ativa, regra.severidade])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const salvando = atualizar.isPending || resetar.isPending

  function dispararSalvamento(novo: { ativa: boolean; severidade: NivelAlerta }) {
    atualizar.mutate(
      { regra_nome: regra.regra_nome, payload: novo },
      {
        onSuccess: () => toast.success('Salvo.'),
        onError: (err) =>
          toast.error(extrairErroConfiguracaoRegra(err, 'Erro ao salvar regra.')),
      },
    )
  }

  function handleAtivaChange(checked: boolean) {
    if (!checked && regra.severidade_default === 'critico') {
      setConfirmCritico(true)
      return
    }
    setAtiva(checked)
    dispararSalvamento({ ativa: checked, severidade })
  }

  function confirmarDesativacaoCritica() {
    setConfirmCritico(false)
    setAtiva(false)
    dispararSalvamento({ ativa: false, severidade })
  }

  function handleSeveridadeChange(valor: string) {
    const nova = valor as NivelAlerta
    setSeveridade(nova)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      dispararSalvamento({ ativa, severidade: nova })
    }, DEBOUNCE_MS)
  }

  function handleResetar() {
    resetar.mutate(regra.regra_nome, {
      onSuccess: () => toast.success('Regra restaurada para o padrão.'),
      onError: (err) =>
        toast.error(extrairErroConfiguracaoRegra(err, 'Erro ao restaurar regra.')),
    })
  }

  const selectDesabilitado = !podeEditar || regra.severidade_dinamica || !ativa

  return (
    <>
      <Card>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {nomeLegivel(regra.regra_nome)}
              </div>
              {regra.descricao && (
                <div style={{ fontSize: 11.5, color: 'var(--tl-muted-fg)', marginTop: 2 }}>
                  {regra.descricao}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <Switch
                checked={ativa}
                onChange={handleAtivaChange}
                disabled={!podeEditar || salvando}
                ariaLabel={`Ativar regra ${nomeLegivel(regra.regra_nome)}`}
                label="Ativa"
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--tl-muted-fg)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Severidade
                </span>
                {regra.severidade_dinamica ? (
                  <span
                    title="Esta regra escala automaticamente entre Aviso e Crítico conforme o tempo. Não pode ser fixada."
                  >
                    <Pill tone="ghost">Dinâmica</Pill>
                  </span>
                ) : (
                  <Select
                    value={severidade}
                    onChange={handleSeveridadeChange}
                    options={SEVERIDADE_OPCOES}
                    disabled={selectDesabilitado}
                    minWidth={120}
                  />
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 120,
                  justifyContent: 'flex-end',
                }}
              >
                {salvando && (
                  <Loader2Icon
                    className="size-3.5 animate-spin"
                    style={{ color: 'var(--tl-muted-fg)' }}
                    aria-label="Salvando"
                  />
                )}
                {regra.is_default ? (
                  !regra.severidade_dinamica && <Pill tone="ghost">Padrão</Pill>
                ) : podeEditar ? (
                  <button
                    type="button"
                    className="tl-btn ghost"
                    onClick={handleResetar}
                    disabled={salvando}
                    title="Resetar para padrão"
                  >
                    <RotateCcwIcon className="size-3.5" />
                    Resetar
                  </button>
                ) : (
                  <Pill tone="ghost">Customizada</Pill>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Confirm
        open={confirmCritico}
        title="Desativar regra crítica?"
        description={
          <>
            <strong style={{ color: 'var(--tl-fg)' }}>
              {nomeLegivel(regra.regra_nome)}
            </strong>{' '}
            é uma regra crítica. Enquanto desativada, o motor não gerará novos
            alertas dessa regra para a sua empresa.
          </>
        }
        confirmLabel="Desativar"
        destructive
        onConfirm={confirmarDesativacaoCritica}
        onCancel={() => setConfirmCritico(false)}
      />
    </>
  )
}
