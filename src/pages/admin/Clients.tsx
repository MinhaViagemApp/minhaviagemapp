import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, MessageCircle, Check, Clock, UserPlus, ChevronDown, ChevronRight, Armchair, CreditCard, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { NewSaleModal } from "@/components/admin/NewSaleModal";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Installment {
  id: string;
  installment_number: number;
  amount: number;
  status: string;
  due_date: string;
  trip_id: string;
  user_id?: string | null;
  payment_method?: string | null;
}

interface TripInfo {
  id: string;
  destination: string;
  start_date: string;
  seat_number: string | null;
  payment_method: string | null;
  installments: Installment[];
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  totalDue: number;
  totalPaid: number;
  hasLatePayment: boolean;
  tripDestinations: string[];
  trips: TripInfo[];
}

export default function AdminClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [updatingInstId, setUpdatingInstId] = useState<string | null>(null);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);

  const fetchClients = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email, phone, created_at")
      .order("created_at", { ascending: false });
    if (!profiles) { setClients([]); return; }

    const userIds = profiles.map(p => p.id);

    const { data: rolesData } = userIds.length
      ? await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds)
      : { data: [] as { user_id: string; role: string }[] };

    const adminIds = new Set(
      (rolesData || [])
        .filter((role) => role.role === "admin")
        .map((role) => role.user_id)
    );

    const visibleProfiles = profiles.filter((profile) => !adminIds.has(profile.id) && profile.id !== user?.id);
    const visibleUserIds = visibleProfiles.map((profile) => profile.id);

    if (visibleUserIds.length === 0) {
      setClients([]);
      return;
    }

    const [{ data: installmentsData }, { data: queriesData }] = await Promise.all([
      supabase.from("installments")
        .select("id, trip_id, user_id, amount, status, due_date, installment_number, payment_method")
        .in("user_id", visibleUserIds)
        .order("installment_number", { ascending: true }),
      supabase.from("trip_queries")
        .select("trip_id, user_id, payment_method, seat_number, status, created_at")
        .in("user_id", visibleUserIds)
        .order("created_at", { ascending: false }),
    ]);

    const tripIds = Array.from(new Set([
      ...(installmentsData || []).map(i => i.trip_id),
      ...(queriesData || []).map(q => q.trip_id),
    ]));

    const { data: tripsData } = tripIds.length
      ? await supabase
          .from("trips")
          .select("id, destination, start_date")
          .in("id", tripIds)
      : { data: [] as any[] };

    const now = new Date();
    const tripMap = new Map((tripsData || []).map(t => [t.id, t]));
    const latestQueryMap = new Map<string, any>();

    (queriesData || []).forEach((query: any) => {
      const key = `${query.user_id}-${query.trip_id}`;
      if (!latestQueryMap.has(key)) {
        latestQueryMap.set(key, query);
      }
    });

    const clientsBuilt: Client[] = visibleProfiles.map(p => {
      const userInstallments = (installmentsData || []).filter(i => i.user_id === p.id);
      const userQueries = (queriesData || []).filter(q => q.user_id === p.id);
      const userTripIds = Array.from(new Set([
        ...userInstallments.map(i => i.trip_id),
        ...userQueries.map(q => q.trip_id),
      ]));

      const activeInstallments = userInstallments.filter(i => i.status !== "cancelado");
      const totalDue = activeInstallments.reduce((s, i) => s + Number(i.amount), 0);
      const totalPaid = activeInstallments.filter(i => i.status === "pago").reduce((s, i) => s + Number(i.amount), 0);
      const hasLatePayment = activeInstallments.some(i => {
        if (i.status === "pago" || i.status === "cancelado") return false;
        if (i.status === "atrasado") return true;
        const d = new Date(i.due_date);
        return d < now && d.toDateString() !== now.toDateString();
      });

      const trips: TripInfo[] = userTripIds.map(tripId => {
        const trip = tripMap.get(tripId);
        const query = latestQueryMap.get(`${p.id}-${tripId}`);
        const insts = userInstallments.filter(i => i.trip_id === tripId);

        return {
          id: tripId,
          destination: trip?.destination || "Viagem sem nome",
          start_date: trip?.start_date || "",
          seat_number: query?.seat_number ? String(query.seat_number).padStart(2, "0") : null,
          payment_method: insts[0]?.payment_method || query?.payment_method || null,
          installments: insts,
        };
      });

      return {
        ...p,
        totalDue,
        totalPaid,
        hasLatePayment,
        tripDestinations: trips.map(t => t.destination),
        trips,
      };
    });

    setClients(clientsBuilt);
  };

  useEffect(() => { fetchClients(); }, [user?.id]);

  const handleSave = async () => {
    if (editingClient) {
      const { error } = await supabase.from("profiles").update({ name, email, phone: phone || null }).eq("id", editingClient.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Cliente atualizado!");
    }
    setOpen(false);
    setEditingClient(null);
    setName(""); setEmail(""); setPhone("");
    fetchClients();
  };

  const handleDelete = async (id: string, clientName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o cliente "${clientName}"?`)) return;
    setDeletingClientId(id);

    const { data, error } = await supabase.functions.invoke("delete-user-account", {
      body: { userId: id },
    });

    setDeletingClientId(null);

    if (error || data?.error) {
      toast.error(error?.message || data?.error || "Falha ao excluir o usuário.");
      await fetchClients();
      return;
    }

    setClients(prev => prev.filter(c => c.id !== id));
    if (expandedClientId === id) setExpandedClientId(null);
    toast.success(`Cliente "${clientName}" excluído permanentemente!`);
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setName(client.name || "");
    setEmail(client.email || "");
    setPhone(client.phone || "");
    setOpen(true);
  };

  const openWhatsApp = (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/\D/g, "");
    const num = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
    window.open(`https://wa.me/${num}`, "_blank");
  };

  const toggleExpand = (clientId: string) => {
    setExpandedClientId(prev => prev === clientId ? null : clientId);
  };

  const updateInstallmentStatus = async (instId: string, newStatus: string) => {
    setUpdatingInstId(instId);
    const targetInstallment = clients
      .flatMap(client => client.trips)
      .flatMap(trip => trip.installments)
      .find(installment => installment.id === instId);

    const { error } = await (supabase as any).rpc("set_installment_status", { _installment_id: instId, _status: newStatus });
    if (error) {
      toast.error("Erro ao atualizar: " + error.message);
    } else {
      if (newStatus === "pago" && targetInstallment?.status !== "pago") {
        await supabase.from("payments").insert({
          trip_id: targetInstallment.trip_id,
          amount_paid: targetInstallment.amount,
        });
      }
      toast.success(newStatus === "pago" ? "✓ Parcela marcada como paga!" : "Status atualizado.");
      fetchClients();
    }
    setUpdatingInstId(null);
  };

  const getResolvedInstallmentStatus = (inst: Installment) => {
    if (["pago", "atrasado", "cancelado"].includes(inst.status)) return inst.status;
    const now = new Date();
    const dueDate = new Date(inst.due_date);
    if (dueDate < now && dueDate.toDateString() !== now.toDateString()) return "atrasado";
    return "pendente";
  };

  const getStatusBadge = (client: Client) => {
    if (client.totalDue === 0) return <Badge className="bg-amber-500/20 text-amber-500 border-0">Pendente</Badge>;
    if (client.totalPaid >= client.totalDue) return <Badge className="bg-emerald-500/20 text-emerald-400 border-0"><Check className="h-3 w-3 mr-1" />Pago</Badge>;
    if (client.hasLatePayment) return <Badge className="bg-rose-500/20 text-rose-400 border-0"><AlertCircle className="h-3 w-3 mr-1" />Atrasado</Badge>;
    return <Badge className="bg-sky-500/20 text-sky-400 border-0"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
  };

  const getInstBadge = (inst: Installment) => {
    const status = getResolvedInstallmentStatus(inst);
    if (status === "pago") return <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px]">Pago</Badge>;
    if (status === "cancelado") return <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">Cancelado</Badge>;
    if (status === "atrasado") return <Badge className="bg-rose-500/20 text-rose-400 border-0 text-[10px]">Atrasado</Badge>;
    return <Badge className="bg-sky-500/20 text-sky-400 border-0 text-[10px]">Pendente</Badge>;
  };

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">Gerencie seus clientes e parcelas</p>
        </div>
        <Button onClick={() => setSaleModalOpen(true)} className="gradient-accent text-white font-bold tracking-wide">
          <UserPlus className="mr-2 h-4 w-4" /> Adicionar Cliente
        </Button>
      </div>

      <NewSaleModal open={saleModalOpen} onOpenChange={setSaleModalOpen} onSuccess={fetchClients} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong">
          <DialogHeader><DialogTitle>Editar Cliente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary/50" /></div>
            <div className="space-y-2"><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} className="bg-secondary/50" /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="bg-secondary/50" /></div>
            <Button onClick={handleSave} className="w-full gradient-accent">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="glass rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="w-6"></TableHead>
              <TableHead>Nome e Viagens</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <>
                <TableRow
                  key={client.id}
                  className={`border-border/50 cursor-pointer hover:bg-secondary/30 transition-colors ${expandedClientId === client.id ? "bg-secondary/20" : ""}`}
                  onClick={() => toggleExpand(client.id)}
                >
                  <TableCell>
                    {expandedClientId === client.id
                      ? <ChevronDown className="h-4 w-4 text-primary" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    }
                  </TableCell>
                  <TableCell>
                    <div className="font-medium mb-1">{client.name || "—"}</div>
                    <div className="flex flex-wrap gap-1">
                      {client.tripDestinations.map((dest, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] bg-secondary/50 border-white/10 uppercase tracking-tight">
                          {dest}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>
                    {client.phone ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); openWhatsApp(client.phone!); }}
                        className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1"
                      >
                        <MessageCircle className="h-3 w-3" />
                        {client.phone}
                      </button>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{getStatusBadge(client)}</TableCell>
                  <TableCell className="text-right space-x-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(client)}>
                      <Pencil className="h-4 w-4 text-sky-400" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={deletingClientId === client.id} onClick={() => handleDelete(client.id, client.name || "Sem nome")}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>

                {/* ACCORDION INLINE */}
                {expandedClientId === client.id && (
                  <TableRow key={`${client.id}-expanded`} className="bg-background/30">
                    <TableCell colSpan={6} className="p-0">
                      <div className="p-4 space-y-4 border-t border-white/5 animate-in slide-in-from-top-2 duration-200">
                        {client.trips.length === 0 ? (
                          <p className="text-center text-muted-foreground py-4 text-sm">Este cliente não possui viagens vinculadas.</p>
                        ) : client.trips.map(trip => {
                          const paidAmt = trip.installments.filter(i => i.status === "pago").reduce((s, i) => s + Number(i.amount), 0);
                          const totalAmt = trip.installments.reduce((s, i) => s + Number(i.amount), 0);
                          const pct = totalAmt > 0 ? Math.round((paidAmt / totalAmt) * 100) : 0;

                          return (
                            <div key={trip.id} className="glass rounded-xl border border-white/10 overflow-hidden">
                              {/* Cabeçalho da viagem */}
                              <div className="p-4 border-b border-white/10 flex flex-wrap gap-4 items-center bg-black/20">
                                <div className="flex-1">
                                  <p className="font-bold text-emerald-400 text-base">{trip.destination}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {trip.start_date ? format(parseISO(trip.start_date), "MMMM 'de' yyyy", { locale: ptBR }) : "—"}
                                  </p>
                                </div>
                                <div className="flex gap-4 text-sm flex-wrap">
                                  {trip.seat_number && (
                                    <span className="flex items-center gap-1 bg-secondary/60 px-2 py-1 rounded-lg border border-white/10">
                                      <Armchair className="h-3.5 w-3.5 text-primary" />
                                      Poltrona <strong>{trip.seat_number}</strong>
                                    </span>
                                  )}
                                  {trip.payment_method && (
                                    <span className="flex items-center gap-1 bg-secondary/60 px-2 py-1 rounded-lg border border-white/10">
                                      <CreditCard className="h-3.5 w-3.5 text-sky-400" />
                                      <strong className="uppercase">{trip.payment_method}</strong>
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg border border-emerald-500/30 text-xs font-bold">
                                    {fmt(paidAmt)} / {fmt(totalAmt)} ({pct}%)
                                  </span>
                                </div>
                                {/* Barra de progresso */}
                                <div className="w-full">
                                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Tabela de parcelas */}
                              {trip.installments.length > 0 ? (
                                <Table>
                                  <TableHeader>
                                    <TableRow className="border-white/5 bg-black/10 hover:bg-black/10">
                                      <TableHead className="text-xs py-2">Parcela</TableHead>
                                      <TableHead className="text-xs py-2">Vencimento</TableHead>
                                      <TableHead className="text-xs py-2">Valor</TableHead>
                                      <TableHead className="text-xs py-2">Status</TableHead>
                                      <TableHead className="text-xs py-2 text-right">Alterar</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {trip.installments.map(inst => (
                                      <TableRow key={inst.id} className="border-white/5">
                                        <TableCell className="font-bold text-sm">{inst.installment_number}ª</TableCell>
                                        <TableCell className="text-xs">
                                          <span className={getResolvedInstallmentStatus(inst) === "atrasado" ? "text-rose-400 font-bold" : ""}>
                                            {format(parseISO(inst.due_date), "dd/MM/yyyy")}
                                          </span>
                                        </TableCell>
                                        <TableCell className="text-sm">{fmt(inst.amount)}</TableCell>
                                        <TableCell>{getInstBadge(inst)}</TableCell>
                                        <TableCell className="text-right">
                                          <div className="w-[140px] ml-auto">
                                            <Select
                                              value={getResolvedInstallmentStatus(inst)}
                                              onValueChange={(v) => updateInstallmentStatus(inst.id, v)}
                                              disabled={updatingInstId === inst.id}
                                            >
                                              <SelectTrigger className="h-7 text-xs bg-black/30 border-white/10">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="pendente">Pendente</SelectItem>
                                                <SelectItem value="pago" className="text-emerald-400 font-bold">Pago</SelectItem>
                                                <SelectItem value="atrasado">Atrasado</SelectItem>
                                                <SelectItem value="cancelado">Cancelado</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              ) : (
                                <p className="text-center text-muted-foreground text-xs py-4">Nenhuma parcela registrada para esta viagem.</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum cliente cadastrado</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
