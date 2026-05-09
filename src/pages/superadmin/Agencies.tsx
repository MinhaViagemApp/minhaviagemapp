import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Agency {
  id: string;
  name: string;
  created_at: string;
  admin_email?: string | null;
  clients_count: number;
  trips_count: number;
  last_activity?: string | null;
  plan?: string;
  status?: string;
}

export default function SuperAdminAgencies() {
  const [rows, setRows] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [companies, members, profiles, clients, trips, subs] = await Promise.all([
        supabase.from("companies").select("id, name, created_at"),
        supabase.from("user_companies").select("user_id, company_id"),
        supabase.from("profiles").select("id, email"),
        supabase.from("clients").select("id, company_id"),
        supabase.from("trips").select("company_id, updated_at"),
        supabase.from("agency_subscriptions").select("company_id, plan, status"),
      ]);

      const profileById = new Map((profiles.data || []).map((p: any) => [p.id, p.email]));
      const adminByCompany = new Map<string, string>();
      (members.data || []).forEach((m: any) => {
        if (!adminByCompany.has(m.company_id)) {
          const email = profileById.get(m.user_id);
          if (email) adminByCompany.set(m.company_id, email);
        }
      });

      const clientsByCompany = new Map<string, number>();
      (clients.data || []).forEach((c: any) => {
        clientsByCompany.set(c.company_id, (clientsByCompany.get(c.company_id) || 0) + 1);
      });

      const tripsByCompany = new Map<string, number>();
      const lastActivity = new Map<string, string>();
      (trips.data || []).forEach((t: any) => {
        tripsByCompany.set(t.company_id, (tripsByCompany.get(t.company_id) || 0) + 1);
        const cur = lastActivity.get(t.company_id);
        if (!cur || t.updated_at > cur) lastActivity.set(t.company_id, t.updated_at);
      });

      const subByCompany = new Map((subs.data || []).map((s: any) => [s.company_id, s]));

      const result: Agency[] = (companies.data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        created_at: c.created_at,
        admin_email: adminByCompany.get(c.id) ?? null,
        clients_count: clientsByCompany.get(c.id) || 0,
        trips_count: tripsByCompany.get(c.id) || 0,
        last_activity: lastActivity.get(c.id) ?? null,
        plan: subByCompany.get(c.id)?.plan ?? "free",
        status: subByCompany.get(c.id)?.status ?? "trial",
      }));

      setRows(result);
      setLoading(false);
    })();
  }, []);

  const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
  const isActive = (d?: string | null) => {
    if (!d) return false;
    return new Date(d).getTime() > Date.now() - 30 * 86400000;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-accent-text">Agências</h1>
        <p className="text-muted-foreground">Todas as agências cadastradas</p>
      </div>

      <Card className="glass-strong">
        <CardHeader><CardTitle>Lista de agências ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail admin</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead className="text-right">Clientes</TableHead>
                    <TableHead className="text-right">Viagens</TableHead>
                    <TableHead>Última atividade</TableHead>
                    <TableHead>Criada em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-xs">{r.admin_email || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{r.plan}</Badge></TableCell>
                      <TableCell><Badge>{r.status}</Badge></TableCell>
                      <TableCell>
                        {isActive(r.last_activity)
                          ? <Badge className="bg-green-500/20 text-green-400">Ativa</Badge>
                          : <Badge variant="secondary">Inativa</Badge>}
                      </TableCell>
                      <TableCell className="text-right">{r.clients_count}</TableCell>
                      <TableCell className="text-right">{r.trips_count}</TableCell>
                      <TableCell>{fmtDate(r.last_activity)}</TableCell>
                      <TableCell>{fmtDate(r.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
