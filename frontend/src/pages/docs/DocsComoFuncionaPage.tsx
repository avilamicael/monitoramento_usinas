import {
  AppLink,
  Callout,
  DocsArticle,
  DocsHeader,
  DocsList,
  DocsParagraph,
  DocsSection,
  DocsSubsection,
} from "@/components/docs/DocsContent";

export default function DocsComoFuncionaPage() {
  return (
    <DocsArticle>
      <DocsHeader
        titulo="Como funciona"
        descricao="O que acontece entre o inversor da usina e o painel que você vê aqui."
      />

      <DocsSection titulo="Visão em uma frase">
        <DocsParagraph>
          A cada poucos minutos, o sistema entra na conta que você cadastrou em{" "}
          <AppLink to="/provedores">Provedores</AppLink>, lê os dados de todas
          as usinas e inversores ligados a ela, salva uma leitura nova e roda
          o motor de alertas em cima desses dados. As usinas aparecem em{" "}
          <AppLink to="/usinas">Usinas</AppLink> e os problemas em{" "}
          <AppLink to="/alertas">Alertas</AppLink>.
        </DocsParagraph>
      </DocsSection>

      <DocsSection titulo="O ciclo de coleta, passo a passo">
        <DocsParagraph>
          Para cada conta cadastrada, o sistema dispara um ciclo de coleta no
          intervalo configurado (10 a 30 minutos, depende do provedor). Em
          cada ciclo:
        </DocsParagraph>
        <DocsList ordered>
          <li>
            <strong>Autenticação.</strong> O sistema decripta as credenciais
            criptografadas no banco e autentica na API do provedor. Tokens de
            sessão (Hoymiles, FusionSolar) ficam em cache para evitar login a
            cada coleta.
          </li>
          <li>
            <strong>Listagem.</strong> Lê todas as usinas associadas àquela
            conta. Se apareceu uma usina nova no provedor, ela é cadastrada
            automaticamente aqui — você não precisa fazer nada.
          </li>
          <li>
            <strong>Leitura por usina e por inversor.</strong> Para cada uma,
            o sistema captura potência atual, energia do dia, energia
            acumulada, tensão, frequência, temperatura, status, e os dados de
            cada string MPPT.
          </li>
          <li>
            <strong>Normalização.</strong> Cada provedor reporta em unidades
            diferentes (W, kW, MW, Wh). O sistema converte tudo para um
            padrão único (kW, kWh, V, A, Hz, °C). Quando o provedor não tem o
            campo, ele fica vazio (não vira zero).
          </li>
          <li>
            <strong>Persistência atômica.</strong> Tudo é salvo de uma vez só.
            Se o ciclo falhar no meio, nada parcial é gravado.
          </li>
          <li>
            <strong>Avaliação de alertas.</strong> Depois de salvar, o motor
            roda todas as regras ativas em cima das leituras novas e abre,
            atualiza ou resolve alertas conforme o caso.
          </li>
          <li>
            <strong>Auditoria.</strong> Tudo é registrado em um log de coleta
            (início, fim, contadores, erros). Falhas seguidas marcam a conta
            como <em>precisa atenção</em>.
          </li>
        </DocsList>
        <Callout tipo="info" titulo="Idempotência">
          <p>
            Se o ciclo é interrompido e roda de novo na mesma janela de
            10 minutos, ele não cria leituras duplicadas — sobrescreve a
            leitura da janela atual. Por isso pode aparecer uma leitura
            "atualizando" alguns segundos antes de fechar.
          </p>
        </Callout>
      </DocsSection>

      <DocsSection titulo="Por que os alertas são gerados aqui, e não pelo provedor">
        <DocsParagraph>
          Os provedores expõem alarmes nativos, mas a maioria deles abre e
          fecha sozinha em poucos minutos — gera ruído sem ação real. Em
          medições históricas, mais de 12 % dos alarmes nativos resolveram-se
          em menos de 1 hora; em provedores como o Solis, esse número passou
          de 46 %. Por isso o Monitoramento Solar{" "}
          <strong>ignora os alarmes do provedor</strong> e calcula os próprios
          alertas, em cima das leituras que ele mesmo coleta.
        </DocsParagraph>
        <DocsParagraph>Isso permite:</DocsParagraph>
        <DocsList>
          <li>
            Definir thresholds que fazem sentido para a sua operação, em{" "}
            <AppLink to="/configuracoes">Configurações</AppLink>.
          </li>
          <li>
            Ativar/desativar regras conforme a empresa quiser, em{" "}
            <AppLink to="/configuracao/regras">Regras de alertas</AppLink>.
          </li>
          <li>Comportamento consistente entre provedores diferentes.</li>
          <li>
            Histórico confiável de quando o problema começou e quando foi
            resolvido.
          </li>
        </DocsList>
      </DocsSection>

      <DocsSection titulo="O motor de alertas em detalhe">
        <DocsParagraph>
          Toda vez que uma leitura nova chega, o motor passa por todas as
          regras ativas. Cada regra olha a leitura e decide um dos três
          resultados:
        </DocsParagraph>

        <DocsSubsection titulo="Anomalia detectada">
          <DocsParagraph>
            A regra encontrou uma condição problemática. Se já existe um
            alerta aberto para essa regra naquele equipamento, ele é{" "}
            <strong>atualizado</strong> (mensagem, severidade, contexto). Se
            não existe, o sistema <strong>abre</strong> um alerta novo. Em
            qualquer caso, a data de abertura original é preservada.
          </DocsParagraph>
        </DocsSubsection>

        <DocsSubsection titulo="Tudo normal">
          <DocsParagraph>
            A regra avaliou e o problema não está mais presente. Se havia
            alerta aberto, ele é movido para <em>resolvido</em>{" "}
            automaticamente. Se não havia, nada acontece.
          </DocsParagraph>
        </DocsSubsection>

        <DocsSubsection titulo="Dado insuficiente">
          <DocsParagraph>
            O provedor não devolveu o campo, ou o inversor está em standby
            (sem geração), ou o cenário não se aplica àquele equipamento. A
            regra simplesmente <strong>não avalia</strong> — não abre nem
            fecha alerta. Isso evita que um buraco temporário no dado feche
            um alerta válido.
          </DocsParagraph>
        </DocsSubsection>

        <Callout tipo="info" titulo="Um alerta aberto por regra e por equipamento">
          <p>
            Não é possível haver dois alertas abertos da mesma regra para o
            mesmo equipamento. A invariante é garantida pelo banco — você
            sempre vê uma linha consolidada por problema.
          </p>
        </Callout>

        <DocsSubsection titulo="Severidade dinâmica">
          <DocsParagraph>
            Algumas regras escalam sozinhas conforme a gravidade aumenta.
            Exemplos: "sem comunicação" começa em <em>aviso</em> e vira{" "}
            <em>crítico</em> ao passar de 2× o tempo configurado;
            "garantia vencendo" começa em <em>info</em> a 30 dias do fim e
            sobe a 7 dias. Para essas regras, a severidade não é editável
            manualmente — apenas o liga/desliga em{" "}
            <AppLink to="/configuracao/regras">Regras de alertas</AppLink>.
          </DocsParagraph>
        </DocsSubsection>

        <DocsSubsection titulo="Escalada quando todos são afetados">
          <DocsParagraph>
            Algumas regras agregam por usina (ex.: sobretensão, frequência).
            Se todos os inversores da mesma usina estão sob a mesma anomalia
            ao mesmo tempo, isso indica problema sistêmico (rede, cabeamento)
            e a severidade sobe automaticamente. Quando só parte está
            afetada, fica na severidade base.
          </DocsParagraph>
        </DocsSubsection>
      </DocsSection>

      <DocsSection titulo="Carência por coletas consecutivas">
        <DocsParagraph>
          Algumas regras (inversor offline, dado elétrico ausente) exigem N
          coletas seguidas confirmando a condição antes de abrir alerta. Isso
          evita ruído de inversores que ligam e desligam em horários
          ligeiramente diferentes. O número de coletas é configurável em{" "}
          <AppLink to="/configuracoes">Configurações</AppLink>.
        </DocsParagraph>
      </DocsSection>

      <DocsSection titulo="Hierarquia de configurações">
        <DocsParagraph>
          Cada threshold (tensão limite, temperatura, frequência etc.) pode
          ser definido em vários lugares. A ordem de busca é:
        </DocsParagraph>
        <DocsList ordered>
          <li>Valor cadastrado no <strong>próprio inversor</strong>.</li>
          <li>Valor cadastrado na <strong>usina</strong>.</li>
          <li>
            Valor das{" "}
            <AppLink to="/configuracoes">Configurações da empresa</AppLink>.
          </li>
          <li>Valor padrão do sistema.</li>
        </DocsList>
        <DocsParagraph>
          Use isso para definir um threshold global da empresa e abrir
          exceções pontuais sem replicar configuração em todo lugar.
        </DocsParagraph>
      </DocsSection>

      <DocsSection titulo="Fuso horário e horário solar">
        <DocsParagraph>
          O sistema opera em horário de Brasília (America/São_Paulo). Datas e
          horários nos alertas e leituras estão sempre nesse fuso.
        </DocsParagraph>
        <DocsParagraph>
          Algumas regras só fazem sentido durante o dia — por exemplo, "sem
          geração em horário solar" e "subdesempenho". A janela padrão é
          08:00–18:00, configurável por empresa em{" "}
          <AppLink to="/configuracoes">Configurações → Horário solar</AppLink>.
        </DocsParagraph>
      </DocsSection>

      <DocsSection titulo="Notificações externas">
        <DocsParagraph>
          Além de aparecer em <AppLink to="/alertas">Alertas</AppLink>,
          alertas críticos podem ser disparados por notificações externas
          (e-mail, WhatsApp, webhooks). O que dispara cada canal é
          configurado em{" "}
          <AppLink to="/notificacoes">Notificações</AppLink> e em{" "}
          <AppLink to="/gestao-notificacoes">Gestão de notificações</AppLink>.
        </DocsParagraph>
      </DocsSection>

      <DocsSection titulo="Retenção de dados">
        <DocsParagraph>
          Leituras antigas (mais que 90 dias por padrão) são apagadas
          automaticamente todo dia às 03 h. Isso mantém o banco enxuto sem
          afetar gráficos do dia-a-dia. Os <strong>alertas</strong>, mesmo
          resolvidos, são preservados — eles formam o histórico operacional
          da sua empresa. Você pode mudar o prazo em{" "}
          <AppLink to="/configuracoes">Configurações → Retenção</AppLink>.
        </DocsParagraph>
      </DocsSection>
    </DocsArticle>
  );
}
