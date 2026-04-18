import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, MapPin, Calendar, Pencil, Image, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Trip {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  total_price: number;
  description: string;
  user_id: string;
  client_name?: string;
  preview_image?: string;
  is_public?: boolean;
  max_installments_card?: number;
}

interface Client { id: string; name: string }

const emptyForm = { 
  destination: "", 
  start_date: "", 
  end_date: "", 
  total_price: "", 
  description: "", 
  user_id: "", 
  installments: "1",
  is_public: true,
  max_installments_card: "12"
};

export default function AdminTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [editTrip, setEditTrip] = useState<Trip | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [photoModal, setPhotoModal] = useState<Trip | null>(null);
  const [photos, setPhotos] = useState<{ id: string; image_url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const fetchTrips = async () => {
    const { data } = await supabase.from("trips").select("*, trip_images(image_url)").order("created_at", { ascending: false });
    const allTrips = data || [];
    const userIds = [...new Set(allTrips.map(t => t.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", userIds);
    const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
    setTrips(allTrips.map(t => ({ 
      ...t, 
      client_name: profileMap.get(t.user_id) || "—",
      preview_image: (t as any).trip_images?.[0]?.image_url || null
    })));
  };

  const fetchClients = async () => {
    const { data } = await supabase.from("profiles").select("id, name");
    setClients(data || []);
  };

  useEffect(() => { fetchTrips(); fetchClients(); }, []);

  const openCreate = () => { setEditTrip(null); setForm(emptyForm); setOpen(true); };

  const openEdit = (trip: Trip) => {
    setEditTrip(trip);
    setForm({
      destination: trip.destination,
      start_date: trip.start_date,
      end_date: trip.end_date,
      total_price: String(trip.total_price),
      description: trip.description || "",
      user_id: trip.user_id || "",
      installments: "1",
      is_public: trip.is_public || false,
      max_installments_card: String(trip.max_installments_card || 12)
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      destination: form.destination,
      start_date: form.start_date,
      end_date: form.end_date,
      total_price: parseFloat(form.total_price),
      description: form.description,
      user_id: form.user_id || null, // Permite nulo para viagens públicas
      is_public: form.is_public,
      max_installments_card: parseInt(form.max_installments_card) || 12
    };

    if (editTrip) {
      const { error } = await supabase.from("trips").update(payload).eq("id", editTrip.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Viagem atualizada!");
    } else {
      setIsCreating(true);
      const { data: trip, error } = await supabase.from("trips").insert(payload).select().single();
      if (error) { toast.error(error.message); setIsCreating(false); return; }
      
      // Upload de imagens no cadastro
      if (selectedFiles.length > 0) {
        toast.info("Enviando imagens de destino...");
        for (const file of selectedFiles) {
          const ext = file.name.split(".").pop();
          const filePath = `trips/${trip.id}/${Date.now()}-${Math.random()}.${ext}`;
          const { error: upErr } = await supabase.storage.from("trip_images").upload(filePath, file, { upsert: true });
          if (!upErr) {
            const { data: urlData } = supabase.storage.from("trip_images").getPublicUrl(filePath);
            await supabase.from("trip_images").insert({ trip_id: trip.id, image_url: urlData.publicUrl });
          }
        }
      }

      toast.success("Viagem criada com sucesso!");
    }
    setIsCreating(false);
    setSelectedFiles([]);
    setOpen(false);
    setForm(emptyForm);
    setEditTrip(null);
    fetchTrips();
  };

  const openPhotos = async (trip: Trip) => {
    setPhotoModal(trip);
    const { data } = await supabase.from("trip_images").select("id, image_url").eq("trip_id", trip.id);
    setPhotos(data || []);
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !photoModal) return;
    
    if (photos.length >= 10) {
      toast.error("Limite máximo de 10 fotos atingido para esta viagem!");
      return;
    }
    
    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `trips/${photoModal.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("trip_images").upload(filePath, file, { upsert: true });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("trip_images").getPublicUrl(filePath);
    await supabase.from("trip_images").insert({ trip_id: photoModal.id, image_url: urlData.publicUrl });
    setPhotos(prev => [...prev, { id: Date.now().toString(), image_url: urlData.publicUrl }]);
    setUploading(false);
    toast.success("Foto adicionada!");
  };

  const deletePhoto = async (photoId: string) => {
    await supabase.from("trip_images").delete().eq("id", photoId);
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    toast.success("Foto removida!");
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Viagens</h1>
          <p className="text-muted-foreground">Gerencie as viagens dos clientes</p>
        </div>
        <Button className="gradient-accent" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nova Viagem
        </Button>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTrip ? "Editar Viagem" : "Nova Viagem"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2 bg-secondary/30 p-3 rounded-lg border border-border/50">
              <input 
                type="checkbox" 
                id="is_public" 
                checked={form.is_public} 
                onChange={(e) => setForm({...form, is_public: e.target.checked})}
                className="w-4 h-4 accent-primary"
              />
              <Label htmlFor="is_public" className="cursor-pointer">Disponibilizar para todos os clientes (Pública)</Label>
            </div>
            <div className="space-y-2">
              <Label>Destino</Label>
              <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} className="bg-secondary/50" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ida</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="bg-secondary/50" />
              </div>
              <div className="space-y-2">
                <Label>Volta</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="bg-secondary/50" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Total (R$)</Label>
                <Input type="number" value={form.total_price} onChange={(e) => setForm({ ...form, total_price: e.target.value })} className="bg-secondary/50" />
              </div>
              {!editTrip && form.user_id && form.user_id !== "none" && (
                <div className="space-y-2">
                  <Label>Parcelas (Boleto/Pix)</Label>
                  <Input type="number" min="1" max="24" value={form.installments} onChange={(e) => setForm({ ...form, installments: e.target.value })} className="bg-secondary/50" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Máx. Parcelas Cartão</Label>
                <Input type="number" min="1" max="24" value={form.max_installments_card} onChange={(e) => setForm({ ...form, max_installments_card: e.target.value })} className="bg-secondary/50" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-secondary/50" />
            </div>

            {!editTrip && (
              <div className="space-y-2">
                <Label>Fotos do Destino (Até 10)</Label>
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
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        <button onClick={() => removeSelectedFile(idx)} className="text-destructive hover:text-destructive/80 font-bold">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button onClick={handleSave} disabled={isCreating} className="w-full gradient-accent">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editTrip ? "Salvar Alterações" : "Criar Viagem"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photos Dialog */}
      <Dialog open={!!photoModal} onOpenChange={() => setPhotoModal(null)}>
        <DialogContent className="glass-strong max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Fotos - {photoModal?.destination}</DialogTitle></DialogHeader>
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
                  <img src={p.image_url} alt="Trip" className="w-full h-32 object-cover" />
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
        {trips.map((trip) => (
          <Card key={trip.id} className="glass animate-fade-in overflow-hidden">
            {trip.preview_image ? (
              <div className="relative h-40 w-full">
                <img src={trip.preview_image} alt={trip.destination} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent flex items-end p-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-accent" />
                    {trip.destination}
                  </h3>
                </div>
              </div>
            ) : (
              <div className="h-40 w-full bg-secondary/30 flex items-center justify-center border-b border-border">
                <MapPin className="h-10 w-10 text-muted-foreground/30" />
              </div>
            )}
            <CardHeader className="pb-3 pt-3">
              <CardTitle className="flex items-center justify-between text-lg">
                <span className="text-sm font-normal text-muted-foreground">Detalhes da Viagem</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 bg-secondary/50" onClick={() => openPhotos(trip)}>
                    <Image className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 bg-secondary/50" onClick={() => openEdit(trip)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3 text-white" />
                {new Date(trip.start_date).toLocaleDateString("pt-BR")} - {new Date(trip.end_date).toLocaleDateString("pt-BR")}
              </div>
              <p className="text-sm text-muted-foreground">Cliente: {trip.is_public ? <span className="text-emerald-500 font-bold">PÚBLICA</span> : (trip.client_name || "—")}</p>
              <p className="text-lg font-bold text-primary">R$ {Number(trip.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
        ))}
        {trips.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12">Nenhuma viagem cadastrada</div>
        )}
      </div>
    </div>
  );
}
