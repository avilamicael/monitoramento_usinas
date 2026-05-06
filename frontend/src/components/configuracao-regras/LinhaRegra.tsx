/**
 * Linha de configuração de uma regra do motor de alertas.
 *
 * Lê uma `ConfiguracaoRegra` do backend e expõe controles para:
 * - Ativar/desativar (Switch).
 * - Mudar severidade (Select; bloqueado quando `severidade_dinamica`).
 * - Resetar para o default do código (Button visível só com override).
 *
 * Salvamento automático: cada mudança dispara o `PUT` correspondente.
 *
 * - Switch (boolean): salva imediatamente — a intenção do usuário é clara
 *   no clique e não há valores intermediários a "esperar".
 * - Select (severidade): debounce de 300ms para evitar 2-3 mutations
 *   seguidas se o usuário troca de opção rapidamente.
 *
 * Quando o admin desativa uma regra cujo `severidade_default === "critico"`,
 * antes de salvar abre-se um AlertDialog de confirmação (mitiga R4 do
 * `docs/configuracao-regras/riscos-e-rollback.md`).
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { InfoIcon, Loader2Icon, RotateCcwIcon } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  extrairErroConfiguracaoRegra,
  useAtualizarConfiguracaoRegra,
  useResetarConfiguracaoRegra,
} from "@/hooks/use-configuracao-regras";
import { CATEGORIA_LABELS, type NivelAlerta } from "@/types/alertas";
import type { ConfiguracaoRegra } from "@/types/configuracao-regras";

const SEVERIDADE_OPCOES: Array<{ valor: NivelAlerta; label: string }> = [
  { valor: "critico", label: "Crítico" },
  { valor: "aviso", label: "Aviso" },
  { valor: "info", label: "Informativo" },
];

const DEBOUNCE_MS = 300;

function nomeLegivel(regra_nome: string): string {
  return CATEGORIA_LABELS[regra_nome] ?? regra_nome;
}

export interface LinhaRegraProps {
  regra: ConfiguracaoRegra;
  podeEditar: boolean;
}

export default function LinhaRegra({ regra, podeEditar }: LinhaRegraProps) {
  const atualizar = useAtualizarConfiguracaoRegra();
  const resetar = useResetarConfiguracaoRegra();

  // Estado local espelha o backend; é re-sincronizado quando `regra` muda
  // (ex.: após invalidação de cache pós-mutation).
  const [ativa, setAtiva] = useState(regra.ativa);
  const [severidade, setSeveridade] = useState<NivelAlerta>(regra.severidade);
  const [dialogoCriticoAberto, setDialogoCriticoAberto] = useState(false);

  useEffect(() => {
    setAtiva(regra.ativa);
    setSeveridade(regra.severidade);
  }, [regra.ativa, regra.severidade]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const salvando = atualizar.isPending || resetar.isPending;

  function dispararSalvamento(novo: { ativa: boolean; severidade: NivelAlerta }) {
    atualizar.mutate(
      { regra_nome: regra.regra_nome, payload: novo },
      {
        onSuccess: () => toast.success("Salvo."),
        onError: (err) =>
          toast.error(extrairErroConfiguracaoRegra(err, "Erro ao salvar regra.")),
      },
    );
  }

  function handleAtivaChange(checked: boolean) {
    // Confirmação extra ao desativar regra crítica (R4).
    if (!checked && regra.severidade_default === "critico") {
      setDialogoCriticoAberto(true);
      return;
    }
    setAtiva(checked);
    dispararSalvamento({ ativa: checked, severidade });
  }

  function confirmarDesativacaoCritica() {
    setDialogoCriticoAberto(false);
    setAtiva(false);
    dispararSalvamento({ ativa: false, severidade });
  }

  function handleSeveridadeChange(valor: string) {
    const nova = valor as NivelAlerta;
    setSeveridade(nova);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      dispararSalvamento({ ativa, severidade: nova });
    }, DEBOUNCE_MS);
  }

  function handleResetar() {
    resetar.mutate(regra.regra_nome, {
      onSuccess: () => toast.success("Regra restaurada para o padrão."),
      onError: (err) =>
        toast.error(extrairErroConfiguracaoRegra(err, "Erro ao restaurar regra.")),
    });
  }

  const selectDesabilitado = !podeEditar || regra.severidade_dinamica || !ativa;
  const switchDesabilitado = !podeEditar || salvando;
  const idAtiva = `regra-${regra.regra_nome}-ativa`;
  const idSeveridade = `regra-${regra.regra_nome}-severidade`;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-medium">{nomeLegivel(regra.regra_nome)}</div>
          {regra.descricao ? (
            <div className="text-sm text-muted-foreground">{regra.descricao}</div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id={idAtiva}
              checked={ativa}
              onCheckedChange={handleAtivaChange}
              disabled={switchDesabilitado}
              aria-label={`Ativar regra ${nomeLegivel(regra.regra_nome)}`}
            />
            <Label htmlFor={idAtiva} className="cursor-pointer text-sm font-normal">
              Ativa
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor={idSeveridade} className="text-sm font-normal">
              Severidade:
            </Label>
            {regra.severidade_dinamica ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1">
                    <Badge variant="secondary">Dinâmica</Badge>
                    <InfoIcon
                      className="size-3.5 text-muted-foreground"
                      aria-hidden
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Esta regra escala automaticamente entre Aviso e Crítico
                  conforme o tempo. Não pode ser fixada.
                </TooltipContent>
              </Tooltip>
            ) : (
              <Select
                value={severidade}
                onValueChange={handleSeveridadeChange}
                disabled={selectDesabilitado}
              >
                <SelectTrigger id={idSeveridade} className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERIDADE_OPCOES.map((opt) => (
                    <SelectItem key={opt.valor} value={opt.valor}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-2 min-w-[7rem] justify-end">
            {salvando ? (
              <Loader2Icon
                className="size-4 animate-spin text-muted-foreground"
                aria-label="Salvando"
              />
            ) : null}
            {regra.is_default ? (
              !regra.severidade_dinamica ? (
                <Badge variant="outline">Padrão</Badge>
              ) : null
            ) : podeEditar ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetar}
                disabled={salvando}
                title="Resetar para padrão"
              >
                <RotateCcwIcon />
                Resetar
              </Button>
            ) : (
              <Badge variant="secondary">Customizada</Badge>
            )}
          </div>
        </div>
      </CardContent>

      <AlertDialog
        open={dialogoCriticoAberto}
        onOpenChange={setDialogoCriticoAberto}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar regra crítica?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{nomeLegivel(regra.regra_nome)}</strong> é uma regra
              crítica. Tem certeza que quer desativar? Enquanto desativada, o
              motor não gerará novos alertas dessa regra para a sua empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarDesativacaoCritica}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
