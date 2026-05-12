/**
 * Cabeçalho clicável de coluna para ordenação em tabelas.
 *
 * Uso típico:
 *   const [ordering, setOrdering] = useState("")
 *   function handleSort(field: string) {
 *     setOrdering(atual => atual === field ? `-${field}` : atual === `-${field}` ? "" : field)
 *   }
 *   <SortHeader label="Usina" field="nome" ordering={ordering} onSort={handleSort} />
 *
 * `field` é o nome do campo conforme aceito pelo backend em `?ordering=`. O
 * componente cicla: vazio → asc (`field`) → desc (`-field`) → vazio. Voltar a
 * vazio devolve a ordenação default do endpoint.
 */
import type { CSSProperties } from "react";

export interface SortHeaderProps<F extends string = string> {
  label: string;
  field: F;
  ordering: string;
  onSort: (field: F) => void;
  /** Alinhamento do conteúdo. Útil em colunas numéricas. */
  align?: "start" | "end";
  className?: string;
  style?: CSSProperties;
}

export function SortHeader<F extends string = string>({
  label,
  field,
  ordering,
  onSort,
  align = "start",
  className,
  style,
}: SortHeaderProps<F>) {
  const ativo = ordering === field || ordering === `-${field}`;
  const desc = ordering === `-${field}`;
  return (
    <button
      type="button"
      className={["tl-sort-header", className].filter(Boolean).join(" ")}
      data-active={ativo}
      aria-sort={ativo ? (desc ? "descending" : "ascending") : "none"}
      onClick={() => onSort(field)}
      style={{ justifyContent: align === "end" ? "flex-end" : "flex-start", ...style }}
    >
      <span>{label}</span>
      <IconSort dir={ativo ? (desc ? "desc" : "asc") : "none"} />
    </button>
  );
}

function IconSort({ dir }: { dir: "asc" | "desc" | "none" }) {
  const props = {
    width: 12,
    height: 12,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (dir === "asc") {
    return (
      <svg {...props}>
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    );
  }
  if (dir === "desc") {
    return (
      <svg {...props}>
        <path d="M12 5v14M5 12l7 7 7-7" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="M7 3v18M3 7l4-4 4 4M17 21V3M13 17l4 4 4-4" />
    </svg>
  );
}

/**
 * Helper compartilhado para o ciclo padrão de ordenação por clique:
 * vazio → asc → desc → vazio (volta ao default do backend).
 *
 *   setOrdering(prev => cycleOrdering(prev, "nome"))
 */
export function cycleOrdering(atual: string, field: string): string {
  if (atual === field) return `-${field}`;
  if (atual === `-${field}`) return "";
  return field;
}
