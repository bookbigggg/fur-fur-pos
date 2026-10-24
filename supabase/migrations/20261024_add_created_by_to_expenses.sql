-- Migration: Add created_by column to expenses table if it does not exist
-- Fixes PostgREST schema cache error when inserting expenses with created_by

ALTER TABLE IF EXISTS public.expenses 
ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'ผู้จัดการร้าน';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
