import { Outlet, useLocation } from "react-router-dom";

import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DOCS_SECOES, rotaDocs } from "@/components/docs/docs-data";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

interface PosicaoDoc {
  secao: string;
  topico: string;
}

function localizarTopico(pathname: string): PosicaoDoc | null {
  for (const secao of DOCS_SECOES) {
    for (const topico of secao.topicos) {
      if (pathname === rotaDocs(topico.slug)) {
        return { secao: secao.titulo, topico: topico.titulo };
      }
    }
  }
  return null;
}

export default function DocsLayout() {
  const { pathname } = useLocation();
  const posicao = localizarTopico(pathname);
  useDocumentTitle(posicao ? `${posicao.topico} · Docs` : "Documentação");

  return (
    <SidebarProvider>
      <DocsSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/docs">Documentação</BreadcrumbLink>
              </BreadcrumbItem>
              {posicao && (
                <>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem className="hidden md:block">
                    {posicao.secao}
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{posicao.topico}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto w-full max-w-4xl">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  );
}
