import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TripProgressRoad } from "@/components/client/TripProgressRoad";
import { Plane, MapPin, Calendar, Loader2, Armchair, User, Tag, CreditCard, FileText, QrCode } from "lucide-react";
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

const methodLabel = (m: string) =>
  m === "pix" ? "Pix" : m === "cartao" ? "Cartão de Crédito" : "Boleto";

const MethodIcon = ({ m }: { m: string }) => {
  if (m === "pix") return <QrCode className="h-3.5 w-3.5" />;
  if (m === "cartao") return <CreditCard className="h-3.5 w-3.5" />;
  return <FileText className="h-3.5 w-3.5" />;
};

export default function MyTrips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<ActiveTrip[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    try {
      const today = new Date().toISOString().split("T")[0];

      const [ownRes, confirmedRes, clientRowRes] = await Promise.all([
        supabase.from("trips").select("*").eq("user_id", user.id).gte("end_date", today),
        supabase
          .from("trip_queries")
          .select("created_at, seat_number, payment_method, installments, coupon_code, passenger_name, status, trips(*)")
          .eq("user_id", user.id)
          .eq("status", "confirmada"),
        user.email
          ? supabase.from("clients").select("id").eq("email", user.email).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);

      const list = new Map<string, ActiveTrip>();
      (ownRes.data || []).forEach((t: any) => list.set(t.id, t));
      (confirmedRes.data || []).forEach((q: any) => {
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

      const clientId = (clientRowRes as any)?.data?.id;
      if (clientId) {
        const { data: bookingsData } = await supabase
          .from("bookings")
          .select("created_at, payment_method, trip_id, trips(*)")
          .eq("client_id", clientId);

        const bookingTripIds = (bookingsData || []).map((b: any) => b.trip_id);
        const { data: seatsData } = bookingTripIds.length
          ? await supabase
              .from("bus_seats")
              .select("trip_id, seat_number")
              .eq("client_id", clientId)
              .in("trip_id", bookingTripIds)
          : { data: [] as any[] };

        // Buscar parcelas para inferir installments count e payment_method
        const { data: instsData } = bookingTripIds.length
          ? await supabase
              .from("installments")
              .select("trip_id, installment_number, payment_method")
              .in("trip_id", bookingTripIds)
          : { data: [] as any[] };

        (bookingsData || []).forEach((b: any) => {
          const t = Array.isArray(b.trips) ? b.trips[0] : b.trips;
          if (t && new Date(t.end_date) >= new Date(today) && !list.has(t.id)) {
            const seat = (seatsData || []).find((s: any) => s.trip_id === t.id);
            const tripInsts = (instsData || []).filter((i: any) => i.trip_id === t.id);
            list.set(t.id, {
              ...t,
              query_created_at: b.created_at,
              payment_method: b.payment_method || tripInsts[0]?.payment_method || "pix",
              seat_number: seat?.seat_number ?? null,
              installments: tripInsts.length || null,
            });
          }
        });
      }

      const tripsArr = Array.from(list.values()).sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      );
      setTrips(tripsArr);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          const method = trip.payment_method || "pix";
          const installmentsCount = trip.installments || 1;
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
                      <MethodIcon m={method} /> Pagamento
                    </p>
                    <p className="text-sm font-black text-foreground">
                      {method === "boleto"
                        ? `Boleto${installmentsCount > 1 ? ` ${installmentsCount}x` : ""}`
                        : method === "cartao"
                          ? `Cartão • Pago${installmentsCount > 1 ? ` (${installmentsCount}x)` : ""}`
                          : "Pix • Pago"}
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
