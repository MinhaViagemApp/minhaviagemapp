import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Installment {
  id: string;
  installment_number: number;
  amount: number;
  status: string;
  due_date: string;
  trips?: { destination: string };
}

export default function ClientPayments() {
  const { user } = useAuth();
  const [installments, setInstallments] = useState<Installment[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch_ = async () => {
      const { data: trips } = await supabase
        .from("trips")
        .select("id")
        .eq("user_id", user.id);
      const tripIds = trips?.map((t) => t.id) || [];
      if (tripIds.length === 0) return;

      const { data } = await supabase
        .from("installments")
        .select("*, trips(destination)")
        .in("trip_id", tripIds)
        .order("due_date", { ascending: true });
      setInstallments(data || []);
    };
    fetch_();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meus Pagamentos</h1>
        <p className="text-muted-foreground">Acompanhe suas parcelas</p>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead>Destino</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {installments.map((inst) => (
              <TableRow key={inst.id} className="border-border/50">
                <TableCell>{(inst.trips as any)?.destination}</TableCell>
                <TableCell>{inst.installment_number}ª</TableCell>
                <TableCell>R$ {Number(inst.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>{new Date(inst.due_date).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>
                  <Badge variant={inst.status === "pago" ? "default" : "secondary"} className={inst.status === "pago" ? "bg-emerald-500/20 text-emerald-400" : ""}>
                    {inst.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {installments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhuma parcela encontrada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
