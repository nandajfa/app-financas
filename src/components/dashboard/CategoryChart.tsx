import { Transaction } from "@/pages/Dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface CategoryChartProps {
  transactions: Transaction[];
}

const CategoryChart = ({ transactions }: CategoryChartProps) => {
  const categoryData = transactions.reduce((acc, transaction) => {
    const category = transaction.categoria;
    const valor = Number(transaction.valor);
    
    if (!acc[category]) {
      acc[category] = 0;
    }
    acc[category] += Math.abs(valor);
    
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(categoryData).map(([name, value]) => ({
    name,
    value,
  }));

  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "hsl(var(--success))",
    "hsl(var(--destructive))",
    "hsl(var(--muted))",
    "hsl(var(--primary-glow))",
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Por Categoria</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum dado disponível
          </div>
        ) : (
          <div className="space-y-6">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} (${(percent * 100).toFixed(0)}%)`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {chartData.map((item, index) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(item.value)}</span>
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
