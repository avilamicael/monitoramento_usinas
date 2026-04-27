import { Badge } from "@/components/ui/badge";
import type { Severidade, EstadoAlerta } from "@/lib/types";

const SEVERIDADE_CLASSES: Record<Severidade, string> = {
  critico: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  aviso: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
};

const SEVERIDADE_LABEL: Record<Severidade, string> = {
  critico: "Crítico",
  aviso: "Aviso",
  info: "Info",
};

export function SeveridadeBadge({ severidade }: { severidade: Severidade }) {
  return (
    <Badge variant="outline" className={SEVERIDADE_CLASSES[severidade]}>
      {SEVERIDADE_LABEL[severidade]}
    </Badge>
  );
}

const ESTADO_CLASSES: Record<EstadoAlerta, string> = {
  aberto: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  reconhecido: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  resolvido: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

const ESTADO_LABEL: Record<EstadoAlerta, string> = {
  aberto: "Aberto",
  reconhecido: "Reconhecido",
  resolvido: "Resolvido",
};

export function EstadoAlertaBadge({ estado }: { estado: EstadoAlerta }) {
  return (
    <Badge variant="outline" className={ESTADO_CLASSES[estado]}>
      {ESTADO_LABEL[estado]}
    </Badge>
  );
}
