import { useEffect, useState } from "react";
import { Users, Plane, DollarSign, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatCard } from "@/components/StatCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BusSeatSection } from "@/components/admin/BusSeatSection";

export default function AdminDashboard() {
  const { companyId } = useAuth();
  const [stats, setStats] = useState({ totalClients: 0, totalTrips: 0, totalRevenue: 0, activeTrips: 0 });
  const [modal, setModal] = useState<"clients" | "trips" | "revenue" | "active" | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    if (!companyId) return;
    const fetchStats = async () => {
      const [cRes, tRes, bRes] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("trips").select("id, end_date").eq("company_id", companyId),
        supabase.from("bookings").select("total_value, payment_status, clients!inner(company_id)").eq("clients.company_id", companyId),
      ]);
      const paidBookings = (bRes.data || []).filter((b: any) => b.payment_status === "pago");
      const totalRevenue = paidBookings.reduce((s: number, b: any) => s + Number(b.total_value), 0);
      const activeTrips = tRes.data?.filter(t => new Date(t.end_date) >= new Date()).length || 0;
      setStats({ totalClients: cRes.count || 0, totalTrips: tRes.data?.length || 0, totalRevenue, activeTrips });
    };
    fetchStats();
  }, [companyId]);

  const openModal = async (type: typeof modal) => {
    if (!companyId) return;
    setModal(type);
    if (type === "clients") {
      const { data } = await supabase.from("clients").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
      setClients(data || []);
    } else if (type === "trips" || type === "active") {
      const { data } = await supabase.from("trips").select("*").eq("company_id", companyId).order("start_date", { ascending: false });
      setTrips(type === "active" ? (data || []).filter(t => new Date(t.end_date) >= new Date()) : data || []);
    } else if (type === "revenue") {
      const { data } = await supabase
        .from("bookings")
        .select("*, clients!inner(name, company_id), trips!inner(destination)")
        .eq("clients.company_id", companyId)
        .eq("payment_status", "pago")
        .order("created_at", { ascending: false });
      setBookings(data || []);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da sua agência</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="cursor-pointer" onClick={() => openModal("clients")}>
          <StatCard title="Total de Clientes" value={stats.totalClients} icon={Users} />
        </div>
        <div className="cursor-pointer" onClick={() => openModal("trips")}>
          <StatCard title="Total de Viagens" value={stats.totalTrips} icon={Plane} />
        </div>
        <div className="cursor-pointer" onClick={() => openModal("revenue")}>
          <StatCard title="Receita Total" value={`R$ ${stats.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={DollarSign} />
        </div>
        <div className="cursor-pointer" onClick={() => openModal("active")}>
          <StatCard title="Viagens Ativas" value={stats.activeTrips} icon={Activity} />
        </div>
      </div>

      <BusSeatSection />

      {/* Clients Modal */}
      <Dialog open={modal === "clients"} onOpenChange={() => setModal(null)}>
        <DialogContent className="glass-strong max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Todos os Clientes</DialogTitle></DialogHeader>
          <Table>
            <TableHeader><TableRow className="border-border/50">
              <TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Telefone</TableHead><TableHead>Cadastro</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {clients.map(c => (
                <TableRow key={c.id} className="border-border/50">
                  <TableCell className="font-medium">{c.name || "—"}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell>{new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Trips Modal */}
      <Dialog open={modal === "trips" || modal === "active"} onOpenChange={() => setModal(null)}>
        <DialogContent className="glass-strong max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{modal === "active" ? "Viagens Ativas" : "Todas as Viagens"}</DialogTitle></DialogHeader>
          <Table>
            <TableHeader><TableRow className="border-border/50">
              <TableHead>Destino</TableHead><TableHead>Período</TableHead><TableHead>Valor</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {trips.map(t => (
                <TableRow key={t.id} className="border-border/50">
                  <TableCell className="font-medium">{t.destination}</TableCell>
                  <TableCell>{new Date(t.start_date).toLocaleDateString("pt-BR")} - {new Date(t.end_date).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>R$ {Number(t.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Revenue Modal */}
      <Dialog open={modal === "revenue"} onOpenChange={() => setModal(null)}>
        <DialogContent className="glass-strong max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Receita Detalhada</DialogTitle></DialogHeader>
          <Table>
            <TableHeader><TableRow className="border-border/50">
              <TableHead>Cliente</TableHead><TableHead>Destino</TableHead><TableHead>Valor</TableHead><TableHead>Data</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {bookings.map((b: any) => (
                <TableRow key={b.id} className="border-border/50">
                  <TableCell>{b.clients?.name || "—"}</TableCell>
                  <TableCell>{b.trips?.destination || "—"}</TableCell>
                  <TableCell>R$ {Number(b.total_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>{new Date(b.created_at).toLocaleDateString("pt-BR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
