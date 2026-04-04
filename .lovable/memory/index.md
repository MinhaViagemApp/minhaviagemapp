# Project Memory

## Core
Minha Viagem App - SaaS multi-tenant para agências de turismo. Dark theme, glassmorphism, primary #FF5C00, accent blue.
Lovable Cloud backend com auth, RLS por role (admin/cliente). Português brasileiro.
Arquitetura multi-empresa: company_id obrigatório. Clientes na tabela `clients`, NÃO em `profiles`.

## Memories
- [Design tokens](mem://design/tokens) — Dark theme com glassmorphism, orange #FF5C00 primary, blue accent
- [Auth flow](mem://features/auth) — Supabase Auth com roles admin/cliente, company_id via user_companies
- [DB schema](mem://features/schema) — companies, user_companies, clients, trips, bookings, installments, payments, promotions, notifications, trip_images
- [Multi-tenant](mem://features/multi-tenant) — Isolamento por company_id, get_user_company_id() helper, RLS em todas as tabelas
