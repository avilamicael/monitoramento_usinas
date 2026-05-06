/**
 * Página `/configuracao/regras` — gestão de regras do motor de alertas.
 *
 * Lista as 12 regras conhecidas do motor. Admin pode ativar/desativar
 * e ajustar severidade por regra. Detalhes da feature em
 * `docs/configuracao-regras/index.md` e `docs/configuracao-regras/ui.md`.
 *
 * Operacional vê os controles desabilitados (mesmo padrão de
 * `ConfiguracoesPage`).
 *
 * O botão "Resetar tudo" aciona `POST /reset-todos/` após confirmação
 * via `AlertDialog` — apaga todos os overrides da empresa de uma vez.
 */
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import LinhaRegra from "@/components/configuracao-regras/LinhaRegra";
import { useAuth } from "@/features/auth/useAuth";
import {
  extrairErroConfiguracaoRegra,
  useConfiguracaoRegras,
  useResetarTodasConfiguracoes,
} from "@/hooks/use-configuracao-regras";

export default function RegrasPage() {
  const { user } = useAuth();
  const podeEditar =
    user?.papel === "administrador" || user?.papel === "superadmin";
  const { data, loading, error, refetch } = useConfiguracaoRegras();
  const resetarTudo = useResetarTodasConfiguracoes();
  const [dialogoAberto, setDialogoAberto] = useState(false);

  const haCustomizacoes = (data ?? []).some((r) => !r.is_default);
  const desativarBotaoReset =
    !podeEditar || !haCustomizacoes || resetarTudo.isPending;

  function confirmarResetTudo() {
    setDialogoAberto(false);
    resetarTudo.mutate(undefined, {
      onSuccess: () => toast.success("Todas as regras foram restauradas para o padrão."),
      onError: (err) =>
        toast.error(
          extrairErroConfiguracaoRegra(err, "Erro ao restaurar todas as regras."),
        ),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Configuração de Regras</h1>
          <p className="text-sm text-muted-foreground">
            Defina como cada regra do motor de alertas se comporta nesta empresa.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setDialogoAberto(true)}
          disabled={desativarBotaoReset}
        >
          Resetar tudo
        </Button>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Erro</CardTitle>
            <CardDescription className="text-destructive">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={refetch}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {data?.map((regra) => (
            <LinhaRegra
              key={regra.regra_nome}
              regra={regra}
              podeEditar={podeEditar}
            />
          ))}
        </div>
      )}

      <AlertDialog open={dialogoAberto} onOpenChange={setDialogoAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar todas as regras?</AlertDialogTitle>
            <AlertDialogDescription>
              Isto apagará todas as suas customizações de severidade e estado.
              Todas as regras voltarão aos defaults do sistema. Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarResetTudo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Resetar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
