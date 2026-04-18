import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, MessageCircle, Check, Clock, UserPlus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { NewSaleModal } from "@/components/admin/NewSaleModal";
import { ClientPaymentsModal } from "@/components/admin/ClientPaymentsModal";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  totalDue: number;
  totalPaid: number;
  tripDestinations: string[];
}

export default function AdminClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [paymentsModalOpen, setPaymentsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);

  const openPaymentsModal = (client: Client) => {
    setSelectedClient({ id: client.id, name: client.name || "Cliente" });
    setPaymentsModalOpen(true);
  };

  const fetchClients = async () => {
    const { data: profiles } = await supabase.from("profiles").select("id, name, email, phone, created_at").order("created_at", { ascending: false });
    if (!profiles) { setClients([]); return; }

    // Fetch all trips and installments to calculate payment status
    const userIds = profiles.map(p => p.id);
    const { data: trips } = await supabase.from("trips").select("id, user_id, destination").in("user_id", userIds);
    const tripIds = trips?.map(t => t.id) || [];

    let installments: any[] = [];
    if (tripIds.length > 0) {
      const { data } = await supabase.from("installments").select("trip_id, amount, status, due_date").in("trip_id", tripIds);
      installments = data || [];
    }

    const tripUserMap = new Map(trips?.map(t => [t.id, t.user_id]) || []);
    const now = new Date();

    const clientsWithPayments = profiles.map(p => {
      const userInstallments = installments.filter(i => tripUserMap.get(i.trip_id) === p.id);
      const totalDue = userInstallments.reduce((s, i) => s + Number(i.amount), 0);
      const totalPaid = userInstallments.filter(i => i.status === "pago").reduce((s, i) => s + Number(i.amount), 0);
      
      const hasLatePayment = userInstallments.some(i => {
        if (i.status === "pago") return false;
        const dueDate = new Date(i.due_date);
        return dueDate < now && dueDate.toDateString() !== now.toDateString(); // Vencido
      });

      const userTrips = trips?.filter(t => t.user_id === p.id).map(t => t.destination) || [];
      const tripDestinations = Array.from(new Set(userTrips)); // unique

      return { ...p, totalDue, totalPaid, hasLatePayment, tripDestinations } as any;
    });

    setClients(clientsWithPayments);
  };

  useEffect(() => { fetchClients(); }, []);

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

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o cliente "${name}"? Esta ação não pode ser desfeita.`)) return;

    // Remove otimista: tira da lista ANTES de esperar o banco
    setClients(prev => prev.filter(c => c.id !== id));

    // Apaga dados relacionados em cascata para evitar FK conflicts
    await supabase.from("installments").delete().eq("user_id", id);
    await supabase.from("trip_seats").delete().eq("user_id", id);

    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
      fetchClients(); // Reverte a remoção otimista se falhar
    } else {
      toast.success(`Cliente "${name}" excluído com sucesso!`);
    }
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

  const isPaid = (client: Client) => client.totalDue > 0 && client.totalPaid >= client.totalDue;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">Gerencie seus clientes</p>
        </div>
        <Button onClick={() => setSaleModalOpen(true)} className="gradient-accent text-white font-bold tracking-wide">
          <UserPlus className="mr-2 h-4 w-4" /> Adicionar Cliente
        </Button>
      </div>

      <NewSaleModal 
        open={saleModalOpen} 
        onOpenChange={setSaleModalOpen} 
        onSuccess={fetchClients} 
      />

      <ClientPaymentsModal
        clientId={selectedClient?.id || null}
        clientName={selectedClient?.name || ""}
        isOpen={paymentsModalOpen}
        onClose={() => setPaymentsModalOpen(false)}
        onUpdate={fetchClients}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong">
          <DialogHeader><DialogTitle>Editar Cliente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="bg-secondary/50" />
            </div>
            <Button onClick={handleSave} className="w-full gradient-accent">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="glass rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead>Nome e Viagens</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id} className="border-border/50">
                <TableCell className="cursor-pointer" onClick={() => openPaymentsModal(client)}>
                  <div className="font-medium mb-1">{client.name || "—"}</div>
                  <div className="flex flex-wrap gap-1">
                    {client.tripDestinations?.map((dest, i) => (
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
                <TableCell>
                  {client.totalDue > 0 ? (
                    isPaid(client) ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                        <Check className="h-3 w-3 mr-1" /> Pago
                      </Badge>
                    ) : (client as any).hasLatePayment ? (
                      <Badge className="bg-rose-500/20 text-rose-400 border-0">
                        <Clock className="h-3 w-3 mr-1" /> Atrasado
                      </Badge>
                    ) : (
                      <Badge className="bg-sky-500/20 text-sky-400 border-0">
                        <Clock className="h-3 w-3 mr-1" /> Em Progresso
                      </Badge>
                    )
                  ) : (
                    <Badge className="bg-amber-500/20 text-amber-500 border-0">
                      Pendente
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {client.phone && (
                    <Button variant="ghost" size="icon" onClick={() => openWhatsApp(client.phone!)} title="WhatsApp">
                      <MessageCircle className="h-4 w-4 text-emerald-400" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openEdit(client)}>
                    <Pencil className="h-4 w-4 text-sky-400" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(client.id, client.name || 'Sem nome')}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum cliente cadastrado</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
