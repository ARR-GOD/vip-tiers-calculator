-- ════════════════════════════════════════════════════════════════════
-- Agencies — partner agencies build programs for their clients/prospects
-- ════════════════════════════════════════════════════════════════════
-- Follows 20261112000000_brand_accounts.sql. An agency signs up at /agence
-- (email + password, Supabase Auth, email confirmed) and waits for the Loyoly
-- team to approve it. Once approved, its members use the setup tool without
-- HubSpot: folders, several programs per folder, the wizard, the dashboard,
-- the setup sheet and the checklist. They only ever see their agency's
-- programs; the Loyoly team sees everything.
--
-- The role comes from these tables, never from the user metadata (which the
-- user can change): the metadata only seeds the agency on its first visit.

-- ── Tables ───────────────────────────────────────────────────────────
create table if not exists public.agencies (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  website      text check (website is null or char_length(website) <= 200),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  analyses     integer not null default 0,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  text
);

-- One agency per account; an agency can have several members (invitations
-- come later: the first member is its owner).
create table if not exists public.agency_members (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  agency_id   uuid not null references public.agencies (id) on delete cascade,
  email       text not null,
  role        text not null default 'owner' check (role in ('owner', 'member')),
  created_at  timestamptz not null default now()
);
create index if not exists agency_members_agency_idx on public.agency_members (agency_id);

-- ── Helpers ──────────────────────────────────────────────────────────
create or replace function public.is_loyoly()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'email') ilike '%@loyoly.io', false);
$$;

-- The signed-in member's agency, when it is approved (null otherwise).
create or replace function public.my_agency_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.agency_id
  from public.agency_members m
  join public.agencies a on a.id = m.agency_id
  where m.user_id = auth.uid() and a.status = 'approved';
$$;

-- The agency a folder key belongs to: 'agency:<uuid>:<brand>'.
create or replace function public.agency_of_folder(p_folder_key text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when p_folder_key ~ '^agency:[0-9a-f-]{36}:'
    then substring(p_folder_key from 8 for 36)::uuid end;
$$;

-- ── Access to the agencies ───────────────────────────────────────────
alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
revoke all on public.agencies, public.agency_members from anon;
grant select, update on public.agencies to authenticated;
grant select on public.agency_members to authenticated;

drop policy if exists "Loyoly team reads agencies" on public.agencies;
create policy "Loyoly team reads agencies" on public.agencies
  for select to authenticated using (public.is_loyoly());
drop policy if exists "Loyoly team reviews agencies" on public.agencies;
create policy "Loyoly team reviews agencies" on public.agencies
  for update to authenticated using (public.is_loyoly()) with check (public.is_loyoly());
drop policy if exists "Members read their agency" on public.agencies;
create policy "Members read their agency" on public.agencies
  for select to authenticated
  using (id in (select m.agency_id from public.agency_members m where m.user_id = (select auth.uid())));

drop policy if exists "Loyoly team reads agency members" on public.agency_members;
create policy "Loyoly team reads agency members" on public.agency_members
  for select to authenticated using (public.is_loyoly());
drop policy if exists "Members read themselves" on public.agency_members;
create policy "Members read themselves" on public.agency_members
  for select to authenticated using (user_id = (select auth.uid()));

-- A review is stamped by whoever makes it; the rest of the row stays.
create or replace function public.agencies_review_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  new.analyses := old.analyses;
  if new.status is distinct from old.status then
    new.reviewed_at := now();
    new.reviewed_by := auth.jwt() ->> 'email';
  else
    new.reviewed_at := old.reviewed_at;
    new.reviewed_by := old.reviewed_by;
  end if;
  return new;
end;
$$;

drop trigger if exists agencies_review_stamp on public.agencies;
create trigger agencies_review_stamp
  before update on public.agencies
  for each row execute function public.agencies_review_stamp();

-- ── The signed-in agency member ──────────────────────────────────────
-- Its agency, created (pending) on its first visit from what it gave at
-- sign-up (agency_name, agency_website in the user metadata).
create or replace function public.agency_me()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user auth.users;
  v_agency public.agencies;
  v_member public.agency_members;
begin
  select * into v_user from auth.users where id = auth.uid();
  if v_user.id is null then
    raise exception 'not_signed_in' using errcode = 'P0001';
  end if;
  select * into v_member from public.agency_members where user_id = v_user.id;
  if v_member.user_id is null then
    if v_user.email_confirmed_at is null then
      raise exception 'email_not_confirmed' using errcode = 'P0001';
    end if;
    if v_user.email ilike '%@loyoly.io' then
      raise exception 'team_account' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.brand_accounts b where b.user_id = v_user.id) then
      raise exception 'brand_account' using errcode = 'P0001';
    end if;
    insert into public.agencies (name, website)
    values (
      left(coalesce(nullif(btrim(v_user.raw_user_meta_data ->> 'agency_name'), ''), split_part(v_user.email, '@', 2)), 80),
      left(nullif(btrim(v_user.raw_user_meta_data ->> 'agency_website'), ''), 200))
    returning * into v_agency;
    insert into public.agency_members (user_id, agency_id, email)
    values (v_user.id, v_agency.id, v_user.email)
    returning * into v_member;
  else
    select * into v_agency from public.agencies where id = v_member.agency_id;
  end if;
  return jsonb_build_object(
    'agency_id', v_agency.id,
    'name', v_agency.name,
    'website', v_agency.website,
    'status', v_agency.status,
    'role', v_member.role,
    'analyses_left', greatest(0, 30 - v_agency.analyses));
end;
$$;

-- One analysis of a prospect's site (AI) for an agency: thirty per agency.
-- Called by /api/analyze-brand. null when the caller is no agency member.
create or replace function public.agency_consume_analysis()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agency public.agencies;
begin
  select a.* into v_agency
  from public.agency_members m join public.agencies a on a.id = m.agency_id
  where m.user_id = auth.uid();
  if v_agency.id is null then
    return null;
  end if;
  if v_agency.status <> 'approved' then
    return 'not_approved';
  end if;
  update public.agencies set analyses = analyses + 1 where id = v_agency.id and analyses < 30;
  return case when found then 'ok' else 'quota' end;
end;
$$;

revoke all on function public.agency_me() from public, anon;
revoke all on function public.agency_consume_analysis() from public, anon;
revoke all on function public.my_agency_id() from public, anon;
grant execute on function public.agency_me() to authenticated;
grant execute on function public.agency_consume_analysis() to authenticated;
grant execute on function public.my_agency_id() to authenticated;

-- An agency member never gets a self-serve brand account (/kit).
create or replace function public.brand_me()
returns public.brand_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.brand_accounts;
  v_user auth.users;
begin
  select * into v_row from public.brand_accounts where user_id = auth.uid();
  if v_row.user_id is not null then
    return v_row;
  end if;
  select * into v_user from auth.users where id = auth.uid();
  if v_user.id is null then
    raise exception 'not_signed_in' using errcode = 'P0001';
  end if;
  if v_user.email_confirmed_at is null then
    raise exception 'email_not_confirmed' using errcode = 'P0001';
  end if;
  if v_user.email ilike '%@loyoly.io' then
    raise exception 'team_account' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.agency_members m where m.user_id = v_user.id)
     or v_user.raw_user_meta_data ->> 'account_type' = 'agency' then
    raise exception 'agency_account' using errcode = 'P0001';
  end if;
  insert into public.brand_accounts (user_id, email, brand_name, folder_key)
  values (
    v_user.id, v_user.email,
    left(coalesce(nullif(btrim(v_user.raw_user_meta_data ->> 'brand_name'), ''), split_part(v_user.email, '@', 1)), 80),
    'self:' || v_user.id)
  on conflict (user_id) do nothing;
  select * into v_row from public.brand_accounts where user_id = v_user.id;
  return v_row;
end;
$$;

-- ── Programs ─────────────────────────────────────────────────────────
alter table public.vip_programs
  add column if not exists agency_id uuid references public.agencies (id) on delete cascade;
create index if not exists vip_programs_agency_idx on public.vip_programs (agency_id);

-- The agency of a program follows its folder ('agency:<uuid>:…'). An agency
-- only writes in its own folders, never links a HubSpot company and never
-- publishes to the client portal.
create or replace function public.vip_programs_agency()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_mine uuid;
begin
  if public.is_loyoly() then
    if tg_op = 'UPDATE' then
      new.agency_id := old.agency_id;
      if old.agency_id is not null then
        new.folder_key := old.folder_key;
      end if;
    else
      new.agency_id := public.agency_of_folder(new.folder_key);
    end if;
    return new;
  end if;

  v_mine := public.my_agency_id();
  if v_mine is null then
    -- Not an agency member: the other policies decide (and refuse).
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.agency_id := old.agency_id;
    new.folder_key := old.folder_key;
    new.hubspot_company_id := old.hubspot_company_id;
    new.shared_with_client := old.shared_with_client;
    new.published_view := old.published_view;
    new.published_version := old.published_version;
    new.published_at := old.published_at;
    new.published_by := old.published_by;
  else
    if public.agency_of_folder(new.folder_key) is distinct from v_mine then
      raise exception 'agency_folder' using errcode = 'P0001';
    end if;
    new.agency_id := v_mine;
    new.hubspot_company_id := null;
    new.shared_with_client := false;
    new.published_view := null;
    new.published_version := 0;
    new.published_at := null;
    new.published_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists vip_programs_agency on public.vip_programs;
create trigger vip_programs_agency
  before insert or update on public.vip_programs
  for each row execute function public.vip_programs_agency();

drop policy if exists "Agencies read their programs" on public.vip_programs;
create policy "Agencies read their programs" on public.vip_programs
  for select to authenticated
  using (agency_id is not null and agency_id = (select public.my_agency_id()));
drop policy if exists "Agencies create their programs" on public.vip_programs;
create policy "Agencies create their programs" on public.vip_programs
  for insert to authenticated
  with check (agency_id is not null and agency_id = (select public.my_agency_id()));
drop policy if exists "Agencies update their programs" on public.vip_programs;
create policy "Agencies update their programs" on public.vip_programs
  for update to authenticated
  using (agency_id is not null and agency_id = (select public.my_agency_id()))
  with check (agency_id is not null and agency_id = (select public.my_agency_id()));
drop policy if exists "Agencies delete their programs" on public.vip_programs;
create policy "Agencies delete their programs" on public.vip_programs
  for delete to authenticated
  using (agency_id is not null and agency_id = (select public.my_agency_id()));

-- ── Launch checklist of the agency's programs ────────────────────────
drop policy if exists "Agencies manage their checklists" on public.program_checklist;
create policy "Agencies manage their checklists" on public.program_checklist
  for all to authenticated
  using (exists (select 1 from public.vip_programs p
                 where p.id = program_id and p.agency_id is not null and p.agency_id = (select public.my_agency_id())))
  with check (exists (select 1 from public.vip_programs p
                      where p.id = program_id and p.agency_id is not null and p.agency_id = (select public.my_agency_id())));

-- An agency member's changes are stamped like the team's (the operator side).
create or replace function public.program_checklist_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_claims jsonb := auth.jwt();
begin
  new.updated_at := now();
  if (v_claims ->> 'email') ilike '%@loyoly.io' or public.my_agency_id() is not null then
    new.updated_by_type := 'csm';
    new.updated_by_name := left(coalesce(nullif(v_claims -> 'user_metadata' ->> 'full_name', ''), v_claims ->> 'email'), 120);
  end if;
  if tg_op = 'UPDATE' then
    new.program_id := old.program_id;
    new.item_key := old.item_key;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
