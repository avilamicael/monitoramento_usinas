import {
  AppLink,
  Callout,
  DocsArticle,
  DocsHeader,
  DocsList,
  DocsParagraph,
  DocsSection,
} from "@/components/docs/DocsContent";
import { Pill, type PillTone } from "@/components/trylab/primitives";

type Severidade = "info" | "aviso" | "critico";

const SEV_TONE: Record<Severidade, PillTone> = {
  info: "ghost",
  aviso: "warn",
  critico: "crit",
};

function SevBadge({ sev }: { sev: Severidade }) {
  const labels: Record<Severidade, string> = {
    info: "Info",
    aviso: "Aviso",
    critico: "Crítico",
  };
  return <Pill tone={SEV_TONE[sev]}>{labels[sev]}</Pill>;
}

interface RegraDetalhe {
  nome: string;
  escopo: "Usina" | "Inversor";
  severidadeBase: Severidade;
  severidadeMaxima?: Severidade;
  dispara: string;
  comoInterpretar: string;
  acaoSugerida: string;
  ondeAjustar: React.ReactNode;
  /** Conteúdo extra opcional renderizado abaixo do bloco "Onde ajustar". */
  nota?: React.ReactNode;
  /** Cálculo detalhado da regra, opcional. */
  calculo?: React.ReactNode;
}

const REGRAS: RegraDetalhe[] = [
  {
    nome: "Sobretensão AC",
    escopo: "Inversor",
    severidadeBase: "info",
    severidadeMaxima: "aviso",
    dispara:
      "A tensão AC reportada pelo inversor passou de aproximadamente 110 % do nominal (ex.: 242 V em uma rede 220 V).",
    comoInterpretar:
      "Pode ser problema na rede da concessionária, fiação local com mau dimensionamento ou inversor antigo desviado. Quando todos os inversores da usina estão sob a mesma sobretensão, é provavelmente a rede.",
    acaoSugerida:
      "Cheque com o cliente se houve queda ou pico no bairro. Se for recorrente apenas em uma usina, vale uma vistoria elétrica.",
    ondeAjustar: (
      <>
        Limite na própria usina (campo <em>tensão limite</em>) ou pelo
        nominal cadastrado em{" "}
        <AppLink to="/usinas">Usinas</AppLink>.
      </>
    ),
  },
  {
    nome: "Subtensão AC",
    escopo: "Inversor",
    severidadeBase: "info",
    severidadeMaxima: "aviso",
    dispara:
      "A tensão AC do inversor caiu abaixo de aproximadamente 91 % do nominal.",
    comoInterpretar:
      "Geralmente subtensão em horário de pico de consumo no bairro. Em situações graves o inversor desliga sozinho para se proteger — vai cair em 'inversor offline' também.",
    acaoSugerida:
      "Se for raro, ignorar. Se for recorrente, conversar com o cliente sobre a qualidade da rede da concessionária.",
    ondeAjustar: (
      <>
        Limite mínimo na usina ou pelo nominal cadastrado em{" "}
        <AppLink to="/usinas">Usinas</AppLink>.
      </>
    ),
  },
  {
    nome: "Frequência fora da faixa",
    escopo: "Inversor",
    severidadeBase: "aviso",
    severidadeMaxima: "critico",
    dispara: "A frequência da rede saiu da faixa 59,5–60,5 Hz.",
    comoInterpretar:
      "É raro e quase sempre indica problema sério na rede ou no inversor. Quando todos os inversores reportam ao mesmo tempo, é a rede.",
    acaoSugerida:
      "Avise o cliente. Se persistir e estiver localizado em uma usina só, abra chamado com a assistência do fabricante.",
    ondeAjustar: (
      <>
        Frequência mín./máx. cadastrada na{" "}
        <AppLink to="/usinas">usina</AppLink>.
      </>
    ),
  },
  {
    nome: "Temperatura alta",
    escopo: "Inversor",
    severidadeBase: "info",
    severidadeMaxima: "aviso",
    dispara:
      "Inversor operando acima do limite térmico (75 °C por padrão).",
    comoInterpretar:
      "Pode ser ventilação obstruída, exposição direta ao sol ou inversor próximo do fim da vida útil.",
    acaoSugerida:
      "Vistoria local: limpar gabinete, conferir ventiladores, sombreamento. Se inversor estiver com vários alertas térmicos por mês, considerar manutenção/substituição.",
    ondeAjustar: (
      <>
        Valor específico no próprio inversor, na usina ou em{" "}
        <AppLink to="/configuracoes">Configurações da empresa</AppLink>.
      </>
    ),
  },
  {
    nome: "Inversor offline",
    escopo: "Inversor",
    severidadeBase: "aviso",
    severidadeMaxima: "critico",
    dispara:
      "Inversor reportou estado offline em 3 coletas consecutivas (configurável). Se todos os inversores da usina estão offline, escala para crítico.",
    comoInterpretar:
      "Inversor desligado, sem comunicação local ou problema de alimentação. Quando é a usina inteira, normalmente é falta de energia geral.",
    acaoSugerida:
      "Em uma usina pequena, vale uma ligação para o cliente confirmar se há energia no local.",
    ondeAjustar: (
      <>
        Coletas mínimas em{" "}
        <AppLink to="/configuracoes">Configurações da empresa</AppLink>.
      </>
    ),
  },
  {
    nome: "String MPPT zerada",
    escopo: "Inversor",
    severidadeBase: "aviso",
    severidadeMaxima: "critico",
    dispara:
      "Uma das strings está em 0 enquanto as outras estão gerando.",
    comoInterpretar:
      "Indica problema localizado: cabo rompido, conector queimado, módulo inteiro fora ou disjuntor de string aberto. Quando todas as strings estão zeradas, escala para crítico.",
    acaoSugerida:
      "Agendar visita no local para identificar o trecho afetado. Em casos de string única zerada, normalmente é um único módulo ou conector.",
    ondeAjustar: "Comportamento fixo — não aceita limite customizado.",
  },
  {
    nome: "Dado elétrico ausente",
    escopo: "Inversor",
    severidadeBase: "aviso",
    dispara:
      "O provedor parou de devolver tensão, frequência ou temperatura por 10 coletas seguidas (configurável).",
    comoInterpretar:
      "Pode ser firmware do inversor instável, perda de alguns sensores ou bug do provedor. Não significa que o inversor parou de gerar — significa que parte da telemetria sumiu.",
    acaoSugerida:
      "Cheque se o inversor reporta tudo normal localmente. Se sim, é provavelmente o provedor — abra chamado com o fabricante.",
    ondeAjustar: (
      <>
        Coletas mínimas em{" "}
        <AppLink to="/configuracoes">Configurações da empresa</AppLink>.
      </>
    ),
  },
  {
    nome: "Sem comunicação",
    escopo: "Usina",
    severidadeBase: "aviso",
    severidadeMaxima: "critico",
    dispara:
      "A usina não envia leitura nova há 24 h por padrão. Se passar de 2× esse tempo (48 h), escala para crítico.",
    comoInterpretar:
      "Datalogger sem internet, queda de energia prolongada ou conta do provedor com problema. É o alerta mais comum em ambiente real.",
    acaoSugerida:
      "Confirmar com o cliente se há energia/internet no local. Se passar de 24 h em zona com queda recorrente, considerar instalação de chip 4G no datalogger.",
    ondeAjustar: (
      <>
        Tempo em minutos em{" "}
        <AppLink to="/configuracoes">Configurações da empresa</AppLink>.
      </>
    ),
  },
  {
    nome: "Sem geração em horário solar",
    escopo: "Usina",
    severidadeBase: "critico",
    dispara:
      "A usina ficou em potência zero dentro da janela solar e a leitura imediatamente anterior estava acima de 5 % da capacidade instalada.",
    comoInterpretar:
      "Algo derrubou a usina no meio do dia: disjuntor geral aberto, queda de energia da concessionária, falha em todos os inversores ao mesmo tempo.",
    acaoSugerida:
      "Ligar para o cliente imediatamente. Se confirmado problema técnico, agendar atendimento.",
    ondeAjustar: (
      <>
        Janela de horário solar e percentual de queda abrupta em{" "}
        <AppLink to="/configuracoes">Configurações da empresa</AppLink>.
        Coordenadas (latitude/longitude) cadastradas na{" "}
        <AppLink to="/usinas">usina</AppLink>, quando disponíveis, fazem o
        sistema usar incidência solar real em vez da janela fixa.
      </>
    ),
    calculo: (
      <ol className="flex flex-col gap-1.5 pl-5 list-decimal">
        <li>
          A coleta atual chegou e o sistema confirma que a hora local da
          usina está dentro da <em>janela solar</em>. Por padrão é
          08:00–18:00, configurável por empresa. Se a usina tiver
          coordenadas cadastradas, a janela é calculada com base na
          incidência solar real do local (substitui o intervalo fixo).
        </li>
        <li>
          Se a potência atual da usina é praticamente zero, o sistema olha
          a leitura imediatamente anterior do mesmo dia.
        </li>
        <li>
          Se essa leitura anterior estava <strong>acima</strong> de 5 % da
          capacidade instalada (configurável), houve queda abrupta — abre
          alerta crítico.
        </li>
        <li>
          Se a leitura anterior já estava abaixo desse percentual, é a
          curva natural de início de manhã ou fim de tarde — a regra não
          dispara.
        </li>
      </ol>
    ),
  },
  {
    nome: "Subdesempenho",
    escopo: "Usina",
    severidadeBase: "info",
    dispara:
      "Geração entre 10 h e 15 h ficou abaixo de 15 % da capacidade instalada da usina (regra desativada por padrão).",
    comoInterpretar:
      "Sujeira nos módulos, sombreamento permanente ou falha parcial de strings. É uma leitura de tendência, não exige resposta imediata.",
    acaoSugerida:
      "Para uso operacional contínuo prefira a regra Queda de rendimento, que compara cada usina com o histórico dela mesma (mais confiável).",
    ondeAjustar: (
      <>
        Percentual em{" "}
        <AppLink to="/configuracoes">Configurações da empresa</AppLink>.
        A regra está desativada por padrão; ative em{" "}
        <AppLink to="/configuracao/regras">Regras de alertas</AppLink>.
      </>
    ),
    nota: (
      <Callout tipo="aviso" titulo="Em revisão — virará relatório na v2">
        <p>
          Estamos repensando o Subdesempenho. Em uma próxima versão ele
          deixa de ser alerta e vira um <strong>relatório</strong>{" "}
          consolidado de tendência das usinas, separado dos alertas
          operacionais. A regra Queda de rendimento continua como alerta.
        </p>
      </Callout>
    ),
  },
  {
    nome: "Queda de rendimento",
    escopo: "Usina",
    severidadeBase: "info",
    dispara:
      "Geração diária ficou abaixo de 60 % da média dos últimos 7 dias daquela usina.",
    comoInterpretar:
      "Compara a usina com ela mesma — descarta variação climática regional e detecta degradação real, sujeira ou perda de módulo. É a versão operacional do Subdesempenho.",
    acaoSugerida:
      "Se persistir por 2–3 dias, agendar limpeza dos módulos ou inspeção visual.",
    ondeAjustar: (
      <>
        Percentual em{" "}
        <AppLink to="/configuracoes">Configurações da empresa</AppLink>.
      </>
    ),
  },
  {
    nome: "Garantia vencendo",
    escopo: "Usina",
    severidadeBase: "info",
    severidadeMaxima: "aviso",
    dispara:
      "30 dias antes do fim da garantia (info) e 7 dias antes (aviso). Datas configuráveis.",
    comoInterpretar:
      "Aviso administrativo: a janela de cobertura está acabando.",
    acaoSugerida:
      "Renegociar contrato com o cliente, oferecer garantia estendida ou agendar revisão antes do fim do período.",
    ondeAjustar: (
      <>
        Dias de aviso e crítico em{" "}
        <AppLink to="/configuracoes">Configurações → Garantia</AppLink>.
        Lista de garantias com vencimento em{" "}
        <AppLink to="/garantias">Garantias</AppLink>.
      </>
    ),
    nota: (
      <Callout tipo="info" titulo="Garantia liga o monitoramento da usina">
        <p>
          Lembre que a garantia ativa é a <strong>chave</strong> para o
          sistema gerar qualquer alerta — não só este. Usina sem garantia
          continua tendo os dados coletados, mas não dispara nenhuma
          regra. Para parar a coleta de uma usina específica, vá em{" "}
          <AppLink to="/usinas">Usinas</AppLink> e pause-a.
        </p>
      </Callout>
    ),
  },
];

function CardRegra({ regra }: { regra: RegraDetalhe }) {
  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ fontSize: 13.5, lineHeight: 1.65 }}>
      <span style={{ fontWeight: 500, color: "var(--tl-fg)" }}>{label}: </span>
      <span style={{ color: "var(--tl-muted-fg)" }}>{value}</span>
    </div>
  );
  return (
    <div className="tl-card">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <strong style={{ fontSize: 14, fontWeight: 600, color: "var(--tl-fg)" }}>
          {regra.nome}
        </strong>
        <Pill tone="ghost">{regra.escopo}</Pill>
        <SevBadge sev={regra.severidadeBase} />
        {regra.severidadeMaxima && (
          <>
            <span style={{ fontSize: 11, color: "var(--tl-muted-fg)" }}>→</span>
            <SevBadge sev={regra.severidadeMaxima} />
          </>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Row label="Quando dispara" value={regra.dispara} />
        <Row label="Como interpretar" value={regra.comoInterpretar} />
        <Row label="Ação sugerida" value={regra.acaoSugerida} />
        <Row label="Onde ajustar" value={regra.ondeAjustar} />
        {regra.calculo && (
          <div style={{ fontSize: 13.5, lineHeight: 1.65 }}>
            <span style={{ fontWeight: 500, color: "var(--tl-fg)" }}>
              Como o cálculo é feito:
            </span>
            <div style={{ marginTop: 4, color: "var(--tl-muted-fg)" }}>
              {regra.calculo}
            </div>
          </div>
        )}
        {regra.nota && (
          <div style={{ fontSize: 13, color: "var(--tl-muted-fg)" }}>{regra.nota}</div>
        )}
      </div>
    </div>
  );
}

export default function DocsRegrasPage() {
  return (
    <DocsArticle>
      <DocsHeader
        titulo="Regras de alertas"
        descricao="As regras automáticas que o sistema avalia em cada coleta. Cada cartão explica quando dispara, como interpretar e o que fazer."
      />

      <DocsSection titulo="Como ler esta página">
        <DocsParagraph>
          Cada regra mostra dois badges de severidade quando aplicável: a{" "}
          <strong>severidade base</strong> (com a qual o alerta é aberto) e a{" "}
          <strong>severidade máxima</strong> para a qual escala
          automaticamente conforme a gravidade aumenta. Regras com escala
          dinâmica não permitem que o admin altere manualmente a
          severidade — só ativar/desativar em{" "}
          <AppLink to="/configuracao/regras">Regras de alertas</AppLink>.
        </DocsParagraph>
        <Callout tipo="info" titulo="Ativar e desativar regras">
          <p>
            Em <AppLink to="/configuracao/regras">Regras de alertas</AppLink>{" "}
            você liga/desliga cada regra e ajusta a severidade padrão da
            empresa. Alertas abertos de regras desativadas{" "}
            <strong>não fecham automaticamente</strong> — ficam marcados
            visualmente e o operador resolve manualmente. Isso evita perder
            histórico.
          </p>
        </Callout>
      </DocsSection>

      <DocsSection titulo="Hierarquia dos limites">
        <DocsParagraph>
          Vários campos (tensão, temperatura, frequência mín./máx.)
          aceitam um valor específico por equipamento. A ordem de busca é:
        </DocsParagraph>
        <DocsList ordered>
          <li>Valor cadastrado no próprio inversor.</li>
          <li>
            Valor cadastrado na <AppLink to="/usinas">usina</AppLink>.
          </li>
          <li>
            Valor das{" "}
            <AppLink to="/configuracoes">Configurações da empresa</AppLink>.
          </li>
          <li>Valor padrão do sistema.</li>
        </DocsList>
        <DocsParagraph>
          Use isso para um limite global da empresa e exceções pontuais
          por equipamento, sem replicar configuração.
        </DocsParagraph>
      </DocsSection>

      <DocsSection titulo="Regras elétricas (por inversor)">
        <DocsParagraph>
          Regras que avaliam tensão, frequência e temperatura. Só rodam
          quando o inversor está realmente gerando — em standby, leituras de
          tensão e frequência podem vir zeradas e isso{" "}
          <strong>não significa anomalia</strong>.
        </DocsParagraph>
        <div className="flex flex-col gap-3">
          {REGRAS.filter((r) => r.escopo === "Inversor")
            .slice(0, 4)
            .map((r) => (
              <CardRegra key={r.nome} regra={r} />
            ))}
        </div>
      </DocsSection>

      <DocsSection titulo="Regras operacionais (inversor)">
        <DocsParagraph>
          Regras que olham presença, comunicação e integridade do inversor.
        </DocsParagraph>
        <div className="flex flex-col gap-3">
          {REGRAS.filter(
            (r) =>
              r.escopo === "Inversor" &&
              ["Inversor offline", "String MPPT zerada", "Dado elétrico ausente"].includes(
                r.nome,
              ),
          ).map((r) => (
            <CardRegra key={r.nome} regra={r} />
          ))}
        </div>
      </DocsSection>

      <DocsSection titulo="Regras por usina">
        <DocsParagraph>
          Regras que olham a usina como um todo: produção, comunicação e
          ciclo de vida.
        </DocsParagraph>
        <div className="flex flex-col gap-3">
          {REGRAS.filter((r) => r.escopo === "Usina").map((r) => (
            <CardRegra key={r.nome} regra={r} />
          ))}
        </div>
      </DocsSection>

      <Callout tipo="dica" titulo="Comece sem mexer em nada">
        <p>
          Os padrões foram calibrados para evitar ruído. Deixe rodar uma
          semana e identifique quais regras estão muito sensíveis para a
          sua operação. Para essas, prefira <strong>rebaixar a
          severidade</strong> em{" "}
          <AppLink to="/configuracao/regras">Regras de alertas</AppLink> ou{" "}
          <strong>aumentar o limite</strong> em{" "}
          <AppLink to="/configuracoes">Configurações</AppLink>. Não é
          preciso configurar nada para começar a operar.
        </p>
      </Callout>
    </DocsArticle>
  );
}
