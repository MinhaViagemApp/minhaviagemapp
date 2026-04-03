import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Send } from "lucide-react";

interface Installment {
  id: string;
  installment_number: number;
  amount: number;
  status: string;
  due_date: string;
  trip_id: string;
  trips?: { destination: string };
}

export default function ClientPayments() {
  const { user } = useAuth();
  const [installments, setInstallments] = useState<Installment[]>([]);

  const fetchInstallments = async () => {
    if (!user) return;
    const { data: trips } = await supabase.from("trips").select("id").eq("user_id", user.id);
    const tripIds = trips?.map((t) => t.id) || [];
    if (tripIds.length === 0) return;

    const { data } = await supabase.from("installments").select("*, trips(destination)").in("trip_id", tripIds).order("due_date", { ascending: true });
    setInstallments(data || []);
  };

  useEffect(() => { fetchInstallments(); }, [user]);

  const confirmPayment = async (inst: Installment) => {
    // Mark as paid
    await supabase.from("installments").update({ status: "pago" }).eq("id", inst.id);
    await supabase.from("payments").insert({ trip_id: inst.trip_id, amount_paid: inst.amount });

    // Send notification to admin
    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    if (admins) {
      const destination = (inst.trips as any)?.destination || "viagem";
      const notifications = admins.map(a => ({
        user_id: a.user_id,
        title: "Pagamento recebido",
        message: `${user?.user_metadata?.name || user?.email} confirmou pagamento da parcela ${inst.installment_number} - ${destination} (R$ ${Number(inst.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})`,
      }));
      await supabase.from("notifications").insert(notifications);
    }

    toast.success("Pagamento confirmado!");
    fetchInstallments();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meus Pagamentos</h1>
        <p className="text-muted-foreground">Acompanhe e confirme suas parcelas</p>
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
              <TableHead className="text-right">Ação</TableHead>
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
                  <Badge variant={inst.status === "pago" ? "default" : "secondary"} className={inst.status === "pago" ? "bg-emerald-500/20 text-emerald-400 border-0" : ""}>
                    {inst.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {inst.status === "pendente" && (
                    <Button size="sm" className="gradient-primary text-primary-foreground" onClick={() => confirmPayment(inst)}>
                      <Send className="h-3 w-3 mr-1" /> Confirmar Pgto
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {installments.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma parcela encontrada</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
