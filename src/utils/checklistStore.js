// ════════════════════════════════════════════════════════════════════
// Launch checklist persistence — program_checklist (Loyoly team side)
// ════════════════════════════════════════════════════════════════════
// The brand goes through clientApi.checklist* (utils/clientPortalStore.js).

import { supabase } from '../lib/supabase';
import { CUSTOM_PREFIX, isCustomKey, checklistProgressByProgram } from './checklist';

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

export async function listChecklist(programId) {
  return unwrap(await supabase.from('program_checklist').select('*')
    .eq('program_id', programId).order('created_at', { ascending: true }));
}

// A template step's row is created on its first change; an added task
// exists already. `row` is a checklistRowPatch.
export async function saveChecklistItem(programId, key, row) {
  if (isCustomKey(key)) {
    unwrap(await supabase.from('program_checklist').update(row).eq('program_id', programId).eq('item_key', key));
  } else {
    unwrap(await supabase.from('program_checklist')
      .upsert({ program_id: programId, item_key: key, ...row }, { onConflict: 'program_id,item_key' }));
  }
}

export const newTaskKey = () => `${CUSTOM_PREFIX}${crypto.randomUUID()}`;

export async function addChecklistTask(programId, key, label, phase) {
  unwrap(await supabase.from('program_checklist').insert({ program_id: programId, item_key: key, label: label.trim(), phase }));
}

export async function deleteChecklistTask(programId, key) {
  unwrap(await supabase.from('program_checklist').delete().eq('program_id', programId).eq('item_key', key));
}

// Where every program's checklist stands, for the client space (programs
// never started are left out). A missing table (migration not run) gives {}.
export async function listChecklistProgress() {
  const [rows, programs] = await Promise.all([
    supabase.from('program_checklist')
      .select('program_id, item_key, label, phase, status, created_at, updated_at, updated_by_type, updated_by_name').then(unwrap),
    supabase.from('vip_programs').select('id, config:state->config, referralConfig:state->referralConfig').then(unwrap),
  ]);
  return checklistProgressByProgram(programs, rows);
}
