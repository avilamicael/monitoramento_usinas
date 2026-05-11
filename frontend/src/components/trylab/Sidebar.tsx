import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { useSidebarCollapsed } from "@/components/trylab/sun-store";
import { UserMenu } from "@/components/trylab/UserMenu";
import { useAlertasContagemPorEstado } from "@/hooks/use-alertas-stats";

type IconName =
  | "grid"
  | "sun"
  | "bolt"
  | "bell"
  | "shield"
  | "plug"
  | "user"
  | "cog"
  | "rules"
  | "doc"
  | "building"
  | "send"
  | "sidebar"
  | "monitor"
  | "tools"
  | "platform"
  | "chev";

interface NavItem {
  to: string;
  label: string;
  badge?: number;
}

interface NavGroup {
  id: string;
  label: string;
  icon: IconName;
  items: NavItem[];
  /** Quando true, expande por padrão na primeira sessão. */
  defaultOpen?: boolean;
  adminOnly?: boolean;
  superadminOnly?: boolean;
}

interface NavStructure {
  /** Itens flat no topo, sem agrupamento. */
  top: Array<NavItem & { icon: IconName }>;
  /** Grupos colapsáveis. */
  groups: NavGroup[];
  /** Itens flat no rodapé (acima do user-chip). */
  bottom: Array<NavItem & { icon: IconName }>;
}

function buildStructure(papel: string | undefined, alertasAtivos: number): NavStructure {
  const isSuperadmin = papel === "superadmin";
  const isAdmin = papel === "administrador" || isSuperadmin;

  const groups: NavGroup[] = [
    {
      id: "operacional",
      label: "Operacional",
      icon: "monitor",
      defaultOpen: true,
      items: [
        { to: "/usinas", label: "Usinas" },
        { to: "/garantias", label: "Garantias" },
        { to: "/provedores", label: "Provedores" },
        { to: "/notificacoes", label: "Notificações" },
      ],
    },
  ];

  if (isAdmin) {
    groups.push({
      id: "administracao",
      label: "Administração",
      icon: "tools",
      items: [
        { to: "/usuarios", label: "Usuários" },
        { to: "/configuracoes", label: "Configurações" },
        { to: "/configuracao/regras", label: "Regras de alertas" },
      ],
    });
  }

  if (isSuperadmin) {
    groups.push({
      id: "plataforma",
      label: "Plataforma",
      icon: "platform",
      items: [{ to: "/empresas", label: "Empresas" }],
    });
  }

  return {
    top: [
      { to: "/", label: "Dashboard", icon: "grid" },
      { to: "/alertas", label: "Alertas", icon: "bell", badge: alertasAtivos },
    ],
    groups,
    bottom: [{ to: "/docs", label: "Documentação", icon: "doc" }],
  };
}

const GROUPS_KEY = "trylab.sidebar.groups";

function readOpenGroups(defaults: Record<string, boolean>): Record<string, boolean> {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(GROUPS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function nomeCompleto(u: { username?: string; email?: string } | null | undefined): string {
  if (!u) return "—";
  if (u.username) return u.username.charAt(0).toUpperCase() + u.username.slice(1);
  return u.email ?? "—";
}

function iniciais(nome: string): string {
  return (
    nome
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function papelLabel(papel: string | undefined): string {
  if (!papel) return "";
  if (papel === "administrador") return "Admin";
  if (papel === "superadmin") return "Superadmin";
  if (papel === "operacional") return "Operacional";
  return papel;
}

export function Sidebar() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const { ativos } = useAlertasContagemPorEstado();
  const structure = buildStructure(user?.papel, ativos);

  const defaults: Record<string, boolean> = {};
  for (const g of structure.groups) defaults[g.id] = g.defaultOpen ?? false;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    readOpenGroups(defaults),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(GROUPS_KEY, JSON.stringify(openGroups));
    } catch {
      // ignore
    }
  }, [openGroups]);

  // Atalho ctrl/cmd+B colapsa
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed(!collapsed);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed, setCollapsed]);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <nav className="tl-side" data-collapsed={collapsed}>
      <div className="tl-logo">
        <div className="tl-logo-mark">
          <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
            <defs>
              <linearGradient id="tl-logo-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--tl-accent)" />
                <stop offset="100%" stopColor="var(--tl-accent-2)" />
              </linearGradient>
            </defs>
            <circle cx="16" cy="16" r="6" fill="url(#tl-logo-grad)" />
            <g stroke="url(#tl-logo-grad)" strokeWidth="2" strokeLinecap="round">
              <path d="M16 3v4" />
              <path d="M16 25v4" />
              <path d="M3 16h4" />
              <path d="M25 16h4" />
              <path d="m6.6 6.6 2.8 2.8" />
              <path d="m22.6 22.6 2.8 2.8" />
              <path d="m25.4 6.6-2.8 2.8" />
              <path d="m9.4 22.6-2.8 2.8" />
            </g>
          </svg>
        </div>
        <div className="tl-logo-word">
          <b>{user?.empresa?.nome ?? "Monitoramento"}</b>
        </div>
        <button
          type="button"
          className="tl-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expandir (Ctrl+B)" : "Recolher (Ctrl+B)"}
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          <SideIcon name="sidebar" />
        </button>
      </div>

      <div className="tl-side-nav">
        {/* Top items */}
        <div className="tl-side-section">
          {structure.top.map((it) => (
            <SidebarLink key={it.to} item={it} />
          ))}
        </div>

        {/* Grupos colapsáveis */}
        {structure.groups.map((g) => {
          const open = openGroups[g.id] ?? !!g.defaultOpen;
          return (
            <div className="tl-side-section" key={g.id}>
              {!collapsed && <div className="tl-side-group-label">{g.label}</div>}
              <button
                type="button"
                className="tl-side-group-header"
                data-open={open}
                onClick={() => toggleGroup(g.id)}
                aria-expanded={open}
                aria-controls={`tl-grp-${g.id}`}
                title={collapsed ? g.label : undefined}
              >
                <SideIcon name={g.icon} />
                <span className="tl-side-label">{g.label}</span>
                <span className="tl-side-group-chev" aria-hidden="true">
                  <ChevDown />
                </span>
              </button>
              {open && !collapsed && (
                <div className="tl-side-group-children" id={`tl-grp-${g.id}`}>
                  {g.items.map((it) => (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      end={it.to === "/"}
                      className={({ isActive }) => "tl-side-sub-item" + (isActive ? " active" : "")}
                    >
                      {it.label}
                      {it.badge != null && it.badge > 0 && (
                        <span className="tl-side-badge">{it.badge > 99 ? "99+" : it.badge}</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Bottom flat items */}
        <div className="tl-side-section" style={{ marginTop: "auto" }}>
          {structure.bottom.map((it) => (
            <SidebarLink key={it.to} item={it} />
          ))}
        </div>
      </div>

      <div className="tl-side-foot">
        <UserMenu
          trigger={
            <button type="button" className="tl-user-chip" title={nomeCompleto(user)}>
              <div className="tl-ava">{iniciais(nomeCompleto(user))}</div>
              <div className="tl-user-chip-info">
                <b>{nomeCompleto(user)}</b>
                <em>
                  {[user?.empresa?.nome, user?.papel ? papelLabel(user.papel) : null]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </em>
              </div>
            </button>
          }
        />
      </div>
    </nav>
  );
}

interface SidebarLinkProps {
  item: NavItem & { icon: IconName };
}
function SidebarLink({ item }: SidebarLinkProps) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) => "tl-side-item" + (isActive ? " active" : "")}
      title={item.label}
    >
      <SideIcon name={item.icon} />
      <span className="tl-side-label">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="tl-side-badge">{item.badge > 99 ? "99+" : item.badge}</span>
      )}
    </NavLink>
  );
}

function ChevDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SideIcon({ name }: { name: IconName }) {
  const p = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "grid":
      return (
        <svg {...p}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "sun":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...p}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      );
    case "bell":
      return (
        <svg {...p}>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0" />
        </svg>
      );
    case "shield":
      return (
        <svg {...p}>
          <path d="M12 3 4 6v6c0 4 3 7 8 9 5-2 8-5 8-9V6l-8-3z" />
        </svg>
      );
    case "plug":
      return (
        <svg {...p}>
          <path d="M9 2v4M15 2v4M5 8h14v4a4 4 0 0 1-4 4h-1v6h-4v-6H9a4 4 0 0 1-4-4V8z" />
        </svg>
      );
    case "user":
      return (
        <svg {...p}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
        </svg>
      );
    case "cog":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7 7 0 0 0-.1-1.2l2.1-1.6-2-3.5-2.5 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2l-2.5-1-2 3.5 2.1 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2.1 1.6 2 3.5 2.5-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.5a7 7 0 0 0 2-1.2l2.5 1 2-3.5-2.1-1.6c.1-.4.1-.8.1-1.2z" />
        </svg>
      );
    case "rules":
      return (
        <svg {...p}>
          <path d="M9 4h11M9 12h11M9 20h11" />
          <circle cx="4" cy="4" r="1.5" />
          <circle cx="4" cy="12" r="1.5" />
          <circle cx="4" cy="20" r="1.5" />
        </svg>
      );
    case "doc":
      return (
        <svg {...p}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M9 13h6M9 17h4" />
        </svg>
      );
    case "building":
      return (
        <svg {...p}>
          <rect x="4" y="4" width="16" height="16" rx="1.5" />
          <path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01" />
        </svg>
      );
    case "send":
      return (
        <svg {...p}>
          <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
        </svg>
      );
    case "sidebar":
      return (
        <svg {...p}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18" />
        </svg>
      );
    case "monitor":
      return (
        <svg {...p}>
          <rect x="2" y="4" width="20" height="14" rx="2" />
          <path d="M2 14h20M8 22h8M12 18v4" />
        </svg>
      );
    case "tools":
      return (
        <svg {...p}>
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6z" />
        </svg>
      );
    case "platform":
      return (
        <svg {...p}>
          <path d="M3 7h18M3 12h18M3 17h18M7 3v18M12 3v18M17 3v18" />
        </svg>
      );
    case "chev":
      return (
        <svg {...p}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    default:
      return null;
  }
}
