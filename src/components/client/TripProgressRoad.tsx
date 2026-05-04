import { Bus, Flag, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TripProgressRoadProps {
  /** Data de criação/compra (ISO string) */
  createdAt: string;
  /** Data da viagem (ISO string) */
  startDate: string;
  /** Texto opcional exibido abaixo */
  label?: string;
}

const MOTIVATIONAL_MESSAGES = [
  "Falta pouco! A aventura está chegando...",
  "Continue animado, sua viagem está garantida!",
  "Cada dia é um passo mais perto do destino!",
  "A estrada te espera com tudo de bom!",
  "Em breve, novas memórias te aguardam!",
];

/**
 * Barra progressiva animada com estrada de asfalto, ônibus, marcadores de início/fim
 * e balão de pensamento com mensagens motivacionais rotativas.
 * Fórmula: progress = (hoje - criada) / (data_viagem - criada)
 */
export function TripProgressRoad({ createdAt, startDate, label }: TripProgressRoadProps) {
  const { percent, daysLeft, arrived } = useMemo(() => {
    const created = new Date(createdAt).getTime();
    const target = new Date(startDate).getTime();
    const now = Date.now();
    const total = target - created;
    if (!total || total <= 0) return { percent: 100, daysLeft: 0, arrived: true };
    const elapsed = now - created;
    const p = Math.min(100, Math.max(0, (elapsed / total) * 100));
    const days = Math.max(0, Math.ceil((target - now) / 86400000));
    return { percent: p, daysLeft: days, arrived: now >= target };
  }, [createdAt, startDate]);

  // Mensagens motivacionais rotativas (a cada 5s) — só se a viagem ainda não chegou
  const [msgIdx, setMsgIdx] = useState(0);
  const [fade, setFade] = useState(true);
  useEffect(() => {
    if (arrived) return;
    const id = window.setInterval(() => {
      setFade(false);
      window.setTimeout(() => {
        setMsgIdx((i) => (i + 1) % MOTIVATIONAL_MESSAGES.length);
        setFade(true);
      }, 250);
    }, 5000);
    return () => window.clearInterval(id);
  }, [arrived]);

  const currentMessage = arrived
    ? "🚀 Hoje é o grande dia! Boa viagem!"
    : MOTIVATIONAL_MESSAGES[msgIdx];

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">Sua jornada até o destino</span>
        <span className="font-bold text-primary">{percent.toFixed(0)}%</span>
      </div>

      {/* Estrada + ônibus + balão de pensamento */}
      <div className="relative pt-14 pb-2">
        {/* Speech bubble (balão de pensamento) acima do ônibus */}
        <div
          className="absolute top-0 transition-all duration-700 ease-out"
          style={{
            left: `clamp(8%, calc(${percent}% - 80px), calc(100% - 170px))`,
            width: 170,
          }}
          aria-live="polite"
        >
          <div
            className={`relative rounded-2xl bg-card border border-primary/30 shadow-lg shadow-primary/10 px-3 py-2 text-[11px] font-semibold text-foreground text-center transition-opacity duration-300 ${
              fade ? "opacity-100" : "opacity-0"
            }`}
          >
            {currentMessage}
            {/* Bolinhas do pensamento */}
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-card border border-primary/30 rounded-full" />
            <span className="absolute -bottom-3 left-[calc(50%+6px)] w-1.5 h-1.5 bg-card border border-primary/30 rounded-full" />
          </div>
        </div>

        {/* Estrada (asfalto) */}
        <div className="relative h-10 w-full rounded-xl bg-secondary border border-border overflow-hidden shadow-inner">
          {/* Faixa central tracejada (estática) */}
          <div
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 opacity-90"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, hsl(48 96% 60%) 0 18px, transparent 18px 36px)",
              backgroundSize: "36px 100%",
            }}
          />
          {/* Trilha já percorrida (sutil overlay colorido) */}
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/30 to-accent/30 transition-all duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Ônibus se movendo sobre a estrada */}
        <div
          className="absolute -top-1 transition-all duration-700 ease-out"
          style={{ left: `calc(${percent}% - 20px)`, paddingTop: 48 }}
        >
          <div className="bg-accent text-accent-foreground rounded-full p-2 shadow-lg shadow-accent/40 border-2 border-background">
            <Bus className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Marcadores início/fim */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <ShoppingBag className="h-3.5 w-3.5 text-primary" />
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-foreground">Compra realizada</span>
            <span>{format(parseISO(createdAt.slice(0, 10)), "dd 'de' MMM, yyyy", { locale: ptBR })}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground text-right">
          <div className="flex flex-col leading-tight items-end">
            <span className="font-bold text-foreground">Data da viagem</span>
            <span>{format(parseISO(startDate.slice(0, 10)), "dd 'de' MMM, yyyy", { locale: ptBR })}</span>
          </div>
          <Flag className="h-3.5 w-3.5 text-emerald-400" />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label || "Sua viagem está a caminho"}</span>
        {arrived && <span className="font-semibold text-foreground">Hoje é o dia! 🎉</span>}
      </div>

    </div>
  );
}
