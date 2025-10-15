import { Transaction } from "@/pages/Dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";
import { startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

interface Props {
  transactions: Transaction[];
}

/** parse Date seguro (ISO, epoch ms/s, string numérica) */
function parseQuando(input: unknown): Date | null {
  if (input == null) return null;
  if (typeof input === "number") {
    const ms = String(input).length === 13 ? input : input * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === "string") {
    const t = input.trim();
    if (!t) return null;
    if (/^\d+$/.test(t)) {
      const n = Number(t);
      const ms = t.length === 13 ? n : n * 1000;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Converte "R$ 1.234,56" / "99,40" / 99.4 → number */
function toNumberBR(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  const s = value
    .replace(/\s/g, "")        // espaços
    .replace(/[Rr]\$?/g, "")   // R$, r$
    .replace(/\./g, "")        // separador de milhar
    .replace(/,/g, ".");       // vírgula → ponto
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export default function MonthlySummary({ transactions }: Props) {
  const now = new Date();
  const range = { start: startOfMonth(now), end: endOfMonth(now) };

  let totalReceitas = 0;
  let totalDespesas = 0;

  for (const t of transactions ?? []) {
	const v = Number(t.valor);
	if (!Number.isFinite(v)) continue;
	if (t.tipo === "receita") totalReceitas += Math.abs(v);
	else if (t.tipo === "despesa") totalDespesas += Math.abs(v);
  }

  const saldo = totalReceitas - totalDespesas;


  const Item = ({
    icon,
    title,
    value,
    valueClass = "",
  }: {
    icon: React.ReactNode;
    title: string;
    value: string;
    valueClass?: string;
  }) => (
    <Card className="shadow-card h-full">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="p-2 rounded-lg bg-muted">{icon}</div>
        <div>
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className={`text-xl font-bold leading-tight ${valueClass}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
      <Item
        icon={<ArrowUpRight className="h-5 w-5 text-success" />}
        title="Renda mensal total"
        value={fmtBRL(totalReceitas)}
        valueClass="text-success"
      />
      <Item
        icon={<ArrowDownRight className="h-5 w-5 text-destructive" />}
        title="Total de despesas mensais"
        value={fmtBRL(totalDespesas)}
        valueClass="text-destructive"
      />
      <Item
        icon={<Wallet className="h-5 w-5 text-foreground" />}
        title="Saldo"
        value={fmtBRL(saldo)}
        valueClass={saldo >= 0 ? "text-success" : "text-destructive"}
      />
    </div>
  );
}
