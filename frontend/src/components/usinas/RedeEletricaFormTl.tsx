/**
 * Form de Rede Elétrica em estilo TryLab.
 * Substitui o Dialog do RedeEletricaCard quando o usuário entra em modo
 * de edição na UsinaDetalhePage.
 *
 * Lógica idêntica ao componente antigo:
 *  - Tensão nominal (110/220) → recalcula limites automáticos (91%/110%).
 *  - Subtensão e sobretensão editáveis manualmente (faixas 100-250 / 150-320).
 *  - Botão "Usar automático" preenche com base no nominal.
 *  - PATCH /usinas/<id>/ com {tensao_nominal_v, tensao_ac_limite_v,
 *    tensao_ac_limite_minimo_v}.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2Icon } from 'lucide-react'
import { api } from '@/lib/api'
import type { TensaoNominalV } from '@/types/usinas'

const NOMINAL_EFETIVO: Record<TensaoNominalV, number> = { 110: 127, 220: 220 }

function thresholdsCalculados(nominal: TensaoNominalV): {
  subtensao: number
  sobretensao: number
} {
  const efetivo = NOMINAL_EFETIVO[nominal]
  return {
    subtensao: Math.round(efetivo * 0.91 * 10) / 10,
    sobretensao: Math.round(efetivo * 1.1 * 10) / 10,
  }
}

interface RedeEletricaFormTlProps {
  usinaId: string
  tensaoNominalV: TensaoNominalV
  tensaoSubtensaoV: number
  tensaoSobretensaoV: number
  onSuccess: () => void
}

export function RedeEletricaFormTl({
  usinaId,
  tensaoNominalV,
  tensaoSubtensaoV,
  tensaoSobretensaoV,
  onSuccess,
}: RedeEletricaFormTlProps) {
  const [nominal, setNominal] = useState<TensaoNominalV>(tensaoNominalV)
  const [subtensao, setSubtensao] = useState<string>(String(tensaoSubtensaoV))
  const [sobretensao, setSobretensao] = useState<string>(String(tensaoSobretensaoV))
  const [saving, setSaving] = useState(false)

  const calc = thresholdsCalculados(nominal)

  function aplicarAutomatico() {
    setSubtensao(String(calc.subtensao))
    setSobretensao(String(calc.sobretensao))
  }

  async function salvar() {
    const sub = Number(subtensao)
    const sobre = Number(sobretensao)
    if (!Number.isFinite(sub) || sub < 100 || sub > 250) {
      toast.error('Limite de subtensão deve estar entre 100V e 250V.')
      return
    }
    if (!Number.isFinite(sobre) || sobre < 150 || sobre > 320) {
      toast.error('Limite de sobretensão deve estar entre 150V e 320V.')
      return
    }
    if (sobre <= sub) {
      toast.error('Sobretensão precisa ser maior que subtensão.')
      return
    }
    setSaving(true)
    try {
      await api.patch(`/usinas/${usinaId}/`, {
        tensao_nominal_v: nominal,
        tensao_ac_limite_v: sobre,
        tensao_ac_limite_minimo_v: sub,
      })
      toast.success('Rede elétrica atualizada.')
      onSuccess()
    } catch {
      toast.error('Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="tl-form-grid">
        <div className="tl-field">
          <label className="tl-field-label" htmlFor="rede-nominal">
            Tensão nominal
          </label>
          <select
            id="rede-nominal"
            className="tl-input tl-select"
            value={String(nominal)}
            onChange={(e) => setNominal(Number(e.target.value) as TensaoNominalV)}
            disabled={saving}
          >
            <option value="220">220 V</option>
            <option value="110">127 V</option>
          </select>
        </div>

        <div />

        <div className="tl-field">
          <label className="tl-field-label" htmlFor="rede-sub">
            Limite de subtensão (V)
          </label>
          <input
            id="rede-sub"
            type="number"
            className="tl-input"
            min={100}
            max={250}
            step={0.1}
            value={subtensao}
            onChange={(e) => setSubtensao(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className="tl-field">
          <label className="tl-field-label" htmlFor="rede-sobre">
            Limite de sobretensão (V)
          </label>
          <input
            id="rede-sobre"
            type="number"
            className="tl-input"
            min={150}
            max={320}
            step={0.1}
            value={sobretensao}
            onChange={(e) => setSobretensao(e.target.value)}
            disabled={saving}
          />
        </div>
      </div>

      <p className="tl-fine-text">
        Cálculo automático para {nominal === 110 ? '127' : '220'} V nominal efetivo:
        subtensão <strong>{calc.subtensao.toFixed(1)} V</strong>, sobretensão{' '}
        <strong>{calc.sobretensao.toFixed(1)} V</strong>. Ajustes manuais
        sobrescrevem o cálculo (NBR 5410).
      </p>

      <div className="tl-form-actions">
        <button
          type="button"
          className="tl-btn ghost"
          onClick={aplicarAutomatico}
          disabled={saving}
        >
          Usar automático
        </button>
        <button
          type="button"
          className="tl-btn-primary"
          onClick={() => void salvar()}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2Icon className="size-3.5 animate-spin" />
              Salvando…
            </>
          ) : (
            'Salvar'
          )}
        </button>
      </div>
    </div>
  )
}
