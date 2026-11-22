-- ════════════════════════════════════════════════════════════════════
-- The Loyoly team = a @loyoly.io account signed in with Google
-- ════════════════════════════════════════════════════════════════════
-- Until now every @loyoly.io address was the team, whatever the sign-in.
-- A @loyoly.io address signed up with a password at /agency (or /kit) then
-- saw every program. The team is now a @loyoly.io account with a Google
-- identity (the /loyoly sign-in, restricted to the Workspace); any other
-- account is an agency or a brand like the others.
-- Same rule in the front (isTeamUser, src/lib/supabase.js) and the API
-- (api/_auth.js).

create or replace function public.is_loyoly()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(
    (select auth.jwt() ->> 'email') ilike '%@loyoly.io'
    and (
      (select auth.jwt() -> 'app_metadata' ->> 'provider') = 'google'
      or coalesce((select auth.jwt() -> 'app_metadata' -> 'providers') ? 'google', false)
    ), false);
$$;

-- The same test on an auth.users row (security definer functions).
create or replace function public.is_team_user(p_user auth.users)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(
    p_user.email ilike '%@loyoly.io'
    and (
      p_user.raw_app_meta_data ->> 'provider' = 'google'
      or coalesce((p_user.raw_app_meta_data -> 'providers') ? 'google', false)
    ), false);
$$;
revoke execute on function public.is_team_user(auth.users) from public, anon, authenticated;

-- ── Policies: the email test becomes is_loyoly() ──
alter policy "Loyoly team reads programs" on public.vip_programs using ((select public.is_loyoly()));
alter policy "Loyoly team creates programs" on public.vip_programs with check ((select public.is_loyoly()));
alter policy "Loyoly team updates programs" on public.vip_programs
  using ((select public.is_loyoly())) with check ((select public.is_loyoly()));
alter policy "Loyoly team deletes programs" on public.vip_programs using ((select public.is_loyoly()));

alter policy "Loyoly team manages client access" on public.client_access
  using ((select public.is_loyoly())) with check ((select public.is_loyoly()));

alter policy "Loyoly team reads comments" on public.program_comments using ((select public.is_loyoly()));
alter policy "Loyoly team comments as itself" on public.program_comments
  with check ((select public.is_loyoly()) and author_type = 'csm'
    and author_email = (select auth.jwt() ->> 'email') and author_key_hash is null);
alter policy "Loyoly team updates comments" on public.program_comments
  using ((select public.is_loyoly())) with check ((select public.is_loyoly()));
alter policy "Loyoly team deletes its own comments" on public.program_comments
  using ((select public.is_loyoly()) and author_type = 'csm' and author_email = (select auth.jwt() ->> 'email'));

alter policy "Loyoly team reads validations" on public.program_validations using ((select public.is_loyoly()));
alter policy "Loyoly team reads activity" on public.program_activity using ((select public.is_loyoly()));
alter policy "Loyoly team manages the checklist" on public.program_checklist
  using ((select public.is_loyoly())) with check ((select public.is_loyoly()));
alter policy "Loyoly team reads brand accounts" on public.brand_accounts using ((select public.is_loyoly()));

-- ── Functions ──
create or replace function public.program_checklist_stamp()
returns trigger language plpgsql set search_path = '' as $$
declare v_claims jsonb := auth.jwt();
begin
  new.updated_at := now();
  if public.is_loyoly() or public.my_agency_id() is not null then
    new.updated_by_type := 'csm';
    new.updated_by_name := left(coalesce(nullif(v_claims -> 'user_metadata' ->> 'full_name', ''), v_claims ->> 'email'), 120);
  end if;
  if tg_op = 'UPDATE' then new.program_id := old.program_id; new.item_key := old.item_key; new.created_at := old.created_at; end if;
  return new;
end; $$;

create or replace function public.brand_me()
returns public.brand_accounts language plpgsql security definer set search_path = '' as $$
declare v_row public.brand_accounts; v_user auth.users;
begin
  select * into v_row from public.brand_accounts where user_id = auth.uid();
  if v_row.user_id is not null then return v_row; end if;
  select * into v_user from auth.users where id = auth.uid();
  if v_user.id is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  if v_user.email_confirmed_at is null then raise exception 'email_not_confirmed' using errcode = 'P0001'; end if;
  if public.is_team_user(v_user) then raise exception 'team_account' using errcode = 'P0001'; end if;
  if exists (select 1 from public.agency_members m where m.user_id = v_user.id) or v_user.raw_user_meta_data ->> 'account_type' = 'agency' then
    raise exception 'agency_account' using errcode = 'P0001';
  end if;
  insert into public.brand_accounts (user_id, email, brand_name, folder_key)
  values (v_user.id, v_user.email, left(coalesce(nullif(btrim(v_user.raw_user_meta_data ->> 'brand_name'), ''), split_part(v_user.email, '@', 1)), 80), 'self:' || v_user.id)
  on conflict (user_id) do nothing;
  select * into v_row from public.brand_accounts where user_id = v_user.id;
  return v_row;
end; $$;

create or replace function public.agency_me()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user auth.users; v_agency public.agencies; v_member public.agency_members;
begin
  select * into v_user from auth.users where id = auth.uid();
  if v_user.id is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  select * into v_member from public.agency_members where user_id = v_user.id;
  if v_member.user_id is null then
    if v_user.email_confirmed_at is null then raise exception 'email_not_confirmed' using errcode = 'P0001'; end if;
    if public.is_team_user(v_user) then raise exception 'team_account' using errcode = 'P0001'; end if;
    if exists (select 1 from public.brand_accounts b where b.user_id = v_user.id) then raise exception 'brand_account' using errcode = 'P0001'; end if;
    insert into public.agencies (name, website)
    values (left(coalesce(nullif(btrim(v_user.raw_user_meta_data ->> 'agency_name'), ''), split_part(v_user.email, '@', 2)), 80),
            left(nullif(btrim(v_user.raw_user_meta_data ->> 'agency_website'), ''), 200))
    returning * into v_agency;
    insert into public.agency_members (user_id, agency_id, email) values (v_user.id, v_agency.id, v_user.email) returning * into v_member;
  else
    select * into v_agency from public.agencies where id = v_member.agency_id;
  end if;
  return jsonb_build_object('agency_id', v_agency.id, 'name', v_agency.name, 'website', v_agency.website, 'status', v_agency.status,
    'role', v_member.role, 'analyses_left', greatest(0, 30 - v_agency.analyses));
end; $$;
