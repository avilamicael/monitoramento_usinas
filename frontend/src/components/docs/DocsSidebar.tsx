import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ArrowLeftIcon, BookOpenIcon, MinusIcon, PlusIcon } from "lucide-react";

import { DocsSearch } from "@/components/docs/DocsSearch";
import { DOCS_SECOES, rotaDocs } from "@/components/docs/docs-data";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";

function rotaAtiva(pathname: string, slug: string): boolean {
  const alvo = rotaDocs(slug);
  if (alvo === "/docs") return pathname === "/docs" || pathname === "/docs/";
  return pathname === alvo;
}

function secaoAtiva(pathname: string, secao: typeof DOCS_SECOES[number]): boolean {
  return secao.topicos.some((t) => rotaAtiva(pathname, t.slug));
}

export function DocsSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation();

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/docs">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <BookOpenIcon className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">Documentação</span>
                  <span className="text-xs text-muted-foreground">Monitoramento Solar</span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/" className="text-muted-foreground">
                <ArrowLeftIcon />
                <span>Voltar para o app</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2 pb-2">
          <DocsSearch />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {DOCS_SECOES.map((secao) => (
              <Collapsible
                key={secao.titulo}
                defaultOpen={secaoAtiva(pathname, secao)}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      {secao.titulo}
                      <PlusIcon className="ml-auto group-data-[state=open]/collapsible:hidden" />
                      <MinusIcon className="ml-auto group-data-[state=closed]/collapsible:hidden" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {secao.topicos.length ? (
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {secao.topicos.map((topico) => (
                          <SidebarMenuSubItem key={topico.slug || "raiz"}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={rotaAtiva(pathname, topico.slug)}
                            >
                              <NavLink to={rotaDocs(topico.slug)} end>
                                {topico.titulo}
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  ) : null}
                </SidebarMenuItem>
              </Collapsible>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
