import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

interface Trip {
  id: string;
  destination: string;
  start_date: string;
}

interface NewExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function NewExpenseModal({ isOpen, onClose, onSuccess }: NewExpenseModalProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Aluguel de Ônibus");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [tripId, setTripId] = useState<string>("none");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTrips();
    }
  }, [isOpen]);

  const fetchTrips = async () => {
    const { data, error } = await supabase
      .from("trips")
      .select("id, destination, start_date")
      .order("start_date", { ascending: false });

    if (!error && data) {
      setTrips(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !date) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setIsLoading(true);

    const numericAmount = parseFloat(amount.replace(",", "."));

    const { error } = await supabase.from("expenses").insert({
      description,
      amount: numericAmount,
      category,
      date,
      trip_id: tripId === "none" ? null : tripId,
    });

    setIsLoading(false);

    if (error) {
      console.error(error);
      toast.error("Erro ao salvar a despesa.");
    } else {
      toast.success("Despesa adicionada com sucesso!");
      // Limpa form
      setDescription("");
      setAmount("");
      setCategory("Aluguel de Ônibus");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setTripId("none");
      onSuccess();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Lançar Nova Despesa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex: Abastecimento Posto BR"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Data da Despesa</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Aluguel de Ônibus">Aluguel de Ônibus</SelectItem>
                <SelectItem value="Combustível">Combustível</SelectItem>
                <SelectItem value="Alimentação">Alimentação</SelectItem>
                <SelectItem value="Manutenção">Manutenção</SelectItem>
                <SelectItem value="Custos Operacionais">Custos Operacionais</SelectItem>
                <SelectItem value="Gerais">Gerais</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Viagem Relacionada (Opcional)</Label>
            <Select value={tripId} onValueChange={setTripId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a viagem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma viagem específica</SelectItem>
                {trips.map((trip) => (
                  <SelectItem key={trip.id} value={trip.id}>
                    {trip.destination} ({format(new Date(trip.start_date), "dd/MM/yyyy")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : "Salvar Despesa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
