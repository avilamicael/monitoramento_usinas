import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Trash2Icon } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { MonitoramentoAtivoUsina } from '@/types/monitoramento-ativo'

function extrairErroApi(err: unknown): string {
  const e = err as { response?: { status?: number; data?: Record<string, unknown> } }
  if (e?.response?.status === 403) {
    return 'Sem permissão — apenas administradores podem alterar.'
  }
  const data = e?.response?.data
  if (data && typeof data === 'object') {
    const msgs = Object.entries(data)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : String(v)}`)
      .join('\n')
    if (msgs) return msgs
  }
  return 'Erro ao salvar monitoramento.'
}

interface MonitoramentoAtivoFormDialogProps {
  monitoramento: MonitoramentoAtivoUsina | null
  usinaId: string | null
  usinaNome: string | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function MonitoramentoAtivoFormDialog({
  monitoramento,
  usinaId,
  usinaNome,
  open,
  onClose,
  onSuccess,
}: MonitoramentoAtivoFormDialogProps) {
  const [dataInicio, setDataInicio] = useState('')
  const [meses, setMeses] = useState('12')
  const [valorMensal, setValorMensal] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = monitoramento !== null
  const targetUsinaId = monitoramento?.usina_id ?? usinaId
  const targetUsinaNome = monitoramento?.usina_nome ?? usinaNome

  useEffect(() => {
    if (monitoramento !== null) {
      setDataInicio(monitoramento.data_inicio)
      setMeses(String(monitoramento.meses))
      setValorMensal(monitoramento.valor_mensal ?? '')
      setObservacoes(monitoramento.observacoes)
    } else {
      setDataInicio('')
      setMeses('12')
      setValorMensal('')
      setObservacoes('')
    }
    setError(null)
  }, [monitoramento, usinaId])

  const dataFimPreview = useMemo(() => {
    const mesesNum = parseInt(meses)
    if (!dataInicio || !meses || isNaN(mesesNum) || mesesNum < 1) return null
    const [ano0, mes0, dia0] = dataInicio.split('-').map(Number)
    if (!ano0 || !mes0 || !dia0) return null
    // Espelha o backend `_somar_meses`: soma meses e CLAMPA o dia ao último
    // dia válido do mês destino (ex.: 31/jan + 1 mês → 28/fev, não 03/mar).
    const total = mes0 - 1 + mesesNum
    const ano = ano0 + Math.floor(total / 12)
    const mesIdx = total % 12 // 0-based para o Date
    const ultimoDia = new Date(ano, mesIdx + 1, 0).getDate()
    const dia = Math.min(dia0, ultimoDia)
    return new Date(ano, mesIdx, dia).toLocaleDateString('pt-BR')
  }, [dataInicio, meses])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!dataInicio) {
      setError('Data de início é obrigatória')
      return
    }
    const mesesNum = parseInt(meses)
    if (isNaN(mesesNum) || mesesNum < 1) {
      setError('Duração deve ser pelo menos 1 mês')
      return
    }
    if (!targetUsinaId) {
      setError('Usina não identificada')
      return
    }

    const valorMensalEnviar = valorMensal.trim() === '' ? null : valorMensal.trim()

    setSaving(true)
    try {
      if (isEditing && monitoramento) {
        await api.patch(`/monitoramento-ativo/${monitoramento.id}/`, {
          inicio_em: dataInicio,
          meses: mesesNum,
          valor_mensal: valorMensalEnviar,
          observacoes,
        })
      } else {
        await api.post('/monitoramento-ativo/', {
          usina: Number(targetUsinaId),
          inicio_em: dataInicio,
          meses: mesesNum,
          valor_mensal: valorMensalEnviar,
          observacoes,
        })
      }
      toast.success(isEditing ? 'Monitoramento atualizado' : 'Monitoramento criado')
      onSuccess()
    } catch (err) {
      const msg = extrairErroApi(err)
      toast.error(msg)
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!monitoramento) {
      toast.error('Monitoramento não identificado')
      return
    }

    setDeleting(true)
    try {
      await api.delete(`/monitoramento-ativo/${monitoramento.id}/`)
      toast.success('Monitoramento removido com sucesso')
      setShowDeleteConfirm(false)
      onSuccess()
    } catch {
      toast.error('Erro ao remover monitoramento')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Editar Monitoramento Ativo' : 'Adicionar Monitoramento Ativo'}
            </DialogTitle>
            {targetUsinaNome && (
              <DialogDescription>{targetUsinaNome}</DialogDescription>
            )}
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="data-inicio">Data de Início</Label>
              <Input
                id="data-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="meses">Duração (meses)</Label>
              <Input
                id="meses"
                type="number"
                min="1"
                step="1"
                value={meses}
                onChange={(e) => setMeses(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="valor-mensal">Valor mensal (R$)</Label>
              <Input
                id="valor-mensal"
                type="number"
                min="0"
                step="0.01"
                value={valorMensal}
                onChange={(e) => setValorMensal(e.target.value)}
                placeholder="Valor mensal (opcional)"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="observacoes">Observações</Label>
              <Input
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações (opcional)"
              />
            </div>

            {dataFimPreview && (
              <p className="text-sm text-muted-foreground">
                Data fim prevista:{' '}
                <span className="font-medium">{dataFimPreview}</span>
              </p>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <DialogFooter className="flex justify-between">
              <div className="flex gap-2">
                {isEditing && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2Icon className="size-4 mr-1" />
                    Remover
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Monitoramento Ativo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o monitoramento ativo da usina {targetUsinaNome}?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                void handleDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
