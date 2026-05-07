import {
  AppLink,
  Callout,
  DocsArticle,
  DocsHeader,
  DocsParagraph,
  DocsSection,
} from "@/components/docs/DocsContent";

interface CampoConfig {
  nome: string;
  valorPadrao: string;
  oque: string;
  quandoAjustar: string;
}

const GARANTIA: CampoConfig[] = [
  {
    nome: "Garantia padrão",
    valorPadrao: "12 meses",
    oque: "Quanto tempo de garantia uma usina recebe automaticamente ao ser cadastrada. Esse valor pode ser ajustado depois usina por usina.",
    quandoAjustar:
      "Mude se sua empresa trabalha com pacotes maiores (5 anos, 10 anos) e quiser que toda usina nova já entre com esse prazo.",
  },
  {
    nome: "Aviso de garantia",
    valorPadrao: "30 dias antes",
    oque: 'Quando faltar essa quantidade de dias para o fim da garantia, o sistema abre um alerta de severidade "Info" (Garantia vencendo).',
    quandoAjustar:
      "Aumente se você precisa de tempo maior para renegociar o contrato com o cliente.",
  },
  {
    nome: "Crítico de garantia",
    valorPadrao: "7 dias antes",
    oque: 'A partir desse marco, o alerta de Garantia vencendo escala para severidade "Aviso" — fica em destaque no painel.',
    quandoAjustar: "Mantenha sempre menor que o aviso. 7 dias funciona para a maioria.",
  },
];

const HORARIO_SOLAR: CampoConfig[] = [
  {
    nome: "Horário solar — início",
    valorPadrao: "08:00",
    oque: "A partir desta hora o sistema espera que a usina esteja gerando.",
    quandoAjustar:
      "Em regiões onde o sol nasce mais cedo ou tarde, ajuste para evitar falsos alertas no início do dia.",
  },
  {
    nome: "Horário solar — fim",
    valorPadrao: "18:00",
    oque: "Hora limite até a qual a usina deve estar gerando.",
    quandoAjustar:
      "Idem ao início. Se trabalhar em região muito específica, alinhe com o pôr do sol local.",
  },
];

const ALERTAS: CampoConfig[] = [
  {
    nome: "Tempo sem comunicação",
    valorPadrao: "24 horas",
    oque: 'Tempo sem leitura nova antes de abrir o alerta "Sem comunicação".',
    quandoAjustar:
      "Reduza para 6–12 h se sua operação exige resposta no mesmo dia. Cuidado: muitos provedores cacheiam dados por horas — valores muito baixos geram alertas falsos.",
  },
  {
    nome: "Coletas para dado ausente",
    valorPadrao: "10 coletas",
    oque: 'Quantas coletas seguidas com campo elétrico vazio antes de abrir o alerta "Dado elétrico ausente".',
    quandoAjustar:
      "Aumente se o seu provedor é instável e oscila entre vazio e válido. Reduzir gera mais alertas.",
  },
  {
    nome: "Limite de subdesempenho",
    valorPadrao: "15 % da capacidade",
    oque: 'Abaixo desse percentual da capacidade instalada, no horário de pico (10–15 h), o alerta "Subdesempenho" é aberto.',
    quandoAjustar:
      "Mantenha 15 % para a maioria dos casos. Suba se a regra estiver sendo muito sensível em dias nublados.",
  },
  {
    nome: "Queda de rendimento",
    valorPadrao: "60 % da média",
    oque: 'Compara a geração do dia com a média dos últimos 7 dias da própria usina. Abaixo desse percentual, o alerta "Queda de rendimento" é aberto.',
    quandoAjustar:
      "60 % é conservador. Reduza para 50 % se preferir capturar só quedas mais severas.",
  },
  {
    nome: "Limite de temperatura",
    valorPadrao: "75 °C",
    oque: 'Limite global de temperatura usado pelo alerta "Temperatura alta" quando o inversor não tem um limite próprio.',
    quandoAjustar:
      "Cheque a ficha técnica do inversor antes de mudar. 75 °C cobre a maioria dos modelos.",
  },
  {
    nome: "Potência mínima para avaliar",
    valorPadrao: "0,5 kW",
    oque: "Abaixo dessa potência, regras de tensão e frequência são puladas — o inversor está em standby e essas leituras não são confiáveis.",
    quandoAjustar:
      "Quase nunca precisa mudar. Suba só se você está vendo muito alerta de tensão/frequência logo no nascer do sol.",
  },
  {
    nome: "Coletas para inversor offline",
    valorPadrao: "3 coletas",
    oque: 'Quantas coletas seguidas em estado offline antes de abrir o alerta "Inversor offline".',
    quandoAjustar:
      "Diminua para 2 se quer ser avisado mais rápido. Aumente para 5 se seus inversores ligam e desligam em horários levemente diferentes.",
  },
  {
    nome: "Queda abrupta",
    valorPadrao: "5 % da capacidade",
    oque: 'Usado pela regra "Sem geração em horário solar" para distinguir parada real de fim de tarde natural. Se a leitura anterior estava acima desse percentual e a atual zerou, a regra dispara.',
    quandoAjustar:
      "Raramente precisa mudar. Aumentar deixa a regra menos sensível em transições suaves.",
  },
];

const RETENCAO: CampoConfig[] = [
  {
    nome: "Retenção de leituras",
    valorPadrao: "90 dias",
    oque: "Quantos dias de leituras o sistema mantém no banco. Leituras mais antigas são apagadas todo dia às 03 h.",
    quandoAjustar:
      "Aumente se precisa de comparação histórica longa. Diminua para reduzir custo de banco. Os alertas (mesmo resolvidos) não são afetados — ficam para sempre.",
  },
];

function GrupoCampos({ campos }: { campos: CampoConfig[] }) {
  return (
    <div className="flex flex-col gap-3">
      {campos.map((c) => (
        <div key={c.nome} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <h3 className="text-base font-semibold">{c.nome}</h3>
            <span className="text-sm text-muted-foreground">
              padrão:{" "}
              <strong className="text-foreground">{c.valorPadrao}</strong>
            </span>
          </div>
          <p className="mt-2 text-base leading-7 text-foreground/90">
            {c.oque}
          </p>
          <p className="mt-1 text-base leading-7 text-muted-foreground">
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
        descricao="Os ajustes globais que valem para todas as usinas da sua empresa."
      />

      <DocsSection titulo="Onde acessar">
        <DocsParagraph>
          Tudo abaixo é configurado em{" "}
          <AppLink to="/configuracoes">Configurações</AppLink>. As mudanças
          valem imediatamente — a próxima coleta de cada conta de provedor
          já usa os valores novos.
        </DocsParagraph>
      </DocsSection>

      <DocsSection titulo="Como funciona a herança de valores">
        <DocsParagraph>
          Cada campo aqui serve como o valor padrão da empresa. Várias
          regras aceitam um valor específico por inversor ou por usina — e
          quando existir um valor específico, ele vence o padrão da
          empresa. Os defaults cobrem a maioria dos casos. Só ajuste
          pontualmente quando uma usina ou inversor específico precisar de
          algo diferente.
        </DocsParagraph>
        <Callout tipo="dica" titulo="Antes de mudar um valor">
          <p>
            Os padrões foram calibrados para evitar ruído. Se você está
            recebendo muitos alertas de uma regra específica, considere
            primeiro <strong>rebaixar a severidade</strong> dela em{" "}
            <AppLink to="/configuracao/regras">Regras de alertas</AppLink>{" "}
            antes de mexer no limite global.
          </p>
        </Callout>
      </DocsSection>

      <DocsSection titulo="Garantia">
        <DocsParagraph>
          A <strong>garantia</strong> é o prazo durante o qual a sua empresa
          se compromete a atender o cliente em problemas com a usina. Aqui
          ela serve a três propósitos:
        </DocsParagraph>
        <ol className="flex flex-col gap-2 pl-5 text-base leading-7 list-decimal">
          <li>
            <strong>Cadastro automático.</strong> Toda usina nova ganha o
            prazo padrão definido aqui — você só ajusta usina por usina se
            o contrato for diferente.
          </li>
          <li>
            <strong>Alerta de fim de cobertura.</strong> A regra{" "}
            <em>Garantia vencendo</em> abre alerta no painel de{" "}
            <AppLink to="/alertas">Alertas</AppLink> conforme as garantias
            chegam ao fim — a quantos dias antes e quando escala de
            severidade é o que você define abaixo.
          </li>
          <li>
            <strong>Lista consolidada.</strong> Todas as garantias
            cadastradas, com vencimento e status, ficam em{" "}
            <AppLink to="/garantias">Garantias</AppLink> para consulta
            rápida.
          </li>
        </ol>
        <DocsParagraph>
          Os campos abaixo controlam esses três pontos:
        </DocsParagraph>
        <GrupoCampos campos={GARANTIA} />
      </DocsSection>

      <DocsSection titulo="Janela de horário solar">
        <DocsParagraph>
          Define a janela em que a usina é considerada "em horário de
          geração". Algumas regras só fazem sentido durante o dia (
          <em>Sem geração em horário solar</em>, <em>Subdesempenho</em>) e
          dependem desses valores para não disparar à noite.
        </DocsParagraph>
        <GrupoCampos campos={HORARIO_SOLAR} />
      </DocsSection>

      <DocsSection titulo="Limites de alertas">
        <DocsParagraph>
          Cada limite abaixo controla quando uma regra específica abre
          alerta. Veja as regras correspondentes em{" "}
          <AppLink to="/docs/regras-alerta">Regras de alertas</AppLink>.
        </DocsParagraph>
        <GrupoCampos campos={ALERTAS} />
      </DocsSection>

      <DocsSection titulo="Retenção de dados">
        <GrupoCampos campos={RETENCAO} />
      </DocsSection>
    </DocsArticle>
  );
}
