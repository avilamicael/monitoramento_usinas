// Helpers de formatação. Sempre PT-BR.

const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const inteiro = new Intl.NumberFormat("pt-BR");
const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function fmtNum(valor: number | string | null | undefined, casas = 2): string {
  if (valor == null || valor === "") return "—";
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (!Number.isFinite(n)) return "—";
  return casas === 0 ? inteiro.format(n) : new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas,
  }).format(n);
}

export function fmtKwh(valor: number | string | null | undefined): string {
  return `${fmtNum(valor)} kWh`;
}

export function fmtKw(valor: number | string | null | undefined): string {
  return `${fmtNum(valor)} kW`;
}

export function fmtKwp(valor: number | string | null | undefined): string {
  return `${fmtNum(valor)} kWp`;
}

export function fmtPct(valor: number | string | null | undefined): string {
  return `${fmtNum(valor)}%`;
}

export function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dataHora.format(new Date(iso));
}

export function fmtData(iso: string | null | undefined): string {
  if (!iso) return "—";
  return data.format(new Date(iso));
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
