/**
 * Página `/configuracoes` — edita `core.ConfiguracaoEmpresa` (singleton
 * 1:1 com a empresa do usuário autenticado).
 *
 * Fonte de dados: `useConfiguracaoEmpresa()` em `features/configuracoes`.
 * Operacional vê os campos read-only; só administrador pode salvar.
 *
 * Os `help_text` ao lado de cada campo (tooltip + descrição curta)
 * vêm dos `help_text` do model — espelhados aqui para evitar uma 2ª
 * chamada ao `/api/schema/`.
 */
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { InfoIcon, Loader2Icon, SaveIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/features/auth/useAuth";
import {
  useAtualizarConfiguracao,
  useConfiguracaoEmpresa,
} from "@/features/configuracoes/api";
import type { ConfiguracaoEmpresa } from "@/lib/types";

// ── Schema de validação ─────────────────────────────────────────────────
//
// API retorna decimais como string ("75.00"); a UI trabalha com `number`
// internamente e re-serializa para string quando manda PATCH. Os campos
// numéricos aqui são `number` para validação numérica honesta; o `Input
// type="number"` de cada campo é controlado por `valueAsNumber`.
const schema = z
  .object({
    // Limites (decimais e inteiros)
    temperatura_limite_c: z
      .number({ invalid_type_error: "Informe um número." })
      .min(-50)
      .max(200),
    subdesempenho_limite_pct: z.number().min(0).max(100),
    queda_rendimento_pct: z.number().min(0).max(100),
    potencia_minima_avaliacao_kw: z.number().min(0).max(100000),
    inversor_offline_coletas_minimas: z.number().int().min(1).max(1000),
    alerta_dado_ausente_coletas: z.number().int().min(1).max(1000),
    sem_geracao_queda_abrupta_pct: z.number().min(0).max(100),

    // Tempo
    alerta_sem_comunicacao_minutos: z.number().int().min(1).max(100000),
    garantia_aviso_dias: z.number().int().min(1).max(3650),
    garantia_critico_dias: z.number().int().min(1).max(3650),

    // Horário solar (HH:MM)
    horario_solar_inicio: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM."),
    horario_solar_fim: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM."),

    // Garantia & retenção
    garantia_padrao_meses: z.number().int().min(1).max(600),
    retencao_leituras_dias: z.number().int().min(1).max(3650),
  })
  .refine((d) => d.garantia_critico_dias < d.garantia_aviso_dias, {
    path: ["garantia_critico_dias"],
    message: "Aviso crítico precisa ser menor que aviso prévio.",
  });

type FormValues = z.infer<typeof schema>;

// ── Metadados de cada campo (label + help_text espelhado do backend) ────
type CampoMeta = {
  nome: keyof FormValues;
  label: string;
  ajuda: string;
  unidade?: string;
  step?: string;
  inteiro?: boolean;
  tempo?: boolean; // input type=time
};

const CAMPOS_LIMITES: CampoMeta[] = [
  {
    nome: "temperatura_limite_c",
    label: "Temperatura limite",
    unidade: "°C",
    step: "0.01",
    ajuda:
      "Limite padrão de temperatura quando o Inversor não define o seu próprio.",
  },
  {
    nome: "subdesempenho_limite_pct",
    label: "Limite de subdesempenho",
    unidade: "%",
    step: "0.01",
    ajuda:
      "Abaixo desse % da capacidade instalada (entre 10–15h locais), abre alerta de subdesempenho.",
  },
  {
    nome: "queda_rendimento_pct",
    label: "Queda de rendimento",
    unidade: "%",
    step: "0.01",
    ajuda:
      "Abaixo desse % da média dos últimos 7 dias, abre alerta queda_rendimento.",
  },
  {
    nome: "potencia_minima_avaliacao_kw",
    label: "Potência mínima de avaliação",
    unidade: "kW",
    step: "0.001",
    ajuda:
      "Potência AC mínima para avaliar regras elétricas por inversor (frequência, subtensão). Abaixo disso o inversor está em standby/transição.",
  },
  {
    nome: "inversor_offline_coletas_minimas",
    label: "Coletas para considerar inversor offline",
    inteiro: true,
    ajuda:
      "Número de coletas consecutivas em estado=offline antes de abrir alerta inversor_offline. Evita ruído de inversores que ligam/desligam em horários levemente diferentes.",
  },
  {
    nome: "alerta_dado_ausente_coletas",
    label: "Coletas para dado elétrico ausente",
    inteiro: true,
    ajuda:
      "Número de coletas consecutivas com campo elétrico null antes de abrir alerta dado_eletrico_ausente.",
  },
  {
    nome: "sem_geracao_queda_abrupta_pct",
    label: "Queda abrupta (sem_geracao_horario_solar)",
    unidade: "%",
    step: "0.01",
    ajuda:
      "% da capacidade na leitura imediatamente anterior. Se a anterior estava acima disso e agora a usina está em zero, é queda abrupta — abre o alerta. Senão (curva natural de fim de dia), não dispara.",
  },
];

const CAMPOS_TEMPO: CampoMeta[] = [
  {
    nome: "alerta_sem_comunicacao_minutos",
    label: "Sem comunicação",
    unidade: "minutos",
    inteiro: true,
    ajuda:
      "Minutos sem `medido_em` antes de abrir alerta de sem_comunicacao. Após 2x escalonamento vira crítico.",
  },
  {
    nome: "garantia_aviso_dias",
    label: "Aviso de garantia",
    unidade: "dias",
    inteiro: true,
    ajuda: "Dias antes do fim da garantia para abrir alerta info.",
  },
  {
    nome: "garantia_critico_dias",
    label: "Aviso crítico de garantia",
    unidade: "dias",
    inteiro: true,
    ajuda:
      "Dias antes do fim para escalar o alerta a aviso. Precisa ser menor que aviso prévio.",
  },
];

const CAMPOS_HORARIO: CampoMeta[] = [
  {
    nome: "horario_solar_inicio",
    label: "Horário solar — início",
    tempo: true,
    ajuda:
      "Hora (fuso da usina) a partir da qual a usina deve estar gerando. Roadmap: substituir por cálculo de irradiação NASA.",
  },
  {
    nome: "horario_solar_fim",
    label: "Horário solar — fim",
    tempo: true,
    ajuda: "Hora limite até a qual a usina deve estar gerando.",
  },
];

const CAMPOS_GARANTIA: CampoMeta[] = [
  {
    nome: "garantia_padrao_meses",
    label: "Garantia padrão",
    unidade: "meses",
    inteiro: true,
    ajuda: "Meses de garantia padrão ao cadastrar uma usina nova.",
  },
  {
    nome: "retencao_leituras_dias",
    label: "Retenção de leituras",
    unidade: "dias",
    inteiro: true,
    ajuda:
      "Quantos dias de leituras (LeituraUsina / LeituraInversor) manter. Leituras mais antigas são apagadas por task diária. Alertas não são afetados.",
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────
function paraValoresIniciais(c: ConfiguracaoEmpresa): FormValues {
  // API retorna decimais como string ("75.00") e horários como "HH:MM:SS".
  // O form trabalha com number/HH:MM.
  return {
    temperatura_limite_c: Number(c.temperatura_limite_c),
    subdesempenho_limite_pct: Number(c.subdesempenho_limite_pct),
    queda_rendimento_pct: Number(c.queda_rendimento_pct),
    potencia_minima_avaliacao_kw: Number(c.potencia_minima_avaliacao_kw),
    inversor_offline_coletas_minimas: c.inversor_offline_coletas_minimas,
    alerta_dado_ausente_coletas: c.alerta_dado_ausente_coletas,
    sem_geracao_queda_abrupta_pct: Number(c.sem_geracao_queda_abrupta_pct),
    alerta_sem_comunicacao_minutos: c.alerta_sem_comunicacao_minutos,
    garantia_aviso_dias: c.garantia_aviso_dias,
    garantia_critico_dias: c.garantia_critico_dias,
    horario_solar_inicio: c.horario_solar_inicio.slice(0, 5),
    horario_solar_fim: c.horario_solar_fim.slice(0, 5),
    garantia_padrao_meses: c.garantia_padrao_meses,
    retencao_leituras_dias: c.retencao_leituras_dias,
  };
}

function paraPayload(values: FormValues): Partial<ConfiguracaoEmpresa> {
  return {
    temperatura_limite_c: String(values.temperatura_limite_c),
    subdesempenho_limite_pct: String(values.subdesempenho_limite_pct),
    queda_rendimento_pct: String(values.queda_rendimento_pct),
    potencia_minima_avaliacao_kw: String(values.potencia_minima_avaliacao_kw),
    inversor_offline_coletas_minimas: values.inversor_offline_coletas_minimas,
    alerta_dado_ausente_coletas: values.alerta_dado_ausente_coletas,
    sem_geracao_queda_abrupta_pct: String(values.sem_geracao_queda_abrupta_pct),
    alerta_sem_comunicacao_minutos: values.alerta_sem_comunicacao_minutos,
    garantia_aviso_dias: values.garantia_aviso_dias,
    garantia_critico_dias: values.garantia_critico_dias,
    horario_solar_inicio: values.horario_solar_inicio,
    horario_solar_fim: values.horario_solar_fim,
    garantia_padrao_meses: values.garantia_padrao_meses,
    retencao_leituras_dias: values.retencao_leituras_dias,
  };
}

function extrairErroApi(err: unknown): string {
  const e = err as { response?: { status?: number; data?: Record<string, unknown> } };
  if (e?.response?.status === 403) {
    return "Sem permissão — apenas administradores podem alterar configurações.";
  }
  const data = e?.response?.data;
  if (data && typeof data === "object") {
    const msgs = Object.entries(data)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : String(v)}`)
      .join("\n");
    if (msgs) return msgs;
  }
  return "Erro ao salvar configurações.";
}

// ── UI helpers ──────────────────────────────────────────────────────────
function CampoForm({
  meta,
  registerProps,
  erro,
  readOnly,
}: {
  meta: CampoMeta;
  registerProps: ReturnType<ReturnType<typeof useForm<FormValues>>["register"]>;
  erro?: string;
  readOnly: boolean;
}) {
  const tipoInput = meta.tempo ? "time" : "number";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={meta.nome}>
          {meta.label}
          {meta.unidade ? <span className="text-muted-foreground"> ({meta.unidade})</span> : null}
        </Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Ajuda: ${meta.label}`}
            >
              <InfoIcon className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">{meta.ajuda}</TooltipContent>
        </Tooltip>
      </div>
      <Input
        id={meta.nome}
        type={tipoInput}
        step={meta.tempo ? undefined : meta.inteiro ? "1" : meta.step ?? "any"}
        readOnly={readOnly}
        disabled={readOnly}
        {...registerProps}
      />
      <p className="text-xs text-muted-foreground">{meta.ajuda}</p>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}

function SecaoCard({
  titulo,
  descricao,
  campos,
  form,
  readOnly,
}: {
  titulo: string;
  descricao: string;
  campos: CampoMeta[];
  form: ReturnType<typeof useForm<FormValues>>;
  readOnly: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        {campos.map((meta) => (
          <CampoForm
            key={meta.nome}
            meta={meta}
            registerProps={form.register(meta.nome, {
              valueAsNumber: !meta.tempo,
            })}
            erro={form.formState.errors[meta.nome]?.message as string | undefined}
            readOnly={readOnly}
          />
        ))}
      </CardContent>
    </Card>
  );
}

// ── Página ──────────────────────────────────────────────────────────────
export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const readOnly = user?.papel !== "administrador" && user?.papel !== "superadmin";

  const consulta = useConfiguracaoEmpresa();
  const mutate = useAtualizarConfiguracao();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  // Hidrata o form quando os dados chegam.
  useEffect(() => {
    if (consulta.data) {
      form.reset(paraValoresIniciais(consulta.data));
    }
  }, [consulta.data, form]);

  async function onSubmit(values: FormValues) {
    try {
      const data = await mutate.mutateAsync(paraPayload(values));
      form.reset(paraValoresIniciais(data));
      toast.success("Configurações salvas.");
    } catch (err) {
      toast.error(extrairErroApi(err));
    }
  }

  function onCancel() {
    if (consulta.data) {
      form.reset(paraValoresIniciais(consulta.data));
    }
  }

  if (consulta.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (consulta.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configurações</CardTitle>
          <CardDescription className="text-destructive">
            Erro ao carregar configurações.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const sujo = form.formState.isDirty;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Configurações da empresa</h1>
          <p className="text-sm text-muted-foreground">
            Parâmetros globais aplicados a todas as usinas e regras de alerta.
            {readOnly && " Apenas administradores podem editar."}
          </p>
        </div>
        {consulta.data?.updated_at && (
          <p className="text-xs text-muted-foreground">
            Última atualização: {new Date(consulta.data.updated_at).toLocaleString("pt-BR")}
          </p>
        )}
      </div>

      <SecaoCard
        titulo="Alertas — Limites"
        descricao="Thresholds aplicados pelo motor de alertas a cada ciclo de coleta."
        campos={CAMPOS_LIMITES}
        form={form}
        readOnly={readOnly}
      />

      <SecaoCard
        titulo="Alertas — Tempo"
        descricao="Janelas temporais antes de abrir / escalonar alertas."
        campos={CAMPOS_TEMPO}
        form={form}
        readOnly={readOnly}
      />

      <SecaoCard
        titulo="Horário solar (fallback)"
        descricao="Janela usada pela regra sem_geracao_horario_solar quando a usina não tem latitude/longitude para cálculo de irradiação."
        campos={CAMPOS_HORARIO}
        form={form}
        readOnly={readOnly}
      />

      <SecaoCard
        titulo="Garantia & retenção"
        descricao="Padrões de cadastro de garantia e política de retenção de leituras."
        campos={CAMPOS_GARANTIA}
        form={form}
        readOnly={readOnly}
      />

      {!readOnly && (
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={!sujo || mutate.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={!sujo || mutate.isPending}>
            {mutate.isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <SaveIcon className="size-4" />
            )}
            Salvar alterações
          </Button>
        </div>
      )}
    </form>
  );
}
