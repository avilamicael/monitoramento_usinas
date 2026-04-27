import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Battery,
  Sun,
  Zap,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SeveridadeBadge } from "@/components/SeveridadeBadge";
import { PageHeader } from "@/components/PageHeader";
import {
  useAlertasCriticos,
  useDashboardKpis,
  useGeracaoDiaria,
  useTopFabricantes,
} from "@/features/dashboard/api";
import { fmtData, fmtDataHora, fmtKw, fmtKwh, fmtKwp, fmtNum, rotuloProvedor } from "@/lib/format";

const CORES_PIZZA = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function CartaoKpi({
  titulo,
  valor,
  rodape,
  icone: Icone,
  cor,
  loading,
}: {
  titulo: string;
  valor: string;
  rodape?: string;
  icone: typeof Sun;
  cor: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{titulo}</p>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">{valor}</p>
            )}
            {rodape && <p className="text-xs text-muted-foreground">{rodape}</p>}
          </div>
          <div className={`p-2.5 rounded-lg ${cor}`}>
            <Icone className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const kpis = useDashboardKpis();
  const geracao = useGeracaoDiaria(30);
  const top = useTopFabricantes(7);
  const criticos = useAlertasCriticos(10);

  return (
    <div className="space-y-6">
      <PageHeader titulo="Dashboard" subtitulo="Visão geral das usinas e alertas." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CartaoKpi
          titulo="Usinas"
          valor={`${kpis.data?.usinas.ativas ?? 0}/${kpis.data?.usinas.total ?? 0}`}
          rodape="Ativas / total"
          icone={Sun}
          cor="bg-amber-500"
          loading={kpis.isLoading}
        />
        <CartaoKpi
          titulo="Capacidade instalada"
          valor={fmtKwp(kpis.data?.capacidade_kwp)}
          icone={Battery}
          cor="bg-emerald-500"
          loading={kpis.isLoading}
        />
        <CartaoKpi
          titulo="Energia hoje"
          valor={fmtKwh(kpis.data?.energia_hoje_kwh)}
          rodape={`Potência atual ${fmtKw(kpis.data?.potencia_atual_kw)}`}
          icone={Zap}
          cor="bg-blue-500"
          loading={kpis.isLoading}
        />
        <CartaoKpi
          titulo="Alertas abertos"
          valor={String(kpis.data?.alertas_abertos.total ?? 0)}
          rodape={`${kpis.data?.alertas_abertos.critico ?? 0} críticos · ${kpis.data?.alertas_abertos.aviso ?? 0} avisos`}
          icone={AlertTriangle}
          cor="bg-red-500"
          loading={kpis.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Geração de energia (últimos 30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {geracao.isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : geracao.data && geracao.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={288}>
                <LineChart data={geracao.data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="dia" tickFormatter={(d) => fmtData(d)} fontSize={12} />
                  <YAxis tickFormatter={(v) => fmtNum(v, 0)} fontSize={12} />
                  <Tooltip
                    labelFormatter={(d) => fmtData(d as string)}
                    formatter={(v: number) => [fmtKwh(v), "Energia"]}
                  />
                  <Line type="monotone" dataKey="energia_kwh" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-12 text-center">Sem dados suficientes.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Geração por fabricante (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            {top.isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : top.data && top.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={288}>
                <PieChart>
                  <Pie
                    data={top.data}
                    dataKey="energia_kwh"
                    nameKey="provedor"
                    outerRadius={80}
                    label={(entry) => rotuloProvedor(entry.name as string)}
                  >
                    {top.data.map((_, i) => (
                      <Cell key={i} fill={CORES_PIZZA[i % CORES_PIZZA.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtKwh(v)} />
                  <Legend formatter={(v) => rotuloProvedor(v as string)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-12 text-center">Sem dados.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top fabricantes (eficiência kWh/kWp)</CardTitle>
          </CardHeader>
          <CardContent>
            {top.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2">Fabricante</th>
                    <th className="text-right py-2">Usinas</th>
                    <th className="text-right py-2">kWh</th>
                    <th className="text-right py-2">kWh/kWp</th>
                  </tr>
                </thead>
                <tbody>
                  {top.data?.map((r) => (
                    <tr key={r.provedor} className="border-b last:border-0">
                      <td className="py-2 font-medium">{rotuloProvedor(r.provedor)}</td>
                      <td className="text-right">{r.qtd_usinas}</td>
                      <td className="text-right">{fmtNum(r.energia_kwh)}</td>
                      <td className="text-right">{fmtNum(r.eficiencia_kwh_kwp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Alertas críticos abertos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {criticos.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : criticos.data && criticos.data.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {criticos.data.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`/alertas/${a.id}`}
                      className="flex items-start justify-between gap-3 p-2 -mx-2 rounded hover:bg-muted"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{a.usina_nome}</div>
                        <div className="text-xs text-muted-foreground truncate">{a.regra} · {fmtDataHora(a.aberto_em)}</div>
                      </div>
                      <SeveridadeBadge severidade={a.severidade} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhum alerta crítico aberto.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
