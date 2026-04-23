import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { differenceInMonths, parseISO, startOfMonth } from "date-fns";
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
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [paidAmount, setPaidAmount] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [pixKey, setPixKey] = useState("");
  const [bookedSeat, setBookedSeat] = useState<string | null>(null);
  const [publicTrips, setPublicTrips] = useState<Trip[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [selectedPublicTrip, setSelectedPublicTrip] = useState<Trip | null>(null);
  const [adminPhone, setAdminPhone] = useState("");

  const [bookingForm, setBookingForm] = useState({
    paymentMethod: "pix",
    installments: "1"
  });

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

      // se não houver viagem privada, verificar se há uma pré-reserva confirmada (viagem pública)
      if (!activeTrip) {
        const { data: qConfirmed } = await supabase
          .from("trip_queries")
          .select("*, trips(*)")
          .eq("user_id", user.id)
          .eq("status", "confirmada")
          .order("created_at", { ascending: false })
          .limit(1);
        
        let relatedTrip = qConfirmed?.[0]?.trips;
        if (relatedTrip) {
          if (Array.isArray(relatedTrip)) relatedTrip = relatedTrip[0];
          activeTrip = relatedTrip as unknown as Trip;
        }
      }

      setTrip(activeTrip);

      if (activeTrip) {
        const { data: payments } = await supabase.from("payments").select("amount_paid").eq("trip_id", activeTrip.id);
        setPaidAmount(payments?.reduce((s, p) => s + Number(p.amount_paid), 0) || 0);

        const { data: images } = await supabase.from("trip_images").select("image_url").eq("trip_id", activeTrip.id);
        setPhotos(images?.map(i => i.image_url) || []);

        const { data: seat } = await (supabase as any)
          .from("trip_seats")
          .select("seat_number")
          .eq("trip_id", activeTrip.id)
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (seat) setBookedSeat(seat.seat_number);
      }

      // Fetch public trips
      const { data: pTrips } = await supabase
        .from("trips")
        .select("*, trip_images(image_url)")
        .eq("is_public", true)
        .eq("draft_status", "published")
        .gte("end_date", new Date().toISOString().split("T")[0])
        .order("start_date", { ascending: true });
      
      setPublicTrips((pTrips || []).map(t => ({
        ...t,
        preview_image: (t as any).trip_images?.[0]?.image_url || null
      })));

      // Fetch promotions
      const { data: promos } = await supabase
        .from("promotions")
        .select("*, promotion_images(image_url)")
        .eq("draft_status", "published")
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      
      setPromotions((promos || []).map(p => ({
        ...p,
        preview_image: (p as any).promotion_images?.[0]?.image_url || null
      })));

      // Fetch admin info (PIX and Phone)
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin").limit(1);
      if (admins?.[0]) {
        const { data: profile } = await supabase.from("profiles").select("pix_key, business_phone").eq("id", admins[0].user_id).single();
        if (profile) {
          setPixKey(profile.pix_key || "");
          setAdminPhone(profile.business_phone || "");
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
    
    // 1. Registrar a pré-reserva no banco de dados
    const { error: queryErr } = await supabase.from("trip_queries").insert({
      user_id: user.id,
      trip_id: selectedPublicTrip.id,
      payment_method: bookingForm.paymentMethod,
      installments: parseInt(bookingForm.installments),
      status: "pendente"
    });

    if (queryErr) {
      console.error("ERRO AO REGISTRAR PRÉ-RESERVA no banco:", queryErr);
      if (queryErr?.message?.includes("relation \"public.trip_queries\" does not exist")) {
        toast.error("O banco de dados não foi atualizado. Peça ao admin para rodar o script SQL de hoje.");
      } else {
        toast.error("Erro ao registrar interesse. Tente novamente.");
      }
      return;
    }

    // 2. Notificar o administrador
    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    if (admins && admins.length > 0) {
      const notifications = admins.map(admin => ({
        user_id: admin.user_id,
        title: "Nova consulta de viagem",
        message: `O cliente ${user.user_metadata?.name || user.email} tem interesse na viagem para ${selectedPublicTrip.destination}. Confira no painel!`
      }));
      await supabase.from("notifications").insert(notifications);
    }

    toast.success("Pré-reserva confirmada! O administrador entrará em contato em breve.");
    setSelectedPublicTrip(null);
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
      {/* Hero Welcome Section */}
      <div className="text-left space-y-2 animate-fade-in translate-y-[-10px]">
        <h1 className="text-3xl md:text-4xl font-black gradient-primary-text leading-tight">
          Vamos viajar e escolha seu próximo destino
        </h1>
        {!trip && (
          <p className="text-muted-foreground text-sm font-medium">
            Você ainda não tem reservas ativas. Confira nossas melhores ofertas abaixo!
          </p>
        )}
      </div>

      {trip && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" />
              Minha Viagem Reservada
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

                  {/* A Jornada do Ônibus (Progress Bar Animada) */}
                  <div className="pt-2">
                    <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                      <span>Preparação da Viagem</span>
                      <span className="text-orange-500 text-xs text-right leading-none">
                         {paidPercent >= 100 ? "TUDO PRONTO!" : `Faltam ${100 - paidPercent}%`}
                      </span>
                    </div>
                    <div className="relative h-8 w-full bg-secondary/80 rounded-full overflow-hidden shadow-inner border border-border/50">
                      <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-400 via-primary to-emerald-500 transition-all duration-1000 ease-out"
                        style={{ width: `${Math.max(10, paidPercent)}%` }}
                      />
                      {/* Animated Bus Icon tracking the progress end */}
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 drop-shadow-md text-white transition-all duration-1000 ease-out z-10"
                        style={{ left: `calc(${Math.max(10, paidPercent)}% - 16px)` }}
                      >
                        <div className="bg-background p-1.5 rounded-full border border-primary/20 shadow-lg">
                           <Bus className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                    </div>
                    <p className="text-[9px] text-center italic text-muted-foreground mt-2">
                      Progresso baseado na sua confirmação, data e parcelas pagas.
                    </p>
                  </div>
                </div>

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

      <Dialog open={!!selectedPublicTrip} onOpenChange={() => setSelectedPublicTrip(null)}>
        <DialogContent className="glass-strong max-w-md w-[95vw] border-primary/20 shadow-2xl">
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

            <div className="p-5 bg-secondary/30 rounded-2xl border border-primary/10 shadow-inner space-y-5">
              <h4 className="text-xs font-black uppercase text-muted-foreground tracking-[0.2em]">Simulação de Parcelas</h4>
              
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-3">
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

            <div className="space-y-3 pt-2">
              <Button className="w-full gradient-primary h-14 text-lg font-black shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all" onClick={handleBooking}>
                <Check className="mr-3 h-6 w-6" /> Confirmar Pré-reserva
              </Button>
              <p className="text-[10px] text-center text-muted-foreground font-medium italic">Sua intenção de reserva será enviada ao administrador.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
