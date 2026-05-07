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
  intervaloMinimo: string;
  credenciais: string;
  observacao?: string;
}

const PROVEDORES: ProvedorInfo[] = [
  {
    nome: "Solis",
    intervaloMinimo: "10 minutos",
    credenciais: "API Key + API Secret (geradas no portal Solis Cloud).",
    observacao:
      "Sem token de sessão — cada requisição é autenticada de forma independente. É o provedor com a integração mais estável.",
  },
  {
    nome: "Hoymiles",
    intervaloMinimo: "10 minutos",
    credenciais: "Usuário e senha do portal Hoymiles.",
    observacao:
      "Ocasionalmente reporta o inversor como offline mesmo com geração ativa. Nesses casos o sistema confia na potência observada.",
  },
  {
    nome: "FusionSolar (Huawei)",
    intervaloMinimo: "30 minutos",
    credenciais: "Usuário e senha do FusionSolar (Northbound).",
    observacao:
      "Os valores chegam em MW e são convertidos para kW automaticamente. Quando o inversor está offline, o provedor às vezes devolve campos zerados — o sistema trata como ausente, não como zero real. A Huawei tem rate-limit agressivo: não tente intervalos abaixo de 30 minutos.",
  },
  {
    nome: "Solarman",
    intervaloMinimo: "10 minutos",
    credenciais: "Usuário e senha do portal Solarman / Igen.",
    observacao:
      "O login do Solarman exige resolução de captcha (Cloudflare Turnstile) — a primeira autenticação pode demorar alguns segundos a mais. Se a senha mudar no portal, atualize aqui.",
  },
  {
    nome: "Auxsol",
    intervaloMinimo: "10 minutos",
    credenciais: "Usuário e senha do portal Auxsol.",
    observacao: "O token de sessão dura 12 h e é renovado automaticamente.",
  },
  {
    nome: "Foxess",
    intervaloMinimo: "15 minutos",
    credenciais: "API Key da conta Foxess.",
    observacao:
      "Foxess limita o número de chamadas por minuto. Se você cadastrar muitas contas, pode ser preciso aumentar o intervalo para evitar bloqueio temporário.",
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
            Defina o intervalo de coleta. <strong>Use o intervalo mínimo
            do provedor como ponto de partida</strong> (ver tabela abaixo).
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

      <DocsSection titulo="Intervalo mínimo: muito importante">
        <DocsParagraph>
          O <strong>intervalo de coleta</strong> é o tempo que o sistema
          espera entre duas consultas consecutivas àquela conta. Cada
          provedor tem um <strong>mínimo seguro</strong> abaixo do qual ele
          começa a aplicar bloqueio temporário (rate-limit) ou rejeita as
          chamadas:
        </DocsParagraph>
        <Callout tipo="aviso" titulo="Não baixe o intervalo abaixo do mínimo">
          <p>
            Coletar mais frequente que o mínimo do provedor não traz mais
            dados — o inversor só envia leitura nova a cada 5–10 minutos
            mesmo. Em compensação, pode bloquear sua conta no portal e parar
            todas as coletas. Quando em dúvida, deixe no padrão.
          </p>
        </Callout>
        <DocsParagraph>
          Se a conta começar a falhar com frequência, primeira coisa a
          tentar: <strong>aumentar o intervalo</strong>. Por exemplo, ir de
          10 para 15 minutos, ou de 15 para 20.
        </DocsParagraph>
      </DocsSection>

      <DocsSection titulo="Provedores suportados">
        <DocsParagraph>
          O intervalo abaixo é o mínimo que o sistema permite definir para
          cada provedor. Você pode subir desse valor, nunca descer.
        </DocsParagraph>
        <div className="grid gap-3">
          {PROVEDORES.map((p) => (
            <Card key={p.nome}>
              <CardHeader>
                <CardTitle className="text-base">{p.nome}</CardTitle>
                <CardDescription className="text-base">
                  Intervalo mínimo: <strong>{p.intervaloMinimo}</strong> ·{" "}
                  {p.credenciais}
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
            Se o erro for de rate-limit, aumente o intervalo de coleta antes
            de reativar.
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
          de cada usina. Abra{" "}
          <AppLink to="/usinas">Usinas</AppLink>, clique em uma e você verá
          todos os inversores daquela usina com leituras detalhadas, status
          e histórico.
        </DocsParagraph>
      </DocsSection>
    </DocsArticle>
  );
}
