import { Bell, Mail, Webhook } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import {
  useEntregasNotificacao,
  useRegrasNotificacao,
  useWebhooks,
} from "@/features/notificacoes/api";
import { fmtDataHora, fmtRelativo } from "@/lib/format";

const ICONE_CANAL = {
  email: Mail,
  webhook: Webhook,
  web: Bell,
  whatsapp: Bell,
} as const;

export default function NotificacoesPage() {
  const regras = useRegrasNotificacao();
  const entregas = useEntregasNotificacao();
  const webhooks = useWebhooks();

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Notificações"
        subtitulo="Regras de envio, webhooks e histórico de entregas."
      />

      <Tabs defaultValue="regras">
        <TabsList>
          <TabsTrigger value="regras">Regras ({regras.data?.count ?? "—"})</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks ({webhooks.data?.count ?? "—"})</TabsTrigger>
          <TabsTrigger value="entregas">Entregas ({entregas.data?.count ?? "—"})</TabsTrigger>
        </TabsList>

        <TabsContent value="regras">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Regras de notificação</CardTitle>
            </CardHeader>
            <CardContent>
              {regras.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : regras.data && regras.data.results.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Severidades</TableHead>
                      <TableHead>Tipos de alerta</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regras.data.results.map((r) => {
                      const Icone = ICONE_CANAL[r.canal];
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.nome}</TableCell>
                          <TableCell><Icone className="h-4 w-4 inline mr-1" /> {r.canal}</TableCell>
                          <TableCell>
                            {r.severidades.map((s) => (
                              <Badge key={s} variant="outline" className="mr-1">{s}</Badge>
                            ))}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.tipos_alerta.length > 0 ? r.tipos_alerta.join(", ") : "Todos"}
                          </TableCell>
                          <TableCell>{r.is_active ? <Badge variant="outline">Ativa</Badge> : <Badge variant="secondary">Inativa</Badge>}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma regra cadastrada. As notificações ainda não estão conectadas ao worker (ver F16 em STATUS).
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Endpoints de webhook</CardTitle>
            </CardHeader>
            <CardContent>
              {webhooks.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : webhooks.data && webhooks.data.results.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead>Eventos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhooks.data.results.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-mono text-xs truncate max-w-[400px]">{w.url}</TableCell>
                        <TableCell className="text-xs">{w.tipos_evento.join(", ") || "Todos"}</TableCell>
                        <TableCell>{w.is_active ? <Badge variant="outline">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtRelativo(w.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhum webhook configurado.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entregas">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de entregas</CardTitle>
            </CardHeader>
            <CardContent>
              {entregas.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : entregas.data && entregas.data.results.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quando</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead>Alerta</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entregas.data.results.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm whitespace-nowrap">{fmtDataHora(e.created_at)}</TableCell>
                        <TableCell>{e.canal}</TableCell>
                        <TableCell className="font-mono text-xs truncate max-w-[260px]">{e.destino}</TableCell>
                        <TableCell className="text-sm">{e.alerta_usina_nome} <span className="text-xs text-muted-foreground">/ {e.alerta_regra}</span></TableCell>
                        <TableCell><Badge variant="outline">{e.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem entregas registradas.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
