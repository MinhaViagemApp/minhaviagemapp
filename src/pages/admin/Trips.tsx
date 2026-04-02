import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, MapPin, Calendar } from "lucide-react";
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
}

interface Client {
  id: string;
  name: string;
}

export default function AdminTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    destination: "",
    start_date: "",
    end_date: "",
    total_price: "",
    description: "",
    user_id: "",
    installments: "1",
  });

  const fetchTrips = async () => {
    const { data } = await supabase
      .from("trips")
      .select("*")
      .order("created_at", { ascending: false });
    
    // Fetch profile names separately
    const trips = data || [];
    const userIds = [...new Set(trips.map(t => t.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", userIds);
    
    const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
    setTrips(trips.map(t => ({ ...t, client_name: profileMap.get(t.user_id) || "—" })));
  };

  const fetchClients = async () => {
    const { data } = await supabase.from("profiles").select("id, name");
    setClients(data || []);
  };

  useEffect(() => { fetchTrips(); fetchClients(); }, []);

  const handleCreate = async () => {
    const { data: trip, error } = await supabase.from("trips").insert({
      destination: form.destination,
      start_date: form.start_date,
      end_date: form.end_date,
      total_price: parseFloat(form.total_price),
      description: form.description,
      user_id: form.user_id,
    }).select().single();

    if (error) { toast.error(error.message); return; }

    // Create installments
    const numInstallments = parseInt(form.installments);
    const amount = parseFloat(form.total_price) / numInstallments;
    const installments = Array.from({ length: numInstallments }, (_, i) => {
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

    await supabase.from("installments").insert(installments);

    toast.success("Viagem criada com parcelas!");
    setOpen(false);
    setForm({ destination: "", start_date: "", end_date: "", total_price: "", description: "", user_id: "", installments: "1" });
    fetchTrips();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Viagens</h1>
          <p className="text-muted-foreground">Gerencie as viagens dos clientes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-accent">
              <Plus className="mr-2 h-4 w-4" /> Nova Viagem
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Viagem</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <div className="space-y-2">
                  <Label>Parcelas</Label>
                  <Input type="number" min="1" max="24" value={form.installments} onChange={(e) => setForm({ ...form, installments: e.target.value })} className="bg-secondary/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-secondary/50" />
              </div>
              <Button onClick={handleCreate} className="w-full gradient-accent">Criar Viagem</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trips.map((trip) => (
          <Card key={trip.id} className="glass animate-fade-in">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-4 w-4 text-accent" />
                {trip.destination}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(trip.start_date).toLocaleDateString("pt-BR")} - {new Date(trip.end_date).toLocaleDateString("pt-BR")}
              </div>
              <p className="text-sm text-muted-foreground">
                Cliente: {trip.client_name || "—"}
              </p>
              <p className="text-lg font-bold text-primary">
                R$ {Number(trip.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        ))}
        {trips.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12">
            Nenhuma viagem cadastrada
          </div>
        )}
      </div>
    </div>
  );
}
