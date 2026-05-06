import {
  Callout,
  DocsArticle,
  DocsHeader,
  DocsList,
  DocsParagraph,
  DocsSection,
} from "@/components/docs/DocsContent";

export default function DocsComoFuncionaPage() {
  return (
    <DocsArticle>
      <DocsHeader
        titulo="Como funciona"
        descricao="O que acontece entre o inversor da usina e o painel que você vê aqui."
      />

      <DocsSection titulo="O ciclo de coleta">
        <DocsParagraph>
          Para cada conta de provedor cadastrada, o sistema dispara coletas em
          intervalos regulares (10 a 30 minutos, configurável por conta). Em
          cada ciclo:
        </DocsParagraph>
        <DocsList ordered>
          <li>
            O sistema autentica na API do provedor com as credenciais
            criptografadas que você cadastrou.
          </li>
          <li>
            Lê todas as usinas e inversores associados àquela conta — se
            apareceu uma usina nova no provedor, ela é importada automaticamente.
          </li>
          <li>
            Salva uma leitura por usina e por inversor (potência, tensão,
            frequência, temperatura, energia do dia, status etc.).
          </li>
          <li>
            Roda o motor de alertas em cima das leituras para abrir, atualizar
            ou resolver alertas.
          </li>
        </DocsList>
        <Callout tipo="info" titulo="Idempotência">
          <p>
            Se o ciclo é interrompido no meio e roda de novo, ele não cria
            leituras duplicadas — sobrescreve a leitura da janela atual. Por
            isso pode aparecer uma leitura "atualizando" alguns segundos antes
            de fechar.
          </p>
        </Callout>
      </DocsSection>

      <DocsSection titulo="Por que os alertas são gerados aqui, e não pelo provedor?">
        <DocsParagraph>
          Os provedores expõem alarmes nativos, mas a maioria deles abre e
          fecha sozinha em poucos minutos — gera ruído sem ação real. Por isso
          o Monitoramento Solar <strong>ignora os alarmes do provedor</strong>{" "}
          e calcula os próprios alertas, em cima das leituras que ele mesmo
          coleta. Isso permite:
        </DocsParagraph>
        <DocsList>
          <li>Definir thresholds que fazem sentido para a sua operação.</li>
          <li>Ativar/desativar regras conforme a empresa quiser.</li>
          <li>Desempenho consistente entre provedores diferentes.</li>
          <li>
            Histórico confiável de quando o problema começou e quando foi
            resolvido.
          </li>
        </DocsList>
      </DocsSection>

      <DocsSection titulo="Quando um alerta abre, atualiza ou fecha">
        <DocsParagraph>
          Toda vez que uma leitura nova chega, o motor passa por todas as
          regras ativas. Cada regra olha a leitura e decide:
        </DocsParagraph>
        <DocsList>
          <li>
            <strong>Anomalia detectada</strong> — abre o alerta se ainda não
            existir, ou atualiza a mensagem/severidade se já estiver aberto.
          </li>
          <li>
            <strong>Tudo normal</strong> — se havia um alerta aberto pra essa
            regra, ele é movido para "resolvido" automaticamente.
          </li>
          <li>
            <strong>Dado insuficiente</strong> — quando o inversor está em
            standby ou o provedor não devolveu o campo, a regra simplesmente
            não avalia. Não abre nem fecha nada.
          </li>
        </DocsList>
        <Callout tipo="dica" titulo="Sem histerese artificial">
          <p>
            O sistema não exige que o problema persista por X minutos antes de
            abrir alerta — ele confia nas próprias leituras. Algumas regras
            específicas (como inversor offline) exigem N coletas consecutivas
            para evitar ruído de inversores que ligam e desligam em horários
            ligeiramente diferentes.
          </p>
        </Callout>
      </DocsSection>

      <DocsSection titulo="Fuso horário e horário solar">
        <DocsParagraph>
          O sistema opera em horário de Brasília (America/São_Paulo). Algumas
          regras só fazem sentido durante o dia — por exemplo, "sem geração em
          horário solar". A janela padrão é 08:00–18:00, configurável por
          empresa em <em>Configurações → Empresa</em>.
        </DocsParagraph>
      </DocsSection>

      <DocsSection titulo="Notificações externas">
        <DocsParagraph>
          Além de aparecer no painel, alertas críticos podem ser disparados por
          notificações externas (e-mail, webhooks, integrações da empresa). O
          que dispara cada canal é configurado em{" "}
          <em>Gestão → Notificações</em>.
        </DocsParagraph>
      </DocsSection>
    </DocsArticle>
  );
}
