// ════════════════════════════════════════════════════════════════════
// Persistence helpers — localStorage drafts + URL share encoding
// ════════════════════════════════════════════════════════════════════
//
// Two persistence layers:
// 1. localStorage drafts (per CSM user, per client): auto-saved + customers
//    included so the CSM doesn't have to re-import on return.
// 2. URL share links: state encoded in the URL hash (no customers — too big
//    to fit in a URL). Recipient opens the link, lands on the wizard with all
//    program params restored, and is invited to import a CSV if none is set.
//
// Soft expiration: share links embed an `expires_at` timestamp. Older state
// is rejected at load time and the user sees a "lien expiré" message.

const DRAFT_PREFIX = 'vip_draft_';
const SHARE_VERSION = 1;          // bump if the encoded schema changes
const DEFAULT_EXPIRY_DAYS = 30;

// ── Serialization of the program state (drafts) ──────────────────────
function buildDraftPayload(state) {
  const {
    config, settings, tiers, rewards, missions, customMissions,
    burnRate, referralConfig, onboardingAnswers,
    selectedClient, customers, step,
  } = state;
  return {
    v: SHARE_VERSION,
    savedAt: Date.now(),
    selectedClient: selectedClient ? { id: selectedClient.id, name: selectedClient.name, domain: selectedClient.domain, plan: selectedClient.plan } : null,
    step: step ?? 1,
    config, settings, tiers, rewards, missions, customMissions,
    burnRate, referralConfig, onboardingAnswers,
    customers: customers || [],
  };
}

function draftKey(clientId) {
  return `${DRAFT_PREFIX}${clientId || 'manual'}`;
}

// Persist (auto-save). Falls back gracefully if quota is exceeded by retrying
// without customers — at worst the user will have to re-import their CSV.
export function saveDraft(state) {
  try {
    const payload = buildDraftPayload(state);
    const key = draftKey(state.selectedClient?.id);
    try {
      localStorage.setItem(key, JSON.stringify(payload));
      return { ok: true, withCustomers: true, savedAt: payload.savedAt };
    } catch {
      // Quota / size issue — retry without customers.
      const slim = { ...payload, customers: [] };
      localStorage.setItem(key, JSON.stringify(slim));
      return { ok: true, withCustomers: false, savedAt: payload.savedAt };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function loadDraft(clientId) {
  try {
    const raw = localStorage.getItem(draftKey(clientId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function deleteDraft(clientId) {
  try { localStorage.removeItem(draftKey(clientId)); } catch { /* noop */ }
}

// All drafts saved on this device, most recent first.
export function listDrafts() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(DRAFT_PREFIX)) continue;
      try {
        const v = JSON.parse(localStorage.getItem(k));
        if (v && v.v === SHARE_VERSION) {
          out.push({ key: k, ...v });
        }
      } catch { /* skip corrupted */ }
    }
  } catch { /* noop */ }
  return out.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

// ── Shareable URL encoding ───────────────────────────────────────────
// State without customers (the recipient re-imports a CSV). Embedded in the
// URL hash so it never hits the server.

function buildSharePayload(state, expiresAt) {
  return {
    v: SHARE_VERSION,
    sharedAt: Date.now(),
    expiresAt,
    clientName: state.selectedClient?.name || null,
    step: 1, // recipient should start at Import
    config: state.config,
    settings: state.settings,
    tiers: state.tiers,
    rewards: state.rewards,
    missions: state.missions,
    customMissions: state.customMissions,
    burnRate: state.burnRate,
    referralConfig: state.referralConfig,
    onboardingAnswers: state.onboardingAnswers,
  };
}

// btoa / atob handle Latin-1 only; we go via encodeURIComponent so non-ASCII
// names (e.g. tier 'Éveil') round-trip correctly. URL-safe variant.
function toBase64Url(str) {
  const utf8 = unescape(encodeURIComponent(str));
  return btoa(utf8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(s) {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return decodeURIComponent(escape(atob(padded)));
}

export function encodeShareUrl(state, { expiresInDays = DEFAULT_EXPIRY_DAYS } = {}) {
  const expiresAt = Date.now() + expiresInDays * 86400_000;
  const payload = buildSharePayload(state, expiresAt);
  const json = JSON.stringify(payload);
  const encoded = toBase64Url(json);
  const base = `${window.location.origin}${window.location.pathname}`;
  return { url: `${base}#share=${encoded}`, expiresAt, byteSize: encoded.length };
}

// Try to decode a share blob from the URL hash. Returns { state, expiresAt }
// or { error: 'expired' | 'invalid' } if the link is bad.
export function decodeShareFromLocation() {
  const hash = window.location.hash || '';
  const m = hash.match(/[#&]share=([^&]+)/);
  if (!m) return null;
  try {
    const json = fromBase64Url(m[1]);
    const payload = JSON.parse(json);
    if (!payload || payload.v !== SHARE_VERSION) return { error: 'invalid' };
    if (payload.expiresAt && payload.expiresAt < Date.now()) {
      return { error: 'expired', expiresAt: payload.expiresAt };
    }
    return { state: payload, expiresAt: payload.expiresAt };
  } catch {
    return { error: 'invalid' };
  }
}

export function clearShareFromLocation() {
  try {
    const cleanHash = (window.location.hash || '').replace(/[#&]?share=[^&]+/, '');
    if (cleanHash && cleanHash !== '#') {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}${cleanHash}`);
    } else {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  } catch { /* noop */ }
}
