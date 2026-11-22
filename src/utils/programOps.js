// ════════════════════════════════════════════════════════════════════
// Program operations — the edits a brand makes from its client portal
// ════════════════════════════════════════════════════════════════════
//
// An op sets one whitelisted field of the program, or adds / removes an item:
//   { kind: 'mission', id, field: 'enabled' | 'basePoints', value }
//   { kind: 'mission', field: 'add', list: 'missions' | 'customMissions', value: { …MISSION_ADD_FIELDS } }
//   { kind: 'mission', id, field: 'remove' }
//   { kind: 'reward',  id, field: 'pointsBase' | 'expirationDays' | 'minPurchase', value }
//   { kind: 'reward',  field: 'add', value: { …REWARD_ADD_FIELDS } }     (points reward or VIP perk)
//   { kind: 'reward',  id, field: 'remove' }
//   { kind: 'perk',    id, index, field: 'assigned', value }      (perk in tier `index`)
//   { kind: 'tier',    index, field: 'spendThreshold' | 'orderThreshold' | 'pointsMultiplier', value }
//   { kind: 'tier',    index, field: 'add', value: { …TIER_ADD_FIELDS } }   (index = current tier count)
//   { kind: 'tier',    index, name, field: 'remove' }
//   { kind: 'referral', field: 'patch', value: { …referral fields } }
//   { kind: 'config', field: <CONFIG_FIELDS key>, value }        (setup, points and tier settings)
//   { kind: 'settings', field: 'earnRate', value: 1 | 5 | 10 | null }   (null: follows the AOV)
// The client_edit SQL function (supabase/migrations/20261111000000_client_config.sql)
// applies the same ops, with the same checks, to the saved program and to its
// published view; the CSM's open wizard replays them from the activity feed.
// Values are stored like the program stores them (points on the 1 pt/€ grid).

export const MIN_TIERS = 2;
export const MAX_TIERS = 8;

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

// Fields of the items a brand adds: 'id', 'text:min:max' (characters),
// 'number:min:max', 'boolean', 'enum:a|b', 'booleans' (up to 50).
export const MISSION_ADD_FIELDS = {
  id: 'id', icon: 'text:0:16', nameFr: 'text:1:120', nameEn: 'text:0:120', category: 'text:0:40',
  basePoints: 'number:0:1000000', enabled: 'boolean', isPurchaseMission: 'boolean',
};
export const REWARD_TYPES_ADDABLE = ['free_delivery', 'promo_percent', 'gift_voucher', 'free_product', 'experience', 'early_access', 'birthday', 'custom'];
export const REWARD_ADD_FIELDS = {
  id: 'id', type: `enum:${REWARD_TYPES_ADDABLE.join('|')}`, nameFr: 'text:1:120', nameEn: 'text:0:120',
  rewardUsage: 'enum:burn|perk', pointsBase: 'number:0:1000000', expirationDays: 'number:0:3650',
  minPurchase: 'number:0:1000000', minPurchaseAuto: 'boolean', assignedTiers: 'booleans',
};
export const TIER_ADD_FIELDS = {
  name: 'text:1:60', color: 'text:0:20', spendThreshold: 'number:0:1000000000',
  orderThreshold: 'number:0:1000000000', pointsMultiplier: 'number:1:10',
};
// Configuration the brand edits: its setup answers, points and tier settings
// (never the AOV nor the margin).
export const CONFIG_FIELDS = {
  cms: 'enum:shopify|shopify_plus|prestashop',
  crm: 'enum:klaviyo|brevo|omnisend|braze|splio|hubspot|insider|connectif|activecampaign|none|other',
  international: 'boolean',
  multiLanguage: 'boolean',
  multiCurrency: 'boolean',
  physicalStore: 'boolean',
  posSystem: 'enum:shopify_pos|cegid|other',
  pointsExpire: 'boolean',
  expirationMonths: 'integer:1:120',
  expirationType: 'enum:rolling|fixed',
  tiersExpire: 'boolean',
  tierExpirationMonths: 'integer:1:120',
  tierExpirationType: 'enum:rolling|fixed',
  tierBasis: 'enum:spend|orders|points',
};
export const EARN_RATES = [1, 5, 10];

const REQUIRED = {
  mission: ['id', 'nameFr', 'basePoints', 'enabled'],
  reward: ['id', 'type', 'nameFr', 'rewardUsage', 'pointsBase', 'assignedTiers'],
  tier: ['name'],
};

const RANGES = {
  points: [0, 1_000_000],
  money: [0, 1_000_000],
  days: [0, 3650],
  threshold: [0, 1_000_000_000],
  multiplier: [1, 10],
  amount: [0, 1000],
};

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const fail = message => { throw new Error(message); };

function requireNumberIn(value, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail('invalid_value');
  return value;
}

const requireNumber = (value, range) => requireNumberIn(value, ...RANGES[range]);

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

function checkValue(spec, value) {
  const [type, a, b] = spec.split(':');
  if (type === 'id') {
    if (typeof value !== 'string' || !ID_PATTERN.test(value)) fail('invalid_value');
  } else if (type === 'text') {
    if (typeof value !== 'string') fail('invalid_value');
    const length = [...value].length; // characters, as char_length in SQL
    if (length < Number(a) || length > Number(b)) fail('invalid_value');
  } else if (type === 'number') {
    requireNumberIn(value, Number(a), Number(b));
  } else if (type === 'integer') {
    requireNumberIn(value, Number(a), Number(b));
    if (!Number.isInteger(value)) fail('invalid_value');
  } else if (type === 'boolean') {
    requireBoolean(value);
  } else if (type === 'enum') {
    if (!a.split('|').includes(value)) fail('invalid_value');
  } else if (type === 'booleans') {
    if (!Array.isArray(value) || value.length > 50 || value.some(v => typeof v !== 'boolean')) fail('invalid_value');
  }
  return value;
}

// A new item: an object with known fields only, the required ones present.
function checkItem(value, spec, required) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid_op');
  Object.keys(value).forEach(key => { if (!(key in spec)) fail('invalid_op'); });
  required.forEach(key => { if (!(key in value)) fail('invalid_op'); });
  Object.entries(value).forEach(([key, v]) => checkValue(spec[key], v));
  return { ...value };
}

const indexOfId = (list, id) => (list || []).findIndex(item => item.id === id);

function setAt(list, index, patch) {
  return list.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

const isTierIndex = (index, tiers) => Number.isInteger(index) && index >= 0 && index < tiers.length;

// assignedTiers with `length` entries (missing ones off).
const sized = (assigned, length) => Array.from({ length }, (_, i) => assigned?.[i] ?? false);

// ── Slice-level set ops (fields of an existing item) ──
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
  if (!isTierIndex(op.index, tiers)) fail('unknown_item');
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

// ── Whole-program ops ──
function missionOp(program, op) {
  const missions = program.missions || [];
  const custom = program.customMissions || [];
  if (op.field === 'add') {
    if (op.list !== 'missions' && op.list !== 'customMissions') fail('invalid_op');
    const item = checkItem(op.value, MISSION_ADD_FIELDS, REQUIRED.mission);
    if (indexOfId(missions, item.id) >= 0 || indexOfId(custom, item.id) >= 0) fail('duplicate_item');
    return { ...program, [op.list]: [...(program[op.list] || []), item] };
  }
  const inMissions = indexOfId(missions, op.id) >= 0;
  if (!inMissions && indexOfId(custom, op.id) < 0) fail('unknown_item');
  const list = inMissions ? 'missions' : 'customMissions';
  if (op.field === 'remove') return { ...program, [list]: program[list].filter(m => m.id !== op.id) };
  return { ...program, [list]: applyMissionOp(program[list], op) };
}

function rewardOp(program, op) {
  const rewards = program.rewards || [];
  if (op.field === 'add') {
    const item = checkItem(op.value, REWARD_ADD_FIELDS, REQUIRED.reward);
    if (indexOfId(rewards, item.id) >= 0) fail('duplicate_item');
    item.assignedTiers = sized(item.assignedTiers, (program.tiers || []).length);
    return { ...program, rewards: [...rewards, item] };
  }
  if (op.field === 'remove') {
    if (indexOfId(rewards, op.id) < 0) fail('unknown_item');
    return { ...program, rewards: rewards.filter(r => r.id !== op.id) };
  }
  return { ...program, rewards: applyRewardOp(rewards, op) };
}

function tierOp(program, op) {
  const tiers = program.tiers || [];
  const rewards = program.rewards || [];
  if (op.field === 'add') {
    // Added last: index is the tier count the brand saw.
    if (op.index !== tiers.length) fail('conflict');
    if (tiers.length >= MAX_TIERS) fail('invalid_op');
    const item = checkItem(op.value, TIER_ADD_FIELDS, REQUIRED.tier);
    const n = tiers.length;
    return {
      ...program,
      tiers: [...tiers, item],
      // The new top tier keeps what the tier below gives.
      rewards: rewards.map(r => {
        const assigned = sized(r.assignedTiers, n);
        return { ...r, assignedTiers: [...assigned, n > 0 ? assigned[n - 1] : true] };
      }),
    };
  }
  if (op.field === 'remove') {
    if (!isTierIndex(op.index, tiers) || tiers[op.index].name !== op.name) fail('unknown_item');
    if (tiers.length <= MIN_TIERS) fail('invalid_op');
    return {
      ...program,
      tiers: tiers.filter((_, i) => i !== op.index),
      rewards: rewards.map(r => (Array.isArray(r.assignedTiers) && r.assignedTiers.length > op.index
        ? { ...r, assignedTiers: r.assignedTiers.filter((_, i) => i !== op.index) }
        : r)),
    };
  }
  return { ...program, tiers: applyTierOp(tiers, op) };
}

function configOp(program, op) {
  if (!Object.hasOwn(CONFIG_FIELDS, op.field)) fail('invalid_op');
  checkValue(CONFIG_FIELDS[op.field], op.value);
  // Points tiers need a points program.
  if (op.field === 'tierBasis' && op.value === 'points' && program.config?.hasMissions !== true) fail('invalid_value');
  return { ...program, config: { ...(program.config || {}), [op.field]: op.value } };
}

function settingsOp(program, op) {
  if (op.field !== 'earnRate') fail('invalid_op');
  const settings = program.settings || {};
  if (op.value === null || op.value === undefined) return { ...program, settings: { ...settings, earnRateManual: false } };
  if (!EARN_RATES.includes(op.value)) fail('invalid_value');
  return { ...program, settings: { ...settings, earnRate: op.value, earnRateManual: true } };
}

export function applyProgramOp(program, op) {
  switch (op?.kind) {
    case 'mission':
      return missionOp(program, op);
    case 'reward':
      return rewardOp(program, op);
    case 'perk':
      if (indexOfId(program.rewards, op.id) >= 0 && Number.isInteger(op.index) && op.index >= (program.tiers || []).length) {
        fail('unknown_item');
      }
      return { ...program, rewards: applyRewardOp(program.rewards || [], op) };
    case 'tier':
      return tierOp(program, op);
    case 'referral':
      return { ...program, referralConfig: applyReferralOp(program.referralConfig, op) };
    case 'config':
      return configOp(program, op);
    case 'settings':
      return settingsOp(program, op);
    default:
      return fail('invalid_op');
  }
}

// Replays ops in order; one that no longer applies (item removed meanwhile) is skipped.
export function replayProgramOps(program, ops) {
  return ops.reduce((p, op) => { try { return applyProgramOp(p, op); } catch { return p; } }, program);
}

// Activity times: PostgREST timestamps, compared to the microsecond.
export function isLaterThan(at, since) {
  if (!since) return true;
  const diff = Date.parse(at) - Date.parse(since);
  return diff !== 0 ? diff > 0 : at > since;
}
