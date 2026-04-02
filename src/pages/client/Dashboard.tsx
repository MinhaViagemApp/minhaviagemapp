import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plane, Calendar, DollarSign } from "lucide-react";

interface Trip {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  total_price: number;
  description: string;
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [paidAmount, setPaidAmount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetch_ = async () => {
      const { data: trips } = await supabase
        .from("trips")
        .select("*")
        .eq("user_id", user.id)
        .gte("end_date", new Date().toISOString().split("T")[0])
        .order("start_date", { ascending: true })
        .limit(1);

      const activeTrip = trips?.[0] || null;
      setTrip(activeTrip);

      if (activeTrip) {
        const { data: payments } = await supabase
          .from("payments")
          .select("amount_paid")
          .eq("trip_id", activeTrip.id);
        setPaidAmount(payments?.reduce((s, p) => s + Number(p.amount_paid), 0) || 0);
      }
    };
    fetch_();
  }, [user]);

  if (!trip) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <Plane className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Nenhuma viagem ativa no momento</p>
        </div>
      </div>
    );
  }

  const paidPercent = Math.round((paidAmount / trip.total_price) * 100);
  const remaining = trip.total_price - paidAmount;
  const daysLeft = Math.max(0, Math.ceil((new Date(trip.start_date).getTime() - Date.now()) / 86400000));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minha Viagem</h1>
        <p className="text-muted-foreground">Acompanhe sua viagem em tempo real</p>
      </div>

      <Card className="glass animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-accent" />
            {trip.destination}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass rounded-xl p-4 text-center">
              <Calendar className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{daysLeft}</p>
              <p className="text-xs text-muted-foreground">dias restantes</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <DollarSign className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-bold">R$ {paidAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground">total pago</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <DollarSign className="h-6 w-6 text-accent mx-auto mb-2" />
              <p className="text-2xl font-bold">R$ {remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground">restante</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progresso do pagamento</span>
              <span className="font-bold text-primary">{paidPercent}%</span>
            </div>
            <Progress value={paidPercent} className="h-3" />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {new Date(trip.start_date).toLocaleDateString("pt-BR")} — {new Date(trip.end_date).toLocaleDateString("pt-BR")}
          </div>

          {trip.description && (
            <p className="text-sm text-muted-foreground">{trip.description}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
