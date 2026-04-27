import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Sun,
  AlertTriangle,
  ShieldCheck,
  Plug,
  Users,
  Bell,
  Settings as SettingsIcon,
  LogOut,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/useAuth";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  adminOnly?: boolean;
}

const GRUPO_MONITORAMENTO: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/usinas", label: "Usinas", icon: Sun },
  { to: "/alertas", label: "Alertas", icon: AlertTriangle },
];

const GRUPO_GESTAO: NavItem[] = [
  { to: "/garantias", label: "Garantias", icon: ShieldCheck },
  { to: "/provedores", label: "Provedores", icon: Plug },
  { to: "/notificacoes", label: "Notificações", icon: Bell },
  { to: "/usuarios", label: "Usuários", icon: Users, adminOnly: true },
  { to: "/configuracoes", label: "Configurações", icon: SettingsIcon, adminOnly: true },
];

function filtrarPorPapel(items: NavItem[], papel: string | undefined) {
  return items.filter((n) => !n.adminOnly || papel === "administrador");
}

function NavGrupo({ titulo, icone: GroupIcon, items }: { titulo: string; icone: LucideIcon; items: NavItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="px-2 mt-4 first:mt-2">
      <div className="flex items-center gap-2 px-3 mb-1.5 text-[11px] uppercase tracking-wider opacity-60">
        <GroupIcon className="h-3 w-3" />
        {titulo}
      </div>
      <div className="space-y-0.5">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-white/5 transition-colors",
                isActive && "bg-white/10 text-white",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const monit = filtrarPorPapel(GRUPO_MONITORAMENTO, user?.papel);
  const gest = filtrarPorPapel(GRUPO_GESTAO, user?.papel);

  return (
    <div className="flex h-full">
      <aside className="w-64 shrink-0 bg-[var(--color-sidebar)] text-[var(--color-sidebar-foreground)] flex flex-col">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-amber-300" />
            <div className="text-base font-semibold">Monitoramento Solar</div>
          </div>
          {user?.empresa && (
            <div className="text-xs opacity-70 mt-1 truncate">{user.empresa.nome}</div>
          )}
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          <NavGrupo titulo="Monitoramento" icone={Activity} items={monit} />
          <NavGrupo titulo="Gestão" icone={SettingsIcon} items={gest} />
        </nav>

        <div className="border-t border-white/10 px-3 py-3">
          {user && (
            <div className="px-3 py-1.5 text-xs">
              <div className="font-medium truncate">{user.username}</div>
              <div className="opacity-60 truncate">{user.email}</div>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2 mt-1 rounded-md text-sm hover:bg-white/5 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>

      <Toaster richColors position="top-right" />
    </div>
  );
}
