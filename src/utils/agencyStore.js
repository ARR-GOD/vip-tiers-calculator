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
// { agency_id, name, website, status, role, analyses_left }. A Google
// account has no agency name in its metadata: { name, website } give it
// (without one, the first visit fails with agency_name_required).
export async function agencyMe({ name, website } = {}) {
  return unwrap(await supabase.rpc('agency_me', { p_name: name || null, p_website: website || null }));
}

// The agency name typed before a Google sign-up, kept across the sign-in.
const PENDING_KEY = 'loyoly-agency-pending';
export function savePendingAgency(pending) {
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch { /* private mode */ }
}
export function takePendingAgency() {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
export function clearPendingAgency() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch { /* private mode */ }
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
