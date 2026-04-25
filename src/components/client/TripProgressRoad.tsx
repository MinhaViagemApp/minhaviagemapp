import { Bus } from "lucide-react";
import { useMemo } from "react";

interface TripProgressRoadProps {
  /** Data de criação/início da contagem (ISO string) */
  createdAt: string;
  /** Data da viagem (ISO string) */
  startDate: string;
  /** Texto opcional exibido abaixo */
  label?: string;
}

/**
 * Barra progressiva animada com estrada horizontal e ônibus se movendo.
 * Fórmula: progress = (hoje - criada) / (data_viagem - criada)
 */
export function TripProgressRoad({ createdAt, startDate, label }: TripProgressRoadProps) {
  const { percent, daysLeft } = useMemo(() => {
    const created = new Date(createdAt).getTime();
    const target = new Date(startDate).getTime();
    const now = Date.now();
    const total = target - created;
    if (!total || total <= 0) return { percent: 100, daysLeft: 0 };
    const elapsed = now - created;
    const p = Math.min(100, Math.max(0, (elapsed / total) * 100));
    const days = Math.max(0, Math.ceil((target - now) / 86400000));
    return { percent: p, daysLeft: days };
  }, [createdAt, startDate]);

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">Sua jornada até o destino</span>
        <span className="font-bold text-primary">{percent.toFixed(0)}%</span>
      </div>

      <div className="relative h-14 w-full">
        {/* Estrada */}
        <div className="absolute inset-x-0 bottom-0 h-4 rounded-full bg-secondary/60 border border-border overflow-hidden">
          {/* Faixas centrais animadas */}
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent 0 18px, hsl(var(--muted-foreground) / 0.45) 18px 32px)",
              backgroundSize: "32px 100%",
              animation: "road-stripes 1.2s linear infinite",
            }}
          />
          {/* Trilha já percorrida */}
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/70 to-accent/70 transition-all duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Ônibus */}
        <div
          className="absolute -top-1 transition-all duration-700 ease-out"
          style={{ left: `calc(${percent}% - 18px)` }}
        >
          <div className="bg-accent text-accent-foreground rounded-full p-2 shadow-lg shadow-accent/40 border border-background">
            <Bus className="h-5 w-5" />
          </div>
        </div>

        {/* Bandeira de chegada */}
        <div className="absolute right-0 -top-2 text-2xl select-none" aria-hidden>
          🏁
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label || "Sua viagem está a caminho"}</span>
        <span className="font-semibold text-foreground">
          {daysLeft === 0 ? "Hoje é o dia! 🎉" : `${daysLeft} ${daysLeft === 1 ? "dia restante" : "dias restantes"}`}
        </span>
      </div>

      <style>{`
        @keyframes road-stripes {
          0% { background-position-x: 0; }
          100% { background-position-x: -32px; }
        }
      `}</style>
    </div>
  );
}
