import { Transaction } from "@/pages/Dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface CategoryChartProps {
  transactions: Transaction[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--success))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--ring))",
  "hsl(var(--secondary))",
];

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const CategoryChart = ({ transactions }: CategoryChartProps) => {
  // usa apenas DESPESAS do mês (já filtrado no dashboard)
  const expenses = (transactions ?? []).filter((t) => t?.tipo === "despesa");

  // agrupa por categoria e soma valor absoluto
  const buckets = expenses.reduce<Record<string, number>>((acc, t) => {
    const cat = (t?.categoria ?? "").trim() || "Sem categoria";
    const n = Number(t?.valor);
    if (!Number.isFinite(n) || n === 0) return acc;
    acc[cat] = (acc[cat] ?? 0) + Math.abs(n);
    return acc;
  }, {});

  const total = Object.values(buckets).reduce((s, v) => s + v, 0);

  const data = Object.entries(buckets)
    .map(([name, value]) => ({ name, value, percent: total ? value / total : 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <Card className="shadow-card h-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Por Categoria</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nenhum dado disponível</div>
        ) : (
          <div className="space-y-6">
            {/* Donut centralizado, SEM labels no gráfico (nada vaza do card) */}
            <div className="relative w-full" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={92}
                    dataKey="value"
                    label={false}
                    labelLine={false}
                  >
                    {data.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => fmtBRL(Number(v))}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* total no centro do donut */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Total despesas</div>
                  <div className="text-lg font-bold">{fmtBRL(total)}</div>
                </div>
              </div>
            </div>

            {/* Legenda abaixo: nome completo + valor + % (sempre dentro do card) */}
            <div className="space-y-2">
              {data.map((item, i) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="font-medium truncate">{item.name}</span>
                  </div>
                  <span className="font-semibold shrink-0">
                    {fmtBRL(item.value)} • {(item.percent * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CategoryChart;
