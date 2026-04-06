import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, MapPin, Calendar, Pencil, Image, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TripImagePicker } from "@/components/admin/TripImagePicker";
import { uploadTripImages } from "@/lib/trip-image-upload";

interface Trip {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  total_price: number;
  description: string;
  company_id: string | null;
  images: string[];
}

interface TripPhoto {
  id: string;
  image_url: string;
  source: "trip" | "legacy";
}

const emptyForm = { destination: "", start_date: "", end_date: "", total_price: "", description: "", installments: "1" };

export default function AdminTrips() {
  const { companyId, user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [open, setOpen] = useState(false);
  const [editTrip, setEditTrip] = useState<Trip | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [photoModal, setPhotoModal] = useState<Trip | null>(null);
  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);

  const fetchTrips = async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro Supabase (listar viagens):", error);
      return;
    }

    setTrips(data || []);
  };

  useEffect(() => { fetchTrips(); }, [companyId]);

  const openCreate = () => {
    setEditTrip(null);
    setForm(emptyForm);
    setSelectedImages([]);
    setOpen(true);
  };

  const openEdit = (trip: Trip) => {
    setEditTrip(trip);
    setSelectedImages([]);
    setForm({
      destination: trip.destination,
      start_date: trip.start_date,
      end_date: trip.end_date,
      total_price: String(trip.total_price),
      description: trip.description || "",
      installments: "1",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!companyId) {
      const message = "Erro: empresa não identificada.";
      console.error(message, { companyId });
      toast.error(message);
      window.alert(message);
      return;
    }

    if (!user) {
      const message = "Erro: usuário não autenticado.";
      console.error(message);
      toast.error(message);
      window.alert(message);
      return;
    }

    if (!form.destination || !form.start_date || !form.end_date || !form.total_price) {
      const message = "Preencha destino, datas e valor da viagem.";
      console.error(message, form);
      toast.error(message);
      window.alert(message);
      return;
    }

    if ((editTrip?.images.length || 0) + selectedImages.length > 10) {
      const message = "Máximo de 10 imagens por viagem.";
      console.error(message);
      toast.error(message);
      window.alert(message);
      return;
    }

    setSaving(true);

    try {
      const uploadedUrls = selectedImages.length
        ? await uploadTripImages({ files: selectedImages, companyId })
        : [];

      const payload = {
        destination: form.destination,
        start_date: form.start_date,
        end_date: form.end_date,
        total_price: parseFloat(form.total_price),
        description: form.description || null,
        company_id: companyId,
        user_id: user.id,
        images: editTrip ? [...(editTrip.images || []), ...uploadedUrls] : uploadedUrls,
      };

      console.log(`Payload enviado (${editTrip ? "atualizar viagem" : "nova viagem"}):`, payload);

      if (editTrip) {
        const { data, error } = await supabase
          .from("trips")
          .update(payload)
          .eq("id", editTrip.id)
          .select("id, images")
          .single();

        if (error) {
          console.error("Erro Supabase (atualizar viagem):", error);
          toast.error(error.message);
          window.alert(error.message);
          return;
        }

        console.log("Sucesso (atualizar viagem):", data);
        toast.success("Viagem atualizada!");
      } else {
        const { data: trip, error } = await supabase
          .from("trips")
          .insert(payload)
          .select("id")
          .single();

        if (error) {
          console.error("Erro Supabase (nova viagem):", error);
          toast.error(error.message);
          window.alert(error.message);
          return;
        }

        console.log("Sucesso (nova viagem):", trip);

        const numInstallments = parseInt(form.installments);
        if (numInstallments > 1) {
          const amount = parseFloat(form.total_price) / numInstallments;
          const installmentsPayload = Array.from({ length: numInstallments }, (_, i) => {
            const dueDate = new Date(form.start_date);
            dueDate.setMonth(dueDate.getMonth() + i);
            return {
              trip_id: trip.id,
              installment_number: i + 1,
              amount: Math.round(amount * 100) / 100,
              status: "pendente",
              due_date: dueDate.toISOString().split("T")[0],
            };
          });

          console.log("Payload enviado (parcelas):", installmentsPayload);

          const { error: installmentError, data: installmentData } = await supabase
            .from("installments")
            .insert(installmentsPayload)
            .select("id");

          if (installmentError) {
            console.error("Erro Supabase (parcelas):", installmentError);
            toast.error(installmentError.message);
            window.alert(installmentError.message);
            return;
          }

          console.log("Sucesso (parcelas):", installmentData);
        }

        toast.success("Viagem criada!");
      }

      setOpen(false);
      setForm(emptyForm);
      setEditTrip(null);
      setSelectedImages([]);
      fetchTrips();
    } catch (error: any) {
      console.error("Erro inesperado ao salvar viagem:", error);
      toast.error(error.message || "Erro ao salvar viagem.");
      window.alert(error.message || "Erro ao salvar viagem.");
    } finally {
      setSaving(false);
    }
  };

  const openPhotos = async (trip: Trip) => {
    setPhotoModal(trip);

    const tripPhotos: TripPhoto[] = (trip.images || []).map((imageUrl, index) => ({
      id: `${trip.id}-${index}`,
      image_url: imageUrl,
      source: "trip",
    }));

    const { data, error } = await supabase.from("trip_images").select("id, image_url").eq("trip_id", trip.id);

    if (error) {
      console.error("Erro Supabase (listar fotos legadas):", error);
      setPhotos(tripPhotos);
      return;
    }

    const legacyPhotos: TripPhoto[] = (data || []).map((photo) => ({ ...photo, source: "legacy" as const }));
    const merged = [...tripPhotos, ...legacyPhotos.filter((photo) => !tripPhotos.some((tripPhoto) => tripPhoto.image_url === photo.image_url))];
    setPhotos(merged);
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !photoModal || !companyId) return;

    if ((photoModal.images.length || 0) >= 10) {
      const message = "Máximo de 10 imagens por viagem.";
      console.error(message);
      toast.error(message);
      window.alert(message);
      return;
    }

    setUploading(true);

    try {
      const [imageUrl] = await uploadTripImages({ files: [file], companyId });
      const nextImages = [...(photoModal.images || []), imageUrl];

      console.log("Payload enviado (adicionar foto na viagem):", { id: photoModal.id, images: nextImages });

      const { data, error } = await supabase
        .from("trips")
        .update({ images: nextImages })
        .eq("id", photoModal.id)
        .select("id, images")
        .single();

      if (error) {
        console.error("Erro Supabase (adicionar foto na viagem):", error);
        toast.error(error.message);
        window.alert(error.message);
        return;
      }

      console.log("Sucesso (adicionar foto na viagem):", data);
      setPhotoModal({ ...photoModal, images: nextImages });
      setTrips((currentTrips) => currentTrips.map((trip) => trip.id === photoModal.id ? { ...trip, images: nextImages } : trip));
      setPhotos((prev) => [...prev, { id: `${photoModal.id}-${Date.now()}`, image_url: imageUrl, source: "trip" }]);
      toast.success("Foto adicionada!");
    } catch (error: any) {
      console.error("Erro inesperado no upload da viagem:", error);
      toast.error(error.message || "Erro ao enviar imagem.");
      window.alert(error.message || "Erro ao enviar imagem.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const deletePhoto = async (photo: TripPhoto) => {
    if (!photoModal) return;

    if (photo.source === "legacy") {
      console.log("Payload enviado (remover foto legada):", { id: photo.id });
      const { error } = await supabase.from("trip_images").delete().eq("id", photo.id);

      if (error) {
        console.error("Erro Supabase (remover foto legada):", error);
        toast.error(error.message);
        window.alert(error.message);
        return;
      }

      console.log("Sucesso (remover foto legada):", photo.id);
    } else {
      const nextImages = (photoModal.images || []).filter((url) => url !== photo.image_url);

      console.log("Payload enviado (remover foto da viagem):", { id: photoModal.id, images: nextImages });

      const { data, error } = await supabase
        .from("trips")
        .update({ images: nextImages })
        .eq("id", photoModal.id)
        .select("id, images")
        .single();

      if (error) {
        console.error("Erro Supabase (remover foto da viagem):", error);
        toast.error(error.message);
        window.alert(error.message);
        return;
      }

      console.log("Sucesso (remover foto da viagem):", data);
      setPhotoModal({ ...photoModal, images: nextImages });
      setTrips((currentTrips) => currentTrips.map((trip) => trip.id === photoModal.id ? { ...trip, images: nextImages } : trip));
    }

    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    toast.success("Foto removida!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Viagens</h1>
          <p className="text-muted-foreground">Gerencie as viagens da empresa</p>
        </div>
        <Button className="gradient-accent" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nova Viagem
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTrip ? "Editar Viagem" : "Nova Viagem"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
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
              {!editTrip && (
                <div className="space-y-2">
                  <Label>Parcelas</Label>
                  <Input type="number" min="1" max="24" value={form.installments} onChange={(e) => setForm({ ...form, installments: e.target.value })} className="bg-secondary/50" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-secondary/50" />
            </div>
            <TripImagePicker files={selectedImages} onChange={setSelectedImages} disabled={saving} />
            <Button onClick={handleSave} className="w-full gradient-accent" disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : editTrip ? "Salvar Alterações" : "Criar Viagem"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                  <button onClick={() => deletePhoto(p)} className="absolute top-1 right-1 bg-destructive rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3 text-destructive-foreground" />
                  </button>
                </div>
              ))}
              {photos.length === 0 && <p className="col-span-full text-center text-muted-foreground py-6">Nenhuma foto adicionada</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trips.map((trip) => (
          <Card key={trip.id} className="glass animate-fade-in">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-lg">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-accent" />
                  {trip.destination}
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPhotos(trip)}>
                    <Image className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(trip)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(trip.start_date).toLocaleDateString("pt-BR")} - {new Date(trip.end_date).toLocaleDateString("pt-BR")}
              </div>
              <p className="text-lg font-bold text-primary">R$ {Number(trip.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground">{trip.images?.length || 0} imagem(ns) salva(s)</p>
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
