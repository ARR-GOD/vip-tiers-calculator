// ════════════════════════════════════════════════════════════════════
// Program operations — the edits a brand makes from its client portal
// ════════════════════════════════════════════════════════════════════
//
// An op sets one whitelisted field of the program:
//   { kind: 'mission', id, field: 'enabled' | 'basePoints', value }
//   { kind: 'reward',  id, field: 'pointsBase' | 'expirationDays' | 'minPurchase', value }
//   { kind: 'perk',    id, index, field: 'assigned', value }      (perk in tier `index`)
//   { kind: 'tier',    index, field: 'spendThreshold' | 'orderThreshold' | 'pointsMultiplier', value }
//   { kind: 'referral', field: 'patch', value: { …referral fields } }
// The client_edit SQL function (supabase/migrations/20261108000000_client_edits.sql)
// applies the same ops, with the same checks, to the saved program and to its
// published view; the CSM's open wizard replays them from the activity feed.
// Values are stored like the program stores them (points on the 1 pt/€ grid).

export const REFERRAL_FIELDS = {
  rewardsAuto: 'boolean',
  referrerType: 'type',
  referrerValue: 'amount',
  refereeType: 'type',
  refereeValue: 'amount',
  expirationsAuto: 'boolean',
  referrerExpirationDays: 'days',
  refereeExpirationDays: 'days',
  referrerMinPurchaseAuto: 'boolean',
  referrerMinPurchase: 'money',
  refereeMinPurchaseAuto: 'boolean',
  refereeMinPurchase: 'money',
};

const RANGES = {
  points: [0, 1_000_000],
  money: [0, 1_000_000],
  days: [0, 3650],
  threshold: [0, 1_000_000_000],
  multiplier: [1, 10],
  amount: [0, 1000],
};

const fail = message => { throw new Error(message); };

function requireNumber(value, range) {
  const [min, max] = RANGES[range];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail('invalid_value');
  return value;
}

function requireBoolean(value) {
  if (typeof value !== 'boolean') fail('invalid_value');
  return value;
}

function requireReferralValue(type, value) {
  if (type === 'boolean') return requireBoolean(value);
  if (type === 'type') {
    if (value !== 'percent' && value !== 'fixed') fail('invalid_value');
    return value;
  }
  return requireNumber(value, type);
}

const indexOfId = (list, id) => (list || []).findIndex(item => item.id === id);

function setAt(list, index, patch) {
  return list.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

// ── Slice-level ops (the CSM wizard keeps each slice in its own state) ──
export function applyMissionOp(missions, op) {
  const index = indexOfId(missions, op.id);
  if (index < 0) return missions;
  if (op.field === 'enabled') return setAt(missions, index, { enabled: requireBoolean(op.value) });
  if (op.field === 'basePoints') return setAt(missions, index, { basePoints: requireNumber(op.value, 'points') });
  return fail('invalid_op');
}

export function applyRewardOp(rewards, op) {
  const index = indexOfId(rewards, op.id);
  if (index < 0) return fail('unknown_item');
  if (op.kind === 'perk') {
    if (op.field !== 'assigned' || !Number.isInteger(op.index) || op.index < 0) fail('invalid_op');
    const value = requireBoolean(op.value);
    const assignedTiers = [...(rewards[index].assignedTiers || [])];
    while (assignedTiers.length <= op.index) assignedTiers.push(false);
    assignedTiers[op.index] = value;
    return setAt(rewards, index, { assignedTiers });
  }
  if (op.field === 'pointsBase') return setAt(rewards, index, { pointsBase: requireNumber(op.value, 'points') });
  if (op.field === 'expirationDays') return setAt(rewards, index, { expirationDays: requireNumber(op.value, 'days') });
  if (op.field === 'minPurchase') return setAt(rewards, index, { minPurchase: requireNumber(op.value, 'money'), minPurchaseAuto: false });
  return fail('invalid_op');
}

export function applyTierOp(tiers, op) {
  if (!Number.isInteger(op.index) || op.index < 0 || op.index >= tiers.length) fail('unknown_item');
  if (op.field === 'spendThreshold' || op.field === 'orderThreshold') {
    return setAt(tiers, op.index, { [op.field]: requireNumber(op.value, 'threshold') });
  }
  if (op.field === 'pointsMultiplier') return setAt(tiers, op.index, { pointsMultiplier: requireNumber(op.value, 'multiplier') });
  return fail('invalid_op');
}

export function applyReferralOp(referralConfig, op) {
  const patch = op.value;
  if (op.field !== 'patch' || !patch || typeof patch !== 'object' || Array.isArray(patch)) fail('invalid_op');
  const checked = {};
  Object.entries(patch).forEach(([key, value]) => {
    if (!(key in REFERRAL_FIELDS)) fail('invalid_op');
    checked[key] = requireReferralValue(REFERRAL_FIELDS[key], value);
  });
  return { ...(referralConfig || {}), ...checked };
}

// ── Whole-program op ──
export function applyProgramOp(program, op) {
  switch (op?.kind) {
    case 'mission': {
      const inMissions = indexOfId(program.missions, op.id) >= 0;
      const inCustom = indexOfId(program.customMissions, op.id) >= 0;
      if (!inMissions && !inCustom) fail('unknown_item');
      return inMissions
        ? { ...program, missions: applyMissionOp(program.missions, op) }
        : { ...program, customMissions: applyMissionOp(program.customMissions, op) };
    }
    case 'reward':
      return { ...program, rewards: applyRewardOp(program.rewards || [], op) };
    case 'perk':
      if (indexOfId(program.rewards, op.id) >= 0 && Number.isInteger(op.index) && op.index >= (program.tiers || []).length) {
        fail('unknown_item');
      }
      return { ...program, rewards: applyRewardOp(program.rewards || [], op) };
    case 'tier':
      return { ...program, tiers: applyTierOp(program.tiers || [], op) };
    case 'referral':
      return { ...program, referralConfig: applyReferralOp(program.referralConfig, op) };
    default:
      return fail('invalid_op');
  }
}
