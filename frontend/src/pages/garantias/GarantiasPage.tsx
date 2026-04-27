import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { useGarantias } from "@/features/garantias/api";
import { fmtData, rotuloProvedor } from "@/lib/format";

const PROVEDORES = ["solis", "hoymiles", "fusionsolar", "solarman", "auxsol", "foxess"] as const;

export default function GarantiasPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [provedor, setProvedor] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const { data, isLoading } = useGarantias({
    page,
    search: search || undefined,
    provedor: provedor || undefined,
    status: status || undefined,
  });

  const totalPaginas = data ? Math.ceil(data.count / 25) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Garantias"
        subtitulo={data ? `${data.count} usina${data.count === 1 ? "" : "s"}` : "Carregando…"}
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por usina ou fornecedor…"
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
                {PROVEDORES.map((p) => <SelectItem key={p} value={p}>{rotuloProvedor(p)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Select value={status || "todas"} onValueChange={(v) => { setStatus(v === "todas" ? "" : v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="vencida">Vencida</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usina</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Início</TableHead>
              <TableHead className="text-right">Meses</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Dias restantes</TableHead>
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
                  Nenhuma garantia encontrada.
                </TableCell>
              </TableRow>
            ) : (
              data?.results.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.usina_nome}</TableCell>
                  <TableCell>{g.fornecedor || "—"}</TableCell>
                  <TableCell>{fmtData(g.inicio_em)}</TableCell>
                  <TableCell className="text-right">{g.meses}</TableCell>
                  <TableCell>{fmtData(g.fim_em)}</TableCell>
                  <TableCell>
                    {g.is_active ? (
                      <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Ativa</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30">Vencida</Badge>
                    )}
                  </TableCell>
                  <TableCell className={`text-right text-sm ${g.dias_restantes < 30 ? "text-red-600 font-semibold" : ""}`}>
                    {g.dias_restantes >= 0 ? g.dias_restantes : "—"}
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
            Página {page} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!data.previous} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={!data.next} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}
