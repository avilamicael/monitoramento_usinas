import { Link } from "react-router-dom";
import { ArrowRightIcon } from "lucide-react";

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
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Documentação</h1>
        <p className="text-muted-foreground">
          Guias, regras e referência para operar o Monitoramento Solar.
          Use a busca <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">⌘K</kbd>{" "}
          ou <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">Ctrl+K</kbd>{" "}
          para encontrar um tópico rapidamente.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase text-muted-foreground tracking-wide">
          Navegar por tópico
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {topicosDestaque.map((topico) => (
            <Card key={topico.slug} className="transition-colors hover:bg-muted/40">
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
      </section>
    </div>
  );
}
