/**
 * Seção "Rede Elétrica" da página de detalhe da usina.
 *
 * Exibe a tensão nominal selecionada e os thresholds calculados
 * automaticamente para as regras de subtensão e sobretensão. Permite ao
 * admin alternar entre 110V (rede 127V efetiva) e 220V — o backend
 * recalcula os limites automaticamente quando os campos manuais
 * `tensao_ac_limite_v` / `tensao_ac_limite_minimo_v` estão nos defaults.
 */
import { useEffect, useState } from 'react'
import { PencilIcon } from 'lucide-react'
import { toast } from 'sonner'

import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TensaoNominalV } from '@/types/usinas'

interface RedeEletricaCardProps {
  usinaId: string
  usinaNome: string
  tensaoNominalV: TensaoNominalV
  tensaoSubtensaoV: number
  tensaoSobretensaoV: number
  onSuccess: () => void
}

const NOMINAL_LABELS: Record<TensaoNominalV, string> = {
  110: '110 V (Bifásica/Monofásica 127V)',
  220: '220 V (Bifásica/Trifásica 220V)',
}

// Espelha o helper backend `_helpers.threshold_*`. Mantém em sincronia.
const NOMINAL_EFETIVO: Record<TensaoNominalV, number> = { 110: 127, 220: 220 }

function formatarV(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} V`
}

function thresholdsCalculados(nominal: TensaoNominalV): {
  subtensao: number
  sobretensao: number
} {
  const efetivo = NOMINAL_EFETIVO[nominal]
  return {
    subtensao: Math.round(efetivo * 0.85 * 10) / 10,
    sobretensao: Math.round(efetivo * 1.1 * 10) / 10,
  }
}

export function RedeEletricaCard({
  usinaId,
  usinaNome,
  tensaoNominalV,
  tensaoSubtensaoV,
  tensaoSobretensaoV,
  onSuccess,
}: RedeEletricaCardProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Rede Elétrica
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setOpen(true)}
              aria-label="Editar tensão nominal"
            >
              <PencilIcon className="size-3.5" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-y-3">
            <div>
              <dt className="text-xs text-muted-foreground">Tensão nominal</dt>
              <dd className="text-sm font-medium">
                {NOMINAL_LABELS[tensaoNominalV]}
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Limite de subtensão
                </dt>
                <dd className="text-sm font-medium">
                  {formatarV(tensaoSubtensaoV)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Limite de sobretensão
                </dt>
                <dd className="text-sm font-medium">
                  {formatarV(tensaoSobretensaoV)}
                </dd>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Calculados automaticamente a partir da tensão nominal (85%
              para subtensão, 110% para sobretensão). Para a opção
              <span className="font-medium"> 110 V</span> usamos
              <span className="font-medium"> 127 V</span> como nominal
              efetivo (NBR 5410). Ajustes manuais nos limites sobrescrevem
              esse cálculo.
            </p>
          </dl>
        </CardContent>
      </Card>

      <RedeEletricaDialog
        open={open}
        usinaId={usinaId}
        usinaNome={usinaNome}
        tensaoNominalV={tensaoNominalV}
        onClose={() => setOpen(false)}
        onSuccess={() => {
          setOpen(false)
          onSuccess()
        }}
      />
    </>
  )
}

interface RedeEletricaDialogProps {
  open: boolean
  usinaId: string
  usinaNome: string
  tensaoNominalV: TensaoNominalV
  onClose: () => void
  onSuccess: () => void
}

function RedeEletricaDialog({
  open,
  usinaId,
  usinaNome,
  tensaoNominalV,
  onClose,
  onSuccess,
}: RedeEletricaDialogProps) {
  const [valor, setValor] = useState<TensaoNominalV>(tensaoNominalV)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setValor(tensaoNominalV)
  }, [open, tensaoNominalV])

  const calc = thresholdsCalculados(valor)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.patch(`/usinas/${usinaId}/`, { tensao_nominal_v: valor })
      toast.success('Tensão nominal atualizada.')
      onSuccess()
    } catch {
      toast.error('Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rede Elétrica</DialogTitle>
          <DialogDescription>{usinaNome}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tensao_nominal">Tensão nominal</Label>
            <Select
              value={String(valor)}
              onValueChange={(v) => setValor(Number(v) as TensaoNominalV)}
            >
              <SelectTrigger id="tensao_nominal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="220">{NOMINAL_LABELS[220]}</SelectItem>
                <SelectItem value="110">{NOMINAL_LABELS[110]}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Define automaticamente o limite de subtensão (
              {formatarV(calc.subtensao)}) e de sobretensão (
              {formatarV(calc.sobretensao)}). Para 110 V o sistema usa
              127 V como nominal efetivo (NBR 5410).
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
