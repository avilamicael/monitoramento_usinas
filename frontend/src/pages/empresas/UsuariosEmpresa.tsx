import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  ShieldIcon,
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
  useAtualizarUsuarioSuperadmin,
  useCriarUsuarioSuperadmin,
  useExcluirUsuarioSuperadmin,
  useUsuariosSuperadmin,
} from "@/features/superadmin/api";
import type { UsuarioInput, UsuarioSuperadmin } from "@/features/superadmin/types";
import { extrairErroApi } from "@/features/superadmin/utils";

import { UsuarioFormDialog } from "./UsuarioFormDialog";

interface Props {
  empresaId: string;
}

export function UsuariosEmpresa({ empresaId }: Props) {
  const { data, isLoading, error } = useUsuariosSuperadmin(empresaId);
  const criar = useCriarUsuarioSuperadmin();
  const atualizar = useAtualizarUsuarioSuperadmin();
  const excluir = useExcluirUsuarioSuperadmin();

  const [target, setTarget] = useState<UsuarioSuperadmin | "novo" | null>(null);
  const [acaoId, setAcaoId] = useState<number | null>(null);

  async function handleSubmit(dados: UsuarioInput, id: number | null) {
    if (id) {
      await atualizar.mutateAsync({ id, dados });
    } else {
      await criar.mutateAsync({ ...dados, empresa: empresaId });
    }
  }

  async function handleInativar(u: UsuarioSuperadmin) {
    if (!window.confirm(`Inativar o usuário "${u.username}"?`)) return;
    setAcaoId(u.id);
    try {
      await excluir.mutateAsync(u.id);
      toast.success("Usuário inativado.");
    } catch (err) {
      toast.error(extrairErroApi(err, "Erro ao inativar usuário."));
    } finally {
      setAcaoId(null);
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {extrairErroApi(error, "Erro ao carregar usuários.")}
      </div>
    );
  }

  const usuarios = data?.results ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Usuários cadastrados nesta empresa.
        </p>
        <Button onClick={() => setTarget("novo")} size="sm">
          <PlusIcon className="size-4 mr-1" />
          Novo usuário
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum usuário nesta empresa.
                </TableCell>
              </TableRow>
            ) : (
              usuarios.map((u) => {
                const em = acaoId === u.id;
                const nome = [u.first_name, u.last_name].filter(Boolean).join(" ") || "—";
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.username}</TableCell>
                    <TableCell>{nome}</TableCell>
                    <TableCell className="text-sm">{u.email || "—"}</TableCell>
                    <TableCell>
                      <PapelBadge papel={u.papel} />
                    </TableCell>
                    <TableCell>
                      {u.is_active ? (
                        <Badge className="bg-green-100 text-green-800 gap-1 text-xs">
                          <CheckCircle2Icon className="size-3" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <XCircleIcon className="size-3" />
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTarget(u)}
                          disabled={em}
                        >
                          <PencilIcon className="size-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleInativar(u)}
                          disabled={em || !u.is_active}
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

      <UsuarioFormDialog
        usuario={target && target !== "novo" ? target : null}
        empresaId={empresaId}
        open={target !== null}
        onClose={() => setTarget(null)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

function PapelBadge({ papel }: { papel: UsuarioSuperadmin["papel"] }) {
  if (papel === "superadmin") {
    return (
      <Badge className="bg-purple-100 text-purple-800 gap-1 text-xs">
        <ShieldIcon className="size-3" />
        Superadmin
      </Badge>
    );
  }
  if (papel === "administrador") {
    return <Badge className="bg-blue-100 text-blue-800 text-xs">Administrador</Badge>;
  }
  return (
    <Badge variant="secondary" className="text-xs">
      Operacional
    </Badge>
  );
}
