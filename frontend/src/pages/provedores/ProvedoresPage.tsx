import { useState } from "react";
import { Plug, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
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
  useColetarAgora,
  useCriarProvedor,
  useExcluirProvedor,
  useProvedores,
} from "@/features/provedores/api";
import { fmtRelativo, rotuloProvedor } from "@/lib/format";
import type { ContaProvedorInput, TipoProvedor } from "@/lib/types";

// Campos esperados de credenciais por tipo de provedor.
const CAMPOS_POR_TIPO: Record<TipoProvedor, { campo: string; label: string; type?: string }[]> = {
  solis:       [{ campo: "api_key", label: "API key" }, { campo: "app_secret", label: "App secret", type: "password" }],
  hoymiles:    [{ campo: "username", label: "Usuário" }, { campo: "password", label: "Senha", type: "password" }],
  fusionsolar: [{ campo: "username", label: "Usuário" }, { campo: "password", label: "Senha", type: "password" }],
  solarman:    [{ campo: "token", label: "Token JWT", type: "password" }],
  auxsol:      [{ campo: "username", label: "Usuário" }, { campo: "password", label: "Senha", type: "password" }],
  foxess:      [{ campo: "api_key", label: "API key", type: "password" }],
};

function FormularioProvedor({ onClose }: { onClose: () => void }) {
  const [tipo, setTipo] = useState<TipoProvedor>("solis");
  const [rotulo, setRotulo] = useState("");
  const [intervalo, setIntervalo] = useState(30);
  const [credenciais, setCredenciais] = useState<Record<string, string>>({});
  const criar = useCriarProvedor();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: ContaProvedorInput = {
      tipo,
      rotulo,
      intervalo_coleta_minutos: intervalo,
      credenciais,
      is_active: true,
    };
    try {
      await criar.mutateAsync(input);
      toast.success("Conta criada.");
      onClose();
    } catch {
      toast.error("Falha ao criar a conta.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de provedor</Label>
        <Select value={tipo} onValueChange={(v) => { setTipo(v as TipoProvedor); setCredenciais({}); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.keys(CAMPOS_POR_TIPO).map((t) => (
              <SelectItem key={t} value={t}>{rotuloProvedor(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Rótulo</Label>
        <Input value={rotulo} onChange={(e) => setRotulo(e.target.value)} placeholder="Ex.: conta principal" required />
      </div>

      <div className="space-y-2">
        <Label>Intervalo de coleta (minutos)</Label>
        <Input type="number" min={5} value={intervalo} onChange={(e) => setIntervalo(Number(e.target.value))} />
      </div>

      <div className="space-y-3 pt-2 border-t">
        <p className="text-sm font-medium">Credenciais</p>
        {CAMPOS_POR_TIPO[tipo].map((c) => (
          <div key={c.campo} className="space-y-2">
            <Label>{c.label}</Label>
            <Input
              type={c.type ?? "text"}
              value={credenciais[c.campo] ?? ""}
              onChange={(e) => setCredenciais({ ...credenciais, [c.campo]: e.target.value })}
              required
            />
          </div>
        ))}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={criar.isPending}>{criar.isPending ? "Salvando…" : "Criar"}</Button>
      </DialogFooter>
    </form>
  );
}

export default function ProvedoresPage() {
  const [novoAberto, setNovoAberto] = useState(false);
  const { data, isLoading } = useProvedores();
  const coletar = useColetarAgora();
  const excluir = useExcluirProvedor();

  async function handleColetar(id: number, rotulo: string) {
    try {
      await coletar.mutateAsync(id);
      toast.success(`Coleta agendada para ${rotulo}.`);
    } catch {
      toast.error("Falha ao agendar coleta.");
    }
  }

  async function handleExcluir(id: number, rotulo: string) {
    try {
      await excluir.mutateAsync(id);
      toast.success(`${rotulo} removido.`);
    } catch {
      toast.error("Falha ao excluir.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Provedores"
        subtitulo="Contas e credenciais para cada plataforma de monitoramento."
        acoes={
          <Dialog open={novoAberto} onOpenChange={setNovoAberto}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Nova conta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova conta de provedor</DialogTitle>
                <DialogDescription>Credenciais são criptografadas com Fernet e nunca aparecem na resposta.</DialogDescription>
              </DialogHeader>
              <FormularioProvedor onClose={() => setNovoAberto(false)} />
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provedor</TableHead>
              <TableHead>Rótulo</TableHead>
              <TableHead className="text-right">Intervalo</TableHead>
              <TableHead>Última sync</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                  Nenhuma conta cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              data?.results.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="flex items-center gap-2 font-medium">
                    <Plug className="h-4 w-4 text-muted-foreground" />
                    {rotuloProvedor(p.tipo)}
                  </TableCell>
                  <TableCell>{p.rotulo}</TableCell>
                  <TableCell className="text-right">{p.intervalo_coleta_minutos} min</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtRelativo(p.ultima_sincronizacao_em)}</TableCell>
                  <TableCell>
                    {!p.is_active ? <Badge variant="secondary">Inativo</Badge>
                      : p.precisa_atencao ? <Badge variant="outline" className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30">Atenção</Badge>
                      : p.ultima_sincronizacao_status === "sucesso" ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">OK</Badge>
                      : p.ultima_sincronizacao_status === "erro" ? <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">Erro</Badge>
                      : <Switch checked={p.is_active} disabled />}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleColetar(p.id, p.rotulo)} disabled={coletar.isPending}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover {p.rotulo}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação remove a conta e todas as usinas associadas (ON DELETE PROTECT pode bloquear se houver leituras).
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleExcluir(p.id, p.rotulo)}>Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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
