import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, MessageCircle, Check, Clock, Plus, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface Booking {
  id: string;
  client_id: string;
  trip_id: string;
  total_value: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  trip_destination: string;
  trip_start_date: string;
}

interface TripOption {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: "active" | "scheduled";
}

export default function AdminClients() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tripId, setTripId] = useState("");
  const [totalValue, setTotalValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");

  const fetchBookings = useCallback(async () => {
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) { setBookings([]); return; }

    const clientIds = [...new Set(data.map(b => b.client_id))];
    const tripIds = [...new Set(data.map(b => b.trip_id))];

    const [{ data: profiles }, { data: tripsData }] = await Promise.all([
      supabase.from("profiles").select("id, name, email, phone").in("id", clientIds),
      supabase.from("trips").select("id, destination, start_date").in("id", tripIds),
    ]);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const tripMap = new Map(tripsData?.map(t => [t.id, t]) || []);

    setBookings(data.map(b => {
      const p = profileMap.get(b.client_id);
      const t = tripMap.get(b.trip_id);
      return {
        ...b,
        client_name: p?.name || "—",
        client_email: p?.email || "",
        client_phone: p?.phone || null,
        trip_destination: t?.destination || "—",
        trip_start_date: t?.start_date || "",
      };
    }));
  }, []);

  const fetchTrips = useCallback(async () => {
    const { data } = await supabase.from("trips").select("id, destination, start_date, end_date").order("start_date", { ascending: true });
    if (!data) return;
    const today = new Date().toISOString().split("T")[0];
    setTrips(data.map(t => ({
      ...t,
      status: t.start_date <= today && t.end_date >= today ? "active" as const : "scheduled" as const,
    })));
  }, []);

  useEffect(() => { fetchBookings(); fetchTrips(); }, [fetchBookings, fetchTrips]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("bookings-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        fetchBookings();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchBookings]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleSave = async () => {
    if (!email || !tripId || !totalValue) {
      toast.error("Preencha e-mail, viagem e valor total.");
      return;
    }
    setSaving(true);
    try {
      // Check if client profile exists by email
      const { data: existing } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();

      let clientId = existing?.id;

      if (!clientId) {
        // Create profile for the client (will be linked when they register with same email)
        // We need a UUID - generate one
        const newId = crypto.randomUUID();
        const { error: profileErr } = await supabase.from("profiles").insert({
          id: newId,
          name: name || null,
          email,
          phone: phone || null,
        });
        if (profileErr) {
          // If insert fails due to RLS, try to find by email again
          toast.error("Erro ao criar perfil do cliente: " + profileErr.message);
          setSaving(false);
          return;
        }
        clientId = newId;
      } else {
        // Update existing profile name/phone if provided
        if (name || phone) {
          await supabase.from("profiles").update({
            ...(name && { name }),
            ...(phone && { phone }),
          }).eq("id", clientId);
        }
      }

      // Create booking
      const { error: bookingErr } = await supabase.from("bookings").insert({
        client_id: clientId,
        trip_id: tripId,
        total_value: parseFloat(totalValue),
        payment_method: paymentMethod,
        payment_status: "pendente",
      });

      if (bookingErr) {
        if (bookingErr.message.includes("unique") || bookingErr.message.includes("duplicate")) {
          toast.error("Este cliente já está vinculado a esta viagem.");
        } else {
          toast.error(bookingErr.message);
        }
        setSaving(false);
        return;
      }

      toast.success("Cliente cadastrado na viagem com sucesso!");
      setOpen(false);
      resetForm();
      fetchBookings();
    } catch (err: any) {
      toast.error("Erro inesperado: " + err.message);
    }
    setSaving(false);
  };

  const resetForm = () => {
    setName(""); setEmail(""); setPhone(""); setTripId(""); setTotalValue(""); setPaymentMethod("pix");
  };

  const togglePaymentStatus = async (booking: Booking) => {
    const newStatus = booking.payment_status === "pendente" ? "pago" : "pendente";
    const { error } = await supabase.from("bookings").update({ payment_status: newStatus }).eq("id", booking.id);
    if (error) { toast.error(error.message); return; }
    toast.success(newStatus === "pago" ? "Marcado como pago!" : "Voltou para pendente.");
    fetchBookings();
  };

  const openWhatsApp = (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/\D/g, "");
    const num = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
    window.open(`https://wa.me/${num}`, "_blank");
  };

  const activeTrips = trips.filter(t => t.status === "active");
  const scheduledTrips = trips.filter(t => t.status === "scheduled");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">Gerencie e vincule clientes a viagens</p>
        </div>
        <Button className="gradient-accent" onClick={() => { resetForm(); setOpen(true); }}>
          <UserPlus className="mr-2 h-4 w-4" /> Cadastrar Cliente
        </Button>
      </div>

      {/* Registration Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Cadastrar Cliente na Viagem</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Cliente</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" className="bg-secondary/50" required />
            </div>
            <div className="space-y-2">
              <Label>Telefone (WhatsApp)</Label>
              <Input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(11) 99999-9999" className="bg-secondary/50" />
            </div>

            <div className="space-y-2">
              <Label>Viagem *</Label>
              <Select value={tripId} onValueChange={setTripId}>
                <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Selecione a viagem" /></SelectTrigger>
                <SelectContent>
                  {activeTrips.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-primary">🟢 Viagens Ativas</div>
                      {activeTrips.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.destination} — {new Date(t.start_date).toLocaleDateString("pt-BR")}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {scheduledTrips.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-accent mt-1">📅 Viagens Programadas</div>
                      {scheduledTrips.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.destination} — {new Date(t.start_date).toLocaleDateString("pt-BR")}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {trips.length === 0 && (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">Nenhuma viagem cadastrada</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Total (R$) *</Label>
                <Input type="number" min="0" step="0.01" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} placeholder="0,00" className="bg-secondary/50" />
              </div>
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">💳 Pix</SelectItem>
                    <SelectItem value="card">💳 Cartão</SelectItem>
                    <SelectItem value="boleto">📄 Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleSave} className="w-full gradient-accent" disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Cadastrar Cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bookings Table */}
      <div className="glass rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead>Cliente</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Viagem</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((b) => (
              <TableRow key={b.id} className="border-border/50">
                <TableCell className="font-medium">{b.client_name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{b.client_email}</TableCell>
                <TableCell>
                  <span className="text-sm">{b.trip_destination}</span>
                  {b.trip_start_date && (
                    <span className="block text-xs text-muted-foreground">
                      {new Date(b.trip_start_date).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  R$ {Number(b.total_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs capitalize">
                    {b.payment_method === "pix" ? "Pix" : b.payment_method === "card" ? "Cartão" : "Boleto"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => togglePaymentStatus(b)}
                    className="transition-all duration-200"
                  >
                    {b.payment_status === "pago" ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-0 cursor-pointer hover:bg-emerald-500/30">
                        <Check className="h-3 w-3 mr-1" /> Pago
                      </Badge>
                    ) : (
                      <Badge className="bg-primary/20 text-primary border-0 cursor-pointer hover:bg-primary/30">
                        <Clock className="h-3 w-3 mr-1" /> Pendente
                      </Badge>
                    )}
                  </button>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {b.client_phone && (
                    <Button variant="ghost" size="icon" onClick={() => openWhatsApp(b.client_phone!)} title="WhatsApp">
                      <MessageCircle className="h-4 w-4 text-emerald-400" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {bookings.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum cliente cadastrado. Clique em "Cadastrar Cliente" para começar.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
