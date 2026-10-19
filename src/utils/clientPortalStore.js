// ════════════════════════════════════════════════════════════════════
// Client portal persistence — access codes, publication, comments
// ════════════════════════════════════════════════════════════════════
//
// CSMs use the tables directly (Loyoly team RLS). Clients only call the
// client_* SQL functions with their access code
// (supabase/migrations/20261020000000_client_portal.sql).

import { supabase, getAnonSupabase } from '../lib/supabase';
import { generateAccessCode } from './accessCode';

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

// Comments in one shape for both sides of the portal.
export function normalizeComment(row, { viewerEmail } = {}) {
  return {
    id: row.id,
    programId: row.program_id ?? null,
    page: row.page,
    itemRef: row.item_ref || null,
    itemLabel: row.item_label || null,
    body: row.body,
    authorType: row.author_type,
    authorName: row.author_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolved: row.resolved ?? !!row.resolved_at,
    mine: row.mine ?? (row.author_type === 'csm' && !!viewerEmail && row.author_email === viewerEmail),
  };
}

export const isEdited = c => new Date(c.updatedAt) - new Date(c.createdAt) > 1000;

// Client comments the CSM still has to handle: unresolved, written by the client.
export const isToHandle = c => c.authorType === 'client' && !c.resolved;

export function countToHandleByPage(comments) {
  const counts = {};
  comments.filter(isToHandle).forEach(c => { counts[c.page] = (counts[c.page] || 0) + 1; });
  return counts;
}

// Unresolved client comments of every program: { programId: { count, page } }
// where page is the page of the oldest one.
export async function listCommentsToHandle() {
  const rows = unwrap(await supabase.from('program_comments').select('program_id, page, created_at')
    .eq('author_type', 'client').is('resolved_at', null).order('created_at', { ascending: true }));
  const byProgram = {};
  rows.forEach(r => {
    byProgram[r.program_id] ??= { count: 0, page: r.page };
    byProgram[r.program_id].count++;
  });
  return byProgram;
}

// ── CSM: access code of a folder ─────────────────────────────────────
export async function getActiveAccess(folderKey) {
  return unwrap(await supabase.from('client_access').select('*')
    .eq('folder_key', folderKey).is('revoked_at', null).maybeSingle());
}

export async function revokeAccess(folderKey) {
  unwrap(await supabase.from('client_access').update({ revoked_at: new Date().toISOString() })
    .eq('folder_key', folderKey).is('revoked_at', null));
}

// A new code for the folder; the previous one stops working.
export async function createAccess(folderKey) {
  await revokeAccess(folderKey);
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await supabase.from('client_access')
      .insert({ folder_key: folderKey, code: generateAccessCode() }).select('*').single();
    if (!error) return data;
    if (error.code !== '23505' || attempt >= 2) throw error;
  }
}

// ── CSM: publication ─────────────────────────────────────────────────
export async function publishProgram(programId, view) {
  return unwrap(await supabase.rpc('publish_program', { p_program_id: programId, p_view: view }));
}

export async function setProgramShared(programId, shared) {
  unwrap(await supabase.from('vip_programs').update({ shared_with_client: shared }).eq('id', programId));
}

// ── CSM: comments and validations ────────────────────────────────────
export async function listComments(programIds, viewerEmail) {
  if (!programIds.length) return [];
  const rows = unwrap(await supabase.from('program_comments').select('*')
    .in('program_id', programIds).order('created_at', { ascending: true }));
  return rows.map(r => normalizeComment(r, { viewerEmail }));
}

export async function addCsmComment({ programId, page, itemRef, itemLabel, body, author }) {
  unwrap(await supabase.from('program_comments').insert({
    program_id: programId, page, item_ref: itemRef || null, item_label: itemLabel || null,
    body: body.trim(), author_type: 'csm', author_name: author.name, author_email: author.email,
  }));
}

export async function editCsmComment(id, body) {
  unwrap(await supabase.from('program_comments').update({ body: body.trim() }).eq('id', id));
}

export async function deleteCsmComment(id) {
  unwrap(await supabase.from('program_comments').delete().eq('id', id));
}

export async function setCommentResolved(id, resolved) {
  unwrap(await supabase.from('program_comments')
    .update({ resolved_at: resolved ? new Date().toISOString() : null }).eq('id', id));
}

export async function listValidations(programIds) {
  if (!programIds.length) return [];
  return unwrap(await supabase.from('program_validations').select('*').in('program_id', programIds));
}

// ── Client: everything goes through the access code ─────────────────
const rpc = async (fn, args) => unwrap(await getAnonSupabase().rpc(fn, args));

export const clientApi = {
  portal: (code, key) => rpc('client_portal', { p_code: code, p_author_key: key }),
  addComment: (code, author, { programId, page, itemRef, itemLabel, body }) => rpc('client_comment_add', {
    p_code: code, p_author_key: author.key, p_author_name: author.name, p_program_id: programId,
    p_page: page, p_item_ref: itemRef || null, p_item_label: itemLabel || null, p_body: body.trim(),
  }),
  editComment: (code, author, id, body) => rpc('client_comment_edit', {
    p_code: code, p_author_key: author.key, p_comment_id: id, p_body: body.trim(),
  }),
  deleteComment: (code, author, id) => rpc('client_comment_delete', {
    p_code: code, p_author_key: author.key, p_comment_id: id,
  }),
  validate: (code, author, programId, page) => rpc('client_validate', {
    p_code: code, p_author_name: author.name, p_program_id: programId, p_page: page,
  }),
};
