-- ════════════════════════════════════════════════════════════════════
-- Client edits — the brand also edits its configuration
-- ════════════════════════════════════════════════════════════════════
-- Follows 20261109000000_client_edits_add_remove.sql. A "Configuration" page
-- joins the client portal: the brand sets its setup answers (CMS, CRM,
-- international, store), the points settings (earn rate, expiration) and
-- the tier settings (basis, reassessment) — never the AOV nor the margin.
-- New ops 'config' and 'settings' (see src/utils/programOps.js).

-- ── The new page: comments, approvals and activity ──────────────────
alter table public.program_comments drop constraint if exists program_comments_page_check;
alter table public.program_comments add constraint program_comments_page_check
  check (page in ('config', 'missions', 'rewards', 'referral', 'tiers'));
alter table public.program_validations drop constraint if exists program_validations_page_check;
alter table public.program_validations add constraint program_validations_page_check
  check (page in ('config', 'missions', 'rewards', 'referral', 'tiers'));
alter table public.program_activity drop constraint if exists program_activity_page_check;
alter table public.program_activity add constraint program_activity_page_check
  check (page in ('config', 'missions', 'rewards', 'referral', 'tiers'));

-- ── Checks: an 'integer' field type ──────────────────────────────────
-- p_spec: { field: 'id' | 'text:min:max' | 'number:min:max' | 'integer:min:max' | 'boolean' | 'enum:a|b' | 'booleans' }
create or replace function public.program_op_item(p_value jsonb, p_spec jsonb, p_required text[])
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_item jsonb;
  v_spec text[];
  v_length integer;
begin
  if jsonb_typeof(p_value) is distinct from 'object' then
    raise exception 'invalid_op' using errcode = 'P0001';
  end if;
  for v_key in select jsonb_object_keys(p_value) loop
    if not p_spec ? v_key then
      raise exception 'invalid_op' using errcode = 'P0001';
    end if;
  end loop;
  foreach v_key in array p_required loop
    if not p_value ? v_key then
      raise exception 'invalid_op' using errcode = 'P0001';
    end if;
  end loop;
  for v_key, v_item in select * from jsonb_each(p_value) loop
    v_spec := string_to_array(p_spec ->> v_key, ':');
    if v_spec[1] = 'id' then
      if jsonb_typeof(v_item) is distinct from 'string' or (v_item #>> '{}') !~ '^[A-Za-z0-9_-]{1,64}$' then
        raise exception 'invalid_value' using errcode = 'P0001';
      end if;
    elsif v_spec[1] = 'text' then
      if jsonb_typeof(v_item) is distinct from 'string' then
        raise exception 'invalid_value' using errcode = 'P0001';
      end if;
      v_length := char_length(v_item #>> '{}');
      if v_length < v_spec[2]::integer or v_length > v_spec[3]::integer then
        raise exception 'invalid_value' using errcode = 'P0001';
      end if;
    elsif v_spec[1] = 'number' then
      perform public.program_op_number(v_item, v_spec[2]::numeric, v_spec[3]::numeric);
    elsif v_spec[1] = 'integer' then
      perform public.program_op_number(v_item, v_spec[2]::numeric, v_spec[3]::numeric);
      if (v_item #>> '{}')::numeric <> floor((v_item #>> '{}')::numeric) then
        raise exception 'invalid_value' using errcode = 'P0001';
      end if;
    elsif v_spec[1] = 'boolean' then
      perform public.program_op_boolean(v_item);
    elsif v_spec[1] = 'enum' then
      if jsonb_typeof(v_item) is distinct from 'string' or not ((v_item #>> '{}') = any (string_to_array(v_spec[2], '|'))) then
        raise exception 'invalid_value' using errcode = 'P0001';
      end if;
    elsif v_spec[1] = 'booleans' then
      if jsonb_typeof(v_item) is distinct from 'array' or jsonb_array_length(v_item) > 50
        or exists (select 1 from jsonb_array_elements(v_item) as e(x) where jsonb_typeof(e.x) is distinct from 'boolean') then
        raise exception 'invalid_value' using errcode = 'P0001';
      end if;
    end if;
  end loop;
  return p_value;
end;
$$;

-- ── Ops (mirror of src/utils/programOps.js) ─────────────────────────
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
  v_count integer;
  v_assigned jsonb;
  v_key text;
  v_item jsonb;
  -- Configuration the brand edits (CONFIG_FIELDS in src/utils/programOps.js)
  v_config jsonb := '{"cms":"enum:shopify|shopify_plus|prestashop","crm":"enum:klaviyo|brevo|omnisend|braze|splio|hubspot|insider|connectif|activecampaign|none|other","international":"boolean","multiLanguage":"boolean","multiCurrency":"boolean","physicalStore":"boolean","posSystem":"enum:shopify_pos|cegid|other","pointsExpire":"boolean","expirationMonths":"integer:1:120","expirationType":"enum:rolling|fixed","tiersExpire":"boolean","tierExpirationMonths":"integer:1:120","tierExpirationType":"enum:rolling|fixed","tierBasis":"enum:spend|orders|points"}'::jsonb;
begin
  if v_kind = 'mission' then
    if v_field = 'add' then
      v_list := p_op ->> 'list';
      if v_list is null or v_list not in ('missions', 'customMissions') then
        raise exception 'invalid_op' using errcode = 'P0001';
      end if;
      v_item := public.program_op_item(v_value,
        '{"id":"id","icon":"text:0:16","nameFr":"text:1:120","nameEn":"text:0:120","category":"text:0:40","basePoints":"number:0:1000000","enabled":"boolean","isPurchaseMission":"boolean"}'::jsonb,
        array['id', 'nameFr', 'basePoints', 'enabled']);
      if public.program_op_index(p_doc -> 'missions', v_item ->> 'id') is not null
        or public.program_op_index(p_doc -> 'customMissions', v_item ->> 'id') is not null then
        raise exception 'duplicate_item' using errcode = 'P0001';
      end if;
      return jsonb_set(p_doc, array[v_list], coalesce(p_doc -> v_list, '[]'::jsonb) || jsonb_build_array(v_item));
    end if;
    foreach v_list in array array['missions', 'customMissions'] loop
      v_idx := public.program_op_index(p_doc -> v_list, p_op ->> 'id');
      exit when v_idx is not null;
    end loop;
    if v_idx is null then
      raise exception 'unknown_item' using errcode = 'P0001';
    end if;
    if v_field = 'remove' then
      return jsonb_set(p_doc, array[v_list], (p_doc -> v_list) - v_idx);
    elsif v_field = 'enabled' then
      perform public.program_op_boolean(v_value);
    elsif v_field = 'basePoints' then
      perform public.program_op_number(v_value, 0, 1000000);
    else
      raise exception 'invalid_op' using errcode = 'P0001';
    end if;
    return jsonb_set(p_doc, array[v_list, v_idx::text, v_field], v_value);

  elsif v_kind = 'reward' and v_field = 'add' then
    v_item := public.program_op_item(v_value,
      '{"id":"id","type":"enum:free_delivery|promo_percent|gift_voucher|free_product|experience|early_access|birthday|custom","nameFr":"text:1:120","nameEn":"text:0:120","rewardUsage":"enum:burn|perk","pointsBase":"number:0:1000000","expirationDays":"number:0:3650","minPurchase":"number:0:1000000","minPurchaseAuto":"boolean","assignedTiers":"booleans"}'::jsonb,
      array['id', 'type', 'nameFr', 'rewardUsage', 'pointsBase', 'assignedTiers']);
    if public.program_op_index(p_doc -> 'rewards', v_item ->> 'id') is not null then
      raise exception 'duplicate_item' using errcode = 'P0001';
    end if;
    v_item := jsonb_set(v_item, '{assignedTiers}',
      public.program_op_sized(v_item -> 'assignedTiers', jsonb_array_length(coalesce(p_doc -> 'tiers', '[]'::jsonb))));
    return jsonb_set(p_doc, '{rewards}', coalesce(p_doc -> 'rewards', '[]'::jsonb) || jsonb_build_array(v_item));

  elsif v_kind = 'reward' and v_field = 'remove' then
    v_idx := public.program_op_index(p_doc -> 'rewards', p_op ->> 'id');
    if v_idx is null then
      raise exception 'unknown_item' using errcode = 'P0001';
    end if;
    return jsonb_set(p_doc, '{rewards}', (p_doc -> 'rewards') - v_idx);

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
    v_count := jsonb_array_length(coalesce(p_doc -> 'tiers', '[]'::jsonb));
    if v_field = 'add' then
      -- Added last: index is the tier count the brand saw.
      if jsonb_typeof(p_op -> 'index') is distinct from 'number' or (p_op ->> 'index')::numeric <> v_count then
        raise exception 'conflict' using errcode = 'P0001';
      end if;
      if v_count >= 8 then
        raise exception 'invalid_op' using errcode = 'P0001';
      end if;
      v_item := public.program_op_item(v_value,
        '{"name":"text:1:60","color":"text:0:20","spendThreshold":"number:0:1000000000","orderThreshold":"number:0:1000000000","pointsMultiplier":"number:1:10"}'::jsonb,
        array['name']);
      -- The new top tier keeps what the tier below gives.
      return jsonb_set(
        jsonb_set(p_doc, '{tiers}', coalesce(p_doc -> 'tiers', '[]'::jsonb) || jsonb_build_array(v_item)),
        '{rewards}',
        coalesce((
          select jsonb_agg(jsonb_set(r.x, '{assignedTiers}',
            public.program_op_sized(r.x -> 'assignedTiers', v_count) || jsonb_build_array(
              case when v_count > 0 then public.program_op_sized(r.x -> 'assignedTiers', v_count) -> (v_count - 1) else 'true'::jsonb end))
            order by r.o)
          from jsonb_array_elements(coalesce(p_doc -> 'rewards', '[]'::jsonb)) with ordinality as r(x, o)
        ), '[]'::jsonb));
    end if;
    if jsonb_typeof(p_op -> 'index') is distinct from 'number'
      or (p_op ->> 'index')::numeric <> floor((p_op ->> 'index')::numeric)
      or (p_op ->> 'index')::numeric < 0
      or (p_op ->> 'index')::numeric >= v_count then
      raise exception 'unknown_item' using errcode = 'P0001';
    end if;
    v_tier := (p_op ->> 'index')::integer;
    if v_field = 'remove' then
      if (p_doc #>> array['tiers', v_tier::text, 'name']) is distinct from (p_op ->> 'name') then
        raise exception 'unknown_item' using errcode = 'P0001';
      end if;
      if v_count <= 2 then
        raise exception 'invalid_op' using errcode = 'P0001';
      end if;
      return jsonb_set(
        jsonb_set(p_doc, '{tiers}', (p_doc -> 'tiers') - v_tier),
        '{rewards}',
        coalesce((
          select jsonb_agg(
            case when jsonb_typeof(r.x -> 'assignedTiers') = 'array' and jsonb_array_length(r.x -> 'assignedTiers') > v_tier
              then jsonb_set(r.x, '{assignedTiers}', (r.x -> 'assignedTiers') - v_tier)
              else r.x end
            order by r.o)
          from jsonb_array_elements(coalesce(p_doc -> 'rewards', '[]'::jsonb)) with ordinality as r(x, o)
        ), '[]'::jsonb));
    end if;
    if v_field in ('spendThreshold', 'orderThreshold') then
      perform public.program_op_number(v_value, 0, 1000000000);
    elsif v_field = 'pointsMultiplier' then
      perform public.program_op_number(v_value, 1, 10);
    else
      raise exception 'invalid_op' using errcode = 'P0001';
    end if;
    return jsonb_set(p_doc, array['tiers', v_tier::text, v_field], v_value);

  elsif v_kind = 'config' then
    if v_field is null or not v_config ? v_field then
      raise exception 'invalid_op' using errcode = 'P0001';
    end if;
    perform public.program_op_item(jsonb_build_object(v_field, coalesce(v_value, 'null'::jsonb)), v_config, array[v_field]);
    -- Points tiers need a points program.
    if v_field = 'tierBasis' and v_value = '"points"'::jsonb and (p_doc #> '{config,hasMissions}') is distinct from 'true'::jsonb then
      raise exception 'invalid_value' using errcode = 'P0001';
    end if;
    return jsonb_set(p_doc, '{config}', coalesce(p_doc -> 'config', '{}'::jsonb) || jsonb_build_object(v_field, v_value));

  elsif v_kind = 'settings' then
    if v_field is distinct from 'earnRate' then
      raise exception 'invalid_op' using errcode = 'P0001';
    end if;
    if v_value is null or jsonb_typeof(v_value) = 'null' then
      return jsonb_set(p_doc, '{settings}', coalesce(p_doc -> 'settings', '{}'::jsonb) || '{"earnRateManual": false}'::jsonb);
    end if;
    if jsonb_typeof(v_value) is distinct from 'number' or (v_value #>> '{}')::numeric not in (1, 5, 10) then
      raise exception 'invalid_value' using errcode = 'P0001';
    end if;
    return jsonb_set(p_doc, '{settings}', coalesce(p_doc -> 'settings', '{}'::jsonb)
      || jsonb_build_object('earnRate', v_value, 'earnRateManual', true));

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

revoke all on function public.program_op_item(jsonb, jsonb, text[]) from public, anon, authenticated;
revoke all on function public.apply_program_op(jsonb, jsonb) from public, anon, authenticated;
