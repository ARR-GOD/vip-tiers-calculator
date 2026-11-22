-- ════════════════════════════════════════════════════════════════════
-- Launch checklist — the setup follow-up shared by the CSM and the brand
-- ════════════════════════════════════════════════════════════════════
-- The steps come from the template in the app (src/data/checklistTemplate.js),
-- filtered by the program's setup. A row holds the progress of one step
-- (item_key = the step's key) or a task added by the CSM or the brand
-- (item_key = 'custom_<uuid>', with its label and phase). The Loyoly team
-- uses the table; the brand goes through the client_checklist_* functions.

create table if not exists public.program_checklist (
  id               uuid primary key default gen_random_uuid(),
  program_id       uuid not null references public.vip_programs (id) on delete cascade,
  item_key         text not null check (item_key ~ '^[a-z0-9_]{1,64}$' or item_key ~ '^custom_[0-9a-f-]{36}$'),
  label            text check (label is null or char_length(btrim(label)) between 1 and 200),
  phase            text check (phase is null or phase in ('pre_launch', 'launch', 'communication', 'post_launch')),
  status           text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'na')),
  owner            text check (owner is null or owner in ('loyoly', 'brand', 'both')),
  due_date         date,
  note             text check (note is null or char_length(note) <= 2000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by_type  text check (updated_by_type is null or updated_by_type in ('csm', 'client')),
  updated_by_name  text check (updated_by_name is null or char_length(updated_by_name) <= 120),
  unique (program_id, item_key),
  -- A custom task has its own label and phase; a template step has neither.
  constraint program_checklist_custom check ((item_key like 'custom\_%') = (label is not null and phase is not null))
);

-- Who changed a row last: a Loyoly team member is recognized from the
-- session; the client functions say 'client' themselves.
create or replace function public.program_checklist_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_claims jsonb := auth.jwt();
begin
  new.updated_at := now();
  if (v_claims ->> 'email') ilike '%@loyoly.io' then
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

drop trigger if exists program_checklist_stamp on public.program_checklist;
create trigger program_checklist_stamp
  before insert or update on public.program_checklist
  for each row execute function public.program_checklist_stamp();

alter table public.program_checklist enable row level security;
revoke all on public.program_checklist from anon;
grant select, insert, update, delete on public.program_checklist to authenticated;

drop policy if exists "Loyoly team manages the checklist" on public.program_checklist;
create policy "Loyoly team manages the checklist" on public.program_checklist
  for all to authenticated
  using ((select auth.jwt() ->> 'email') ilike '%@loyoly.io')
  with check ((select auth.jwt() ->> 'email') ilike '%@loyoly.io');

-- ── Client functions ─────────────────────────────────────────────────
create or replace function public.client_checklist_author(p_author_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if char_length(btrim(coalesce(p_author_name, ''))) not between 1 and 80 then
    raise exception 'invalid_author' using errcode = 'P0001';
  end if;
  return btrim(p_author_name);
end;
$$;

-- Sets some fields of one step or task: { status, owner, due_date, note }.
create or replace function public.client_checklist_set(
  p_code text, p_author_name text, p_program_id uuid, p_item_key text, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program public.vip_programs := public.client_shared_program(p_code, p_program_id);
  v_author text := public.client_checklist_author(p_author_name);
  v_key text;
  v_due date;
begin
  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'invalid_op' using errcode = 'P0001';
  end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key not in ('status', 'owner', 'due_date', 'note') then
      raise exception 'invalid_op' using errcode = 'P0001';
    end if;
  end loop;
  if p_patch ? 'status' and coalesce(p_patch ->> 'status', '') not in ('todo', 'in_progress', 'done', 'na') then
    raise exception 'invalid_value' using errcode = 'P0001';
  end if;
  if p_patch ? 'owner' and (p_patch ->> 'owner') is not null and (p_patch ->> 'owner') not in ('loyoly', 'brand', 'both') then
    raise exception 'invalid_value' using errcode = 'P0001';
  end if;
  if p_patch ? 'note' and jsonb_typeof(p_patch -> 'note') not in ('string', 'null') then
    raise exception 'invalid_value' using errcode = 'P0001';
  end if;
  if coalesce(p_patch ->> 'due_date', '') <> '' and (p_patch ->> 'due_date') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'invalid_value' using errcode = 'P0001';
  end if;
  begin
    v_due := nullif(p_patch ->> 'due_date', '')::date;
  exception when others then
    raise exception 'invalid_value' using errcode = 'P0001';
  end;

  if p_item_key like 'custom\_%' then
    -- An added task exists already (an insert would lack its label).
    update public.program_checklist c set
      status = case when p_patch ? 'status' then p_patch ->> 'status' else c.status end,
      owner = case when p_patch ? 'owner' then p_patch ->> 'owner' else c.owner end,
      due_date = case when p_patch ? 'due_date' then v_due else c.due_date end,
      note = case when p_patch ? 'note' then nullif(p_patch ->> 'note', '') else c.note end,
      updated_by_type = 'client',
      updated_by_name = v_author
    where c.program_id = v_program.id and c.item_key = p_item_key;
    if not found then
      raise exception 'unknown_item' using errcode = 'P0001';
    end if;
    return;
  end if;
  if coalesce(p_item_key, '') !~ '^[a-z0-9_]{1,64}$' then
    raise exception 'invalid_op' using errcode = 'P0001';
  end if;

  insert into public.program_checklist as c
    (program_id, item_key, status, owner, due_date, note, updated_by_type, updated_by_name)
  values
    (v_program.id, p_item_key, coalesce(p_patch ->> 'status', 'todo'), p_patch ->> 'owner', v_due,
     nullif(p_patch ->> 'note', ''), 'client', v_author)
  on conflict (program_id, item_key) do update set
    status = case when p_patch ? 'status' then excluded.status else c.status end,
    owner = case when p_patch ? 'owner' then excluded.owner else c.owner end,
    due_date = case when p_patch ? 'due_date' then excluded.due_date else c.due_date end,
    note = case when p_patch ? 'note' then excluded.note else c.note end,
    updated_by_type = 'client',
    updated_by_name = excluded.updated_by_name;
end;
$$;

-- A task of the brand's own, in a phase; returns its key.
create or replace function public.client_checklist_add(
  p_code text, p_author_name text, p_program_id uuid, p_label text, p_phase text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program public.vip_programs := public.client_shared_program(p_code, p_program_id);
  v_author text := public.client_checklist_author(p_author_name);
  v_key text := 'custom_' || gen_random_uuid()::text;
begin
  if char_length(btrim(coalesce(p_label, ''))) not between 1 and 200
    or coalesce(p_phase, '') not in ('pre_launch', 'launch', 'communication', 'post_launch') then
    raise exception 'invalid_value' using errcode = 'P0001';
  end if;
  insert into public.program_checklist (program_id, item_key, label, phase, updated_by_type, updated_by_name)
  values (v_program.id, v_key, btrim(p_label), p_phase, 'client', v_author);
  return v_key;
end;
$$;

-- Removes an added task (the template's steps are set "not concerned" instead).
create or replace function public.client_checklist_delete(p_code text, p_program_id uuid, p_item_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program public.vip_programs := public.client_shared_program(p_code, p_program_id);
begin
  if coalesce(p_item_key, '') not like 'custom\_%' then
    raise exception 'invalid_op' using errcode = 'P0001';
  end if;
  delete from public.program_checklist where program_id = v_program.id and item_key = p_item_key;
  if not found then
    raise exception 'unknown_item' using errcode = 'P0001';
  end if;
end;
$$;

-- Everything the client sees: published views, comments, validations, and
-- now the checklist with the setup answers that choose its steps.
create or replace function public.client_portal(p_code text, p_author_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_folder text := public.client_access_folder(p_code);
  v_key_hash text := case when char_length(coalesce(p_author_key, '')) >= 16
    then encode(extensions.digest(p_author_key, 'sha256'), 'hex') end;
begin
  return jsonb_build_object(
    'client_name', (
      select client_name from public.vip_programs
      where folder_key = v_folder order by updated_at desc limit 1),
    'programs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.program_name,
        'version', p.published_version,
        'published_at', p.published_at,
        'view', p.published_view,
        'comments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', c.id, 'page', c.page, 'item_ref', c.item_ref, 'item_label', c.item_label,
            'body', c.body, 'author_type', c.author_type, 'author_name', c.author_name,
            'created_at', c.created_at, 'updated_at', c.updated_at,
            'resolved', c.resolved_at is not null,
            'mine', c.author_type = 'client' and c.author_key_hash = v_key_hash
          ) order by c.created_at)
          from public.program_comments c where c.program_id = p.id), '[]'::jsonb),
        'validations', coalesce((
          select jsonb_agg(jsonb_build_object('page', v.page, 'by', v.validated_by, 'at', v.validated_at))
          from public.program_validations v
          where v.program_id = p.id and v.published_version = p.published_version), '[]'::jsonb),
        'setup', jsonb_build_object(
          'config', jsonb_build_object(
            'cms', p.state #> '{config,cms}',
            'crm', p.state #> '{config,crm}',
            'international', p.state #> '{config,international}',
            'multiLanguage', p.state #> '{config,multiLanguage}',
            'multiCurrency', p.state #> '{config,multiCurrency}',
            'physicalStore', p.state #> '{config,physicalStore}',
            'posSystem', p.state #> '{config,posSystem}',
            'hasMissions', p.state #> '{config,hasMissions}',
            'hasTiers', p.state #> '{config,hasTiers}'),
          'referralConfig', jsonb_build_object('enabled', p.state #> '{referralConfig,enabled}')),
        'checklist', coalesce((
          select jsonb_agg(jsonb_build_object(
            'item_key', k.item_key, 'label', k.label, 'phase', k.phase, 'status', k.status,
            'owner', k.owner, 'due_date', k.due_date, 'note', k.note, 'created_at', k.created_at,
            'updated_at', k.updated_at, 'updated_by_type', k.updated_by_type, 'updated_by_name', k.updated_by_name
          ) order by k.created_at)
          from public.program_checklist k where k.program_id = p.id), '[]'::jsonb)
      ) order by p.created_at)
      from public.vip_programs p
      where p.folder_key = v_folder and p.shared_with_client and p.published_view is not null
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.program_checklist_stamp() from public, anon, authenticated;
revoke all on function public.client_checklist_author(text) from public, anon, authenticated;
revoke all on function public.client_checklist_set(text, text, uuid, text, jsonb) from public;
revoke all on function public.client_checklist_add(text, text, uuid, text, text) from public;
revoke all on function public.client_checklist_delete(text, uuid, text) from public;
revoke all on function public.client_portal(text, text) from public;
grant execute on function public.client_checklist_set(text, text, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.client_checklist_add(text, text, uuid, text, text) to anon, authenticated;
grant execute on function public.client_checklist_delete(text, uuid, text) to anon, authenticated;
grant execute on function public.client_portal(text, text) to anon, authenticated;
