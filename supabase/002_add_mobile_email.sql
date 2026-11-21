-- Awasthi Resume: add the candidate's full mobile number and email to the list
-- Supabase Dashboard -> SQL Editor -> New query -> paste -> Run (safe to run more than once)
alter table public.candidates add column if not exists mobile text check (char_length(mobile) <= 30);
alter table public.candidates add column if not exists email  text check (char_length(email) <= 200);
create index if not exists candidates_mobile_idx on public.candidates (mobile);
