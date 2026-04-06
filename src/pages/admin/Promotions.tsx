import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Tag, Calendar } from "lucide-react";
import { toast } from "sonner";

interface Promotion {
  id: string;
  title: string;
  description: string;
  expires_at: string;
}

export default function AdminPromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", expires_at: "" });

  const fetch_ = async () => {
    const { data } = await supabase.from("promotions").select("*").order("created_at", { ascending: false });
    setPromotions(data || []);
  };

  useEffect(() => { fetch_(); }, []);

  const handleCreate = async () => {
    const { error } = await supabase.from("promotions").insert(form);
    if (error) { toast.error(error.message); return; }
    toast.success("Promoção criada!");
    setOpen(false);
    setForm({ title: "", description: "", expires_at: "" });
    fetch_();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Promoções</h1>
          <p className="text-muted-foreground">Ofertas exclusivas para seus clientes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-accent"><Plus className="mr-2 h-4 w-4" /> Nova Promoção</Button>
          </DialogTrigger>
          <DialogContent className="glass-strong">
            <DialogHeader><DialogTitle>Nova Promoção</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-secondary/50" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-secondary/50" />
              </div>
              <div className="space-y-2">
                <Label>Validade</Label>
                <Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="bg-secondary/50" />
              </div>
              <Button onClick={handleCreate} className="w-full gradient-accent">Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {promotions.map((promo) => (
          <Card key={promo.id} className="glass animate-fade-in">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Tag className="h-4 w-4 text-accent" />
                {promo.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{promo.description}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Válida até {new Date(promo.expires_at).toLocaleDateString("pt-BR")}
              </div>
            </CardContent>
          </Card>
        ))}
        {promotions.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12">
            Nenhuma promoção criada
          </div>
        )}
      </div>
    </div>
  );
}
