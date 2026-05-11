import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MailIcon, MessageSquareIcon, WebhookIcon, Loader2Icon } from 'lucide-react'
import { useNotificacoesConfig } from '@/hooks/use-notificacoes-config'
import type {
  CanalNotificacao,
  ConfiguracaoNotificacao,
  ConfiguracaoNotificacaoPayload,
} from '@/types/notificacoes-config'
import { Card, CardHead, CardTitle, Pill } from '@/components/trylab/primitives'

interface CanalMeta {
  canal: CanalNotificacao
  titulo: string
  descricao: string
  icone: typeof MailIcon
  placeholder: string
  help: string
}

const CANAIS: CanalMeta[] = [
  {
    canal: 'email',
    titulo: 'E-mail',
    descricao: 'Envia notificações por e-mail para os endereços cadastrados.',
    icone: MailIcon,
    placeholder: 'suporte@firmasolar.com.br\nequipe@firmasolar.com.br',
    help: 'Um e-mail por linha (ou separados por vírgula).',
  },
  {
    canal: 'whatsapp',
    titulo: 'WhatsApp',
    descricao: 'Dispara mensagem de WhatsApp para os números cadastrados.',
    icone: MessageSquareIcon,
    placeholder: '+5548999999999\n+5511988888888',
    help: 'Formato internacional com DDI (ex: +5548999999999).',
  },
  {
    canal: 'webhook',
    titulo: 'Webhook',
    descricao: 'Envia POST JSON para URLs externas (integrar com CRM/ERP).',
    icone: WebhookIcon,
    placeholder: 'https://crm.empresa.com/webhook/firmasolar\nhttps://n8n.example.com/webhook/abc',
    help: 'Uma URL por linha. O payload inclui dados do alerta (mensagem, nível, usina).',
  },
]

export default function GestaoNotificacoesPage() {
  const { data, loading, error, criar, atualizar, extrairErro } = useNotificacoesConfig()
  const [salvandoCanal, setSalvandoCanal] = useState<CanalNotificacao | null>(null)

  const porCanal: Record<CanalNotificacao, ConfiguracaoNotificacao | null> = {
    email: data?.find((c) => c.canal === 'email') ?? null,
    whatsapp: data?.find((c) => c.canal === 'whatsapp') ?? null,
    webhook: data?.find((c) => c.canal === 'webhook') ?? null,
  }

  async function handleSalvar(
    canal: CanalNotificacao,
    payload: ConfiguracaoNotificacaoPayload,
  ) {
    setSalvandoCanal(canal)
    try {
      const existente = porCanal[canal]
      if (existente) {
        await atualizar(existente.id, payload)
      } else {
        await criar(canal, payload)
      }
      toast.success(`Canal "${canal}" salvo.`)
    } catch (err) {
      toast.error(extrairErro(err, 'Erro ao salvar canal.'))
    } finally {
      setSalvandoCanal(null)
    }
  }

  if (error) {
    return (
      <div className="tl-scr">
        <header className="tl-scr-head">
          <div>
            <div className="tl-crumb">Monitoramento <span>/</span> Notificações</div>
            <h1 style={{ margin: 0 }}>Gestão de notificações</h1>
          </div>
        </header>
        <Card>
          <div style={{ padding: 18, color: 'var(--tl-crit)', fontSize: 12.5 }}>{error}</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="tl-scr">
      <header className="tl-scr-head">
        <div>
          <div className="tl-crumb">Monitoramento <span>/</span> Notificações</div>
          <h1 style={{ margin: 0 }}>Gestão de notificações</h1>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 12,
              color: 'var(--tl-muted-fg)',
              maxWidth: 720,
              lineHeight: 1.5,
            }}
          >
            Configure quem recebe as notificações de alertas, por quais canais e
            para quais níveis de severidade. A configuração é global — todos os
            destinatários cadastrados recebem.
          </p>
        </div>
      </header>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 280,
                borderRadius: 14,
                background: 'var(--tl-card-bg)',
                border: '1px solid var(--tl-card-bd)',
              }}
            />
          ))}
        </div>
      ) : (
        CANAIS.map((meta) => (
          <CanalCard
            key={meta.canal}
            meta={meta}
            config={porCanal[meta.canal]}
            onSalvar={(p) => handleSalvar(meta.canal, p)}
            salvando={salvandoCanal === meta.canal}
          />
        ))
      )}
    </div>
  )
}

function CanalCard({
  meta,
  config,
  onSalvar,
  salvando,
}: {
  meta: CanalMeta
  config: ConfiguracaoNotificacao | null
  onSalvar: (payload: ConfiguracaoNotificacaoPayload) => Promise<void>
  salvando: boolean
}) {
  const Icone = meta.icone
  const [ativo, setAtivo] = useState(config?.ativo ?? false)
  const [destinatarios, setDestinatarios] = useState(config?.destinatarios ?? '')
  const [notificarCritico, setNotificarCritico] = useState(config?.notificar_critico ?? true)
  const [notificarAviso, setNotificarAviso] = useState(config?.notificar_aviso ?? false)
  const [notificarInfo, setNotificarInfo] = useState(config?.notificar_info ?? false)

  useEffect(() => {
    setAtivo(config?.ativo ?? false)
    setDestinatarios(config?.destinatarios ?? '')
    setNotificarCritico(config?.notificar_critico ?? true)
    setNotificarAviso(config?.notificar_aviso ?? false)
    setNotificarInfo(config?.notificar_info ?? false)
  }, [config])

  async function handleSubmit() {
    await onSalvar({
      ativo,
      destinatarios,
      notificar_critico: notificarCritico,
      notificar_aviso: notificarAviso,
      notificar_info: notificarInfo,
    })
  }

  return (
    <Card>
      <CardHead>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1 }}>
          <Icone
            className="size-5"
            style={{ color: 'var(--tl-muted-fg)', marginTop: 1, flexShrink: 0 }}
          />
          <CardTitle sub={meta.descricao}>{meta.titulo}</CardTitle>
        </div>
        <Pill tone={ativo ? 'ok' : 'ghost'}>{ativo ? 'Ativo' : 'Inativo'}</Pill>
      </CardHead>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12.5,
            cursor: 'pointer',
            color: 'var(--tl-fg)',
          }}
        >
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            disabled={salvando}
            style={{ accentColor: 'var(--tl-accent)', width: 14, height: 14 }}
          />
          Canal ativo — desmarque para desligar sem perder configurações
        </label>

        <div className="tl-field">
          <label className="tl-field-label" htmlFor={`dest-${meta.canal}`}>
            Destinatários
          </label>
          <textarea
            id={`dest-${meta.canal}`}
            rows={4}
            value={destinatarios}
            onChange={(e) => setDestinatarios(e.target.value)}
            placeholder={meta.placeholder}
            disabled={salvando}
            className="tl-input"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              resize: 'vertical',
              minHeight: 90,
            }}
          />
          <p className="tl-fine-text" style={{ margin: 0 }}>
            {meta.help}
          </p>
        </div>

        <div>
          <div className="tl-field-label" style={{ marginBottom: 8 }}>
            Notificar alertas de nível
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <NivelCheckbox
              checked={notificarCritico}
              onChange={setNotificarCritico}
              tone="crit"
              label="Crítico"
              disabled={salvando}
            />
            <NivelCheckbox
              checked={notificarAviso}
              onChange={setNotificarAviso}
              tone="warn"
              label="Aviso"
              disabled={salvando}
            />
            <NivelCheckbox
              checked={notificarInfo}
              onChange={setNotificarInfo}
              tone="info"
              label="Info"
              disabled={salvando}
            />
          </div>
        </div>

        <div className="tl-form-actions" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="tl-btn-primary"
            onClick={() => void handleSubmit()}
            disabled={salvando}
          >
            {salvando ? (
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
    </Card>
  )
}

function NivelCheckbox({
  checked,
  onChange,
  tone,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  tone: 'crit' | 'warn' | 'info'
  label: string
  disabled: boolean
}) {
  const color =
    tone === 'crit'
      ? 'oklch(0.85 0.18 25)'
      : tone === 'warn'
        ? 'oklch(0.85 0.15 70)'
        : 'oklch(0.85 0.1 240)'
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12.5,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        style={{ accentColor: 'var(--tl-accent)', width: 14, height: 14 }}
      />
      {label}
    </label>
  )
}
