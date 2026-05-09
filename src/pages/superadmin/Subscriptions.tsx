import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Sub {
  id: string;
  company_id: string;
  plan: string;
  status: string;
  monthly_amount: number;
  current_period_end: string | null;
  started_at: string;
  company_name?: string;
}

export default function SuperAdminSubscriptions() {
  const [rows, setRows] = useState<Sub[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ company_id: "", plan: "free", status: "trial", monthly_amount: 0 });

  const load = async () => {
    const [subs, comps] = await Promise.all([
      supabase.from("agency_subscriptions").select("*").order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name"),
    ]);
    const compMap = new Map((comps.data || []).map((c: any) => [c.id, c.name]));
    setCompanies(comps.data || []);
    setRows((subs.data || []).map((s: any) => ({ ...s, company_name: compMap.get(s.company_id) })));
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.company_id) { toast.error("Selecione uma agência."); return; }
    const { error } = await supabase
      .from("agency_subscriptions")
      .upsert({ ...form }, { onConflict: "company_id" });
    if (error) { toast.error(error.message); return; }
    toast.success("Assinatura salva.");
    setOpen(false);
    setForm({ company_id: "", plan: "free", status: "trial", monthly_amount: 0 });
    load();
  };

  const fmt = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-accent-text">Assinaturas</h1>
          <p className="text-muted-foreground">Planos e status de cobrança das agências</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground">Nova / Editar</Button>
          </DialogTrigger>
          <DialogContent className="glass-strong">
            <DialogHeader><DialogTitle>Plano da agência</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Agência</Label>
                <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plano</Label>
                <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="inactive">Inativa</SelectItem>
                    <SelectItem value="canceled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mensalidade (R$)</Label>
                <Input type="number" step="0.01" value={form.monthly_amount}
                  onChange={(e) => setForm({ ...form, monthly_amount: Number(e.target.value) })} />
              </div>
              <Button onClick={save} className="w-full gradient-primary text-primary-foreground">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass-strong">
        <CardHeader><CardTitle>{rows.length} assinatura(s)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agência</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Mensalidade</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Próx. cobrança</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.company_name || r.company_id}</TableCell>
                    <TableCell><Badge variant="outline">{r.plan}</Badge></TableCell>
                    <TableCell><Badge>{r.status}</Badge></TableCell>
                    <TableCell className="text-right">{fmt(r.monthly_amount)}</TableCell>
                    <TableCell>{new Date(r.started_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{r.current_period_end ? new Date(r.current_period_end).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhuma assinatura cadastrada. Quando integrarmos pagamentos, isso será preenchido automaticamente.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
