import {
  Callout,
  DocsArticle,
  DocsHeader,
  DocsList,
  DocsParagraph,
  DocsSection,
} from "@/components/docs/DocsContent";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Severidade = "info" | "aviso" | "critico";

const CORES_SEVERIDADE: Record<Severidade, string> = {
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  aviso: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
  critico: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

function SevBadge({ sev }: { sev: Severidade }) {
  const labels: Record<Severidade, string> = {
    info: "Info",
    aviso: "Aviso",
    critico: "Crítico",
  };
  return (
    <Badge variant="outline" className={CORES_SEVERIDADE[sev]}>
      {labels[sev]}
    </Badge>
  );
}

interface Regra {
  nome: string;
  escopo: "Usina" | "Inversor";
  oque: string;
  quando: string;
  sev: Severidade;
  ondeAjustar: string;
}

const REGRAS_ELETRICAS: Regra[] = [
  {
    nome: "Sobretensão AC",
    escopo: "Inversor",
    oque: "A tensão AC do inversor passou do limite superior.",
    quando: "Tensão acima de ~110 % do nominal (ex.: 242 V em 220 V).",
    sev: "info",
    ondeAjustar: "Tensão limite na usina ou rede nominal.",
  },
  {
    nome: "Subtensão AC",
    escopo: "Inversor",
    oque: "A tensão AC do inversor caiu abaixo do mínimo.",
    quando: "Tensão abaixo de ~91 % do nominal (ex.: 200 V em 220 V).",
    sev: "info",
    ondeAjustar: "Tensão mínima na usina ou rede nominal.",
  },
  {
    nome: "Frequência fora da faixa",
    escopo: "Inversor",
    oque: "A frequência da rede saiu da faixa esperada.",
    quando: "Fora de 59,5–60,5 Hz.",
    sev: "aviso",
    ondeAjustar: "Frequência mín./máx. da usina.",
  },
  {
    nome: "Temperatura alta",
    escopo: "Inversor",
    oque: "Inversor operando acima do limite térmico.",
    quando: "Temperatura ≥ 75 °C (default).",
    sev: "info",
    ondeAjustar: "Limite no inversor ou em Configurações.",
  },
];

const REGRAS_OPERACIONAIS: Regra[] = [
  {
    nome: "Inversor offline",
    escopo: "Inversor",
    oque: "Inversor reportou estado offline em coletas consecutivas.",
    quando: "3 coletas seguidas em offline (default).",
    sev: "aviso",
    ondeAjustar: "Configurações → coletas mínimas.",
  },
  {
    nome: "String MPPT zerada",
    escopo: "Inversor",
    oque: "Uma das strings está em 0 enquanto as outras geram.",
    quando: "Em qualquer ciclo com produção parcial.",
    sev: "aviso",
    ondeAjustar: "Comportamento fixo da regra.",
  },
  {
    nome: "Dado elétrico ausente",
    escopo: "Inversor",
    oque: "O provedor parou de devolver tensão/frequência/temperatura.",
    quando: "10 coletas seguidas com campo nulo (default).",
    sev: "aviso",
    ondeAjustar: "Configurações → coletas para dado ausente.",
  },
  {
    nome: "Sem comunicação",
    escopo: "Usina",
    oque: "A usina não envia leitura nova há um tempo.",
    quando: "24 h sem nova leitura (default).",
    sev: "aviso",
    ondeAjustar: "Configurações → minutos sem comunicação.",
  },
  {
    nome: "Sem geração em horário solar",
    escopo: "Usina",
    oque: "A usina parou de gerar dentro da janela solar.",
    quando: "Potência ≈ 0 com queda abrupta entre 08:00 e 18:00.",
    sev: "critico",
    ondeAjustar: "Janela solar nas Configurações.",
  },
  {
    nome: "Subdesempenho",
    escopo: "Usina",
    oque: "Usina gerando muito abaixo da capacidade no pico do dia.",
    quando: "< 15 % da capacidade entre 10–15 h.",
    sev: "info",
    ondeAjustar: "Configurações → limite de subdesempenho.",
  },
  {
    nome: "Queda de rendimento",
    escopo: "Usina",
    oque: "Geração caiu em relação à média recente da própria usina.",
    quando: "< 60 % da média dos últimos 7 dias.",
    sev: "info",
    ondeAjustar: "Configurações → percentual de queda.",
  },
  {
    nome: "Garantia vencendo",
    escopo: "Usina",
    oque: "A garantia de uma usina está chegando ao fim.",
    quando: "30 dias antes (info), 7 dias antes (aviso).",
    sev: "info",
    ondeAjustar: "Configurações → dias de aviso/crítico.",
  },
];

function TabelaRegras({ regras }: { regras: Regra[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Regra</TableHead>
            <TableHead className="w-[90px]">Escopo</TableHead>
            <TableHead>O que detecta</TableHead>
            <TableHead>Quando dispara</TableHead>
            <TableHead className="w-[110px]">Severidade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {regras.map((r) => (
            <TableRow key={r.nome}>
              <TableCell className="font-medium">{r.nome}</TableCell>
              <TableCell>{r.escopo}</TableCell>
              <TableCell className="text-muted-foreground">{r.oque}</TableCell>
              <TableCell className="text-muted-foreground">{r.quando}</TableCell>
              <TableCell>
                <SevBadge sev={r.sev} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function DocsRegrasPage() {
  return (
    <DocsArticle>
      <DocsHeader
        titulo="Regras de alertas"
        descricao="As regras automáticas que o sistema avalia em cada coleta, com defaults e onde ajustar."
      />

      <DocsSection titulo="Como ler esta página">
        <DocsParagraph>
          A coluna <strong>Severidade</strong> mostra o valor padrão. Algumas
          regras escalam sozinhas conforme a gravidade aumenta (por exemplo,
          "sem comunicação" vira <SevBadge sev="critico" /> quando passa de 2× o
          tempo configurado). A coluna <strong>Onde ajustar</strong> diz onde
          mudar o threshold — por usina, por inversor ou nas Configurações da
          empresa.
        </DocsParagraph>
        <Callout tipo="info" titulo="Ativar e desativar regras">
          <p>
            Em <em>Gestão → Regras de alertas</em> você liga/desliga cada
            regra e ajusta a severidade default da sua empresa. Regras com{" "}
            <em>severidade dinâmica</em> (escalam sozinhas) não permitem
            mudança manual de severidade — apenas ativar/desativar.
          </p>
        </Callout>
      </DocsSection>

      <DocsSection titulo="Regras elétricas (por inversor)">
        <DocsParagraph>
          Estas regras avaliam tensão, frequência e temperatura de cada
          inversor. Elas só rodam quando o inversor está realmente gerando —
          em standby, leituras de tensão e frequência podem vir zeradas e isso
          não significa anomalia.
        </DocsParagraph>
        <TabelaRegras regras={REGRAS_ELETRICAS} />
      </DocsSection>

      <DocsSection titulo="Regras operacionais">
        <DocsParagraph>
          Regras que olham produção, comunicação e ciclo de vida da usina.
        </DocsParagraph>
        <TabelaRegras regras={REGRAS_OPERACIONAIS} />
      </DocsSection>

      <DocsSection titulo="Hierarquia dos thresholds">
        <DocsParagraph>
          Algumas regras aceitam override por equipamento. A ordem de busca é:
        </DocsParagraph>
        <DocsList ordered>
          <li>Valor cadastrado no próprio inversor.</li>
          <li>Valor cadastrado na usina.</li>
          <li>Valor das Configurações da empresa.</li>
          <li>Valor padrão do sistema.</li>
        </DocsList>
        <DocsParagraph>
          Use isso para definir um threshold global da empresa e abrir
          exceções pontuais sem replicar configuração.
        </DocsParagraph>
      </DocsSection>

      <Callout tipo="dica" titulo="Comece sem mexer em nada">
        <p>
          Os defaults foram calibrados para evitar ruído. Deixe rodar uma
          semana, identifique quais regras estão gerando alarmes que você
          ignora, e só então ajuste threshold ou desative. Não é preciso
          configurar nada para começar a operar.
        </p>
      </Callout>
    </DocsArticle>
  );
}
