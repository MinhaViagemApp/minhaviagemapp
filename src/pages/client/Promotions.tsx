import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

interface Promotion {
  id: string;
  title: string;
  description: string;
  expires_at: string;
  preview_image?: string;
}

export default function ClientPromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    const fetch_ = async () => {
      const { data } = await supabase
        .from("promotions")
        .select("*, promotion_images(image_url)")
        .eq("draft_status", "published")
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      setPromotions((data || []).map((p) => ({
        ...p,
        preview_image: (p as any).promotion_images?.[0]?.image_url || null,
      })));
    };
    fetch_();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Promoções</h1>
        <p className="text-muted-foreground">Ofertas exclusivas para você</p>
      </div>

      {promotions.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          Nenhuma promoção disponível
        </div>
      ) : (
        <Carousel
          setApi={setApi}
          opts={{ align: "start", loop: true }}
          plugins={[Autoplay({ delay: 4000, stopOnInteraction: false })]}
          className="w-full"
        >
          <CarouselContent>
            {promotions.map((promo) => (
              <CarouselItem key={promo.id} className="md:basis-1/2 lg:basis-1/3">
                <Card className="glass animate-fade-in overflow-hidden h-full">
                  {promo.preview_image ? (
                    <div className="h-48 w-full">
                      <img
                        src={promo.preview_image}
                        alt={promo.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-48 w-full bg-secondary/30 flex items-center justify-center border-b border-border">
                      <Tag className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Tag className="h-4 w-4 text-accent" />
                      {promo.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {promo.description}
                    </p>
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase">
                        <Calendar className="h-3 w-3 text-foreground" />
                        Até{" "}
                        {(() => {
                          try {
                            return new Date(promo.expires_at).toLocaleDateString("pt-BR");
                          } catch {
                            return "—";
                          }
                        })()}
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs text-primary font-bold h-7">
                        Ver Detalhes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      )}
    </div>
  );
}
