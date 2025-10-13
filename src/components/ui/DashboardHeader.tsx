import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { LogOut, TrendingUp } from "lucide-react";

interface DashboardHeaderProps {
  user: User | null;
  onSignOut: () => void;
}

const DashboardHeader = ({ user, onSignOut }: DashboardHeaderProps) => {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-card">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-primary">
            <TrendingUp className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Dashboard Financeiro
            </h1>
            <p className="text-sm text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </div>
        <Button
          onClick={onSignOut}
          variant="outline"
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </header>
  );
};

export default DashboardHeader;
