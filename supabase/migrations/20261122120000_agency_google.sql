-- ════════════════════════════════════════════════════════════════════
-- Agencies: sign-up with Google
-- ════════════════════════════════════════════════════════════════════
-- An agency can now sign up with Google as well as email + password. A
-- Google account carries no agency name in its metadata: agency_me() takes
-- it as a parameter (the sign-up form, or a "complete your account" form)
-- and refuses to create an agency without one (agency_name_required),
-- instead of naming it after the email domain (gmail.com…).

drop function if exists public.agency_me();

create or replace function public.agency_me(p_name text default null, p_website text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user auth.users; v_agency public.agencies; v_member public.agency_members; v_name text;
begin
  select * into v_user from auth.users where id = auth.uid();
  if v_user.id is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  select * into v_member from public.agency_members where user_id = v_user.id;
  if v_member.user_id is null then
    if v_user.email_confirmed_at is null then raise exception 'email_not_confirmed' using errcode = 'P0001'; end if;
    if public.is_team_user(v_user) then raise exception 'team_account' using errcode = 'P0001'; end if;
    if exists (select 1 from public.brand_accounts b where b.user_id = v_user.id) then raise exception 'brand_account' using errcode = 'P0001'; end if;
    v_name := coalesce(nullif(btrim(v_user.raw_user_meta_data ->> 'agency_name'), ''), nullif(btrim(p_name), ''));
    if v_name is null then raise exception 'agency_name_required' using errcode = 'P0001'; end if;
    insert into public.agencies (name, website)
    values (left(v_name, 80),
            left(coalesce(nullif(btrim(v_user.raw_user_meta_data ->> 'agency_website'), ''), nullif(btrim(p_website), '')), 200))
    returning * into v_agency;
    insert into public.agency_members (user_id, agency_id, email) values (v_user.id, v_agency.id, v_user.email) returning * into v_member;
  else
    select * into v_agency from public.agencies where id = v_member.agency_id;
  end if;
  return jsonb_build_object('agency_id', v_agency.id, 'name', v_agency.name, 'website', v_agency.website, 'status', v_agency.status,
    'role', v_member.role, 'analyses_left', greatest(0, 30 - v_agency.analyses));
end; $$;
revoke all on function public.agency_me(text, text) from public, anon;
grant execute on function public.agency_me(text, text) to authenticated;
