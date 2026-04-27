import * as React from "react";
import { ActivityIcon, SettingsIcon, ZapIcon } from "lucide-react";

import { NavMain, type NavGroup } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { useAuth } from "@/features/auth/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
    ],
  },
];

function filtrarPorPapel(groups: NavGroup[], papel: string | undefined): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.adminOnly || papel === "administrador"),
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
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user?.username ?? "—",
            email: user?.email ?? "",
            avatar: "",
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
