-- Awasthi Resume: candidate list
-- Supabase Dashboard -> SQL Editor -> New query -> paste this whole file -> Run

create table if not exists public.candidates (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users(id) on delete set null,
  name             text not null check (char_length(name) between 1 and 200),
  post             text check (char_length(post) <= 200),
  skills           text check (char_length(skills) <= 1000),
  city             text check (char_length(city) <= 100),
  experience_years numeric(4,1) check (experience_years >= 0 and experience_years < 80),
  status           text not null default 'New'
                   check (status in ('New', 'Shortlisted', 'Sent to client', 'Selected', 'Rejected')),
  resume_file      text check (char_length(resume_file) <= 300),
  notes            text check (char_length(notes) <= 2000)
);

create index if not exists candidates_created_at_idx on public.candidates (created_at desc);

-- Only logged-in team members can see or change the list. Visitors without login see nothing.
alter table public.candidates enable row level security;

revoke all on public.candidates from anon;
grant select, insert, update, delete on public.candidates to authenticated;

drop policy if exists "team can read"   on public.candidates;
drop policy if exists "team can add"    on public.candidates;
drop policy if exists "team can edit"   on public.candidates;
drop policy if exists "team can delete" on public.candidates;

create policy "team can read"   on public.candidates for select to authenticated using (true);
create policy "team can add"    on public.candidates for insert to authenticated with check (true);
create policy "team can edit"   on public.candidates for update to authenticated using (true) with check (true);
create policy "team can delete" on public.candidates for delete to authenticated using (true);

-- candidate's full mobile number and email (same as 002_add_mobile_email.sql)
alter table public.candidates add column if not exists mobile text check (char_length(mobile) <= 30);
alter table public.candidates add column if not exists email  text check (char_length(email) <= 200);
create index if not exists candidates_mobile_idx on public.candidates (mobile);

-- client company and HR name (same as 003_add_company_hr.sql)
alter table public.candidates add column if not exists company text check (char_length(company) <= 200);
alter table public.candidates add column if not exists hr_name text check (char_length(hr_name) <= 200);
