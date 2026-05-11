import { Outlet, useLocation } from "react-router-dom";

import { ScrollToTop } from "@/components/ScrollToTop";
import { Sidebar } from "@/components/trylab/Sidebar";
import { SunBackground } from "@/components/trylab/SunBackground";
import { useApplyTheme } from "@/components/trylab/sun-store";
import { useDocumentTitle } from "@/hooks/use-document-title";
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
  const segmentos = pathname.split("/").filter(Boolean);
  const raiz = "/" + segmentos[0];
  return TITULOS_ROTAS[raiz] ?? "Monitoramento Solar";
}

export default function AppLayout() {
  const { pathname } = useLocation();
  const titulo = tituloPagina(pathname);
  useDocumentTitle(titulo);
  useApplyTheme();

  return (
    <div className="tl-app">
      <ScrollToTop />
      <SunBackground />
      <Sidebar />
      <main className="tl-main">
        <Outlet />
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
