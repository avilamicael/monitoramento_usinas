import { Outlet, useLocation } from "react-router-dom";

import { AppSidebar } from "@/components/app-sidebar";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

const TITULOS_ROTAS: Record<string, string> = {
  "/": "Dashboard",
  "/usinas": "Usinas",
  "/alertas": "Alertas",
  "/garantias": "Garantias",
  "/provedores": "Provedores",
  "/notificacoes": "Notificações",
  "/usuarios": "Usuários",
  "/configuracoes": "Configurações",
  "/configuracao/regras": "Regras de alertas",
  "/empresas": "Empresas",
};

function tituloPagina(pathname: string): string {
  if (TITULOS_ROTAS[pathname]) return TITULOS_ROTAS[pathname];
  // detalhes (/usinas/:id, /alertas/:id) — pega o pai
  const segmentos = pathname.split("/").filter(Boolean);
  const raiz = "/" + segmentos[0];
  return TITULOS_ROTAS[raiz] ?? "Monitoramento Solar";
}

export default function AppLayout() {
  const { pathname } = useLocation();
  const titulo = tituloPagina(pathname);
  useDocumentTitle(titulo);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{titulo}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </SidebarInset>
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  );
}
