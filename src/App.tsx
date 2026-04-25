import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import AppLayout from "./layouts/AppLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminClients from "./pages/admin/Clients";
import AdminTrips from "./pages/admin/Trips";
import AdminPayments from "./pages/admin/Payments";
import AdminPromotions from "./pages/admin/Promotions";
import ClientDashboard from "./pages/client/Dashboard";
import ClientPayments from "./pages/client/Payments";
import ClientPromotions from "./pages/client/Promotions";
import ClientNotifications from "./pages/client/Notifications";
import ClientMyTrips from "./pages/client/MyTrips";
import CompanyProfile from "./pages/CompanyProfile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/admin" element={<AppLayout requiredRole="admin" />}>
              <Route index element={<AdminDashboard />} />
              <Route path="clients" element={<AdminClients />} />
              <Route path="trips" element={<AdminTrips />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="promotions" element={<AdminPromotions />} />
              <Route path="profile" element={<CompanyProfile />} />
            </Route>

            <Route path="/client" element={<AppLayout requiredRole="cliente" />}>
              <Route index element={<ClientDashboard />} />
              <Route path="my-trips" element={<ClientMyTrips />} />
              <Route path="payments" element={<ClientPayments />} />
              <Route path="promotions" element={<ClientPromotions />} />
              <Route path="notifications" element={<ClientNotifications />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
