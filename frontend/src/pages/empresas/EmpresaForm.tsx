import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmpresaInput, EmpresaSuperadmin } from "@/features/superadmin/types";

const schema = z.object({
  nome: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres."),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]*$/i, "Slug aceita apenas letras, números e hifens.")
    .max(100)
    .optional()
    .or(z.literal("")),
  cnpj: z.string().trim().max(20).optional().or(z.literal("")),
  cidade: z.string().trim().max(120).optional().or(z.literal("")),
  uf: z
    .string()
    .trim()
    .max(2)
    .regex(/^[A-Za-z]{0,2}$/, "UF aceita até 2 letras.")
    .optional()
    .or(z.literal("")),
  is_active: z.boolean(),
});

type EmpresaFormValues = z.infer<typeof schema>;

interface Props {
  inicial?: EmpresaSuperadmin;
  onSubmit: (dados: EmpresaInput) => Promise<void>;
  onCancel: () => void;
  salvando: boolean;
}

export function EmpresaForm({ inicial, onSubmit, onCancel, salvando }: Props) {
  const form = useForm<EmpresaFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: inicial?.nome ?? "",
      slug: inicial?.slug ?? "",
      cnpj: inicial?.cnpj ?? "",
      cidade: inicial?.cidade ?? "",
      uf: inicial?.uf ?? "",
      is_active: inicial?.is_active ?? true,
    },
  });

  const submit = form.handleSubmit(async (values) => {
    await onSubmit({
      nome: values.nome,
      slug: values.slug || undefined,
      cnpj: values.cnpj || "",
      cidade: values.cidade || "",
      uf: values.uf ? values.uf.toUpperCase() : "",
      is_active: values.is_active,
    });
  });

  return (
    <form onSubmit={submit} className="space-y-4 max-w-xl">
      <div className="space-y-1.5">
        <Label htmlFor="nome">Nome *</Label>
        <Input id="nome" {...form.register("nome")} autoComplete="off" />
        {form.formState.errors.nome && (
          <p className="text-xs text-destructive">{form.formState.errors.nome.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            {...form.register("slug")}
            placeholder="auto a partir do nome"
            disabled={!!inicial}
          />
          <p className="text-[11px] text-muted-foreground">
            {inicial ? "Slug é imutável após criação." : "Deixe em branco para gerar."}
          </p>
          {form.formState.errors.slug && (
            <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input id="cnpj" {...form.register("cnpj")} placeholder="00.000.000/0001-00" />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cidade">Cidade</Label>
          <Input id="cidade" {...form.register("cidade")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="uf">UF</Label>
          <Input id="uf" {...form.register("uf")} maxLength={2} className="uppercase" />
          {form.formState.errors.uf && (
            <p className="text-xs text-destructive">{form.formState.errors.uf.message}</p>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          {...form.register("is_active")}
          className="size-4"
        />
        Ativa
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando..." : inicial ? "Atualizar" : "Criar"}
        </Button>
      </div>
    </form>
  );
}
