import type { ReactNode } from "react";

export function DocsPlaceholder({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children?: ReactNode;
}) {
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 border-b pb-4">
        <h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1>
        {descricao && <p className="text-muted-foreground">{descricao}</p>}
      </header>
      {children ?? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Em construção — esta seção da documentação ainda está sendo escrita.
        </div>
      )}
    </article>
  );
}
