import { useAuth } from "./useAuth";

/**
 * Hook utilitário: indica se o usuário autenticado tem papel `superadmin`.
 *
 * Usado para esconder/mostrar o menu Empresas e proteger rotas
 * `/empresas/*` no router. Para verificação real de permissão use o
 * backend (`/api/superadmin/*` é gated por `EhSuperadmin`).
 */
export function useIsSuperadmin(): boolean {
  const { user } = useAuth();
  return user?.papel === "superadmin";
}
