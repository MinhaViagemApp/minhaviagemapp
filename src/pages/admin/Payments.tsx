import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { toast } from "sonner";

interface Installment {
  id: string;
  installment_number: number;
  amount: number;
  status: string;
  due_date: string;
  trip_id: string;
  destination?: string;
  client_name?: string;
}

export default function AdminPayments() {
  const [installments, setInstallments] = useState<Installment[]>([]);

  const fetchInstallments = async () => {
    const { data } = await supabase
      .from("installments")
      .select("*, trips(destination, user_id)")
      .order("due_date", { ascending: true });

    const items = data || [];
    const userIds = [...new Set(items.map((i: any) => i.trips?.user_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", userIds);
    const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

    setInstallments(items.map((i: any) => ({
      id: i.id,
      installment_number: i.installment_number,
      amount: i.amount,
      status: i.status,
      due_date: i.due_date,
      trip_id: i.trip_id,
      destination: i.trips?.destination,
      client_name: profileMap.get(i.trips?.user_id) || "—",
    })));
  };

  useEffect(() => { fetchInstallments(); }, []);

  const markAsPaid = async (inst: Installment) => {
    await supabase.from("installments").update({ status: "pago" }).eq("id", inst.id);
    await supabase.from("payments").insert({
      trip_id: inst.trip_id,
      amount_paid: inst.amount,
    });
    toast.success("Parcela marcada como paga!");
    fetchInstallments();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pagamentos</h1>
        <p className="text-muted-foreground">Controle de parcelas e pagamentos</p>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead>Destino</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {installments.map((inst) => (
              <TableRow key={inst.id} className="border-border/50">
                <TableCell>{inst.destination}</TableCell>
                <TableCell>{inst.client_name}</TableCell>
                <TableCell>{inst.installment_number}ª</TableCell>
                <TableCell>R$ {Number(inst.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>{new Date(inst.due_date).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>
                  <Badge variant={inst.status === "pago" ? "default" : "secondary"} className={inst.status === "pago" ? "bg-emerald-500/20 text-emerald-400" : ""}>
                    {inst.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {inst.status === "pendente" && (
                    <Button variant="ghost" size="sm" onClick={() => markAsPaid(inst)}>
                      <Check className="h-4 w-4 mr-1" /> Pagar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {installments.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
