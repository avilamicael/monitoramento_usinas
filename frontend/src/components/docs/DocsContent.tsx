import type { ReactNode } from "react";
import { Link } from "react-router-dom";
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
      {descricao && (
        <p className="text-base text-muted-foreground">{descricao}</p>
      )}
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
    <section className="flex flex-col gap-4" id={id}>
      <h2 className="text-2xl font-semibold tracking-tight">{titulo}</h2>
      <div className="flex flex-col gap-4 text-base leading-7">{children}</div>
    </section>
  );
}

export function DocsSubsection({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold tracking-tight">{titulo}</h3>
      {children}
    </div>
  );
}

export function DocsParagraph({ children }: { children: ReactNode }) {
  return <p className="text-foreground/90">{children}</p>;
}

export function AppLink({
  to,
  children,
  externo = false,
}: {
  to: string;
  children: ReactNode;
  externo?: boolean;
}) {
  const className =
    "font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary";
  if (externo) {
    return (
      <a
        href={to}
        target="_blank"
        rel="noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
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
        "flex gap-3 rounded-lg border p-4 text-base",
        cfg.classes,
      )}
    >
      <Icone className="mt-1 size-5 shrink-0" />
      <div className="flex flex-col gap-1">
        <span className="font-semibold">{titulo ?? cfg.titulo}</span>
        <div className="text-foreground/85 [&>p]:leading-7">{children}</div>
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
        "flex flex-col gap-2 pl-5 text-base leading-7",
        ordered ? "list-decimal" : "list-disc",
      )}
    >
      {children}
    </Tag>
  );
}

export function DocsArticle({ children }: { children: ReactNode }) {
  return <article className="flex flex-col gap-10 pb-12">{children}</article>;
}
