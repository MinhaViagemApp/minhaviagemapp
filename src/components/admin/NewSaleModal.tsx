import React, { useState, useEffect } from "react";
import { QrCode, Banknote, CreditCard, FileText, Plane, UserPlus, X, Armchair } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]); // múltiplas poltronas
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
      .in("status", ["scheduled", "active"])
      .eq("draft_status", "published")
      .gte("end_date", new Date().toISOString().split("T")[0])
      .order("start_date", { ascending: true });
    setTrips(data || []);
  };

  const handleTripChange = async (tripId: string) => {
    setForm({ ...form, trip_id: tripId });
    setSelectedSeats([]);
    if (!tripId) { setSaleSeatData([]); return; }
    try {
      const data = await mcpService.getSeats(tripId);
      setSaleSeatData(data.map(s => ({
        id: s.id,
        number: s.seat_number.padStart(2, '0'),
        status: s.status === 'free' ? 'available' : 'occupied',
        occupantName: s.occupant_name || (s.user_id ? "Ocupado" : undefined),
        floor: parseInt(s.seat_number) <= 44 ? "superior" : "inferior"
      })));
    } catch {
      toast.error("Erro ao carregar poltronas.");
    }
  };

  // Toggles a seat in/out of the selected list
  const handleSeatClick = (seatNum: string) => {
    const seatInfo = saleSeatData.find(s => s.number === seatNum);
    if (seatInfo?.status === 'occupied') {
      toast.error(`Poltrona ${seatNum} já está ocupada!`);
      return;
    }
    setSelectedSeats(prev =>
      prev.includes(seatNum)
        ? prev.filter(s => s !== seatNum) // deselect
        : [...prev, seatNum]              // select
    );
  };

  // Dados da viagem selecionada
  const selectedTrip = trips.find(t => t.id === form.trip_id);
  const qtdSeats = Math.max(selectedSeats.length, 1);

  // --- Regras de parcelamento por método ---
  // Boleto: máximo = meses até a data da viagem (inclusive mês atual)
  const maxInstallmentsBoleto = (() => {
    if (!selectedTrip?.start_date) return 12;
    const hoje = new Date();
    const partida = new Date(selectedTrip.start_date);
    const meses = (partida.getFullYear() - hoje.getFullYear()) * 12 + (partida.getMonth() - hoje.getMonth());
    return Math.max(1, meses + 1); // inclui o mês atual
  })();

  // Cartão: máximo definido pelo admin (até 24x)
  const maxInstallmentsCard = Math.min(parseInt(selectedTrip?.max_installments_card || "12") || 12, 24);

  // Máximo de parcelas para o método atual
  const maxInstallments = form.payment_method === "boleto"
    ? maxInstallmentsBoleto
    : form.payment_method === "cartao"
    ? maxInstallmentsCard
    : 24; // Pix e Dinheiro: livre até 24x

  // Taxa do cartão: acrescida ao total quando método é cartão
  const cardFeePercent = form.payment_method === "cartao"
    ? parseFloat(selectedTrip?.credit_card_fee_percent || "0") || 0
    : 0;

  // Preço base = preço da viagem × quantidade de poltronas
  const basePrice = selectedTrip ? selectedTrip.total_price * qtdSeats : 0;
  // Total final = base + taxa do cartão (se houver)
  const totalPrice = basePrice * (1 + cardFeePercent / 100);
  const pricePerInstallment = totalPrice / parseInt(form.installments || "1");

  // Quando mudar método de pagamento, resetar parcelas para não ultrapassar o máximo
  const handlePaymentMethodChange = (method: string) => {
    const currentInst = parseInt(form.installments);
    const newMax = method === "boleto" ? maxInstallmentsBoleto : method === "cartao" ? maxInstallmentsCard : 24;
    setForm({ ...form, payment_method: method, installments: String(Math.min(currentInst, newMax)) });
  };

  const formatCPF = (value: string) =>
    value.replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const handleSave = async () => {
    if (!form.name || !form.email || !form.trip_id || selectedSeats.length === 0) {
      toast.error("Preencha: Nome, Email, Viagem e selecione ao menos 1 poltrona.");
      return;
    }

    setIsSaving(true);
    try {
      const normalizedEmail = form.email.trim().toLowerCase();

      // 1. Resolver company_id do admin logado
      const { data: authData } = await supabase.auth.getUser();
      const adminUserId = authData?.user?.id;
      if (!adminUserId) throw new Error("Sessão inválida. Faça login novamente.");

      const { data: companyRow } = await supabase
        .from("user_companies")
        .select("company_id")
        .eq("user_id", adminUserId)
        .maybeSingle();
      const companyId = companyRow?.company_id;
      if (!companyId) throw new Error("Sua conta não está vinculada a uma agência.");

      // 2. Criar/atualizar registro em CLIENTS (admin tem permissão via RLS)
      // NÃO inserimos em profiles aqui — o perfil será criado automaticamente pelo
      // trigger handle_new_user() quando o cliente fizer signup com este e-mail.
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("email", normalizedEmail)
        .eq("company_id", companyId)
        .maybeSingle();

      let clientId = existingClient?.id as string | undefined;

      if (!clientId) {
        const { data: insertedClient, error: clientErr } = await supabase
          .from("clients")
          .insert({
            name: form.name,
            email: normalizedEmail,
            phone: form.phone || null,
            company_id: companyId,
          })
          .select("id")
          .single();
        if (clientErr) throw clientErr;
        clientId = insertedClient.id;
      } else {
        await supabase.from("clients").update({
          name: form.name,
          phone: form.phone || null,
        }).eq("id", clientId);
      }

      // 3. Se já existe um profile com este e-mail (cliente já logou alguma vez),
      // atualizamos os campos extras (cpf/endereço) — sem violar RLS pois apenas
      // o próprio usuário pode atualizar profiles. Se não existir, ignoramos: o
      // trigger handle_new_user criará na primeira sessão.
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();
      const existingUserId = existingProfile?.id as string | undefined;

      // 4. Reservar TODAS as poltronas selecionadas usando RPC (SECURITY DEFINER)
      for (const seatNum of selectedSeats) {
        const targetSeat = saleSeatData.find(s => s.number === seatNum);
        if (!targetSeat) throw new Error(`Poltrona ${seatNum} não encontrada.`);
        const { error: seatErr } = await (supabase as any).rpc("reserve_bus_seat", {
          _trip_id: form.trip_id,
          _seat_number: parseInt(seatNum, 10),
          _client_id: clientId,
          _passenger_name: form.name,
        });
        if (seatErr) throw seatErr;
      }

      // 5. Criar BOOKING confirmado (uma reserva por viagem)
      const { data: existingBooking } = await supabase
        .from("bookings")
        .select("id")
        .eq("client_id", clientId)
        .eq("trip_id", form.trip_id)
        .maybeSingle();

      if (!existingBooking) {
        const { error: bookErr } = await supabase.from("bookings").insert({
          client_id: clientId,
          trip_id: form.trip_id,
          payment_method: form.payment_method,
          total_value: totalPrice,
          payment_status: "pendente",
          status: "confirmada",
          notification_shown: false,
        } as any);
        if (bookErr) throw bookErr;
      } else {
        const { error: upErr } = await supabase
          .from("bookings")
          .update({
            payment_method: form.payment_method,
            total_value: totalPrice,
            status: "confirmada",
            notification_shown: false,
          } as any)
          .eq("id", existingBooking.id);
        if (upErr) throw upErr;
      }

      // 6. Gerar Parcelas — APENAS se ainda não existirem para esta trip+cliente
      // (evita duplicação ao reabrir o modal ou em duplo clique)
      if (selectedTrip) {
        const qty = parseInt(form.installments) || 1;
        const perAmount = totalPrice / qty;
        const today = new Date();

        // Checa parcelas existentes vinculadas: por user_id (se já houver perfil)
        // ou via bookings do cliente para esta viagem
        const { data: existingInsts } = await supabase
          .from("installments")
          .select("id, user_id")
          .eq("trip_id", selectedTrip.id);

        const alreadyHasInstallments = (existingInsts || []).some((i: any) =>
          existingUserId ? i.user_id === existingUserId : true
        ) && (existingInsts || []).length >= qty;

        if (!alreadyHasInstallments) {
          // Limpa parcelas antigas órfãs deste mesmo user_id (se houver) para
          // evitar mistura de planos antigos com o atual
          if (existingUserId && (existingInsts || []).length > 0) {
            await supabase
              .from("installments")
              .delete()
              .eq("trip_id", selectedTrip.id)
              .eq("user_id", existingUserId);
          }

          const installmentsToInsert = Array.from({ length: qty }, (_, i) => {
            const dueDate = new Date(today);
            dueDate.setMonth(today.getMonth() + i);
            return {
              trip_id: selectedTrip.id,
              user_id: existingUserId ?? null,
              installment_number: i + 1,
              amount: perAmount,
              status: "pendente",
              payment_method: form.payment_method,
              due_date: dueDate.toISOString().split("T")[0],
            };
          });

          const { error: instError } = await supabase.from("installments").insert(installmentsToInsert);
          if (instError) throw instError;
        }
      }

      // 7. Notificação (somente se já existir auth.user — caso contrário, será
      // disparada via realtime/fallback no Dashboard ao logar pela primeira vez)
      if (existingUserId) {
        try {
          await supabase.from("notifications").insert({
            user_id: existingUserId,
            title: "Reserva confirmada!",
            message: `Sua reserva para ${selectedTrip?.destination ?? "a viagem"} foi confirmada.`,
          });
        } catch (e: any) {
          console.warn("Falha ao inserir notificação (não crítico):", e?.message);
        }
      }

      toast.success(`✅ ${selectedSeats.length} poltrona(s) reservada(s) com sucesso!`);
      await handleTripChange(form.trip_id);
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
    setForm({ name: "", email: "", cpf: "", phone: "", address: "", trip_id: "", payment_method: "pix", installments: "1" });
    setSelectedSeats([]);
    setSaleSeatData([]);
  };

  // Cria uma versão do seatData refletindo quais poltronas já foram selecionadas nesta sessão
  const seatDataWithSelection = saleSeatData.map(s => ({
    ...s,
    status: selectedSeats.includes(s.number) ? 'selected' : s.status
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-4xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl text-primary font-black flex items-center gap-2">
            <UserPlus className="h-6 w-6" /> Adicionar Cliente &amp; Venda
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
          {/* Col 1 */}
          <div className="space-y-6">
            <div className="bg-secondary/30 p-4 rounded-xl border border-border/50">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-muted-foreground">1. Dados do Cliente</h3>
              <div className="space-y-3">
                <input type="text" placeholder="Nome Completo *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm" />
                <input type="email" placeholder="E-mail *" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <input type="text" placeholder="WhatsApp" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="flex-1 bg-background border border-input rounded-md px-3 py-2 text-sm" />
                  <input type="text" placeholder="CPF (Opcional)" value={form.cpf} onChange={e => setForm({...form, cpf: formatCPF(e.target.value)})} maxLength={14} className="flex-1 bg-background border border-input rounded-md px-3 py-2 text-sm" />
                </div>
                <input type="text" placeholder="Endereço Completo (Opcional)" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm" />
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
                  <button key={pm.id} type="button" onClick={() => handlePaymentMethodChange(pm.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${form.payment_method === pm.id ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground hover:bg-secondary'}`}>
                    <pm.icon className="h-5 w-5 mb-1" />
                    <span className="text-[10px] font-bold uppercase text-center leading-tight">{pm.label}</span>
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>Quantidade de Parcelas</span>
                  <span className="text-xs text-muted-foreground">
                    {form.payment_method === "boleto" && `Máx. ${maxInstallmentsBoleto}x (até a viagem)`}
                    {form.payment_method === "cartao" && `Máx. ${maxInstallmentsCard}x (definido pelo admin)`}
                    {(form.payment_method === "pix" || form.payment_method === "dinheiro") && "Até 24x"}
                  </span>
                </Label>
                <Select value={form.installments} onValueChange={v => setForm({...form, installments: v})}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: maxInstallments }, (_, i) => i + 1).map(n => (
                      <SelectItem key={n} value={String(n)}>
                        {n}x{selectedTrip ? ` — ${fmt(totalPrice / n)}` : ''}{n > 1 ? ' parcelas' : ' parcela'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Aviso de regra */}
              {form.payment_method === "boleto" && selectedTrip && (
                <div className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 p-2 rounded-lg">
                  📅 Boleto: máximo de <strong>{maxInstallmentsBoleto} parcela{maxInstallmentsBoleto > 1 ? 's' : ''}</strong> até {new Date(selectedTrip.start_date).toLocaleDateString("pt-BR")}.
                </div>
              )}
              {form.payment_method === "cartao" && cardFeePercent > 0 && (
                <div className="text-xs bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 p-2 rounded-lg">
                  💳 Taxa de maquininha de <strong>{cardFeePercent}%</strong> incluída no valor total.
                </div>
              )}

              {/* Resumo do valor */}
              {selectedTrip && (
                <div className="mt-4 bg-black/20 rounded-xl p-3 border border-white/10 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preço por poltrona:</span>
                    <span className="font-bold">{fmt(selectedTrip.total_price)}</span>
                  </div>
                  {cardFeePercent > 0 && (
                    <div className="flex justify-between text-yellow-400/80">
                      <span>+ Taxa cartão ({cardFeePercent}%):</span>
                      <span className="font-bold">+{fmt(basePrice * cardFeePercent / 100)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Poltronas selecionadas:</span>
                    <span className="font-bold text-primary">{Math.max(selectedSeats.length, 0)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-1 mt-1">
                    <span className="font-bold">Total:</span>
                    <span className="font-black text-emerald-400 text-base">{fmt(totalPrice)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{form.installments}x de:</span>
                    <span className="font-bold">{fmt(pricePerInstallment)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Col 2 */}
          <div className="space-y-6">
            <div className="bg-secondary/30 p-4 rounded-xl border border-border/50 h-full flex flex-col">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-muted-foreground">3. Viagem e Poltronas</h3>
              <Select value={form.trip_id} onValueChange={handleTripChange}>
                <SelectTrigger className="bg-background h-12 text-md font-bold text-primary mb-4">
                  <SelectValue placeholder="Selecione a Viagem *" />
                </SelectTrigger>
                <SelectContent>
                  {trips.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.destination} — {new Date(t.start_date).toLocaleDateString("pt-BR")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Poltronas selecionadas */}
              {selectedSeats.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedSeats.map(s => (
                    <Badge key={s} className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1 cursor-pointer hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30 transition-all"
                      onClick={() => setSelectedSeats(prev => prev.filter(p => p !== s))}>
                      <Armchair className="h-3 w-3" /> Nº {s} <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                  <span className="text-xs text-muted-foreground self-center">
                    (clique para remover)
                  </span>
                </div>
              )}

              {form.trip_id ? (
                <div className="flex-1 border rounded-lg bg-background p-2 overflow-x-auto min-h-[280px]">
                  <p className="text-center text-xs text-muted-foreground mb-3 uppercase mt-2">
                    Clique para selecionar/deselecionar • Verde escuro = selecionada
                  </p>
                  <div className="scale-75 origin-top mx-auto w-fit">
                    <BusSeatPicker
                      seats={seatDataWithSelection}
                      onSeatClick={handleSeatClick}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-lg p-6 opacity-50">
                  <Plane className="h-8 w-8 mb-2" />
                  <p className="text-sm text-center">Selecione uma viagem para escolher as poltronas.</p>
                </div>
              )}

              {selectedSeats.length > 0 && (
                <div className="mt-3 bg-emerald-500/10 text-emerald-400 p-3 rounded-lg flex items-center justify-between font-bold border border-emerald-500/20">
                  <span className="flex items-center gap-2">
                    <Armchair className="h-4 w-4" />
                    {selectedSeats.length} poltrona{selectedSeats.length > 1 ? 's' : ''} selecionada{selectedSeats.length > 1 ? 's' : ''}:
                  </span>
                  <span>{selectedSeats.map(s => `Nº ${s}`).join(", ")}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving || selectedSeats.length === 0} className="gradient-accent px-8">
            {isSaving ? "Salvando..." : "Confirmar Reserva"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
