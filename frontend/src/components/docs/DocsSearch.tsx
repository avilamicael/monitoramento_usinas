import * as React from "react";
import { useNavigate } from "react-router-dom";
import { SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DOCS_SECOES, rotaDocs } from "@/components/docs/docs-data";

const isMac = typeof navigator !== "undefined" && /Mac|iPad|iPhone/.test(navigator.platform);

export function DocsSearch() {
  const navigate = useNavigate();
  const [aberto, setAberto] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const acionador = isMac ? e.metaKey : e.ctrlKey;
      if (acionador && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberto((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const irPara = (slug: string) => {
    setAberto(false);
    navigate(rotaDocs(slug));
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setAberto(true)}
        className="w-full justify-between gap-2 px-2 text-muted-foreground"
        aria-label="Buscar na documentação"
      >
        <span className="flex items-center gap-2">
          <SearchIcon data-icon="inline-start" />
          Pesquisar...
        </span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          {isMac ? "⌘" : "Ctrl"}
          <span>K</span>
        </kbd>
      </Button>

      <CommandDialog
        open={aberto}
        onOpenChange={setAberto}
        title="Buscar na documentação"
        description="Encontre rapidamente um tópico"
      >
        <Command>
          <CommandInput placeholder="Digite para buscar nos tópicos..." />
          <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            {DOCS_SECOES.map((secao) => (
              <CommandGroup key={secao.titulo} heading={secao.titulo}>
                {secao.topicos.map((topico) => (
                  <CommandItem
                    key={topico.slug || "raiz"}
                    value={`${secao.titulo} ${topico.titulo} ${topico.descricao ?? ""}`}
                    onSelect={() => irPara(topico.slug)}
                  >
                    <span className="font-medium">{topico.titulo}</span>
                    {topico.descricao && (
                      <span className="ml-2 truncate text-xs text-muted-foreground">
                        {topico.descricao}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
