// ════════════════════════════════════════════════════════════════════
// Program persistence — Supabase table `vip_programs`
// ════════════════════════════════════════════════════════════════════
//
// Every program designed in the wizard is saved to Supabase and shared by the
// whole Loyoly team. App builds a snapshot of the wizard state on every change
// and hands it to a ProgramSaver, which debounces, serializes and retries the
// writes so that each modification ends up in the database.

import { supabase } from '../lib/supabase';
import { defaultTierUtilization } from '../data/programDefaults';
import { normalizeDomain, folderKeyOf } from './clientFolders';

const TABLE = 'vip_programs';
export const DEFAULT_PROGRAM_NAME = 'Programme principal';
export const STATE_VERSION = 2;
const LIST_COLUMNS = 'id, hubspot_company_id, folder_key, client_name, client_domain, client_plan, program_name, step, customers_count, tier_count, shared_with_client, published_version, published_at, created_by, updated_at, updated_by';

// ── Reads / deletes ──────────────────────────────────────────────────
export async function listPrograms() {
  const { data, error } = await supabase
    .from(TABLE)
    .select(LIST_COLUMNS)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function loadProgram(id) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

// Programs of a HubSpot company — its client folder.
export async function listCompanyPrograms(companyId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(LIST_COLUMNS)
    .eq('hubspot_company_id', String(companyId))
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteProgram(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function renameProgram(id, name) {
  const { error } = await supabase.from(TABLE).update({ program_name: name }).eq('id', id);
  if (error) throw error;
}

// A copy of a saved program, in the same client folder (not published).
export function copyProgramRow(source, name) {
  return {
    hubspot_company_id: source.hubspot_company_id ?? null,
    folder_key: source.folder_key ?? folderKeyOf(source),
    client_name: source.client_name,
    client_domain: source.client_domain ?? null,
    client_plan: source.client_plan ?? null,
    program_name: name,
    step: source.step ?? 1,
    state: source.state,
    customers: source.customers ?? [],
  };
}

export async function duplicateProgram(id, name) {
  const source = await loadProgram(id);
  const { data, error } = await supabase.from(TABLE).insert(copyProgramRow(source, name)).select('id').single();
  if (error) throw error;
  return data.id;
}

// ── Format migrations ────────────────────────────────────────────────
// v1 → v2: points became derived values (earn rate × base values) and the
// reward cost per tier comes from tier.avgUtilization. A migrated program
// shows the same figures as before: the earn rate it had is pinned, stored
// points are converted back to base values, and each tier keeps the average
// utilization it displayed.
const EARN_RATE_STEPS = [1, 5, 10];

export function migrateProgramState(state = {}) {
  if ((state.v ?? 1) >= STATE_VERSION) return state;

  const settings = { ...(state.settings || {}) };
  const cashback = Number(settings.cashbackRate) || 0;
  const oldPtsPerRewardEur = Number(settings.pointsPerEuro) || 100;
  const oldEarnRate = cashback * oldPtsPerRewardEur / 100;
  const snapped = EARN_RATE_STEPS.find(r => Math.abs(oldEarnRate - r) / r <= 0.1);
  const earnRate = oldEarnRate > 0 ? (snapped ?? Math.round(oldEarnRate * 100) / 100) : 1;
  const ptsPerRewardEur = cashback > 0 ? earnRate * 100 / cashback : 100;
  delete settings.pointsPerEuro;

  const toMission = m => (m.isPurchaseMission || m.basePoints !== undefined
    ? m
    : { ...m, basePoints: (m.points ?? 0) / earnRate });

  const rewards = (state.rewards || []).map(r => ({
    ...r,
    pointsValueEur: r.pointsValueEur ?? (r.pointsCost ?? 0) / ptsPerRewardEur,
    bonusBasePoints: r.bonusBasePoints ?? (r.pointsBonus ?? 0) / earnRate,
    // Bonus costs were frozen when added; promo costs always followed the margin.
    realCostAuto: r.realCostAuto ?? r.type === 'promo_percent',
    minPurchaseAuto: r.minPurchaseAuto ?? false,
  }));

  const burnRate = state.burnRate ?? 40;
  const tiers = (state.tiers || []).map((tier, i) => {
    if (tier.avgUtilization !== undefined) return tier;
    const assigned = (state.rewards || []).filter(r => r.assignedTiers?.[i]);
    const avg = assigned.length > 0
      ? Math.round(assigned.reduce((s, r) => s + (r.utilizationByTier?.[i] ?? burnRate), 0) / assigned.length)
      : defaultTierUtilization(i);
    return { ...tier, avgUtilization: avg };
  });

  return {
    ...state,
    v: STATE_VERSION,
    settings: { ...settings, earnRate, earnRateManual: true },
    missions: (state.missions || []).map(toMission),
    customMissions: (state.customMissions || []).map(toMission),
    rewards,
    tiers,
  };
}

// ── Snapshot of the wizard state ─────────────────────────────────────
// `target` is the mutable handle of the open program: { id, hubspotCompanyId, name }.
// id stays null until the first save inserts the row.
export function buildProgramSnapshot(target, s) {
  const client = programClientFields(s);
  const row = {
    ...client,
    folder_key: folderKeyOf({ hubspot_company_id: target.hubspotCompanyId, ...client }),
    step: s.step ?? 1,
    state: {
      v: STATE_VERSION,
      config: s.config,
      settings: s.settings,
      tiers: s.tiers,
      rewards: s.rewards,
      missions: s.missions,
      customMissions: s.customMissions,
      burnRate: s.burnRate,
      referralConfig: s.referralConfig,
      onboardingAnswers: s.onboardingAnswers ?? null,
      brandAnalysis: s.brandAnalysis ?? null,
    },
  };
  return { target, row, key: stableStringify(row), customers: s.customers };
}

// Client a program is filed under: its HubSpot company, else the analyzed brand.
export function programClientFields({ selectedClient, brandAnalysis }) {
  return {
    client_name: selectedClient?.name || brandAnalysis?.brand_name || 'Configuration manuelle',
    client_domain: selectedClient?.domain || normalizeDomain(brandAnalysis?.brand_url) || null,
    client_plan: selectedClient?.plan || null,
  };
}

// JSON with sorted keys: Postgres jsonb does not keep key order, so this is
// what lets a reloaded program compare equal to the one in the database.
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(v => (v === undefined ? 'null' : stableStringify(v))).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .filter(k => value[k] !== undefined)
      .map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

// ── Writes ───────────────────────────────────────────────────────────
// Insert on first save, update afterwards. Customers are only sent when they
// changed (the list can be large) — except on insert, which always carries them.
export async function persistProgram(target, row, customers, includeCustomers) {
  if (target.id) {
    const payload = includeCustomers ? { ...row, customers } : row;
    const { data, error } = await supabase.from(TABLE).update(payload).eq('id', target.id).select('id');
    if (error) throw error;
    if (data.length > 0) return;
    // The row was deleted in the meantime (by another CSM): recreate it.
    target.id = null;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(newProgramRow(target, row, customers))
    .select('id')
    .single();
  if (error) throw error;
  target.id = data.id;
}

// Row inserted by the first save of a program.
export function newProgramRow(target, row, customers) {
  return {
    ...row,
    customers,
    hubspot_company_id: target.hubspotCompanyId ?? null,
    program_name: target.name || DEFAULT_PROGRAM_NAME,
  };
}

// Debounced, serialized, retrying writer. One instance per App.
//   schedule(snapshot) — queue the latest state of a program
//   flush()            — write everything queued now; resolves when drained
//   markSaved(snapshot)— declare a freshly loaded program as already in the DB
//   hasUnsaved()       — true while something is queued or being written
export function createProgramSaver({ persist = persistProgram, onChange, debounceMs = 600, retryMs = 5000 }) {
  const queue = new Map();        // target → latest unsaved snapshot
  const latest = new WeakMap();   // target → last snapshot accepted (queued, in flight or saved)
  const saved = new WeakMap();    // target → customers array last written
  let running = null;
  let timer = null;
  let status = { status: 'idle', savedAt: null, error: null };

  const update = patch => {
    status = { ...status, ...patch };
    onChange?.(status);
  };

  const isSame = (a, b) => !!a && !!b && a.key === b.key && a.customers === b.customers;

  async function drain() {
    while (queue.size > 0) {
      const [target, snap] = queue.entries().next().value;
      queue.delete(target);
      update({ status: 'saving' });
      try {
        const includeCustomers = !saved.has(target) || saved.get(target) !== snap.customers;
        await persist(target, snap.row, snap.customers, includeCustomers);
        saved.set(target, snap.customers);
      } catch (error) {
        if (!queue.has(target)) queue.set(target, snap);
        update({ status: 'error', error });
        timer = setTimeout(flush, retryMs);
        return false;
      }
    }
    update({ status: 'saved', savedAt: Date.now(), error: null });
    return true;
  }

  function flush() {
    clearTimeout(timer);
    timer = null;
    if (!running) {
      running = drain().finally(() => { running = null; });
    }
    return running;
  }

  function schedule(snap) {
    if (isSame(latest.get(snap.target), snap)) return;
    latest.set(snap.target, snap);
    queue.set(snap.target, snap);
    if (status.status !== 'error') update({ status: 'pending' });
    clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  }

  function markSaved(snap) {
    latest.set(snap.target, snap);
    saved.set(snap.target, snap.customers);
  }

  const hasUnsaved = () => queue.size > 0 || running !== null;

  return { schedule, flush, markSaved, hasUnsaved };
}
