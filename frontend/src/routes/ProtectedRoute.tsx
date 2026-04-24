import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-sm opacity-70">Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
