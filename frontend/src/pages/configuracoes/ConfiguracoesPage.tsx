import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import {
  useAtualizarConfiguracao,
  useConfiguracao,
} from "@/features/configuracao/api";
import type { ConfiguracaoEmpresa } from "@/lib/types";

interface CampoConfig {
  campo: keyof ConfiguracaoEmpresa;
  label: string;
  descricao: string;
  tipo?: "number" | "decimal" | "time";
  sufixo?: string;
}

// Espelha help_text dos campos em backend/apps/core/models.py.
const CAMPOS_GARANTIA: CampoConfig[] = [
  { campo: "garantia_padrao_meses", label: "Garantia padrão (meses)", descricao: "Meses de garantia ao cadastrar uma usina nova.", tipo: "number" },
  { campo: "garantia_aviso_dias", label: "Aviso de garantia (dias)", descricao: "Dias antes do fim da garantia para abrir alerta info.", tipo: "number" },
  { campo: "garantia_critico_dias", label: "Garantia crítica (dias)", descricao: "Dias antes do fim para escalar para aviso.", tipo: "number" },
];

const CAMPOS_HORARIO_SOLAR: CampoConfig[] = [
  { campo: "horario_solar_inicio", label: "Início do horário solar", descricao: "Hora local da usina a partir da qual ela deve estar gerando.", tipo: "time" },
  { campo: "horario_solar_fim", label: "Fim do horário solar", descricao: "Hora limite até a qual a usina deve estar gerando.", tipo: "time" },
];

const CAMPOS_REGRAS: CampoConfig[] = [
  { campo: "alerta_sem_comunicacao_minutos", label: "Sem comunicação (minutos)", descricao: "Minutos sem `medido_em` antes de abrir alerta. Escala para crítico em 2× esse valor.", tipo: "number", sufixo: "min" },
  { campo: "alerta_dado_ausente_coletas", label: "Dado elétrico ausente (coletas)", descricao: "Coletas consecutivas com campo elétrico null antes de abrir `dado_eletrico_ausente`.", tipo: "number" },
  { campo: "subdesempenho_limite_pct", label: "Subdesempenho — limite (%)", descricao: "Abaixo desse % da capacidade instalada, abre `subdesempenho` (entre 10–15h locais).", tipo: "decimal", sufixo: "%" },
  { campo: "queda_rendimento_pct", label: "Queda de rendimento (%)", descricao: "Abaixo desse % da média dos últimos 7 dias, abre `queda_rendimento` (task diária).", tipo: "decimal", sufixo: "%" },
  { campo: "temperatura_limite_c", label: "Temperatura padrão (°C)", descricao: "Limite de temperatura usado quando o inversor não define o seu (regra `temperatura_alta`).", tipo: "decimal", sufixo: "°C" },
  { campo: "potencia_minima_avaliacao_kw", label: "Potência mínima para avaliar (kW)", descricao: "Abaixo disso o inversor está em standby — não avalia `frequencia_anomala` nem `subtensao_ac`.", tipo: "decimal", sufixo: "kW" },
  { campo: "inversor_offline_coletas_minimas", label: "Inversor offline (coletas)", descricao: "Coletas consecutivas em offline antes de abrir `inversor_offline`.", tipo: "number" },
  { campo: "sem_geracao_queda_abrupta_pct", label: "Queda abrupta (% capacidade)", descricao: "Em `sem_geracao_horario_solar`: se anterior > esse % da capacidade e agora é zero, é queda abrupta. Senão é curva natural.", tipo: "decimal", sufixo: "%" },
];

const CAMPOS_RETENCAO: CampoConfig[] = [
  { campo: "retencao_leituras_dias", label: "Retenção de leituras (dias)", descricao: "Leituras mais antigas que isso são apagadas pela task diária. Alertas não são afetados.", tipo: "number" },
];

function CampoFormulario({
  campo, valor, onChange,
}: {
  campo: CampoConfig;
  valor: string | number;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={campo.campo}>{campo.label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={campo.campo}
          type={campo.tipo === "time" ? "time" : "number"}
          step={campo.tipo === "decimal" ? "0.01" : "1"}
          value={valor as string | number}
          onChange={(e) => onChange(e.target.value)}
          className="max-w-[200px]"
        />
        {campo.sufixo && <span className="text-sm text-muted-foreground">{campo.sufixo}</span>}
      </div>
      <p className="text-xs text-muted-foreground">{campo.descricao}</p>
    </div>
  );
}

function SecaoConfig({
  titulo, descricao, campos, valores, onChange,
}: {
  titulo: string;
  descricao: string;
  campos: CampoConfig[];
  valores: Partial<ConfiguracaoEmpresa>;
  onChange: (campo: keyof ConfiguracaoEmpresa, valor: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {campos.map((c) => (
          <CampoFormulario
            key={c.campo}
            campo={c}
            valor={(valores[c.campo] as string | number) ?? ""}
            onChange={(v) => onChange(c.campo, v)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export default function ConfiguracoesPage() {
  const config = useConfiguracao();
  const atualizar = useAtualizarConfiguracao();
  const [edicao, setEdicao] = useState<Partial<ConfiguracaoEmpresa>>({});

  useEffect(() => {
    if (config.data) setEdicao(config.data);
  }, [config.data]);

  function handleChange(campo: keyof ConfiguracaoEmpresa, valor: string) {
    setEdicao((atual) => ({ ...atual, [campo]: valor }));
  }

  async function handleSalvar() {
    if (!config.data) return;
    try {
      await atualizar.mutateAsync({ id: config.data.id, dados: edicao });
      toast.success("Configurações salvas.");
    } catch {
      toast.error("Falha ao salvar.");
    }
  }

  if (config.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!config.data) {
    return <p className="text-sm text-muted-foreground">Configuração não encontrada.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Configurações"
        subtitulo="Thresholds globais da empresa. Cada usina pode sobrescrever valores específicos."
        acoes={
          <Button onClick={handleSalvar} disabled={atualizar.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {atualizar.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        }
      />

      <Tabs defaultValue="regras">
        <TabsList>
          <TabsTrigger value="regras">Regras de alerta</TabsTrigger>
          <TabsTrigger value="horario">Horário solar</TabsTrigger>
          <TabsTrigger value="garantia">Garantia</TabsTrigger>
          <TabsTrigger value="retencao">Retenção</TabsTrigger>
        </TabsList>

        <TabsContent value="regras" className="space-y-4">
          <SecaoConfig
            titulo="Regras de alerta"
            descricao="Thresholds usados pelo motor de alertas. Mudanças aqui afetam todas as usinas que não sobrescrevem o valor próprio."
            campos={CAMPOS_REGRAS}
            valores={edicao}
            onChange={handleChange}
          />
        </TabsContent>

        <TabsContent value="horario" className="space-y-4">
          <SecaoConfig
            titulo="Horário solar"
            descricao="Janela em que a usina deve estar gerando. Usado pela regra `sem_geracao_horario_solar` e por outras regras de borda do dia."
            campos={CAMPOS_HORARIO_SOLAR}
            valores={edicao}
            onChange={handleChange}
          />
        </TabsContent>

        <TabsContent value="garantia" className="space-y-4">
          <SecaoConfig
            titulo="Garantia"
            descricao="Defaults para criação automática de garantia ao adicionar uma usina nova, e thresholds da regra `garantia_vencendo`."
            campos={CAMPOS_GARANTIA}
            valores={edicao}
            onChange={handleChange}
          />
        </TabsContent>

        <TabsContent value="retencao" className="space-y-4">
          <SecaoConfig
            titulo="Retenção de leituras"
            descricao="Após esse prazo, a task diária remove as leituras antigas. Alertas e logs de coleta não são afetados."
            campos={CAMPOS_RETENCAO}
            valores={edicao}
            onChange={handleChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
