import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import StatsCards from "@/components/dashboard/StatsCards";
import TransactionsList from "@/components/dashboard/TransactionsList";
import CategoryChart from "@/components/dashboard/CategoryChart";
import { Loader2 } from "lucide-react";

export interface Transaction {
  id: string;
  created_at: string;
  quando: string;
  user_id: string;
  estabelecimento: string;
  valor: number;
  detalhes: string | null;
  tipo: "receita" | "despesa";
  categoria: string;
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      // Check if user is admin
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleError) {
        console.error("Error checking role:", roleError);
      }

      const userIsAdmin = !!roleData;
      setIsAdmin(userIsAdmin);

      if (!userIsAdmin) {
        toast({
          variant: "destructive",
          title: "Acesso negado",
          description: "Você precisa ser admin para acessar o dashboard.",
        });
        await supabase.auth.signOut();
        navigate("/auth");
        return;
      }

      // Fetch transactions
      await fetchTransactions();

      // Set up auth state listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (event === "SIGNED_OUT") {
            navigate("/auth");
          }
          setUser(session?.user ?? null);
        }
      );

      return () => subscription.unsubscribe();
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
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("transacoes")
        .select("*")
        .order("quando", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      console.error("Error fetching transactions:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar transações",
        description: error.message,
      });
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

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <DashboardHeader user={user} onSignOut={handleSignOut} />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        <StatsCards transactions={transactions} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <TransactionsList transactions={transactions} />
          </div>
          <div className="lg:col-span-1">
            <CategoryChart transactions={transactions} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
