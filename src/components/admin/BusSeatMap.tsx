import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { User, X } from "lucide-react";

interface Seat {
  id?: string;
  seat_number: number;
  status: string;
  passenger_name: string | null;
}

interface BusSeatMapProps {
  tripId: string;
  tripName: string;
  totalSeats: number;
  seats: Seat[];
  onUpdate: () => void;
}

export function BusSeatMap({ tripId, tripName, totalSeats, seats, onUpdate }: BusSeatMapProps) {
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [passengerName, setPassengerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const seatMap = new Map<number, Seat>();
  seats.forEach(s => seatMap.set(s.seat_number, s));

  const handleSeatClick = (seatNum: number) => {
    const seat = seatMap.get(seatNum);
    if (seat?.status === "ocupado") {
      // Show info dialog for occupied seat
      setSelectedSeat(seatNum);
      setPassengerName(seat.passenger_name || "");
      setDialogOpen(true);
    } else {
      // Open assign dialog for free seat
      setSelectedSeat(seatNum);
      setPassengerName("");
      setDialogOpen(true);
    }
  };

  const handleSave = async () => {
    if (!selectedSeat || !passengerName.trim()) {
      toast.error("Informe o nome do passageiro");
      return;
    }
    setSaving(true);
    const existing = seatMap.get(selectedSeat);
    if (existing?.id) {
      await supabase.from("bus_seats").update({
        status: "ocupado",
        passenger_name: passengerName.trim(),
      }).eq("id", existing.id);
    } else {
      await supabase.from("bus_seats").insert({
        trip_id: tripId,
        seat_number: selectedSeat,
        status: "ocupado",
        passenger_name: passengerName.trim(),
      });
    }
    toast.success(`Poltrona ${selectedSeat} reservada para ${passengerName.trim()}`);
    setSaving(false);
    setDialogOpen(false);
    onUpdate();
  };

  const handleFree = async () => {
    if (!selectedSeat) return;
    const existing = seatMap.get(selectedSeat);
    if (existing?.id) {
      setSaving(true);
      await supabase.from("bus_seats").update({
        status: "livre",
        passenger_name: null,
      }).eq("id", existing.id);
      toast.success(`Poltrona ${selectedSeat} liberada`);
      setSaving(false);
      setDialogOpen(false);
      onUpdate();
    }
  };

  const isOccupied = (n: number) => seatMap.get(n)?.status === "ocupado";
  const currentSeat = selectedSeat ? seatMap.get(selectedSeat) : null;

  // Bus layout: 44 seats, 4 per row (2+2 with aisle), 11 rows + last row 4 seats
  const rows: number[][] = [];
  const seatsPerRow = 4;
  const totalRows = Math.ceil(totalSeats / seatsPerRow);
  for (let r = 0; r < totalRows; r++) {
    const row: number[] = [];
    for (let c = 0; c < seatsPerRow; c++) {
      const num = r * seatsPerRow + c + 1;
      if (num <= totalSeats) row.push(num);
    }
    rows.push(row);
  }

  const occupiedCount = seats.filter(s => s.status === "ocupado").length;
  const freeCount = totalSeats - occupiedCount;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-bold">{tripName}</h3>
        <div className="flex items-center justify-center gap-4 mt-2 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500" /> Livre ({freeCount})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-destructive" /> Ocupado ({occupiedCount})
          </span>
        </div>
      </div>

      {/* Bus body */}
      <div className="mx-auto max-w-[280px] sm:max-w-[320px]">
        {/* Bus front */}
        <div className="bg-muted/30 border border-border/50 rounded-t-[2rem] px-4 py-3 text-center">
          <span className="text-xs text-muted-foreground font-medium tracking-wider uppercase">Motorista</span>
        </div>

        {/* Seats grid */}
        <div className="border-x border-border/50 bg-muted/10 px-3 sm:px-4 py-3 space-y-1.5">
          <TooltipProvider delayDuration={200}>
            {rows.map((row, ri) => (
              <div key={ri} className="flex items-center justify-center gap-1">
                {row.map((seatNum, ci) => {
                  const occupied = isOccupied(seatNum);
                  const seat = seatMap.get(seatNum);
                  const seatEl = (
                    <button
                      key={seatNum}
                      onClick={() => handleSeatClick(seatNum)}
                      className={`
                        relative w-12 h-10 sm:w-14 sm:h-12 rounded-lg text-xs font-bold
                        transition-all duration-200 active:scale-95
                        flex items-center justify-center
                        ${occupied
                          ? "bg-destructive/80 text-destructive-foreground hover:bg-destructive shadow-sm shadow-destructive/30"
                          : "bg-emerald-500/80 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-500/30"
                        }
                      `}
                    >
                      {seatNum}
                      {occupied && (
                        <User className="absolute top-0.5 right-0.5 h-3 w-3 opacity-70" />
                      )}
                    </button>
                  );

                  return (
                    <div key={seatNum} className="flex items-center">
                      {occupied && seat?.passenger_name ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{seatEl}</TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">{seat.passenger_name}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        seatEl
                      )}
                      {/* Aisle gap after 2nd seat */}
                      {ci === 1 && <div className="w-4 sm:w-6" />}
                    </div>
                  );
                })}
              </div>
            ))}
          </TooltipProvider>
        </div>

        {/* Bus rear */}
        <div className="bg-muted/30 border border-border/50 rounded-b-xl px-4 py-2 text-center">
          <span className="text-xs text-muted-foreground">Traseira</span>
        </div>
      </div>

      {/* Seat dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass-strong max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Poltrona {selectedSeat} — {currentSeat?.status === "ocupado" ? "Ocupada" : "Livre"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {currentSeat?.status === "ocupado" ? (
              <>
                <div className="glass rounded-lg p-3 flex items-center gap-3">
                  <User className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Passageiro</p>
                    <p className="font-medium">{currentSeat.passenger_name}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Alterar nome..."
                    value={passengerName}
                    onChange={e => setPassengerName(e.target.value)}
                  />
                  <Button onClick={handleSave} disabled={saving || !passengerName.trim()}>
                    Salvar
                  </Button>
                </div>
                <Button variant="destructive" className="w-full" onClick={handleFree} disabled={saving}>
                  <X className="h-4 w-4 mr-2" /> Liberar poltrona
                </Button>
              </>
            ) : (
              <>
                <Input
                  placeholder="Nome do passageiro"
                  value={passengerName}
                  onChange={e => setPassengerName(e.target.value)}
                  autoFocus
                />
                <Button className="w-full" onClick={handleSave} disabled={saving || !passengerName.trim()}>
                  Salvar e marcar como ocupada
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
