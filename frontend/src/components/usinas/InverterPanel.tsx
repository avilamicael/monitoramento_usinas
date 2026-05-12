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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import type { InversorResumo } from '@/types/usinas'
import { StatusDot, type Status } from '@/components/trylab/primitives'
import { fmtRelativo, fmtDataHora } from '@/lib/format'

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
  // 24 buckets de 1h (em vez de 48 de 30min) pra ficar legível em barras.
  const intensidade = snap?.pac_kw ? Math.max(0.05, Math.min(snap.pac_kw / 5, 1.4)) : 0.05
  const sparkData = Array.from({ length: 24 }, (_, h) => {
    const sun = Math.max(0, Math.sin(((h - 5.5) / 14) * Math.PI))
    return {
      hora: `${String(h).padStart(2, '0')}h`,
      potencia: Number((sun * intensidade).toFixed(3)),
    }
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
            {snap?.coletado_em && (
              <div
                className="tl-ip-sub"
                title={fmtDataHora(snap.coletado_em)}
                style={{ marginTop: 2 }}
              >
                Última coleta {fmtRelativo(snap.coletado_em)}
              </div>
            )}
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
            <em>Potência (última coleta)</em>
            <strong>
              {fmt(snap?.pac_kw, 3)} <span>kW</span>
            </strong>
          </div>
          <div>
            <em>Energia (última coleta)</em>
            <strong>
              {fmt(snap?.energia_hoje_kwh, 1)} <span>kWh</span>
            </strong>
          </div>
          <div>
            <em>Total acumulado</em>
            <strong>
              {fmt(snap?.energia_total_kwh, 1)} <span>kWh</span>
            </strong>
          </div>
        </div>

        <div className="tl-ip-section">
          <div className="tl-ip-section-h">Saída CA · última coleta</div>
          <Row label="Tensão" value={fmt(snap?.tensao_ac_v, 1, 'V')} mono />
          <Row label="Corrente" value={fmt(snap?.corrente_ac_a, 2, 'A')} mono />
          <Row label="Frequência" value={fmt(snap?.frequencia_hz, 2, 'Hz')} mono />
          <Row label="Temperatura" value={fmt(snap?.temperatura_c, 1, '°C')} mono />
        </div>

        <div className="tl-ip-section">
          <div className="tl-ip-section-h">Entrada CC · última coleta</div>
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
          <div style={{ padding: '8px 0', height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sparkData}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="2 4"
                  vertical={false}
                  stroke="oklch(1 0 0 / 0.06)"
                />
                <XAxis
                  dataKey="hora"
                  tick={{ fontSize: 10, fill: 'oklch(0.62 0.013 235)' }}
                  tickLine={false}
                  axisLine={false}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'oklch(0.62 0.013 235)' }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  tickFormatter={(v) => `${v} kW`}
                />
                <ReTooltip
                  cursor={{ fill: 'oklch(1 0 0 / 0.04)' }}
                  formatter={(value) => [
                    `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kW`,
                    'Potência',
                  ]}
                  labelFormatter={(label) => `Hora ${label}`}
                  contentStyle={{
                    background: 'oklch(0.14 0.025 260 / 0.96)',
                    border: '1px solid oklch(1 0 0 / 0.12)',
                    borderRadius: 8,
                    color: 'var(--tl-fg)',
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="potencia"
                  fill="var(--tl-accent)"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={14}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--tl-muted-fg)' }}>
            Pré-visualização sintética — gráfico real requer endpoint de série temporal.
          </div>
        </div>

        {/* TODO(futuro): considerar reintroduzir "Ver histórico" levando
            para /alertas?inversor=<id> ou para uma rota de detalhe do
            inversor. Removido por ora para não expor ação sem
            destino funcional.
        <div className="tl-ip-actions">
          <button type="button" className="tl-btn ghost">
            Ver histórico
          </button>
        </div>
        */}
      </aside>
    </>
  )
}
