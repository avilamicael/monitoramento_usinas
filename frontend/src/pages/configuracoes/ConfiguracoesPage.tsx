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
import { useEffect, type ComponentType } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  InfoIcon,
  Loader2Icon,
  SaveIcon,
  ThermometerIcon,
  ClockIcon,
  SunIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";
import {
  useAtualizarConfiguracao,
  useConfiguracaoEmpresa,
} from "@/features/configuracoes/api";
import type { ConfiguracaoEmpresa } from "@/lib/types";
import { Card, CardHead, CardTitle } from "@/components/trylab/primitives";

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
  exemplo?: string;
  unidade?: string;
  step?: string;
  inteiro?: boolean;
  tempo?: boolean; // input type=time
};

const CAMPOS_LIMITES: CampoMeta[] = [
  {
    nome: "temperatura_limite_c",
    label: "Temperatura máxima do inversor",
    unidade: "°C",
    step: "0.01",
    ajuda:
      "Quando a temperatura interna do inversor passa desse valor, abrimos um alerta de temperatura alta. Cada inversor pode ter o próprio limite — esse aqui é o padrão da empresa, usado quando o inversor não define o seu.",
    exemplo:
      "Em 75°C: se um inversor reportar 78°C, dispara alerta. Inversores costumam reduzir potência acima de 70°C.",
  },
  {
    nome: "subdesempenho_limite_pct",
    label: "Limite de subdesempenho",
    unidade: "%",
    step: "0.01",
    ajuda:
      "Entre 10h e 15h (horário de pico solar), se a usina gerar abaixo desse percentual da capacidade instalada, abrimos alerta de subdesempenho.",
    exemplo:
      "Em 15%: usina de 10 kWp gerando menos de 1.5 kW ao meio-dia dispara alerta. Sinaliza painéis sujos, sombra inesperada ou inversor com falha parcial.",
  },
  {
    nome: "queda_rendimento_pct",
    label: "Queda de rendimento (vs últimos 7 dias)",
    unidade: "%",
    step: "0.01",
    ajuda:
      "Comparamos a geração total de hoje com a média dos últimos 7 dias. Se hoje ficar abaixo desse percentual da média, abrimos alerta de queda de rendimento (avaliado uma vez ao dia).",
    exemplo:
      "Em 60%: se a média semanal foi 30 kWh/dia e hoje a usina gerou só 15 kWh, dispara (15 ÷ 30 = 50%, abaixo de 60%).",
  },
  {
    nome: "potencia_minima_avaliacao_kw",
    label: "Potência mínima para avaliar regras elétricas",
    unidade: "kW",
    step: "0.001",
    ajuda:
      "Abaixo dessa potência o inversor é tratado como desligado (standby) e regras elétricas (subtensão, sobretensão, frequência) não são avaliadas. Evita falso alerta quando o inversor está acordando ou dormindo.",
    exemplo:
      "Em 0.5 kW: inversor gerando 0.2 kW de manhãzinha é considerado standby — não avaliamos tensão/freq dele até passar de 0.5 kW.",
  },
  {
    nome: "inversor_offline_coletas_minimas",
    label: "Coletas seguidas para inversor offline",
    inteiro: true,
    ajuda:
      "Quantas coletas seguidas o inversor precisa aparecer como offline antes de abrirmos o alerta. Evita falso alerta quando 1 inversor liga 5 minutos depois dos outros.",
    exemplo:
      "Em 3: com coleta a cada 10 min, o inversor precisa estar offline por ~30 min seguidos para disparar alerta.",
  },
  {
    nome: "alerta_dado_ausente_coletas",
    label: "Coletas seguidas com dado elétrico faltando",
    inteiro: true,
    ajuda:
      "Quantas coletas seguidas o provedor pode deixar de reportar tensão/corrente/freq antes de abrirmos alerta. Sensores travam às vezes — esperamos algumas coletas pra ter certeza.",
    exemplo:
      "Em 10: o provedor pode falhar 10 coletas (~1h40 com coleta a cada 10 min) antes de soar o alerta.",
  },
  {
    nome: "sem_geracao_queda_abrupta_pct",
    label: "Limite mínimo de geração para considerar usina ativa",
    unidade: "%",
    step: "0.01",
    ajuda:
      "Usado pela regra de geração em horário solar. Se a usina nunca passou desse percentual da capacidade no dia (ou estava abaixo dele antes de cair pra zero), tratamos como dia ruim ou usina mal-orientada — não dispara o alerta crítico.",
    exemplo:
      "Em 15%: usina de 10 kWp precisa ter atingido 1.5 kW pelo menos uma vez no dia pra que uma queda pra zero seja considerada anomalia. Senão, é só dia nublado.",
  },
];

const CAMPOS_TEMPO: CampoMeta[] = [
  {
    nome: "alerta_sem_comunicacao_minutos",
    label: "Tempo sem comunicação até alertar",
    unidade: "minutos",
    inteiro: true,
    ajuda:
      "Quanto tempo a usina pode ficar sem reportar dado novo ao provedor antes de abrirmos alerta. Após o dobro desse tempo, o alerta vira crítico.",
    exemplo:
      "Em 1440 (24h): se a usina não reportar nada em 24h vira aviso; em 48h escala pra crítico. Detecta Wi-Fi caído, datalogger desligado, etc.",
  },
  {
    nome: "garantia_aviso_dias",
    label: "Aviso prévio de fim de garantia",
    unidade: "dias",
    inteiro: true,
    ajuda:
      "Quantos dias antes do fim da garantia da usina abrimos alerta informativo. Tempo pra renovar / negociar.",
    exemplo: "Em 90: você é avisado 3 meses antes do fim da garantia.",
  },
  {
    nome: "garantia_critico_dias",
    label: "Aviso crítico de fim de garantia",
    unidade: "dias",
    inteiro: true,
    ajuda:
      "Quantos dias antes do fim da garantia o alerta escala de informativo para aviso. Precisa ser menor que o aviso prévio.",
    exemplo: "Em 30: a 30 dias do vencimento, o alerta vira aviso.",
  },
];

const CAMPOS_HORARIO: CampoMeta[] = [
  {
    nome: "horario_solar_inicio",
    label: "Início do horário solar",
    tempo: true,
    ajuda:
      "Hora (no fuso da usina) a partir da qual esperamos geração. Antes disso, geração zero é normal e não dispara alerta. Usado quando a usina não tem latitude/longitude cadastradas.",
    exemplo:
      "Em 08:00: se a usina não estiver gerando nada às 09h, é candidato a alerta. Antes das 08h o sol mal nasceu, ignoramos.",
  },
  {
    nome: "horario_solar_fim",
    label: "Fim do horário solar",
    tempo: true,
    ajuda:
      "Hora limite até a qual esperamos geração. Depois disso, geração zero é fim de tarde natural.",
    exemplo: "Em 18:00: queda pra zero às 17h ainda é avaliada; às 19h não é.",
  },
];

const CAMPOS_GARANTIA: CampoMeta[] = [
  {
    nome: "garantia_padrao_meses",
    label: "Duração padrão da garantia",
    unidade: "meses",
    inteiro: true,
    ajuda:
      "Quando uma usina nova é cadastrada, criamos a garantia automaticamente com essa duração a partir da data de cadastro. Pode ser ajustada por usina depois.",
    exemplo: "Em 60: garantia padrão de 5 anos.",
  },
  {
    nome: "retencao_leituras_dias",
    label: "Tempo de retenção de leituras",
    unidade: "dias",
    inteiro: true,
    ajuda:
      "Por quantos dias guardamos as leituras de cada usina e inversor. Leituras mais antigas são apagadas automaticamente todo dia. Alertas e histórico de garantia NÃO são afetados.",
    exemplo:
      "Em 365: você consegue ver gráfico de geração de até 1 ano atrás. Reduzir economiza espaço; aumentar permite análises de longo prazo.",
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
    <div className="tl-field">
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <label className="tl-field-label" htmlFor={meta.nome}>
          {meta.label}
          {meta.unidade ? (
            <span style={{ marginLeft: 4, textTransform: "none", color: "var(--tl-muted-fg)" }}>
              ({meta.unidade})
            </span>
          ) : null}
        </label>
        <button
          type="button"
          title={meta.ajuda}
          aria-label={`Ajuda: ${meta.label}`}
          style={{
            background: "transparent",
            border: 0,
            padding: 0,
            color: "var(--tl-muted-fg)",
            cursor: "help",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <InfoIcon className="size-3.5" />
        </button>
      </div>
      <input
        id={meta.nome}
        className={"tl-input" + (erro ? " invalid" : "")}
        type={tipoInput}
        step={meta.tempo ? undefined : meta.inteiro ? "1" : meta.step ?? "any"}
        readOnly={readOnly}
        disabled={readOnly}
        {...registerProps}
      />
      <p
        style={{
          fontSize: 10.5,
          color: "var(--tl-muted-fg)",
          margin: 0,
          lineHeight: 1.4,
        }}
      >
        {meta.ajuda}
      </p>
      {meta.exemplo && (
        <p
          style={{
            fontSize: 10.5,
            color: "var(--tl-muted-fg)",
            fontStyle: "italic",
            borderLeft: "2px solid var(--tl-line-soft)",
            paddingLeft: 8,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontWeight: 500, fontStyle: "normal", color: "var(--tl-fg)" }}>
            Exemplo:
          </span>{" "}
          {meta.exemplo}
        </p>
      )}
      {erro && (
        <p style={{ fontSize: 11, color: "var(--tl-crit)", margin: 0 }}>{erro}</p>
      )}
    </div>
  );
}

type SecaoIcon = ComponentType<{ className?: string; style?: React.CSSProperties }>;

function SecaoCard({
  titulo,
  descricao,
  campos,
  form,
  readOnly,
  Icon,
  iconColor,
  accentColor,
}: {
  titulo: string;
  descricao: string;
  campos: CampoMeta[];
  form: ReturnType<typeof useForm<FormValues>>;
  readOnly: boolean;
  Icon: SecaoIcon;
  iconColor: string;
  accentColor: string;
}) {
  return (
    <Card style={{ borderLeft: `3px solid ${accentColor}` }}>
      <CardHead>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: 1 }}>
          <Icon className="size-5" style={{ color: iconColor, flexShrink: 0, marginTop: 1 }} />
          <CardTitle sub={descricao}>{titulo}</CardTitle>
        </div>
      </CardHead>
      <div
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
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
      </div>
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
      <div className="tl-scr">
        <header className="tl-scr-head">
          <div>
            <div className="tl-crumb">Configurações <span>/</span> Empresa</div>
            <h1 style={{ margin: 0 }}>Carregando…</h1>
          </div>
        </header>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: 200,
              borderRadius: 14,
              background: "var(--tl-card-bg)",
              border: "1px solid var(--tl-card-bd)",
            }}
          />
        ))}
      </div>
    );
  }

  if (consulta.isError) {
    return (
      <div className="tl-scr">
        <header className="tl-scr-head">
          <div>
            <div className="tl-crumb">Configurações <span>/</span> Empresa</div>
            <h1 style={{ margin: 0 }}>Configurações da empresa</h1>
          </div>
        </header>
        <Card>
          <div style={{ padding: 18, color: "var(--tl-crit)", fontSize: 12.5 }}>
            Erro ao carregar configurações.
          </div>
        </Card>
      </div>
    );
  }

  const sujo = form.formState.isDirty;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="tl-scr">
      <header className="tl-scr-head" style={{ alignItems: "flex-end" }}>
        <div>
          <div className="tl-crumb">Configurações <span>/</span> Empresa</div>
          <h1 style={{ margin: 0 }}>Configurações da empresa</h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 12,
              color: "var(--tl-muted-fg)",
              maxWidth: 720,
              lineHeight: 1.5,
            }}
          >
            Parâmetros globais aplicados a todas as usinas e regras de alerta.
            {readOnly && " Apenas administradores podem editar."}
          </p>
        </div>
        {consulta.data?.updated_at && (
          <p
            style={{
              fontSize: 11,
              color: "var(--tl-muted-fg)",
              margin: 0,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            Última atualização:{" "}
            <strong style={{ color: "var(--tl-fg)", fontWeight: 500 }}>
              {new Date(consulta.data.updated_at).toLocaleString("pt-BR")}
            </strong>
          </p>
        )}
      </header>

      <SecaoCard
        titulo="Limites técnicos dos alertas"
        descricao="Thresholds aplicados pelo motor a cada coleta para decidir quando abrir alerta."
        campos={CAMPOS_LIMITES}
        form={form}
        readOnly={readOnly}
        Icon={ThermometerIcon}
        iconColor="oklch(0.75 0.18 35)"
        accentColor="oklch(0.65 0.18 35)"
      />

      <SecaoCard
        titulo="Janelas de tempo dos alertas"
        descricao="Quanto tempo esperar antes de abrir ou escalonar cada tipo de alerta."
        campos={CAMPOS_TEMPO}
        form={form}
        readOnly={readOnly}
        Icon={ClockIcon}
        iconColor="oklch(0.7 0.14 240)"
        accentColor="oklch(0.6 0.14 240)"
      />

      <SecaoCard
        titulo="Horário solar (padrão)"
        descricao="Janela em que esperamos geração. Aplica-se a usinas sem latitude/longitude cadastradas; com coordenadas, o sistema calcula nascer/pôr do sol automaticamente."
        campos={CAMPOS_HORARIO}
        form={form}
        readOnly={readOnly}
        Icon={SunIcon}
        iconColor="oklch(0.82 0.17 75)"
        accentColor="oklch(0.72 0.17 75)"
      />

      <SecaoCard
        titulo="Garantia e retenção"
        descricao="Padrões usados ao cadastrar usinas novas e quanto tempo guardamos o histórico de leituras."
        campos={CAMPOS_GARANTIA}
        form={form}
        readOnly={readOnly}
        Icon={ShieldCheckIcon}
        iconColor="oklch(0.72 0.16 150)"
        accentColor="oklch(0.6 0.16 150)"
      />

      {!readOnly && (
        <div className="tl-form-actions" style={{ justifyContent: "flex-end" }}>
          <button
            type="button"
            className="tl-btn ghost"
            onClick={onCancel}
            disabled={!sujo || mutate.isPending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="tl-btn-primary"
            disabled={!sujo || mutate.isPending}
          >
            {mutate.isPending ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <SaveIcon className="size-3.5" />
            )}
            Salvar alterações
          </button>
        </div>
      )}
    </form>
  );
}
