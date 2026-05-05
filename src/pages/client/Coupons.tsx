import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag, Calendar, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Coupon {
  id: string;
  code: string;
  discount_percent: number;
  expires_at: string | null;
  cash_only: boolean;
  active: boolean;
  usage_limit: number | null;
  usage_count: number;
}

export default function ClientCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any)
        .from("coupons")
        .select("id, code, discount_percent, expires_at, cash_only, active, usage_limit, usage_count")
        .eq("active", true)
        .order("created_at", { ascending: false });
      const filtered = (data || []).filter((c: Coupon) => {
        if (c.expires_at && new Date(c.expires_at) < new Date()) return false;
        if (c.usage_limit && c.usage_count >= c.usage_limit) return false;
        return true;
      });
      setCoupons(filtered);
    };
    load();
  }, []);

  const copyCode = async (c: Coupon) => {
    try {
      await navigator.clipboard.writeText(c.code);
      setCopiedId(c.id);
      toast.success(`Cupom ${c.code} copiado!`);
      setTimeout(() => setCopiedId((id) => (id === c.id ? null : id)), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cupons</h1>
        <p className="text-muted-foreground">Códigos de desconto para usar nas suas reservas</p>
      </div>

      {coupons.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          Nenhum cupom ativo no momento
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coupons.map((c) => (
            <Card key={c.id} id={`coupon-${c.id}`} className="glass animate-fade-in border-accent/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Tag className="h-4 w-4 text-accent" />
                  {c.code}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-accent text-accent text-base font-black">
                    {c.discount_percent}% OFF
                  </Badge>
                  {c.cash_only && (
                    <Badge variant="secondary" className="text-[10px]">À vista</Badge>
                  )}
                </div>
                {c.expires_at && (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-bold uppercase">
                    <Calendar className="h-3 w-3" />
                    Válido até {new Date(c.expires_at).toLocaleDateString("pt-BR")}
                  </div>
                )}
                <Button
                  size="sm"
                  className="w-full gradient-accent text-white font-bold"
                  onClick={() => copyCode(c)}
                >
                  {copiedId === c.id ? (
                    <><Check className="h-4 w-4" /> Copiado</>
                  ) : (
                    <><Copy className="h-4 w-4" /> Copiar código</>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
