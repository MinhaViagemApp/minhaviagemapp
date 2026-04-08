import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface Installment {
  id: string;
  installment_number: number;
  amount: number;
  status: string;
  due_date: string;
}

export default function AdminPayments() {
  const { companyId } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [installments, setInstallments] = useState<Record<string, Installment[]>>({});

  const fetchBookings = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("bookings")
      .select("*, clients!inner(name, email, company_id), trips!inner(destination, id)")
      .eq("clients.company_id", companyId)
      .order("created_at", { ascending: false });
    setBookings(data || []);
  };

  useEffect(() => { fetchBookings(); }, [companyId]);

  const toggleExpand = async (bookingId: string, tripId: string) => {
    if (expandedId === bookingId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(bookingId);
    if (!installments[bookingId]) {
      const { data } = await supabase
        .from("installments")
        .select("*")
        .eq("trip_id", tripId)
        .order("installment_number", { ascending: true });
      setInstallments((prev) => ({ ...prev, [bookingId]: data || [] }));
    }
  };

  const toggleInstallmentStatus = async (bookingId: string, inst: Installment) => {
    const newStatus = inst.status === "pago" ? "pendente" : "pago";
    const { error } = await supabase.from("installments").update({ status: newStatus }).eq("id", inst.id);
    if (error) { toast.error(error.message); return; }
    toast.success(newStatus === "pago" ? "Parcela marcada como paga!" : "Parcela marcada como pendente");
    setInstallments((prev) => ({
      ...prev,
      [bookingId]: prev[bookingId].map((i) => i.id === inst.id ? { ...i, status: newStatus } : i),
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pagamentos</h1>
        <p className="text-muted-foreground">Controle de pagamentos por reserva</p>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead>Cliente</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((b: any) => {
              const isExpanded = expandedId === b.id;
              const bookingInstallments = installments[b.id] || [];
              return (
                <>
                  <TableRow
                    key={b.id}
                    className="border-border/50 cursor-pointer hover:bg-secondary/30 transition-colors"
                    onClick={() => toggleExpand(b.id, b.trips?.id || b.trip_id)}
                  >
                    <TableCell className="font-medium">{b.clients?.name || "—"}</TableCell>
                    <TableCell>{b.trips?.destination || "—"}</TableCell>
                    <TableCell>R$ {Number(b.total_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {b.payment_method === "pix" ? "Pix" : b.payment_method === "card" ? "Cartão" : "Boleto"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {b.payment_status === "pago" ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                          <Check className="h-3 w-3 mr-1" /> Pago
                        </Badge>
                      ) : (
                        <Badge className="bg-primary/20 text-primary border-0">
                          <Clock className="h-3 w-3 mr-1" /> Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${b.id}-installments`} className="border-border/50 bg-secondary/10">
                      <TableCell colSpan={6} className="p-0">
                        <div className="px-4 py-3 space-y-2 animate-fade-in">
                          <p className="text-sm font-semibold text-muted-foreground mb-2">Parcelas</p>
                          {bookingInstallments.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">Nenhuma parcela cadastrada</p>
                          ) : (
                            <div className="grid gap-2">
                              {bookingInstallments.map((inst) => (
                                <div
                                  key={inst.id}
                                  className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 px-4 py-3"
                                >
                                  <div className="flex items-center gap-4">
                                    <span className="text-sm font-medium">{inst.installment_number}ª parcela</span>
                                    <span className="text-sm text-muted-foreground">
                                      R$ {Number(inst.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Venc: {new Date(inst.due_date).toLocaleDateString("pt-BR")}
                                    </span>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className={inst.status === "pago"
                                      ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                      : "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
                                    }
                                    onClick={(e) => { e.stopPropagation(); toggleInstallmentStatus(b.id, inst); }}
                                  >
                                    {inst.status === "pago" ? (
                                      <><Check className="h-3 w-3 mr-1" /> Pago</>
                                    ) : (
                                      <><Clock className="h-3 w-3 mr-1" /> Pendente</>
                                    )}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
            {bookings.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum pagamento encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
