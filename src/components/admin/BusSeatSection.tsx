import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bus, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BusSeatMap } from "./BusSeatMap";

interface TripOption {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  total_seats: number;
}

interface SeatData {
  id: string;
  seat_number: number;
  status: string;
  passenger_name: string | null;
}

export function BusSeatSection() {
  const { companyId } = useAuth();
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<TripOption | null>(null);
  const [seats, setSeats] = useState<SeatData[]>([]);
  const [animateBus, setAnimateBus] = useState(false);

  useEffect(() => {
    if (!companyId || !open) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("trips")
        .select("id, destination, start_date, end_date, total_seats")
        .eq("company_id", companyId)
        .gte("end_date", new Date().toISOString().split("T")[0])
        .order("start_date", { ascending: true });
      setTrips((data as any[]) || []);
    };
    fetch();
  }, [companyId, open]);

  const loadSeats = async (trip: TripOption) => {
    setSelectedTrip(trip);
    setAnimateBus(true);
    const { data } = await supabase
      .from("bus_seats")
      .select("id, seat_number, status, passenger_name")
      .eq("trip_id", trip.id)
      .order("seat_number");
    setSeats((data as SeatData[]) || []);
  };

  const refreshSeats = async () => {
    if (!selectedTrip) return;
    const { data } = await supabase
      .from("bus_seats")
      .select("id, seat_number, status, passenger_name")
      .eq("trip_id", selectedTrip.id)
      .order("seat_number");
    setSeats((data as SeatData[]) || []);
  };

  return (
    <div className="glass rounded-xl overflow-hidden animate-fade-in">
      <button
        onClick={() => { setOpen(!open); if (!open) { setSelectedTrip(null); setAnimateBus(false); } }}
        className="w-full flex items-center justify-between p-5 hover:bg-muted/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bus className="h-5 w-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-bold text-base">Disponibilidade de Poltronas</p>
            <p className="text-sm text-muted-foreground">Gerencie poltronas dos ônibus</p>
          </div>
        </div>
        {open ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 animate-fade-in">
          {/* Trip list */}
          {!selectedTrip && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Selecione uma viagem ativa ou programada:</p>
              {trips.length === 0 && <p className="text-sm text-muted-foreground italic">Nenhuma viagem ativa encontrada.</p>}
              {trips.map(t => (
                <button
                  key={t.id}
                  onClick={() => loadSeats(t)}
                  className="w-full glass rounded-lg p-3 text-left hover:bg-muted/20 transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{t.destination}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.start_date).toLocaleDateString("pt-BR")} — {new Date(t.end_date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{t.total_seats} poltronas</span>
                </button>
              ))}
            </div>
          )}

          {/* Bus seat map with animation */}
          {selectedTrip && (
            <div>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedTrip(null); setAnimateBus(false); }} className="mb-3">
                ← Voltar às viagens
              </Button>
              <div
                className={`transition-all duration-700 ease-out ${animateBus ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"}`}
              >
                <BusSeatMap
                  tripId={selectedTrip.id}
                  tripName={selectedTrip.destination}
                  totalSeats={selectedTrip.total_seats}
                  seats={seats}
                  onUpdate={refreshSeats}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
