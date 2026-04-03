import { useEffect, useState } from "react";
import { Users, Plane, DollarSign, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ClientRow { id: string; name: string; email: string; phone: string | null; created_at: string }
interface TripRow { id: string; destination: string; start_date: string; end_date: string; total_price: number; user_id: string; client_name?: string }
interface PaymentRow { id: string; amount_paid: number; paid_at: string; trip_id: string; destination?: string }

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalClients: 0, totalTrips: 0, totalRevenue: 0, activeTrips: 0 });
  const [modal, setModal] = useState<"clients" | "trips" | "revenue" | "active" | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const [cRes, tRes, pRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("trips").select("id, end_date"),
        supabase.from("payments").select("amount_paid"),
      ]);
      const totalRevenue = pRes.data?.reduce((s, p) => s + Number(p.amount_paid), 0) || 0;
      const activeTrips = tRes.data?.filter(t => new Date(t.end_date) >= new Date()).length || 0;
      setStats({ totalClients: cRes.count || 0, totalTrips: tRes.data?.length || 0, totalRevenue, activeTrips });
    };
    fetchStats();
  }, []);

  const openModal = async (type: typeof modal) => {
    setModal(type);
    if (type === "clients") {
      const { data } = await supabase.from("profiles").select("id, name, email, phone, created_at").order("created_at", { ascending: false });
      setClients(data || []);
    } else if (type === "trips" || type === "active") {
      const { data } = await supabase.from("trips").select("*").order("start_date", { ascending: false });
      const allTrips = data || [];
      const userIds = [...new Set(allTrips.map(t => t.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", userIds);
      const pMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
      const mapped = allTrips.map(t => ({ ...t, client_name: pMap.get(t.user_id) || "—" }));
      setTrips(type === "active" ? mapped.filter(t => new Date(t.end_date) >= new Date()) : mapped);
    } else if (type === "revenue") {
      const { data } = await supabase.from("payments").select("*, trips(destination)").order("paid_at", { ascending: false });
      setPayments((data || []).map((p: any) => ({ ...p, destination: p.trips?.destination })));
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
              <TableHead>Destino</TableHead><TableHead>Cliente</TableHead><TableHead>Período</TableHead><TableHead>Valor</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {trips.map(t => (
                <TableRow key={t.id} className="border-border/50">
                  <TableCell className="font-medium">{t.destination}</TableCell>
                  <TableCell>{t.client_name}</TableCell>
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
              <TableHead>Destino</TableHead><TableHead>Valor</TableHead><TableHead>Data</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {payments.map(p => (
                <TableRow key={p.id} className="border-border/50">
                  <TableCell>{p.destination || "—"}</TableCell>
                  <TableCell>R$ {Number(p.amount_paid).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>{new Date(p.paid_at).toLocaleDateString("pt-BR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
