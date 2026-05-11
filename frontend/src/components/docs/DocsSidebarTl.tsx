/**
 * Sidebar TryLab para /docs — replica visual da Sidebar principal
 * (componente trylab) mas com a árvore de tópicos de DOCS_SECOES.
 */
import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ArrowLeftIcon } from 'lucide-react'
import { DOCS_SECOES, rotaDocs } from '@/components/docs/docs-data'
import { useSidebarCollapsed } from '@/components/trylab/sun-store'
import { DocsSearch } from '@/components/docs/DocsSearch'

const GROUPS_KEY = 'trylab.docs-sidebar.groups'

function readOpenGroups(defaults: Record<string, boolean>): Record<string, boolean> {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = window.localStorage.getItem(GROUPS_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return { ...defaults, ...parsed }
  } catch {
    return defaults
  }
}

function ChevDown() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

export function DocsSidebarTl() {
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useSidebarCollapsed()

  function secaoAtiva(secao: (typeof DOCS_SECOES)[number]): boolean {
    return secao.topicos.some((t) => {
      const alvo = rotaDocs(t.slug)
      if (alvo === '/docs') return pathname === '/docs' || pathname === '/docs/'
      return pathname === alvo
    })
  }

  const defaults: Record<string, boolean> = {}
  for (const s of DOCS_SECOES) defaults[s.titulo] = secaoAtiva(s)

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    readOpenGroups(defaults),
  )

  useEffect(() => {
    try {
      window.localStorage.setItem(GROUPS_KEY, JSON.stringify(openGroups))
    } catch {
      // ignore
    }
  }, [openGroups])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setCollapsed(!collapsed)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [collapsed, setCollapsed])

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <nav className="tl-side" data-collapsed={collapsed}>
      <div className="tl-logo">
        <div className="tl-logo-mark">
          <BookIcon />
        </div>
        <div className="tl-logo-word">
          <b>Documentação</b>
          <em>Monitoramento Solar</em>
        </div>
        <button
          type="button"
          className="tl-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expandir (Ctrl+B)' : 'Recolher (Ctrl+B)'}
          aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
          </svg>
        </button>
      </div>

      <div className="tl-side-nav">
        {/* Voltar para o app */}
        <div className="tl-side-section">
          <NavLink
            to="/"
            className="tl-side-item"
            title="Voltar para o app"
          >
            <ArrowLeftIcon className="size-4" />
            <span className="tl-side-label">Voltar para o app</span>
          </NavLink>
        </div>

        {/* Busca */}
        {!collapsed && (
          <div className="tl-side-section">
            <DocsSearch />
          </div>
        )}

        {/* Seções com tópicos colapsáveis */}
        {DOCS_SECOES.map((secao) => {
          const open = openGroups[secao.titulo] ?? false
          return (
            <div className="tl-side-section" key={secao.titulo}>
              {!collapsed && (
                <div className="tl-side-group-label">{secao.titulo}</div>
              )}
              <button
                type="button"
                className="tl-side-group-header"
                data-open={open}
                onClick={() => toggleGroup(secao.titulo)}
                aria-expanded={open}
                title={collapsed ? secao.titulo : undefined}
              >
                <span className="tl-side-label">{secao.titulo}</span>
                <span className="tl-side-group-chev" aria-hidden>
                  <ChevDown />
                </span>
              </button>
              {open && !collapsed && (
                <div className="tl-side-group-children">
                  {secao.topicos.map((t) => (
                    <NavLink
                      key={t.slug || 'raiz'}
                      to={rotaDocs(t.slug)}
                      end
                      className={({ isActive }) =>
                        'tl-side-sub-item' + (isActive ? ' active' : '')
                      }
                    >
                      {t.titulo}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
