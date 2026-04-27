import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Sun } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { useUsinas } from "@/features/usinas/api";
import { fmtKwp, fmtRelativo, rotuloProvedor } from "@/lib/format";

const PROVEDORES = ["solis", "hoymiles", "fusionsolar", "solarman", "auxsol", "foxess"] as const;

export default function UsinasPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [provedor, setProvedor] = useState<string>("");
  const [statusGarantia, setStatusGarantia] = useState<string>("");

  const { data, isLoading } = useUsinas({
    page,
    search: search || undefined,
    provedor: provedor || undefined,
    status_garantia: statusGarantia || undefined,
  });

  const totalPaginas = data ? Math.ceil(data.count / 25) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Usinas"
        subtitulo={data ? `${data.count} usina${data.count === 1 ? "" : "s"} cadastrada${data.count === 1 ? "" : "s"}` : "Carregando…"}
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, cidade, ID externo…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
          </div>

          <div className="w-44">
            <Select value={provedor || "todos"} onValueChange={(v) => { setProvedor(v === "todos" ? "" : v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Provedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos provedores</SelectItem>
                {PROVEDORES.map((p) => (
                  <SelectItem key={p} value={p}>{rotuloProvedor(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-44">
            <Select value={statusGarantia || "todas"} onValueChange={(v) => { setStatusGarantia(v === "todas" ? "" : v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Garantia" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas garantias</SelectItem>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="vencida">Vencida</SelectItem>
                <SelectItem value="sem_garantia">Sem garantia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Provedor</TableHead>
              <TableHead className="text-right">Capacidade</TableHead>
              <TableHead>Garantia</TableHead>
              <TableHead className="text-right">Inversores</TableHead>
              <TableHead className="text-right">Alertas</TableHead>
              <TableHead>Última leitura</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-sm text-muted-foreground">
                  Nenhuma usina encontrada com esses filtros.
                </TableCell>
              </TableRow>
            ) : (
              data?.results.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link to={`/usinas/${u.id}`} className="flex items-center gap-2 font-medium hover:underline">
                      <Sun className="h-4 w-4 text-amber-500 shrink-0" />
                      <span className="truncate">{u.nome}</span>
                    </Link>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {[u.cidade, u.estado].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </TableCell>
                  <TableCell>{rotuloProvedor(u.provedor_tipo)}</TableCell>
                  <TableCell className="text-right">{fmtKwp(u.capacidade_kwp)}</TableCell>
                  <TableCell>
                    {u.status_garantia === "ativa" && <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Ativa</Badge>}
                    {u.status_garantia === "vencida" && <Badge variant="outline" className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30">Vencida</Badge>}
                    {u.status_garantia === "sem_garantia" && <Badge variant="outline">Sem</Badge>}
                  </TableCell>
                  <TableCell className="text-right">{u.qtd_inversores}</TableCell>
                  <TableCell className="text-right">
                    {u.qtd_alertas_abertos > 0 ? (
                      <Badge variant="outline" className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30">
                        {u.qtd_alertas_abertos}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtRelativo(u.ultima_leitura_em)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {data && totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPaginas}
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
