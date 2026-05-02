import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sendNotification } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Tag, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Coupon {
  id: string;
  code: string;
  discount_percent: number;
  expires_at: string | null;
  cash_only: boolean;
  active: boolean;
  created_at: string;
  usage_limit: number | null;
  usage_count: number;
}

const empty = { code: "", discount_percent: "10", expires_at: "", cash_only: true, active: true, usage_limit: "" };

export default function AdminCoupons() {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setCoupons(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.code.trim()) { toast.error("Informe o código do cupom."); return; }
    const pct = parseFloat(form.discount_percent);
    if (!pct || pct <= 0 || pct > 100) { toast.error("Percentual inválido (1-100)."); return; }
    let limit: number | null = null;
    if (form.usage_limit !== "" && form.usage_limit !== null) {
      const n = parseInt(form.usage_limit);
      if (isNaN(n) || n <= 0) { toast.error("Quantidade liberada deve ser um número maior que zero."); return; }
      limit = n;
    }
    setSaving(true);
    const { data: companyId } = await supabase.rpc("get_user_company_id", { _user_id: user?.id || "00000000-0000-0000-0000-000000000000" });
    if (!companyId) { toast.error("Empresa não encontrada."); setSaving(false); return; }
    const { error } = await (supabase as any).from("coupons").insert({
      company_id: companyId,
      code: form.code.trim().toUpperCase(),
      discount_percent: pct,
      expires_at: form.expires_at || null,
      cash_only: form.cash_only,
      active: form.active,
      usage_limit: limit,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Cupom criado!");
    void sendNotification({
      title: "Novo cupom de desconto! 🎟️",
      body: `Use o código ${form.code.trim().toUpperCase()} e ganhe ${pct}% de desconto.`,
      url: "/client/promotions",
      tag: `coupon-${form.code.trim().toUpperCase()}`,
      broadcast: true,
    });
    setForm(empty);
    setOpen(false);
    load();
  };

  const toggleActive = async (c: Coupon) => {
    const { error } = await (supabase as any).from("coupons").update({ active: !c.active }).eq("id", c.id);
    if (error) toast.error(error.message);
    else load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este cupom?")) return;
    const { error } = await (supabase as any).from("coupons").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Cupom removido."); load(); }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black gradient-primary-text">Cupons de Desconto</h1>
          <p className="text-sm text-muted-foreground">Gerencie cupons promocionais da sua agência.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-accent"><Plus className="h-4 w-4 mr-2" /> Novo Cupom</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Cupom</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Código <span className="text-destructive">*</span></Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Ex: VERAO10" className="bg-secondary/50 uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Desconto (%) <span className="text-destructive">*</span></Label>
                  <Input type="number" min="1" max="100" step="0.5" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} className="bg-secondary/50" />
                </div>
                <div className="space-y-2">
                  <Label>Validade</Label>
                  <Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="bg-secondary/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Quantidade liberada</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={form.usage_limit}
                  onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                  placeholder="Deixe vazio para ilimitado"
                  className="bg-secondary/50"
                />
                <p className="text-xs text-muted-foreground">Quando atingir essa quantidade, o cupom será desativado automaticamente.</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
                <div>
                  <Label className="cursor-pointer">Apenas pagamento à vista</Label>
                  <p className="text-xs text-muted-foreground">Cupom só pode ser usado em PIX, Dinheiro ou 1x.</p>
                </div>
                <Switch checked={form.cash_only} onCheckedChange={(v) => setForm({ ...form, cash_only: v })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
                <Label className="cursor-pointer">Ativo</Label>
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
              <Button onClick={handleCreate} disabled={saving} className="w-full gradient-accent">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Criar Cupom
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : coupons.length === 0 ? (
        <Card className="glass-strong"><CardContent className="py-12 text-center space-y-2">
          <Tag className="h-10 w-10 mx-auto text-muted-foreground opacity-60" />
          <p className="font-semibold">Nenhum cupom cadastrado</p>
          <p className="text-sm text-muted-foreground">Crie o primeiro cupom para oferecer descontos.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map((c) => {
            const expired = c.expires_at && new Date(c.expires_at) < new Date();
            return (
              <Card key={c.id} className={`glass-strong ${!c.active || expired ? "opacity-60" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Tag className="h-4 w-4 text-accent" />
                      <span className="font-mono">{c.code}</span>
                    </CardTitle>
                    <Badge variant="outline" className={c.active && !expired ? "border-emerald-500 text-emerald-400" : "border-muted text-muted-foreground"}>
                      {expired ? "Expirado" : c.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-2xl font-black text-accent">{c.discount_percent}% OFF</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Validade: {c.expires_at ? new Date(c.expires_at).toLocaleDateString("pt-BR") : "Sem validade"}</p>
                    <p>{c.cash_only ? "Apenas à vista" : "Qualquer pagamento"}</p>
                    <p>
                      Usos: <span className="font-bold text-foreground">{c.usage_count ?? 0}</span>
                      {c.usage_limit ? ` / ${c.usage_limit}` : " (ilimitado)"}
                    </p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => toggleActive(c)} className="flex-1">
                      {c.active ? "Desativar" : "Ativar"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(c.id)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
