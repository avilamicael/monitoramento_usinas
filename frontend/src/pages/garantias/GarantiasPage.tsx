import { useEffect, useState } from 'react'
import { Loader2Icon, PencilIcon, PlusIcon, SearchIcon } from 'lucide-react'
import { useUsinas } from '@/hooks/use-usinas'
import { paraGarantia } from '@/hooks/use-garantias'
import { GarantiaFormDialog } from '@/components/garantias/GarantiaFormDialog'
import { api } from '@/lib/api'
import type { Garantia as GarantiaApi, Paginated } from '@/lib/types'
import type { StatusGarantia } from '@/types/usinas'
import type { GarantiaUsina } from '@/types/garantias'
import { Card, Pill, type PillTone } from '@/components/trylab/primitives'
import { Select } from '@/components/trylab/Select'
import { SortHeader, cycleOrdering } from '@/components/trylab/SortHeader'
import { rotularProvedor } from '@/lib/provedores'

type SortField = 'nome' | 'conta_provedor__tipo' | 'garantia__inicio_em' | 'garantia__meses'

interface FormTarget {
  usina_id: string
  usina_nome: string
  garantia: GarantiaUsina | null
}

function formatarData(dataStr: string): string {
  return new Date(dataStr + 'T00:00:00').toLocaleDateString('pt-BR')
}

async function carregarGarantias(): Promise<Map<string, GarantiaUsina>> {
  const allGarantias = new Map<string, GarantiaUsina>()
  let currentPage = 1
  let hasMore = true
  try {
    while (hasMore) {
      const response = await api.get<Paginated<GarantiaApi>>('/garantia/', {
        params: { page: currentPage, page_size: 50 },
      })
      if (response.data?.results) {
        for (const apiGarantia of response.data.results) {
          const garantia = paraGarantia(apiGarantia)
          allGarantias.set(garantia.usina_id, garantia)
        }
        hasMore = response.data.next !== null
        currentPage++
      } else {
        hasMore = false
      }
    }
  } catch (error) {
    console.error('Erro ao buscar garantias:', error)
  }
  return allGarantias
}

export default function GarantiasPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [provedorFilter, setProvedorFilter] = useState('')
  const [ativoFilter, setAtivoFilter] = useState<'all' | 'true' | 'false'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [ordering, setOrdering] = useState('')
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null)
  const [garantias, setGarantias] = useState<Map<string, GarantiaUsina>>(new Map())
  const [loadingGarantias, setLoadingGarantias] = useState(true)

  useEffect(() => {
    void carregarGarantias()
      .then(setGarantias)
      .finally(() => setLoadingGarantias(false))
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
    status_garantia: (statusFilter as StatusGarantia) || undefined,
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
    setLoadingGarantias(true)
    try {
      const novas = await carregarGarantias()
      setGarantias(novas)
    } finally {
      setLoadingGarantias(false)
    }
    void refetchUsinas()
  }

  const filtrosAtivos =
    !!statusFilter || !!provedorFilter || ativoFilter !== 'all' || !!searchInput

  return (
    <div className="tl-scr">
      <header className="tl-scr-head">
        <div>
          <div className="tl-crumb">Configurações <span>/</span> Garantias</div>
          <h1 style={{ margin: 0 }}>Gestão de garantias</h1>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 12,
              color: 'var(--tl-muted-fg)',
              maxWidth: 720,
              lineHeight: 1.5,
            }}
          >
            Acompanhe o prazo de garantia de cada usina e edite as datas se
            precisar.
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
                setStatusFilter(v)
                setPage(1)
              }}
              options={[
                ['', 'Todos'],
                ['ativa', 'Ativa'],
                ['vencida', 'Vencida'],
                ['sem_garantia', 'Sem garantia'],
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
      ) : usinasLoading || loadingGarantias ? (
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
              gridTemplateColumns: '1.6fr 1fr 0.9fr 1fr 1fr 0.8fr 0.7fr 110px',
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
            <SortHeader
              label="Início"
              field="garantia__inicio_em"
              ordering={ordering}
              onSort={handleSort}
            />
            <span>Fim</span>
            <span>Dias restantes</span>
            <SortHeader
              label="Meses"
              field="garantia__meses"
              ordering={ordering}
              onSort={handleSort}
            />
            <span style={{ textAlign: 'right' }}>Ações</span>
          </div>

          {(usinasData?.results ?? []).length === 0 ? (
            <div className="tl-ftable-empty">Nenhuma usina encontrada</div>
          ) : (
            (usinasData?.results ?? []).map((usina) => {
              const garantia = garantias.get(usina.id)
              const isVencendo =
                garantia?.ativa && (garantia?.dias_restantes ?? 0) < 30
              let tone: PillTone = 'ghost'
              let label = 'Sem garantia'
              if (usina.status_garantia === 'ativa') {
                tone = isVencendo ? 'warn' : 'ok'
                label = isVencendo ? 'Vencendo' : 'Ativa'
              } else if (usina.status_garantia === 'vencida') {
                tone = 'crit'
                label = 'Vencida'
              }
              return (
                <div
                  key={usina.id}
                  className="tl-ftable-tr"
                  style={{
                    gridTemplateColumns: '1.6fr 1fr 0.9fr 1fr 1fr 0.8fr 0.7fr 110px',
                    cursor: 'default',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{usina.nome}</span>
                  <span className="tl-cell-loc">{rotularProvedor(usina.provedor)}</span>
                  <span>
                    <Pill tone={tone}>{label}</Pill>
                  </span>
                  <span
                    style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {garantia ? formatarData(garantia.data_inicio) : '—'}
                  </span>
                  <span
                    style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {garantia ? formatarData(garantia.data_fim) : '—'}
                  </span>
                  <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                    {garantia ? (
                      <span
                        style={{
                          color: isVencendo ? 'var(--tl-crit)' : undefined,
                          fontWeight: isVencendo ? 500 : undefined,
                        }}
                      >
                        {garantia.dias_restantes} dias
                      </span>
                    ) : (
                      '—'
                    )}
                  </span>
                  <span style={{ fontSize: 12 }}>{garantia?.meses ?? '—'}</span>
                  <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {garantia ? (
                      <button
                        type="button"
                        className="tl-btn ghost"
                        onClick={() =>
                          setFormTarget({
                            usina_id: usina.id,
                            usina_nome: usina.nome,
                            garantia,
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
                            garantia: null,
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

      <GarantiaFormDialog
        garantia={formTarget?.garantia ?? null}
        usinaId={formTarget?.usina_id ?? null}
        usinaNome={formTarget?.usina_nome ?? null}
        open={!!formTarget}
        onClose={() => setFormTarget(null)}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
