/**
 * Primitives do design TryLab — Fase B do redesign.
 * Componentes pequenos e reutilizáveis consumidos pelas páginas migradas.
 * Estilos em styles/trylab.css (seção "Primitives (Fase B)").
 */
import type { CSSProperties, ReactNode } from 'react'

// ── Pill ───────────────────────────────────────────────────────────
export type PillTone = 'ok' | 'warn' | 'crit' | 'ghost'

interface PillProps {
  tone?: PillTone
  children: ReactNode
}

export function Pill({ tone, children }: PillProps) {
  return (
    <span className="tl-pill" data-tone={tone}>
      {children}
    </span>
  )
}

// ── StatusDot ──────────────────────────────────────────────────────
export type Status = 'online' | 'warning' | 'offline'

export function StatusDot({ status }: { status: Status }) {
  return <span className="tl-dot" data-status={status} aria-hidden />
}

// ── Card ───────────────────────────────────────────────────────────
interface CardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export function Card({ children, className, style }: CardProps) {
  const cls = className ? `tl-card ${className}` : 'tl-card'
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  )
}

export function CardHead({ children }: { children: ReactNode }) {
  return <div className="tl-card-head">{children}</div>
}

interface CardTitleProps {
  children: ReactNode
  count?: number | string
  sub?: ReactNode
}

export function CardTitle({ children, count, sub }: CardTitleProps) {
  return (
    <div>
      <div className="tl-card-title">
        <span>{children}</span>
        {count !== undefined && <span className="tl-card-count">{count}</span>}
      </div>
      {sub && <div className="tl-card-sub">{sub}</div>}
    </div>
  )
}

// ── Sparkline ──────────────────────────────────────────────────────
interface SparklineProps {
  data: number[]
  color?: string
  width?: number
  height?: number
}

export function Sparkline({
  data,
  color = 'var(--tl-accent)',
  width = 130,
  height = 28,
}: SparklineProps) {
  if (data.length === 0) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const dx = data.length === 1 ? 0 : width / (data.length - 1)
  const points = data
    .map(
      (v, i) =>
        `${(i * dx).toFixed(1)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(1)}`,
    )
    .join(' ')
  return (
    <svg
      className="tl-spark"
      width={width}
      height={height}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── KPI card ───────────────────────────────────────────────────────
interface KpiProps {
  label: string
  value: ReactNode
  unit?: string
  sub?: ReactNode
  delta?: string
  tone?: 'ok' | 'warn' | 'crit'
  big?: boolean
  bar?: number
  spark?: number[]
  sparkColor?: string
}

export function Kpi({
  label,
  value,
  unit,
  sub,
  delta,
  tone,
  big,
  bar,
  spark,
  sparkColor,
}: KpiProps) {
  return (
    <div className={big ? 'tl-kpi tl-kpi-big' : 'tl-kpi'} data-tone={tone}>
      <div className="tl-kpi-label">{label}</div>
      <div className="tl-kpi-value">
        {value}
        {unit && <span className="tl-kpi-unit">{unit}</span>}
      </div>
      {sub && <div className="tl-kpi-sub">{sub}</div>}
      {delta && <div className="tl-kpi-delta">{delta}</div>}
      {bar !== undefined && (
        <div className="tl-kpi-bar">
          <i style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} />
        </div>
      )}
      {spark && <Sparkline data={spark} color={sparkColor} />}
    </div>
  )
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="tl-kpi-grid">{children}</div>
}

// ── Info field (label + value) ─────────────────────────────────────
interface InfoProps {
  label: string
  value: ReactNode
  mono?: boolean
  tone?: 'ok' | 'warn' | 'crit'
}

export function Info({ label, value, mono, tone }: InfoProps) {
  return (
    <div className="tl-info">
      <em>{label}</em>
      <strong className={mono ? 'mono' : undefined} data-tone={tone}>
        {value}
      </strong>
    </div>
  )
}

export function InfoGrid({ children }: { children: ReactNode }) {
  return <div className="tl-info-grid">{children}</div>
}

// ── Stat (label + valor compacto, usado em grids de clima/finance) ─
interface StatProps {
  label: string
  value: ReactNode
  unit?: string
  sub?: string
}

export function Stat({ label, value, unit, sub }: StatProps) {
  return (
    <div className="tl-stat">
      <em>{label}</em>
      <strong>
        {value}
        {unit && <span>{unit}</span>}
      </strong>
      {sub && <span className="tl-stat-sub">{sub}</span>}
    </div>
  )
}

// ── Soon overlay (bloco borrado com badge "Em breve") ──────────────
interface SoonProps {
  children: ReactNode
  text?: string
}

export function Soon({ children, text }: SoonProps) {
  return (
    <div className="tl-soon">
      {children}
      <div className="tl-soon-overlay">
        <div className="tl-soon-badge">
          <span className="tl-soon-pulse" />
          Em breve
        </div>
        {text && <div className="tl-soon-text">{text}</div>}
      </div>
    </div>
  )
}

// ── Row layout (1 ou 2 colunas) ────────────────────────────────────
export function Row({ children }: { children: ReactNode }) {
  return <section className="tl-row">{children}</section>
}

export function Row2({ children }: { children: ReactNode }) {
  return <section className="tl-row tl-row-2">{children}</section>
}
