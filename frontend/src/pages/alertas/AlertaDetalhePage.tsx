import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, ExternalLinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertaEstadoForm } from '@/components/alertas/AlertaEstadoForm'
import { useAlerta } from '@/hooks/use-alertas'
import { PROVEDOR_LABELS } from '@/lib/provedores'
import {
  CATEGORIA_LABELS,
  type EstadoAlerta,
  type InversorAfetado,
  type NivelAlerta,
} from '@/types/alertas'

const NIVEL_CONFIG: Record<NivelAlerta, { label: string; className?: string; variant?: 'destructive' | 'secondary' | 'outline' }> = {
  critico: { label: 'Critico', variant: 'destructive' },
  importante: { label: 'Importante', className: 'bg-orange-100 text-orange-800 hover:bg-orange-100' },
  aviso: { label: 'Aviso', variant: 'secondary' },
  info: { label: 'Info', variant: 'outline' },
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

function NivelBadge({ nivel }: { nivel: NivelAlerta }) {
  const config = NIVEL_CONFIG[nivel]
  if (config.className) {
    return <Badge className={config.className}>{config.label}</Badge>
  }
  return <Badge variant={config.variant}>{config.label}</Badge>
}

/**
 * Identifica colunas extras de valor medido a partir do contexto do
 * inversor afetado, ignorando chaves de metadados.
 *
 * Os contextos das regras agregadoras seguem o padrão de chaves: além das
 * básicas (`id`, `numero_serie`, `id_externo`, `mensagem`, `severidade`),
 * cada regra adiciona campos próprios (`tensao_ac_v`, `limite_v`,
 * `frequencia_hz`, `temperatura_c`, etc.). Esses extras viram colunas
 * dinâmicas na tabela.
 */
// Chaves que NÃO devem virar coluna na tabela de inversores afetados:
// - identificadores e meta do inversor (já mostrados na 1ª coluna)
// - métricas da USINA inteira (não fazem sentido por linha de inversor)
// - parâmetros da regra (limites configurados, contadores de carência)
const CHAVES_META = new Set([
  'id', 'numero_serie', 'id_externo', 'mensagem', 'severidade',
  'leitura_id',
  // Métricas da usina, redundantes em cada linha:
  'potencia_usina_kw',
  // Parâmetros / metadados da regra que poluem a tabela:
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
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit',
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

export default function AlertaDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useAlerta(id ?? '')

  function handleVoltar() {
    void navigate('/alertas')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={handleVoltar} className="gap-2">
          <ArrowLeftIcon className="size-4" />
          Voltar
        </Button>
        <div className="text-center py-12 text-destructive">
          {error}{' '}
          <button onClick={() => void refetch()} className="underline hover:no-underline">
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={handleVoltar} className="gap-2">
          <ArrowLeftIcon className="size-4" />
          Voltar
        </Button>
        <p className="text-center py-12 text-muted-foreground">Alerta nao encontrado</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={handleVoltar} className="gap-2">
          <ArrowLeftIcon className="size-4" />
          Voltar
        </Button>
        <h1 className="text-2xl font-bold">Detalhe do Alerta</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <NivelBadge nivel={data.nivel} />
                {data.categoria_efetiva ? (
                  <CardTitle className="text-lg">{CATEGORIA_LABELS[data.categoria_efetiva] || data.categoria_efetiva}</CardTitle>
                ) : (
                  <CardTitle className="text-lg">Alerta do Provedor</CardTitle>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{data.mensagem}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground font-medium">Usina</dt>
              <dd className="mt-1">{data.usina_nome}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground font-medium">Estado Atual</dt>
              <dd className="mt-1">{ESTADO_LABEL[data.estado] || data.estado}</dd>
            </div>
            {data.equipamento_sn && !data.agregado && (
              <div>
                <dt className="text-muted-foreground font-medium">Equipamento (SN)</dt>
                <dd className="mt-1 font-mono text-xs">{data.equipamento_sn}</dd>
              </div>
            )}
            {data.agregado && data.qtd_inversores_afetados ? (
              <div>
                <dt className="text-muted-foreground font-medium">Inversores afetados</dt>
                <dd className="mt-1">
                  {data.qtd_inversores_afetados}
                  {data.total_inversores_da_usina
                    ? ` de ${data.total_inversores_da_usina}`
                    : ''}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground font-medium">Provedor</dt>
              <dd className="mt-1">
                {PROVEDOR_LABELS[data.usina_provedor] || data.usina_provedor}
                {(() => {
                  const url = montarUrlProvedor(data.usina_provedor, data.usina_id_provedor)
                  return url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-primary hover:underline inline-flex items-center gap-1 text-xs"
                    >
                      Ver no site <ExternalLinkIcon className="size-3" />
                    </a>
                  ) : null
                })()}
              </dd>
            </div>
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <dt className="text-muted-foreground font-medium">Inicio</dt>
                <dd className="mt-1">{new Date(data.inicio).toLocaleString('pt-BR')}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground font-medium">Fim</dt>
                <dd className="mt-1">{data.fim ? new Date(data.fim).toLocaleString('pt-BR') : 'Em andamento'}</dd>
              </div>
            </div>
            {data.categoria_efetiva && (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground font-medium">Categoria</dt>
                <dd className="mt-1">{CATEGORIA_LABELS[data.categoria_efetiva] || data.categoria_efetiva}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {data.agregado && data.inversores_afetados && data.inversores_afetados.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Inversores afetados
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {data.qtd_inversores_afetados ?? data.inversores_afetados.length}
                {data.total_inversores_da_usina
                  ? ` de ${data.total_inversores_da_usina} na usina`
                  : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const extras = colunasExtras(data.inversores_afetados)
              return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número de série</TableHead>
                      {extras.map((c) => (
                        <TableHead key={c}>{rotularColuna(c)}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.inversores_afetados.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs">
                          {inv.numero_serie || inv.id_externo || `#${inv.id}`}
                        </TableCell>
                        {extras.map((c) => (
                          <TableCell key={c} className="text-xs">
                            {formatarValor(c, inv[c])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            })()}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Atualizar Alerta</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertaEstadoForm alerta={data} onSuccess={() => void refetch()} />
        </CardContent>
      </Card>
    </div>
  )
}
