import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useEmpresasSuperadmin,
  useExcluirEmpresa,
} from "@/features/superadmin/api";
import { extrairErroApi } from "@/features/superadmin/utils";

export default function EmpresasPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useEmpresasSuperadmin();
  const excluir = useExcluirEmpresa();
  const [acaoId, setAcaoId] = useState<string | null>(null);

  async function handleInativar(id: string, nome: string) {
    if (!window.confirm(`Inativar a empresa "${nome}"? Os dados são preservados.`)) return;
    setAcaoId(id);
    try {
      await excluir.mutateAsync(id);
      toast.success("Empresa inativada.");
    } catch (err) {
      toast.error(extrairErroApi(err, "Erro ao inativar empresa."));
    } finally {
      setAcaoId(null);
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {extrairErroApi(error, "Erro ao carregar empresas.")}
      </div>
    );
  }

  const empresas = data?.results ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Empresas</h1>
          <p className="text-sm text-muted-foreground">
            Onboarding e gestão de clientes da Firma Solar.
          </p>
        </div>
        <Button onClick={() => navigate("/empresas/nova")}>
          <PlusIcon className="size-4 mr-1" />
          Nova empresa
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead className="text-right">Usuários</TableHead>
              <TableHead className="text-right">Usinas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empresas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhuma empresa cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              empresas.map((e) => {
                const em = acaoId === e.id;
                const cidadeUf = [e.cidade, e.uf].filter(Boolean).join("/") || "—";
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      <Link to={`/empresas/${e.id}`} className="hover:underline">
                        {e.nome}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {e.slug}
                    </TableCell>
                    <TableCell>{cidadeUf}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {e.qtd_usuarios}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{e.qtd_usinas}</TableCell>
                    <TableCell>
                      {e.is_active ? (
                        <Badge className="bg-green-100 text-green-800 gap-1 text-xs">
                          <CheckCircle2Icon className="size-3" />
                          Ativa
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <XCircleIcon className="size-3" />
                          Inativa
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/empresas/${e.id}`)}
                          disabled={em}
                        >
                          <PencilIcon className="size-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleInativar(e.id, e.nome)}
                          disabled={em || !e.is_active}
                        >
                          {em ? (
                            <Loader2Icon className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2Icon className="size-3.5 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
