import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useCriarEmpresa } from "@/features/superadmin/api";
import type { EmpresaInput } from "@/features/superadmin/types";
import { extrairErroApi } from "@/features/superadmin/utils";

import { EmpresaForm } from "./EmpresaForm";

export default function EmpresaNovaPage() {
  const navigate = useNavigate();
  const criar = useCriarEmpresa();

  async function handleSubmit(dados: EmpresaInput) {
    try {
      const nova = await criar.mutateAsync(dados);
      toast.success(`Empresa "${nova.nome}" criada.`);
      navigate(`/empresas/${nova.id}`);
    } catch (err) {
      toast.error(extrairErroApi(err, "Erro ao criar empresa."));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Nova empresa</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre o cliente. Depois crie o primeiro usuário administrador na aba "Usuários".
        </p>
      </div>
      <EmpresaForm
        onSubmit={handleSubmit}
        onCancel={() => navigate("/empresas")}
        salvando={criar.isPending}
      />
    </div>
  );
}
