/**
 * Página `/configuracao/regras` — gestão de regras do motor de alertas.
 *
 * Lista as 12 regras conhecidas do motor. Admin pode ativar/desativar
 * e ajustar severidade por regra. Detalhes da feature em
 * `docs/configuracao-regras/index.md` e `docs/configuracao-regras/ui.md`.
 *
 * F3/C2: esqueleto somente-leitura. Interatividade chega em F3/C3
 * (componente `LinhaRegra`) e F3/C4 (modal "Resetar tudo").
 */
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useConfiguracaoRegras } from "@/hooks/use-configuracao-regras";
import { CATEGORIA_LABELS } from "@/types/alertas";
import type { ConfiguracaoRegra } from "@/types/configuracao-regras";

const SEVERIDADE_LABEL: Record<string, string> = {
  critico: "Crítico",
  aviso: "Aviso",
  info: "Informativo",
};

function nomeLegivel(regra_nome: string): string {
  return CATEGORIA_LABELS[regra_nome] ?? regra_nome;
}

function LinhaRegraReadOnly({ regra }: { regra: ConfiguracaoRegra }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <div className="font-medium">{nomeLegivel(regra.regra_nome)}</div>
          {regra.descricao ? (
            <div className="text-sm text-muted-foreground">{regra.descricao}</div>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span>{regra.ativa ? "Ativa" : "Inativa"}</span>
          <span className="text-muted-foreground">
            Severidade: {SEVERIDADE_LABEL[regra.severidade] ?? regra.severidade}
          </span>
          {regra.severidade_dinamica ? (
            <Badge variant="secondary">Dinâmica</Badge>
          ) : regra.is_default ? (
            <Badge variant="outline">Padrão</Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function RegrasPage() {
  const { data, loading, error, refetch } = useConfiguracaoRegras();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Configuração de Regras</h1>
          <p className="text-sm text-muted-foreground">
            Defina como cada regra do motor de alertas se comporta nesta empresa.
          </p>
        </div>
        <Button variant="outline" disabled>
          Resetar tudo
        </Button>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Erro</CardTitle>
            <CardDescription className="text-destructive">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={refetch}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {data?.map((regra) => (
            <LinhaRegraReadOnly key={regra.regra_nome} regra={regra} />
          ))}
        </div>
      )}
    </div>
  );
}
