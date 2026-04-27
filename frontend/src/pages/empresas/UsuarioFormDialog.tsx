import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UsuarioInput, UsuarioSuperadmin } from "@/features/superadmin/types";
import { extrairErroApi } from "@/features/superadmin/utils";

const PAPEIS_DISPONIVEIS = [
  { value: "operacional", label: "Operacional" },
  { value: "administrador", label: "Administrador" },
  { value: "superadmin", label: "Superadmin" },
] as const;

const buildSchema = (isEditing: boolean) =>
  z.object({
    username: z.string().trim().min(2, "Mínimo 2 caracteres."),
    email: z.string().trim().email("E-mail inválido.").or(z.literal("")),
    first_name: z.string().trim().max(150).optional().or(z.literal("")),
    last_name: z.string().trim().max(150).optional().or(z.literal("")),
    telefone: z.string().trim().max(30).optional().or(z.literal("")),
    papel: z.enum(["operacional", "administrador", "superadmin"]),
    password: isEditing
      ? z.string().optional().or(z.literal(""))
      : z.string().min(8, "Senha deve ter pelo menos 8 caracteres."),
    is_active: z.boolean(),
  });

type Values = z.infer<ReturnType<typeof buildSchema>>;

interface Props {
  usuario: UsuarioSuperadmin | null;
  empresaId: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (dados: UsuarioInput, id: number | null) => Promise<void>;
}

export function UsuarioFormDialog({ usuario, empresaId, open, onClose, onSubmit }: Props) {
  const isEditing = !!usuario;
  const schema = buildSchema(isEditing);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: "",
      email: "",
      first_name: "",
      last_name: "",
      telefone: "",
      papel: "operacional",
      password: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (usuario) {
      form.reset({
        username: usuario.username,
        email: usuario.email,
        first_name: usuario.first_name,
        last_name: usuario.last_name,
        telefone: usuario.telefone,
        papel: usuario.papel,
        password: "",
        is_active: usuario.is_active,
      });
    } else {
      form.reset({
        username: "",
        email: "",
        first_name: "",
        last_name: "",
        telefone: "",
        papel: "operacional",
        password: "",
        is_active: true,
      });
    }
  }, [usuario, open, form]);

  const submit = form.handleSubmit(async (values) => {
    const payload: UsuarioInput = {
      username: values.username,
      email: values.email || "",
      first_name: values.first_name || "",
      last_name: values.last_name || "",
      telefone: values.telefone || "",
      papel: values.papel,
      empresa: empresaId,
      is_active: values.is_active,
    };
    if (values.password) payload.password = values.password;
    try {
      await onSubmit(payload, usuario?.id ?? null);
      toast.success(isEditing ? "Usuário atualizado." : "Usuário criado.");
      onClose();
    } catch (err) {
      toast.error(extrairErroApi(err, "Erro ao salvar usuário."));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Editar — ${usuario?.username}` : "Novo usuário"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Deixe a senha em branco para manter a atual."
              : "Preencha os dados. Senha deve ter pelo menos 8 caracteres."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="username">Usuário (login) *</Label>
            <Input id="username" autoComplete="off" {...form.register("username")} />
            {form.formState.errors.username && (
              <p className="text-xs text-destructive">
                {form.formState.errors.username.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">Nome</Label>
              <Input id="first_name" {...form.register("first_name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Sobrenome</Label>
              <Input id="last_name" {...form.register("last_name")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" {...form.register("telefone")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="papel">Papel *</Label>
            <Select
              value={form.watch("papel")}
              onValueChange={(v) =>
                form.setValue("papel", v as Values["papel"], { shouldValidate: true })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAPEIS_DISPONIVEIS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">{isEditing ? "Nova senha (opcional)" : "Senha *"}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder={isEditing ? "Em branco = manter atual" : "Mínimo 8 caracteres"}
              {...form.register("password")}
            />
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="size-4" {...form.register("is_active")} />
            Ativo
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={form.formState.isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Salvando..." : isEditing ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
