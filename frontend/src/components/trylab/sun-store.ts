/**
 * Store local do "sol no fundo" — modo (tempo/scroll/off) + intensidade.
 * Persistido em localStorage. Quando este controle for promovido para
 * configuração da empresa (`ConfiguracaoEmpresa`), substituir a hidratação
 * inicial por leitura do backend e manter o resto da API intacta.
 */
import { useEffect, useState, useSyncExternalStore } from "react";

export type SunMode = "tempo" | "scroll" | "off";

export interface SunGlowState {
  mode: SunMode;
  intensity: number; // 0..150
}

const STORAGE_KEY = "trylab.sun";
const DEFAULT_STATE: SunGlowState = { mode: "tempo", intensity: 100 };

const listeners = new Set<() => void>();
let cache: SunGlowState | null = null;

function readStorage(): SunGlowState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<SunGlowState>;
    const mode = parsed.mode === "scroll" || parsed.mode === "off" ? parsed.mode : "tempo";
    const intensity = typeof parsed.intensity === "number"
      ? Math.max(0, Math.min(150, parsed.intensity))
      : 100;
    return { mode, intensity };
  } catch {
    return DEFAULT_STATE;
  }
}

function getSnapshot(): SunGlowState {
  if (cache === null) cache = readStorage();
  return cache;
}

function getServerSnapshot(): SunGlowState {
  return DEFAULT_STATE;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify() {
  listeners.forEach((cb) => cb());
}

export function setSunGlow(next: Partial<SunGlowState>) {
  const current = getSnapshot();
  const merged: SunGlowState = {
    mode: next.mode ?? current.mode,
    intensity: next.intensity ?? current.intensity,
  };
  cache = merged;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // localStorage indisponível — segue só em memória
  }
  notify();
}

export function useSunGlow(): SunGlowState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Sidebar collapsed mantido na mesma store por simplicidade — outro slice.
 */
const SIDEBAR_KEY = "trylab.sidebar.collapsed";

export function useSidebarCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(SIDEBAR_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, collapsed ? "true" : "false");
    } catch {
      // ignore
    }
  }, [collapsed]);

  return [collapsed, setCollapsed];
}

// ─── Theme (light/dark) ─────────────────────────────────────────────────
//
// Persistido em localStorage. Default = dark. Aplicado no <html> via
// `data-tl-theme="light|dark"` por `useApplyTheme()` no AppLayout.

export type Theme = "light" | "dark";
const THEME_KEY = "trylab.theme";
const DEFAULT_THEME: Theme = "dark";

const themeListeners = new Set<() => void>();
let themeCache: Theme | null = null;

function readTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    return raw === "light" ? "light" : "dark";
  } catch {
    return DEFAULT_THEME;
  }
}

function getThemeSnapshot(): Theme {
  if (themeCache === null) themeCache = readTheme();
  return themeCache;
}

function getThemeServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

function subscribeTheme(cb: () => void): () => void {
  themeListeners.add(cb);
  return () => themeListeners.delete(cb);
}

export function setTheme(next: Theme): void {
  themeCache = next;
  try {
    window.localStorage.setItem(THEME_KEY, next);
  } catch {
    // ignore
  }
  themeListeners.forEach((cb) => cb());
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
}

/**
 * Hook que aplica `data-tl-theme` no <html>. Chamar uma vez no AppLayout.
 */
export function useApplyTheme(): void {
  const theme = useTheme();
  useEffect(() => {
    document.documentElement.dataset.tlTheme = theme;
  }, [theme]);
}
