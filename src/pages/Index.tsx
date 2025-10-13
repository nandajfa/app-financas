import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TrendingUp, BarChart3, PieChart, Shield } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-4 rounded-2xl bg-gradient-primary shadow-elegant">
              <TrendingUp className="h-12 w-12 text-primary-foreground" />
            </div>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Dashboard Financeiro
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Controle total das suas finanças em um só lugar. Visualize receitas, despesas e análises detalhadas.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-gradient-primary hover:opacity-90 transition-opacity text-lg px-8"
            >
              Acessar Dashboard
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-16">
            <div className="p-6 rounded-xl border border-border bg-card shadow-card hover:shadow-elegant transition-shadow">
              <div className="p-3 rounded-lg bg-success/10 w-fit mx-auto mb-4">
                <BarChart3 className="h-8 w-8 text-success" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Análise Completa</h3>
              <p className="text-sm text-muted-foreground">
                Visualize suas transações com gráficos e métricas detalhadas
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card shadow-card hover:shadow-elegant transition-shadow">
              <div className="p-3 rounded-lg bg-primary/10 w-fit mx-auto mb-4">
                <PieChart className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Por Categoria</h3>
              <p className="text-sm text-muted-foreground">
                Organize e acompanhe gastos por diferentes categorias
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card shadow-card hover:shadow-elegant transition-shadow">
              <div className="p-3 rounded-lg bg-accent/10 w-fit mx-auto mb-4">
                <Shield className="h-8 w-8 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Seguro e Privado</h3>
              <p className="text-sm text-muted-foreground">
                Seus dados financeiros protegidos com autenticação segura
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
