/** Extrai mensagem amigável de erros DRF (400/403/5xx). */
export function extrairErroApi(err: unknown, fallback: string): string {
  const e = err as { response?: { status?: number; data?: unknown } };
  const status = e?.response?.status;
  if (status === 403) return "Sem permissão para esta ação.";
  if (status === 401) return "Sessão expirou — faça login novamente.";
  if (status && status >= 500) return "Erro no servidor. Tente novamente.";
  if (status === 400) {
    const data = e.response?.data;
    if (data && typeof data === "object") {
      const detail = (data as Record<string, unknown>).detail;
      if (typeof detail === "string") return detail;
      const partes = Object.entries(data as Record<string, unknown>).map(([k, v]) => {
        if (Array.isArray(v)) return `${k}: ${v.join(" ")}`;
        return `${k}: ${String(v)}`;
      });
      if (partes.length) return partes.join("\n");
    }
  }
  return fallback;
}
