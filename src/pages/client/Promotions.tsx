import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag, Calendar } from "lucide-react";

interface Promotion {
  id: string;
  title: string;
  description: string;
  expires_at: string;
  image: string | null;
}

export default function ClientPromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  useEffect(() => {
    const fetch_ = async () => {
      const { data } = await supabase
        .from("promotions")
        .select("*")
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      setPromotions(data || []);
    };
    fetch_();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Promoções</h1>
        <p className="text-muted-foreground">Ofertas exclusivas para você</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {promotions.map((promo) => (
          <Card key={promo.id} className="glass animate-fade-in overflow-hidden">
            {promo.image && (
              <img src={promo.image} alt={promo.title} className="w-full h-40 object-cover" />
            )}
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Tag className="h-4 w-4 text-accent" />
                {promo.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{promo.description}</p>
              {promo.expires_at && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Válida até {new Date(promo.expires_at).toLocaleDateString("pt-BR")}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {promotions.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12">
            Nenhuma promoção disponível
          </div>
        )}
      </div>
    </div>
  );
}
