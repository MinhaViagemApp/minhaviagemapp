import React, { useEffect, useState } from "react";
import { Users, Plane, Activity, Armchair, MessageCircle, UserPlus, UserCheck } from "lucide-react";
import { BusSeatPicker } from "@/components/admin/BusSeatPicker";
import { BusAnimationWrapper } from "@/components/admin/BusAnimationWrapper";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { NewSaleModal } from "@/components/admin/NewSaleModal";
import { mcpService, Seat as MCPSeat } from "@/services/mcpService";

interface ClientRow { id: string; name: string; email: string; phone: string | null; created_at: string; viagem_nome?: string }
interface TripRow { id: string; destination: string; start_date: string; end_date: string; total_price: number; user_id: string; client_name?: string; seats_occupied?: number; seats_total?: number }
interface PaymentRow { id: string; amount_paid: number; paid_at: string; trip_id: string; destination?: string }

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalClients: 0, activeClients: 0, totalTrips: 0, totalRevenue: 0, activeTrips: 0, pendingQueries: 0 });
  const [modal, setModal] = useState<"clients" | "active-clients" | "trips" | "revenue" | "active" | "seating-select" | "seating-view" | "new-sale" | "queries" | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TripRow | null>(null);
  const [seatData, setSeatData] = useState<any[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [queries, setQueries] = useState<any[]>([]);
  
  const [assignSeat, setAssignSeat] = useState<string | null>(null);
  const [selectedClientForSeat, setSelectedClientForSeat] = useState<string>("");
  const [manualNameForSeat, setManualNameForSeat] = useState<string>("");

  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [clientInstallments, setClientInstallments] = useState<any[]>([]);

  const fetchStats = async () => {
    const [cRes, tRes, pRes, qRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("trips").select("id, end_date"),
      supabase.from("payments").select("amount_paid"),
      supabase.from("trip_queries").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    ]);
    // Calcula clientes ativos (que têm pelo menos um installment)
    const { data: activeInstalls } = await supabase.from("installments").select("trip_id, trips(user_id)");
    const activeUserIds = new Set((activeInstalls || []).map((i: any) => i.trips?.user_id).filter(Boolean));
    const totalRevenue = pRes.data?.reduce((s, p) => s + Number(p.amount_paid), 0) || 0;
    const activeTrips = tRes.data?.filter(t => new Date(t.end_date) >= new Date()).length || 0;
    setStats({ 
      totalClients: cRes.count || 0,
      activeClients: activeUserIds.size,
      totalTrips: tRes.data?.length || 0, 
      totalRevenue, 
      activeTrips,
      pendingQueries: qRes.count || 0
    });
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const openModal = async (type: typeof modal) => {
    setModal(type);
    if (type === "clients" || type === "active-clients") {
      const { data: clientsData } = await supabase.from("profiles").select("id, name, email, phone, created_at").order("created_at", { ascending: false });
      const { data: tripsData } = await supabase.from("trips").select("id, user_id, destination");
      
      // Para clientes ativos: filtrar somente quem tem viagens
      const usersWithTrips = new Set((tripsData || []).map(t => t.user_id));
      const filtered = type === "active-clients" 
        ? (clientsData || []).filter(c => usersWithTrips.has(c.id))
        : (clientsData || []);

      // Mapeia destinos por usuário
      const userTripsMap = new Map<string, string[]>();
      (tripsData || []).forEach(t => {
        if (!userTripsMap.has(t.user_id)) userTripsMap.set(t.user_id, []);
        userTripsMap.get(t.user_id)!.push(t.destination);
      });

      setClients(filtered.map(c => ({
        ...c,
        viagem_nome: userTripsMap.get(c.id)?.join(", ") || "Sem reserva"
      })));
    } else if (type === "trips" || type === "active") {
      const { data } = await supabase.from("trips").select("*").order("start_date", { ascending: false });
      const allTrips = data || [];
      const userIds = [...new Set(allTrips.map(t => t.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", userIds);
      const pMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
      // Busca ocupação de poltronas por viagem
      const tripIds = allTrips.map(t => t.id);
      const { data: allSeats } = tripIds.length
        ? await supabase.from("bus_seats").select("trip_id, status").in("trip_id", tripIds)
        : { data: [] as any[] };
      const occMap = new Map<string, number>();
      (allSeats || []).forEach((s: any) => {
        if (s.status !== "livre" && s.status !== "free") {
          occMap.set(s.trip_id, (occMap.get(s.trip_id) || 0) + 1);
        }
      });
      const mapped = allTrips.map(t => ({
        ...t,
        client_name: pMap.get(t.user_id) || "—",
        seats_occupied: occMap.get(t.id) || 0,
        seats_total: t.total_seats || 44,
      }));
      setTrips(type === "active" ? mapped.filter(t => new Date(t.end_date) >= new Date()) : mapped);
    } else if (type === "revenue") {
      const { data } = await supabase.from("payments").select("*, trips(destination)").order("paid_at", { ascending: false });
      setPayments((data || []).map((p: any) => ({ ...p, destination: p.trips?.destination })));
    } else if (type === "seating-select") {
      const { data } = await supabase.from("trips").select("*").order("start_date", { ascending: false });
      setTrips(data || []);
    } else if (type === "queries") {
      const { data: qData } = await supabase
        .from("trip_queries")
        .select("*")
        .order("created_at", { ascending: false });
      const list = qData || [];
      const userIds = [...new Set(list.map((q: any) => q.user_id))];
      const tripIds = [...new Set(list.map((q: any) => q.trip_id))];
      const [{ data: profs }, { data: tripsData }] = await Promise.all([
        userIds.length ? supabase.from("profiles").select("id, name, email, phone").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
        tripIds.length ? supabase.from("trips").select("id, destination, start_date, total_price, total_seats").in("id", tripIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const pMap = new Map((profs || []).map((p: any) => [p.id, p]));
      const tMap = new Map((tripsData || []).map((t: any) => [t.id, t]));
      // Buscar poltronas ocupadas por viagem
      const seatsByTrip: Record<string, { occupied: number; total: number }> = {};
      for (const t of (tripsData || [])) {
        const { data: seats } = await supabase.from("bus_seats").select("status").eq("trip_id", t.id);
        const occupied = (seats || []).filter((s: any) => s.status !== 'livre' && s.status !== 'free').length;
        seatsByTrip[t.id] = { occupied, total: t.total_seats || 44 };
      }
      setQueries(list.map((q: any) => ({
        ...q,
        profiles: pMap.get(q.user_id) || null,
        trips: tMap.get(q.trip_id) || null,
        seats_info: seatsByTrip[q.trip_id] || { occupied: 0, total: 44 },
      })));
    }
  };

  // Realtime: detectar nova consulta e disparar popup
  useEffect(() => {
    const channel = supabase
      .channel('trip_queries_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_queries' }, async (payload) => {
        const q: any = payload.new;
        const { data: prof } = await supabase.from("profiles").select("name").eq("id", q.user_id).maybeSingle();
        const { data: t } = await supabase.from("trips").select("destination").eq("id", q.trip_id).maybeSingle();
        toast.success(`🔔 Nova pré-reserva de ${prof?.name || 'cliente'} para ${t?.destination || 'viagem'}!`, {
          duration: 8000,
          action: { label: "Conferir agora", onClick: () => openModal("queries") },
        });
        fetchStats();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleTripSelect = async (trip: TripRow) => {
    setSelectedTrip(trip);
    setModal("seating-view");
    
    const { data: companyClients } = await supabase
      .from("clients")
      .select("id, name, email, phone, created_at, company_id")
      .order("name");
    if (companyClients) setClients(companyClients as any);

    const data = await mcpService.getSeats(trip.id);
    
    setSeatData(data.map(s => ({
      id: s.id,
      number: s.seat_number.padStart(2, '0'),
      status: s.status === 'free' ? 'available' : 'occupied',
      occupantName: s.occupant_name || (s.client_id ? (companyClients?.find(c => c.id === s.client_id)?.name || "Reservado") : undefined),
      floor: parseInt(s.seat_number) <= 44 ? "superior" : "inferior"
    })));
  };

  const handleSeatClick = (seatNumber: string) => {
    const seat = seatData.find(s => s.number === seatNumber);
    if (seat && seat.status === "occupied") {
      toast.info(`Poltrona ${seatNumber} já está ocupada por ${seat.occupantName}`);
      return;
    }
    setAssignSeat(seatNumber);
    setSelectedClientForSeat("");
    setManualNameForSeat("");
  };

  const saveSeatAssignment = async () => {
    if (!selectedClientForSeat && !manualNameForSeat) {
      toast.error("Por favor, selecione um cliente ou digite um nome.");
      return;
    }
    if (!assignSeat || !selectedTrip) return;
    
    // Localizamos a poltrona pelo número
    const targetSeat = seatData.find(s => s.number === assignSeat);
    if (!targetSeat) return;

    try {
      const selectedClient = clients.find(client => client.id === selectedClientForSeat);
      const passengerName = selectedClient?.name || manualNameForSeat || "Passageiro";
      await mcpService.reserveSeat(selectedTrip.id, assignSeat, selectedClientForSeat || null, passengerName);
      toast.success(`✅ Poltrona ${assignSeat} reservada com sucesso!`);
      setAssignSeat(null);
      setSelectedClientForSeat("");
      setManualNameForSeat("");
      handleTripSelect(selectedTrip);
    } catch (error: any) {
      console.error("Erro ao reservar poltrona:", error);
      toast.error(`Falha na reserva: ${error?.message || "erro desconhecido"}`);
    }
  };

  const toggleClientAccordion = async (clientId: string) => {
    if (expandedClient === clientId) {
      setExpandedClient(null);
      return;
    }
    setExpandedClient(clientId);
    const { data } = await supabase.from("installments").select("*").eq("user_id", clientId).order("installment_number");
    setClientInstallments(data || []);
  };

  const setInstallmentStatus = async (installmentId: string, newStatus: "pago" | "pendente" | "atrasado" | "cancelado") => {
    const { error } = await supabase.from("installments").update({ status: newStatus }).eq("id", installmentId);
    if (error) {
      toast.error("Erro ao atualizar parcela: " + error.message);
      return;
    }
    toast.success(`Parcela marcada como ${newStatus}!`);
    if (expandedClient) await toggleClientAccordion(expandedClient);
    fetchStats();
  };

  const handleConfirmQuery = async (query: any) => {
    try {
      // Identificação por NOME (preferência); email apenas como complemento
      const name = (query.passenger_name || query.profiles?.name || "").trim();
      if (!name) throw new Error("Pré-reserva sem nome do passageiro — peça ao cliente para refazer.");
      const email = (query.profiles?.email || `${name.toLowerCase().replace(/\s+/g, ".")}@cliente.local`).trim().toLowerCase();
      const phone = query.phone || query.profiles?.phone || null;

      // Pega company_id do admin logado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado.");
      const { data: companyRow } = await supabase.from("user_companies").select("company_id").eq("user_id", user.id).maybeSingle();
      const companyId = companyRow?.company_id;
      if (!companyId) throw new Error("Sua conta não tem empresa vinculada.");

      // Busca cliente por NOME (case-insensitive) na empresa; se não existir, cria
      let { data: existing } = await supabase
        .from("clients")
        .select("id")
        .ilike("name", name)
        .eq("company_id", companyId)
        .maybeSingle();
      let clientId = existing?.id;
      if (!clientId) {
        const { data: created, error: cErr } = await supabase
          .from("clients")
          .insert({ name, email, phone, company_id: companyId })
          .select("id")
          .single();
        if (cErr) throw cErr;
        clientId = created!.id;
      }

      const { error } = await (supabase as any).rpc("confirm_trip_query", { _query_id: query.id, _client_id: clientId });
      if (error) throw error;

      // Notifica o cliente
      await supabase.from("notifications").insert({
        user_id: query.user_id,
        title: "Pré-reserva confirmada!",
        message: `Sua reserva para ${query.trips?.destination} foi confirmada. Veja em "Minha Viagem Ativa".`,
      });

      toast.success("Pré-reserva confirmada!");
      openModal("queries");
      fetchStats();
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao confirmar: " + (e.message || ""));
    }
  };

  const handleRejectQuery = async (query: any) => {
    try {
      const { error } = await (supabase as any).rpc("reject_trip_query", { _query_id: query.id });
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: query.user_id,
        title: "Pré-reserva recusada",
        message: `Sua pré-reserva para ${query.trips?.destination} foi recusada. Entre em contato para mais detalhes.`,
      });
      toast.success("Pré-reserva recusada e poltrona liberada.");
      openModal("queries");
      fetchStats();
    } catch (e: any) {
      toast.error("Erro: " + (e.message || ""));
    }
  };

  const openWhatsApp = async (query: any) => {
    const phone = query.profiles?.phone?.replace(/\D/g, "");
    if (!phone) {
      toast.error("Cliente não cadastrou número de WhatsApp.");
      return;
    }
    // Buscar o nome da empresa do admin logado
    const { data: { user } } = await supabase.auth.getUser();
    let companyName = "nossa agência";
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("business_name").eq("id", user.id).maybeSingle();
      if (profile?.business_name) companyName = profile.business_name;
    }
    const message = `Olá ${query.profiles?.name || ''}! Aqui é da ${companyName}, estou entrando em contato a respeito da sua reserva para ${query.trips?.destination}. Tudo bem com você?`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da sua agência</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="cursor-pointer" onClick={() => openModal("clients")}>
          <StatCard title="Total de Clientes" value={stats.totalClients} icon={Users} />
        </div>
        <div className="cursor-pointer" onClick={() => openModal("active-clients")}>
          <StatCard title="Clientes Ativos" value={stats.activeClients} icon={UserCheck} className="border-emerald-500/30 bg-emerald-500/5" />
        </div>
        <div className="cursor-pointer" onClick={() => openModal("queries")}>
          <StatCard title="Novas Consultas" value={stats.pendingQueries} icon={MessageCircle} className={stats.pendingQueries > 0 ? "border-orange-500/50 bg-orange-500/5" : ""} />
        </div>
        <div className="cursor-pointer" onClick={() => openModal("trips")}>
          <StatCard title="Total de Viagens" value={stats.totalTrips} icon={Plane} />
        </div>
        <div className="cursor-pointer" onClick={() => openModal("active")}>
          <StatCard title="Viagens Ativas" value={stats.activeTrips} icon={Activity} />
        </div>
        <div className="cursor-pointer" onClick={() => openModal("seating-select")}>
          <StatCard title="Disponibilidade" value="Poltronas" icon={Armchair} />
        </div>
      </div>

      <NewSaleModal 
        open={modal === "new-sale"} 
        onOpenChange={(open) => setModal(open ? "new-sale" : "clients")} 
        onSuccess={() => {
          fetchStats();
          openModal("clients");
        }}
      />

      {/* Clients Modal */}
      <Dialog open={modal === "clients" || modal === "active-clients"} onOpenChange={() => setModal(null)}>
        <DialogContent className="glass-strong max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <DialogTitle>Todos os Clientes e Controle</DialogTitle>
               <Button onClick={() => setModal("new-sale")} className="gradient-accent text-white font-bold tracking-wide">
                  <UserPlus className="mr-2 h-4 w-4" /> Adicionar Cliente
               </Button>
            </div>
          </DialogHeader>
          <Table>
            <TableHeader><TableRow className="border-border/50">
              <TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>WhatsApp</TableHead><TableHead>Viagem Selecionada</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {clients.map(c => (
                <React.Fragment key={c.id}>
                  <TableRow className="border-border/50 cursor-pointer hover:bg-secondary/50 transition-colors" onClick={() => toggleClientAccordion(c.id)}>
                    <TableCell className="font-medium">{c.name || "—"}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell>
                      {c.phone ? (
                        <a href={`https://wa.me/55${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-emerald-500 transition-colors text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                           <MessageCircle className="h-4 w-4 text-emerald-500" /> {c.phone}
                        </a>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{c.viagem_nome}</TableCell>
                  </TableRow>
                  {expandedClient === c.id && (
                    <TableRow className="bg-background/40">
                       <TableCell colSpan={4} className="p-4 border-b border-border/50">
                          <div className="bg-background/80 rounded-xl border border-border/50 p-5 shadow-inner">
                             <div className="flex justify-between items-center mb-4 border-b border-border/50 pb-2">
                                <h4 className="font-semibold text-lg text-primary">Controle de Parcelas</h4>
                             </div>
                             {clientInstallments.length > 0 ? (
                               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                  {clientInstallments.map(inst => (
                                      <div key={inst.id} className="glass-strong p-3 rounded-lg flex flex-col justify-between border border-border/40 hover:border-primary/50 transition-all">
                                         <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-semibold">Parcela {inst.installment_number}</p>
                                         <p className="font-bold mb-3 text-lg">R$ {Number(inst.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                                         <Select value={inst.status} onValueChange={(v) => setInstallmentStatus(inst.id, v as any)}>
                                           <SelectTrigger className={`w-full font-bold text-xs h-9 ${inst.status === 'pago' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40' : inst.status === 'atrasado' ? 'bg-red-500/20 text-red-500 border-red-500/40' : inst.status === 'cancelado' ? 'bg-muted text-muted-foreground border-border' : 'bg-orange-500/20 text-orange-500 border-orange-500/40'}`}>
                                             <SelectValue />
                                           </SelectTrigger>
                                           <SelectContent>
                                             <SelectItem value="pendente">Pendente</SelectItem>
                                             <SelectItem value="pago">Pago</SelectItem>
                                             <SelectItem value="atrasado">Atrasado</SelectItem>
                                             <SelectItem value="cancelado">Cancelado</SelectItem>
                                           </SelectContent>
                                         </Select>
                                      </div>
                                  ))}
                               </div>
                             ) : (
                               <div className="text-center py-6">
                                 <p className="text-sm text-muted-foreground">Nenhuma parcela gerada para este cliente.</p>
                               </div>
                             )}
                          </div>
                       </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Queries Modal */}
      <Dialog open={modal === "queries"} onOpenChange={() => setModal(null)}>
        <DialogContent className="glass-strong max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Consultas e Pré-reservas de Clientes</DialogTitle></DialogHeader>
          <Table>
            <TableHeader><TableRow className="border-border/50">
              <TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Destino</TableHead><TableHead>Pagamento</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {queries.map(q => (
                <TableRow key={q.id} className="border-border/50">
                  <TableCell className="text-xs">{new Date(q.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold">{q.profiles?.name || "—"}</span>
                      <span className="text-[10px] text-muted-foreground">{q.profiles?.email}</span>
                      {q.profiles?.phone && (
                        <span className="text-[10px] text-emerald-500 font-semibold">📱 {q.profiles.phone}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{q.trips?.destination}</span>
                      <span className="text-[10px] text-muted-foreground">{q.trips?.start_date ? new Date(q.trips.start_date).toLocaleDateString("pt-BR") : "—"}</span>
                      <span className="text-[10px] text-orange-400 font-semibold">🪑 {q.seats_info?.occupied || 0}/{q.seats_info?.total || 44} ocupadas</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold uppercase">{q.payment_method}</span>
                      <span className="text-[10px] text-muted-foreground">{q.installments}x</span>
                      {q.trips?.total_price && (
                        <span className="text-[10px] text-emerald-500 font-semibold">R$ {Number(q.trips.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={q.status === 'pendente' ? 'border-orange-500 text-orange-500 bg-orange-500/5' : 'border-emerald-500 text-emerald-500 bg-emerald-500/5'}>
                      {q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" className="h-8 border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10" onClick={() => openWhatsApp(q)}>
                      <MessageCircle className="h-4 w-4 mr-1" /> Chamar
                    </Button>
                    {q.status === 'pendente' && (
                      <>
                        <Button size="sm" variant="outline" className="h-8 border-red-500/50 text-red-500 hover:bg-red-500/10" onClick={() => handleRejectQuery(q)}>
                          Recusar
                        </Button>
                        <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleConfirmQuery(q)}>
                          Confirmar
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {queries.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">Nenhuma consulta recebida ainda.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
      <Dialog open={modal === "trips" || modal === "active"} onOpenChange={() => setModal(null)}>
        <DialogContent className="glass-strong max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{modal === "active" ? "Viagens Ativas" : "Todas as Viagens"}</DialogTitle></DialogHeader>
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead>Destino</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead className="min-w-[180px]">Ocupação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map(t => {
                const occ = t.seats_occupied || 0;
                const tot = t.seats_total || 44;
                const pct = tot > 0 ? Math.min(100, Math.round((occ / tot) * 100)) : 0;
                const color = pct >= 100 ? "bg-emerald-500" : pct >= 70 ? "bg-orange-500" : "bg-primary";
                return (
                  <TableRow key={t.id} className="border-border/50">
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{t.destination}</span>
                        <span className="text-[10px] text-muted-foreground">{t.client_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{new Date(t.start_date).toLocaleDateString("pt-BR")} - {new Date(t.end_date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>R$ {Number(t.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <div className="space-y-1 min-w-[160px]">
                        <div className="flex justify-between text-[10px] font-bold uppercase">
                          <span className="text-muted-foreground">{occ}/{tot} poltronas</span>
                          <span className={pct >= 100 ? "text-emerald-500" : pct >= 70 ? "text-orange-500" : "text-primary"}>{pct}%</span>
                        </div>
                        <div className="h-2 w-full bg-secondary/60 rounded-full overflow-hidden border border-border/40">
                          <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${Math.max(2, pct)}%` }} />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Seating Select Modal */}
      <Dialog open={modal === "seating-select"} onOpenChange={() => setModal(null)}>
        <DialogContent className="glass-strong max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Selecionar Viagem para Mapa de Poltronas</DialogTitle></DialogHeader>
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead>Destino</TableHead><TableHead>Período</TableHead><TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map(t => (
                <TableRow key={t.id} className="border-border/50">
                  <TableCell className="font-medium">{t.destination}</TableCell>
                  <TableCell>{new Date(t.start_date).toLocaleDateString("pt-BR")} - {new Date(t.end_date).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <button 
                      onClick={() => handleTripSelect(t)}
                      className="bg-primary text-primary-foreground px-4 py-1 rounded text-sm font-medium hover:bg-primary/90"
                    >
                      Ver Mapa
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Seating View Modal (with Animation) */}
      <Dialog open={modal === "seating-view"} onOpenChange={() => setModal(null)}>
        <DialogContent className="glass-strong max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">🚌 Mapa de Poltronas — {selectedTrip?.destination}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-4 mb-2">
            <div className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Livre</div>
            <div className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Ocupada</div>
          </div>
          <BusAnimationWrapper>
            <div className="py-4 px-2">
               <BusSeatPicker seats={seatData} onSeatClick={handleSeatClick} />
            </div>
          </BusAnimationWrapper>
        </DialogContent>
      </Dialog>

      {/* Assign Seat Dialog */}
      <Dialog open={!!assignSeat} onOpenChange={() => setAssignSeat(null)}>
        <DialogContent className="glass-strong sm:max-w-md w-[95vw] sm:w-full max-h-[90vh]">
          <DialogHeader><DialogTitle>Atribuir Poltrona {assignSeat}</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                 <Label>Selecionar Cliente</Label>
                 <Select value={selectedClientForSeat} onValueChange={(v) => { setSelectedClientForSeat(v); setManualNameForSeat(""); }}>
                   <SelectTrigger className="bg-secondary/50">
                     <SelectValue placeholder="Busque um cliente cadastrado" />
                   </SelectTrigger>
                   <SelectContent className="max-h-[50vh]">
                     {clients.map(c => (
                       <SelectItem key={c.id} value={c.id}>{c.name || c.email}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <div className="flex items-center">
                 <div className="flex-1 border-t border-border/50"></div>
                 <span className="px-3 text-xs text-muted-foreground uppercase">OU</span>
                 <div className="flex-1 border-t border-border/50"></div>
               </div>
               <div className="space-y-2">
                 <Label>Adicione aqui o nome do cliente</Label>
                 <input 
                   type="text"
                   value={manualNameForSeat}
                   onChange={(e) => { setManualNameForSeat(e.target.value); setSelectedClientForSeat(""); }}
                   placeholder="Digite o nome completo"
                   className="flex h-10 w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                 />
               </div>
            </div>
            <Button onClick={saveSeatAssignment} disabled={!selectedClientForSeat && !manualNameForSeat} className="w-full gradient-accent h-12 text-md">
              Confirmar Reserva
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
