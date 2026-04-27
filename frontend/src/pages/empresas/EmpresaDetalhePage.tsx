import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAtualizarEmpresa,
  useEmpresaSuperadmin,
} from "@/features/superadmin/api";
import type { EmpresaInput } from "@/features/superadmin/types";
import { extrairErroApi } from "@/features/superadmin/utils";

import { EmpresaForm } from "./EmpresaForm";
import { UsuariosEmpresa } from "./UsuariosEmpresa";

type Aba = "dados" | "usuarios";

export default function EmpresaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>("dados");

  const { data: empresa, isLoading, error } = useEmpresaSuperadmin(id);
  const atualizar = useAtualizarEmpresa();

  async function handleSubmit(dados: EmpresaInput) {
    if (!id) return;
    try {
      await atualizar.mutateAsync({ id, dados });
      toast.success("Empresa atualizada.");
    } catch (err) {
      toast.error(extrairErroApi(err, "Erro ao atualizar empresa."));
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {extrairErroApi(error, "Erro ao carregar empresa.")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/empresas">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{empresa?.nome ?? "Empresa"}</h1>
          {empresa && (
            <p className="text-xs text-muted-foreground font-mono">{empresa.slug}</p>
          )}
        </div>
      </div>

      {/* Tabs simples — botões alternando estado */}
      <div className="border-b flex gap-1">
        <TabButton ativo={aba === "dados"} onClick={() => setAba("dados")}>
          Dados
        </TabButton>
        <TabButton ativo={aba === "usuarios"} onClick={() => setAba("usuarios")}>
          Usuários{empresa ? ` (${empresa.qtd_usuarios})` : ""}
        </TabButton>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full max-w-xl" />
          ))}
        </div>
      ) : aba === "dados" && empresa ? (
        <EmpresaForm
          inicial={empresa}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/empresas")}
          salvando={atualizar.isPending}
        />
      ) : aba === "usuarios" && id ? (
        <UsuariosEmpresa empresaId={id} />
      ) : null}
    </div>
  );
}

function TabButton({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
        (ativo
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
