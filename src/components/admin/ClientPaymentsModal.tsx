import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check } from "lucide-react";

interface ClientPaymentsModalProps {
  clientId: string | null;
  clientName: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void; // Trigger para re-fetch na pagina de clientes
}

export function ClientPaymentsModal({ clientId, clientName, isOpen, onClose, onUpdate }: ClientPaymentsModalProps) {
  const [groupedData, setGroupedData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!clientId) return;
    setLoading(true);

    // 1. Pega o user_id → suas trips
    const { data: trips } = await supabase
      .from("trips")
      .select("id, destination, start_date")
      .eq("user_id", clientId);

    if (!trips || trips.length === 0) {
      setGroupedData({});
      setLoading(false);
      return;
    }

    const tripIds = trips.map(t => t.id);

    // 2. Pega todas parcelas dessas trips
    const { data: installments } = await supabase
      .from("installments")
      .select("id, trip_id, amount, status, due_date, installment_number")
      .in("trip_id", tripIds)
      .order("installment_number", { ascending: true });

    const tripMap = new Map(trips.map(t => [t.id, t]));

    // 3. Agrupa por viagem
    const groups: any = {};
    (installments || []).forEach((inst: any) => {
      const trip = tripMap.get(inst.trip_id);
      const tripKey = inst.trip_id;
      if (!groups[tripKey]) {
        groups[tripKey] = {
          tripName: trip?.destination || "Viagem sem nome",
          startDate: trip?.start_date,
          installments: []
        };
      }
      groups[tripKey].installments.push(inst);
    });

    setGroupedData(groups);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, clientId]);

  const updateStatus = async (instId: string, newStatus: string, _tripId: string, _amount: number) => {
    const { error } = await supabase.from("installments").update({ status: newStatus }).eq("id", instId);
    
    if (error) {
      toast.error("Erro ao atualizar parcela: " + error.message);
      return;
    }

    toast.success(newStatus === "pago" ? "Parcela marcada como Paga! ✓" : "Status da parcela atualizado.");
    fetchData();
    onUpdate();
  };

  const fmt = (val: number) => `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto glass-strong">
        <DialogHeader>
          <DialogTitle className="text-xl">Pagamentos de {clientName || "Cliente"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground animate-pulse">Carregando parcelas...</div>
        ) : Object.keys(groupedData).length > 0 ? (
          <Accordion type="single" collapsible className="w-full">
            {Object.entries(groupedData).map(([tripId, group]: [string, any]) => {
              
              const totalAmount = group.installments.reduce((sum: number, i: any) => sum + Number(i.amount), 0);
              const paidAmount = group.installments.filter((i: any) => i.status === "pago").reduce((sum: number, i: any) => sum + Number(i.amount), 0);
              const isFullyPaid = totalAmount > 0 && paidAmount >= totalAmount;

              return (
                <AccordionItem key={tripId} value={tripId} className="border-white/10">
                  <AccordionTrigger className="hover:no-underline hover:bg-white/5 px-3 rounded-lg data-[state=open]:bg-white/5 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full pr-4 text-left gap-2">
                      <div>
                        <p className="font-bold text-lg text-emerald-400">{group.tripName}</p>
                        <p className="text-xs text-muted-foreground border border-white/10 rounded-full px-2 py-0.5 inline-block mt-1 bg-black/20">
                          {group.startDate ? format(parseISO(group.startDate), "MMMM yyyy", { locale: ptBR }) : ""}
                        </p>
                      </div>
                      <div className="flex flex-col sm:items-end gap-1">
                        <span className="text-sm border border-emerald-500/30 text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          {fmt(paidAmount)} / {fmt(totalAmount)}
                        </span>
                        {isFullyPaid && (
                          <Badge className="bg-emerald-500 text-black border-0 text-[10px] w-fit">
                            <Check className="h-3 w-3 mr-1" /> QUitado
                          </Badge>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pt-4">
                    <div className="rounded-xl overflow-hidden glass border border-white/5">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border/10 bg-black/20 hover:bg-black/20">
                            <TableHead className="w-[100px]">Parcela</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Status Atual</TableHead>
                            <TableHead className="text-right">Ação Rápida</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.installments.map((inst: any) => {
                            const dateObj = parseISO(inst.due_date);
                            const isLate = inst.status !== "pago" && new Date() > dateObj && new Date().toDateString() !== dateObj.toDateString();

                            return (
                              <TableRow key={inst.id} className="border-border/5">
                                <TableCell className="font-bold">{inst.installment_number}ª</TableCell>
                                <TableCell>
                                  <span className={isLate ? "text-rose-400 font-bold" : ""}>
                                    {format(dateObj, "dd/MM/yyyy")}
                                  </span>
                                </TableCell>
                                <TableCell>{fmt(inst.amount)}</TableCell>
                                <TableCell>
                                  {inst.status === "pago" ? (
                                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">Pago</Badge>
                                  ) : isLate ? (
                                    <Badge variant="outline" className="text-rose-400 border-rose-500/30">Atrasado</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-sky-400 border-sky-500/30">Em Progresso</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="ml-auto w-[130px]">
                                    <Select 
                                      value={inst.status === "pago" ? "pago" : "pendente"} 
                                      onValueChange={(val) => updateStatus(inst.id, val, tripId, inst.amount)}
                                    >
                                      <SelectTrigger className="h-8 text-xs bg-black/40 border-white/10">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pendente">Pendente / Em Prog.</SelectItem>
                                        <SelectItem value="pago" className="text-emerald-400 font-bold flex items-center">
                                          Setar Pago
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : (
           <div className="py-8 text-center text-muted-foreground border border-dashed border-white/20 rounded-xl bg-black/10">
             Nenhum parcelamento encontrado para este cliente.
           </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
