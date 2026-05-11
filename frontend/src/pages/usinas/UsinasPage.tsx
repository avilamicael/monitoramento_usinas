import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Loader2Icon,
  SearchIcon,
  CalendarIcon,
  RefreshCwIcon,
  ZapIcon,
  ChevronRightIcon,
} from 'lucide-react'
import { useUsinas } from '@/hooks/use-usinas'
import { PAGE_SIZE } from '@/lib/constants'
import { rotularProvedor } from '@/lib/provedores'
import type { StatusGarantia, UsinaResumo } from '@/types/usinas'
import { Kpi, KpiGrid, Pill, Soon } from '@/components/trylab/primitives'
import { Select } from '@/components/trylab/Select'

const PROVEDORES_DISPONIVEIS = [
  { v: 'solis', l: 'Solis' },
  { v: 'hoymiles', l: 'Hoymiles' },
  { v: 'fusionsolar', l: 'FusionSolar' },
  { v: 'auxsol', l: 'AuxSol' },
  { v: 'solarman', l: 'Solarman' },
  { v: 'foxess', l: 'FoxESS' },
]

const STATUS_GARANTIA_LABEL: Record<StatusGarantia, string> = {
  ativa: 'Ativa',
  vencida: 'Vencida',
  sem_garantia: 'Sem garantia',
}

const STATUS_GARANTIA_TONE: Record<StatusGarantia, 'ok' | 'warn' | 'crit' | 'ghost'> = {
  ativa: 'ok',
  vencida: 'crit',
  sem_garantia: 'ghost',
}

export default function UsinasPage() {
  const [provedor, setProvedor] = useState('')
  const [statusGarantia, setStatusGarantia] = useState('')
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const id = setTimeout(() => {
      setBuscaDebounced(busca)
      setPage(1)
    }, 400)
    return () => clearTimeout(id)
  }, [busca])

  const { data, loading, error, refetch } = useUsinas({
    provedor: provedor || undefined,
    status_garantia: (statusGarantia as StatusGarantia) || undefined,
    nome: buscaDebounced || undefined,
    page,
  })

  const usinas = data?.results ?? []
  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE))

  // Detecta nomes duplicados na lista atual pra mostrar #id externo abaixo
  const vistos = new Set<string>()
  const duplicados = new Set<string>()
  for (const u of usinas) {
    if (vistos.has(u.nome)) duplicados.add(u.nome)
    else vistos.add(u.nome)
  }

  function handleProvedorChange(v: string) {
    setProvedor(v)
    setPage(1)
  }
  function handleStatusChange(v: string) {
    setStatusGarantia(v)
    setPage(1)
  }
  function limparFiltros() {
    setProvedor('')
    setStatusGarantia('')
    setBusca('')
    setBuscaDebounced('')
    setPage(1)
  }
  const filtrosAtivos = !!provedor || !!statusGarantia || !!buscaDebounced

  return (
    <div className="tl-scr">
      {/* ── Header ── */}
      <header className="tl-scr-head" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="tl-crumb">
            Monitoramento <span>/</span> Usinas
          </div>
          <h1 style={{ margin: 0 }}>Usinas</h1>
        </div>
        <div className="tl-head-actions">
          <button type="button" className="tl-btn" disabled>
            <CalendarIcon className="size-3.5" /> Hoje
          </button>
          <button
            type="button"
            className="tl-btn"
            onClick={() => void refetch()}
            disabled={loading}
            aria-label="Recarregar"
          >
            <RefreshCwIcon className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
            Atualizar
          </button>
        </div>
      </header>

      {/* ── KPIs ── */}
      <KpiGrid>
        <Kpi label="Usinas monitoradas" value={data?.count ?? '—'} big sub="total na empresa" />
        <SoonKpi label="Produção agora" sub="endpoint agregador em desenvolvimento" />
        <SoonKpi label="Alertas abertos" sub="contagem agregada das usinas" />
        <SoonKpi label="PR médio · 24h" sub="cálculo de performance em roadmap" />
      </KpiGrid>

      {/* ── Toolbar ── */}
      <div className="tl-ftoolbar">
        <div className="tl-ftools-search" style={{ flex: 1, maxWidth: 360 }}>
          <SearchIcon className="size-3.5" />
          <input
            placeholder="Buscar usina por nome…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="tl-ftools">
          <div className="tl-filter-field">
            <em>Provedor:</em>
            <Select
              value={provedor}
              onChange={handleProvedorChange}
              options={[
                ['', 'Todos'],
                ...PROVEDORES_DISPONIVEIS.map((p) => [p.v, p.l] as [string, string]),
              ]}
              minWidth={150}
            />
          </div>
          <div className="tl-filter-field">
            <em>Garantia:</em>
            <Select
              value={statusGarantia}
              onChange={handleStatusChange}
              options={[
                ['', 'Todas'],
                ['ativa', 'Ativa'],
                ['vencida', 'Vencida'],
                ['sem_garantia', 'Sem garantia'],
              ]}
              minWidth={150}
            />
          </div>
          {filtrosAtivos && (
            <button
              type="button"
              className="tl-link-sm tl-clear-filters"
              onClick={limparFiltros}
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* ── Tabela ── */}
      <div className="tl-ftable">
        <div className="tl-ftable-thead">
          <span>Usina</span>
          <span>Provedor</span>
          <span>Localização</span>
          <span className="num" style={{ textAlign: 'right' }}>Capacidade</span>
          <span>Garantia</span>
          <span></span>
        </div>

        {error ? (
          <div className="tl-ftable-empty">
            {error}{' '}
            <button
              type="button"
              className="tl-link-sm"
              onClick={() => void refetch()}
              style={{ marginLeft: 8 }}
            >
              Tentar novamente
            </button>
          </div>
        ) : loading && usinas.length === 0 ? (
          <div className="tl-ftable-empty">
            <Loader2Icon className="size-5 animate-spin" style={{ display: 'inline-block' }} /> Carregando…
          </div>
        ) : usinas.length === 0 ? (
          <div className="tl-ftable-empty">Nenhuma usina encontrada</div>
        ) : (
          usinas.map((u) => <UsinaRow key={u.id} usina={u} mostrarId={duplicados.has(u.nome)} />)
        )}
      </div>

      {/* ── Footer / pager ── */}
      {!error && (data?.count ?? 0) > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 4px',
          }}
        >
          <span className="tl-muted tl-small">
            {data?.count} usina{(data?.count ?? 0) !== 1 ? 's' : ''} encontrada
            {(data?.count ?? 0) !== 1 ? 's' : ''}
          </span>
          <div className="tl-pager">
            <button
              type="button"
              className="tl-btn"
              disabled={!data?.previous || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹ Anterior
            </button>
            <span className="tl-pager-page">
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              className="tl-btn"
              disabled={!data?.next || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Subcomponentes ────────────────────────────────────────────────

function SoonKpi({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="tl-soon" style={{ borderRadius: 12, overflow: 'hidden' }}>
      <Kpi label={label} value="—" sub={sub} />
      <div className="tl-soon-overlay" style={{ padding: 8 }}>
        <div className="tl-soon-badge" style={{ padding: '4px 10px', fontSize: 10.5 }}>
          <span className="tl-soon-pulse" />
          Em breve
        </div>
      </div>
    </div>
  )
}

function UsinaRow({ usina, mostrarId }: { usina: UsinaResumo; mostrarId: boolean }) {
  const cidadeUf = [usina.cidade, usina.endereco ? '' : '']
    .filter((s) => s && s.trim().length > 0)
    .join(' · ')
  const local = usina.cidade || usina.endereco || '—'
  const garantiaTone = STATUS_GARANTIA_TONE[usina.status_garantia]
  const garantiaLabel = STATUS_GARANTIA_LABEL[usina.status_garantia]
  return (
    <Link to={`/usinas/${usina.id}`} className="tl-ftable-tr" data-cidade-uf={cidadeUf || undefined}>
      <span className="tl-cell-name">
        <span className="tl-thumb">
          <ZapIcon className="size-4" />
        </span>
        <span className="tl-cell-name-text">
          <b>{usina.nome}</b>
          {mostrarId && usina.id_usina_provedor && <em>#{usina.id_usina_provedor}</em>}
        </span>
      </span>
      <span className="tl-cell-prov">
        <span className="tl-prov-dot" />
        {rotularProvedor(usina.provedor)}
      </span>
      <span className="tl-cell-loc" title={local}>
        {local}
      </span>
      <span className="tl-cell-num" style={{ textAlign: 'right' }}>
        {usina.capacidade_kwp} <em>kWp</em>
      </span>
      <span>
        <Pill tone={garantiaTone}>{garantiaLabel}</Pill>
      </span>
      <span className="tl-cell-arrow">
        <ChevronRightIcon className="size-4" />
      </span>
    </Link>
  )
}
