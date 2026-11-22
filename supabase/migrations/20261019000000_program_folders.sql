-- ════════════════════════════════════════════════════════════════════
-- Client folders — several programs per client
-- ════════════════════════════════════════════════════════════════════
-- A client folder groups the programs of one HubSpot company (or, outside
-- HubSpot, of one brand): proposals, versions… Each program gets a name.

alter table public.vip_programs
  drop constraint if exists vip_programs_hubspot_company_id_key;

alter table public.vip_programs
  add column if not exists program_name text not null default 'Programme principal';

create index if not exists vip_programs_hubspot_company_id_idx
  on public.vip_programs (hubspot_company_id);
