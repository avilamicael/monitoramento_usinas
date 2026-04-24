import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  AlertTriangle,
  ShieldCheck,
  Plug,
  Users,
  Bell,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/useAuth";

const NAV = [
  { to: "/", label: "Monitoramento", icon: LayoutDashboard, end: true },
  { to: "/alertas", label: "Alertas", icon: AlertTriangle },
  { to: "/garantia", label: "Garantia", icon: ShieldCheck },
  { to: "/provedores", label: "Provedores", icon: Plug },
  { to: "/usuarios", label: "Usuários", icon: Users, adminOnly: true },
  { to: "/notificacoes", label: "Notificações", icon: Bell },
  { to: "/configuracoes", label: "Configurações", icon: SettingsIcon, adminOnly: true },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const items = NAV.filter((n) => !n.adminOnly || user?.papel === "administrador");

  return (
    <div className="flex h-full">
      <aside className="w-64 shrink-0 bg-[var(--color-sidebar)] text-[var(--color-sidebar-foreground)] flex flex-col">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="text-lg font-semibold">Monitoramento Solar</div>
          {user?.empresa && <div className="text-xs opacity-70 mt-1">{user.empresa.nome}</div>}
        </div>
        <nav className="flex-1 py-4">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-6 py-2.5 text-sm hover:bg-white/5 transition-colors",
                  isActive && "bg-white/10 border-l-2 border-[var(--color-primary)]",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-6 py-3 text-sm border-t border-white/10 hover:bg-white/5"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
