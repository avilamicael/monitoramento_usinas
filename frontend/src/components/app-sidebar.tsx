import * as React from "react";
import { NavLink } from "react-router-dom";
import { ActivityIcon, BookOpenIcon, Building2, SettingsIcon, ZapIcon } from "lucide-react";

import { NavMain, type NavGroup } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { useAuth } from "@/features/auth/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Monitoramento",
    icon: ActivityIcon,
    items: [
      { title: "Dashboard", url: "/" },
      { title: "Usinas", url: "/usinas" },
      { title: "Alertas", url: "/alertas" },
    ],
  },
  {
    label: "Gestão",
    icon: SettingsIcon,
    items: [
      { title: "Garantias", url: "/garantias" },
      { title: "Provedores", url: "/provedores" },
      { title: "Notificações", url: "/notificacoes" },
      { title: "Usuários", url: "/usuarios", adminOnly: true },
      { title: "Configurações", url: "/configuracoes", adminOnly: true },
      { title: "Regras de alertas", url: "/configuracao/regras", adminOnly: true },
    ],
  },
  {
    label: "Superadmin",
    icon: Building2,
    superadminOnly: true,
    items: [{ title: "Empresas", url: "/empresas", superadminOnly: true }],
  },
];

function capitalizar(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function nomeExibicao(u: { first_name?: string; last_name?: string; username?: string } | null | undefined): string {
  if (!u) return "—";
  const cheio = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  if (cheio) return cheio;
  return u.username ? capitalizar(u.username) : "—";
}

function filtrarPorPapel(groups: NavGroup[], papel: string | undefined): NavGroup[] {
  const isSuperadmin = papel === "superadmin";
  const isAdmin = papel === "administrador" || isSuperadmin;
  return groups
    .filter((g) => !g.superadminOnly || isSuperadmin)
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => {
        if (i.superadminOnly && !isSuperadmin) return false;
        if (i.adminOnly && !isAdmin) return false;
        return true;
      }),
    }))
    .filter((g) => g.items.length > 0);
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  const groups = filtrarPorPapel(NAV_GROUPS, user?.papel);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <ZapIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Monitoramento Solar</span>
                <span className="truncate text-xs">{user?.empresa?.nome ?? "—"}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={groups} />
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Documentação">
                <NavLink to="/docs">
                  <BookOpenIcon />
                  <span>Documentação</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: nomeExibicao(user),
            email: user?.email ?? "",
            avatar: "",
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
