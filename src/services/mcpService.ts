import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface Seat {
  id: string;
  seat_number: string;
  status: 'free' | 'reserved' | 'occupied';
  user_id: string | null;
  reserved_at: string | null;
  trip_id?: string | null;
}

export const mcpService = {
  /**
   * Busca poltronas da tabela 'seats'
   */
  async getSeats(trip_id?: string): Promise<Seat[]> {
    let query = supabase
      .from('seats')
      .select('*')
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

    return data as Seat[];
  },

  /**
   * Cria 60 poltronas iniciais para uma viagem
   */
  async seedSeats(trip_id: string): Promise<Seat[]> {
    const seatsToInsert = Array.from({ length: 60 }, (_, i) => ({
      seat_number: (i + 1).toString().padStart(2, '0'),
      status: 'free',
      trip_id: trip_id
    }));

    const { data, error } = await supabase
      .from('seats')
      .insert(seatsToInsert)
      .select();

    if (error) {
      console.error("Erro ao criar poltronas iniciais:", error.message);
      throw error;
    }

    return data as Seat[];
  },

  /**
   * Reserva uma poltrona se ela estiver livre ('free')
   */
  async reserveSeat(seat_id: string, user_id: string): Promise<void> {
    const { data, error } = await supabase
      .from('seats')
      .update({
        status: 'reserved',
        user_id: user_id,
        reserved_at: new Date().toISOString()
      })
      .eq('id', seat_id)
      .eq('status', 'free'); // Condição obrigatória: só atualizar se status for 'free'

    if (error) {
      console.error("Erro ao reservar poltrona:", error.message);
      throw error;
    }

    // Se nenhuma linha foi afetada, significa que a poltrona não estava 'free'
    // No Supabase/Postgrest, o update retorna o que foi atualizado. 
    // Se não retornar nada (ou dependendo da config), podemos assumir falha silenciosa se não checarmos data.
  }
};
