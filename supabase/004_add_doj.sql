-- Awasthi Resume: date of joining for selected candidates
-- Supabase Dashboard -> SQL Editor -> New query -> paste -> Run (safe to run more than once)
alter table public.candidates add column if not exists doj date;
