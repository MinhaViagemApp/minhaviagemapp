import { supabase } from '@/integrations/supabase/client';

export interface Seat {
  id: string;
  seat_number: string;
  status: 'free' | 'reserved' | 'occupied';
  user_id: string | null;
  reserved_at: string | null;
  trip_id?: string | null;
  occupant_name?: string | null;
  client_id?: string | null;
}

export const mcpService = {
  /**
   * Busca poltronas da tabela 'seats'
   */
  async getSeats(trip_id?: string): Promise<Seat[]> {
    let query = (supabase as any)
      .from('bus_seats')
      .select('id, trip_id, seat_number, status, passenger_name, client_id, updated_at')
      .order('seat_number', { ascending: true });

    if (trip_id) {
      query = query.eq('trip_id', trip_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao buscar poltronas:", error.message);
      throw error;
    }

    // Se for filtrado por trip_id e não houver poltronas, criamos as 60 poltronas padrão
    if (trip_id && data.length === 0) {
      return await this.seedSeats(trip_id);
    }

    return data.map((seat: any) => ({
      id: seat.id,
      seat_number: String(seat.seat_number).padStart(2, '0'),
      status: seat.status === 'livre' || seat.status === 'free' ? 'free' : 'reserved',
      user_id: seat.client_id,
      client_id: seat.client_id,
      occupant_name: seat.passenger_name,
      reserved_at: seat.updated_at,
      trip_id: seat.trip_id,
    })) as Seat[];
  },

  /**
   * Cria 60 poltronas iniciais para uma viagem
   */
  async seedSeats(trip_id: string): Promise<Seat[]> {
    const seatsToInsert = Array.from({ length: 52 }, (_, i) => ({
      seat_number: i + 1,
      status: 'livre',
      trip_id: trip_id
    }));

    const { data, error } = await (supabase as any)
      .from('bus_seats')
      .insert(seatsToInsert)
      .select();

    if (error) {
      console.error("Erro ao criar poltronas iniciais:", error.message);
      throw error;
    }

    return data.map((seat: any) => ({
      id: seat.id,
      seat_number: String(seat.seat_number).padStart(2, '0'),
      status: 'free',
      user_id: null,
      client_id: null,
      occupant_name: null,
      reserved_at: null,
      trip_id: seat.trip_id,
    })) as Seat[];
  },

  /**
   * Reserva uma poltrona se ela estiver livre ('free')
   */
  async reserveSeat(seat_id: string, client_id: string, passenger_name: string): Promise<void> {
    const { data, error } = await (supabase as any)
      .from('bus_seats')
      .update({
        status: 'ocupada',
        client_id,
        passenger_name,
        updated_at: new Date().toISOString()
      })
      .eq('id', seat_id)
      .in('status', ['livre', 'free'])
      .select('id');

    if (error) {
      console.error("Erro ao reservar poltrona:", error.message);
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error('Esta poltrona já foi reservada por outra pessoa.');
    }
  }
};
