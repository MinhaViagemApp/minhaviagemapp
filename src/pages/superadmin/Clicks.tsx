import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { MousePointerClick, Activity, TrendingUp } from "lucide-react";

interface Click { id: string; source: string; campaign: string | null; created_at: string; referrer: string | null; user_agent: string | null }

export default function SuperAdminClicks() {
  const [clicks, setClicks] = useState<Click[]>([]);
  const [bySource, setBySource] = useState<{ source: string; count: number }[]>([]);
  const [byDay, setByDay] = useState<{ day: string; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("link_clicks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      const list = (data as Click[]) || [];
      setClicks(list);

      const srcMap = new Map<string, number>();
      const dayMap = new Map<string, number>();
      list.forEach((c) => {
        srcMap.set(c.source, (srcMap.get(c.source) || 0) + 1);
        const day = c.created_at.slice(0, 10);
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      });
      setBySource([...srcMap.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count));
      setByDay([...dayMap.entries()].map(([day, count]) => ({ day, count })).sort((a, b) => b.day.localeCompare(a.day)).slice(0, 14).reverse());
    })();
  }, []);

  const total = clicks.length;
  const last7 = clicks.filter((c) => new Date(c.created_at).getTime() > Date.now() - 7 * 86400000).length;
  const today = clicks.filter((c) => c.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;

  const maxDay = Math.max(...byDay.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-accent-text">Cliques & Campanhas</h1>
        <p className="text-muted-foreground">Origem do tráfego nos seus links de divulgação</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total de cliques" value={String(total)} icon={MousePointerClick} />
        <StatCard title="Últimos 7 dias" value={String(last7)} icon={Activity} />
        <StatCard title="Hoje" value={String(today)} icon={TrendingUp} />
      </div>

      <Card className="glass-strong">
        <CardHeader><CardTitle>Cliques por dia (últimos 14)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-40">
            {byDay.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-primary/60 rounded-t"
                  style={{ height: `${(d.count / maxDay) * 100}%` }}
                  title={`${d.count} cliques`}
                />
                <span className="text-[10px] text-muted-foreground">{d.day.slice(5)}</span>
              </div>
            ))}
            {byDay.length === 0 && <p className="text-muted-foreground">Sem dados ainda.</p>}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="glass-strong">
          <CardHeader><CardTitle>Por origem</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Origem</TableHead><TableHead className="text-right">Cliques</TableHead></TableRow></TableHeader>
              <TableBody>
                {bySource.map((s) => (
                  <TableRow key={s.source}>
                    <TableCell>{s.source}</TableCell>
                    <TableCell className="text-right">{s.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="glass-strong">
          <CardHeader><CardTitle>Últimos cliques</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Quando</TableHead><TableHead>Origem</TableHead><TableHead>Campanha</TableHead></TableRow></TableHeader>
                <TableBody>
                  {clicks.slice(0, 20).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{new Date(c.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>{c.source}</TableCell>
                      <TableCell>{c.campaign || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
