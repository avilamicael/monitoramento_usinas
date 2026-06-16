import { useEffect, useState } from 'react'
import { Loader2Icon, PencilIcon, PlusIcon, SearchIcon } from 'lucide-react'
import { useUsinas } from '@/hooks/use-usinas'
import { paraMonitoramentoAtivo } from '@/hooks/use-monitoramento-ativo'
import { MonitoramentoAtivoFormDialog } from '@/components/monitoramento-ativo/MonitoramentoAtivoFormDialog'
import { api } from '@/lib/api'
import type { MonitoramentoAtivo as MonitoramentoAtivoApi, Paginated } from '@/lib/types'
import type { MonitoramentoAtivoUsina } from '@/types/monitoramento-ativo'
import { Card, Pill, type PillTone } from '@/components/trylab/primitives'
import { Select } from '@/components/trylab/Select'
import { SortHeader, cycleOrdering } from '@/components/trylab/SortHeader'
import { rotularProvedor } from '@/lib/provedores'

type SortField = 'nome' | 'conta_provedor__tipo'

type StatusFilter = '' | 'ativa' | 'vencida' | 'sem_contrato'

interface FormTarget {
  usina_id: string
  usina_nome: string
  monitoramento: MonitoramentoAtivoUsina | null
}

function formatarData(dataStr: string): string {
  return new Date(dataStr + 'T00:00:00').toLocaleDateString('pt-BR')
}

function formatarValor(valor: string | null): string {
  if (valor == null || valor.trim() === '') return '—'
  const num = Number(valor)
  if (Number.isNaN(num)) return '—'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function carregarMonitoramentos(): Promise<Map<string, MonitoramentoAtivoUsina>> {
  const todos = new Map<string, MonitoramentoAtivoUsina>()
  let currentPage = 1
  let hasMore = true
  try {
    while (hasMore) {
      const response = await api.get<Paginated<MonitoramentoAtivoApi>>('/monitoramento-ativo/', {
        params: { page: currentPage, page_size: 50 },
      })
      if (response.data?.results) {
        for (const apiItem of response.data.results) {
          const item = paraMonitoramentoAtivo(apiItem)
          todos.set(item.usina_id, item)
        }
        hasMore = response.data.next !== null
        currentPage++
      } else {
        hasMore = false
      }
    }
  } catch (error) {
    console.error('Erro ao buscar monitoramentos ativos:', error)
  }
  return todos
}

export default function MonitoramentoAtivoPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [provedorFilter, setProvedorFilter] = useState('')
  const [ativoFilter, setAtivoFilter] = useState<'all' | 'true' | 'false'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [ordering, setOrdering] = useState('')
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null)
  const [monitoramentos, setMonitoramentos] = useState<Map<string, MonitoramentoAtivoUsina>>(
    new Map(),
  )
  const [loadingMonitoramentos, setLoadingMonitoramentos] = useState(true)

  useEffect(() => {
    void carregarMonitoramentos()
      .then(setMonitoramentos)
      .finally(() => setLoadingMonitoramentos(false))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput)
      setPage(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchInput])

  const {
    data: usinasData,
    loading: usinasLoading,
    error: usinasError,
    refetch: refetchUsinas,
  } = useUsinas({
    provedor: provedorFilter || undefined,
    ativo: ativoFilter === 'all' ? undefined : ativoFilter === 'true',
    nome: searchTerm || undefined,
    page,
    ordering: ordering || undefined,
  })

  function handleSort(field: SortField) {
    setPage(1)
    setOrdering((atual) => cycleOrdering(atual, field))
  }

  const totalPages = Math.max(1, Math.ceil((usinasData?.count ?? 0) / 20))

  function handleClearFilters() {
    setStatusFilter('')
    setProvedorFilter('')
    setAtivoFilter('all')
    setSearchInput('')
    setSearchTerm('')
    setPage(1)
  }

  async function handleSuccess() {
    setFormTarget(null)
    setLoadingMonitoramentos(true)
    try {
      const novos = await carregarMonitoramentos()
      setMonitoramentos(novos)
    } finally {
      setLoadingMonitoramentos(false)
    }
    void refetchUsinas()
  }

  const filtrosAtivos =
    !!statusFilter || !!provedorFilter || ativoFilter !== 'all' || !!searchInput

  // O filtro de status é aplicado no cliente, pois esta página lista usinas e
  // anexa o contrato de monitoramento ativo de cada uma (1:1 por usina).
  function statusDaUsina(monitoramento: MonitoramentoAtivoUsina | undefined): StatusFilter {
    if (!monitoramento) return 'sem_contrato'
    return monitoramento.ativa ? 'ativa' : 'vencida'
  }

  const linhas = (usinasData?.results ?? []).filter((usina) => {
    if (!statusFilter) return true
    return statusDaUsina(monitoramentos.get(usina.id)) === statusFilter
  })

  return (
    <div className="tl-scr">
      <header className="tl-scr-head">
        <div>
          <div className="tl-crumb">
            Operacional <span>/</span> Monitoramento Ativo
          </div>
          <h1 style={{ margin: 0 }}>Monitoramento Ativo</h1>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 12,
              color: 'var(--tl-muted-fg)',
              maxWidth: 720,
              lineHeight: 1.5,
            }}
          >
            Gerencie os contratos de monitoramento ativo (clientes premium) de cada
            usina, com valor mensal.
          </p>
        </div>
      </header>

      <div className="tl-ftoolbar">
        <div className="tl-ftools-search" style={{ flex: 1, maxWidth: 360 }}>
          <SearchIcon className="size-3.5" />
          <input
            type="text"
            placeholder="Buscar usina por nome…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="tl-ftools">
          <div className="tl-filter-field">
            <em>Status:</em>
            <Select
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v as StatusFilter)
                setPage(1)
              }}
              options={[
                ['', 'Todos'],
                ['ativa', 'Ativo'],
                ['vencida', 'Vencido'],
                ['sem_contrato', 'Sem contrato'],
              ]}
              minWidth={140}
            />
          </div>
          <div className="tl-filter-field">
            <em>Provedor:</em>
            <Select
              value={provedorFilter}
              onChange={(v) => {
                setProvedorFilter(v)
                setPage(1)
              }}
              options={[
                ['', 'Todos'],
                ['solis', rotularProvedor('solis')],
                ['hoymiles', rotularProvedor('hoymiles')],
                ['fusionsolar', rotularProvedor('fusionsolar')],
                ['auxsol', rotularProvedor('auxsol')],
                ['solarman', rotularProvedor('solarman')],
                ['foxess', rotularProvedor('foxess')],
              ]}
              minWidth={140}
            />
          </div>
          <div className="tl-filter-field">
            <em>Usinas:</em>
            <Select
              value={ativoFilter}
              onChange={(v) => {
                setAtivoFilter(v as 'all' | 'true' | 'false')
                setPage(1)
              }}
              options={[
                ['all', 'Todas'],
                ['true', 'Ativas'],
                ['false', 'Inativas'],
              ]}
              minWidth={130}
            />
          </div>
          {filtrosAtivos && (
            <button
              type="button"
              className="tl-link-sm tl-clear-filters"
              onClick={handleClearFilters}
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {usinasError ? (
        <Card>
          <div style={{ padding: 18, color: 'var(--tl-crit)', fontSize: 12.5 }}>
            {usinasError}
          </div>
        </Card>
      ) : usinasLoading || loadingMonitoramentos ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: 36,
            color: 'var(--tl-muted-fg)',
          }}
        >
          <Loader2Icon className="size-5 animate-spin" />
        </div>
      ) : (
        <div className="tl-ftable">
          <div
            className="tl-ftable-thead"
            style={{
              gridTemplateColumns: '1.6fr 1fr 0.9fr 1fr 1fr 0.9fr 110px',
            }}
          >
            <SortHeader label="Usina" field="nome" ordering={ordering} onSort={handleSort} />
            <SortHeader
              label="Provedor"
              field="conta_provedor__tipo"
              ordering={ordering}
              onSort={handleSort}
            />
            <span>Status</span>
            <span>Início</span>
            <span>Fim</span>
            <span>Valor mensal</span>
            <span style={{ textAlign: 'right' }}>Ações</span>
          </div>

          {linhas.length === 0 ? (
            <div className="tl-ftable-empty">Nenhuma usina encontrada</div>
          ) : (
            linhas.map((usina) => {
              const monitoramento = monitoramentos.get(usina.id)
              const isVencendo =
                monitoramento?.ativa && (monitoramento?.dias_restantes ?? 0) < 30
              let tone: PillTone = 'ghost'
              let label = 'Sem contrato'
              if (monitoramento) {
                if (monitoramento.ativa) {
                  tone = isVencendo ? 'warn' : 'ok'
                  label = isVencendo ? 'Vencendo' : 'Ativo'
                } else {
                  tone = 'crit'
                  label = 'Vencido'
                }
              }
              return (
                <div
                  key={usina.id}
                  className="tl-ftable-tr"
                  style={{
                    gridTemplateColumns: '1.6fr 1fr 0.9fr 1fr 1fr 0.9fr 110px',
                    cursor: 'default',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{usina.nome}</span>
                  <span className="tl-cell-loc">{rotularProvedor(usina.provedor)}</span>
                  <span>
                    <Pill tone={tone}>{label}</Pill>
                  </span>
                  <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                    {monitoramento ? formatarData(monitoramento.data_inicio) : '—'}
                  </span>
                  <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                    {monitoramento ? (
                      <span
                        style={{
                          color: isVencendo ? 'var(--tl-crit)' : undefined,
                          fontWeight: isVencendo ? 500 : undefined,
                        }}
                      >
                        {formatarData(monitoramento.data_fim)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </span>
                  <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                    {monitoramento ? formatarValor(monitoramento.valor_mensal) : '—'}
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {monitoramento ? (
                      <button
                        type="button"
                        className="tl-btn ghost"
                        onClick={() =>
                          setFormTarget({
                            usina_id: usina.id,
                            usina_nome: usina.nome,
                            monitoramento,
                          })
                        }
                        style={{ fontSize: 11, padding: '4px 9px' }}
                      >
                        <PencilIcon className="size-3" /> Editar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="tl-btn-primary"
                        onClick={() =>
                          setFormTarget({
                            usina_id: usina.id,
                            usina_nome: usina.nome,
                            monitoramento: null,
                          })
                        }
                        style={{ fontSize: 11, padding: '5px 10px' }}
                      >
                        <PlusIcon className="size-3" /> Adicionar
                      </button>
                    )}
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}

      {!usinasLoading && !usinasError && totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 4px',
          }}
        >
          <span className="tl-muted tl-small">
            Página {page} de {totalPages}
          </span>
          <div className="tl-pager">
            <button
              type="button"
              className="tl-btn"
              disabled={!usinasData?.previous}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹ Anterior
            </button>
            <button
              type="button"
              className="tl-btn"
              disabled={!usinasData?.next}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima ›
            </button>
          </div>
        </div>
      )}

      <MonitoramentoAtivoFormDialog
        monitoramento={formTarget?.monitoramento ?? null}
        usinaId={formTarget?.usina_id ?? null}
        usinaNome={formTarget?.usina_nome ?? null}
        open={!!formTarget}
        onClose={() => setFormTarget(null)}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
