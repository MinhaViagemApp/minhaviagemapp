import React, { useState, useEffect } from "react";
import { QrCode, Banknote, CreditCard, FileText, Plane, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BusSeatPicker } from "./BusSeatPicker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { mcpService } from "@/services/mcpService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function NewSaleModal({ open, onOpenChange, onSuccess }: Props) {
  const [trips, setTrips] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saleSeat, setSaleSeat] = useState<string>("");
  const [saleSeatData, setSaleSeatData] = useState<any[]>([]);
  
  const [form, setForm] = useState({
    name: "",
    email: "",
    cpf: "",
    phone: "",
    address: "",
    trip_id: "",
    payment_method: "pix",
    installments: "1"
  });

  useEffect(() => {
    if (open) {
      fetchTrips();
    }
  }, [open]);

  const fetchTrips = async () => {
    const { data } = await supabase
      .from("trips")
      .select("*")
      .gte("end_date", new Date().toISOString())
      .order("start_date", { ascending: true });
    setTrips(data || []);
  };

  const handleTripChange = async (tripId: string) => {
    setForm({ ...form, trip_id: tripId });
    setSaleSeat("");
    if (!tripId) {
      setSaleSeatData([]);
      return;
    }
    try {
      const data = await mcpService.getSeats(tripId);
      setSaleSeatData(data.map(s => ({
        id: s.id,
        number: s.seat_number.padStart(2, '0'),
        status: s.status === 'free' ? 'available' : 'occupied',
        occupantName: s.user_id ? "Ocupado" : undefined,
        floor: parseInt(s.seat_number) <= 44 ? "superior" : "inferior"
      })));
    } catch (error) {
      toast.error("Erro ao carregar poltronas.");
    }
  };

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, cpf: formatCPF(e.target.value) });
  };

  const handleSave = async () => {
    if (!form.name || !form.email || !form.trip_id || !saleSeat || !form.installments) {
      toast.error("Preencha todos os campos obrigatórios (Nome, Email, Viagem, Poltrona e Parcelas).");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Criar ou buscar perfil
      // Como não temos auth de usuário aqui, vamos gerar um ID ou buscar pelo email
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", form.email)
        .maybeSingle();

      let userId = existingProfile?.id;

      if (!userId) {
        userId = crypto.randomUUID();
        const { error: profileError } = await supabase.from("profiles").insert({
          id: userId,
          name: form.name,
          email: form.email,
          cpf: form.cpf || null,
          phone: form.phone,
          address: form.address || null
        });
        if (profileError) throw profileError;
      } else {
        // Atualiza perfil existente
        await supabase.from("profiles").update({
          name: form.name,
          cpf: form.cpf || null,
          phone: form.phone,
          address: form.address || null
        }).eq("id", userId);
      }

      // 2. Reservar a Poltrona através do MCP Service
      const targetSeat = saleSeatData.find(s => s.number === saleSeat);
      if (!targetSeat) throw new Error("Poltrona não encontrada.");

      await mcpService.reserveSeat(targetSeat.id, userId);

      // 3. Gerar as Parcelas
      const trip = trips.find(t => t.id === form.trip_id);
      if (trip) {
        const qty = parseInt(form.installments) || 1;
        const perAmount = trip.total_price / qty;
        const installmentsToInsert = [];
        const today = new Date();
        
        for (let i = 1; i <= qty; i++) {
          const dueDate = new Date(today);
          dueDate.setMonth(today.getMonth() + (i - 1));
          
          installmentsToInsert.push({
            trip_id: trip.id,
            user_id: userId,
            installment_number: i,
            amount: perAmount,
            status: "pendente",
            payment_method: form.payment_method,
            due_date: dueDate.toISOString()
          });
        }
        const { error: instError } = await supabase.from("installments").insert(installmentsToInsert);
        if (instError) throw instError;
      }

      toast.success("✅ Venda e Cliente registrados com sucesso!");
      onSuccess?.();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: "", email: "", cpf: "", phone: "", address: "", trip_id: "", payment_method: "pix", installments: "1"
    });
    setSaleSeat("");
    setSaleSeatData([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-4xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl text-primary font-black flex items-center gap-2">
            <UserPlus className="h-6 w-6" /> Adicionar Cliente & Venda
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
          {/* Col 1: Dados do Cliente e Pagamento */}
          <div className="space-y-6">
            <div className="bg-secondary/30 p-4 rounded-xl border border-border/50">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-muted-foreground">1. Dados do Cliente</h3>
              <div className="space-y-3">
                <input 
                  type="text" 
                  placeholder="Nome Completo *" 
                  value={form.name} 
                  onChange={e => setForm({...form, name: e.target.value})} 
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm" 
                />
                <input 
                  type="email" 
                  placeholder="E-mail *" 
                  value={form.email} 
                  onChange={e => setForm({...form, email: e.target.value})} 
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm" 
                />
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="WhatsApp" 
                    value={form.phone} 
                    onChange={e => setForm({...form, phone: e.target.value})} 
                    className="flex-1 bg-background border border-input rounded-md px-3 py-2 text-sm" 
                  />
                  <input 
                    type="text" 
                    placeholder="CPF (Opcional)" 
                    value={form.cpf} 
                    onChange={handleCPFChange} 
                    maxLength={14}
                    className="flex-1 bg-background border border-input rounded-md px-3 py-2 text-sm" 
                  />
                </div>
                <input 
                  type="text" 
                  placeholder="Endereço Completo (Opcional)" 
                  value={form.address} 
                  onChange={e => setForm({...form, address: e.target.value})} 
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm" 
                />
              </div>
            </div>

            <div className="bg-secondary/30 p-4 rounded-xl border border-border/50">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-muted-foreground">2. Pagamento</h3>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { id: "dinheiro", icon: Banknote, label: "Dinheiro" },
                  { id: "pix", icon: QrCode, label: "Pix" },
                  { id: "cartao", icon: CreditCard, label: "Cartão de Crédito" },
                  { id: "boleto", icon: FileText, label: "Boleto" }
                ].map(pm => (
                  <button 
                    key={pm.id} 
                    type="button"
                    onClick={() => setForm({...form, payment_method: pm.id})} 
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${form.payment_method === pm.id ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground hover:bg-secondary'}`}
                  >
                    <pm.icon className="h-5 w-5 mb-1" />
                    <span className="text-[10px] font-bold uppercase text-center leading-tight">{pm.label}</span>
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Quantidade de Parcelas</Label>
                <Select value={form.installments} onValueChange={v => setForm({...form, installments: v})}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[...Array(12)].map((_, i) => (
                      <SelectItem key={i+1} value={(i+1).toString()}>
                        {i+1}x Parcela{i > 0 ? 's' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Col 2: Viagem e Poltrona */}
          <div className="space-y-6">
            <div className="bg-secondary/30 p-4 rounded-xl border border-border/50 h-full flex flex-col">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-muted-foreground">3. Viagem e Assento</h3>
              <Select value={form.trip_id} onValueChange={handleTripChange}>
                <SelectTrigger className="bg-background h-12 text-md font-bold text-primary mb-4">
                  <SelectValue placeholder="Selecione a Viagem *" />
                </SelectTrigger>
                <SelectContent>
                  {trips.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.destination} - {new Date(t.start_date).toLocaleDateString()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {form.trip_id ? (
                <div className="flex-1 border rounded-lg bg-background p-2 overflow-x-auto min-h-[300px]">
                  <p className="text-center text-xs text-muted-foreground mb-4 uppercase mt-2">Escolha a poltrona</p>
                  <div className="scale-75 origin-top mx-auto w-fit">
                    <BusSeatPicker 
                      seats={saleSeatData} 
                      onSeatClick={(s) => {
                        if (saleSeatData.find(st => st.number === s)?.status === 'occupied') {
                          toast.error("Poltrona já ocupada!"); 
                          return;
                        }
                        setSaleSeat(s);
                      }} 
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-lg p-6 opacity-50">
                  <Plane className="h-8 w-8 mb-2" />
                  <p className="text-sm text-center">Selecione uma viagem para escolher o assento.</p>
                </div>
              )}

              {saleSeat && (
                <div className="mt-4 bg-emerald-500/20 text-emerald-400 p-3 rounded-lg flex items-center justify-between font-bold border border-emerald-500/30">
                  <span>Poltrona:</span>
                  <span className="text-xl">Nº {saleSeat}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving} className="gradient-accent px-8">
            {isSaving ? "Salvando..." : "Salvar Cliente e Venda"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
