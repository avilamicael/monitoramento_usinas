/**
 * Estrutura central da documentação. Alimenta a sidebar de /docs e a busca ⌘K.
 * Cada `slug` mapeia para uma rota relativa em /docs.
 */

export interface DocsTopico {
  titulo: string;
  slug: string;
  descricao?: string;
}

export interface DocsSecao {
  titulo: string;
  topicos: DocsTopico[];
}

export const DOCS_SECOES: DocsSecao[] = [
  {
    titulo: "Começar",
    topicos: [
      {
        titulo: "Visão geral",
        slug: "",
        descricao: "Introdução ao Monitoramento Solar.",
      },
      {
        titulo: "Como funciona",
        slug: "como-funciona",
        descricao: "Coleta, ingestão e geração de alertas.",
      },
    ],
  },
  {
    titulo: "Operação",
    topicos: [
      {
        titulo: "Regras de alertas",
        slug: "regras-alerta",
        descricao: "As regras automáticas e seus thresholds.",
      },
      {
        titulo: "Provedores",
        slug: "provedores",
        descricao: "Solis, Hoymiles, FusionSolar, Solarman, Auxsol e Foxess.",
      },
    ],
  },
  {
    titulo: "Configuração",
    topicos: [
      {
        titulo: "Configurações da empresa",
        slug: "configuracoes",
        descricao: "Ajustes globais que afetam todas as usinas.",
      },
      {
        titulo: "Perguntas frequentes",
        slug: "faq",
      },
    ],
  },
];

export function rotaDocs(slug: string): string {
  return slug ? `/docs/${slug}` : "/docs";
}
