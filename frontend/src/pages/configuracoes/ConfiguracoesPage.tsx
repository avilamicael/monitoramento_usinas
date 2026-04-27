import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2Icon, SaveIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useConfiguracoes } from '@/hooks/use-configuracoes'
import type { ConfiguracaoSistemaUpdate } from '@/types/configuracoes'

interface FormState {
  dias_sem_comunicacao_pausar: string
  meses_garantia_padrao: string
  dias_aviso_garantia_proxima: string
  dias_aviso_garantia_urgente: string
  // Regras de alerta (extensão do backend novo)
  subdesempenho_limite_pct: string
  potencia_minima_avaliacao_kw: string
  inversor_offline_coletas_minimas: string
  sem_geracao_queda_abrupta_pct: string
  queda_rendimento_pct: string
  temperatura_limite_c: string
  retencao_leituras_dias: string
}

const VALORES_INICIAIS: FormState = {
  dias_sem_comunicacao_pausar: '',
  meses_garantia_padrao: '',
  dias_aviso_garantia_proxima: '',
  dias_aviso_garantia_urgente: '',
  subdesempenho_limite_pct: '',
  potencia_minima_avaliacao_kw: '',
  inversor_offline_coletas_minimas: '',
  sem_geracao_queda_abrupta_pct: '',
  queda_rendimento_pct: '',
  temperatura_limite_c: '',
  retencao_leituras_dias: '',
}

function extrairErroApi(err: unknown): string {
  const e = err as { response?: { status?: number; data?: Record<string, unknown> } }
  if (e?.response?.status === 403) return 'Sem permissão — apenas administradores podem alterar configurações.'
  const data = e?.response?.data
  if (data && typeof data === 'object') {
    const campos = Object.values(data)
      .flatMap((v) => (Array.isArray(v) ? v : [String(v)]))
      .join(' ')
    if (campos) return campos
  }
  return 'Erro ao salvar configurações'
}

export default function ConfiguracoesPage() {
  const { data, loading, error, saving, atualizar } = useConfiguracoes()
  const [form, setForm] = useState<FormState>(VALORES_INICIAIS)

  useEffect(() => {
    if (!data) return
    setForm({
      dias_sem_comunicacao_pausar: String(data.dias_sem_comunicacao_pausar),
      meses_garantia_padrao: String(data.meses_garantia_padrao),
      dias_aviso_garantia_proxima: String(data.dias_aviso_garantia_proxima),
      dias_aviso_garantia_urgente: String(data.dias_aviso_garantia_urgente),
      subdesempenho_limite_pct: data.subdesempenho_limite_pct !== undefined ? String(data.subdesempenho_limite_pct) : '',
      potencia_minima_avaliacao_kw: data.potencia_minima_avaliacao_kw !== undefined ? String(data.potencia_minima_avaliacao_kw) : '',
      inversor_offline_coletas_minimas: data.inversor_offline_coletas_minimas !== undefined ? String(data.inversor_offline_coletas_minimas) : '',
      sem_geracao_queda_abrupta_pct: data.sem_geracao_queda_abrupta_pct !== undefined ? String(data.sem_geracao_queda_abrupta_pct) : '',
      queda_rendimento_pct: data.queda_rendimento_pct !== undefined ? String(data.queda_rendimento_pct) : '',
      temperatura_limite_c: data.temperatura_limite_c !== undefined ? String(data.temperatura_limite_c) : '',
      retencao_leituras_dias: data.retencao_leituras_dias !== undefined ? String(data.retencao_leituras_dias) : '',
    })
  }, [data])

  function handleChange(campo: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [campo]: e.target.value }))
    }
  }

  function validar(): ConfiguracaoSistemaUpdate | null {
    // Campos inteiros >= 1 (originais)
    const camposInteiros: (keyof FormState)[] = [
      'dias_sem_comunicacao_pausar',
      'meses_garantia_padrao',
      'dias_aviso_garantia_proxima',
      'dias_aviso_garantia_urgente',
    ]
    const valoresInt: Record<string, number> = {}
    for (const campo of camposInteiros) {
      const valor = Number(form[campo])
      if (!Number.isInteger(valor) || valor < 1) {
        toast.error(`O campo "${campo}" precisa ser um inteiro maior que zero.`)
        return null
      }
      valoresInt[campo] = valor
    }
    if (valoresInt.dias_aviso_garantia_urgente >= valoresInt.dias_aviso_garantia_proxima) {
      toast.error('O aviso urgente precisa ser menor que o aviso prévio.')
      return null
    }

    const payload: ConfiguracaoSistemaUpdate = {
      dias_sem_comunicacao_pausar: valoresInt.dias_sem_comunicacao_pausar,
      meses_garantia_padrao: valoresInt.meses_garantia_padrao,
      dias_aviso_garantia_proxima: valoresInt.dias_aviso_garantia_proxima,
      dias_aviso_garantia_urgente: valoresInt.dias_aviso_garantia_urgente,
    }

    // Campos novos (regras de alerta) — só envia se preenchidos
    const camposDecimais: Array<[keyof FormState, keyof ConfiguracaoSistemaUpdate, string, [number, number]]> = [
      ['subdesempenho_limite_pct', 'subdesempenho_limite_pct', 'limite de subdesempenho (%)', [0, 100]],
      ['sem_geracao_queda_abrupta_pct', 'sem_geracao_queda_abrupta_pct', 'queda abrupta (%)', [0, 100]],
      ['queda_rendimento_pct', 'queda_rendimento_pct', 'queda de rendimento (%)', [0, 100]],
      ['temperatura_limite_c', 'temperatura_limite_c', 'temperatura limite (°C)', [-50, 200]],
      ['potencia_minima_avaliacao_kw', 'potencia_minima_avaliacao_kw', 'potência mínima de avaliação (kW)', [0, 100000]],
    ]
    for (const [campoForm, campoApi, descricao, [min, max]] of camposDecimais) {
      const raw = form[campoForm]
      if (raw === '' || raw === undefined) continue
      const valor = Number(raw)
      if (!Number.isFinite(valor) || valor < min || valor > max) {
        toast.error(`O campo "${descricao}" precisa estar entre ${min} e ${max}.`)
        return null
      }
      ;(payload as Record<string, unknown>)[campoApi] = valor
    }

    const camposIntsExtras: Array<[keyof FormState, keyof ConfiguracaoSistemaUpdate, string]> = [
      ['inversor_offline_coletas_minimas', 'inversor_offline_coletas_minimas', 'coletas mínimas para inversor offline'],
      ['retencao_leituras_dias', 'retencao_leituras_dias', 'retenção de leituras (dias)'],
    ]
    for (const [campoForm, campoApi, descricao] of camposIntsExtras) {
      const raw = form[campoForm]
      if (raw === '' || raw === undefined) continue
      const valor = Number(raw)
      if (!Number.isInteger(valor) || valor < 1) {
        toast.error(`O campo "${descricao}" precisa ser um inteiro maior que zero.`)
        return null
      }
      ;(payload as Record<string, unknown>)[campoApi] = valor
    }

    return payload
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = validar()
    if (!payload) return
    try {
      await atualizar(payload)
      toast.success('Configurações salvas.')
    } catch (err) {
      toast.error(extrairErroApi(err))
    }
  }

  if (loading) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Configurações</CardTitle>
          <CardDescription>Carregando...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Configurações</CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Configurações do Sistema</CardTitle>
        <CardDescription>
          Parâmetros globais que afetam a coleta de dados e a geração de alertas. As mudanças passam a valer
          no próximo ciclo de coleta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="dias_sem_comunicacao_pausar">Dias sem comunicação até pausar coleta</Label>
            <Input
              id="dias_sem_comunicacao_pausar"
              type="number"
              min={1}
              value={form.dias_sem_comunicacao_pausar}
              onChange={handleChange('dias_sem_comunicacao_pausar')}
              required
            />
            <p className="text-xs text-muted-foreground">
              Usinas sem snapshot há mais deste número de dias são automaticamente desativadas.
              Para retomar, abra a página da usina e clique em "Reativar coleta".
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meses_garantia_padrao">Meses de garantia padrão</Label>
            <Input
              id="meses_garantia_padrao"
              type="number"
              min={1}
              value={form.meses_garantia_padrao}
              onChange={handleChange('meses_garantia_padrao')}
              required
            />
            <p className="text-xs text-muted-foreground">
              Duração da garantia criada automaticamente ao registrar uma usina pela primeira vez.
              Só afeta usinas registradas após a mudança.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dias_aviso_garantia_proxima">Aviso prévio de garantia (dias)</Label>
            <Input
              id="dias_aviso_garantia_proxima"
              type="number"
              min={2}
              value={form.dias_aviso_garantia_proxima}
              onChange={handleChange('dias_aviso_garantia_proxima')}
              required
            />
            <p className="text-xs text-muted-foreground">
              Quando a garantia estiver a este número de dias ou menos do fim, cria alerta nível "aviso".
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dias_aviso_garantia_urgente">Aviso urgente de garantia (dias)</Label>
            <Input
              id="dias_aviso_garantia_urgente"
              type="number"
              min={1}
              value={form.dias_aviso_garantia_urgente}
              onChange={handleChange('dias_aviso_garantia_urgente')}
              required
            />
            <p className="text-xs text-muted-foreground">
              Escala o alerta para nível "importante" quando a garantia estiver a este número de dias ou menos do fim.
              Precisa ser menor que o aviso prévio.
            </p>
          </div>

          <div className="border-t pt-6 space-y-6">
            <div>
              <h3 className="text-base font-semibold">Regras de alerta</h3>
              <p className="text-sm text-muted-foreground">
                Limiares aplicados pelo motor de alertas a cada ciclo de coleta. Deixe em branco para usar o padrão.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subdesempenho_limite_pct">Limite de subdesempenho (%)</Label>
              <Input
                id="subdesempenho_limite_pct"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.subdesempenho_limite_pct}
                onChange={handleChange('subdesempenho_limite_pct')}
              />
              <p className="text-xs text-muted-foreground">
                Geração abaixo deste percentual da capacidade esperada dispara alerta de subdesempenho.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="potencia_minima_avaliacao_kw">Potência mínima para avaliação (kW)</Label>
              <Input
                id="potencia_minima_avaliacao_kw"
                type="number"
                min={0}
                step="0.1"
                value={form.potencia_minima_avaliacao_kw}
                onChange={handleChange('potencia_minima_avaliacao_kw')}
              />
              <p className="text-xs text-muted-foreground">
                Abaixo desta potência, o motor não avalia regras de desempenho (evita falso-positivo em horários de baixa irradiação).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inversor_offline_coletas_minimas">Coletas mínimas para inversor offline</Label>
              <Input
                id="inversor_offline_coletas_minimas"
                type="number"
                min={1}
                value={form.inversor_offline_coletas_minimas}
                onChange={handleChange('inversor_offline_coletas_minimas')}
              />
              <p className="text-xs text-muted-foreground">
                Quantos ciclos consecutivos sem dado para considerar o inversor offline.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sem_geracao_queda_abrupta_pct">Queda abrupta de geração (%)</Label>
              <Input
                id="sem_geracao_queda_abrupta_pct"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.sem_geracao_queda_abrupta_pct}
                onChange={handleChange('sem_geracao_queda_abrupta_pct')}
              />
              <p className="text-xs text-muted-foreground">
                Queda percentual em relação à média recente que dispara alerta de "sem geração no horário solar".
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="queda_rendimento_pct">Queda de rendimento (%)</Label>
              <Input
                id="queda_rendimento_pct"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.queda_rendimento_pct}
                onChange={handleChange('queda_rendimento_pct')}
              />
              <p className="text-xs text-muted-foreground">
                Queda comparativa com período anterior para alerta de degradação progressiva.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="temperatura_limite_c">Temperatura limite (°C)</Label>
              <Input
                id="temperatura_limite_c"
                type="number"
                step="0.1"
                value={form.temperatura_limite_c}
                onChange={handleChange('temperatura_limite_c')}
              />
              <p className="text-xs text-muted-foreground">
                Acima desta temperatura, o inversor recebe alerta de superaquecimento.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="retencao_leituras_dias">Retenção de leituras (dias)</Label>
              <Input
                id="retencao_leituras_dias"
                type="number"
                min={1}
                value={form.retencao_leituras_dias}
                onChange={handleChange('retencao_leituras_dias')}
              />
              <p className="text-xs text-muted-foreground">
                Leituras mais antigas que este intervalo são removidas pela rotina diária. Alertas não são afetados.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {data?.atualizado_em && (
              <p className="text-xs text-muted-foreground">
                Última atualização: {new Date(data.atualizado_em).toLocaleString('pt-BR')}
              </p>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
              Salvar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
