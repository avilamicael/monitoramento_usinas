/**
 * Formatadores padronizados pt-BR para todo o frontend.
 * Máximo 3 casas decimais, separador de milhar com ponto.
 *
 * Espelho de `firmasolar/frontend/admin/src/lib/format.ts` + helpers extras
 * usados pelas páginas portadas.
 */

export function formatarNumero(valor: number, casas = 3): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas,
  });
}

export function formatarEnergia(kwh: number): string {
  if (kwh >= 1_000_000) {
    return `${formatarNumero(kwh / 1_000_000)} GWh`;
  }
  if (kwh >= 1_000) {
    return `${formatarNumero(kwh / 1_000)} MWh`;
  }
  return `${formatarNumero(kwh)} kWh`;
}

export function formatarPotencia(kw: number): string {
  if (kw >= 1_000) {
    return `${formatarNumero(kw / 1_000)} MW`;
  }
  return `${formatarNumero(kw)} kW`;
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatarDias(dias: number): string {
  return `${formatarNumero(dias, 0)} dia${dias !== 1 ? "s" : ""}`;
}

// ── Helpers extras (compat com código já portado) ───────────────────────

const dataHoraFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
const dataFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function fmtNum(valor: number | string | null | undefined, casas = 2): string {
  if (valor == null || valor === "") return "—";
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (!Number.isFinite(n)) return "—";
  return formatarNumero(n, casas);
}

export function fmtKwh(valor: number | string | null | undefined): string {
  if (valor == null || valor === "") return "—";
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (!Number.isFinite(n)) return "—";
  return formatarEnergia(n);
}

export function fmtKw(valor: number | string | null | undefined): string {
  if (valor == null || valor === "") return "—";
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (!Number.isFinite(n)) return "—";
  return formatarPotencia(n);
}

export function fmtKwp(valor: number | string | null | undefined): string {
  return `${fmtNum(valor)} kWp`;
}

export function fmtPct(valor: number | string | null | undefined): string {
  return `${fmtNum(valor)}%`;
}

export function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dataHoraFmt.format(new Date(iso));
}

export function fmtData(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dataFmt.format(new Date(iso));
}

export function fmtDuracaoMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function fmtRelativo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  return fmtData(iso);
}

const ROTULOS_PROVEDOR: Record<string, string> = {
  solis: "Solis",
  hoymiles: "Hoymiles",
  fusionsolar: "FusionSolar",
  solarman: "Solarman",
  auxsol: "AuxSol",
  foxess: "FoxESS",
};
export function rotuloProvedor(tipo: string | null | undefined): string {
  if (!tipo) return "—";
  return ROTULOS_PROVEDOR[tipo] ?? tipo;
}
