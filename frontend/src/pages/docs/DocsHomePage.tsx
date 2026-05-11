import { Link } from "react-router-dom";
import { ArrowRightIcon } from "lucide-react";

import {
  AppLink,
  Callout,
  DocsArticle,
  DocsHeader,
  DocsList,
  DocsParagraph,
  DocsSection,
  Kbd,
} from "@/components/docs/DocsContent";
import { DOCS_SECOES, rotaDocs } from "@/components/docs/docs-data";

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
            Acompanhar a geração de cada usina e do parque inteiro no{" "}
            <AppLink to="/">Dashboard</AppLink>.
          </li>
          <li>
            Ver e tratar <AppLink to="/alertas">alertas abertos</AppLink>{" "}
            (sem comunicação, subdesempenho, sobretensão, queda de
            rendimento etc.).
          </li>
          <li>
            Cadastrar <AppLink to="/provedores">contas de provedor</AppLink>{" "}
            — uma única conta com várias usinas é importada automaticamente.
          </li>
          <li>
            Acompanhar a <AppLink to="/garantias">garantia das usinas</AppLink>{" "}
            e ser avisado quando a data está chegando.
          </li>
          <li>
            Definir quais{" "}
            <AppLink to="/configuracao/regras">regras de alerta</AppLink>{" "}
            ficam ativas e com qual severidade na sua empresa.
          </li>
          <li>
            Ajustar os limites globais em{" "}
            <AppLink to="/configuracoes">Configurações da empresa</AppLink>.
          </li>
        </DocsList>
      </DocsSection>

      <DocsSection titulo="Como começar">
        <DocsList ordered>
          <li>
            <strong>Cadastre uma conta de provedor</strong> em{" "}
            <AppLink to="/provedores">Provedores</AppLink>. Use as credenciais
            que você já tem na plataforma do fabricante.
          </li>
          <li>
            <strong>Aguarde a primeira coleta.</strong> O sistema importa as
            usinas e inversores automaticamente — não precisa cadastrar manual.
            Veja o resultado em <AppLink to="/usinas">Usinas</AppLink>.
          </li>
          <li>
            <strong>Acompanhe os alertas.</strong> Os primeiros podem aparecer
            já no primeiro ciclo (24 h sem comunicação, garantia vencendo etc.)
            em <AppLink to="/alertas">Alertas</AppLink>.
          </li>
          <li>
            <strong>Calibre conforme sua operação.</strong> Em{" "}
            <AppLink to="/configuracao/regras">Regras de alertas</AppLink>{" "}
            você ajusta a severidade de cada alerta. Em{" "}
            <AppLink to="/configuracoes">Configurações</AppLink>, ajusta os
            limites globais (tempo sem comunicação, percentual de queda
            etc.).
          </li>
        </DocsList>
      </DocsSection>

      <DocsSection titulo="Navegar por tópico">
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          {topicosDestaque.map((topico) => (
            <Link
              key={topico.slug}
              to={rotaDocs(topico.slug)}
              className="tl-card"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                textDecoration: "none",
                color: "var(--tl-fg)",
                transition: "border-color 0.12s, background 0.12s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <strong style={{ fontSize: 14, fontWeight: 600 }}>
                  {topico.titulo}
                </strong>
                <ArrowRightIcon
                  className="size-3.5"
                  style={{ color: "var(--tl-muted-fg)", flexShrink: 0 }}
                />
              </div>
              {topico.descricao && (
                <p
                  style={{
                    fontSize: 12.5,
                    color: "var(--tl-muted-fg)",
                    lineHeight: 1.55,
                    margin: 0,
                  }}
                >
                  {topico.descricao}
                </p>
              )}
              <span
                style={{
                  fontSize: 12,
                  color: "var(--tl-accent)",
                  fontWeight: 500,
                  marginTop: 4,
                }}
              >
                Abrir →
              </span>
            </Link>
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
