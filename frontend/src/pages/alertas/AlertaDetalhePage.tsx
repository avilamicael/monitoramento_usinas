import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Eye, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { EstadoAlertaBadge, SeveridadeBadge } from "@/components/SeveridadeBadge";
import {
  useAlerta,
  useReconhecerAlerta,
  useResolverAlerta,
} from "@/features/alertas/api";
import { fmtDataHora } from "@/lib/format";

export default function AlertaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const alerta = useAlerta(id);
  const resolver = useResolverAlerta();
  const reconhecer = useReconhecerAlerta();

  if (alerta.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!alerta.data) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-muted-foreground">Alerta não encontrado.</p>
        <Button variant="link" asChild>
          <Link to="/alertas">Voltar à lista</Link>
        </Button>
      </div>
    );
  }

  const a = alerta.data;

  async function handleResolver() {
    try {
      await resolver.mutateAsync(a.id);
      toast.success("Alerta resolvido.");
    } catch {
      toast.error("Falha ao resolver o alerta.");
    }
  }

  async function handleReconhecer() {
    try {
      await reconhecer.mutateAsync(a.id);
      toast.success("Alerta reconhecido.");
    } catch {
      toast.error("Falha ao reconhecer.");
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/alertas"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
      </Button>

      <PageHeader
        titulo={a.regra}
        subtitulo={`Aberto em ${fmtDataHora(a.aberto_em)}`}
        acoes={
          <>
            <SeveridadeBadge severidade={a.severidade} />
            <EstadoAlertaBadge estado={a.estado} />
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mensagem</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{a.mensagem}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equipamento</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground uppercase">Usina</dt>
              <dd>
                <Link to={`/usinas/${a.usina}`} className="text-primary hover:underline inline-flex items-center gap-1">
                  {a.usina_nome} <ExternalLink className="h-3 w-3" />
                </Link>
              </dd>
            </div>
            {a.inversor && (
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Inversor</dt>
                <dd className="font-mono text-xs">{a.inversor_serie ?? a.inversor}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-muted-foreground uppercase">Atualizado em</dt>
              <dd>{fmtDataHora(a.atualizado_em)}</dd>
            </div>
            {a.resolvido_em && (
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Resolvido em</dt>
                <dd>{fmtDataHora(a.resolvido_em)}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contexto</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(a.contexto).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem contexto adicional.</p>
          ) : (
            <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-96">
              {JSON.stringify(a.contexto, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      {a.estado !== "resolvido" && (
        <div className="flex gap-2">
          {a.estado === "aberto" && (
            <Button variant="outline" onClick={handleReconhecer} disabled={reconhecer.isPending}>
              <Eye className="h-4 w-4 mr-2" />
              Reconhecer
            </Button>
          )}
          <Button onClick={handleResolver} disabled={resolver.isPending}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {resolver.isPending ? "Resolvendo…" : "Marcar como resolvido"}
          </Button>
        </div>
      )}
    </div>
  );
}
