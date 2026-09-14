-- KinDex /admin visitor analytics (run once in Supabase SQL editor).

create table if not exists public.site_traffic_days (
  day text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_traffic_days enable row level security;
-- Service role bypasses RLS. No anon policies on purpose.
