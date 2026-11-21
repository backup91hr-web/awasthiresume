-- Awasthi Resume: date of joining and PAN number for selected candidates
-- Supabase Dashboard -> SQL Editor -> New query -> paste -> Run (safe to run more than once)
alter table public.candidates add column if not exists doj date;
alter table public.candidates add column if not exists pan text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$');
