-- Awasthi Resume: salary and billing for selected candidates
-- annual = monthly x 12, bill = 7.5% of annual, GST = 18% of bill, total = bill + GST (worked out in the app)
-- Supabase Dashboard -> SQL Editor -> New query -> paste -> Run (safe to run more than once)
alter table public.candidates add column if not exists monthly_salary numeric(12,2) check (monthly_salary >= 0);
alter table public.candidates add column if not exists annual_salary  numeric(14,2) check (annual_salary >= 0);
alter table public.candidates add column if not exists bill_amount    numeric(14,2) check (bill_amount >= 0);
alter table public.candidates add column if not exists gst_amount     numeric(14,2) check (gst_amount >= 0);
alter table public.candidates add column if not exists total_bill     numeric(14,2) check (total_bill >= 0);
