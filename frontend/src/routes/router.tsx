import { createBrowserRouter, Navigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/routes/ProtectedRoute";
import LoginPage from "@/pages/auth/LoginPage";
import DashboardPage from "@/pages/monitoring/DashboardPage";
import AlertsPage from "@/pages/alerts/AlertsPage";
import WarrantyPage from "@/pages/warranty/WarrantyPage";
import ProvidersPage from "@/pages/providers/ProvidersPage";
import UsersPage from "@/pages/users/UsersPage";
import NotificationsPage from "@/pages/notifications/NotificationsPage";
import SettingsPage from "@/pages/settings/SettingsPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "alertas", element: <AlertsPage /> },
          { path: "garantia", element: <WarrantyPage /> },
          { path: "provedores", element: <ProvidersPage /> },
          { path: "usuarios", element: <UsersPage /> },
          { path: "notificacoes", element: <NotificationsPage /> },
          { path: "configuracoes", element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
