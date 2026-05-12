import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  Loader2Icon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAlerta } from '@/hooks/use-alertas'
import { api } from '@/lib/api'
import { PROVEDOR_LABELS } from '@/lib/provedores'
import {
  CATEGORIA_LABELS,
  type AlertaDetalhe,
  type EstadoAlerta,
  type InversorAfetado,
  type NivelAlerta,
} from '@/types/alertas'
import {
  Card,
  CardHead,
  CardTitle,
  Pill,
  Info,
  InfoGrid,
  type PillTone,
} from '@/components/trylab/primitives'
import { Select } from '@/components/trylab/Select'

// ── Helpers ────────────────────────────────────────────────────────

const NIVEL_TONE: Record<NivelAlerta, PillTone> = {
  critico: 'crit',
  aviso: 'warn',
  info: 'ghost',
}
const NIVEL_LABEL: Record<NivelAlerta, string> = {
  critico: 'Crítico',
  aviso: 'Aviso',
  info: 'Info',
}
const ESTADO_LABEL: Record<EstadoAlerta, string> = {
  ativo: 'Ativo',
  resolvido: 'Resolvido',
}

function montarUrlProvedor(provedor: string, idUsina: string): string | null {
  switch (provedor) {
    case 'auxsol':
      return `https://eu.auxsolcloud.com/#/analysis/plant-view?plantId=${idUsina}`
    case 'solarman':
      return `https://globalpro.solarmanpv.com/station/main?id=${idUsina}`
    case 'solis':
      return `https://www.soliscloud.com/station/stationDetails/generalSituation/${idUsina}`
    case 'hoymiles':
      return `https://global.hoymiles.com/website/plant/detail/${idUsina}`
    case 'fusionsolar':
      return `https://intl.fusionsolar.huawei.com/#/energy/list/station/${idUsina}`
    case 'foxess':
      return `https://www.foxesscloud.com/page/station/detail?stationID=${idUsina}`
    default:
      return null
  }
}

// Chaves que NÃO devem virar coluna na tabela de inversores afetados
const CHAVES_META = new Set([
  'id',
  'numero_serie',
  'id_externo',
  'mensagem',
  'severidade',
  'leitura_id',
  'potencia_usina_kw',
  'coletas_consecutivas_offline',
])

const COLUNA_LABELS: Record<string, string> = {
  medido_em: 'Medido em',
  estado: 'Estado',
  estado_inversor: 'Estado',
  tensao_ac_v: 'Tensão AC',
  limite_minimo_v: 'Limite mín.',
  limite_v: 'Limite',
  frequencia_hz: 'Frequência',
  temperatura_c: 'Temperatura',
  potencia_kw: 'Potência',
  pac_kw: 'Potência',
}

const COLUNA_UNIDADES: Record<string, string> = {
  tensao_ac_v: 'V',
  limite_minimo_v: 'V',
  limite_v: 'V',
  frequencia_hz: 'Hz',
  temperatura_c: '°C',
  potencia_kw: 'kW',
  pac_kw: 'kW',
}

function colunasExtras(inversores: InversorAfetado[]): string[] {
  const set = new Set<string>()
  for (const inv of inversores) {
    for (const k of Object.keys(inv)) {
      if (CHAVES_META.has(k)) continue
      const v = inv[k]
      if (v == null) continue
      if (typeof v === 'object') continue
      set.add(k)
    }
  }
  return Array.from(set)
}

function rotularColuna(chave: string): string {
  return COLUNA_LABELS[chave] || chave
}

function formatarValor(chave: string, v: unknown): string {
  if (v == null) return '—'
  if (chave === 'medido_em' && typeof v === 'string') {
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  }
  const unidade = COLUNA_UNIDADES[chave]
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    const txt = String(v)
    return unidade ? `${txt} ${unidade}` : txt
  }
  return JSON.stringify(v)
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR')
}

// ── Página ────────────────────────────────────────────────────────

export default function AlertaDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useAlerta(id ?? '')

  function handleVoltar() {
    void navigate('/alertas')
  }

  if (loading) {
    return (
      <div className="tl-scr">
        <header className="tl-scr-head">
          <div>
            <div className="tl-crumb">Monitoramento · Alertas · Detalhe</div>
            <h1 style={{ margin: 0 }}>Carregando…</h1>
          </div>
        </header>
        <SkeletonBox h={220} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="tl-scr">
        <header className="tl-scr-head">
          <div>
            <button
              type="button"
              className="tl-link-sm"
              onClick={handleVoltar}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ArrowLeftIcon className="size-3.5" /> Voltar
            </button>
            <h1 style={{ margin: '6px 0 0' }}>Detalhe do alerta</h1>
          </div>
        </header>
        <Card>
          <div style={{ padding: 36, textAlign: 'center', fontSize: 12.5 }}>
            <span style={{ color: 'var(--tl-crit)' }}>{error}</span>{' '}
            <button type="button" className="tl-link-sm" onClick={() => void refetch()}>
              Tentar novamente
            </button>
          </div>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="tl-scr">
        <header className="tl-scr-head">
          <div>
            <button
              type="button"
              className="tl-link-sm"
              onClick={handleVoltar}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ArrowLeftIcon className="size-3.5" /> Voltar
            </button>
            <h1 style={{ margin: '6px 0 0' }}>Alerta não encontrado</h1>
          </div>
        </header>
      </div>
    )
  }

  const provedorUrl = montarUrlProvedor(data.usina_provedor, data.usina_id_provedor)
  const provedorLabel = PROVEDOR_LABELS[data.usina_provedor] || data.usina_provedor
  const categoriaLabel = data.categoria_efetiva
    ? CATEGORIA_LABELS[data.categoria_efetiva] || data.categoria_efetiva
    : 'Alerta do provedor'

  return (
    <div className="tl-scr">
      {/* ── Header ── */}
      <header className="tl-scr-head" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="tl-crumb">
            <button
              type="button"
              className="tl-link-sm"
              onClick={handleVoltar}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ArrowLeftIcon className="size-3.5" /> Alertas
            </button>
            <span>/</span>
            <span>#{data.id}</span>
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
            <h1 style={{ margin: 0 }}>{categoriaLabel}</h1>
            <Pill tone={NIVEL_TONE[data.nivel]}>{NIVEL_LABEL[data.nivel]}</Pill>
            <Pill tone={data.estado === 'ativo' ? 'crit' : 'ghost'}>
              {ESTADO_LABEL[data.estado]}
            </Pill>
          </div>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 13,
              color: 'var(--tl-muted-fg)',
              lineHeight: 1.5,
            }}
          >
            {data.mensagem}
          </p>
        </div>
      </header>

      {/* ── Info ── */}
      <Card>
        <CardHead>
          <CardTitle sub="dados do alerta e da usina">Informações</CardTitle>
        </CardHead>
        <InfoGrid>
          <Info label="Usina" value={data.usina_nome} />
          <Info
            label="Provedor"
            value={
              <span>
                {provedorLabel}
                {provedorUrl && (
                  <>
                    {' '}
                    <a
                      href={provedorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tl-link-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      Ver no site <ExternalLinkIcon className="size-3" />
                    </a>
                  </>
                )}
              </span>
            }
          />
          {data.equipamento_sn && !data.agregado && (
            <Info label="Equipamento (SN)" value={data.equipamento_sn} mono />
          )}
          {data.agregado && data.qtd_inversores_afetados ? (
            <Info
              label="Inversores afetados"
              value={
                data.total_inversores_da_usina
                  ? `${data.qtd_inversores_afetados} de ${data.total_inversores_da_usina}`
                  : String(data.qtd_inversores_afetados)
              }
            />
          ) : null}
          <Info label="Início" value={formatarData(data.inicio)} mono />
          <Info
            label="Fim"
            value={data.fim ? formatarData(data.fim) : 'Em andamento'}
            mono
          />
        </InfoGrid>
      </Card>

      {/* ── Inversores afetados (agregado) ── */}
      {data.agregado &&
      data.inversores_afetados &&
      data.inversores_afetados.length > 0 ? (
        <InversoresAfetadosCard
          inversores={data.inversores_afetados}
          totalUsina={data.total_inversores_da_usina}
          qtdAfetados={data.qtd_inversores_afetados ?? data.inversores_afetados.length}
        />
      ) : null}

      {/* ── Atualizar estado ── */}
      <Card>
        <CardHead>
          <CardTitle sub="marcar como resolvido ou registrar anotações">
            Atualizar alerta
          </CardTitle>
        </CardHead>
        <AlertaEstadoFormTl alerta={data} onSuccess={() => void refetch()} />
      </Card>
    </div>
  )
}

// ── Subcomponentes ────────────────────────────────────────────────

function SkeletonBox({ h }: { h: number }) {
  return (
    <div
      style={{
        height: h,
        borderRadius: 14,
        background: 'var(--tl-card-bg)',
        border: '1px solid var(--tl-card-bd)',
      }}
      aria-busy
    />
  )
}

function InversoresAfetadosCard({
  inversores,
  totalUsina,
  qtdAfetados,
}: {
  inversores: InversorAfetado[]
  totalUsina?: number | null
  qtdAfetados: number
}) {
  const extras = colunasExtras(inversores)
  const cols = `minmax(140px, 1.4fr) ${extras.map(() => '1fr').join(' ')}`

  return (
    <Card>
      <CardHead>
        <CardTitle
          count={qtdAfetados}
          sub={totalUsina ? `${qtdAfetados} de ${totalUsina} na usina` : undefined}
        >
          Inversores afetados
        </CardTitle>
      </CardHead>
      <div className="tl-itable" style={{ overflowX: 'auto' }}>
        <div
          className="tl-itable-thead"
          style={{ gridTemplateColumns: cols }}
        >
          <span>Número de série</span>
          {extras.map((c) => (
            <span key={c}>{rotularColuna(c)}</span>
          ))}
        </div>
        {inversores.map((inv) => (
          <div
            key={inv.id}
            className="tl-itable-tr"
            style={{ gridTemplateColumns: cols, cursor: 'default' }}
          >
            <span className="mono">
              {inv.numero_serie || inv.id_externo || `#${inv.id}`}
            </span>
            {extras.map((c) => (
              <span key={c} className="muted" style={{ fontSize: 12 }}>
                {formatarValor(c, inv[c])}
              </span>
            ))}
          </div>
        ))}
      </div>
    </Card>
  )
}

function AlertaEstadoFormTl({
  alerta,
  onSuccess,
}: {
  alerta: AlertaDetalhe
  onSuccess: () => void
}) {
  const [estado, setEstado] = useState<EstadoAlerta>(alerta.estado)
  const [anotacoes, setAnotacoes] = useState<string>(alerta.anotacoes ?? '')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setEstado(alerta.estado)
    setAnotacoes(alerta.anotacoes ?? '')
  }, [alerta.id, alerta.estado, alerta.anotacoes])

  async function salvar() {
    setSubmitting(true)
    try {
      if (estado === 'resolvido' && alerta.estado !== 'resolvido') {
        await api.post(`/alertas/${alerta.id}/resolver/`)
      }
      toast.success('Alerta atualizado.')
      onSuccess()
    } catch {
      toast.error('Erro ao atualizar alerta.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="tl-form-grid">
        <div className="tl-field">
          <span className="tl-field-label">Estado</span>
          <Select
            value={estado}
            onChange={(v) => setEstado(v as EstadoAlerta)}
            options={[
              ['ativo', 'Ativo'],
              ['resolvido', 'Resolvido'],
            ]}
            disabled={submitting}
            ariaLabel="Estado do alerta"
          />
        </div>
        <div />
        <div className="tl-field" style={{ gridColumn: '1 / -1' }}>
          <label className="tl-field-label" htmlFor="anotacoes">
            Anotações <span style={{ textTransform: 'none' }}>(não persiste no backend ainda)</span>
          </label>
          <textarea
            id="anotacoes"
            className="tl-input"
            value={anotacoes}
            onChange={(e) => setAnotacoes(e.target.value)}
            placeholder="Notas internas sobre o tratamento do alerta…"
            rows={3}
            disabled={submitting}
            style={{ resize: 'vertical', minHeight: 70 }}
          />
        </div>
      </div>
      <div className="tl-form-actions">
        <button
          type="button"
          className="tl-btn-primary"
          onClick={() => void salvar()}
          disabled={submitting || estado === alerta.estado}
        >
          {submitting ? (
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
