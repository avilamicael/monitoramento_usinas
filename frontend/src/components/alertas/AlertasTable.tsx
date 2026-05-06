import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { CATEGORIA_LABELS, type AlertaResumo, type EstadoAlerta, type NivelAlerta } from '@/types/alertas'

interface AlertasTableProps {
  alertas: AlertaResumo[]
  onSelectAlerta?: (id: string) => void
}

const NIVEL_CONFIG: Record<NivelAlerta, { label: string; className?: string; variant?: 'destructive' | 'secondary' | 'outline' }> = {
  critico: { label: 'Critico', variant: 'destructive' },
  aviso: { label: 'Aviso', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200' },
  info: { label: 'Info', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200' },
}

const ESTADO_LABEL: Record<EstadoAlerta, string> = {
  ativo: 'Ativo',
  resolvido: 'Resolvido',
}

// Sufixo da frase agregada por categoria de regra. Mostra "X de Y inversores
// <sufixo>" na listagem para esconder o número de série (que fica na pagina
// de detalhe). Categorias fora deste mapa caem no `mensagem` original.
const SUFIXO_AGREGADO: Record<string, string> = {
  inversor_offline: 'offline',
  temperatura_alta: 'com temperatura alta',
  string_mppt_zerada: 'com string MPPT zerada',
  sobretensao_ac: 'com sobretensão AC',
  subtensao_ac: 'com subtensão AC',
  frequencia_anomala: 'com frequência anômala',
  dado_eletrico_ausente: 'sem dado elétrico',
}

function mensagemListagem(alerta: AlertaResumo): string {
  if (!alerta.agregado || !alerta.qtd_inversores_afetados) return alerta.mensagem
  const sufixo = SUFIXO_AGREGADO[alerta.categoria_efetiva]
  if (!sufixo) return alerta.mensagem
  const qtd = alerta.qtd_inversores_afetados
  const total = alerta.total_inversores_da_usina
  if (total && total > 0) {
    return `${qtd} de ${total} inversores ${sufixo}`
  }
  return qtd === 1 ? `1 inversor ${sufixo}` : `${qtd} inversores ${sufixo}`
}

export function AlertasTable({ alertas, onSelectAlerta }: AlertasTableProps) {
  // Detecta nomes de usina duplicados na listagem atual. Quando o mesmo nome
  // aparece em mais de uma usina (ex: "CALISE CAROLINE" com dois cadastros no
  // Solarman), mostramos o id do provedor para distinguir cada planta.
  const nomesDuplicados = new Set<string>()
  const vistos = new Set<string>()
  for (const a of alertas) {
    if (vistos.has(a.usina_nome)) {
      nomesDuplicados.add(a.usina_nome)
    } else {
      vistos.add(a.usina_nome)
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Usina</TableHead>
          <TableHead>Mensagem</TableHead>
          <TableHead>Nivel</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Data</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {alertas.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              Nenhum alerta encontrado
            </TableCell>
          </TableRow>
        ) : (
          alertas.map((alerta) => {
            const nivelConfig = NIVEL_CONFIG[alerta.nivel]
            const mostrarIdProvedor = nomesDuplicados.has(alerta.usina_nome)
            return (
              <TableRow key={alerta.id} onClick={() => onSelectAlerta?.(alerta.id)}>
                <TableCell>
                  <Link
                    to={`/alertas/${alerta.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {alerta.usina_nome}
                  </Link>
                  {mostrarIdProvedor && (
                    <div className="text-xs text-muted-foreground">
                      {alerta.usina_provedor} · #{alerta.usina_id_provedor}
                    </div>
                  )}
                </TableCell>
                <TableCell className="max-w-xs truncate" title={alerta.mensagem}>
                  {mensagemListagem(alerta)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {nivelConfig.className ? (
                      <Badge className={nivelConfig.className}>{nivelConfig.label}</Badge>
                    ) : (
                      <Badge variant={nivelConfig.variant}>{nivelConfig.label}</Badge>
                    )}
                    {alerta.regra_desativada && alerta.estado === 'ativo' && (
                      <Badge
                        variant="outline"
                        className="text-xs border-muted-foreground/40 text-muted-foreground"
                        title="A regra que gerou este alerta foi desativada nas configurações. Resolva manualmente."
                      >
                        Regra desativada
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{ESTADO_LABEL[alerta.estado] || alerta.estado}</TableCell>
                <TableCell>
                  {alerta.categoria_efetiva ? (
                    <span className="text-xs text-muted-foreground">
                      {CATEGORIA_LABELS[alerta.categoria_efetiva] || alerta.categoria_efetiva}
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  {new Date(alerta.inicio).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}
