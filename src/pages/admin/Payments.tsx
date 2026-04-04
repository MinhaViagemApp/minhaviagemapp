import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, Clock } from "lucide-react";

export default function AdminPayments() {
  const { companyId } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);

  const fetchBookings = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("bookings")
      .select("*, clients!inner(name, email, company_id), trips!inner(destination)")
      .eq("clients.company_id", companyId)
      .order("created_at", { ascending: false });
    setBookings(data || []);
  };

  useEffect(() => { fetchBookings(); }, [companyId]);

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
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((b: any) => (
              <TableRow key={b.id} className="border-border/50">
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
              </TableRow>
            ))}
            {bookings.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
