import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { Building2, Users, Plane, MousePointerClick, DollarSign, Activity, UserCheck, UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Stats {
  totalAgencies: number;
  activeAgencies: number;
  inactiveAgencies: number;
  totalClients: number;
  totalTrips: number;
  totalRevenue: number;
  clicks30d: number;
  clicks7d: number;
  clicksTotal: number;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalAgencies: 0, activeAgencies: 0, inactiveAgencies: 0,
    totalClients: 0, totalTrips: 0, totalRevenue: 0,
    clicks30d: 0, clicks7d: 0, clicksTotal: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const since7 = new Date(Date.now() - 7 * 86400000).toISOString();

      const [companies, clients, trips, payments, clicksTotal, clicks30, clicks7, recentTrips, recentBookings] = await Promise.all([
        supabase.from("companies").select("id"),
        supabase.from("clients").select("id"),
        supabase.from("trips").select("id"),
        supabase.from("payments").select("amount_paid"),
        supabase.from("link_clicks").select("id", { count: "exact", head: true }),
        supabase.from("link_clicks").select("id", { count: "exact", head: true }).gte("created_at", since30),
        supabase.from("link_clicks").select("id", { count: "exact", head: true }).gte("created_at", since7),
        supabase.from("trips").select("company_id, updated_at").gte("updated_at", since30),
        supabase.from("bookings").select("client_id, created_at, clients!inner(company_id)").gte("created_at", since30),
      ]);

      const activeCompanyIds = new Set<string>();
      (recentTrips.data || []).forEach((t: any) => t.company_id && activeCompanyIds.add(t.company_id));
      (recentBookings.data || []).forEach((b: any) => b.clients?.company_id && activeCompanyIds.add(b.clients.company_id));

      const total = (companies.data || []).length;
      const active = activeCompanyIds.size;
      const revenue = (payments.data || []).reduce((s: number, p: any) => s + Number(p.amount_paid || 0), 0);

      setStats({
        totalAgencies: total,
        activeAgencies: active,
        inactiveAgencies: Math.max(0, total - active),
        totalClients: (clients.data || []).length,
        totalTrips: (trips.data || []).length,
        totalRevenue: revenue,
        clicksTotal: clicksTotal.count || 0,
        clicks30d: clicks30.count || 0,
        clicks7d: clicks7.count || 0,
      });
      setLoading(false);
    })();
  }, []);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-accent-text">Visão Geral</h1>
        <p className="text-muted-foreground">Métricas globais de todas as agências</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard title="Agências (total)" value={String(stats.totalAgencies)} icon={Building2} />
        <StatCard title="Ativas (30d)" value={String(stats.activeAgencies)} icon={UserCheck} />
        <StatCard title="Inativas" value={String(stats.inactiveAgencies)} icon={UserX} />
        <StatCard title="Clientes finais" value={String(stats.totalClients)} icon={Users} />
        <StatCard title="Viagens" value={String(stats.totalTrips)} icon={Plane} />
        <StatCard title="Receita transacionada" value={fmt(stats.totalRevenue)} icon={DollarSign} />
        <StatCard title="Cliques (total)" value={String(stats.clicksTotal)} icon={MousePointerClick} />
        <StatCard title="Cliques (7d)" value={String(stats.clicks7d)} icon={Activity} />
      </div>

      <Card className="glass-strong">
        <CardHeader><CardTitle>Como divulgar</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Use estes links para rastrear cliques por canal:</p>
          <code className="block bg-secondary/40 rounded p-2">{`${window.location.origin}/r/instagram`}</code>
          <code className="block bg-secondary/40 rounded p-2">{`${window.location.origin}/r/whatsapp`}</code>
          <code className="block bg-secondary/40 rounded p-2">{`${window.location.origin}/r/google-ads?campaign=lancamento`}</code>
          <p className="text-xs">Cada acesso é registrado em <strong>Cliques & Campanhas</strong>.</p>
        </CardContent>
      </Card>
    </div>
  );
}
