import type { ReactNode } from "react";
import { InfoIcon, LightbulbIcon, TriangleAlertIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type CalloutTipo = "info" | "aviso" | "dica";

const CALLOUT_CONFIG: Record<
  CalloutTipo,
  { icone: typeof InfoIcon; classes: string; titulo: string }
> = {
  info: {
    icone: InfoIcon,
    classes: "border-blue-500/40 bg-blue-500/10 text-blue-900 dark:text-blue-200",
    titulo: "Para saber",
  },
  aviso: {
    icone: TriangleAlertIcon,
    classes: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
    titulo: "Atenção",
  },
  dica: {
    icone: LightbulbIcon,
    classes: "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
    titulo: "Dica",
  },
};

export function DocsHeader({
  titulo,
  descricao,
}: {
  titulo: string;
  descricao?: string;
}) {
  return (
    <header className="flex flex-col gap-2 border-b pb-4">
      <h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1>
      {descricao && <p className="text-muted-foreground">{descricao}</p>}
    </header>
  );
}

export function DocsSection({
  titulo,
  children,
  id,
}: {
  titulo: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="flex flex-col gap-3" id={id}>
      <h2 className="text-xl font-semibold tracking-tight">{titulo}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export function DocsParagraph({ children }: { children: ReactNode }) {
  return <p className="text-foreground/90">{children}</p>;
}

export function Callout({
  tipo = "info",
  titulo,
  children,
}: {
  tipo?: CalloutTipo;
  titulo?: string;
  children: ReactNode;
}) {
  const cfg = CALLOUT_CONFIG[tipo];
  const Icone = cfg.icone;
  return (
    <aside
      role="note"
      className={cn(
        "flex gap-3 rounded-lg border p-3 text-sm",
        cfg.classes,
      )}
    >
      <Icone className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-1">
        <span className="font-medium">{titulo ?? cfg.titulo}</span>
        <div className="text-foreground/85 [&>p]:leading-relaxed">{children}</div>
      </div>
    </aside>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
      {children}
    </kbd>
  );
}

export function DocsList({
  children,
  ordered = false,
}: {
  children: ReactNode;
  ordered?: boolean;
}) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag
      className={cn(
        "flex flex-col gap-2 pl-5 text-sm leading-relaxed",
        ordered ? "list-decimal" : "list-disc",
      )}
    >
      {children}
    </Tag>
  );
}

export function DocsArticle({ children }: { children: ReactNode }) {
  return <article className="flex flex-col gap-8 pb-12">{children}</article>;
}
