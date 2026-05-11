import { Outlet, useLocation } from 'react-router-dom'
import { ChevronRightIcon } from 'lucide-react'
import { ScrollToTop } from '@/components/ScrollToTop'
import { SunBackground } from '@/components/trylab/SunBackground'
import { useApplyTheme } from '@/components/trylab/sun-store'
import { DocsSidebarTl } from '@/components/docs/DocsSidebarTl'
import { DOCS_SECOES, rotaDocs } from '@/components/docs/docs-data'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { Toaster } from '@/components/ui/sonner'

interface PosicaoDoc {
  secao: string
  topico: string
}

function localizarTopico(pathname: string): PosicaoDoc | null {
  for (const secao of DOCS_SECOES) {
    for (const topico of secao.topicos) {
      if (pathname === rotaDocs(topico.slug)) {
        return { secao: secao.titulo, topico: topico.titulo }
      }
    }
  }
  return null
}

export default function DocsLayout() {
  const { pathname } = useLocation()
  const posicao = localizarTopico(pathname)
  useDocumentTitle(posicao ? `${posicao.topico} · Docs` : 'Documentação')
  useApplyTheme()

  return (
    <div className="tl-app">
      <ScrollToTop />
      <SunBackground />
      <DocsSidebarTl />
      <main className="tl-main">
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          {/* Breadcrumb topo no estilo TryLab */}
          <div
            className="tl-crumb"
            style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>Documentação</span>
            {posicao && (
              <>
                <ChevronRightIcon
                  className="size-3"
                  style={{ opacity: 0.4 }}
                  aria-hidden
                />
                <span>{posicao.secao}</span>
                <ChevronRightIcon
                  className="size-3"
                  style={{ opacity: 0.4 }}
                  aria-hidden
                />
                <span style={{ color: 'var(--tl-fg)' }}>{posicao.topico}</span>
              </>
            )}
          </div>
          <Outlet />
        </div>
      </main>
      <Toaster richColors position="top-right" />
    </div>
  )
}
