-- ════════════════════════════════════════════════════════════════════
-- Client edits — the brand edits its program from the client portal
-- ════════════════════════════════════════════════════════════════════
-- A brand edits the published program directly (missions, points rewards,
-- referral, VIP tiers). Each edit is an "op" (see src/utils/programOps.js,
-- which applies the very same ops in the app) applied to the saved program
-- and to its published view, and logged in program_activity for the CSM.

-- ── Activity feed ────────────────────────────────────────────────────
create table if not exists public.program_activity (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references public.vip_programs (id) on delete cascade,
  actor_type   text not null check (actor_type in ('client')),
  actor_name   text not null check (char_length(trim(actor_name)) between 1 and 80),
  page         text not null check (page in ('missions', 'rewards', 'referral', 'tiers')),
  item_label   text,
  field_label  text,
  old_value    text,
  new_value    text,
  op           jsonb not null,
  created_at   timestamptz not null default now()
);

create index if not exists program_activity_program_idx on public.program_activity (program_id, created_at);

alter table public.program_activity enable row level security;
revoke all on public.program_activity from anon;
grant select on public.program_activity to authenticated;

drop policy if exists "Loyoly team reads activity" on public.program_activity;
create policy "Loyoly team reads activity" on public.program_activity
  for select to authenticated
  using ((select auth.jwt() ->> 'email') ilike '%@loyoly.io');

-- ── Ops (mirror of src/utils/programOps.js) ─────────────────────────
create or replace function public.program_op_number(p_value jsonb, p_min numeric, p_max numeric)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_value) is distinct from 'number' or (p_value #>> '{}')::numeric not between p_min and p_max then
    raise exception 'invalid_value' using errcode = 'P0001';
  end if;
  return p_value;
end;
$$;

create or replace function public.program_op_boolean(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_value) is distinct from 'boolean' then
    raise exception 'invalid_value' using errcode = 'P0001';
  end if;
  return p_value;
end;
$$;

-- Position of the element with this id in a jsonb array, or null.
create or replace function public.program_op_index(p_list jsonb, p_id text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (o.i - 1)::integer
  from jsonb_array_elements(coalesce(p_list, '[]'::jsonb)) with ordinality as o(e, i)
  where o.e ->> 'id' = p_id
  limit 1;
$$;

create or replace function public.apply_program_op(p_doc jsonb, p_op jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_kind text := p_op ->> 'kind';
  v_field text := p_op ->> 'field';
  v_value jsonb := p_op -> 'value';
  v_list text;
  v_idx integer;
  v_tier integer;
  v_assigned jsonb;
  v_key text;
  v_item jsonb;
begin
  if v_kind = 'mission' then
    if v_field = 'enabled' then
      perform public.program_op_boolean(v_value);
    elsif v_field = 'basePoints' then
      perform public.program_op_number(v_value, 0, 1000000);
    else
      raise exception 'invalid_op' using errcode = 'P0001';
    end if;
    foreach v_list in array array['missions', 'customMissions'] loop
      v_idx := public.program_op_index(p_doc -> v_list, p_op ->> 'id');
      if v_idx is not null then
        return jsonb_set(p_doc, array[v_list, v_idx::text, v_field], v_value);
      end if;
    end loop;
    raise exception 'unknown_item' using errcode = 'P0001';

  elsif v_kind in ('reward', 'perk') then
    v_idx := public.program_op_index(p_doc -> 'rewards', p_op ->> 'id');
    if v_idx is null then
      raise exception 'unknown_item' using errcode = 'P0001';
    end if;
    if v_kind = 'perk' then
      if v_field is distinct from 'assigned'
        or jsonb_typeof(p_op -> 'index') is distinct from 'number'
        or (p_op ->> 'index')::numeric <> floor((p_op ->> 'index')::numeric)
        or (p_op ->> 'index')::numeric < 0 then
        raise exception 'invalid_op' using errcode = 'P0001';
      end if;
      v_tier := (p_op ->> 'index')::integer;
      if v_tier >= jsonb_array_length(coalesce(p_doc -> 'tiers', '[]'::jsonb)) then
        raise exception 'unknown_item' using errcode = 'P0001';
      end if;
      perform public.program_op_boolean(v_value);
      v_assigned := coalesce(p_doc #> array['rewards', v_idx::text, 'assignedTiers'], '[]'::jsonb);
      while jsonb_array_length(v_assigned) <= v_tier loop
        v_assigned := v_assigned || 'false'::jsonb;
      end loop;
      return jsonb_set(p_doc, array['rewards', v_idx::text, 'assignedTiers'], jsonb_set(v_assigned, array[v_tier::text], v_value));
    end if;
    if v_field = 'pointsBase' then
      perform public.program_op_number(v_value, 0, 1000000);
    elsif v_field = 'expirationDays' then
      perform public.program_op_number(v_value, 0, 3650);
    elsif v_field = 'minPurchase' then
      perform public.program_op_number(v_value, 0, 1000000);
      p_doc := jsonb_set(p_doc, array['rewards', v_idx::text, 'minPurchaseAuto'], 'false'::jsonb);
    else
      raise exception 'invalid_op' using errcode = 'P0001';
    end if;
    return jsonb_set(p_doc, array['rewards', v_idx::text, v_field], v_value);

  elsif v_kind = 'tier' then
    if jsonb_typeof(p_op -> 'index') is distinct from 'number'
      or (p_op ->> 'index')::numeric <> floor((p_op ->> 'index')::numeric)
      or (p_op ->> 'index')::numeric < 0
      or (p_op ->> 'index')::numeric >= jsonb_array_length(coalesce(p_doc -> 'tiers', '[]'::jsonb)) then
      raise exception 'unknown_item' using errcode = 'P0001';
    end if;
    if v_field in ('spendThreshold', 'orderThreshold') then
      perform public.program_op_number(v_value, 0, 1000000000);
    elsif v_field = 'pointsMultiplier' then
      perform public.program_op_number(v_value, 1, 10);
    else
      raise exception 'invalid_op' using errcode = 'P0001';
    end if;
    return jsonb_set(p_doc, array['tiers', p_op ->> 'index', v_field], v_value);

  elsif v_kind = 'referral' then
    if v_field is distinct from 'patch' or jsonb_typeof(v_value) is distinct from 'object' then
      raise exception 'invalid_op' using errcode = 'P0001';
    end if;
    for v_key, v_item in select * from jsonb_each(v_value) loop
      if v_key in ('rewardsAuto', 'expirationsAuto', 'referrerMinPurchaseAuto', 'refereeMinPurchaseAuto') then
        perform public.program_op_boolean(v_item);
      elsif v_key in ('referrerType', 'refereeType') then
        if v_item is distinct from '"percent"'::jsonb and v_item is distinct from '"fixed"'::jsonb then
          raise exception 'invalid_value' using errcode = 'P0001';
        end if;
      elsif v_key in ('referrerValue', 'refereeValue') then
        perform public.program_op_number(v_item, 0, 1000);
      elsif v_key in ('referrerExpirationDays', 'refereeExpirationDays') then
        perform public.program_op_number(v_item, 0, 3650);
      elsif v_key in ('referrerMinPurchase', 'refereeMinPurchase') then
        perform public.program_op_number(v_item, 0, 1000000);
      else
        raise exception 'invalid_op' using errcode = 'P0001';
      end if;
    end loop;
    return jsonb_set(p_doc, '{referralConfig}', coalesce(p_doc -> 'referralConfig', '{}'::jsonb) || v_value);
  end if;

  raise exception 'invalid_op' using errcode = 'P0001';
end;
$$;

-- ── Client entry point ───────────────────────────────────────────────
-- The published view is always edited (it is what the brand sees); the saved
-- program too, unless the CSM removed the item since: the CSM's open wizard
-- replays the activity feed anyway.
create or replace function public.client_edit(
  p_code text, p_author_name text, p_program_id uuid, p_page text, p_op jsonb,
  p_item_label text, p_field_label text, p_old_value text, p_new_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program public.vip_programs := public.client_shared_program(p_code, p_program_id);
  v_state jsonb;
begin
  if v_program.published_view -> 'program' is null then
    raise exception 'read_only_view' using errcode = 'P0001';
  end if;
  begin
    v_state := public.apply_program_op(v_program.state, p_op);
  exception when others then
    v_state := v_program.state;
  end;
  update public.vip_programs
  set state = v_state,
      published_view = jsonb_set(published_view, '{program}', public.apply_program_op(published_view -> 'program', p_op))
  where id = v_program.id;

  insert into public.program_activity
    (program_id, actor_type, actor_name, page, item_label, field_label, old_value, new_value, op)
  values
    (v_program.id, 'client', trim(p_author_name), p_page,
     left(p_item_label, 120), left(p_field_label, 80), left(p_old_value, 120), left(p_new_value, 120), p_op);
end;
$$;

revoke all on function public.program_op_number(jsonb, numeric, numeric) from public, anon, authenticated;
revoke all on function public.program_op_boolean(jsonb) from public, anon, authenticated;
revoke all on function public.program_op_index(jsonb, text) from public, anon, authenticated;
revoke all on function public.apply_program_op(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.client_edit(text, text, uuid, text, jsonb, text, text, text, text) from public;
grant execute on function public.client_edit(text, text, uuid, text, jsonb, text, text, text, text) to anon, authenticated;
