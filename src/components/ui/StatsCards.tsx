import { Transaction } from "@/pages/Dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, DollarSign, TrendingUp } from "lucide-react";

interface StatsCardsProps {
  transactions: Transaction[];
}

const StatsCards = ({ transactions }: StatsCardsProps) => {
  const totalReceitas = transactions
    .filter((t) => t.tipo === "receita")
    .reduce((acc, t) => acc + Number(t.valor), 0);

  const totalDespesas = transactions
    .filter((t) => t.tipo === "despesa")
    .reduce((acc, t) => acc + Number(t.valor), 0);

  const saldo = totalReceitas - totalDespesas;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="shadow-card hover:shadow-elegant transition-shadow duration-300">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Receitas
          </CardTitle>
          <div className="p-2 rounded-lg bg-success/10">
            <ArrowUpRight className="h-5 w-5 text-success" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-success">
            {formatCurrency(totalReceitas)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {transactions.filter((t) => t.tipo === "receita").length} transações
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-card hover:shadow-elegant transition-shadow duration-300">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Despesas
          </CardTitle>
          <div className="p-2 rounded-lg bg-destructive/10">
            <ArrowDownRight className="h-5 w-5 text-destructive" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-destructive">
            {formatCurrency(totalDespesas)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {transactions.filter((t) => t.tipo === "despesa").length} transações
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-card hover:shadow-elegant transition-shadow duration-300 bg-gradient-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Saldo
          </CardTitle>
          <div className="p-2 rounded-lg bg-primary/10">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${saldo >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatCurrency(saldo)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {transactions.length} transações totais
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsCards;
