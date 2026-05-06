import {
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
  intervaloPadrao: string;
  credenciais: string;
  observacao?: string;
}

const PROVEDORES: ProvedorInfo[] = [
  {
    nome: "Solis",
    intervaloPadrao: "10 minutos",
    credenciais: "API Key + API Secret (geradas no portal Solis Cloud).",
    observacao:
      "Sem token de sessão — cada requisição é autenticada de forma independente. É o provedor com a integração mais estável.",
  },
  {
    nome: "Hoymiles",
    intervaloPadrao: "10 minutos",
    credenciais: "Usuário e senha do portal Hoymiles.",
    observacao:
      "O Hoymiles ocasionalmente reporta o inversor como offline mesmo quando ele está gerando. Nesses casos o sistema confia na potência observada.",
  },
  {
    nome: "FusionSolar (Huawei)",
    intervaloPadrao: "30 minutos",
    credenciais: "Usuário e senha do FusionSolar (Northbound).",
    observacao:
      "Os valores chegam em MW e são convertidos para kW automaticamente. Quando o inversor está offline, o provedor às vezes devolve campos zerados — o sistema trata como ausente, não como zero real.",
  },
  {
    nome: "Solarman",
    intervaloPadrao: "10 minutos",
    credenciais: "Usuário e senha do portal Solarman / Igen.",
    observacao:
      "O login do Solarman exige resolução de captcha (Cloudflare Turnstile) — a primeira autenticação pode demorar alguns segundos a mais. Se a senha mudar no portal, é preciso atualizar aqui.",
  },
  {
    nome: "Auxsol",
    intervaloPadrao: "10 minutos",
    credenciais: "Usuário e senha do portal Auxsol.",
    observacao:
      "O token de sessão dura 12 h e é renovado automaticamente.",
  },
  {
    nome: "Foxess",
    intervaloPadrao: "15 minutos",
    credenciais: "API Key da conta Foxess.",
    observacao:
      "O Foxess limita o número de chamadas por minuto. Se você cadastrar muitas contas, pode ser preciso aumentar o intervalo.",
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
            Vá em <em>Gestão → Provedores</em> e clique em "Nova conta".
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
            Defina o intervalo de coleta. Comece com o padrão recomendado
            abaixo; só aumente se o provedor estiver limitando suas chamadas.
          </li>
          <li>
            Salve. O sistema vai disparar a primeira coleta dentro de poucos
            minutos e importar todas as usinas e inversores ligados àquela
            conta.
          </li>
        </DocsList>
        <Callout tipo="info" titulo="Uma conta cobre vários clientes">
          <p>
            Se você opera várias usinas com o mesmo provedor através de uma
            única conta da sua empresa, basta cadastrar essa conta uma vez.
            Cada usina vinculada vira um registro próprio no painel.
          </p>
        </Callout>
      </DocsSection>

      <DocsSection titulo="Provedores suportados">
        <div className="grid gap-3">
          {PROVEDORES.map((p) => (
            <Card key={p.nome}>
              <CardHeader>
                <CardTitle className="text-base">{p.nome}</CardTitle>
                <CardDescription>
                  Intervalo recomendado: {p.intervaloPadrao} ·{" "}
                  {p.credenciais}
                </CardDescription>
              </CardHeader>
              {p.observacao && (
                <CardContent className="text-sm text-muted-foreground">
                  {p.observacao}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </DocsSection>

      <DocsSection titulo="O que fazer quando uma conta para de funcionar">
        <DocsParagraph>
          Quando o provedor recusa as credenciais ou rejeita a chamada, a
          conta é marcada como <em>precisa atenção</em> e some das coletas
          automáticas até alguém intervir. Para resolver:
        </DocsParagraph>
        <DocsList ordered>
          <li>
            Tente fazer login no portal do fabricante com as mesmas
            credenciais. Se não conseguir, gere uma chave nova ou redefina a
            senha lá.
          </li>
          <li>
            Atualize as credenciais aqui em <em>Gestão → Provedores</em> e
            reative a conta.
          </li>
          <li>
            A próxima coleta dispara nos minutos seguintes — alertas existentes
            são preservados.
          </li>
        </DocsList>
        <Callout tipo="aviso" titulo="Senhas expiram">
          <p>
            Alguns portais (Solarman, FusionSolar) forçam troca de senha
            periódica. Quando isso acontecer, a coleta para até a senha ser
            atualizada aqui.
          </p>
        </Callout>
      </DocsSection>
    </DocsArticle>
  );
}
