import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

export default function Index() {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const dest = userRole === "superadmin" ? "/superadmin" : userRole === "admin" ? "/admin" : "/client";
  return <Navigate to={dest} replace />;
}
