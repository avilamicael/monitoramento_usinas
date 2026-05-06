import { Link } from "react-router-dom";
import { ArrowRightIcon } from "lucide-react";

import {
  Callout,
  DocsArticle,
  DocsHeader,
  DocsList,
  DocsParagraph,
  DocsSection,
  Kbd,
} from "@/components/docs/DocsContent";
import { DOCS_SECOES, rotaDocs } from "@/components/docs/docs-data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DocsHomePage() {
  const topicosDestaque = DOCS_SECOES.flatMap((s) =>
    s.topicos.filter((t) => t.slug !== ""),
  );

  return (
    <DocsArticle>
      <DocsHeader
        titulo="Documentação"
        descricao="Guias, referência e respostas para usar o Monitoramento Solar no dia-a-dia."
      />

      <DocsSection titulo="O que é o Monitoramento Solar">
        <DocsParagraph>
          O Monitoramento Solar centraliza a operação das suas usinas
          fotovoltaicas em um único painel. Ele se conecta diretamente com os
          provedores dos inversores (Solis, Hoymiles, FusionSolar e outros),
          coleta as leituras de geração automaticamente e abre alertas quando
          alguma coisa sai do esperado — antes do cliente perceber.
        </DocsParagraph>
        <DocsParagraph>
          Cada empresa tem o próprio espaço, com seus usuários, usinas, contas
          de provedor e regras. Você só vê dados da sua empresa.
        </DocsParagraph>
      </DocsSection>

      <DocsSection titulo="O que você consegue fazer aqui">
        <DocsList>
          <li>
            Acompanhar a geração de cada usina e do parque inteiro no Dashboard.
          </li>
          <li>
            Ver e tratar alertas abertos (sem comunicação, subdesempenho,
            sobretensão, queda de rendimento etc.).
          </li>
          <li>
            Cadastrar contas de provedor — uma única conta com múltiplas usinas
            de um cliente é importada automaticamente.
          </li>
          <li>
            Acompanhar a garantia das usinas e ser avisado quando a data está
            chegando.
          </li>
          <li>
            Definir quais regras de alerta ficam ativas, com qual severidade,
            por empresa.
          </li>
        </DocsList>
      </DocsSection>

      <DocsSection titulo="Como começar">
        <DocsList ordered>
          <li>
            <strong>Cadastre uma conta de provedor</strong> em{" "}
            <em>Gestão → Provedores</em>. Use as credenciais que você já tem na
            plataforma do fabricante.
          </li>
          <li>
            <strong>Aguarde a primeira coleta.</strong> O sistema importa as
            usinas e inversores automaticamente — não precisa cadastrar manual.
          </li>
          <li>
            <strong>Acompanhe os alertas.</strong> Os primeiros podem aparecer
            já no primeiro ciclo (24h sem comunicação, garantia vencendo etc.).
          </li>
          <li>
            <strong>Ajuste o que for ruidoso.</strong> Em{" "}
            <em>Gestão → Regras de alertas</em> você desativa ou rebaixa a
            severidade de regras que estão gerando alarmes demais.
          </li>
        </DocsList>
      </DocsSection>

      <DocsSection titulo="Navegar por tópico">
        <div className="grid gap-4 sm:grid-cols-2">
          {topicosDestaque.map((topico) => (
            <Card
              key={topico.slug}
              className="transition-colors hover:bg-muted/40"
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span>{topico.titulo}</span>
                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                </CardTitle>
                {topico.descricao && (
                  <CardDescription>{topico.descricao}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <Link
                  to={rotaDocs(topico.slug)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Abrir →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </DocsSection>

      <Callout tipo="dica" titulo="Busca rápida">
        <p>
          Aperte <Kbd>⌘K</Kbd> (Mac) ou <Kbd>Ctrl+K</Kbd> (Windows/Linux) em
          qualquer lugar dentro de <em>/docs</em> para abrir a busca e pular
          direto para o tópico.
        </p>
      </Callout>
    </DocsArticle>
  );
}
