import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
// import StatsCards from "@/components/dashboard/StatsCards";
import TransactionsList from "@/components/dashboard/TransactionsList";
import CategoryChart from "@/components/dashboard/CategoryChart";
import MonthlySummary from "@/components/dashboard/MonthlySummary";
import { Loader2 } from "lucide-react";
import TransactionForm, { TransactionFormValues } from "@/components/dashboard/TransactionForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface Transaction {
  id: string;
  created_at: string;
  quando: string;
  user: string;
  estabelecimento: string;
  valor: number;
  detalhes: string | null;
  tipo: "receita" | "despesa";
  categoria: string;
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const normalizeTransaction = useCallback((t: any): Transaction => ({
    id: t.id,
    created_at: t.created_at ?? new Date().toISOString(),
    quando: t.quando,
    user: t.user,
    estabelecimento: t.estabelecimento ?? "",
    valor: typeof t.valor === "number" ? t.valor : Number(t.valor ?? 0),
    detalhes: t.detalhes ?? null,
    tipo: t.tipo === "receita" ? "receita" : "despesa",
    categoria: t.categoria ?? "",
  }), []);

  const fetchTransactions = useCallback(
    async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from("transacoes")
          .select("id, created_at, quando, user, estabelecimento, valor, detalhes, tipo, categoria")
          .eq("user", userId)
          .order("quando", { ascending: false });

        if (error) throw error;

        const normalized: Transaction[] = (data ?? []).map((t: any) => normalizeTransaction(t));
        setTransactions(normalized);
      } catch (error: any) {
        console.error("Error fetching transactions:", error);
        toast({
          variant: "destructive",
          title: "Erro ao carregar transações",
          description: error.message,
        });
      }
    },
    [normalizeTransaction, toast]
  );

  const checkAuth = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      await fetchTransactions(session.user.id);

      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (event === "SIGNED_OUT") {
            setUser(null);
            setTransactions([]);
            navigate("/auth");
            return;
          }

          if (session?.user) {
            setUser(session.user);
            await fetchTransactions(session.user.id);
          }
        }
      );

      return () => authListener.subscription.unsubscribe();
    } catch (error: any) {
      console.error("Auth error:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  }, [fetchTransactions, navigate, toast]);

  useEffect(() => {
    const cleanupPromise = checkAuth();

    return () => {
      cleanupPromise
        .then((cleanup) => {
          if (typeof cleanup === "function") {
            cleanup();
          }
        })
        .catch(() => undefined);
    };
  }, [checkAuth]);

  const handleCreateTransaction = async (values: TransactionFormValues) => {
    if (!user) return;

    const parsedValue = Number(values.valor);
    if (!Number.isFinite(parsedValue)) {
      toast({
        variant: "destructive",
        title: "Valor inválido",
        description: "Informe um número válido para o valor.",
      });
      return;
    }

    setCreateLoading(true);

    try {
      const payload = {
        user: user.id,
        estabelecimento: values.estabelecimento.trim(),
        valor: Math.abs(parsedValue),
        tipo: values.tipo,
        categoria: values.categoria.trim() || null,
        quando: values.quando,
        detalhes: values.detalhes.trim() ? values.detalhes.trim() : null,
      };

      const { data, error } = await supabase
        .from("transacoes")
        .insert([payload])
        .select("id, created_at, quando, user, estabelecimento, valor, detalhes, tipo, categoria")
        .single();

      if (error) throw error;

      if (data) {
        setTransactions((prev) => [normalizeTransaction(data), ...prev]);
      }

      toast({
        title: "Transação adicionada",
        description: "Registro criado com sucesso.",
      });
    } catch (error: any) {
      console.error("Error creating transaction:", error);
      toast({
        variant: "destructive",
        title: "Erro ao criar transação",
        description: error.message,
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUpdateTransaction = async (values: TransactionFormValues) => {
    if (!user || !editTransaction) return;

    const parsedValue = Number(values.valor);
    if (!Number.isFinite(parsedValue)) {
      toast({
        variant: "destructive",
        title: "Valor inválido",
        description: "Informe um número válido para o valor.",
      });
      return;
    }

    setEditLoading(true);

    try {
      const payload = {
        estabelecimento: values.estabelecimento.trim(),
        valor: Math.abs(parsedValue),
        tipo: values.tipo,
        categoria: values.categoria.trim() || null,
        quando: values.quando,
        detalhes: values.detalhes.trim() ? values.detalhes.trim() : null,
      };

      const { data, error } = await supabase
        .from("transacoes")
        .update(payload)
        .eq("id", editTransaction.id)
        .eq("user", user.id)
        .select("id, created_at, quando, user, estabelecimento, valor, detalhes, tipo, categoria")
        .single();

      if (error) throw error;

      if (data) {
        setTransactions((prev) =>
          prev.map((transaction) =>
            transaction.id === data.id ? normalizeTransaction(data) : transaction
          )
        );
      }

      toast({
        title: "Transação atualizada",
        description: "Registro salvo com sucesso.",
      });
      setEditTransaction(null);
    } catch (error: any) {
      console.error("Error updating transaction:", error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar transação",
        description: error.message,
      });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteTransaction = async (transaction: Transaction) => {
    if (!user) return;

    const confirmDelete = window.confirm("Deseja realmente excluir esta transação?");
    if (!confirmDelete) return;

    setDeletingId(transaction.id);

    try {
      const { error } = await supabase
        .from("transacoes")
        .delete()
        .eq("id", transaction.id)
        .eq("user", user.id);

      if (error) throw error;

      setTransactions((prev) => prev.filter((item) => item.id !== transaction.id));
      toast({
        title: "Transação removida",
        description: "O registro foi excluído.",
      });
    } catch (error: any) {
      console.error("Error deleting transaction:", error);
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error.message,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <DashboardHeader user={user} onSignOut={handleSignOut} />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* <StatsCards transactions={transactions} /> */}

        <MonthlySummary transactions={transactions} />

        <div className="grid grid-cols-1 gap-8">
          <div className="bg-card border border-border rounded-xl shadow-card p-6">
            <TransactionForm
              title="Adicionar transação"
              submitLabel="Salvar transação"
              onSubmit={handleCreateTransaction}
              submitting={createLoading}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
  <div className="lg:col-span-2">
    <TransactionsList
      transactions={transactions}
      onEdit={(transaction) => setEditTransaction(transaction)}
      onDelete={handleDeleteTransaction}
      deletingId={deletingId}
    />
  </div>
  <div className="lg:col-span-1 self-start">
    <CategoryChart transactions={transactions} />
  </div>
</div>
      </main>

      <Dialog open={!!editTransaction} onOpenChange={(open) => !open && setEditTransaction(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar transação</DialogTitle>
          </DialogHeader>
          {editTransaction && (
            <TransactionForm
              title=""
              submitLabel="Atualizar transação"
              initialValues={{
                estabelecimento: editTransaction.estabelecimento,
                valor: editTransaction.valor?.toString() ?? "",
                tipo: editTransaction.tipo,
                categoria: editTransaction.categoria,
                quando: editTransaction.quando,
                detalhes: editTransaction.detalhes ?? "",
              }}
              onSubmit={handleUpdateTransaction}
              onCancel={() => setEditTransaction(null)}
              submitting={editLoading}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
