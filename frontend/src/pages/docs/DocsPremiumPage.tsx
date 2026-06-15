import {
  AppLink,
  Callout,
  DocsArticle,
  DocsHeader,
  DocsList,
  DocsParagraph,
  DocsSection,
} from "@/components/docs/DocsContent";

export default function DocsPremiumPage() {
  return (
    <DocsArticle>
      <DocsHeader
        titulo="Clientes premium"
        descricao="O contrato de monitoramento ativo: quem paga para ser atendido com prioridade."
      />

      <DocsSection titulo="O que é">
        <DocsParagraph>
          O <strong>monitoramento ativo</strong> é um contrato pago à parte em
          que o cliente paga uma mensalidade para que os problemas da usina
          dele sejam tratados com prioridade e rapidez. É o cliente{" "}
          <strong>premium</strong>: além de ver o alerta, você se compromete a
          agir rápido sobre ele.
        </DocsParagraph>
      </DocsSection>

      <DocsSection titulo="Diferença para a garantia">
        <DocsParagraph>
          Garantia e monitoramento ativo são <strong>independentes</strong>.
          Uma usina pode ter garantia, monitoramento ativo, os dois ou nenhum.
        </DocsParagraph>
        <DocsList>
          <li>
            <strong>Garantia</strong> — período de cobertura do produto/serviço.
            Os alertas aparecem e precisam de atenção, mas o foco é cumprir o
            que já estava contratado na venda.
          </li>
          <li>
            <strong>Monitoramento ativo (premium)</strong> — receita recorrente
            paga pelo cliente especificamente para ser monitorado e atendido
            com agilidade. Cada alerta de uma usina premium é um chamado que
            você está sendo pago para resolver.
          </li>
        </DocsList>
        <Callout tipo="info" titulo="Os dois ligam o monitoramento">
          <p>
            Tanto a garantia ativa quanto o monitoramento ativo vigente fazem o
            sistema avaliar todas as regras de alerta da usina. Basta um dos
            dois estar em vigor. Veja{" "}
            <AppLink to="/docs/como-funciona">Como funciona</AppLink>.
          </p>
        </Callout>
      </DocsSection>

      <DocsSection titulo="Cadastrar um contrato premium">
        <DocsParagraph>
          Em{" "}
          <AppLink to="/monitoramento-ativo">Monitoramento Ativo</AppLink> você
          cadastra o contrato de cada usina, informando a data de início e a{" "}
          <strong>duração paga em meses</strong>. Se o cliente contratou, por
          exemplo, um ano de monitoramento e mais dois meses de cortesia,
          basta somar e registrar quatorze meses — o sistema calcula a data de
          fim e mostra quantos dias faltam.
        </DocsParagraph>
        <DocsParagraph>
          Quando o contrato se aproxima do fim, a regra{" "}
          <em>Monitoramento premium vencendo</em> abre um alerta de aviso (30 e
          7 dias antes, por padrão). Os prazos são editáveis em{" "}
          <AppLink to="/configuracoes">Configurações</AppLink>.
        </DocsParagraph>
      </DocsSection>

      <DocsSection titulo="Acompanhar os alertas premium">
        <DocsParagraph>
          Todos os alertas de usinas premium aparecem normalmente em{" "}
          <AppLink to="/alertas">Alertas</AppLink>, marcados com um selo{" "}
          <strong>Premium</strong> para você identificar de relance. Além disso,
          existe uma tela dedicada só com eles em{" "}
          <AppLink to="/alertas-premium">Alertas Premium</AppLink> — use-a como
          sua fila de prioridade: são os clientes que pagam pelo atendimento
          rápido.
        </DocsParagraph>
        <Callout tipo="dica" titulo="Fluxo recomendado">
          <p>
            Comece o dia pela tela de <strong>Alertas Premium</strong>: resolva
            primeiro a fila de quem paga por agilidade e depois trate o restante
            em Alertas.
          </p>
        </Callout>
      </DocsSection>
    </DocsArticle>
  );
}
