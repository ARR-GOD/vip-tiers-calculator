-- ════════════════════════════════════════════════════════════════════
-- Agencies: the analyses counter actually counts
-- ════════════════════════════════════════════════════════════════════
-- agencies_review_stamp reset `analyses` on every update, including the one
-- of agency_consume_analysis(): the 30-analysis quota never moved. The
-- counter is now protected only against direct updates from the client
-- (the Loyoly team reviewing an agency); agency_consume_analysis() runs as
-- the function owner and may increment it.

create or replace function public.agencies_review_stamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.id := old.id; new.created_at := old.created_at;
  if current_user in ('authenticated', 'anon') then new.analyses := old.analyses; end if;
  if new.status is distinct from old.status then
    new.reviewed_at := now(); new.reviewed_by := auth.jwt() ->> 'email';
  else
    new.reviewed_at := old.reviewed_at; new.reviewed_by := old.reviewed_by;
  end if;
  return new;
end; $$;
