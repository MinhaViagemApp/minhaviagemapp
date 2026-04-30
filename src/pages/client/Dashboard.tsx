import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { differenceInMonths, parseISO, startOfMonth } from "date-fns";
import { BusSeatPicker } from "@/components/admin/BusSeatPicker";
import { mcpService } from "@/services/mcpService";
import { celebrateApproval } from "@/lib/celebrate";
import { computePrice, validateCoupon, type ValidatedCoupon } from "@/lib/pricing";
import { ImageAutoCarousel } from "@/components/ImageAutoCarousel";
import { 
  MessageCircle, 
  Info, 
  Plane, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Armchair, 
  DollarSign, 
  KeyRound, 
  CreditCard,
  Check,
  Tag,
  Bus,
  Copy
} from "lucide-react";

interface Trip {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  total_price: number;
  description: string;
  created_at: string;
  is_public?: boolean;
  max_installments_card?: number;
  credit_card_fee_percent?: number;
  boleto_fee_percent?: number;
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [approvalModal, setApprovalModal] = useState<{ open: boolean; destination: string }>({ open: false, destination: "" });
  const [paidAmount, setPaidAmount] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [pixKey, setPixKey] = useState("");
  const [bookedSeat, setBookedSeat] = useState<string | null>(null);
  const [activeQuery, setActiveQuery] = useState<{ payment_method: string; installments: number; coupon_code: string | null } | null>(null);
  const [publicTrips, setPublicTrips] = useState<Trip[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [selectedPublicTrip, setSelectedPublicTrip] = useState<Trip | null>(null);
  const [adminPhone, setAdminPhone] = useState("");

  const [bookingForm, setBookingForm] = useState({
    paymentMethod: "pix",
    installments: "1"
  });
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<ValidatedCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [tripSeats, setTripSeats] = useState<any[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [loadingSeats, setLoadingSeats] = useState(false);

  // Quando abrir o modal de pré-reserva, carregar poltronas da viagem
  useEffect(() => {
    const loadSeats = async () => {
      if (!selectedPublicTrip) {
        setTripSeats([]);
        setSelectedSeat(null);
        return;
      }
      setLoadingSeats(true);
      try {
        const seats = await mcpService.getSeats(selectedPublicTrip.id);
        const mapped = seats.map((s: any) => ({
          number: s.seat_number,
          status: s.status === "free" ? "available" : "occupied",
          occupantName: s.occupant_name || (s.status === "pending" ? "Pré-reservada" : undefined),
          floor: Number(s.seat_number) <= 44 ? "superior" : "inferior",
        }));
        setTripSeats(mapped);
      } catch (e) {
        console.error("Erro ao carregar poltronas:", e);
      } finally {
        setLoadingSeats(false);
      }
    };
    loadSeats();
  }, [selectedPublicTrip]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        // Busca a próxima viagem pessoal ativa
      const { data: trips } = await supabase
        .from("trips")
        .select("*")
        .eq("user_id", user.id)
        .gte("end_date", new Date().toISOString().split("T")[0])
        .order("start_date", { ascending: true })
        .limit(1);
        
      let activeTrip: Trip | null = (trips?.[0] as Trip | undefined) || null;
      let confirmedQuery: any = null;

      // se não houver viagem privada, verificar se há uma pré-reserva confirmada (viagem pública)
      if (!activeTrip) {
        const { data: qConfirmed } = await supabase
          .from("trip_queries")
          .select("*, trips(*)")
          .eq("user_id", user.id)
          .eq("status", "confirmada")
          .order("created_at", { ascending: false })
          .limit(1);
        
        confirmedQuery = qConfirmed?.[0] || null;
        let relatedTrip = confirmedQuery?.trips;
        if (relatedTrip) {
          if (Array.isArray(relatedTrip)) relatedTrip = relatedTrip[0];
          activeTrip = relatedTrip as unknown as Trip;
        }
      }

      setTrip(activeTrip);

      if (confirmedQuery) {
        setActiveQuery({
          payment_method: confirmedQuery.payment_method,
          installments: confirmedQuery.installments,
          coupon_code: confirmedQuery.coupon_code,
        });
        if (confirmedQuery.seat_number != null) {
          setBookedSeat(String(confirmedQuery.seat_number));
        }

        // Celebração persistente: se ainda não mostramos o confetti para esta query, mostra agora
        const flagKey = `approval-shown-${confirmedQuery.id}`;
        if (typeof window !== "undefined" && !localStorage.getItem(flagKey)) {
          celebratedRef.current.add(confirmedQuery.id);
          localStorage.setItem(flagKey, "1");
          setTimeout(() => {
            celebrateApproval();
            setApprovalModal({
              open: true,
              destination: activeTrip?.destination || "sua próxima viagem",
            });
          }, 600);
        } else {
          // já mostrado antes — apenas marca como celebrado pra evitar duplicidade no realtime
          celebratedRef.current.add(confirmedQuery.id);
        }
      }

      if (activeTrip) {
        const { data: payments } = await supabase.from("payments").select("amount_paid").eq("trip_id", activeTrip.id);
        setPaidAmount(payments?.reduce((s, p) => s + Number(p.amount_paid), 0) || 0);

        const { data: images } = await supabase.from("trip_images").select("image_url").eq("trip_id", activeTrip.id);
        setPhotos(images?.map(i => i.image_url) || []);

        // Fallback: tenta tabela legada trip_seats se ainda não temos assento
        if (!confirmedQuery?.seat_number) {
          const { data: seat } = await (supabase as any)
            .from("trip_seats")
            .select("seat_number")
            .eq("trip_id", activeTrip.id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (seat) setBookedSeat(seat.seat_number);
        }
      }

      // Fetch public trips
      const { data: pTrips } = await supabase
        .from("trips")
        .select("*, trip_images(image_url)")
        .eq("is_public", true)
        .eq("draft_status", "published")
        .gte("end_date", new Date().toISOString().split("T")[0])
        .order("start_date", { ascending: true });
      
      setPublicTrips((pTrips || []).map(t => {
        const imgs = ((t as any).trip_images || []).map((i: any) => i.image_url).filter(Boolean);
        return {
          ...t,
          preview_image: imgs[0] || null,
          images_list: imgs,
        };
      }));

      // Fetch promotions
      const { data: promos } = await supabase
        .from("promotions")
        .select("*, promotion_images(image_url)")
        .eq("draft_status", "published")
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      
      setPromotions((promos || []).map(p => {
        const imgs = ((p as any).promotion_images || []).map((i: any) => i.image_url).filter(Boolean);
        return {
          ...p,
          preview_image: imgs[0] || null,
          images_list: imgs,
        };
      }));

      // Fetch admin info (PIX and Phone)
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin").limit(1);
      if (admins?.[0]) {
        const { data: profile } = await supabase.from("profiles").select("pix_key, business_phone").eq("id", admins[0].user_id).single();
        if (profile) {
          setPixKey(profile.pix_key || "");
          setAdminPhone(profile.business_phone || "");
        }
        }

        // Verifica bookings confirmadas pendentes de notificação (caso usuário não estivesse online)
        if (user.email) {
          const { data: client } = await supabase
            .from("clients")
            .select("id")
            .eq("email", user.email)
            .maybeSingle();
          if (client?.id) {
            const { data: pendingBookings } = await (supabase as any)
              .from("bookings")
              .select("id, trip_id, status, notification_shown")
              .eq("client_id", client.id)
              .eq("status", "confirmada")
              .eq("notification_shown", false);
            for (const b of (pendingBookings || []) as any[]) {
              if (celebratedRef.current.has(b.id)) continue;
              celebratedRef.current.add(b.id);
              try { localStorage.setItem(`approval-shown-${b.id}`, "1"); } catch {}
              const { data: t } = await supabase
                .from("trips")
                .select("destination")
                .eq("id", b.trip_id)
                .maybeSingle();
              setTimeout(() => {
                celebrateApproval();
                setApprovalModal({ open: true, destination: t?.destination || "sua próxima viagem" });
              }, 600);
              await (supabase as any)
                .from("bookings")
                .update({ notification_shown: true })
                .eq("id", b.id);
            }
          }
        }
      } catch (err) {
        console.error("Erro crítico ao carregar Dashboard:", err);
      }
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (photos.length <= 1) return;
    const timer = window.setInterval(() => {
      setPhotoIdx((current) => (current + 1) % photos.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [photos.length]);

  // Realtime: detecta aprovação de pré-reserva, dispara confetti e abre modal com CTA
  const celebratedRef = useRef<Set<string>>(new Set());
  const refetchActiveTrip = async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const { data: qConfirmed } = await supabase
      .from("trip_queries")
      .select("*, trips(*)")
      .eq("user_id", user.id)
      .eq("status", "confirmada")
      .order("created_at", { ascending: false })
      .limit(1);
    const cq: any = qConfirmed?.[0];
    if (!cq) return;
    let relatedTrip = cq.trips;
    if (Array.isArray(relatedTrip)) relatedTrip = relatedTrip[0];
    if (relatedTrip && relatedTrip.end_date >= today) {
      setTrip(relatedTrip as Trip);
      setActiveQuery({
        payment_method: cq.payment_method,
        installments: cq.installments,
        coupon_code: cq.coupon_code,
      });
      if (cq.seat_number != null) setBookedSeat(String(cq.seat_number));
    }
  };

  useEffect(() => {
    if (!user) return;

    const triggerCelebration = async (tripId: string, sourceId: string) => {
      if (celebratedRef.current.has(sourceId)) return;
      celebratedRef.current.add(sourceId);
      try { localStorage.setItem(`approval-shown-${sourceId}`, "1"); } catch {}
      celebrateApproval();
      const { data: t } = await supabase
        .from("trips")
        .select("destination")
        .eq("id", tripId)
        .maybeSingle();
      setApprovalModal({ open: true, destination: t?.destination || "sua próxima viagem" });
      await refetchActiveTrip();
    };

    // Canal 1: pré-reservas (trip_queries) — fluxo legado/atual
    const queriesChannel = supabase
      .channel(`client-approval-queries-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trip_queries",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload: any) => {
          const newRow = payload.new;
          if (newRow?.status === "confirmada") {
            await triggerCelebration(newRow.trip_id, newRow.id);
          }
        }
      )
      .subscribe();

    // Canal 2: bookings — escuta confirmação direta na tabela bookings
    // Como bookings.client_id referencia clients.id (não auth.uid), resolvemos o client_id pelo email
    let bookingsChannel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const email = user.email;
      if (!email) return;
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      const clientId = client?.id;
      if (!clientId) return;

      bookingsChannel = supabase
        .channel(`client-approval-bookings-${clientId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "bookings",
            filter: `client_id=eq.${clientId}`,
          },
          async (payload: any) => {
            const newRow: any = payload.new;
            if (newRow?.status === "confirmada" && !newRow?.notification_shown) {
              await triggerCelebration(newRow.trip_id, newRow.id);
              // Marca notification_shown=true para não disparar de novo
              await (supabase as any)
                .from("bookings")
                .update({ notification_shown: true })
                .eq("id", newRow.id);
            }
          }
        )
        .subscribe();
    })();

    return () => {
      supabase.removeChannel(queriesChannel);
      if (bookingsChannel) supabase.removeChannel(bookingsChannel);
    };
  }, [user]);

  const copyPix = () => {
    if (!pixKey) return;
    navigator.clipboard.writeText(pixKey);
    toast.success("Chave PIX copiada!");
  };

  const calculateMaxInstallments = (trip: Trip, method: string) => {
    if (method === "cartao") return trip.max_installments_card || 12;
    if (!trip.start_date) return 1;
    // Boleto/Pix/Dinheiro: Meses entre hoje e o início da viagem
    try {
      const start = startOfMonth(parseISO(trip.start_date));
      const now = startOfMonth(new Date());
      const diff = differenceInMonths(start, now);
      return Math.max(1, isNaN(diff) ? 1 : diff);
    } catch {
      return 1;
    }
  };

  const handleBooking = async () => {
    if (!selectedPublicTrip || !user) return;

    if (!selectedSeat) {
      toast.error("Selecione uma poltrona antes de confirmar a pré-reserva.");
      return;
    }

    // 1. Pré-reservar a poltrona (status fica como 'pendente' até o admin confirmar)
    try {
      const passengerName = (user.user_metadata?.name as string) || user.email || "Cliente";
      const phone = (user.user_metadata?.phone as string) || "";
      await mcpService.prereserveSeat(selectedPublicTrip.id, selectedSeat, passengerName, phone);
    } catch (err: any) {
      console.error("Erro ao pré-reservar poltrona:", err);
      toast.error(err?.message || "Esta poltrona já foi reservada. Escolha outra.");
      // recarrega o mapa de poltronas
      try {
        const seats = await mcpService.getSeats(selectedPublicTrip.id);
        setTripSeats(seats.map((s: any) => ({
          number: s.seat_number,
          status: s.status === "free" ? "available" : "occupied",
          occupantName: s.occupant_name || (s.status === "pending" ? "Pré-reservada" : undefined),
          floor: Number(s.seat_number) <= 44 ? "superior" : "inferior",
        })));
      } catch {}
      return;
    }

    // 2. Registrar a pré-reserva
    const { error: queryErr } = await supabase.from("trip_queries").insert({
      user_id: user.id,
      trip_id: selectedPublicTrip.id,
      payment_method: bookingForm.paymentMethod,
      installments: parseInt(bookingForm.installments),
      status: "pendente",
      seat_number: parseInt(selectedSeat),
      passenger_name: (user.user_metadata?.name as string) || user.email || "Cliente",
      phone: (user.user_metadata?.phone as string) || null,
      coupon_code: coupon?.code || null,
      discount_percent: coupon?.discount_percent || 0,
    } as any);

    if (queryErr) {
      console.error("ERRO AO REGISTRAR PRÉ-RESERVA no banco:", queryErr);
      toast.error("Erro ao registrar interesse. Tente novamente.");
      return;
    }

    // 3. Notificar o administrador
    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    if (admins && admins.length > 0) {
      const clientName = user.user_metadata?.name || user.email;
      const notifications = admins.map(admin => ({
        user_id: admin.user_id,
        title: "Nova pré-reserva",
        message: `${clientName} pré-reservou a poltrona ${selectedSeat} para ${selectedPublicTrip.destination}. Confira no painel!`
      }));
      await supabase.from("notifications").insert(notifications);
    }

    toast.success(`Pré-reserva confirmada! Poltrona ${selectedSeat} aguardando aprovação do administrador.`);
    setSelectedPublicTrip(null);
    setSelectedSeat(null);
  };

  const paidPercent = trip && trip.total_price > 0 ? Math.min(100, Math.round((paidAmount / trip.total_price) * 100)) : 0;
  const remaining = trip ? Math.max(0, trip.total_price - paidAmount) : 0;
  const daysLeft = trip?.start_date ? Math.max(0, Math.ceil((new Date(trip.start_date).getTime() - Date.now()) / 86400000)) : 0;
  
  // Cálculo do progresso do tempo (com proteção contra datas nulas ou NaN)
  const totalTripTimeMs = trip?.created_at && trip?.start_date ? new Date(trip.start_date).getTime() - new Date(trip.created_at).getTime() : 0;
  const elapsedTimeMs = trip?.created_at ? Date.now() - new Date(trip.created_at).getTime() : 0;
  const timePercent = totalTripTimeMs > 0 ? Math.min(100, Math.max(0, Math.round((elapsedTimeMs / totalTripTimeMs) * 100))) : 0;

  return (
    <div className="space-y-8">
      {/* Banner: Acompanhe sua viagem */}
      {trip && (
        <Link
          to="/client/my-trips"
          className="w-full text-left glass-strong rounded-2xl p-4 sm:p-5 border border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 hover:scale-[1.01] transition-all shadow-lg shadow-emerald-500/10 animate-fade-in flex items-center gap-4"
        >
          <div className="bg-emerald-500/20 p-3 rounded-xl border border-emerald-500/30 shrink-0">
            <Plane className="h-6 w-6 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Acompanhe sua viagem aqui!</p>
            <p className="text-base sm:text-lg font-black truncate">{trip.destination}</p>
            <p className="text-xs text-muted-foreground">Toque para abrir Minhas Viagens e ver o progresso</p>
          </div>
          <ChevronRight className="h-5 w-5 text-emerald-400 shrink-0" />
        </Link>
      )}

      {/* Hero Welcome Section */}
      <div className="text-left space-y-2 animate-fade-in translate-y-[-10px]">
        <h1 className="text-3xl md:text-4xl font-black gradient-primary-text leading-tight">
          {trip ? "Sua viagem está confirmada!" : "Escolha seu próximo destino"}
        </h1>
        {!trip && (
          <p className="text-muted-foreground text-sm font-medium">
            Confira nossas melhores ofertas abaixo e garanta sua próxima aventura.
          </p>
        )}
        {trip && (
          <p className="text-muted-foreground text-sm font-medium">
            Agora você tem uma viagem ativa. Confira todos os detalhes em <Link to="/client/my-trips" className="text-primary font-bold underline">Minhas Viagens</Link>.
          </p>
        )}
      </div>

      {trip && (
        <div id="minha-viagem-ativa" className="space-y-6 scroll-mt-24">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" />
              Minha Viagem Ativa
            </h2>
            <Badge variant="outline" className="border-emerald-500 text-emerald-500 bg-emerald-500/5 animate-pulse">
              RESERVA CONFIRMADA
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              {/* Photo Carousel */}
              {photos.length > 0 && (
                <div className="relative rounded-xl overflow-hidden shadow-2xl border border-primary/20">
                  <img src={photos[photoIdx]} alt="Destino" className="w-full h-72 object-cover" />
                  {photos.length > 1 && (
                    <>
                      <button onClick={() => setPhotoIdx((photoIdx - 1 + photos.length) % photos.length)} className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow-lg transition-all border border-primary/20">
                        <ChevronLeft className="h-6 w-6 text-primary" />
                      </button>
                      <button onClick={() => setPhotoIdx((photoIdx + 1) % photos.length)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow-lg transition-all border border-primary/20">
                        <ChevronRight className="h-6 w-6 text-primary" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <Card className="lg:col-span-2 glass animate-fade-in border-primary/30 shadow-xl self-start">
              <CardHeader className="pb-2">
                <CardTitle className="text-2xl font-black flex items-center gap-3">
                   <div className="bg-accent/20 p-2 rounded-lg"><Plane className="h-6 w-6 text-accent" /></div>
                   {trip.destination}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-strong rounded-xl p-4 text-center border-primary/10 hover:border-primary/40 transition-all">
                    <Calendar className="h-6 w-6 text-primary mx-auto mb-1" />
                    <p className="text-3xl font-black">{daysLeft}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">dias para embarque</p>
                  </div>
                  <div className="glass-strong rounded-xl p-4 text-center border-primary/10 hover:border-orange-400/40 transition-all">
                    <Armchair className="h-6 w-6 text-orange-400 mx-auto mb-1" />
                    <p className="text-3xl font-black">{bookedSeat || "—"}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">sua poltrona</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-black uppercase text-muted-foreground">
                      <span>Status do Pagamento</span>
                      <span className="text-primary">{paidPercent}% Pago</span>
                    </div>
                  </div>

                  {/* A Jornada do Ônibus — agora baseada em datas (criação → embarque) */}
                  <div className="pt-2">
                    <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                      <span>Contagem para o Embarque</span>
                      <span className="text-orange-500 text-xs text-right leading-none">
                         {timePercent >= 100 ? "EMBARCANDO!" : `${daysLeft} dias`}
                      </span>
                    </div>
                    <div className="relative h-8 w-full bg-secondary/80 rounded-full overflow-hidden shadow-inner border border-border/50">
                      <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-400 via-primary to-emerald-500 transition-all duration-1000 ease-out"
                        style={{ width: `${Math.max(5, timePercent)}%` }}
                      />
                      {/* Animated Bus Icon tracking time progress */}
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 drop-shadow-md text-white transition-all duration-1000 ease-out z-10"
                        style={{ left: `calc(${Math.max(5, timePercent)}% - 16px)` }}
                      >
                        <div className="bg-background p-1.5 rounded-full border border-primary/20 shadow-lg">
                           <Bus className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                    </div>
                    <p className="text-[9px] text-center italic text-muted-foreground mt-2">
                      O ônibus avança conforme se aproxima a data da viagem.
                    </p>
                  </div>
                </div>

                {activeQuery && (
                  <div className="glass-strong rounded-xl p-4 space-y-2 border-primary/20">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-primary tracking-widest">
                      <CreditCard className="h-3 w-3" />
                      Forma de Pagamento
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold capitalize">{activeQuery.payment_method}</span>
                      <span className="text-muted-foreground">
                        {activeQuery.installments}x parcela{activeQuery.installments > 1 ? "s" : ""}
                      </span>
                    </div>
                    {activeQuery.coupon_code && (
                      <div className="flex items-center gap-2 text-xs text-emerald-400">
                        <Tag className="h-3 w-3" />
                        Cupom aplicado: <span className="font-mono font-bold">{activeQuery.coupon_code}</span>
                      </div>
                    )}
                  </div>
                )}

                {pixKey && (
                  <div className="glass-strong rounded-xl p-4 space-y-3 border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-500 tracking-tighter">
                      <KeyRound className="h-3 w-3" />
                      Pagamento via Chave PIX
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-background/50 rounded-lg px-3 py-2 text-xs font-mono break-all border border-emerald-500/10 shadow-inner">{pixKey}</code>
                      <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-emerald-500/20 hover:text-emerald-500 transition-all" onClick={copyPix}><Copy className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Main Showcase Grid: Suggestions vs Promotions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
        
        {/* Left Column: Suggestions */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black flex items-center gap-2">
            <Plane className="h-6 w-6 text-primary" />
            Sugestões de Viagem
          </h2>
          <div className="grid grid-cols-1 gap-6">
            {publicTrips.map((t) => (
              <Card 
                key={t.id} 
                className="glass animate-fade-in overflow-hidden hover:scale-[1.02] transition-transform cursor-pointer border-border/50 group" 
                onClick={() => setSelectedPublicTrip(t)}
              >
                <div className="h-44 w-full relative overflow-hidden">
                  {(t as any).preview_image ? (
                    <img src={(t as any).preview_image} alt={t.destination} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-secondary/30"><Plane className="h-10 w-10 text-muted-foreground/30" /></div>
                  )}
                </div>
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="flex items-center gap-2 text-lg font-black group-hover:text-primary transition-colors">
                    <Tag className="h-4 w-4 text-primary" />
                    {t.destination}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-black uppercase tracking-wider">
                      <Calendar className="h-3 w-3 text-foreground" />
                      Saída: {(() => { try { return new Date(t.start_date).toLocaleDateString("pt-BR"); } catch { return "—"; } })()}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-primary font-black text-sm">R$ {Number(t.total_price || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      <Button variant="ghost" size="sm" className="text-xs text-primary font-black h-7 hover:bg-primary/10">
                        Ver Detalhes
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {publicTrips.length === 0 && (
              <div className="text-center py-10 glass rounded-2xl border-dashed border-border/50">
                <p className="text-muted-foreground italic text-sm">Nenhuma viagem disponível no momento.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Promotions */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black flex items-center gap-2">
            <Tag className="h-6 w-6 text-accent" />
            Promoções Imperdíveis
          </h2>
          <div className="grid grid-cols-1 gap-6">
            {promotions.map((promo) => (
              <Card key={promo.id} className="glass animate-fade-in overflow-hidden hover:scale-[1.02] transition-transform border-accent/20 group">
                <div className="h-44 w-full relative overflow-hidden">
                  {promo.preview_image ? (
                    <img src={promo.preview_image} alt={promo.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="bg-secondary/30 h-full flex items-center justify-center"><Tag className="h-10 w-10 text-muted-foreground/30" /></div>
                  )}
                  <div className="absolute top-3 left-3 bg-accent text-white text-[10px] font-black px-2 py-1 rounded shadow-lg">OFERTA</div>
                </div>
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="flex items-center gap-2 text-lg font-black group-hover:text-accent transition-colors">
                    <Tag className="h-4 w-4 text-accent" />
                    {promo.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">{promo.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-black uppercase tracking-wider">
                      <Calendar className="h-3 w-3 text-foreground" />
                      Até {(() => { try { return new Date(promo.expires_at).toLocaleDateString("pt-BR"); } catch { return "—"; } })()}
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs text-accent font-black h-7 hover:bg-accent/10">
                      Ver Detalhes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {promotions.length === 0 && (
              <div className="text-center py-10 glass rounded-2xl border-dashed border-border/50">
                <p className="text-muted-foreground italic text-sm">Aguarde nossas próximas ofertas!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!selectedPublicTrip} onOpenChange={() => { setSelectedPublicTrip(null); setCoupon(null); setCouponInput(""); }}>
        <DialogContent className="glass-strong max-w-3xl w-[95vw] max-h-[92vh] overflow-y-auto border-primary/20 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl font-black">
              <div className="bg-primary/20 p-2 rounded-lg"><Plane className="h-6 w-6 text-primary" /></div>
              {selectedPublicTrip?.destination}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 text-foreground" />
                {selectedPublicTrip ? `${(() => { try { return new Date(selectedPublicTrip.start_date).toLocaleDateString("pt-BR"); } catch { return "-"; } })()} — ${(() => { try { return new Date(selectedPublicTrip.end_date).toLocaleDateString("pt-BR"); } catch { return "-"; } })()}` : ""}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{selectedPublicTrip?.description}</p>
            </div>

            {/* 1) Parcelas / Pagamento */}
            <div className="p-5 bg-secondary/30 rounded-2xl border border-primary/10 shadow-inner space-y-5">
              <h4 className="text-xs font-black uppercase text-muted-foreground tracking-[0.2em]">1. Forma de Pagamento</h4>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: "pix", icon: DollarSign, label: "Pix" },
                    { id: "boleto", icon: DollarSign, label: "Boleto" },
                    { id: "dinheiro", icon: DollarSign, label: "Dinheiro" },
                    { id: "cartao", icon: CreditCard, label: "Cartão" }
                  ].map(method => (
                    <button 
                      key={method.id}
                      onClick={() => setBookingForm({ ...bookingForm, paymentMethod: method.id, installments: "1" })}
                      className={`flex flex-col items-center p-3 rounded-xl border transition-all duration-300 shadow-sm ${bookingForm.paymentMethod === method.id ? 'border-primary bg-primary/20 text-primary scale-105 shadow-primary/20' : 'border-border/30 text-muted-foreground hover:bg-secondary/50'}`}
                    >
                      <method.icon className="h-5 w-5 mb-1" />
                      <span className="text-[10px] font-black uppercase">{method.label}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Opções de Parcelamento</label>
                  {selectedPublicTrip && (
                    <select 
                      value={bookingForm.installments}
                      onChange={(e) => setBookingForm({ ...bookingForm, installments: e.target.value })}
                      className="w-full bg-background/50 border border-primary/10 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all shadow-inner"
                    >
                      {[...Array(calculateMaxInstallments(selectedPublicTrip, bookingForm.paymentMethod))].map((_, i) => (
                        <option key={i+1} value={i+1}>
                          {i+1}x de R$ {(selectedPublicTrip.total_price / (i+1)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </option>
                      ))}
                    </select>
                  )}
                  {bookingForm.paymentMethod !== "cartao" && (
                     <div className="bg-orange-400/10 p-2 rounded-lg flex items-center gap-2 mt-2">
                        <Info className="h-3 w-3 text-orange-400" />
                        <p className="text-[9px] text-orange-400 font-bold uppercase tracking-tight">Parcelamento inteligente limitado pela data da viagem.</p>
                     </div>
                  )}
                </div>
              </div>
            </div>

            {/* Cupom + Resumo do valor */}
            {selectedPublicTrip && (() => {
              const breakdown = computePrice({
                base: Number(selectedPublicTrip.total_price),
                paymentMethod: bookingForm.paymentMethod,
                installments: parseInt(bookingForm.installments) || 1,
                creditCardFeePercent: Number(selectedPublicTrip.credit_card_fee_percent) || 0,
                boletoFeePercent: Number((selectedPublicTrip as any).boleto_fee_percent) || 0,
                couponPercent: coupon?.discount_percent || 0,
                couponCashOnly: coupon?.cash_only ?? true,
              });
              return (
                <div className="p-5 bg-secondary/30 rounded-2xl border border-primary/10 shadow-inner space-y-4">
                  <h4 className="text-xs font-black uppercase text-muted-foreground tracking-[0.2em]">Cupom de desconto</h4>
                  {coupon ? (
                    <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-emerald-400" />
                        <span className="font-mono font-bold">{coupon.code}</span>
                        <Badge variant="outline" className="border-emerald-500 text-emerald-400">
                          -{coupon.discount_percent}%
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { setCoupon(null); setCouponInput(""); }}>
                        Remover
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="Adicione seu cupom aqui"
                        className="flex-1 bg-background/50 border border-primary/10 rounded-xl px-4 py-2.5 text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-primary"
                      />
                      <Button
                        variant="outline"
                        disabled={couponLoading || !couponInput}
                        onClick={async () => {
                          setCouponLoading(true);
                          const { coupon: c, error } = await validateCoupon(
                            couponInput,
                            bookingForm.paymentMethod,
                            parseInt(bookingForm.installments) || 1
                          );
                          setCouponLoading(false);
                          if (error || !c) { toast.error(error || "Cupom inválido."); return; }
                          setCoupon(c);
                          toast.success(`Cupom ${c.code} aplicado!`);
                        }}
                      >
                        {couponLoading ? "..." : "Aplicar"}
                      </Button>
                    </div>
                  )}

                  <div className="border-t border-border/40 pt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Valor base</span>
                      <span>R$ {breakdown.base.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    {breakdown.feeAmount > 0 && (
                      <div className="flex justify-between text-yellow-400">
                        <span>+ Juros ({breakdown.feePercent}%)</span>
                        <span>R$ {breakdown.feeAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {breakdown.discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>- Cupom ({breakdown.discountPercent}%)</span>
                        <span>- R$ {breakdown.discountAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-base pt-1 border-t border-border/40">
                      <span>Total</span>
                      <span className="text-primary">R$ {breakdown.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 2) Seleção de poltrona — DEPOIS das parcelas */}
            <div className="p-4 sm:p-5 bg-secondary/30 rounded-2xl border border-primary/10 shadow-inner space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                  <Armchair className="h-4 w-4 text-primary" />
                  2. Escolha sua poltrona
                </h4>
                {selectedSeat && (
                  <Badge className="bg-orange-500 text-white border-orange-700 font-black">
                    Poltrona {selectedSeat} selecionada
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 text-[10px] font-black uppercase text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Livre</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500 inline-block" /> Selecionada</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Reservada</span>
              </div>

              {loadingSeats ? (
                <div className="text-center py-6 text-sm text-muted-foreground italic">Carregando poltronas...</div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <BusSeatPicker
                    compact
                    hideOccupantName
                    seats={tripSeats.map(s => ({
                      ...s,
                      status: s.number === selectedSeat ? "selected" : s.status,
                    }))}
                    onSeatClick={(num) => {
                      const seat = tripSeats.find(s => s.number === num);
                      if (seat && seat.status === "occupied") {
                        toast.error("Esta poltrona já está reservada.");
                        return;
                      }
                      setSelectedSeat(prev => (prev === num ? null : num));
                    }}
                  />
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <Button className="w-full gradient-primary h-14 text-lg font-black shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all" onClick={handleBooking}>
                <Check className="mr-3 h-6 w-6" /> Confirmar Pré-reserva
              </Button>
              <p className="text-[10px] text-center text-muted-foreground font-medium italic">Sua intenção de reserva será enviada ao administrador.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Aprovação - aparece quando admin confirma a pré-reserva */}
      <Dialog open={approvalModal.open} onOpenChange={(o) => setApprovalModal((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-md glass-strong border-emerald-500/40">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black gradient-primary-text text-center">
              🎉 Reserva Confirmada!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2 text-center">
            <div className="mx-auto bg-emerald-500/15 border border-emerald-500/40 rounded-full p-4 w-20 h-20 flex items-center justify-center animate-scale-in">
              <Check className="h-10 w-10 text-emerald-400" />
            </div>
            <div className="space-y-2">
              <p className="font-bold text-lg">Sua viagem para <span className="text-primary">{approvalModal.destination}</span> foi aprovada!</p>
              <p className="text-sm text-muted-foreground">
                Todos os detalhes — forma de pagamento, poltrona e barra de progresso até o embarque — já estão disponíveis em <strong>Minhas Viagens</strong>.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-primary to-accent text-white font-black"
                onClick={() => {
                  setApprovalModal({ open: false, destination: "" });
                  navigate("/client/my-trips");
                }}
              >
                Conferir minhas viagens →
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setApprovalModal({ open: false, destination: "" })}
              >
                Continuar navegando
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
