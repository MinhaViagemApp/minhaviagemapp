import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plane, Calendar, DollarSign, ChevronLeft, ChevronRight, KeyRound, Copy, CreditCard, Check, Clock } from "lucide-react";
import { toast } from "sonner";

interface BookingInfo {
  id: string;
  total_value: number;
  payment_method: string;
  payment_status: string;
  trip_destination: string;
  trip_start_date: string;
  trip_end_date: string;
  trip_description: string | null;
  trip_id: string;
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingInfo[]>([]);
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [photoIdx, setPhotoIdx] = useState<Record<string, number>>({});
  const [pixKey, setPixKey] = useState("");
  const [paidAmounts, setPaidAmounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user?.email) return;
    const fetchData = async () => {
      // Find client records by email
      const { data: clientRecords } = await supabase
        .from("clients")
        .select("id, company_id")
        .eq("email", user.email!);

      if (!clientRecords || clientRecords.length === 0) { setBookings([]); return; }

      const clientIds = clientRecords.map(c => c.id);

      // Fetch bookings for these client records
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("*, trips!inner(destination, start_date, end_date, description)")
        .in("client_id", clientIds);

      if (!bookingsData || bookingsData.length === 0) { setBookings([]); return; }

      const mapped: BookingInfo[] = bookingsData.map((b: any) => ({
        id: b.id,
        total_value: Number(b.total_value),
        payment_method: b.payment_method,
        payment_status: b.payment_status,
        trip_destination: b.trips?.destination || "—",
        trip_start_date: b.trips?.start_date || "",
        trip_end_date: b.trips?.end_date || "",
        trip_description: b.trips?.description || null,
        trip_id: b.trip_id,
      }));
      setBookings(mapped);

      const tripIds = mapped.map(b => b.trip_id);

      // Fetch photos
      const { data: images } = await supabase.from("trip_images").select("trip_id, image_url").in("trip_id", tripIds);
      const photoMap: Record<string, string[]> = {};
      images?.forEach(img => {
        if (!photoMap[img.trip_id]) photoMap[img.trip_id] = [];
        photoMap[img.trip_id].push(img.image_url);
      });
      setPhotos(photoMap);

      // Fetch payments
      const { data: payments } = await supabase.from("payments").select("trip_id, amount_paid").in("trip_id", tripIds);
      const paidMap: Record<string, number> = {};
      payments?.forEach(p => {
        paidMap[p.trip_id] = (paidMap[p.trip_id] || 0) + Number(p.amount_paid);
      });
      setPaidAmounts(paidMap);

      // Fetch PIX key from company
      const companyIds = [...new Set(clientRecords.map(c => c.company_id))];
      if (companyIds.length > 0) {
        const { data: company } = await supabase
          .from("companies")
          .select("pix_key")
          .in("id", companyIds)
          .maybeSingle();
        setPixKey(company?.pix_key || "");
      }
    };
    fetchData();
  }, [user]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("client-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        if (user) window.location.reload();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const copyPix = () => {
    navigator.clipboard.writeText(pixKey);
    toast.success("Chave PIX copiada!");
  };

  const getPhotoIdx = (tripId: string) => photoIdx[tripId] || 0;
  const setPhotoIdxFor = (tripId: string, idx: number) => setPhotoIdx(prev => ({ ...prev, [tripId]: idx }));

  if (bookings.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <Plane className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Nenhuma viagem vinculada a sua conta</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minhas Viagens</h1>
        <p className="text-muted-foreground">Acompanhe suas viagens em tempo real</p>
      </div>

      {bookings.map((booking) => {
        const tripPhotos = photos[booking.trip_id] || [];
        const idx = getPhotoIdx(booking.trip_id);
        const paid = paidAmounts[booking.trip_id] || 0;
        const paidPercent = booking.total_value > 0 ? Math.min(100, Math.round((paid / booking.total_value) * 100)) : 0;
        const remaining = Math.max(0, booking.total_value - paid);
        const daysLeft = Math.max(0, Math.ceil((new Date(booking.trip_start_date).getTime() - Date.now()) / 86400000));

        return (
          <Card key={booking.id} className="glass animate-fade-in">
            {tripPhotos.length > 0 && (
              <div className="relative rounded-t-xl overflow-hidden">
                <img src={tripPhotos[idx]} alt="Destino" className="w-full h-48 object-cover" />
                {tripPhotos.length > 1 && (
                  <>
                    <button onClick={() => setPhotoIdxFor(booking.trip_id, (idx - 1 + tripPhotos.length) % tripPhotos.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/70 rounded-full p-1">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button onClick={() => setPhotoIdxFor(booking.trip_id, (idx + 1) % tripPhotos.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/70 rounded-full p-1">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      {tripPhotos.map((_, i) => (
                        <div key={i} className={`h-2 w-2 rounded-full ${i === idx ? "bg-primary" : "bg-foreground/40"}`} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Plane className="h-5 w-5 text-accent" />
                  {booking.trip_destination}
                </span>
                {booking.payment_status === "pago" ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                    <Check className="h-3 w-3 mr-1" /> Pago
                  </Badge>
                ) : (
                  <Badge className="bg-primary/20 text-primary border-0">
                    <Clock className="h-3 w-3 mr-1" /> Pendente
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass rounded-xl p-4 text-center">
                  <Calendar className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold">{daysLeft}</p>
                  <p className="text-xs text-muted-foreground">dias restantes</p>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <DollarSign className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                  <p className="text-lg font-bold">R$ {paid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-muted-foreground">total pago</p>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <DollarSign className="h-6 w-6 text-accent mx-auto mb-2" />
                  <p className="text-lg font-bold">R$ {remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
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

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {new Date(booking.trip_start_date).toLocaleDateString("pt-BR")} — {new Date(booking.trip_end_date).toLocaleDateString("pt-BR")}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  {booking.payment_method === "pix" ? "Pix" : booking.payment_method === "card" ? "Cartão" : "Boleto"}
                </div>
              </div>

              {booking.trip_description && (
                <p className="text-sm text-muted-foreground">{booking.trip_description}</p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {pixKey && (
        <Card className="glass animate-fade-in">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="h-4 w-4 text-primary" />
              Chave PIX para pagamento
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-secondary/50 rounded-md px-3 py-2 text-sm break-all">{pixKey}</code>
              <Button variant="ghost" size="icon" onClick={copyPix}><Copy className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
