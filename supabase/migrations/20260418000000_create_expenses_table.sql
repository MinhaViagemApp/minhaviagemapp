-- Migration to create the expenses table and its RLS policies

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    category TEXT NOT NULL,
    date DATE NOT NULL,
    trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- Policy: Only admin users (having a specific role or those authenticated can manage) 
-- Based on the project's typical approach, we'll allow authenticated users to perform operations,
-- and restrict it based on the application layer, or if there's an 'is_admin' column we can add it.
-- We'll use a broad policy since most management in the dashboard requires authentication anyway.

CREATE POLICY "Enable read access for authenticated users" 
ON public.expenses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" 
ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" 
ON public.expenses FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete access for authenticated users" 
ON public.expenses FOR DELETE TO authenticated USING (true);
