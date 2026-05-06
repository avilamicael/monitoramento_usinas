import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";

import {
  Callout,
  DocsArticle,
  DocsHeader,
  DocsSection,
} from "@/components/docs/DocsContent";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface QA {
  pergunta: string;
  resposta: React.ReactNode;
}

const PERGUNTAS_GERAIS: QA[] = [
  {
    pergunta: "Por que aparece um alerta e ele some pouco depois?",
    resposta: (
      <>
        <p>
          O sistema reavalia todas as regras a cada coleta. Se na coleta seguinte
          a condição já não está mais presente, o alerta é movido para
          "resolvido" automaticamente. Isso não significa que ele foi um falso
          positivo — significa que a anomalia foi pontual.
        </p>
        <p className="mt-2">
          Para revisar alertas que se resolveram sozinhos, abra{" "}
          <em>Alertas</em> e filtre por estado <em>resolvido</em>.
        </p>
      </>
    ),
  },
  {
    pergunta: "Posso desativar uma regra inteira?",
    resposta: (
      <p>
        Sim. Vá em <em>Gestão → Regras de alertas</em> e desligue a regra. Os
        alertas que já estavam abertos não fecham automaticamente — eles ficam
        marcados como <em>regra desativada</em> e você resolve manualmente.
        Isso evita perder histórico ou esconder problemas reais sem revisão.
      </p>
    ),
  },
  {
    pergunta: "Por que algumas regras não deixam eu mudar a severidade?",
    resposta: (
      <p>
        Algumas regras escalam sozinhas conforme a gravidade aumenta — por
        exemplo, "sem comunicação" começa em <em>aviso</em> e vira{" "}
        <em>crítico</em> depois de 2× o tempo configurado. Para essas, o motor
        decide a severidade dinamicamente e o admin só pode ativar/desativar.
      </p>
    ),
  },
];

const PERGUNTAS_DADOS: QA[] = [
  {
    pergunta: "Onde mudo o intervalo de coleta de uma conta?",
    resposta: (
      <p>
        Em <em>Gestão → Provedores</em>, abra a conta e ajuste o campo{" "}
        <em>intervalo de coleta</em>. A próxima coleta já roda no novo
        intervalo — não precisa reiniciar nada.
      </p>
    ),
  },
  {
    pergunta: "Posso usar limites diferentes por usina?",
    resposta: (
      <p>
        Sim. Vários campos (tensão limite, temperatura, frequência mín/máx)
        podem ser definidos diretamente na usina ou no inversor. Quando o
        valor existe ali, ele substitui o default global da empresa.
      </p>
    ),
  },
  {
    pergunta: "Por quanto tempo as leituras ficam guardadas?",
    resposta: (
      <p>
        90 dias por padrão. Você pode aumentar ou diminuir em{" "}
        <em>Configurações → Retenção</em>. Histórico de alertas não é afetado:
        eles ficam para sempre.
      </p>
    ),
  },
  {
    pergunta: "Os alertas chegam por e-mail?",
    resposta: (
      <p>
        Depende da configuração de notificações da sua empresa. Em{" "}
        <em>Gestão → Notificações</em> você define quais regras disparam
        quais canais (e-mail, webhook, integrações).
      </p>
    ),
  },
];

const PERGUNTAS_OPERACIONAIS: QA[] = [
  {
    pergunta: "Cadastrei uma conta nova mas não vejo as usinas. O que faço?",
    resposta: (
      <>
        <p>
          A primeira coleta acontece nos minutos seguintes ao cadastro. Se
          depois de 30 minutos as usinas não apareceram, verifique:
        </p>
        <ul className="mt-2 list-disc pl-5">
          <li>A conta está marcada como <em>ativa</em>?</li>
          <li>
            Em <em>Gestão → Provedores</em>, a conta está com status{" "}
            <em>precisa atenção</em>? Em geral, isso indica credenciais
            recusadas — refaça o login no portal do fabricante.
          </li>
          <li>
            As credenciais estão corretas? Tente entrar no portal original do
            fabricante.
          </li>
        </ul>
      </>
    ),
  },
  {
    pergunta: "Recebo muitos alertas iguais. Como reduzir?",
    resposta: (
      <>
        <p>Tem três caminhos, do mais conservador para o mais agressivo:</p>
        <ol className="mt-2 list-decimal pl-5">
          <li>
            <strong>Rebaixar a severidade</strong> da regra em{" "}
            <em>Gestão → Regras de alertas</em>. Continua aparecendo, mas não
            polui o painel de críticos.
          </li>
          <li>
            <strong>Ajustar threshold</strong> em{" "}
            <em>Configurações → Empresa</em> — por exemplo, aumentar o tempo
            sem comunicação de 24 h para 48 h.
          </li>
          <li>
            <strong>Desativar a regra</strong> de vez. Use só quando você tem
            certeza de que aquela detecção não agrega valor para a sua
            operação.
          </li>
        </ol>
      </>
    ),
  },
  {
    pergunta: "Quem da minha empresa vê o quê?",
    resposta: (
      <p>
        Usuários com papel <em>operacional</em> veem dashboards, alertas,
        usinas e provedores. Usuários <em>administrador</em> veem isso e mais
        as páginas de gestão (usuários, configurações, regras de alertas).
        Cada empresa só enxerga seus próprios dados.
      </p>
    ),
  },
];

function PerguntaItem({ pergunta, resposta }: QA) {
  const [aberto, setAberto] = useState(false);
  return (
    <Collapsible
      open={aberto}
      onOpenChange={setAberto}
      className="rounded-lg border"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40">
        <span>{pergunta}</span>
        <ChevronRightIcon
          className="size-4 shrink-0 text-muted-foreground transition-transform data-[state=open]:rotate-90"
          data-state={aberto ? "open" : "closed"}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-4 py-3 text-sm leading-relaxed">
        {resposta}
      </CollapsibleContent>
    </Collapsible>
  );
}

function GrupoFaq({ perguntas }: { perguntas: QA[] }) {
  return (
    <div className="flex flex-col gap-2">
      {perguntas.map((p) => (
        <PerguntaItem key={p.pergunta} {...p} />
      ))}
    </div>
  );
}

export default function DocsFaqPage() {
  return (
    <DocsArticle>
      <DocsHeader
        titulo="Perguntas frequentes"
        descricao="Dúvidas que aparecem com mais frequência durante a operação."
      />

      <DocsSection titulo="Sobre alertas">
        <GrupoFaq perguntas={PERGUNTAS_GERAIS} />
      </DocsSection>

      <DocsSection titulo="Sobre dados e coletas">
        <GrupoFaq perguntas={PERGUNTAS_DADOS} />
      </DocsSection>

      <DocsSection titulo="Operação e usuários">
        <GrupoFaq perguntas={PERGUNTAS_OPERACIONAIS} />
      </DocsSection>

      <Callout tipo="info" titulo="Não achou a resposta?">
        <p>
          Se sua dúvida não está aqui, entre em contato com a administração da
          empresa. Casos recorrentes serão promovidos para esta página.
        </p>
      </Callout>
    </DocsArticle>
  );
}
