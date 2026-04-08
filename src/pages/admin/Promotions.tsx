import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Tag, Calendar, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";

interface Promotion {
  id: string;
  title: string;
  description: string;
  expires_at: string;
  image: string | null;
}

export default function AdminPromotions() {
  const { companyId } = useAuth();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", expires_at: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetch_ = async () => {
    if (!companyId) return;
    const { data } = await supabase.from("promotions").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
    setPromotions(data || []);
  };

  useEffect(() => { fetch_(); }, [companyId]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    if (!companyId) return;
    setSaving(true);

    let imageUrl: string | null = null;

    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `${companyId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("promotion-images").upload(path, imageFile);
      if (upErr) { toast.error("Erro ao enviar imagem: " + upErr.message); setSaving(false); return; }
      const { data: urlData } = supabase.storage.from("promotion-images").getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }

    const { error } = await supabase.from("promotions").insert({
      ...form,
      company_id: companyId,
      image: imageUrl,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Promoção criada!");
    setOpen(false);
    setForm({ title: "", description: "", expires_at: "" });
    setImageFile(null);
    setImagePreview(null);
    setSaving(false);
    fetch_();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Promoções</h1>
          <p className="text-muted-foreground">Ofertas exclusivas para seus clientes</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setImageFile(null); setImagePreview(null); } }}>
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
              <div className="space-y-2">
                <Label>Imagem do destino</Label>
                {imagePreview ? (
                  <div className="relative rounded-lg overflow-hidden border border-border/50">
                    <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover" />
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute top-2 right-2 h-7 w-7"
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(null); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <label className="block cursor-pointer rounded-md border border-input bg-secondary/50 px-4 py-3 text-sm transition-colors hover:bg-secondary">
                    <input accept=".jpg,.jpeg,.png,image/jpeg,image/png" className="hidden" type="file" onChange={handleImageSelect} />
                    <span className="flex items-center gap-2 text-foreground">
                      <ImagePlus className="h-4 w-4" />
                      Selecionar imagem (JPG ou PNG, até 5MB)
                    </span>
                  </label>
                )}
              </div>
              <Button onClick={handleCreate} disabled={saving} className="w-full gradient-accent">
                {saving ? "Salvando..." : "Criar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {promotions.map((promo) => (
          <Card key={promo.id} className="glass animate-fade-in overflow-hidden">
            {promo.image && (
              <img src={promo.image} alt={promo.title} className="w-full h-40 object-cover" />
            )}
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Tag className="h-4 w-4 text-accent" />
                {promo.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{promo.description}</p>
              {promo.expires_at && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Válida até {new Date(promo.expires_at).toLocaleDateString("pt-BR")}
                </div>
              )}
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
