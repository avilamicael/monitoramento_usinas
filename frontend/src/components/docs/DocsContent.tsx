/**
 * Primitives de conteúdo da documentação — estilo TryLab.
 *
 * Consumidos por todas as páginas em pages/docs/*. Reescritos para usar
 * tokens TryLab (--tl-fg, --tl-muted-fg, --tl-accent etc.) em vez de
 * classes Tailwind alinhadas ao tema shadcn antigo.
 */
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { InfoIcon, LightbulbIcon, TriangleAlertIcon } from 'lucide-react'

type CalloutTipo = 'info' | 'aviso' | 'dica'

const CALLOUT_CONFIG: Record<
  CalloutTipo,
  { icone: typeof InfoIcon; bg: string; border: string; color: string; titulo: string }
> = {
  info: {
    icone: InfoIcon,
    bg: 'oklch(0.65 0.12 240 / 0.1)',
    border: 'oklch(0.65 0.12 240 / 0.35)',
    color: 'oklch(0.85 0.1 240)',
    titulo: 'Para saber',
  },
  aviso: {
    icone: TriangleAlertIcon,
    bg: 'oklch(0.7 0.18 75 / 0.1)',
    border: 'oklch(0.7 0.18 75 / 0.35)',
    color: 'oklch(0.85 0.15 75)',
    titulo: 'Atenção',
  },
  dica: {
    icone: LightbulbIcon,
    bg: 'oklch(0.6 0.15 150 / 0.1)',
    border: 'oklch(0.6 0.15 150 / 0.35)',
    color: 'oklch(0.85 0.13 150)',
    titulo: 'Dica',
  },
}

export function DocsHeader({
  titulo,
  descricao,
}: {
  titulo: string
  descricao?: string
}) {
  return (
    <header
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        paddingBottom: 18,
        borderBottom: '1px solid var(--tl-line-soft)',
      }}
    >
      <h1
        style={{
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          margin: 0,
          color: 'var(--tl-fg)',
        }}
      >
        {titulo}
      </h1>
      {descricao && (
        <p style={{ fontSize: 14, color: 'var(--tl-muted-fg)', margin: 0, lineHeight: 1.55 }}>
          {descricao}
        </p>
      )}
    </header>
  )
}

export function DocsSection({
  titulo,
  children,
  id,
}: {
  titulo: string
  children: ReactNode
  id?: string
}) {
  return (
    <section
      id={id}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <h2
        style={{
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: '-0.015em',
          margin: 0,
          color: 'var(--tl-fg)',
        }}
      >
        {titulo}
      </h2>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          fontSize: 14,
          lineHeight: 1.65,
          color: 'var(--tl-fg)',
        }}
      >
        {children}
      </div>
    </section>
  )
}

export function DocsSubsection({
  titulo,
  children,
}: {
  titulo: string
  children: ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3
        style={{
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          margin: 0,
          color: 'var(--tl-fg)',
        }}
      >
        {titulo}
      </h3>
      {children}
    </div>
  )
}

export function DocsParagraph({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: 0, color: 'var(--tl-fg)', lineHeight: 1.7 }}>{children}</p>
  )
}

const LINK_STYLE: CSSProperties = {
  fontWeight: 500,
  color: 'var(--tl-accent)',
  textDecoration: 'underline',
  textDecorationColor: 'oklch(from var(--tl-accent) l c h / 0.4)',
  textUnderlineOffset: 3,
}

export function AppLink({
  to,
  children,
  externo = false,
}: {
  to: string
  children: ReactNode
  externo?: boolean
}) {
  if (externo) {
    return (
      <a href={to} target="_blank" rel="noreferrer" style={LINK_STYLE}>
        {children}
      </a>
    )
  }
  return (
    <Link to={to} style={LINK_STYLE}>
      {children}
    </Link>
  )
}

export function Callout({
  tipo = 'info',
  titulo,
  children,
}: {
  tipo?: CalloutTipo
  titulo?: string
  children: ReactNode
}) {
  const cfg = CALLOUT_CONFIG[tipo]
  const Icone = cfg.icone
  return (
    <aside
      role="note"
      style={{
        display: 'flex',
        gap: 12,
        padding: 14,
        borderRadius: 10,
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        color: 'var(--tl-fg)',
        fontSize: 13.5,
        lineHeight: 1.6,
      }}
    >
      <Icone
        style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, color: cfg.color }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontWeight: 600, color: cfg.color }}>
          {titulo ?? cfg.titulo}
        </span>
        <div style={{ color: 'var(--tl-fg)' }}>{children}</div>
      </div>
    </aside>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      style={{
        display: 'inline-block',
        padding: '1px 6px',
        borderRadius: 4,
        background: 'oklch(0 0 0 / 0.25)',
        border: '1px solid var(--tl-line-soft)',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11.5,
        color: 'var(--tl-muted-fg)',
      }}
    >
      {children}
    </kbd>
  )
}

export function DocsList({
  children,
  ordered = false,
}: {
  children: ReactNode
  ordered?: boolean
}) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        paddingLeft: 22,
        margin: 0,
        fontSize: 14,
        lineHeight: 1.7,
        color: 'var(--tl-fg)',
        listStyle: ordered ? 'decimal' : 'disc',
      }}
    >
      {children}
    </Tag>
  )
}

export function DocsArticle({ children }: { children: ReactNode }) {
  return (
    <article
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 36,
        paddingBottom: 48,
      }}
    >
      {children}
    </article>
  )
}
