export function Placeholder({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">{title}</h1>
      {subtitle && <p className="text-sm text-[var(--color-muted-foreground)]">{subtitle}</p>}
      <div className="mt-6 rounded-lg border border-dashed border-[var(--color-border)] p-12 text-center text-sm text-[var(--color-muted-foreground)]">
        Em construção — implementar endpoints e componentes.
      </div>
    </div>
  );
}
