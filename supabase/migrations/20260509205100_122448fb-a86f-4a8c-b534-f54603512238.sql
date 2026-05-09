
-- 1. Add superadmin to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'superadmin';
