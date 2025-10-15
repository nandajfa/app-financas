import { Transaction } from "@/pages/Dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowDownRight, ArrowUpRight, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TransactionsListProps {
  transactions: Transaction[];
}

/** Parser robusto p/ quando: aceita ISO, epoch em ms (13 dígitos) e s (10 dígitos) */
function parseQuando(input: string | number | null | undefined): Date | null {
  if (input == null) return null;

  // number → epoch ms/s
  if (typeof input === "number") {
    const ms = String(input).length === 13 ? input : input * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // string só com dígitos → epoch ms/s
  if (/^\d+$/.test(input)) {
    const n = Number(input);
    const ms = input.length === 13 ? n : n * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // string ISO (ou similar)
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

const TransactionsList = ({ transactions }: TransactionsListProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const safeFormatDate = (q: string | number) => {
    const d = parseQuando(q);
    if (!d) return "—";
    try {
      return format(d, "dd MMM yyyy", { locale: ptBR });
    } catch {
      return "—";
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Transações Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-4">
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma transação encontrada
              </div>
            ) : (
              transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-start gap-4 p-4 rounded-lg border border-border hover:shadow-card transition-shadow duration-200"
                >
                  <div
                    className={`p-2 rounded-lg ${
                      transaction.tipo === "receita" ? "bg-success/10" : "bg-destructive/10"
                    }`}
                  >
                    {transaction.tipo === "receita" ? (
                      <ArrowUpRight className="h-5 w-5 text-success" />
                    ) : (
                      <ArrowDownRight className="h-5 w-5 text-destructive" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-foreground">
                          {transaction.estabelecimento}
                        </h4>

                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {safeFormatDate(transaction.quando)}
                          </span>

                          <Badge variant="outline" className="text-xs">
                            {transaction.categoria}
                          </Badge>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`font-bold ${
                            transaction.tipo === "receita" ? "text-success" : "text-destructive"
                          }`}
                        >
                          {transaction.tipo === "receita" ? "+" : "-"}
                          {formatCurrency(Math.abs(Number(transaction.valor)))}
                        </div>
                      </div>
                    </div>

                    {transaction.detalhes && (
                      <p className="text-sm text-muted-foreground">{transaction.detalhes}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default TransactionsList;
