import { useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { cn } from "@/lib/utils";

interface Props {
  images: string[];
  alt?: string;
  className?: string;
  imgClassName?: string;
  delay?: number;
  fallback?: React.ReactNode;
  overlay?: React.ReactNode;
}

/**
 * Carrossel automático de imagens — usado nos cards de viagens e promoções.
 * Faz autoplay infinito alternando uma imagem após a outra.
 */
export function ImageAutoCarousel({
  images,
  alt = "",
  className,
  imgClassName,
  delay = 3500,
  fallback,
  overlay,
}: Props) {
  const [api, setApi] = useState<CarouselApi>();

  if (!images || images.length === 0) {
    return <div className={className}>{fallback}</div>;
  }

  if (images.length === 1) {
    return (
      <div className={cn("relative", className)}>
        <img src={images[0]} alt={alt} className={cn("w-full h-full object-cover", imgClassName)} />
        {overlay}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <Carousel
        setApi={setApi}
        opts={{ align: "start", loop: true }}
        plugins={[Autoplay({ delay, stopOnInteraction: false })]}
        className="w-full h-full"
      >
        <CarouselContent className="ml-0">
          {images.map((src, idx) => (
            <CarouselItem key={idx} className="pl-0 basis-full">
              <img src={src} alt={`${alt} ${idx + 1}`} className={cn("w-full h-full object-cover", imgClassName)} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      {/* Indicadores */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {images.map((_, idx) => (
          <span
            key={idx}
            className="w-1.5 h-1.5 rounded-full bg-white/60 shadow"
          />
        ))}
      </div>
      {overlay}
    </div>
  );
}
