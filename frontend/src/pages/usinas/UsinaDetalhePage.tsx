import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeftIcon,
  Loader2Icon,
  MapPinIcon,
  ClockIcon,
  CpuIcon,
  DownloadIcon,
  SettingsIcon,
  XIcon,
} from 'lucide-react'
import { useUsina } from '@/hooks/use-usinas'
import { useAlertas } from '@/hooks/use-alertas'
import { StatusGarantiaBadge } from '@/components/usinas/StatusGarantiaBadge'
import { AtivoToggleButton } from '@/components/usinas/AtivoToggleButton'
import { LocalizacaoSection } from '@/components/usinas/LocalizacaoSection'
import { RedeEletricaCard } from '@/components/usinas/RedeEletricaCard'
import type { InversorResumo, UsinaDetalhe } from '@/types/usinas'
import { CATEGORIA_LABELS, type AlertaResumo } from '@/types/alertas'
import { PROVEDOR_LABELS } from '@/lib/provedores'
import {
  Pill,
  StatusDot,
  Kpi,
  KpiGrid,
  Card,
  CardHead,
  CardTitle,
  Info,
  InfoGrid,
  Stat,
  Soon,
  type Status,
} from '@/components/trylab/primitives'
import { PanelDiagram } from '@/components/usinas/PanelDiagram'
import { InverterPanel } from '@/components/usinas/InverterPanel'

// ── Helpers ─────────────────────────────────────────────────────────

function formatarNumero(valor: number | null | undefined, decimais = 2): string {
  if (valor === null || valor === undefined) return '—'
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  })
}

function formatarUltimaColeta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const sec = Math.floor((Date.now() - then) / 1000)
  if (sec < 0) return new Date(iso).toLocaleString('pt-BR')
  if (sec < 60) return `há ${sec}s`
  if (sec < 3600) return `há ${Math.floor(sec / 60)} min`
  if (sec < 86400) return `há ${Math.floor(sec / 3600)} h`
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatarRelativo(iso: string): string {
  const then = new Date(iso).getTime()
  const sec = Math.floor((Date.now() - then) / 1000)
  if (sec < 60) return `há ${sec}s`
  if (sec < 3600) return `há ${Math.floor(sec / 60)} min`
  if (sec < 86400) return `há ${Math.floor(sec / 3600)} h`
  if (sec < 86400 * 7) return `há ${Math.floor(sec / 86400)} d`
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function co2EvitadoTon(kwhTotal: number | null | undefined): number {
  if (!kwhTotal || kwhTotal <= 0) return 0
  return kwhTotal * 0.0000817
}

interface StatusInfo {
  dot: Status
  tone: 'ok' | 'warn' | 'crit'
  label: string
}

function derivarStatusUsina(
  inversoresOnline: number,
  totalInversores: number,
  alertas: AlertaResumo[],
): StatusInfo {
  const ativos = alertas.filter((a) => a.estado === 'ativo')
  const critico = ativos.some((a) => a.nivel === 'critico')
  if (critico) return { dot: 'offline', tone: 'crit', label: 'Crítico' }
  const aviso = ativos.some((a) => a.nivel === 'aviso')
  const algumOffline = totalInversores > 0 && inversoresOnline < totalInversores
  if (aviso || algumOffline) return { dot: 'warning', tone: 'warn', label: 'Atenção' }
  return { dot: 'online', tone: 'ok', label: 'Saudável' }
}

function statusInversor(inv: InversorResumo): Status {
  const e = inv.ultimo_snapshot?.estado
  if (!e || e === 'offline') return 'offline'
  if (e === 'aviso') return 'warning'
  return 'online'
}

// ── Página ──────────────────────────────────────────────────────────

export default function UsinaDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const { data, loading, error, refetch } = useUsina(id!)
  const alertasQ = useAlertas({ usina: id })
  const [openInvIdx, setOpenInvIdx] = useState<number | null>(null)
  const [period, setPeriod] = useState<'hoje' | 'semana' | 'mes' | 'ano'>('hoje')

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return <div className="py-8 text-center text-destructive">{error}</div>
  }

  if (data === null) {
    return <div className="py-8 text-center text-muted-foreground">Usina não encontrada</div>
  }

  const snap = data.ultimo_snapshot
  const inversoresOnline = data.inversores.filter(
    (inv) => inv.ultimo_snapshot?.estado === 'normal',
  ).length
  const totalInversores = data.inversores.length
  const alertasResultado = alertasQ.data?.results ?? []
  const status = derivarStatusUsina(inversoresOnline, totalInversores, alertasResultado)
  const enderecoBreve = [data.cidade, data.estado].filter(Boolean).join(' · ')
  const enderecoCompleto = [data.endereco, enderecoBreve].filter(Boolean).join(' — ')

  return (
    <div className="tl-scr">
      {/* ── Header ── */}
      <header className="tl-scr-head" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="tl-crumb">
            <Link
              to="/usinas"
              className="tl-link-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ArrowLeftIcon className="size-3.5" /> Frota
            </Link>
            <span>/</span>
            <span>{data.nome}</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              marginTop: 6,
            }}
          >
            <h1 style={{ margin: 0 }}>{data.nome}</h1>
            <Pill tone={status.tone}>
              <StatusDot status={status.dot} />
              {status.label}
            </Pill>
            <Pill tone="ghost">{PROVEDOR_LABELS[data.provedor] || data.provedor}</Pill>
            <Pill tone="ghost">{data.capacidade_kwp} kWp</Pill>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 18,
              flexWrap: 'wrap',
              marginTop: 8,
              fontSize: 12,
              color: 'var(--tl-muted-fg)',
            }}
          >
            {enderecoCompleto && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <MapPinIcon className="size-3" /> {enderecoCompleto}
              </span>
            )}
            {snap && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <ClockIcon className="size-3" /> Última coleta:{' '}
                <strong style={{ color: 'var(--tl-fg)', fontWeight: 500 }}>
                  {formatarUltimaColeta(snap.coletado_em)}
                </strong>
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <CpuIcon className="size-3" />{' '}
              <strong style={{ color: 'var(--tl-fg)', fontWeight: 500 }}>
                {inversoresOnline}/{totalInversores}
              </strong>{' '}
              inversores online
            </span>
          </div>
        </div>
        <div className="tl-head-actions">
          <StatusGarantiaBadge status={data.status_garantia} />
          <AtivoToggleButton
            usinaId={data.id}
            ativo={data.ativo}
            onChange={() => void refetch()}
          />
        </div>
      </header>

      {/* ── KPIs ── */}
      {snap && (
        <KpiGrid>
          <Kpi
            label="Potência atual"
            value={formatarNumero(snap.potencia_kw)}
            unit="kW"
            big
            tone={status.tone}
          />
          <Kpi label="Energia hoje" value={formatarNumero(snap.energia_hoje_kwh)} unit="kWh" />
          <Kpi label="Energia mês" value={formatarNumero(snap.energia_mes_kwh, 1)} unit="kWh" />
          <Kpi
            label="Energia total"
            value={
              snap.energia_total_kwh && snap.energia_total_kwh >= 1000
                ? formatarNumero(snap.energia_total_kwh / 1000, 2)
                : formatarNumero(snap.energia_total_kwh, 1)
            }
            unit={snap.energia_total_kwh && snap.energia_total_kwh >= 1000 ? 'MWh' : 'kWh'}
            sub="acumulado"
          />
          <SoonInline>
            <Kpi label="Performance" value="—" unit="%" bar={0} />
          </SoonInline>
          <SoonInline>
            <Kpi label="Receita hoje" value="—" sub="exemplo" />
          </SoonInline>
          <Kpi
            label="CO₂ evitado"
            value={co2EvitadoTon(snap.energia_total_kwh).toFixed(1)}
            unit="t"
            sub="estimado"
          />
        </KpiGrid>
      )}

      {/* ── Gráfico + Clima ── */}
      <section className="tl-row tl-row-2">
        <GenChartCard period={period} setPeriod={setPeriod} />
        <ClimateCard cidade={data.cidade || 'Localização da usina'} estado={data.estado} />
      </section>

      {/* ── 3D Panel Diagram ── */}
      <section className="tl-row">
        <PanelDiagram
          inversores={data.inversores}
          capacidadeKwp={data.capacidade_kwp}
          onSelectInverter={setOpenInvIdx}
        />
      </section>

      {/* ── Inversores + Alertas ── */}
      <section className="tl-row tl-row-2">
        <InvertersTableCard inversores={data.inversores} onSelect={setOpenInvIdx} />
        <AlertsHistoryCard alertas={alertasResultado} loading={alertasQ.loading} />
      </section>

      {/* ── Info + Rede elétrica ── */}
      <section className="tl-row tl-row-2">
        <InfoCard data={data} status={status} onSaved={() => void refetch()} />
        <GridCard data={data} onSaved={() => void refetch()} />
      </section>

      {/* ── Financeiro + Timeline ── */}
      <section className="tl-row tl-row-2">
        <FinanceCard />
        <TimelineCard />
      </section>

      {/* ── Documentos ── */}
      <section className="tl-row">
        <DocsCard />
      </section>

      {openInvIdx !== null && data.inversores[openInvIdx] && (
        <InverterPanel
          inv={data.inversores[openInvIdx]}
          onClose={() => setOpenInvIdx(null)}
        />
      )}
    </div>
  )
}

// ── Soon inline: variante do Soon para Kpi pequeno ─────────────────
function SoonInline({ children }: { children: ReactNode }) {
  return (
    <div className="tl-soon" style={{ borderRadius: 12, overflow: 'hidden' }}>
      {children}
      <div className="tl-soon-overlay" style={{ padding: 8 }}>
        <div className="tl-soon-badge" style={{ padding: '4px 10px', fontSize: 10.5 }}>
          <span className="tl-soon-pulse" />
          Em breve
        </div>
      </div>
    </div>
  )
}

// ── Gen chart ──────────────────────────────────────────────────────
interface GenChartCardProps {
  period: 'hoje' | 'semana' | 'mes' | 'ano'
  setPeriod: (p: 'hoje' | 'semana' | 'mes' | 'ano') => void
}

function GenChartCard({ period, setPeriod }: GenChartCardProps) {
  // Série mock — substituída quando endpoint /usinas/<id>/serie existir
  const series =
    period === 'hoje'
      ? Array.from({ length: 24 }, (_, h) => {
          const sun = Math.max(0, Math.sin(((h - 5.5) / 14) * Math.PI))
          return sun * 4.8
        })
      : period === 'semana'
        ? [22, 28, 19, 31, 26, 30, 24]
        : period === 'mes'
          ? Array.from({ length: 30 }, (_, i) => 18 + Math.sin(i * 0.7) * 8 + (i % 5))
          : ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map(
              (_, i) => 380 + Math.sin(i * 0.6) * 120,
            )

  const labels =
    period === 'hoje'
      ? Array.from({ length: 24 }, (_, h) => `${h}h`)
      : period === 'semana'
        ? ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
        : period === 'mes'
          ? Array.from({ length: 30 }, (_, i) => `${i + 1}`)
          : ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  const unit = period === 'hoje' ? 'kW' : 'kWh'
  const useBars = period !== 'hoje'
  const W = 720
  const H = 220
  const PADL = 36
  const PADR = 12
  const PADT = 12
  const PADB = 24
  const max = Math.max(...series, 1) * 1.1
  const innerW = W - PADL - PADR
  const innerH = H - PADT - PADB
  const dx = series.length === 1 ? 0 : innerW / (series.length - 1)
  const xy = series.map((v, i) => [PADL + i * dx, PADT + innerH - (v / max) * innerH] as const)
  const path = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${path} L${(PADL + innerW).toFixed(1)} ${PADT + innerH} L${PADL} ${PADT + innerH} Z`
  const total = series.reduce((a, b) => a + b, 0)
  const peak = Math.max(...series)

  return (
    <Soon text="Gráfico real precisa do endpoint /usinas/<id>/serie. Em desenvolvimento.">
      <Card className="tl-chart-card">
        <CardHead>
          <CardTitle
            sub={
              useBars
                ? `Total: ${total.toFixed(1)} ${unit} · Pico ${peak.toFixed(1)} ${unit}`
                : `Pico: ${peak.toFixed(2)} ${unit}`
            }
          >
            Geração
          </CardTitle>
          <div className="tl-period">
            {(['hoje', 'semana', 'mes', 'ano'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={period === k ? 'on' : ''}
                onClick={() => setPeriod(k)}
              >
                {k === 'hoje' ? 'Hoje' : k === 'semana' ? '7 dias' : k === 'mes' ? '30 dias' : '12 meses'}
              </button>
            ))}
          </div>
        </CardHead>
        <svg viewBox={`0 0 ${W} ${H}`} className="tl-chart" preserveAspectRatio="none">
          <defs>
            <linearGradient id="tl-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--tl-accent)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--tl-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
            <line
              key={i}
              x1={PADL}
              x2={W - PADR}
              y1={PADT + innerH * p}
              y2={PADT + innerH * p}
              stroke="var(--tl-line-soft)"
              strokeDasharray={i === 4 ? '0' : '2 4'}
            />
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
            <text
              key={'l' + i}
              x={PADL - 6}
              y={PADT + innerH * (1 - p) + 4}
              textAnchor="end"
              fill="var(--tl-muted-fg)"
              fontSize="10"
            >
              {(max * p).toFixed(p === 0 ? 0 : 1)}
            </text>
          ))}
          {useBars
            ? series.map((v, i) => {
                const x = PADL + i * dx - dx * 0.32
                const h = (v / max) * innerH
                return (
                  <rect
                    key={i}
                    x={x}
                    y={PADT + innerH - h}
                    width={dx * 0.64}
                    height={h}
                    rx="2"
                    fill="var(--tl-accent)"
                    opacity={0.85}
                  />
                )
              })
            : [
                <path key="area" d={area} fill="url(#tl-chart-fill)" />,
                <path
                  key="line"
                  d={path}
                  fill="none"
                  stroke="var(--tl-accent)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />,
              ]}
          {labels.map((l, i) => {
            const skip = labels.length > 14 ? Math.ceil(labels.length / 8) : 1
            if (i % skip !== 0 && i !== labels.length - 1) return null
            return (
              <text
                key={'x' + i}
                x={PADL + i * dx}
                y={H - 6}
                textAnchor="middle"
                fill="var(--tl-muted-fg)"
                fontSize="10"
              >
                {l}
              </text>
            )
          })}
        </svg>
      </Card>
    </Soon>
  )
}

// ── Clima ──────────────────────────────────────────────────────────
function ClimateCard({ cidade, estado }: { cidade: string; estado?: string | null }) {
  const local = [cidade, estado].filter(Boolean).join(' · ')
  return (
    <Soon text="Integração com estação meteorológica em desenvolvimento.">
      <Card className="tl-clim">
        <CardHead>
          <CardTitle sub={`${local} · agora`}>Clima local</CardTitle>
          <div className="tl-weather">☀️ Ensolarado</div>
        </CardHead>
        <div className="tl-clim-grid">
          <Stat label="Irradiância" value="820" unit="W/m²" />
          <Stat label="Temperatura" value="26.4" unit="°C" />
          <Stat label="Vento" value="12" unit="km/h" />
          <Stat label="Umidade" value="68" unit="%" />
          <Stat label="Nuvens" value="14" unit="%" />
          <Stat label="UV" value="6.2" sub="alto" />
        </div>
        <div className="tl-clim-forecast-h">Próximas horas</div>
        <div className="tl-clim-forecast-row">
          {['agora', '+1h', '+2h', '+3h', '+4h', '+5h', '+6h'].map((h, i) => (
            <div key={i} className="tl-clim-forecast-cell">
              <span>{h}</span>
              <i className="tl-w-icon sun" />
              <strong>{(26 - i * 0.4).toFixed(0)}°</strong>
            </div>
          ))}
        </div>
      </Card>
    </Soon>
  )
}

// ── Inversores Table ───────────────────────────────────────────────
function InvertersTableCard({
  inversores,
  onSelect,
}: {
  inversores: InversorResumo[]
  onSelect: (idx: number) => void
}) {
  return (
    <Card className="tl-itable-card">
      <CardHead>
        <CardTitle count={inversores.length} sub="Clique para ver detalhes em tempo real">
          Inversores
        </CardTitle>
        <button type="button" className="tl-btn ghost" disabled>
          <DownloadIcon className="size-3" /> CSV
        </button>
      </CardHead>
      <div className="tl-itable">
        <div className="tl-itable-thead">
          <span></span>
          <span>SN</span>
          <span>Modelo</span>
          <span className="num">Pot.</span>
          <span className="num">Hoje</span>
          <span className="num">Total</span>
          <span className="num">V CA</span>
          <span className="num">I CA</span>
          <span className="num">Hz</span>
          <span className="num">°C</span>
        </div>
        {inversores.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--tl-muted-fg)', fontSize: 12 }}>
            Nenhum inversor associado
          </div>
        ) : (
          inversores.map((inv, i) => {
            const status = statusInversor(inv)
            const snap = inv.ultimo_snapshot
            return (
              <button
                key={inv.id}
                type="button"
                className="tl-itable-tr"
                data-state={status}
                onClick={() => onSelect(i)}
              >
                <StatusDot status={status} />
                <span className="mono">{inv.numero_serie}</span>
                <span className="muted">{inv.modelo || '—'}</span>
                <span className="num strong">
                  {snap?.pac_kw != null ? snap.pac_kw.toFixed(3) : '—'} <em>kW</em>
                </span>
                <span className="num">
                  {snap?.energia_hoje_kwh != null ? snap.energia_hoje_kwh.toFixed(1) : '—'}
                </span>
                <span className="num">
                  {snap?.energia_total_kwh != null ? snap.energia_total_kwh.toFixed(1) : '—'}
                </span>
                <span className="num">
                  {snap?.tensao_ac_v != null ? snap.tensao_ac_v.toFixed(1) : '—'}
                </span>
                <span className="num">
                  {snap?.corrente_ac_a != null ? snap.corrente_ac_a.toFixed(2) : '—'}
                </span>
                <span className="num">
                  {snap?.frequencia_hz != null ? snap.frequencia_hz.toFixed(2) : '—'}
                </span>
                <span className="num">
                  {snap?.temperatura_c != null ? snap.temperatura_c.toFixed(1) : '—'}
                </span>
              </button>
            )
          })
        )}
      </div>
    </Card>
  )
}

// ── Histórico de Alertas ───────────────────────────────────────────
function AlertsHistoryCard({
  alertas,
  loading,
}: {
  alertas: AlertaResumo[]
  loading: boolean
}) {
  const ativos = alertas.filter((a) => a.estado === 'ativo').length
  return (
    <Card>
      <CardHead>
        <CardTitle sub={`${ativos} ativos · ${alertas.length} no total`}>
          Histórico de alertas
        </CardTitle>
        <Link to="/alertas" className="tl-btn ghost" style={{ textDecoration: 'none' }}>
          Ver todos →
        </Link>
      </CardHead>
      {loading ? (
        <div style={{ padding: 28, textAlign: 'center', color: 'var(--tl-muted-fg)', fontSize: 12 }}>
          Carregando alertas...
        </div>
      ) : alertas.length === 0 ? (
        <div style={{ padding: 28, textAlign: 'center', color: 'var(--tl-muted-fg)', fontSize: 12 }}>
          Nenhum alerta registrado para esta usina
        </div>
      ) : (
        <div className="tl-aulist">
          {alertas.slice(0, 8).map((a) => (
            <Link
              key={a.id}
              to={`/alertas/${a.id}`}
              className="tl-aualert"
              data-sev={a.nivel}
            >
              <span className="tl-aualert-sev" data-sev={a.nivel}>
                {a.nivel === 'critico' ? 'Crítico' : a.nivel === 'aviso' ? 'Aviso' : 'Info'}
              </span>
              <div className="tl-aualert-body">
                <div className="tl-aualert-h">
                  <strong>
                    {CATEGORIA_LABELS[a.categoria_efetiva] || a.categoria_efetiva || 'Alerta'}
                  </strong>
                  <em>{formatarRelativo(a.inicio)}</em>
                </div>
                <div className="tl-aualert-d">{a.mensagem}</div>
              </div>
              <span className="tl-aualert-est" data-estado={a.estado}>
                {a.estado === 'ativo' ? 'Ativo' : 'Resolvido'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

// ── Info da usina ──────────────────────────────────────────────────
function InfoCard({
  data,
  status,
  onSaved,
}: {
  data: UsinaDetalhe
  status: StatusInfo
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const snap = data.ultimo_snapshot
  return (
    <Card>
      <CardHead>
        <CardTitle sub="Cadastro e localização">Informações da usina</CardTitle>
        <button
          type="button"
          className="tl-icon-btn"
          onClick={() => setEditing((v) => !v)}
          aria-label={editing ? 'Cancelar edição' : 'Editar localização'}
          title={editing ? 'Cancelar' : 'Editar'}
        >
          {editing ? <XIcon className="size-4" /> : <SettingsIcon className="size-4" />}
        </button>
      </CardHead>
      {editing ? (
        <LocalizacaoSection
          usinaId={data.id}
          inicial={{
            cep: data.cep,
            endereco: data.endereco,
            bairro: data.bairro,
            cidade: data.cidade,
            estado: data.estado,
            latitude: data.latitude,
            longitude: data.longitude,
          }}
          onSalvo={() => {
            setEditing(false)
            onSaved()
          }}
        />
      ) : (
        <InfoGrid>
          <Info label="Endereço" value={data.endereco || '—'} />
          <Info label="CEP" value={data.cep || '—'} />
          <Info
            label="Cidade / UF"
            value={[data.cidade, data.estado].filter(Boolean).join(' / ') || '—'}
          />
          <Info
            label="Lat / Lng"
            value={
              data.latitude != null && data.longitude != null
                ? `${data.latitude}, ${data.longitude}`
                : '—'
            }
            mono
          />
          <Info label="Telefone" value={data.telefone || '—'} />
          <Info label="Fuso horário" value={data.fuso_horario || '—'} />
          <Info label="Provedor" value={PROVEDOR_LABELS[data.provedor] || data.provedor} />
          <Info label="Capacidade" value={`${data.capacidade_kwp} kWp`} />
          <Info label="Última coleta" value={formatarUltimaColeta(snap?.coletado_em)} />
          <Info label="Status" value={status.label} tone={status.tone} />
        </InfoGrid>
      )}
    </Card>
  )
}

// ── Rede elétrica ──────────────────────────────────────────────────
function GridCard({ data, onSaved }: { data: UsinaDetalhe; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const tensoesValidas = data.inversores
    .map((inv) => inv.ultimo_snapshot?.tensao_ac_v)
    .filter((v): v is number => typeof v === 'number' && v > 0)
  const vAtual =
    tensoesValidas.length > 0
      ? tensoesValidas.reduce((a, b) => a + b, 0) / tensoesValidas.length
      : null
  const vNom = data.tensao_nominal_v ?? 220
  const vMin = data.tensao_subtensao_v ?? Math.round(vNom * 0.91)
  const vMax = data.tensao_sobretensao_v ?? Math.round(vNom * 1.1)
  const posPct = vAtual ? ((vAtual - vMin) / Math.max(1, vMax - vMin)) * 100 : null
  const tone: 'ok' | 'warn' | 'crit' | undefined = vAtual
    ? vAtual < vMin || vAtual > vMax
      ? 'crit'
      : vAtual < vMin * 1.02 || vAtual > vMax * 0.98
        ? 'warn'
        : 'ok'
    : undefined

  if (editing) {
    return (
      <Card>
        <CardHead>
          <CardTitle sub="Tensão e proteção">Rede elétrica</CardTitle>
          <button
            type="button"
            className="tl-icon-btn"
            onClick={() => setEditing(false)}
            aria-label="Fechar edição"
            title="Fechar"
          >
            <XIcon className="size-4" />
          </button>
        </CardHead>
        <RedeEletricaCard
          usinaId={data.id}
          usinaNome={data.nome}
          tensaoNominalV={data.tensao_nominal_v}
          tensaoSubtensaoV={data.tensao_subtensao_v}
          tensaoSobretensaoV={data.tensao_sobretensao_v}
          inversores={data.inversores}
          onSuccess={() => {
            setEditing(false)
            onSaved()
          }}
        />
      </Card>
    )
  }

  return (
    <Card>
      <CardHead>
        <CardTitle sub="Tensão e proteção">Rede elétrica</CardTitle>
        <button
          type="button"
          className="tl-icon-btn"
          onClick={() => setEditing(true)}
          aria-label="Editar rede elétrica"
          title="Editar"
        >
          <SettingsIcon className="size-4" />
        </button>
      </CardHead>
      <InfoGrid>
        <Info label="Tensão nominal" value={`${vNom} V`} mono />
        <Info
          label="Tensão atual"
          value={vAtual ? `${vAtual.toFixed(1)} V` : '—'}
          mono
          tone={tone}
        />
        <Info label="Limite subtensão" value={`${vMin.toFixed(1)} V`} mono />
        <Info label="Limite sobretensão" value={`${vMax.toFixed(1)} V`} mono />
      </InfoGrid>
      <div className="tl-volt-bar">
        <div className="tl-volt-track">
          <i className="tl-volt-fill" style={{ left: '13%', right: '13%' }} />
          {posPct !== null && (
            <i className="tl-volt-now" style={{ left: `${Math.max(0, Math.min(100, posPct))}%` }} />
          )}
        </div>
        <div className="tl-volt-labels">
          <span>{vMin.toFixed(0)}V</span>
          {vAtual && <span className="ok">{vAtual.toFixed(0)}V</span>}
          <span>{vMax.toFixed(0)}V</span>
        </div>
      </div>
      <p style={{ fontSize: 10.5, color: 'var(--tl-muted-fg)', margin: '10px 0 0', lineHeight: 1.5 }}>
        Limites calculados automaticamente: 91% (subtensão) e 110% (sobretensão). Ajustes
        manuais sobrescrevem o cálculo (NBR 5410).
      </p>
    </Card>
  )
}

// ── Financeiro (Soon) ──────────────────────────────────────────────
function FinanceCard() {
  return (
    <Soon text="Cadastro de tarifa por usina + projeção de payback em desenvolvimento.">
      <Card>
        <CardHead>
          <CardTitle sub="Economia e retorno">Financeiro</CardTitle>
          <Pill tone="ghost">Tarifa R$ 0,92/kWh</Pill>
        </CardHead>
        <div className="tl-fin-kpis">
          <div>
            <em>Economia acumulada</em>
            <strong>R$ 4.232,80</strong>
          </div>
          <div>
            <em>Economia/mês</em>
            <strong>R$ 487,30</strong>
          </div>
          <div>
            <em>Investimento</em>
            <strong>R$ 22.680</strong>
          </div>
          <div>
            <em>Payback estimado</em>
            <strong>
              3.9 <span>anos</span>
            </strong>
          </div>
        </div>
        <div className="tl-fin-bar-label">
          <span>Pago</span>
          <span>Falta</span>
        </div>
        <div className="tl-fin-bar-track">
          <i style={{ width: '18%' }} />
        </div>
        <div className="tl-fin-bar-num">
          <span>
            <strong>18%</strong> do investimento recuperado
          </span>
          <span className="muted">R$ 18.447 restantes</span>
        </div>
      </Card>
    </Soon>
  )
}

// ── Timeline (Soon) ────────────────────────────────────────────────
function TimelineCard() {
  const events = [
    { d: '27/04', t: '21:00', tone: 'crit' as const, title: 'Comunicação perdida', desc: '3 inversores offline' },
    { d: '15/04', t: '09:14', tone: 'ok' as const, title: 'Limpeza realizada', desc: 'PR voltou a 87%' },
    { d: '02/04', t: '14:30', tone: 'warn' as const, title: 'Manutenção preventiva', desc: 'Substituição MC4 string 4' },
    { d: '12/03', t: '11:00', tone: 'ok' as const, title: 'Instalação concluída', desc: 'Usina comissionada' },
  ]
  return (
    <Soon text="Histórico de manutenções programadas e eventos chegando.">
      <Card>
        <CardHead>
          <CardTitle sub="Últimos 12 meses">Eventos & manutenção</CardTitle>
          <button type="button" className="tl-btn ghost">
            + Adicionar
          </button>
        </CardHead>
        <div className="tl-timeline">
          {events.map((e, i) => (
            <div key={i} className="tl-tl-row" data-tone={e.tone}>
              <div className="tl-tl-date">
                <strong>{e.d}</strong>
                <em>{e.t}</em>
              </div>
              <div className="tl-tl-dot">
                <i />
              </div>
              <div>
                <div className="tl-tl-title">{e.title}</div>
                <div className="tl-tl-desc">{e.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </Soon>
  )
}

// ── Documentos (Soon) ──────────────────────────────────────────────
function DocsCard() {
  const docs = [
    { name: 'Projeto elétrico.pdf', size: '2.4 MB', date: '12/03/2024', kind: 'pdf' as const },
    { name: 'Foto telhado — antes.jpg', size: '1.8 MB', date: '08/03/2024', kind: 'img' as const },
    { name: 'Foto telhado — depois.jpg', size: '2.1 MB', date: '12/03/2024', kind: 'img' as const },
    { name: 'Contrato distribuidora.pdf', size: '512 KB', date: '01/03/2024', kind: 'pdf' as const },
    { name: 'Datasheet inversor.pdf', size: '892 KB', date: '01/03/2024', kind: 'pdf' as const },
    { name: 'Laudo ART.pdf', size: '320 KB', date: '10/03/2024', kind: 'pdf' as const },
  ]
  return (
    <Soon text="Upload de projetos, contratos e fotos em desenvolvimento.">
      <Card>
        <CardHead>
          <CardTitle count={docs.length} sub="Anexos da instalação e contratos">
            Documentos & fotos
          </CardTitle>
          <button type="button" className="tl-btn ghost">
            + Upload
          </button>
        </CardHead>
        <div className="tl-docs-grid">
          {docs.map((d, i) => (
            <div key={i} className="tl-doc" data-kind={d.kind}>
              <div className="tl-doc-thumb">{d.kind === 'pdf' ? 'PDF' : 'IMG'}</div>
              <div className="tl-doc-body">
                <div className="tl-doc-name">{d.name}</div>
                <div className="tl-doc-meta">
                  {d.size} · {d.date}
                </div>
              </div>
              <button type="button" className="tl-doc-dl" aria-label="Baixar">
                <DownloadIcon className="size-3" />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </Soon>
  )
}

