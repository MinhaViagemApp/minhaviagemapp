import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentTimeline, type InstallmentItem } from "@/components/client/PaymentTimeline";
import { Loader2, MapPin, Calendar, CreditCard, FileText, QrCode } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TripGroup {
  trip_id: string;
  destination: string;
  start_date: string;
  end_date: string;
  total_price: number;
  payment_method: string;
  installments: InstallmentItem[];
  paidSum: number;
}

const methodLabel = (m: string) =>
  m === "pix" ? "Pix" : m === "cartao" ? "Cartão de Crédito" : "Boleto";

const MethodIcon = ({ m }: { m: string }) => {
  if (m === "pix") return <QrCode className="h-4 w-4 text-primary" />;
  if (m === "cartao") return <CreditCard className="h-4 w-4 text-primary" />;
  return <FileText className="h-4 w-4 text-primary" />;
};

export default function ClientPayments() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<TripGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [pixKey, setPixKey] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Resolver client_id pelo email (cadastro feito pelo admin) e profile do usuário
      const [clientRowRes, queriesRes, adminsRes] = await Promise.all([
        user.email
          ? supabase.from("clients").select("id").eq("email", user.email).maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase
          .from("trip_queries")
          .select("trip_id, payment_method, status")
          .eq("user_id", user.id)
          .eq("status", "confirmada"),
        supabase.from("user_roles").select("user_id").eq("role", "admin").limit(1),
      ]);

      const clientId = (clientRowRes as any)?.data?.id as string | undefined;
      const tripMethodMap = new Map<string, string>();
      (queriesRes.data || []).forEach((q: any) => {
        if (q.trip_id) tripMethodMap.set(q.trip_id, q.payment_method);
      });

      let bookings: any[] = [];
      if (clientId) {
        const { data } = await supabase
          .from("bookings")
          .select("trip_id, payment_method")
          .eq("client_id", clientId);
        bookings = data || [];
        bookings.forEach((b: any) => {
          if (!tripMethodMap.has(b.trip_id)) tripMethodMap.set(b.trip_id, b.payment_method);
        });
      }

      const tripIds = Array.from(tripMethodMap.keys());
      if (tripIds.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      // Busca parcelas: prioriza por client_id (mais confiável); fallback por user_id
      const instsQuery = clientId
        ? supabase.from("installments").select("*").in("trip_id", tripIds).or(`client_id.eq.${clientId},user_id.eq.${user.id}`)
        : supabase.from("installments").select("*").in("trip_id", tripIds).eq("user_id", user.id);

      const [tripsRes, instsRes, paysRes, pixRes] = await Promise.all([
        supabase.from("trips").select("id, destination, start_date, end_date, total_price").in("id", tripIds),
        instsQuery,
        supabase.from("payments").select("trip_id, amount_paid").in("trip_id", tripIds),
        adminsRes.data?.[0]?.user_id
          ? supabase.from("profiles").select("pix_key").eq("id", adminsRes.data[0].user_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);

      // Deduplica por id
      const seenIds = new Set<string>();
      const uniqueInsts = (instsRes.data || []).filter((i: any) => {
        if (seenIds.has(i.id)) return false;
        seenIds.add(i.id);
        return true;
      });

      const instsByTrip: Record<string, InstallmentItem[]> = {};
      uniqueInsts.forEach((i: any) => {
        (instsByTrip[i.trip_id] ||= []).push(i);
      });
      Object.values(instsByTrip).forEach((arr) =>
        arr.sort((a: any, b: any) => (a.installment_number || 0) - (b.installment_number || 0))
      );
      const paidByTrip: Record<string, number> = {};
      (paysRes.data || []).forEach((p: any) => {
        paidByTrip[p.trip_id] = (paidByTrip[p.trip_id] || 0) + Number(p.amount_paid);
      });

      const groupsArr: TripGroup[] = (tripsRes.data || []).map((t: any) => ({
        trip_id: t.id,
        destination: t.destination,
        start_date: t.start_date,
        end_date: t.end_date,
        total_price: Number(t.total_price),
        payment_method: tripMethodMap.get(t.id) || "pix",
        installments: instsByTrip[t.id] || [],
        paidSum: paidByTrip[t.id] || 0,
      }));

      setGroups(groupsArr);
      const pix = (pixRes as any)?.data?.pix_key;
      if (pix) setPixKey(pix);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black gradient-primary-text">Meus Pagamentos</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe parcelas pagas, futuras e envie seus comprovantes.
        </p>
      </header>

      {groups.length === 0 && (
        <Card className="glass-strong">
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum pagamento encontrado.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5">
        {groups.map((g) => {
          const totalParcelas = g.installments.length;
          const pagas = g.installments.filter((i) => i.status === "pago").length;
          const pixPaid = g.payment_method === "pix" ? g.paidSum >= g.total_price : false;
          return (
            <Card key={g.trip_id} className="glass-strong animate-fade-in">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/15 p-2.5 rounded-xl border border-primary/30">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{g.destination}</CardTitle>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(g.start_date), "dd 'de' MMM", { locale: ptBR })}
                        {" → "}
                        {format(parseISO(g.end_date), "dd 'de' MMM, yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5 flex items-center gap-1">
                      <MethodIcon m={g.payment_method} />
                      {methodLabel(g.payment_method)}
                      {totalParcelas > 1 && ` • ${totalParcelas}x`}
                    </Badge>
                    {totalParcelas > 0 && g.payment_method !== "pix" && (
                      <span className="text-[11px] text-muted-foreground">
                        {pagas}/{totalParcelas} parcelas pagas
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <PaymentTimeline
                  paymentMethod={g.payment_method}
                  installments={g.installments}
                  totalPrice={g.total_price}
                  pixKey={pixKey}
                  pixDueDate={g.start_date}
                  pixPaid={pixPaid}
                  enableUpload
                  onReceiptUploaded={load}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
