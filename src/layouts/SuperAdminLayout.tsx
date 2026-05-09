import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SuperAdminSidebar } from "@/components/SuperAdminSidebar";
import { useAuth } from "@/contexts/AuthContext";

export default function SuperAdminLayout() {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (userRole !== "superadmin") {
    return <Navigate to={userRole === "admin" ? "/admin" : "/client"} replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <SuperAdminSidebar />
        <div className="flex flex-1 flex-col">
          <header className="glass flex h-14 items-center justify-between border-b border-border/50 px-4">
            <SidebarTrigger className="text-muted-foreground" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>
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
