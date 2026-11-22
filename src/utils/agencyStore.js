// ════════════════════════════════════════════════════════════════════
// Agencies — accounts of the partner agencies (/agency)
// ════════════════════════════════════════════════════════════════════
// Tables and rules: supabase/migrations/20261122000000_agencies.sql.

import { supabase } from '../lib/supabase';

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

export const AGENCY_STATUSES = ['pending', 'approved', 'suspended'];

// The signed-in member's agency, created (pending) on its first visit:
// { agency_id, name, website, status, role, analyses_left }.
export async function agencyMe() {
  return unwrap(await supabase.rpc('agency_me'));
}

// Every agency with its members (Loyoly team only), newest first.
export async function listAgencies() {
  const [agencies, members] = await Promise.all([
    supabase.from('agencies').select('*').order('created_at', { ascending: false }).then(unwrap),
    supabase.from('agency_members').select('agency_id, email, role, created_at').then(unwrap),
  ]);
  return agencies.map(a => ({ ...a, members: members.filter(m => m.agency_id === a.id) }));
}

export async function setAgencyStatus(id, status) {
  unwrap(await supabase.from('agencies').update({ status }).eq('id', id));
}

// The agencies' names by id, for the badges of the client space. A missing
// table (migration not run) gives {}.
export async function agencyNames() {
  const { data, error } = await supabase.from('agencies').select('id, name');
  if (error) return {};
  return Object.fromEntries(data.map(a => [a.id, a.name]));
}

// Agencies waiting for a review (navbar badge of the Loyoly team).
export const pendingCount = agencies => agencies.filter(a => a.status === 'pending').length;
