import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import {
  useEnergiaResumo,
  useAlertasResumo,
  useAnalyticsPotencia,
  useAnalyticsRanking,
  useGeracaoDiaria,
} from '@/hooks/use-analytics'
import { useAlertas } from '@/hooks/use-alertas'
import { formatarEnergia, formatarMoeda, formatarNumero } from '@/lib/format'
import { rotularProvedor } from '@/lib/provedores'
import type { AlertaResumo } from '@/types/alertas'
import type {
  GeracaoDiariaItem,
  ProvedorPotencia,
  ProvedorRanking,
} from '@/types/analytics'
import {
  Card,
  CardHead,
  CardTitle,
  Kpi,
  KpiGrid,
  Pill,
} from '@/components/trylab/primitives'

const CUSTO_KWH = 0.88

// Paleta para charts — equivalentes OKLCH do design TryLab traduzidos
// para hex porque o recharts não aceita oklch direto.
const CHART_COLORS = ['#5fd9d9', '#d9b85f', '#ff7a5c', '#6a8cff', '#a06ad9']

// ── Página ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const energia = useEnergiaResumo()
  const alertasResumo = useAlertasResumo()
  const potencia = useAnalyticsPotencia()
  const ranking = useAnalyticsRanking()
  const geracao = useGeracaoDiaria(30)
  const alertasCriticos = useAlertas({ estado: 'ativo', nivel: 'critico' })

  const totalAlertas =
    (alertasResumo.data?.critico ?? 0) +
    (alertasResumo.data?.aviso ?? 0) +
    (alertasResumo.data?.info ?? 0)

  return (
    <div className="tl-scr">
      <header className="tl-scr-head">
        <div>
          <div className="tl-crumb">
            Monitoramento <span>/</span> Dashboard
          </div>
          <h1 style={{ margin: 0 }}>Visão geral</h1>
        </div>
      </header>

      {/* ── KPIs ── */}
      <KpiGrid>
        <Kpi
          label="Energia total"
          value={energia.data ? formatarEnergia(energia.data.energia_total_kwh) : '—'}
          sub="acumulada · todas as usinas"
          big
        />
        <Kpi
          label="Valor economizado"
          value={
            energia.data
              ? formatarMoeda(energia.data.energia_total_kwh * CUSTO_KWH)
              : '—'
          }
          sub={`tarifa R$ ${CUSTO_KWH.toFixed(2)}/kWh`}
        />
        <Kpi
          label="Críticos"
          value={alertasResumo.data?.critico ?? '—'}
          tone="crit"
          sub="ação imediata"
        />
        <Kpi
          label="Avisos"
          value={alertasResumo.data?.aviso ?? '—'}
          tone="warn"
          sub="acompanhar"
        />
        <Kpi
          label="Informativos"
          value={alertasResumo.data?.info ?? '—'}
          sub="visibilidade"
        />
        <Kpi
          label="Total alertas"
          value={totalAlertas || '—'}
          sub="abertos agora"
        />
        <Kpi
          label="Eficiência média"
          value={
            potencia.data?.kwh_por_kwp_geral != null
              ? formatarNumero(potencia.data.kwh_por_kwp_geral)
              : '—'
          }
          unit="kWh/kWp"
          sub="hoje · todas as usinas"
        />
      </KpiGrid>

      {/* ── Geração por fabricante + Ranking ── */}
      <section className="tl-row tl-row-2">
        <Card>
          <CardHead>
            <CardTitle sub="hoje · energia gerada por provedor">
              Geração por fabricante
            </CardTitle>
            {potencia.data?.energia_hoje_geral_kwh != null && (
              <Pill tone="ghost">
                Hoje: {formatarEnergia(potencia.data.energia_hoje_geral_kwh)}
              </Pill>
            )}
          </CardHead>
          {potencia.error ? (
            <ErroBox texto={potencia.error} onRetry={() => void potencia.refetch()} />
          ) : potencia.loading ? (
            <SkeletonBox h={300} />
          ) : (
            <PieFabricantes data={potencia.data?.por_provedor ?? []} />
          )}
          <p
            style={{
              fontSize: 10.5,
              color: 'var(--tl-muted-fg)',
              margin: '10px 0 0',
              lineHeight: 1.5,
            }}
          >
            Eficiência (kWh/kWp) = energia gerada hoje ÷ capacidade instalada.
          </p>
        </Card>

        <Card>
          <CardHead>
            <CardTitle sub="por número de inversores ativos">Top fabricantes</CardTitle>
          </CardHead>
          {ranking.error ? (
            <ErroBox texto={ranking.error} onRetry={() => void ranking.refetch()} />
          ) : ranking.loading ? (
            <SkeletonBox h={260} />
          ) : (
            <RankingFabricantes ranking={(ranking.data?.ranking ?? []).slice(0, 5)} />
          )}
        </Card>
      </section>

      {/* ── Geração últimos 30 dias ── */}
      <section className="tl-row">
        <Card>
          <CardHead>
            <CardTitle sub="energia total agregada por dia">
              Geração · últimos 30 dias
            </CardTitle>
          </CardHead>
          {geracao.error ? (
            <ErroBox texto={geracao.error} onRetry={() => void geracao.refetch()} />
          ) : geracao.loading ? (
            <SkeletonBox h={300} />
          ) : (
            <GeracaoChart data={geracao.data?.geracao ?? []} />
          )}
        </Card>
      </section>

      {/* ── Alertas críticos ── */}
      <section className="tl-row">
        <Card>
          <CardHead>
            <CardTitle sub="clique para expandir os detalhes">
              Alertas críticos ativos
            </CardTitle>
            <Link
              to="/alertas?nivel=critico"
              className="tl-btn ghost"
              style={{ textDecoration: 'none' }}
            >
              Ver todos →
            </Link>
          </CardHead>
          {alertasCriticos.error ? (
            <ErroBox
              texto={alertasCriticos.error}
              onRetry={() => void alertasCriticos.refetch()}
            />
          ) : alertasCriticos.loading ? (
            <SkeletonBox h={120} />
          ) : (alertasCriticos.data?.results.length ?? 0) === 0 ? (
            <div
              style={{
                padding: 36,
                textAlign: 'center',
                color: 'var(--tl-muted-fg)',
                fontSize: 12.5,
              }}
            >
              Nenhum alerta crítico ativo no momento.
            </div>
          ) : (
            <AlertasCriticosLista alertas={alertasCriticos.data?.results ?? []} />
          )}
        </Card>
      </section>
    </div>
  )
}

// ── Subcomponentes ──────────────────────────────────────────────────

function ErroBox({ texto, onRetry }: { texto: string; onRetry: () => void }) {
  return (
    <div style={{ padding: 24, textAlign: 'center', fontSize: 12.5 }}>
      <span style={{ color: 'var(--tl-crit)' }}>{texto}</span>{' '}
      <button type="button" className="tl-link-sm" onClick={onRetry}>
        Tentar novamente
      </button>
    </div>
  )
}

function SkeletonBox({ h }: { h: number }) {
  return (
    <div
      style={{
        height: h,
        borderRadius: 10,
        background: 'oklch(0 0 0 / 0.18)',
        border: '1px solid var(--tl-line-soft)',
      }}
      aria-busy
    />
  )
}

function PieFabricantes({ data }: { data: ProvedorPotencia[] }) {
  const dados = data
    .filter((p) => p.energia_hoje_kwh > 0)
    .map((p) => ({ ...p, provedor_label: rotularProvedor(p.provedor) }))

  if (dados.length === 0) {
    return (
      <div
        style={{
          padding: 36,
          textAlign: 'center',
          color: 'var(--tl-muted-fg)',
          fontSize: 12.5,
        }}
      >
        Sem dados de geração disponíveis.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={dados}
          dataKey="energia_hoje_kwh"
          nameKey="provedor_label"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ name, value }) =>
            `${name}: ${formatarNumero(Number(value))} kWh`
          }
        >
          {dados.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <ReTooltip
          formatter={(value) => {
            const kwh = typeof value === 'number' ? formatarNumero(value) : String(value)
            return [`${kwh} kWh`, 'Energia hoje']
          }}
          contentStyle={{
            background: 'oklch(0.14 0.025 260 / 0.96)',
            border: '1px solid oklch(1 0 0 / 0.12)',
            borderRadius: 8,
            color: 'var(--tl-fg)',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11.5, color: 'var(--tl-muted-fg)' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function RankingFabricantes({ ranking }: { ranking: ProvedorRanking[] }) {
  if (ranking.length === 0) {
    return (
      <div
        style={{
          padding: 36,
          textAlign: 'center',
          color: 'var(--tl-muted-fg)',
          fontSize: 12.5,
        }}
      >
        Nenhum dado de ranking disponível.
      </div>
    )
  }
  return (
    <div className="tl-itable">
      <div className="tl-itable-thead" style={{ gridTemplateColumns: '32px 1fr 100px' }}>
        <span>#</span>
        <span>Provedor</span>
        <span className="num" style={{ textAlign: 'right' }}>
          Inversores
        </span>
      </div>
      {ranking.map((item, i) => (
        <div
          key={item.provedor}
          className="tl-itable-tr"
          style={{ gridTemplateColumns: '32px 1fr 100px', cursor: 'default' }}
        >
          <span className="tl-muted">{i + 1}</span>
          <span>{rotularProvedor(item.provedor)}</span>
          <span className="num strong" style={{ textAlign: 'right' }}>
            {item.inversores_ativos}
          </span>
        </div>
      ))}
    </div>
  )
}

function GeracaoChart({ data }: { data: GeracaoDiariaItem[] }) {
  if (data.length === 0) {
    return (
      <div
        style={{
          padding: 36,
          textAlign: 'center',
          color: 'var(--tl-muted-fg)',
          fontSize: 12.5,
        }}
      >
        Sem dados de geração disponíveis.
      </div>
    )
  }
  const converterMWh = data.some((d) => d.energia_kwh >= 1000)
  const unidade = converterMWh ? 'MWh' : 'kWh'
  const formatado = data.map((item) => {
    const [, mes, dia] = item.dia.split('-')
    return {
      dia: `${dia}/${mes}`,
      energia: converterMWh
        ? Number((item.energia_kwh / 1000).toFixed(2))
        : Number(item.energia_kwh.toFixed(2)),
    }
  })
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={formatado} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="grad-energia" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5fd9d9" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#5fd9d9" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
        <XAxis
          dataKey="dia"
          tick={{ fontSize: 10.5, fill: 'oklch(0.62 0.013 235)' }}
          stroke="oklch(0.62 0.013 235 / 0.3)"
        />
        <YAxis
          tick={{ fontSize: 10.5, fill: 'oklch(0.62 0.013 235)' }}
          stroke="oklch(0.62 0.013 235 / 0.3)"
          tickFormatter={(v) => `${v} ${unidade}`}
        />
        <ReTooltip
          formatter={(value) => [
            `${Number(value).toLocaleString('pt-BR')} ${unidade}`,
            'Geração',
          ]}
          labelFormatter={(label) => `Dia ${label}`}
          contentStyle={{
            background: 'oklch(0.14 0.025 260 / 0.96)',
            border: '1px solid oklch(1 0 0 / 0.12)',
            borderRadius: 8,
            color: 'var(--tl-fg)',
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="energia"
          stroke="#5fd9d9"
          fill="url(#grad-energia)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function AlertasCriticosLista({ alertas }: { alertas: AlertaResumo[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function formatarData(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  return (
    <div className="tl-aulist">
      {alertas.map((a) => {
        const aberto = expanded.has(a.id)
        return (
          <div
            key={a.id}
            className="tl-aualert"
            data-sev="critico"
            role="button"
            tabIndex={0}
            onClick={() => toggle(a.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                toggle(a.id)
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <span className="tl-aualert-sev" data-sev="critico">
              {aberto ? (
                <ChevronDownIcon className="size-3" />
              ) : (
                <ChevronRightIcon className="size-3" />
              )}{' '}
              Crítico
            </span>
            <div className="tl-aualert-body">
              <div className="tl-aualert-h">
                <strong>{a.usina_nome}</strong>
                <em>{formatarData(a.inicio)}</em>
              </div>
              <div className="tl-aualert-d">{a.mensagem}</div>
              {aberto && (
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: '1px dashed var(--tl-line-soft)',
                    fontSize: 11.5,
                    color: 'var(--tl-muted-fg)',
                    display: 'grid',
                    gridTemplateColumns: '90px 1fr',
                    rowGap: 4,
                    columnGap: 12,
                  }}
                >
                  <span>Estado:</span>
                  <span style={{ color: 'var(--tl-fg)' }}>{a.estado}</span>
                  <span>Nível:</span>
                  <span style={{ color: 'var(--tl-fg)' }}>{a.nivel}</span>
                  <span>Início:</span>
                  <span style={{ color: 'var(--tl-fg)' }}>
                    {formatarData(a.inicio)}
                  </span>
                  {a.fim && (
                    <>
                      <span>Fim:</span>
                      <span style={{ color: 'var(--tl-fg)' }}>
                        {formatarData(a.fim)}
                      </span>
                    </>
                  )}
                  <span></span>
                  <Link
                    to={`/alertas/${a.id}`}
                    className="tl-link-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Abrir detalhe →
                  </Link>
                </div>
              )}
            </div>
            <Pill tone="crit">{a.estado === 'ativo' ? 'Ativo' : 'Resolvido'}</Pill>
          </div>
        )
      })}
    </div>
  )
}
