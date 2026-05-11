import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useResolverAlerta } from "@/features/alertas/api";
import { useAlertas } from "@/hooks/use-alertas";
import {
  CATEGORIA_LABELS,
  type AlertaResumo,
  type EstadoAlerta,
  type NivelAlerta,
} from "@/types/alertas";
import { PAGE_SIZE } from "@/lib/constants";
import { Select } from "@/components/trylab/Select";
import { rotularProvedor } from "@/lib/provedores";

const NIVEL_LABEL: Record<NivelAlerta, string> = {
  critico: "Crítico",
  aviso: "Aviso",
  info: "Info",
};
const ESTADO_LABEL: Record<EstadoAlerta, string> = {
  ativo: "Ativo",
  resolvido: "Resolvido",
};

const PROVEDORES_DISPONIVEIS = ["solis", "hoymiles", "fusionsolar", "auxsol", "solarman", "foxess"];
const CATEGORIAS_DISPONIVEIS = [
  "sobretensao_ac",
  "subtensao_ac",
  "frequencia_anomala",
  "temperatura_alta",
  "inversor_offline",
  "string_mppt_zerada",
  "dado_eletrico_ausente",
  "sem_comunicacao",
  "sem_geracao_horario_solar",
  "subdesempenho",
  "queda_rendimento",
  "garantia_vencendo",
] as const;

const SUFIXO_AGREGADO: Record<string, string> = {
  inversor_offline: "offline",
  temperatura_alta: "com temperatura alta",
  string_mppt_zerada: "com string MPPT zerada",
  sobretensao_ac: "com sobretensão AC",
  subtensao_ac: "com subtensão AC",
  frequencia_anomala: "com frequência anômala",
  dado_eletrico_ausente: "sem dado elétrico",
};

function mensagemListagem(alerta: AlertaResumo): string {
  if (!alerta.agregado || !alerta.qtd_inversores_afetados) return alerta.mensagem;
  const sufixo = SUFIXO_AGREGADO[alerta.categoria_efetiva];
  if (!sufixo) return alerta.mensagem;
  const qtd = alerta.qtd_inversores_afetados;
  const total = alerta.total_inversores_da_usina;
  if (total && total > 0) return `${qtd} de ${total} inversores ${sufixo}`;
  return qtd === 1 ? `1 inversor ${sufixo}` : `${qtd} inversores ${sufixo}`;
}

function formatData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AlertasPage() {
  const [estado, setEstado] = useState<EstadoAlerta | "todos">("ativo");
  const [nivel, setNivel] = useState<NivelAlerta | "todos">("todos");
  const [provedor, setProvedor] = useState<string>("todos");
  const [categoria, setCategoria] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Debounce da busca
  useEffect(() => {
    const id = setTimeout(() => {
      setBuscaDebounced(busca);
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [busca]);

  const { data, loading, error, refetch } = useAlertas({
    estado: estado === "todos" ? undefined : estado,
    nivel: nivel === "todos" ? undefined : nivel,
    provedor: provedor === "todos" ? undefined : provedor,
    categoria: categoria === "todas" ? undefined : categoria,
    busca: buscaDebounced || undefined,
    page,
  });

  const resolverMutation = useResolverAlerta();

  const totalPaginas = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;
  const resultados = data?.results ?? [];
  const filtrosAtivos =
    estado !== "ativo" ||
    nivel !== "todos" ||
    provedor !== "todos" ||
    categoria !== "todas" ||
    !!buscaDebounced;

  function handleFilterChange<T extends string>(setter: (v: T) => void) {
    return (value: string) => {
      setter(value as T);
      setPage(1);
      setSelected(new Set());
    };
  }

  function limparFiltros() {
    setEstado("ativo");
    setNivel("todos");
    setProvedor("todos");
    setCategoria("todas");
    setBusca("");
    setBuscaDebounced("");
    setPage(1);
    setSelected(new Set());
  }

  function toggleAll() {
    if (selected.size === resultados.length) setSelected(new Set());
    else setSelected(new Set(resultados.map((a) => a.id)));
  }

  function toggleRow(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function resolverEmLote() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    let ok = 0;
    let falhou = 0;
    for (const id of ids) {
      try {
        await resolverMutation.mutateAsync(Number(id));
        ok++;
      } catch {
        falhou++;
      }
    }
    if (ok > 0) toast.success(`${ok} alerta${ok === 1 ? "" : "s"} marcado${ok === 1 ? "" : "s"} como resolvido${ok === 1 ? "" : "s"}`);
    if (falhou > 0) toast.error(`${falhou} alerta${falhou === 1 ? "" : "s"} não puderam ser resolvido${falhou === 1 ? "" : "s"}`);
    setSelected(new Set());
    void refetch();
  }

  const totalCount = data?.count ?? 0;

  return (
    <div className="tl-scr">
      <header className="tl-scr-head">
        <div>
          <div className="tl-crumb">
            Monitoramento <span>/</span> Alertas
          </div>
          <h1>Alertas</h1>
        </div>
        <div className="tl-head-actions">
          <button type="button" className="tl-btn" onClick={() => void refetch()} disabled={loading}>
            <IconRefresh /> Atualizar
          </button>
          <Link to="/notificacoes" className="tl-btn">
            <IconBell /> Notificações
          </Link>
        </div>
      </header>

      <section className="tl-alerts-table-card">
        <div className="tl-alerts-toolbar">
          <div className="tl-alerts-title">
            <h2>Listagem de Alertas</h2>
            <span className="tl-muted tl-small">
              {totalCount} registro{totalCount === 1 ? "" : "s"}
              {filtrosAtivos ? " com os filtros aplicados" : ""}
            </span>
          </div>
          <div className="tl-alerts-search">
            <IconSearch />
            <input
              placeholder="Buscar por usina, mensagem, equipamento ou #ID…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        <div className="tl-alerts-filters">
          <FilterField
            label="Estado"
            value={estado}
            onChange={handleFilterChange<EstadoAlerta | "todos">((v) => setEstado(v))}
            options={[
              ["ativo", "Ativo"],
              ["resolvido", "Resolvido"],
              ["todos", "Todos"],
            ]}
          />
          <FilterField
            label="Nível"
            value={nivel}
            onChange={handleFilterChange<NivelAlerta | "todos">((v) => setNivel(v))}
            options={[
              ["todos", "Todos"],
              ["critico", "Crítico"],
              ["aviso", "Aviso"],
              ["info", "Info"],
            ]}
          />
          <FilterField
            label="Provedor"
            value={provedor}
            onChange={handleFilterChange<string>(setProvedor)}
            options={[["todos", "Todos"], ...PROVEDORES_DISPONIVEIS.map<[string, string]>((p) => [p, rotularProvedor(p)])]}
          />
          <FilterField
            label="Categoria"
            value={categoria}
            onChange={handleFilterChange<string>(setCategoria)}
            options={[
              ["todas", "Todas"],
              ...CATEGORIAS_DISPONIVEIS.map<[string, string]>((c) => [c, CATEGORIA_LABELS[c] || c]),
            ]}
          />
          {filtrosAtivos && (
            <button type="button" className="tl-link-sm tl-clear-filters" onClick={limparFiltros}>
              <IconX /> Limpar
            </button>
          )}
        </div>

        <div className="tl-bulk-bar" data-active={selected.size > 0}>
          <span>
            <b>{selected.size}</b> selecionado{selected.size === 1 ? "" : "s"}
          </span>
          <div>
            <button
              type="button"
              className="tl-link-sm"
              onClick={() => void resolverEmLote()}
              disabled={resolverMutation.isPending}
            >
              <IconCheck /> Marcar resolvido
            </button>
          </div>
          <button type="button" className="tl-icon-btn" onClick={() => setSelected(new Set())} aria-label="Limpar seleção">
            ×
          </button>
        </div>

        <div className="tl-alerts-table" role="table">
          <div className="tl-at-head" role="row">
            <span className="tl-col-check">
              <input
                type="checkbox"
                checked={resultados.length > 0 && selected.size === resultados.length}
                onChange={toggleAll}
                aria-label="Selecionar todos"
              />
            </span>
            <span>Usina</span>
            <span>Mensagem</span>
            <span>Nível</span>
            <span>Estado</span>
            <span>Categoria</span>
            <span>Data</span>
            <span></span>
          </div>

          {error ? (
            <div className="tl-at-empty" role="status">
              <span style={{ color: "var(--tl-crit)" }}>{error}</span>
              <button type="button" className="tl-link-sm" onClick={() => void refetch()}>
                Tentar novamente
              </button>
            </div>
          ) : loading && resultados.length === 0 ? (
            <div className="tl-at-empty" role="status">
              <span>Carregando alertas…</span>
            </div>
          ) : resultados.length === 0 ? (
            <div className="tl-at-empty">
              <IconCheckBig />
              <b>Nenhum alerta encontrado</b>
              <span>Ajuste os filtros para ver mais resultados</span>
            </div>
          ) : (
            resultados.map((a) => (
              <div
                key={a.id}
                className={"tl-at-row" + (selected.has(a.id) ? " selected" : "")}
                role="row"
              >
                <span className="tl-col-check">
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={() => toggleRow(a.id)}
                    aria-label={`Selecionar ${a.usina_nome}`}
                  />
                </span>
                <span className="tl-cell-usina">
                  <Link
                    to={`/alertas/${a.id}`}
                    className="tl-row-btn"
                    style={{ width: "auto", height: "auto", padding: 0, color: "var(--tl-fg)" }}
                  >
                    <b>{a.usina_nome}</b>
                  </Link>
                  <em>
                    <span className={`tl-prov-tag prov-${a.usina_provedor || "outro"}`}>
                      {rotularProvedor(a.usina_provedor)}
                    </span>
                    {a.usina_id_provedor && (
                      <>
                        <span className="tl-sep">·</span>
                        <span className="tl-ne">#{a.usina_id_provedor}</span>
                      </>
                    )}
                  </em>
                </span>
                <span className="tl-cell-msg" title={a.mensagem}>
                  {mensagemListagem(a)}
                </span>
                <span>
                  <span className={`tl-level-pill tl-lp-${a.nivel}`}>{NIVEL_LABEL[a.nivel]}</span>
                </span>
                <span>{ESTADO_LABEL[a.estado]}</span>
                <span className="tl-cell-cat">
                  {CATEGORIA_LABELS[a.categoria_efetiva] || a.categoria_efetiva || "—"}
                </span>
                <span className="tl-cell-data">{formatData(a.inicio)}</span>
                <span className="tl-cell-actions">
                  <Link to={`/alertas/${a.id}`} className="tl-row-btn" title="Ver detalhes" aria-label="Ver detalhes">
                    <IconChevRight />
                  </Link>
                </span>
              </div>
            ))
          )}
        </div>

        <div className="tl-alerts-foot">
          <span className="tl-muted tl-small">
            {totalCount} resultado{totalCount === 1 ? "" : "s"}
          </span>
          <div className="tl-pager">
            <button
              type="button"
              className="tl-btn ghost"
              disabled={!data?.previous || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹ Anterior
            </button>
            <span className="tl-pager-page">
              Página {page} de {totalPaginas}
            </span>
            <button
              type="button"
              className="tl-btn ghost"
              disabled={!data?.next || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima ›
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────────

interface FilterFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}
function FilterField({ label, value, onChange, options }: FilterFieldProps) {
  return (
    <div className="tl-filter-field">
      <em>{label}:</em>
      <Select value={value} onChange={onChange} options={options} />
    </div>
  );
}

// ── Ícones inline (Inter-style strokes finos) ─────────────────────────────

const SVG_PROPS = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconSearch() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
function IconX() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function IconCheckBig() {
  return (
    <svg {...SVG_PROPS} width={28} height={28}>
      <circle cx="12" cy="12" r="9" opacity="0.4" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function IconChevRight() {
  return (
    <svg {...SVG_PROPS}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M21 12a9 9 0 0 0-15.5-6.4L3 8M3 4v4h4M3 12a9 9 0 0 0 15.5 6.4L21 16M21 20v-4h-4" />
    </svg>
  );
}
