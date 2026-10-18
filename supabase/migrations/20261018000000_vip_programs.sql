-- ════════════════════════════════════════════════════════════════════
-- VIP Tiers Calculator — programmes conçus pour les marques
-- ════════════════════════════════════════════════════════════════════
-- One row per program. A program linked to a HubSpot company is unique per
-- company; manual programs (brand analysis / manual setup) have no company id.
-- Every @loyoly.io account can read and edit every program (shared workspace).

create table if not exists public.vip_programs (
  id                  uuid primary key default gen_random_uuid(),
  hubspot_company_id  text unique,
  client_name         text not null default 'Configuration manuelle',
  client_domain       text,
  client_plan         text,
  step                smallint not null default 1,
  -- config, settings, tiers, rewards, missions, referral, onboarding answers…
  state               jsonb not null default '{}'::jsonb,
  -- imported customer list: [{ customer_id, total_ordered_TTC, number_of_orders }]
  customers           jsonb not null default '[]'::jsonb,
  customers_count     integer generated always as (jsonb_array_length(customers)) stored,
  tier_count          integer generated always as (jsonb_array_length(state -> 'tiers')) stored,
  created_by          text,
  updated_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Author / timestamps are stamped server-side from the caller's session.
create or replace function public.vip_programs_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.jwt() ->> 'email', new.updated_by);
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce(auth.jwt() ->> 'email', new.created_by);
  end if;
  return new;
end;
$$;

drop trigger if exists vip_programs_stamp on public.vip_programs;
create trigger vip_programs_stamp
  before insert or update on public.vip_programs
  for each row execute function public.vip_programs_stamp();

-- ── Access: signed-in @loyoly.io accounts only ──
alter table public.vip_programs enable row level security;

revoke all on public.vip_programs from anon;
grant select, insert, update, delete on public.vip_programs to authenticated;

drop policy if exists "Loyoly team reads programs" on public.vip_programs;
create policy "Loyoly team reads programs" on public.vip_programs
  for select to authenticated
  using ((select auth.jwt() ->> 'email') ilike '%@loyoly.io');

drop policy if exists "Loyoly team creates programs" on public.vip_programs;
create policy "Loyoly team creates programs" on public.vip_programs
  for insert to authenticated
  with check ((select auth.jwt() ->> 'email') ilike '%@loyoly.io');

drop policy if exists "Loyoly team updates programs" on public.vip_programs;
create policy "Loyoly team updates programs" on public.vip_programs
  for update to authenticated
  using ((select auth.jwt() ->> 'email') ilike '%@loyoly.io')
  with check ((select auth.jwt() ->> 'email') ilike '%@loyoly.io');

drop policy if exists "Loyoly team deletes programs" on public.vip_programs;
create policy "Loyoly team deletes programs" on public.vip_programs
  for delete to authenticated
  using ((select auth.jwt() ->> 'email') ilike '%@loyoly.io');
