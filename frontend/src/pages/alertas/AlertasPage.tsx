import { useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { EstadoAlertaBadge, SeveridadeBadge } from "@/components/SeveridadeBadge";
import { useAlertas } from "@/features/alertas/api";
import { fmtDataHora, rotuloProvedor } from "@/lib/format";

const PROVEDORES = ["solis", "hoymiles", "fusionsolar", "solarman", "auxsol", "foxess"] as const;
const REGRAS = [
  "sem_geracao_horario_solar", "sem_comunicacao", "subdesempenho", "sobretensao_ac",
  "subtensao_ac", "frequencia_anomala", "temperatura_alta", "inversor_offline",
  "string_mppt_zerada", "dado_eletrico_ausente", "queda_rendimento", "garantia_vencendo",
] as const;

export default function AlertasPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<string>("aberto");
  const [severidade, setSeveridade] = useState<string>("");
  const [regra, setRegra] = useState<string>("");
  const [provedor, setProvedor] = useState<string>("");

  const { data, isLoading } = useAlertas({
    page,
    search: search || undefined,
    estado: estado || undefined,
    severidade: severidade || undefined,
    regra: regra || undefined,
    provedor: provedor || undefined,
  });

  const totalPaginas = data ? Math.ceil(data.count / 25) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Alertas"
        subtitulo={data ? `${data.count} alerta${data.count === 1 ? "" : "s"} ${estado || "no histórico"}` : "Carregando…"}
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por mensagem, usina, inversor…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
          </div>

          <div className="w-40">
            <Select value={estado || "todos"} onValueChange={(v) => { setEstado(v === "todos" ? "" : v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos estados</SelectItem>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="reconhecido">Reconhecido</SelectItem>
                <SelectItem value="resolvido">Resolvido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-40">
            <Select value={severidade || "todas"} onValueChange={(v) => { setSeveridade(v === "todas" ? "" : v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Severidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas severidades</SelectItem>
                <SelectItem value="critico">Crítico</SelectItem>
                <SelectItem value="aviso">Aviso</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-52">
            <Select value={regra || "todas"} onValueChange={(v) => { setRegra(v === "todas" ? "" : v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Regra" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas regras</SelectItem>
                {REGRAS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="w-44">
            <Select value={provedor || "todos"} onValueChange={(v) => { setProvedor(v === "todos" ? "" : v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Provedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos provedores</SelectItem>
                {PROVEDORES.map((p) => <SelectItem key={p} value={p}>{rotuloProvedor(p)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aberto em</TableHead>
              <TableHead>Severidade</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Usina / Inversor</TableHead>
              <TableHead>Regra</TableHead>
              <TableHead>Mensagem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                  Nenhum alerta encontrado.
                </TableCell>
              </TableRow>
            ) : (
              data?.results.map((a) => (
                <TableRow key={a.id} className="cursor-pointer">
                  <TableCell className="text-sm whitespace-nowrap">
                    <Link to={`/alertas/${a.id}`} className="hover:underline">
                      {fmtDataHora(a.aberto_em)}
                    </Link>
                  </TableCell>
                  <TableCell><SeveridadeBadge severidade={a.severidade} /></TableCell>
                  <TableCell><EstadoAlertaBadge estado={a.estado} /></TableCell>
                  <TableCell>
                    <Link to={`/alertas/${a.id}`} className="hover:underline">
                      <div className="font-medium truncate max-w-[240px]">{a.usina_nome}</div>
                      {a.inversor_serie && (
                        <div className="text-xs text-muted-foreground font-mono truncate max-w-[240px]">{a.inversor_serie}</div>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{a.regra}</TableCell>
                  <TableCell>
                    <p className="text-sm truncate max-w-[420px]">{a.mensagem}</p>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {data && totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPaginas} · {data.count} resultados
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!data.previous} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={!data.next} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
