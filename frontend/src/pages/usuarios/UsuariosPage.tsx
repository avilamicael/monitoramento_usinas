import { useState } from "react";
import { Plus, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import {
  useCriarUsuario,
  useExcluirUsuario,
  useUsuarios,
  type UsuarioInput,
} from "@/features/usuarios/api";
import { fmtRelativo } from "@/lib/format";

function FormularioUsuario({ onClose }: { onClose: () => void }) {
  const [dados, setDados] = useState<UsuarioInput>({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    telefone: "",
    papel: "operacional",
    password: "",
    is_active: true,
  });
  const criar = useCriarUsuario();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await criar.mutateAsync(dados);
      toast.success("Usuário criado.");
      onClose();
    } catch {
      toast.error("Falha ao criar usuário.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Usuário</Label>
          <Input value={dados.username} onChange={(e) => setDados({ ...dados, username: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input type="email" value={dados.email} onChange={(e) => setDados({ ...dados, email: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={dados.first_name} onChange={(e) => setDados({ ...dados, first_name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Sobrenome</Label>
          <Input value={dados.last_name} onChange={(e) => setDados({ ...dados, last_name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input value={dados.telefone} onChange={(e) => setDados({ ...dados, telefone: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Papel</Label>
          <Select value={dados.papel} onValueChange={(v) => setDados({ ...dados, papel: v as "administrador" | "operacional" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="administrador">Administrador</SelectItem>
              <SelectItem value="operacional">Operacional</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 col-span-2">
          <Label>Senha</Label>
          <Input type="password" value={dados.password ?? ""} onChange={(e) => setDados({ ...dados, password: e.target.value })} required />
        </div>
        <div className="flex items-center gap-2 col-span-2">
          <Switch checked={dados.is_active} onCheckedChange={(v) => setDados({ ...dados, is_active: v })} />
          <Label className="cursor-pointer">Ativo</Label>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={criar.isPending}>{criar.isPending ? "Salvando…" : "Criar"}</Button>
      </DialogFooter>
    </form>
  );
}

export default function UsuariosPage() {
  const [novoAberto, setNovoAberto] = useState(false);
  const { data, isLoading } = useUsuarios();
  const excluir = useExcluirUsuario();

  async function handleExcluir(id: number, username: string) {
    try {
      await excluir.mutateAsync(id);
      toast.success(`${username} removido.`);
    } catch {
      toast.error("Falha ao excluir.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Usuários"
        subtitulo="Gestão de usuários da empresa."
        acoes={
          <Dialog open={novoAberto} onOpenChange={setNovoAberto}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Novo usuário</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo usuário</DialogTitle>
              </DialogHeader>
              <FormularioUsuario onClose={() => setNovoAberto(false)} />
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último login</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-sm text-muted-foreground">
                  Nenhum usuário cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              data?.results.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell>{[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    {u.papel === "administrador" ? (
                      <Badge variant="outline" className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">
                        <UserCog className="h-3 w-3 mr-1" /> Admin
                      </Badge>
                    ) : (
                      <Badge variant="outline">Operacional</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.is_active ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtRelativo(u.last_login)}</TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover {u.username}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleExcluir(u.id, u.username)}>Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
