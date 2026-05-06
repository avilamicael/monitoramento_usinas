import {
  Callout,
  DocsArticle,
  DocsHeader,
  DocsParagraph,
  DocsSection,
} from "@/components/docs/DocsContent";

interface CampoConfig {
  nome: string;
  campo: string;
  valorPadrao: string;
  oque: string;
  quandoAjustar: string;
}

const GARANTIA: CampoConfig[] = [
  {
    nome: "Garantia padrão (meses)",
    campo: "garantia_padrao_meses",
    valorPadrao: "12",
    oque: "Quanto tempo de garantia uma usina recebe ao ser cadastrada.",
    quandoAjustar: "Mude se sua empresa trabalha com pacotes maiores (5 anos, 10 anos).",
  },
  {
    nome: "Aviso de garantia (dias)",
    campo: "garantia_aviso_dias",
    valorPadrao: "30",
    oque: "Quantos dias antes do fim da garantia o sistema abre alerta informativo.",
    quandoAjustar: "Aumente se você precisa de tempo maior para renegociar com o cliente.",
  },
  {
    nome: "Crítico de garantia (dias)",
    campo: "garantia_critico_dias",
    valorPadrao: "7",
    oque: "Dias antes do fim em que o alerta é escalado para nível aviso.",
    quandoAjustar: "Mantenha menor que o aviso. 7 dias funciona para a maioria.",
  },
];

const HORARIO_SOLAR: CampoConfig[] = [
  {
    nome: "Horário solar — início",
    campo: "horario_solar_inicio",
    valorPadrao: "08:00",
    oque: "A partir desta hora o sistema espera que a usina esteja gerando.",
    quandoAjustar: "Em regiões onde o sol nasce mais cedo ou tarde, ajuste para evitar falsos alertas no início do dia.",
  },
  {
    nome: "Horário solar — fim",
    campo: "horario_solar_fim",
    valorPadrao: "18:00",
    oque: "Hora limite até a qual a usina deve estar gerando.",
    quandoAjustar: "Idem ao início. Se trabalhar com fuso ou região muito específica, alinhe com o pôr do sol local.",
  },
];

const ALERTAS: CampoConfig[] = [
  {
    nome: "Tempo sem comunicação (minutos)",
    campo: "alerta_sem_comunicacao_minutos",
    valorPadrao: "1440 (24 h)",
    oque: "Tempo sem leitura nova antes de abrir alerta de sem comunicação.",
    quandoAjustar: "Reduza para 360–720 min se sua operação exige resposta no mesmo dia. Cuidado: muitos provedores cacheiam por horas.",
  },
  {
    nome: "Coletas para dado ausente",
    campo: "alerta_dado_ausente_coletas",
    valorPadrao: "10",
    oque: "Quantas coletas seguidas com campo nulo antes de abrir alerta.",
    quandoAjustar: "Aumente se o seu provedor é instável e oscila entre nulo e válido — evita ruído.",
  },
  {
    nome: "Limite de subdesempenho (%)",
    campo: "subdesempenho_limite_pct",
    valorPadrao: "15",
    oque: "Abaixo desse percentual da capacidade instalada, abre alerta entre 10–15 h.",
    quandoAjustar: "Mantenha 15 % para a maioria dos casos. Suba se a regra estiver gerando ruído em dias nublados.",
  },
  {
    nome: "Queda de rendimento (%)",
    campo: "queda_rendimento_pct",
    valorPadrao: "60",
    oque: "Compara a geração do dia com a média dos últimos 7 dias da própria usina.",
    quandoAjustar: "60 % é conservador. Reduza para 50 % se preferir só capturar quedas mais severas.",
  },
  {
    nome: "Limite de temperatura (°C)",
    campo: "temperatura_limite_c",
    valorPadrao: "75",
    oque: "Limite global. Inversores específicos podem sobrescrever.",
    quandoAjustar: "Cheque o datasheet do inversor antes de mudar. 75 °C cobre a maioria dos modelos.",
  },
  {
    nome: "Potência mínima para avaliar (kW)",
    campo: "potencia_minima_avaliacao_kw",
    valorPadrao: "0,5",
    oque: "Limiar abaixo do qual regras de tensão e frequência são puladas.",
    quandoAjustar: "Geralmente não precisa mudar. Aumente só se receber muito ruído de inversores acordando.",
  },
  {
    nome: "Coletas para inversor offline",
    campo: "inversor_offline_coletas_minimas",
    valorPadrao: "3",
    oque: "Quantas coletas seguidas em offline antes de abrir alerta.",
    quandoAjustar: "Diminua para 2 se quer ser avisado mais rápido. Aumente para 5 se inversores ligam/desligam em horários diferentes.",
  },
  {
    nome: "Queda abrupta (%)",
    campo: "sem_geracao_queda_abrupta_pct",
    valorPadrao: "5",
    oque: "Distingue parada real (queda abrupta) de fim de tarde natural.",
    quandoAjustar: "Raramente precisa mudar. Aumentar reduz alertas em transições suaves.",
  },
];

const RETENCAO: CampoConfig[] = [
  {
    nome: "Retenção de leituras (dias)",
    campo: "retencao_leituras_dias",
    valorPadrao: "90",
    oque: "Quantos dias de leituras manter no banco. Leituras antigas são apagadas todo dia às 03 h.",
    quandoAjustar: "Aumente se precisa comparação histórica longa. Diminua para reduzir custo de banco. Alertas não são afetados — eles ficam sempre.",
  },
];

function GrupoCampos({ campos }: { campos: CampoConfig[] }) {
  return (
    <div className="flex flex-col gap-3">
      {campos.map((c) => (
        <div key={c.campo} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="font-medium">{c.nome}</h3>
            <span className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {c.campo}
            </span>
            <span className="text-xs text-muted-foreground">
              padrão: <strong className="text-foreground">{c.valorPadrao}</strong>
            </span>
          </div>
          <p className="mt-2 text-sm text-foreground/90">{c.oque}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            <em>Quando ajustar:</em> {c.quandoAjustar}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function DocsConfiguracoesPage() {
  return (
    <DocsArticle>
      <DocsHeader
        titulo="Configurações da empresa"
        descricao="Os ajustes globais que valem para todas as usinas da sua empresa. Acesse em Configurações → Empresa."
      />

      <DocsSection titulo="Como funciona a herança de valores">
        <DocsParagraph>
          Cada campo aqui serve como o valor padrão da empresa. Várias regras
          aceitam override por inversor ou por usina — e quando existir um
          override, ele vence. Os defaults globais cobrem 90 % dos casos. Só
          ajuste pontualmente quando uma usina ou inversor específico precisar
          de algo diferente.
        </DocsParagraph>
        <Callout tipo="dica" titulo="Antes de mudar uma configuração">
          <p>
            Os defaults foram calibrados para minimizar ruído. Se você está
            recebendo muitos alertas de uma regra específica, considere
            primeiro desativá-la em <em>Regras de alertas</em> e só depois
            mexer no threshold global.
          </p>
        </Callout>
      </DocsSection>

      <DocsSection titulo="Garantia">
        <GrupoCampos campos={GARANTIA} />
      </DocsSection>

      <DocsSection titulo="Janela de horário solar">
        <DocsParagraph>
          Define quando a usina deve estar gerando. Regras como{" "}
          <em>sem geração em horário solar</em> usam essa janela para não
          disparar à noite ou no nascer do sol.
        </DocsParagraph>
        <GrupoCampos campos={HORARIO_SOLAR} />
      </DocsSection>

      <DocsSection titulo="Thresholds de alertas">
        <GrupoCampos campos={ALERTAS} />
      </DocsSection>

      <DocsSection titulo="Retenção de dados">
        <GrupoCampos campos={RETENCAO} />
      </DocsSection>
    </DocsArticle>
  );
}
