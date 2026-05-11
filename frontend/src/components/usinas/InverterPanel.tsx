/**
 * InverterPanel — side drawer com detalhes do inversor selecionado.
 * Adaptado de claude-design/usina-detail.jsx::InverterPanel.
 *
 * Mostra KPIs (Potência/Hoje/Total), Saída CA, Entrada CC e uma
 * sparkline 24h placeholder (curva sintética parametrizada pela
 * potência atual, até existir endpoint de série temporal).
 */
import { useEffect, type ReactNode } from 'react'
import { XIcon } from 'lucide-react'
import type { InversorResumo } from '@/types/usinas'
import { StatusDot, Sparkline, type Status } from '@/components/trylab/primitives'

function statusInversor(inv: InversorResumo): Status {
  const e = inv.ultimo_snapshot?.estado
  if (!e || e === 'offline') return 'offline'
  if (e === 'aviso') return 'warning'
  return 'online'
}

function statusLabel(s: Status): string {
  if (s === 'online') return 'Online'
  if (s === 'warning') return 'Atenção'
  return 'Offline'
}

interface RowProps {
  label: string
  value: ReactNode
  mono?: boolean
}

function Row({ label, value, mono }: RowProps) {
  return (
    <div className="tl-ip-row">
      <span>{label}</span>
      <strong className={mono ? 'mono' : undefined}>{value ?? '—'}</strong>
    </div>
  )
}

function fmt(value: number | null | undefined, digits = 2, unit?: string): string {
  if (value === null || value === undefined) return '—'
  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return unit ? `${formatted} ${unit}` : formatted
}

interface InverterPanelProps {
  inv: InversorResumo
  onClose: () => void
}

export function InverterPanel({ inv, onClose }: InverterPanelProps) {
  const snap = inv.ultimo_snapshot
  const status = statusInversor(inv)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Curva sintética 24h proporcional à potência atual — até existir endpoint
  // /inversores/<id>/serie?dias=1, isso é só um placeholder visual.
  const intensidade = snap?.pac_kw ? Math.max(0.05, Math.min(snap.pac_kw / 5, 1.4)) : 0.05
  const sparkData = Array.from({ length: 48 }, (_, i) => {
    const h = i / 2
    const sun = Math.max(0, Math.sin(((h - 5.5) / 14) * Math.PI))
    return sun * intensidade
  })

  const numStrings = snap?.strings_mppt ? Object.keys(snap.strings_mppt).length : 0

  return (
    <>
      <div className="tl-ip-backdrop" onClick={onClose} role="presentation" />
      <aside className="tl-ip" role="dialog" aria-labelledby="ip-title">
        <header className="tl-ip-head">
          <div>
            <div className="tl-ip-eyebrow">
              <StatusDot status={status} /> Microinversor · {statusLabel(status)}
            </div>
            <div className="tl-ip-title" id="ip-title">
              {inv.modelo || 'Inversor'}
            </div>
            <div className="tl-ip-sub">
              SN <code>{inv.numero_serie}</code>
            </div>
          </div>
          <button
            type="button"
            className="tl-ip-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <XIcon className="size-4" />
          </button>
        </header>

        <div className="tl-ip-kpis">
          <div>
            <em>Potência atual</em>
            <strong>
              {fmt(snap?.pac_kw, 3)} <span>kW</span>
            </strong>
          </div>
          <div>
            <em>Energia hoje</em>
            <strong>
              {fmt(snap?.energia_hoje_kwh, 1)} <span>kWh</span>
            </strong>
          </div>
          <div>
            <em>Total</em>
            <strong>
              {fmt(snap?.energia_total_kwh, 1)} <span>kWh</span>
            </strong>
          </div>
        </div>

        <div className="tl-ip-section">
          <div className="tl-ip-section-h">Saída CA</div>
          <Row label="Tensão" value={fmt(snap?.tensao_ac_v, 1, 'V')} mono />
          <Row label="Corrente" value={fmt(snap?.corrente_ac_a, 2, 'A')} mono />
          <Row label="Frequência" value={fmt(snap?.frequencia_hz, 2, 'Hz')} mono />
          <Row label="Temperatura" value={fmt(snap?.temperatura_c, 1, '°C')} mono />
        </div>

        <div className="tl-ip-section">
          <div className="tl-ip-section-h">Entrada CC</div>
          <Row label="Tensão DC" value={fmt(snap?.tensao_dc_v, 1, 'V')} mono />
          <Row label="Corrente DC" value={fmt(snap?.corrente_dc_a, 2, 'A')} mono />
          <Row
            label="Strings"
            value={numStrings > 0 ? `${numStrings} ${numStrings === 1 ? 'ativa' : 'ativas'}` : '—'}
            mono
          />
        </div>

        <div className="tl-ip-section">
          <div className="tl-ip-section-h">Curva de potência · 24 h</div>
          <div style={{ padding: '8px 0' }}>
            <Sparkline data={sparkData} width={360} height={56} />
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--tl-muted-fg)' }}>
            Pré-visualização sintética — gráfico real requer endpoint de série temporal.
          </div>
        </div>

        <div className="tl-ip-actions">
          <button type="button" className="tl-btn ghost">
            Ver histórico
          </button>
          <button type="button" className="tl-btn-primary">
            Abrir chamado
          </button>
        </div>
      </aside>
    </>
  )
}
