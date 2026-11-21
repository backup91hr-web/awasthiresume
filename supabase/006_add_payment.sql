-- Awasthi Resume: bill number and payment date for selected candidates
-- payment is due 60 days after the date of joining; the delay is worked out in the app
-- Supabase Dashboard -> SQL Editor -> New query -> paste -> Run (safe to run more than once)
alter table public.candidates add column if not exists bill_no      text check (char_length(bill_no) <= 50);
alter table public.candidates add column if not exists payment_date date;
create index if not exists candidates_bill_no_idx on public.candidates (bill_no);
