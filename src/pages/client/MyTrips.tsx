import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TripProgressRoad } from "@/components/client/TripProgressRoad";
import { PaymentTimeline, type InstallmentItem } from "@/components/client/PaymentTimeline";
import { Plane, MapPin, Calendar, Loader2, Armchair, User, Tag } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ActiveTrip {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  total_price: number;
  description: string | null;
  created_at: string;
  status: string;
  query_created_at?: string;
  seat_number?: number | null;
  payment_method?: string | null;
  installments?: number | null;
  coupon_code?: string | null;
  passenger_name?: string | null;
  query_status?: string | null;
}

export default function MyTrips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<ActiveTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [installmentsByTrip, setInstallmentsByTrip] = useState<Record<string, InstallmentItem[]>>({});
  const [paymentsByTrip, setPaymentsByTrip] = useState<Record<string, number>>({});
  const [pixKey, setPixKey] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];
        const list = new Map<string, ActiveTrip>();

        // Viagens privadas atribuídas ao usuário
        const { data: own } = await supabase
          .from("trips")
          .select("*")
          .eq("user_id", user.id)
          .gte("end_date", today);
        (own || []).forEach((t: any) => list.set(t.id, t));

        // Viagens via pré-reserva confirmada (trip_queries)
        const { data: confirmed } = await supabase
          .from("trip_queries")
          .select("created_at, seat_number, payment_method, installments, coupon_code, passenger_name, status, trips(*)")
          .eq("user_id", user.id)
          .eq("status", "confirmada");
        (confirmed || []).forEach((q: any) => {
          const t = Array.isArray(q.trips) ? q.trips[0] : q.trips;
          if (t && new Date(t.end_date) >= new Date(today)) {
            list.set(t.id, {
              ...t,
              query_created_at: q.created_at,
              seat_number: q.seat_number,
              payment_method: q.payment_method,
              installments: q.installments,
              coupon_code: q.coupon_code,
              passenger_name: q.passenger_name,
              query_status: q.status,
            });
          }
        });

        // Viagens via bookings (independente do status), buscando client_id pelo email
        if (user.email) {
          const { data: clientRow } = await supabase
            .from("clients")
            .select("id")
            .eq("email", user.email)
            .maybeSingle();
          if (clientRow?.id) {
            const { data: bookings } = await supabase
              .from("bookings")
              .select("created_at, payment_method, trips(*)")
              .eq("client_id", clientRow.id);
            (bookings || []).forEach((b: any) => {
              const t = Array.isArray(b.trips) ? b.trips[0] : b.trips;
              if (t && new Date(t.end_date) >= new Date(today) && !list.has(t.id)) {
                list.set(t.id, {
                  ...t,
                  query_created_at: b.created_at,
                  payment_method: b.payment_method,
                });
              }
            });
          }
        }

        const tripsArr = Array.from(list.values()).sort(
          (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
        );
        setTrips(tripsArr);

        // Carregar parcelas e pagamentos para cada viagem
        const tripIds = tripsArr.map((t) => t.id);
        if (tripIds.length > 0) {
          const { data: insts } = await supabase
            .from("installments")
            .select("*")
            .in("trip_id", tripIds);
          const byTrip: Record<string, InstallmentItem[]> = {};
          (insts || []).forEach((i: any) => {
            (byTrip[i.trip_id] ||= []).push(i);
          });
          setInstallmentsByTrip(byTrip);

          const { data: pays } = await supabase
            .from("payments")
            .select("trip_id, amount_paid")
            .in("trip_id", tripIds);
          const sumByTrip: Record<string, number> = {};
          (pays || []).forEach((p: any) => {
            sumByTrip[p.trip_id] = (sumByTrip[p.trip_id] || 0) + Number(p.amount_paid);
          });
          setPaymentsByTrip(sumByTrip);
        }

        // Buscar chave PIX do administrador (para exibição em pagamento PIX)
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin")
          .limit(1);
        if (admins?.[0]) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("pix_key")
            .eq("id", admins[0].user_id)
            .single();
          if (profile?.pix_key) setPixKey(profile.pix_key);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-black gradient-primary-text">Minhas Viagens Ativas</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe o progresso de cada viagem aprovada até o embarque.
        </p>
      </header>

      {trips.length === 0 && (
        <Card className="glass-strong">
          <CardContent className="py-12 text-center space-y-2">
            <Plane className="h-10 w-10 mx-auto text-muted-foreground opacity-60" />
            <p className="font-semibold">Você ainda não tem viagens ativas</p>
            <p className="text-sm text-muted-foreground">
              Faça uma pré-reserva e aguarde a aprovação do administrador.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5">
        {trips.map((trip) => {
          const startBase = trip.query_created_at || trip.created_at;
          const insts = installmentsByTrip[trip.id] || [];
          const paid = paymentsByTrip[trip.id] || 0;
          const pixPaid = trip.payment_method === "pix" ? paid >= Number(trip.total_price) : false;
          return (
            <Card key={trip.id} className="glass-strong border-emerald-500/30 animate-fade-in">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/15 p-2.5 rounded-xl border border-primary/30">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{trip.destination}</CardTitle>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(trip.start_date), "dd 'de' MMM", { locale: ptBR })}
                        {" → "}
                        {format(parseISO(trip.end_date), "dd 'de' MMM, yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-emerald-500 text-emerald-400 bg-emerald-500/10"
                  >
                    Reserva confirmada
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Detalhes da viagem */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-secondary/40 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Armchair className="h-3 w-3" /> Poltrona
                    </p>
                    <p className="text-base font-black text-orange-400">
                      {trip.seat_number ?? "—"}
                    </p>
                  </div>
                  <div className="bg-secondary/40 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" /> Passageiro
                    </p>
                    <p className="text-sm font-black text-foreground truncate">
                      {trip.passenger_name || "—"}
                    </p>
                  </div>
                  <div className="bg-secondary/40 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Valor da viagem
                    </p>
                    <p className="text-base font-black text-primary">
                      R$ {Number(trip.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {trip.coupon_code && (
                  <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                    <Tag className="h-3.5 w-3.5" />
                    Cupom aplicado: <span className="font-mono font-bold">{trip.coupon_code}</span>
                  </div>
                )}

                {/* Pagamento — Timeline */}
                <div className="border-t border-border pt-5">
                  <PaymentTimeline
                    paymentMethod={trip.payment_method || "pix"}
                    installments={insts}
                    totalPrice={Number(trip.total_price)}
                    pixKey={pixKey}
                    pixDueDate={trip.start_date}
                    pixPaid={pixPaid}
                  />
                </div>

                {/* Barra de progresso ônibus na estrada */}
                <div className="border-t border-border pt-5">
                  <TripProgressRoad
                    createdAt={startBase}
                    startDate={trip.start_date}
                    label="Embarque está a caminho!"
                  />
                </div>

                {trip.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed border-t border-border pt-4">
                    {trip.description}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
