import { useEffect, useState } from "react";
import { Users, Plane, DollarSign, Activity } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { StatCard } from "@/components/StatCard";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalClients: 0,
    totalTrips: 0,
    totalRevenue: 0,
    activeTrips: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const [clients, trips, payments] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("trips").select("id, end_date"),
        supabase.from("payments").select("amount_paid"),
      ]);

      const totalRevenue = payments.data?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;
      const activeTrips = trips.data?.filter(t => new Date(t.end_date) >= new Date()).length || 0;

      setStats({
        totalClients: clients.count || 0,
        totalTrips: trips.data?.length || 0,
        totalRevenue,
        activeTrips,
      });
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da sua agência</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total de Clientes" value={stats.totalClients} icon={Users} />
        <StatCard title="Total de Viagens" value={stats.totalTrips} icon={Plane} />
        <StatCard
          title="Receita Total"
          value={`R$ ${stats.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
        />
        <StatCard title="Viagens Ativas" value={stats.activeTrips} icon={Activity} />
      </div>
    </div>
  );
}
