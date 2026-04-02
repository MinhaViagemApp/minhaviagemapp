import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  requiredRole?: string;
}

export default function AppLayout({ requiredRole }: AppLayoutProps) {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!userRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="glass-strong max-w-md rounded-2xl p-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">Carregando seu acesso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Estamos sincronizando seu perfil para liberar o painel.
          </p>
        </div>
      </div>
    );
  }

  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to={userRole === "admin" ? "/admin" : "/client"} replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="glass flex h-14 items-center justify-between border-b border-border/50 px-4">
            <SidebarTrigger className="text-muted-foreground" />
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <Bell className="h-5 w-5" />
              </Button>
              <div className="gradient-primary flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-primary-foreground">
                {user.email?.charAt(0).toUpperCase()}
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
