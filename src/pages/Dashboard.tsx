import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { addMonths, isWithinInterval, startOfMonth } from "date-fns";

export interface Transaction {
  id: string;
  created_at: string;
  quando: string;
  user: string | null;
  estabelecimento: string;
  valor: number;
  detalhes: string | null;
  tipo: "receita" | "despesa";
  categoria: string;
  phone_e164?: string | null;
}

const parseQuandoToDate = (value: unknown): Date | null => {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const millis = String(Math.trunc(value)).length === 13 ? value : value * 1000;
    const parsed = new Date(millis);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      const millis = trimmed.length === 13 ? numeric : numeric * 1000;
      const parsed = new Date(millis);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const normalizeJidToPhone = (identifier: string | null | undefined): string | null => {
  if (!identifier) return null;

  const jid = identifier.trim();
  if (!jid) return null;

  const withoutSuffix = jid.replace(/@.*$/, "");
  const digits = withoutSuffix.replace(/\D/g, "");
  if (!digits) return null;

  return digits.startsWith("+") ? digits : `+${digits}`;
};

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [userIdentifier, setUserIdentifier] = useState<string | null>(null);
  const [userPhoneE164, setUserPhoneE164] = useState<string | null>(null);
  const [identifierField, setIdentifierField] = useState<"user" | "user_id">("user");
  const [isAdmin, setIsAdmin] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const normalizeTransaction = useCallback((t: any): Transaction => ({
    id: t.id,
    created_at: t.created_at ?? new Date().toISOString(),
    quando: t.quando,
    user: t.user ?? t.user_id ?? null,
    estabelecimento: t.estabelecimento ?? "",
    valor: typeof t.valor === "number" ? t.valor : Number(t.valor ?? 0),
    detalhes: t.detalhes ?? null,
    tipo: t.tipo === "receita" ? "receita" : "despesa",
    categoria: t.categoria ?? "",
    phone_e164: t.phone_e164 ?? null,
  }), []);

  const fetchTransactions = useCallback(
    async (identifier: string, field: "user" | "user_id") => {
      try {
        const { data, error } = await supabase
          .from("transacoes")
          .select(
            "id, created_at, quando, user, user_id, phone_e164, estabelecimento, valor, detalhes, tipo, categoria"
          )
          .eq(field, identifier)
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

  const resolveAdminIdentifier = useCallback(
    async (currentUser: User) => {
      const { data, error } = await supabase
        .from("whatsapp_links")
        .select("whatsapp_jid")
        .eq("user_id", currentUser.id)
        .limit(1);

      if (error) {
        throw error;
      }

      const linkedJid = data?.[0]?.whatsapp_jid
        ?? (typeof currentUser.user_metadata?.whatsapp_jid === "string"
          ? currentUser.user_metadata.whatsapp_jid
          : null);

      if (!linkedJid) {
        throw new Error(
          "Nenhum telefone do WhatsApp está vinculado a esta conta. Cadastre o vínculo para visualizar suas transações."
        );
      }

      setUserIdentifier(linkedJid);
      setUserPhoneE164(normalizeJidToPhone(linkedJid));

      return linkedJid;
    },
    []
  );

  const fetchIsAdmin = useCallback(async (currentUser: User) => {
    const { data, error } = await supabase.rpc("has_role", {
      _role: "admin",
      _user_id: currentUser.id,
    });

    if (error) {
      throw error;
    }

    return Boolean(data);
  }, []);

  const initializeUserContext = useCallback(
    async (currentUser: User) => {
      const userIsAdmin = await fetchIsAdmin(currentUser);
      setIsAdmin(userIsAdmin);

      if (userIsAdmin) {
        setIdentifierField("user");
        const identifier = await resolveAdminIdentifier(currentUser);
        await fetchTransactions(identifier, "user");
        return;
      }

      const identifier = currentUser.id;
      setIdentifierField("user_id");
      setUserIdentifier(identifier);
      setUserPhoneE164(null);
      await fetchTransactions(identifier, "user_id");
    },
    [fetchIsAdmin, fetchTransactions, resolveAdminIdentifier]
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
      await initializeUserContext(session.user);

      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (event === "SIGNED_OUT") {
            setUser(null);
            setTransactions([]);
            setUserIdentifier(null);
            setUserPhoneE164(null);
            setIdentifierField("user");
            setIsAdmin(false);
            navigate("/auth");
            return;
          }

          if (session?.user) {
            setUser(session.user);
            try {
              await initializeUserContext(session.user);
            } catch (identifierError: any) {
              console.error("Error resolving identifier:", identifierError);
              toast({
                variant: "destructive",
                title: "Erro",
                description: identifierError.message,
              });
            }
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

      if (typeof error?.message === "string" && error.message.includes("WhatsApp")) {
        setTransactions([]);
        setUserIdentifier(null);
        setUserPhoneE164(null);
        setIdentifierField("user");
      } else {
        navigate("/auth");
      }
    } finally {
      setLoading(false);
    }
  }, [initializeUserContext, navigate, toast]);

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
    if (!user) {
      toast({
        variant: "destructive",
        title: "Vínculo ausente",
        description: "Não foi possível identificar o telefone vinculado ao usuário.",
      });
      return;
    }

    const identifierValue = identifierField === "user" ? userIdentifier : user.id;
    if (!identifierValue) {
      toast({
        variant: "destructive",
        title: "Vínculo ausente",
        description: "Não foi possível identificar o telefone vinculado ao usuário.",
      });
      return;
    }

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
      const payload: Record<string, any> = {
        estabelecimento: values.estabelecimento.trim(),
        valor: Math.abs(parsedValue),
        tipo: values.tipo,
        categoria: values.categoria.trim() || null,
        quando: values.quando,
        detalhes: values.detalhes.trim() ? values.detalhes.trim() : null,
      };

      if (identifierField === "user") {
        payload.user = identifierValue;
        payload.user_id = user.id;
        if (userPhoneE164) {
          payload.phone_e164 = userPhoneE164;
        }
      } else {
        payload.user_id = identifierValue;
      }

      const { data, error } = await supabase
        .from("transacoes")
        .insert([payload])
        .select(
          "id, created_at, quando, user, user_id, phone_e164, estabelecimento, valor, detalhes, tipo, categoria"
        )
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
    if (!user || !editTransaction) {
      toast({
        variant: "destructive",
        title: "Vínculo ausente",
        description: "Não foi possível identificar o telefone vinculado ao usuário.",
      });
      return;
    }

    const identifierValue = identifierField === "user" ? userIdentifier : user.id;
    if (!identifierValue) {
      toast({
        variant: "destructive",
        title: "Vínculo ausente",
        description: "Não foi possível identificar o telefone vinculado ao usuário.",
      });
      return;
    }

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
        .eq(identifierField, identifierValue)
        .select(
          "id, created_at, quando, user, user_id, phone_e164, estabelecimento, valor, detalhes, tipo, categoria"
        )
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
    if (!user) {
      toast({
        variant: "destructive",
        title: "Vínculo ausente",
        description: "Não foi possível identificar o telefone vinculado ao usuário.",
      });
      return;
    }

    const identifierValue = identifierField === "user" ? userIdentifier : user.id;
    if (!identifierValue) {
      toast({
        variant: "destructive",
        title: "Vínculo ausente",
        description: "Não foi possível identificar o telefone vinculado ao usuário.",
      });
      return;
    }

    const confirmDelete = window.confirm("Deseja realmente excluir esta transação?");
    if (!confirmDelete) return;

    setDeletingId(transaction.id);

    try {
      const { error } = await supabase
        .from("transacoes")
        .delete()
        .eq("id", transaction.id)
        .eq(identifierField, identifierValue);

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

  const currentMonthRange = useMemo(() => {
    const start = startOfMonth(new Date());
    const endExclusive = addMonths(start, 1);
    return { start, endExclusive };
  }, []);

  const currentMonthTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const date = parseQuandoToDate(transaction.quando);
      if (!date) return false;

      return isWithinInterval(date, {
        start: currentMonthRange.start,
        end: new Date(currentMonthRange.endExclusive.getTime() - 1),
      });
    });
  }, [currentMonthRange.endExclusive, currentMonthRange.start, transactions]);

  const hasMonthlyTransactions = currentMonthTransactions.length > 0;

  const handleExportCurrentMonth = () => {
    if (!hasMonthlyTransactions) {
      toast({
        variant: "destructive",
        title: "Nada para exportar",
        description: "Nenhuma transação encontrada para o mês atual.",
      });
      return;
    }

    const header = [
      "ID",
      "Data de criação",
      "Quando",
      "Estabelecimento",
      "Valor",
      "Tipo",
      "Categoria",
      "Detalhes",
      "Identificador",
      "Telefone",
    ];

    const rows = currentMonthTransactions.map((transaction) => [
      transaction.id,
      transaction.created_at,
      transaction.quando,
      transaction.estabelecimento,
      transaction.valor,
      transaction.tipo,
      transaction.categoria,
      transaction.detalhes ?? "",
      transaction.user ?? "",
      transaction.phone_e164 ?? "",
    ]);

    const csvContent = [header, ...rows]
      .map((columns) =>
        columns
          .map((value) => {
            const cell = value == null ? "" : String(value);
            if (cell.includes("\"") || cell.includes(";") || cell.includes(",") || cell.includes("\n")) {
              return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
          })
          .join(";")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    link.href = url;
    link.download = `transacoes-${now.getFullYear()}-${month}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Exportação concluída",
      description: "As transações do mês foram exportadas em CSV.",
    });
  };

  const handleResetCurrentMonth = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Vínculo ausente",
        description: "Não foi possível identificar o telefone vinculado ao usuário.",
      });
      return;
    }

    const identifierValue = identifierField === "user" ? userIdentifier : user.id;
    if (!identifierValue) {
      toast({
        variant: "destructive",
        title: "Vínculo ausente",
        description: "Não foi possível identificar o telefone vinculado ao usuário.",
      });
      return;
    }

    if (!hasMonthlyTransactions) {
      toast({
        variant: "destructive",
        title: "Nenhuma transação",
        description: "Não há transações para remover no mês atual.",
      });
      return;
    }

    const confirmReset = window.confirm(
      "Tem certeza de que deseja remover todas as transações do mês atual? Esta ação não pode ser desfeita."
    );

    if (!confirmReset) {
      return;
    }

    setResetLoading(true);

    try {
      const { start, endExclusive } = currentMonthRange;
      const { error } = await supabase
        .from("transacoes")
        .delete()
        .eq(identifierField, identifierValue)
        .gte("quando", start.toISOString())
        .lt("quando", endExclusive.toISOString());

      if (error) throw error;

      setTransactions((prev) =>
        prev.filter((transaction) => {
          const date = parseQuandoToDate(transaction.quando);
          if (!date) return true;
          return !isWithinInterval(date, {
            start,
            end: new Date(endExclusive.getTime() - 1),
          });
        })
      );

      toast({
        title: "Mês reiniciado",
        description: "As transações do mês atual foram removidas.",
      });
    } catch (error: any) {
      console.error("Error resetting month:", error);
      toast({
        variant: "destructive",
        title: "Erro ao resetar",
        description: error.message,
      });
    } finally {
      setResetLoading(false);
    }
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

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card border border-border rounded-xl shadow-card p-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Gerenciar transações do mês</h2>
            <p className="text-sm text-muted-foreground">
              Exporte suas transações atuais ou limpe o mês para começar um novo período.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportCurrentMonth}
              disabled={!hasMonthlyTransactions}
            >
              Exportar mês em CSV
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleResetCurrentMonth}
              disabled={resetLoading || !hasMonthlyTransactions}
            >
              {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resetar mês"}
            </Button>
          </div>
        </div>

        {!userIdentifier && isAdmin && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/40">
            <AlertTitle>Telefone não vinculado</AlertTitle>
            <AlertDescription>
              Apenas administradores precisam conectar um número do WhatsApp para sincronizar transações. Cadastre o vínculo na
              tabela{" "}
              <code className="mx-1 rounded bg-muted px-1 py-0.5">whatsapp_links</code> ou solicite ao administrador.
            </AlertDescription>
          </Alert>
        )}

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
