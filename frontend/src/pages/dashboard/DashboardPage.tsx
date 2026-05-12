import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import {
  useEnergiaResumo,
  useAlertasResumo,
  useAnalyticsPotencia,
  useAnalyticsRanking,
  useGeracaoHoraria,
  useGeracaoDiaria,
  useGeracaoMensal,
} from '@/hooks/use-analytics'
import { formatarEnergia, formatarMoeda, formatarNumero } from '@/lib/format'
import { rotularProvedor } from '@/lib/provedores'
import type {
  GeracaoDiariaItem,
  GeracaoHorariaItem,
  GeracaoMensalItem,
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
  const geracaoHoje = useGeracaoHoraria()
  const geracao30d = useGeracaoDiaria(30)
  const geracaoAno = useGeracaoMensal(12)

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
            <CardTitle sub="últimos 30 dias · energia por provedor">
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
            <CardTitle sub="últimos 30 dias · por número de usinas com coleta">
              Top fabricantes
            </CardTitle>
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

      {/* ── Geração: hoje / 30 dias / ano (lado a lado) ── */}
      <section className="tl-row tl-row-3">
        <Card>
          <CardHead>
            <CardTitle sub="por hora">Geração de hoje</CardTitle>
          </CardHead>
          {geracaoHoje.error ? (
            <ErroBox texto={geracaoHoje.error} onRetry={() => void geracaoHoje.refetch()} />
          ) : geracaoHoje.loading ? (
            <SkeletonBox h={240} />
          ) : (
            <GeracaoBarHoraria data={geracaoHoje.data?.geracao ?? []} />
          )}
        </Card>

        <Card>
          <CardHead>
            <CardTitle sub="por dia">Últimos 30 dias</CardTitle>
          </CardHead>
          {geracao30d.error ? (
            <ErroBox texto={geracao30d.error} onRetry={() => void geracao30d.refetch()} />
          ) : geracao30d.loading ? (
            <SkeletonBox h={240} />
          ) : (
            <GeracaoBarDiaria data={geracao30d.data?.geracao ?? []} />
          )}
        </Card>

        <Card>
          <CardHead>
            <CardTitle sub="por mês">Último ano</CardTitle>
          </CardHead>
          {geracaoAno.error ? (
            <ErroBox texto={geracaoAno.error} onRetry={() => void geracaoAno.refetch()} />
          ) : geracaoAno.loading ? (
            <SkeletonBox h={240} />
          ) : (
            <GeracaoBarMensal data={geracaoAno.data?.geracao ?? []} />
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

// ── Barra (geração) ────────────────────────────────────────────────
//
// 3 wrappers que reutilizam <GeracaoBarBase> com tipos de label diferentes
// (hora "00h…23h", dia "DD/MM", mês "jan…dez/AA"). A escolha de tickInterval
// reduz o ruído quando vários gráficos compartilham largura no grid.

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

interface BarPoint { label: string; energia_kwh: number }

function GeracaoBarBase({
  pontos,
  alturaPx,
  tickInterval,
  rotacionarLabel = false,
  tooltipLabel,
}: {
  pontos: BarPoint[]
  alturaPx: number
  tickInterval?: number | 'preserveStartEnd' | 'preserveStart' | 'preserveEnd' | 'equidistantPreserveStart'
  rotacionarLabel?: boolean
  tooltipLabel: (label: string) => string
}) {
  if (pontos.length === 0 || pontos.every((p) => p.energia_kwh === 0)) {
    return (
      <div
        style={{
          height: alturaPx,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--tl-muted-fg)',
          fontSize: 12.5,
        }}
      >
        Sem dados disponíveis.
      </div>
    )
  }

  const converterMWh = pontos.some((p) => p.energia_kwh >= 1000)
  const unidade = converterMWh ? 'MWh' : 'kWh'
  const dados = pontos.map((p) => ({
    label: p.label,
    energia: converterMWh
      ? Number((p.energia_kwh / 1000).toFixed(2))
      : Number(p.energia_kwh.toFixed(2)),
  }))

  return (
    <ResponsiveContainer width="100%" height={alturaPx}>
      <BarChart
        data={dados}
        margin={{ top: 8, right: 8, left: 0, bottom: rotacionarLabel ? 18 : 0 }}
      >
        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="oklch(1 0 0 / 0.06)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10.5, fill: 'oklch(0.62 0.013 235)' }}
          tickLine={false}
          axisLine={false}
          interval={tickInterval}
          angle={rotacionarLabel ? -45 : 0}
          textAnchor={rotacionarLabel ? 'end' : 'middle'}
          height={rotacionarLabel ? 44 : 22}
        />
        <YAxis
          tick={{ fontSize: 10.5, fill: 'oklch(0.62 0.013 235)' }}
          tickLine={false}
          axisLine={false}
          width={42}
        />
        <ReTooltip
          cursor={{ fill: 'oklch(1 0 0 / 0.04)' }}
          formatter={(value) => [
            `${Number(value).toLocaleString('pt-BR')} ${unidade}`,
            'Geração',
          ]}
          labelFormatter={(label) => tooltipLabel(String(label))}
          contentStyle={{
            background: 'oklch(0.14 0.025 260 / 0.96)',
            border: '1px solid oklch(1 0 0 / 0.12)',
            borderRadius: 8,
            color: 'var(--tl-fg)',
            fontSize: 12,
          }}
        />
        <Bar dataKey="energia" fill="#5fd9d9" radius={[3, 3, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function GeracaoBarHoraria({ data }: { data: GeracaoHorariaItem[] }) {
  const pontos: BarPoint[] = data.map((p) => ({
    label: `${String(p.hora).padStart(2, '0')}h`,
    energia_kwh: p.energia_kwh,
  }))
  return (
    <GeracaoBarBase
      pontos={pontos}
      alturaPx={240}
      tickInterval={2}
      tooltipLabel={(l) => `Hora ${l}`}
    />
  )
}

function GeracaoBarDiaria({ data }: { data: GeracaoDiariaItem[] }) {
  const pontos: BarPoint[] = data.map((item) => {
    const [, mes, dia] = item.dia.split('-')
    return { label: `${dia}/${mes}`, energia_kwh: item.energia_kwh }
  })
  return (
    <GeracaoBarBase
      pontos={pontos}
      alturaPx={240}
      tickInterval="preserveStartEnd"
      rotacionarLabel
      tooltipLabel={(l) => `Dia ${l}`}
    />
  )
}

function GeracaoBarMensal({ data }: { data: GeracaoMensalItem[] }) {
  const pontos: BarPoint[] = data.map((item) => {
    const [ano, mes] = item.mes.split('-')
    const mn = MESES_ABREV[Number(mes) - 1] ?? mes
    return { label: `${mn}/${ano.slice(2)}`, energia_kwh: item.energia_kwh }
  })
  return (
    <GeracaoBarBase
      pontos={pontos}
      alturaPx={240}
      tooltipLabel={(l) => `${l}`}
    />
  )
}

