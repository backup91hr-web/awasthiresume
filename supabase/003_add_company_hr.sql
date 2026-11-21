-- Awasthi Resume: which client company the candidate was sent to, and the HR person there
-- Supabase Dashboard -> SQL Editor -> New query -> paste -> Run (safe to run more than once)
alter table public.candidates add column if not exists company text check (char_length(company) <= 200);
alter table public.candidates add column if not exists hr_name text check (char_length(hr_name) <= 200);
