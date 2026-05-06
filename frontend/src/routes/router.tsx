import { createBrowserRouter, Navigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/routes/ProtectedRoute";
import SuperadminRoute from "@/routes/SuperadminRoute";
import LoginPage from "@/pages/auth/LoginPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import UsinasPage from "@/pages/usinas/UsinasPage";
import UsinaDetalhePage from "@/pages/usinas/UsinaDetalhePage";
import AlertasPage from "@/pages/alertas/AlertasPage";
import AlertaDetalhePage from "@/pages/alertas/AlertaDetalhePage";
import GarantiasPage from "@/pages/garantias/GarantiasPage";
import ProvedoresPage from "@/pages/provedores/ProvedoresPage";
import UsuariosPage from "@/pages/usuarios/UsuariosPage";
import NotificacoesPage from "@/pages/notificacoes/NotificacoesPage";
import GestaoNotificacoesPage from "@/pages/notificacoes/GestaoNotificacoesPage";
import ConfiguracoesPage from "@/pages/configuracoes/ConfiguracoesPage";
import RegrasPage from "@/pages/configuracao/RegrasPage";
import EmpresasPage from "@/pages/empresas/EmpresasPage";
import EmpresaNovaPage from "@/pages/empresas/EmpresaNovaPage";
import EmpresaDetalhePage from "@/pages/empresas/EmpresaDetalhePage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "usinas", element: <UsinasPage /> },
          { path: "usinas/:id", element: <UsinaDetalhePage /> },
          { path: "alertas", element: <AlertasPage /> },
          { path: "alertas/:id", element: <AlertaDetalhePage /> },
          { path: "garantias", element: <GarantiasPage /> },
          { path: "provedores", element: <ProvedoresPage /> },
          { path: "usuarios", element: <UsuariosPage /> },
          { path: "notificacoes", element: <NotificacoesPage /> },
          { path: "gestao-notificacoes", element: <GestaoNotificacoesPage /> },
          { path: "configuracoes", element: <ConfiguracoesPage /> },
          { path: "configuracao/regras", element: <RegrasPage /> },
          {
            element: <SuperadminRoute />,
            children: [
              { path: "empresas", element: <EmpresasPage /> },
              { path: "empresas/nova", element: <EmpresaNovaPage /> },
              { path: "empresas/:id", element: <EmpresaDetalhePage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
