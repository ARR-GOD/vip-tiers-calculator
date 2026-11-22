-- ════════════════════════════════════════════════════════════════════
-- Self-serve brands — an account, a ready-to-use onboarding kit
-- ════════════════════════════════════════════════════════════════════
-- A brand Loyoly does not accompany signs up at /kit with its email, brand
-- name and a password (Supabase Auth, email confirmed). Its kit is a client
-- folder of its own ('self:<user id>') holding one program, published and
-- shared at once, and an access code: the brand then uses the client portal
-- like the accompanied brands, and the Loyoly team sees the folder in its
-- client space. Brands never read the tables: they go through brand_*.

create table if not exists public.brand_accounts (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  brand_name  text not null check (char_length(btrim(brand_name)) between 1 and 80),
  folder_key  text not null unique,
  analyses    integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.brand_accounts enable row level security;
revoke all on public.brand_accounts from anon;
grant select on public.brand_accounts to authenticated;

drop policy if exists "Loyoly team reads brand accounts" on public.brand_accounts;
create policy "Loyoly team reads brand accounts" on public.brand_accounts
  for select to authenticated
  using ((select auth.jwt() ->> 'email') ilike '%@loyoly.io');

-- The signed-in brand's account, created on its first visit from what it
-- gave at sign-up (brand_name in the user metadata).
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

-- What the /kit page needs: the brand, its access code once the kit exists.
create or replace function public.brand_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me public.brand_accounts := public.brand_me();
begin
  return jsonb_build_object(
    'brand_name', v_me.brand_name,
    'email', v_me.email,
    'code', (select a.code from public.client_access a where a.folder_key = v_me.folder_key and a.revoked_at is null),
    'has_kit', exists (select 1 from public.vip_programs p where p.folder_key = v_me.folder_key),
    'analyses_left', greatest(0, 5 - v_me.analyses));
end;
$$;

-- One analysis of the brand's site (AI): five per account. Called by
-- /api/analyze-brand with the brand's session.
create or replace function public.brand_consume_analysis()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me public.brand_accounts := public.brand_me();
begin
  update public.brand_accounts set analyses = analyses + 1
  where user_id = v_me.user_id and analyses < 5;
  return found;
end;
$$;

-- The kit: the brand's program (built in the app from the analysis of its
-- site), published and shared, and its access code (returned).
create or replace function public.brand_create_kit(p_domain text, p_state jsonb, p_view jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me public.brand_accounts := public.brand_me();
  v_code text;
  v_attempt integer;
begin
  if exists (select 1 from public.vip_programs where folder_key = v_me.folder_key) then
    raise exception 'kit_exists' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_state) is distinct from 'object' or jsonb_typeof(p_view -> 'program') is distinct from 'object'
    or pg_column_size(p_state) > 500000 or pg_column_size(p_view) > 500000 then
    raise exception 'invalid_value' using errcode = 'P0001';
  end if;

  insert into public.vip_programs
    (folder_key, client_name, client_domain, program_name, step, state,
     published_view, published_version, published_at, shared_with_client, created_by, updated_by)
  values
    (v_me.folder_key, v_me.brand_name, nullif(left(btrim(coalesce(p_domain, '')), 200), ''), 'Programme principal', 1, p_state,
     p_view, 1, now(), true, v_me.email, v_me.email);

  -- A code still active for the folder (its program was deleted since) stays.
  select a.code into v_code from public.client_access a where a.folder_key = v_me.folder_key and a.revoked_at is null;
  if v_code is not null then
    return v_code;
  end if;
  for v_attempt in 1..5 loop
    select string_agg(substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', get_byte(r.bytes, g.i) % 32 + 1, 1), '' order by g.i)
    into v_code
    from (select extensions.gen_random_bytes(12) as bytes) r, generate_series(0, 11) as g(i);
    begin
      insert into public.client_access (folder_key, code, created_by) values (v_me.folder_key, v_code, v_me.email);
      return v_code;
    exception when unique_violation then
      null; -- that code exists already: draw another one
    end;
  end loop;
  raise exception 'no_code' using errcode = 'P0001';
end;
$$;

revoke all on function public.brand_me() from public, anon, authenticated;
revoke all on function public.brand_account() from public, anon;
revoke all on function public.brand_consume_analysis() from public, anon;
revoke all on function public.brand_create_kit(text, jsonb, jsonb) from public, anon;
grant execute on function public.brand_account() to authenticated;
grant execute on function public.brand_consume_analysis() to authenticated;
grant execute on function public.brand_create_kit(text, jsonb, jsonb) to authenticated;
