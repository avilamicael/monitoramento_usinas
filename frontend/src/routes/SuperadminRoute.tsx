import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/features/auth/useAuth";

/**
 * Protege rotas exclusivas de superadmin (ex: /empresas/*).
 *
 * Aguarda o `useAuth` carregar antes de decidir — evita redirect prematuro
 * para "/" quando o usuário superadmin acabou de fazer login. Não-superadmin
 * é redirecionado para "/" (não "/login", já que está autenticado).
 */
export default function SuperadminRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-sm opacity-70">Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.papel !== "superadmin") return <Navigate to="/" replace />;
  return <Outlet />;
}
