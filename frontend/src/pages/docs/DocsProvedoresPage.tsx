import {
  AppLink,
  Callout,
  DocsArticle,
  DocsHeader,
  DocsList,
  DocsParagraph,
  DocsSection,
} from "@/components/docs/DocsContent";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ProvedorInfo {
  nome: string;
  credenciais: string;
  observacao?: string;
}

const PROVEDORES: ProvedorInfo[] = [
  {
    nome: "Solis",
    credenciais: "API Key + API Secret (geradas no portal Solis Cloud).",
    observacao:
      "Sem token de sessão — cada requisição é autenticada de forma independente. É o provedor com a integração mais estável.",
  },
  {
    nome: "Hoymiles",
    credenciais: "Usuário e senha do portal Hoymiles.",
    observacao:
      "A potência da usina é calculada pela soma dos microinversores, não pelo agregado da Hoymiles — o agregado da Hoymiles atrasa em alguns minutos e às vezes reporta zero enquanto os equipamentos seguem gerando. Se um microinversor é reportado como offline mas tem potência positiva, o sistema entende como online (o link com o gateway pisca brevemente, mas a geração é real).",
  },
  {
    nome: "FusionSolar (Huawei)",
    credenciais: "Usuário e senha do FusionSolar (Northbound).",
    observacao:
      "Os valores chegam em MW e são convertidos para kW automaticamente. Quando o inversor está offline, o provedor às vezes devolve campos zerados — o sistema trata como ausente, não como zero real. A Huawei tem limite de chamadas mais restrito; em caso de dúvida, mantenha o intervalo padrão.",
  },
  {
    nome: "Solarman",
    credenciais: "Usuário e senha do portal Solarman / Igen.",
    observacao:
      "O login do Solarman exige resolução de captcha (Cloudflare Turnstile) — a primeira autenticação pode demorar alguns segundos a mais. Se a senha mudar no portal, atualize aqui.",
  },
  {
    nome: "Auxsol",
    credenciais: "Usuário e senha do portal Auxsol.",
    observacao:
      "O token de sessão dura 12 h e é renovado automaticamente. Se o portal invalidar o token antes desse prazo (acontece de vez em quando), o sistema refaz o login na hora, sem interromper a coleta.",
  },
  {
    nome: "Foxess",
    credenciais: "API Key da conta Foxess.",
    observacao:
      "Foxess limita o número de chamadas por minuto. Se você cadastrar muitas contas, o intervalo de 1 hora cobre o caso comum sem risco de bloqueio.",
  },
];

export default function DocsProvedoresPage() {
  return (
    <DocsArticle>
      <DocsHeader
        titulo="Provedores"
        descricao="Quais fabricantes o sistema suporta hoje, como cadastrar uma conta e o que esperar de cada um."
      />

      <DocsSection titulo="Como cadastrar uma conta de provedor">
        <DocsList ordered>
          <li>
            Vá em <AppLink to="/provedores">Provedores</AppLink> e clique em
            "Nova conta".
          </li>
          <li>
            Escolha o tipo de provedor e dê um nome para a conta (ex.: o nome
            do cliente final ou da carteira).
          </li>
          <li>
            Preencha as credenciais que o fabricante fornece. Elas são
            criptografadas no banco — ninguém consegue ler, nem outros
            usuários da empresa.
          </li>
          <li>
            Defina o intervalo de coleta. O padrão é <strong>1 hora</strong>{" "}
            (ver seção abaixo).
          </li>
          <li>
            Salve. O sistema dispara a primeira coleta dentro de poucos
            minutos e importa todas as usinas e inversores ligados àquela
            conta. Os equipamentos aparecem em{" "}
            <AppLink to="/usinas">Usinas</AppLink>.
          </li>
        </DocsList>
        <Callout tipo="info" titulo="Uma conta cobre vários clientes">
          <p>
            Se você opera várias usinas com o mesmo provedor através de uma
            única conta da sua empresa, basta cadastrar essa conta uma vez.
            Cada usina vinculada vira um registro próprio em{" "}
            <AppLink to="/usinas">Usinas</AppLink> e em{" "}
            <AppLink to="/garantias">Garantias</AppLink>.
          </p>
        </Callout>
      </DocsSection>

      <DocsSection titulo="Intervalo de coleta">
        <DocsParagraph>
          O <strong>intervalo de coleta</strong> é o tempo que o sistema
          espera entre duas consultas consecutivas da mesma conta. Você
          consegue alterar esse valor diretamente no cadastro da conta em{" "}
          <AppLink to="/provedores">Provedores</AppLink>.
        </DocsParagraph>
        <DocsParagraph>
          Para evitar bloqueios e cobranças extras junto aos provedores, o{" "}
          <strong>valor mínimo permitido é de 1 hora</strong>. Esse valor
          serve para todos os fabricantes — Solis, Hoymiles, FusionSolar,
          Solarman, Auxsol e Foxess — e cobre com folga a cadência real em
          que os inversores enviam dados (5 a 10 minutos).
        </DocsParagraph>
        <Callout tipo="aviso" titulo="Quer um intervalo menor?">
          <p>
            Em casos específicos é possível habilitar coletas mais
            frequentes. Para isso, entre em contato com o suporte e nós
            avaliamos a disponibilidade do provedor e os impactos
            operacionais antes de liberar.
          </p>
        </Callout>
        <DocsParagraph>
          Se uma conta começar a falhar com frequência, a primeira coisa a
          tentar é <strong>aumentar o intervalo</strong>. Por exemplo, ir de
          1 hora para 2 horas.
        </DocsParagraph>
      </DocsSection>

      <DocsSection titulo="Provedores suportados">
        <DocsParagraph>
          Todos os provedores abaixo usam 1 hora como intervalo mínimo de
          coleta por padrão. As particularidades de cada um estão na
          observação.
        </DocsParagraph>
        <div className="grid gap-3">
          {PROVEDORES.map((p) => (
            <Card key={p.nome}>
              <CardHeader>
                <CardTitle className="text-base">{p.nome}</CardTitle>
                <CardDescription className="text-base">
                  Intervalo padrão: <strong>1 hora</strong> · {p.credenciais}
                </CardDescription>
              </CardHeader>
              {p.observacao && (
                <CardContent className="text-base leading-7 text-muted-foreground">
                  {p.observacao}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </DocsSection>

      <DocsSection titulo="O que fazer quando uma conta para de funcionar">
        <DocsParagraph>
          Quando o provedor recusa as credenciais ou rejeita várias chamadas
          seguidas, a conta é marcada como <em>precisa atenção</em> e some
          das coletas automáticas até alguém intervir. Isso aparece em{" "}
          <AppLink to="/provedores">Provedores</AppLink>. Para resolver:
        </DocsParagraph>
        <DocsList ordered>
          <li>
            Tente fazer login no portal do fabricante com as mesmas
            credenciais. Se não conseguir, gere uma chave nova ou redefina a
            senha lá.
          </li>
          <li>
            Atualize as credenciais aqui em{" "}
            <AppLink to="/provedores">Provedores</AppLink> e reative a conta.
          </li>
          <li>
            Se o erro for de limite de chamadas, aumente o intervalo de
            coleta antes de reativar.
          </li>
          <li>
            A próxima coleta dispara nos minutos seguintes — alertas
            existentes são preservados.
          </li>
        </DocsList>
        <Callout tipo="aviso" titulo="Senhas expiram">
          <p>
            Alguns portais (Solarman, FusionSolar) forçam troca de senha
            periódica. Quando isso acontecer, a coleta para até a senha ser
            atualizada aqui. Recomendado: cadastrar um responsável para
            receber e atualizar essas senhas em tempo hábil.
          </p>
        </Callout>
      </DocsSection>

      <DocsSection titulo="Inversores: onde aparecem?">
        <DocsParagraph>
          Inversores não têm página própria — eles são listados como parte
          de cada usina. Abra <AppLink to="/usinas">Usinas</AppLink>, clique
          em uma e você verá todos os inversores daquela usina com leituras
          detalhadas, status e histórico.
        </DocsParagraph>
      </DocsSection>
    </DocsArticle>
  );
}
