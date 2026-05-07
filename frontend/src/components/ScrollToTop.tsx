import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Reseta o scroll para o topo a cada mudança de rota.
 * Tenta cobrir scroll na window e em main rolável (caso o layout tenha
 * o scroll dentro de um container, como SidebarInset).
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.scrollingElement?.scrollTo(0, 0);
    const principal = document.querySelector("main");
    principal?.scrollTo?.(0, 0);
  }, [pathname]);

  return null;
}
