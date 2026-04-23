import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Tag, Calendar, Image, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Promotion {
  id: string;
  title: string;
  description: string;
  expires_at: string;
  preview_image?: string;
}

const PROMOTION_DRAFT_KEY = "minha-viagem-admin-promotion-draft";
const emptyPromotionForm = { title: "", description: "", expires_at: "" };
const hasPromotionDraftContent = (draft: typeof emptyPromotionForm) =>
  Boolean(draft.title || draft.description || draft.expires_at);

export default function AdminPromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyPromotionForm);
  const [photoModal, setPhotoModal] = useState<Promotion | null>(null);
  const [photos, setPhotos] = useState<{ id: string; image_url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const fetch_ = async () => {
    const { data } = await supabase.from("promotions").select("*, promotion_images(image_url)").order("created_at", { ascending: false });
    const allPromos = data || [];
    setPromotions(allPromos.map(p => ({
      ...p,
      preview_image: (p as any).promotion_images?.[0]?.image_url || null
    })));
  };

  useEffect(() => { fetch_(); }, []);

  useEffect(() => {
    if (!open || !hasPromotionDraftContent(form)) return;
    localStorage.setItem(PROMOTION_DRAFT_KEY, JSON.stringify(form));
    setDraftSaved(true);
  }, [form, open]);

  const openCreate = () => {
    const savedDraft = localStorage.getItem(PROMOTION_DRAFT_KEY);
    setForm(savedDraft ? { ...emptyPromotionForm, ...JSON.parse(savedDraft) } : emptyPromotionForm);
    setDraftSaved(Boolean(savedDraft));
    setOpen(true);
  };

  const saveDraftAndClose = () => {
    if (hasPromotionDraftContent(form)) {
      localStorage.setItem(PROMOTION_DRAFT_KEY, JSON.stringify(form));
      toast.success("Rascunho da promoção salvo.");
    }
    setOpen(false);
  };

  const handleCreate = async () => {
    setIsCreating(true);
    const { data: promo, error } = await supabase.from("promotions").insert(form).select().single();
    if (error) { toast.error(error.message); setIsCreating(false); return; }
    
    if (selectedFiles.length > 0) {
      toast.info("Enviando imagens...");
      for (const file of selectedFiles) {
        const ext = file.name.split(".").pop();
        const filePath = `promotions/${promo.id}/${Date.now()}-${Math.random()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("promotions").upload(filePath, file, { upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("promotions").getPublicUrl(filePath);
          await supabase.from("promotion_images").insert({ promotion_id: promo.id, image_url: urlData.publicUrl });
        }
      }
    }

    toast.success("Promoção criada com sucesso!");
    setOpen(false);
    setForm(emptyPromotionForm);
    localStorage.removeItem(PROMOTION_DRAFT_KEY);
    setDraftSaved(false);
    setSelectedFiles([]);
    setIsCreating(false);
    fetch_();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (selectedFiles.length + newFiles.length > 10) {
        toast.error("Limite máximo de 10 fotos.");
        return;
      }
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeSelectedFile = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const openPhotos = async (promo: Promotion) => {
    setPhotoModal(promo);
    const { data } = await supabase.from("promotion_images").select("id, image_url").eq("promotion_id", promo.id);
    setPhotos(data || []);
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !photoModal) return;
    
    if (photos.length >= 10) {
      toast.error("Limite máximo de 10 fotos atingido para esta promoção!");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `promotions/${photoModal.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("promotions").upload(filePath, file, { upsert: true });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("promotions").getPublicUrl(filePath);
    await supabase.from("promotion_images").insert({ promotion_id: photoModal.id, image_url: urlData.publicUrl });
    setPhotos(prev => [...prev, { id: Date.now().toString(), image_url: urlData.publicUrl }]);
    setUploading(false);
    toast.success("Foto adicionada!");
    fetch_(); // Atualizar o card para mostrar o banner após fechar
  };

  const deletePhoto = async (photoId: string) => {
    await supabase.from("promotion_images").delete().eq("id", photoId);
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    toast.success("Foto removida!");
    fetch_(); // Atualizar o card se a foto for removida
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
              
              <div className="space-y-2">
                <Label>Imagens da Promoção (Até 10)</Label>
                <label className="cursor-pointer block">
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
                  <div className="flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-secondary/50 text-sm hover:bg-secondary transition-colors w-full justify-center">
                    <Image className="h-4 w-4" /> Selecionar Imagens
                  </div>
                </label>
                {selectedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="relative group bg-secondary rounded-md px-2 py-1 text-xs flex items-center gap-2">
                        <span className="truncate max-w-[100px]">{file.name}</span>
                        <button onClick={() => removeSelectedFile(idx)} className="text-destructive hover:text-destructive/80">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={handleCreate} disabled={isCreating} className="w-full gradient-accent">
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {isCreating ? "Criando..." : "Criar e Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!photoModal} onOpenChange={() => setPhotoModal(null)}>
        <DialogContent className="glass-strong max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Fotos - {photoModal?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
              <div className="flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-secondary/50 text-sm hover:bg-secondary transition-colors w-fit">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
                {uploading ? "Enviando..." : "Adicionar foto"}
              </div>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map(p => (
                <div key={p.id} className="relative group rounded-lg overflow-hidden">
                  <img src={p.image_url} alt="Promotion" className="w-full h-32 object-cover" />
                  <button onClick={() => deletePhoto(p.id)} className="absolute top-1 right-1 bg-destructive rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3 text-destructive-foreground" />
                  </button>
                </div>
              ))}
              {photos.length === 0 && <p className="col-span-full text-center text-muted-foreground py-6">Nenhuma foto adicionada</p>}
            </div>
          </div>
          <div className="flex justify-end pt-4 mt-2 border-t border-border/50">
            <Button onClick={() => setPhotoModal(null)} className="gradient-accent px-8">
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {promotions.map((promo) => (
          <Card key={promo.id} className="glass animate-fade-in overflow-hidden">
            {promo.preview_image ? (
              <div className="relative h-40 w-full">
                <img src={promo.preview_image} alt={promo.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent flex items-end p-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Tag className="h-5 w-5 text-accent" />
                    {promo.title}
                  </h3>
                </div>
              </div>
            ) : (
              <div className="h-40 w-full bg-secondary/30 flex items-center justify-center border-b border-border">
                <Tag className="h-10 w-10 text-muted-foreground/30" />
              </div>
            )}
            <CardHeader className="pb-3 pt-3">
              <CardTitle className="flex items-center justify-between text-lg">
                <span className="text-sm font-normal text-muted-foreground">Detalhes da Oferta</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 bg-secondary/50" onClick={() => openPhotos(promo)}>
                  <Image className="h-4 w-4" />
                </Button>
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
