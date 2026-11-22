-- ════════════════════════════════════════════════════════════════════
-- Client portal — the client's side of the program, with comments
-- ════════════════════════════════════════════════════════════════════
-- A CSM shares a client folder through an access code. Clients never read
-- the tables: the client_* functions check the code on every call and only
-- return what was published for the client (the setup sheet) — never the
-- working state nor the imported customers.

create extension if not exists pgcrypto with schema extensions;

-- ── Programs: folder and publication ─────────────────────────────────
alter table public.vip_programs
  add column if not exists folder_key text,
  add column if not exists shared_with_client boolean not null default false,
  add column if not exists published_view jsonb,
  add column if not exists published_version integer not null default 0,
  add column if not exists published_at timestamptz,
  add column if not exists published_by text;

-- Same rule as folderKeyOf() (src/utils/clientFolders.js); the app writes
-- the key on every save from now on.
update public.vip_programs
set folder_key = case
  when hubspot_company_id is not null then 'hs:' || hubspot_company_id
  else 'brand:' || coalesce(
    nullif(trim(regexp_replace(regexp_replace(regexp_replace(
      lower(trim(client_domain)), '^https?://', ''), '^www\.', ''), '[/?#].*$', '')), ''),
    lower(trim(client_name)))
end
where folder_key is null;

create index if not exists vip_programs_folder_key_idx on public.vip_programs (folder_key);

-- Publishing bumps the version atomically (RLS applies: Loyoly team only).
create or replace function public.publish_program(p_program_id uuid, p_view jsonb)
returns integer
language sql
set search_path = ''
as $$
  update public.vip_programs
  set published_view = p_view,
      published_version = published_version + 1,
      published_at = now(),
      published_by = auth.jwt() ->> 'email',
      shared_with_client = true
  where id = p_program_id
  returning published_version;
$$;

-- ── Access codes ─────────────────────────────────────────────────────
-- Codes are stored canonical: 12 characters, upper case, no dash.
create table if not exists public.client_access (
  id            uuid primary key default gen_random_uuid(),
  folder_key    text not null,
  code          text not null unique check (code ~ '^[0-9A-Z]{12}$'),
  created_by    text default (auth.jwt() ->> 'email'),
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  last_seen_at  timestamptz
);

-- One active code per folder: regenerating revokes the previous one.
create unique index if not exists client_access_active_folder_idx
  on public.client_access (folder_key) where revoked_at is null;

-- ── Comments: one thread per page, optionally about one item ─────────
create table if not exists public.program_comments (
  id               uuid primary key default gen_random_uuid(),
  program_id       uuid not null references public.vip_programs (id) on delete cascade,
  page             text not null check (page in ('missions', 'rewards', 'referral', 'tiers')),
  item_ref         text,
  item_label       text,
  body             text not null check (char_length(trim(body)) between 1 and 4000),
  author_type      text not null check (author_type in ('csm', 'client')),
  author_name      text not null check (char_length(trim(author_name)) between 1 and 80),
  author_email     text,
  author_key_hash  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  resolved_at      timestamptz,
  resolved_by      text
);

create index if not exists program_comments_program_idx on public.program_comments (program_id, page);

-- Only the text (by its author) and the resolved status change after posting.
create or replace function public.program_comments_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  staff_email text := auth.jwt() ->> 'email';
begin
  if new.body is distinct from old.body then
    -- Staff may only edit their own comments; clients go through
    -- client_comment_edit(), which checks their key.
    if staff_email is not null and not (old.author_type = 'csm' and old.author_email = staff_email) then
      raise exception 'Only the author can edit this comment' using errcode = '42501';
    end if;
    new.updated_at := now();
  end if;
  if new.resolved_at is distinct from old.resolved_at then
    new.resolved_by := case when new.resolved_at is null then null else staff_email end;
  else
    new.resolved_by := old.resolved_by;
  end if;
  new.program_id := old.program_id;
  new.page := old.page;
  new.item_ref := old.item_ref;
  new.item_label := old.item_label;
  new.author_type := old.author_type;
  new.author_name := old.author_name;
  new.author_email := old.author_email;
  new.author_key_hash := old.author_key_hash;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists program_comments_guard on public.program_comments;
create trigger program_comments_guard
  before update on public.program_comments
  for each row execute function public.program_comments_guard();

-- ── Validations: the client approves a page of a published version ──
create table if not exists public.program_validations (
  id                 uuid primary key default gen_random_uuid(),
  program_id         uuid not null references public.vip_programs (id) on delete cascade,
  page               text not null check (page in ('missions', 'rewards', 'referral', 'tiers')),
  published_version  integer not null,
  validated_by       text not null check (char_length(trim(validated_by)) between 1 and 80),
  validated_at       timestamptz not null default now(),
  unique (program_id, page, published_version)
);

-- ── Access: Loyoly team through RLS, clients through functions only ──
alter table public.client_access enable row level security;
alter table public.program_comments enable row level security;
alter table public.program_validations enable row level security;

revoke all on public.client_access, public.program_comments, public.program_validations from anon;
grant select, insert, update on public.client_access to authenticated;
grant select, insert, update, delete on public.program_comments to authenticated;
grant select on public.program_validations to authenticated;

drop policy if exists "Loyoly team manages client access" on public.client_access;
create policy "Loyoly team manages client access" on public.client_access
  for all to authenticated
  using ((select auth.jwt() ->> 'email') ilike '%@loyoly.io')
  with check ((select auth.jwt() ->> 'email') ilike '%@loyoly.io');

drop policy if exists "Loyoly team reads comments" on public.program_comments;
create policy "Loyoly team reads comments" on public.program_comments
  for select to authenticated
  using ((select auth.jwt() ->> 'email') ilike '%@loyoly.io');

drop policy if exists "Loyoly team comments as itself" on public.program_comments;
create policy "Loyoly team comments as itself" on public.program_comments
  for insert to authenticated
  with check (
    (select auth.jwt() ->> 'email') ilike '%@loyoly.io'
    and author_type = 'csm'
    and author_email = (select auth.jwt() ->> 'email')
    and author_key_hash is null
  );

-- Any team member may resolve; the guard trigger limits text edits to the author.
drop policy if exists "Loyoly team updates comments" on public.program_comments;
create policy "Loyoly team updates comments" on public.program_comments
  for update to authenticated
  using ((select auth.jwt() ->> 'email') ilike '%@loyoly.io')
  with check ((select auth.jwt() ->> 'email') ilike '%@loyoly.io');

drop policy if exists "Loyoly team deletes its own comments" on public.program_comments;
create policy "Loyoly team deletes its own comments" on public.program_comments
  for delete to authenticated
  using (
    (select auth.jwt() ->> 'email') ilike '%@loyoly.io'
    and author_type = 'csm'
    and author_email = (select auth.jwt() ->> 'email')
  );

drop policy if exists "Loyoly team reads validations" on public.program_validations;
create policy "Loyoly team reads validations" on public.program_validations
  for select to authenticated
  using ((select auth.jwt() ->> 'email') ilike '%@loyoly.io');

-- ── Client functions ─────────────────────────────────────────────────
-- Folder of an active code (and the client's last visit), or an error.
create or replace function public.client_access_folder(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_folder text;
begin
  update public.client_access
  set last_seen_at = now()
  where code = regexp_replace(upper(coalesce(p_code, '')), '[^0-9A-Z]', '', 'g')
    and revoked_at is null
  returning folder_key into v_folder;
  if v_folder is null then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;
  return v_folder;
end;
$$;

-- A shared, published program of the code's folder, or an error.
create or replace function public.client_shared_program(p_code text, p_program_id uuid)
returns public.vip_programs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program public.vip_programs;
begin
  select * into v_program
  from public.vip_programs
  where id = p_program_id
    and folder_key = public.client_access_folder(p_code)
    and shared_with_client
    and published_view is not null;
  if v_program.id is null then
    raise exception 'not_shared' using errcode = 'P0001';
  end if;
  return v_program;
end;
$$;

create or replace function public.client_key_hash(p_author_key text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(coalesce(p_author_key, '')) < 16 then
    raise exception 'invalid_author_key' using errcode = 'P0001';
  end if;
  return encode(extensions.digest(p_author_key, 'sha256'), 'hex');
end;
$$;

-- Everything the client sees: published views, comments, validations.
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
          where v.program_id = p.id and v.published_version = p.published_version), '[]'::jsonb)
      ) order by p.created_at)
      from public.vip_programs p
      where p.folder_key = v_folder and p.shared_with_client and p.published_view is not null
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.client_comment_add(
  p_code text, p_author_key text, p_author_name text, p_program_id uuid,
  p_page text, p_item_ref text, p_item_label text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program public.vip_programs := public.client_shared_program(p_code, p_program_id);
  v_id uuid;
begin
  insert into public.program_comments
    (program_id, page, item_ref, item_label, body, author_type, author_name, author_key_hash)
  values
    (v_program.id, p_page, nullif(p_item_ref, ''), nullif(p_item_label, ''), trim(p_body),
     'client', trim(p_author_name), public.client_key_hash(p_author_key))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.client_comment_edit(
  p_code text, p_author_key text, p_comment_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.program_comments c
  set body = trim(p_body)
  where c.id = p_comment_id
    and c.author_type = 'client'
    and c.author_key_hash = public.client_key_hash(p_author_key)
    and c.program_id = (public.client_shared_program(p_code, c.program_id)).id;
  if not found then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.client_comment_delete(
  p_code text, p_author_key text, p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.program_comments c
  where c.id = p_comment_id
    and c.author_type = 'client'
    and c.author_key_hash = public.client_key_hash(p_author_key)
    and c.program_id = (public.client_shared_program(p_code, c.program_id)).id;
  if not found then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
end;
$$;

-- The first validation of a page for the published version stands.
create or replace function public.client_validate(
  p_code text, p_author_name text, p_program_id uuid, p_page text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program public.vip_programs := public.client_shared_program(p_code, p_program_id);
begin
  insert into public.program_validations (program_id, page, published_version, validated_by)
  values (v_program.id, p_page, v_program.published_version, trim(p_author_name))
  on conflict (program_id, page, published_version) do nothing;
end;
$$;

-- Internal helpers are not callable from the API; the client_* entry points are.
revoke all on function public.client_access_folder(text) from public, anon, authenticated;
revoke all on function public.client_shared_program(text, uuid) from public, anon, authenticated;
revoke all on function public.client_key_hash(text) from public, anon, authenticated;
revoke all on function public.program_comments_guard() from public, anon, authenticated;
revoke all on function public.publish_program(uuid, jsonb) from public, anon;
grant execute on function public.publish_program(uuid, jsonb) to authenticated;

revoke all on function public.client_portal(text, text) from public;
revoke all on function public.client_comment_add(text, text, text, uuid, text, text, text, text) from public;
revoke all on function public.client_comment_edit(text, text, uuid, text) from public;
revoke all on function public.client_comment_delete(text, text, uuid) from public;
revoke all on function public.client_validate(text, text, uuid, text) from public;
grant execute on function public.client_portal(text, text) to anon, authenticated;
grant execute on function public.client_comment_add(text, text, text, uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.client_comment_edit(text, text, uuid, text) to anon, authenticated;
grant execute on function public.client_comment_delete(text, text, uuid) to anon, authenticated;
grant execute on function public.client_validate(text, text, uuid, text) to anon, authenticated;
