import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Sun, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { SeveridadeBadge, EstadoAlertaBadge } from "@/components/SeveridadeBadge";
import { useInversoresDaUsina, useUsina } from "@/features/usinas/api";
import { useAlertas } from "@/features/alertas/api";
import { fmtData, fmtDataHora, fmtKw, fmtKwp, fmtNum, fmtRelativo, rotuloProvedor } from "@/lib/format";

export default function UsinaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const usina = useUsina(id);
  const inversores = useInversoresDaUsina(id);
  const alertas = useAlertas({ usina: Number(id), estado: "aberto" });

  if (usina.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!usina.data) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-muted-foreground">Usina não encontrada.</p>
        <Button variant="link" asChild>
          <Link to="/usinas">Voltar à lista</Link>
        </Button>
      </div>
    );
  }

  const u = usina.data;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/usinas"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
      </Button>

      <PageHeader
        titulo={u.nome}
        subtitulo={[u.cidade, u.estado].filter(Boolean).join(" · ") || "Sem localização cadastrada"}
        acoes={
          <Badge variant={u.is_active ? "outline" : "secondary"}>
            {u.is_active ? "Ativa" : "Inativa"}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Sun className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-xs uppercase text-muted-foreground">Capacidade</p>
                <p className="text-xl font-bold">{fmtKwp(u.capacidade_kwp)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Zap className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-xs uppercase text-muted-foreground">Inversores</p>
                <p className="text-xl font-bold">{inversores.data?.length ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MapPin className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-xs uppercase text-muted-foreground">Última leitura</p>
                <p className="text-base font-semibold">{fmtRelativo(u.ultima_leitura_em)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground uppercase">Provedor</dt>
              <dd>{rotuloProvedor(u.provedor_tipo)} {u.provedor_rotulo && <span className="text-muted-foreground">({u.provedor_rotulo})</span>}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase">ID externo</dt>
              <dd className="font-mono text-xs">{u.id_externo || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase">Comissionada em</dt>
              <dd>{fmtData(u.comissionada_em)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase">Garantia</dt>
              <dd>{u.status_garantia === "ativa" ? "Ativa" : u.status_garantia === "vencida" ? "Vencida" : "Sem garantia"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase">Tensão AC limite</dt>
              <dd>{fmtNum(u.tensao_ac_limite_minimo_v)} – {fmtNum(u.tensao_ac_limite_v)} V</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase">Frequência</dt>
              <dd>{fmtNum(u.frequencia_minimo_hz)} – {fmtNum(u.frequencia_maximo_hz)} Hz</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase">Fuso</dt>
              <dd>{u.fuso_horario}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase">Coordenadas</dt>
              <dd>{u.latitude && u.longitude ? `${u.latitude}, ${u.longitude}` : "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inversores ({inversores.data?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {inversores.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : inversores.data && inversores.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Série / ID</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Potência nominal</TableHead>
                  <TableHead>Última leitura</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inversores.data.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.numero_serie || i.id_externo}</TableCell>
                    <TableCell>{i.modelo || "—"}</TableCell>
                    <TableCell>{i.tipo}</TableCell>
                    <TableCell className="text-right">{i.potencia_nominal_kw ? fmtKw(i.potencia_nominal_kw) : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtRelativo(i.ultima_leitura_em)}</TableCell>
                    <TableCell className="text-right">
                      {i.is_active ? (
                        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem inversores cadastrados.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alertas abertos ({alertas.data?.count ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {alertas.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : alertas.data && alertas.data.results.length > 0 ? (
            <ul className="space-y-2">
              {alertas.data.results.map((a) => (
                <li key={a.id}>
                  <Link to={`/alertas/${a.id}`} className="flex items-center justify-between gap-3 p-3 rounded-md border hover:bg-muted">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <SeveridadeBadge severidade={a.severidade} />
                        <EstadoAlertaBadge estado={a.estado} />
                        <span className="text-xs text-muted-foreground">{fmtDataHora(a.aberto_em)}</span>
                      </div>
                      <p className="text-sm truncate">{a.mensagem}</p>
                      <p className="text-xs text-muted-foreground">{a.regra}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem alertas abertos.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
