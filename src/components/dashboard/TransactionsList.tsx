import { Transaction } from "@/pages/Dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowDownRight, ArrowUpRight, Calendar, Loader2, Pencil, Trash2 } from "lucide-react";
// (mantém date-fns se quiser, mas vamos proteger antes de chamar)
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TransactionsListProps {
  transactions: Transaction[] | undefined | null;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  deletingId?: string | null;
}

/** Parser ultrarrobusto: aceita ISO, epoch ms/s, números/strings; retorna Date válido ou null */
function parseQuando(input: unknown): Date | null {
  if (input == null) return null;

  // number → epoch ms/s
  if (typeof input === "number") {
    const ms = String(input).length === 13 ? input : input * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // só dígitos? epoch ms (13) ou s (10)
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      const ms = trimmed.length === 13 ? n : n * 1000;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }

    // tenta como ISO
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  // qualquer outra coisa
  return null;
}

function safeFormatDate(input: unknown): string {
  const d = parseQuando(input);
  if (!d) return "—";
  try {
    // você pode trocar para "dd/MM/yyyy" se quiser só a data
    return format(d, "dd MMM yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

const TransactionsList = ({ transactions, onEdit, onDelete, deletingId }: TransactionsListProps) => {
  const formatCurrency = (value: unknown) => {
    const n = typeof value === "number" ? value : Number(value);
    const safe = Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(safe);
  };

  // Normaliza os dados ANTES de renderizar (evita estourar dentro do JSX)
  const rows: Transaction[] = Array.isArray(transactions) ? transactions : [];

  // (debug opcional) loga linhas com data inválida para você corrigir na origem
  for (const tx of rows) {
    const d = parseQuando(tx.quando);
    if (!d) {
      // eslint-disable-next-line no-console
      console.warn("[Transações] 'quando' inválido:", tx.quando, " em id=", tx.id);
    }
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Transações Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-4">
            {rows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma transação encontrada
              </div>
            ) : (
              rows.map((transaction) => {
                const valorAbs = Math.abs(Number(transaction.valor));
                const isReceita = transaction.tipo === "receita";
                const isDeleting = deletingId === transaction.id;
                return (
                  <div
                    key={transaction.id}
                    className="flex items-start gap-4 p-4 rounded-lg border border-border hover:shadow-card transition-shadow duration-200"
                  >
                    <div
                      className={`p-2 rounded-lg ${isReceita ? "bg-success/10" : "bg-destructive/10"}`}
                    >
                      {isReceita ? (
                        <ArrowUpRight className="h-5 w-5 text-success" />
                      ) : (
                        <ArrowDownRight className="h-5 w-5 text-destructive" />
                      )}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-foreground">
                            {(transaction.estabelecimento ?? "").trim() || "—"}
                          </h4>

                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {safeFormatDate(transaction.quando)}
                            </span>

                            <Badge variant="outline" className="text-xs">
                              {(transaction.categoria ?? "").trim() || "Sem categoria"}
                            </Badge>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`font-bold ${isReceita ? "text-success" : "text-destructive"}`}>
                            {isReceita ? "+" : "-"}
                            {formatCurrency(valorAbs)}
                          </div>
                          <div className="flex items-center justify-end gap-2 mt-2">
                            {onEdit && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => onEdit(transaction)}
                                title="Editar transação"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {onDelete && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => onDelete(transaction)}
                                title="Excluir transação"
                                disabled={isDeleting}
                              >
                                {isDeleting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {transaction.detalhes && transaction.detalhes.trim() && (
                        <p className="text-sm text-muted-foreground">
                          {transaction.detalhes.trim()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default TransactionsList;
