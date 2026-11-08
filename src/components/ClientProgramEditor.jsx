import { useState, useId, cloneElement } from 'react';
import { MessageSquare, Plus, Trash2, X } from 'lucide-react';
import { pointsModel, missionPoints, basePointsFromPoints } from '../utils/pointsModel';
import { rewardPointsCost, rewardBaseFromPoints, rewardMinPurchase, isBurnReward, isPerkReward } from '../utils/rewardModel';
import { resolveReferral, formatReferralReward } from '../utils/referralModel';
import { thresholdForBasis } from '../utils/calculations';
import { MIN_TIERS, MAX_TIERS } from '../utils/programOps';
import { MISSION_CATALOG, MISSION_CATEGORIES } from '../data/missionCatalog';
import { DEFAULT_TIER_COLORS, DEFAULT_TIER_NAMES_FR, DEFAULT_TIER_NAMES_EN, REWARD_TYPES } from '../data/defaults';
import { CMS_OPTIONS, CRM_OPTIONS, CRM_NONE, CRM_OTHER, POS_OPTIONS, cmsLabel, crmLabel, posLabel } from '../data/setupOptions';
import { EARN_RATES } from '../utils/programOps';
import { defaultEarnRate } from '../utils/pointsModel';

// ════════════════════════════════════════════════════════════════════
// Client program editor — the brand edits its published program
// ════════════════════════════════════════════════════════════════════
// Each change is one op (utils/programOps.js) sent with readable labels for
// the CSM's activity feed. Numbers are saved when the field is left (or on
// Enter); switches, additions and removals right away.

const FR = {
  points: 'Programme de points', missions: 'Missions', mission: 'Mission', active: 'Activée', pts: 'Points',
  rewards: 'Récompenses en points', reward: 'Récompense', price: 'Prix en points', expiry: 'Expiration',
  minPurchase: 'Achat minimum', tiersCol: 'Paliers', days: 'jours', all: 'tous', noMinimum: 'aucun',
  referral: 'Parrainage', referrer: 'Parrain', referee: 'Filleul', rewardAmount: 'Récompense', type: 'Type',
  vip: 'Programme VIP', threshold: 'Seuil', multiplier: 'Multiplicateur', perks: 'Avantages du palier',
  perk: 'Avantage', newPerk: 'Nouveau', on: 'Activé', off: 'Désactivé', yes: 'Oui', no: 'Non',
  perPurchase: 'par € dépensé', orders: 'commandes', comment: 'Commenter',
  hint: 'Modifiez les valeurs, ajoutez ou supprimez des éléments : tout est enregistré aussitôt (un chiffre, dès que vous quittez le champ) et votre CSM Loyoly en est informé.',
  add: 'Ajouter', cancel: 'Annuler', remove: 'Supprimer', name: 'Nom',
  addMission: 'Ajouter une mission', pickMission: 'Choisir une mission…', customMission: 'Mission personnalisée…',
  missionAdded: 'Mission ajoutée', missionRemoved: 'Mission supprimée',
  confirmMission: n => `Supprimer la mission « ${n} » ?`,
  addReward: 'Ajouter une récompense', rewardAdded: 'Récompense ajoutée', rewardRemoved: 'Récompense supprimée',
  confirmReward: n => `Supprimer la récompense « ${n} » ?`, noRewards: 'Aucune récompense en points pour le moment.',
  addPerk: 'Ajouter un avantage', fromTier: 'À partir du palier', perkAdded: 'Avantage ajouté', perkRemoved: 'Avantage supprimé',
  confirmPerk: n => `Supprimer l'avantage « ${n} » de tous les paliers ?`, from: n => `dès ${n}`,
  addTier: 'Ajouter un palier', tierAdded: 'Palier ajouté', tierRemoved: 'Palier supprimé',
  confirmTier: n => `Supprimer le palier « ${n} » ?`, thresholdAbove: n => `Le seuil doit dépasser celui de ${n}.`,
  tierLimits: `De ${MIN_TIERS} à ${MAX_TIERS} paliers.`,
  setup: 'Informations de setup', setupHint: 'Ces réponses adaptent votre checklist de lancement.',
  international: 'International', languages: 'Plusieurs langues ?', currencies: 'Plusieurs devises ?',
  store: 'Boutique physique', pos: 'Caisse', choose: '— Choisir —', noCrm: 'Aucun', otherCrm: 'Autre',
  earnRate: 'Points gagnés par € dépensé', auto: rate => `Automatique (${rate} pt${rate > 1 ? 's' : ''}/€)`,
  pointsExpire: 'Expiration des points', expiryDelay: 'Délai', months: 'mois', rolling: 'Glissant', fixed: 'Fixe',
  tierBasis: 'Base des paliers', basis: { spend: 'Dépenses (€)', orders: 'Commandes', points: 'Points' },
  tiersExpire: 'Réévaluation des paliers', every: 'Tous les',
};
const EN = {
  points: 'Points program', missions: 'Missions', mission: 'Mission', active: 'Active', pts: 'Points',
  rewards: 'Points rewards', reward: 'Reward', price: 'Points price', expiry: 'Expiry',
  minPurchase: 'Min purchase', tiersCol: 'Tiers', days: 'days', all: 'all', noMinimum: 'none',
  referral: 'Referral', referrer: 'Referrer', referee: 'Referee', rewardAmount: 'Reward', type: 'Type',
  vip: 'VIP program', threshold: 'Threshold', multiplier: 'Multiplier', perks: 'Tier perks',
  perk: 'Perk', newPerk: 'New', on: 'On', off: 'Off', yes: 'Yes', no: 'No',
  perPurchase: 'per € spent', orders: 'orders', comment: 'Comment',
  hint: 'Edit the values, add or remove items: everything is saved at once (a number, as soon as you leave the field) and your Loyoly CSM is notified.',
  add: 'Add', cancel: 'Cancel', remove: 'Remove', name: 'Name',
  addMission: 'Add a mission', pickMission: 'Choose a mission…', customMission: 'Custom mission…',
  missionAdded: 'Mission added', missionRemoved: 'Mission removed',
  confirmMission: n => `Remove the mission "${n}"?`,
  addReward: 'Add a reward', rewardAdded: 'Reward added', rewardRemoved: 'Reward removed',
  confirmReward: n => `Remove the reward "${n}"?`, noRewards: 'No points reward yet.',
  addPerk: 'Add a perk', fromTier: 'From tier', perkAdded: 'Perk added', perkRemoved: 'Perk removed',
  confirmPerk: n => `Remove the perk "${n}" from every tier?`, from: n => `from ${n}`,
  addTier: 'Add a tier', tierAdded: 'Tier added', tierRemoved: 'Tier removed',
  confirmTier: n => `Remove the tier "${n}"?`, thresholdAbove: n => `The threshold must be above ${n}'s.`,
  tierLimits: `${MIN_TIERS} to ${MAX_TIERS} tiers.`,
  setup: 'Setup information', setupHint: 'These answers shape your launch checklist.',
  international: 'International', languages: 'Several languages?', currencies: 'Several currencies?',
  store: 'Physical store', pos: 'POS system', choose: '— Choose —', noCrm: 'None', otherCrm: 'Other',
  earnRate: 'Points earned per € spent', auto: rate => `Automatic (${rate} pt${rate > 1 ? 's' : ''}/€)`,
  pointsExpire: 'Points expiration', expiryDelay: 'Delay', months: 'months', rolling: 'Rolling', fixed: 'Fixed',
  tierBasis: 'Tier basis', basis: { spend: 'Spend (€)', orders: 'Orders', points: 'Points' },
  tiersExpire: 'Tier reassessment', every: 'Every',
};

const BURN_TYPES = ['gift_voucher', 'promo_percent', 'free_delivery', 'free_product', 'custom'];
const PERK_TYPES = ['free_delivery', 'birthday', 'gift_voucher', 'promo_percent', 'early_access', 'free_product', 'experience', 'custom'];
const CUSTOM = '__custom';

const fmt = (n, lang) => Number(n || 0).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 2 });
const nameOf = (item, lang) => (lang === 'fr' ? item.nameFr : item.nameEn) || item.nameFr || item.nameEn || '';
const uid = prefix => `${prefix}_${Array.from(crypto.getRandomValues(new Uint8Array(5)), b => b.toString(16).padStart(2, '0')).join('')}`;
const typeLabel = (id, lang) => {
  const type = REWARD_TYPES.find(r => r.id === id);
  return type ? `${type.icon} ${lang === 'fr' ? type.nameFr : type.nameEn}` : id;
};

export default function ClientProgramEditor({ lang, page, program, setup, sections, onEdit, onComment, openCountOf, emptyText }) {
  const t = lang === 'fr' ? FR : EN;
  const ctx = { t, lang, program, onEdit, onComment, openCountOf, emptyText };
  const facts = key => sections.find(s => s.key === key)?.facts;
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-[#8A7D6B]">{t.hint}</p>
      {page === 'config' && <ConfigEditor {...ctx} setup={setup} />}
      {page === 'missions' && <MissionsEditor {...ctx} pointsFacts={facts('points')} note={sections.find(s => s.note)?.note} />}
      {page === 'rewards' && <RewardsEditor {...ctx} />}
      {page === 'referral' && <ReferralEditor {...ctx} />}
      {page === 'tiers' && <TiersEditor {...ctx} vipFacts={facts('vip')} />}
    </div>
  );
}

// ── Building blocks ──────────────────────────────────────────────────
function NumberField({ value, onCommit, step = 1, min = 0, max, suffix, label, width = 'w-20', integer = false }) {
  const [draft, setDraft] = useState(String(value ?? ''));
  const commit = () => {
    const next = Number(String(draft).replace(',', '.'));
    if (draft === '' || !Number.isFinite(next) || next < min || (max !== undefined && next > max) || (integer && !Number.isInteger(next))) {
      setDraft(String(value ?? ''));
      return;
    }
    if (next !== value) onCommit(next);
  };
  return (
    <span className="inline-flex items-center gap-1">
      <input type="number" inputMode="decimal" step={step} min={min} max={max} value={draft} aria-label={label}
        onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setDraft(String(value ?? '')); }}
        className={`${width} px-2 py-1 text-[13px] text-center rounded-lg`} />
      {suffix && <span className="text-[12px] text-[#8A7D6B]">{suffix}</span>}
    </span>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative inline-block w-8 h-[18px] p-0 rounded-full transition-colors shrink-0 ${checked ? 'bg-primary' : 'bg-[#D9D5CB]'}`}>
      <span className="absolute left-0 top-[3px] w-3 h-3 rounded-full bg-white shadow-sm transition-transform"
        style={{ transform: checked ? 'translateX(17px)' : 'translateX(3px)' }} />
    </button>
  );
}

function CommentButton({ t, refId, label, onComment, openCountOf }) {
  const open = openCountOf(refId);
  return (
    <button type="button" onClick={() => onComment(refId)} title={t.comment} aria-label={`${t.comment} ${label}`}
      className="inline-flex items-center gap-1 text-[12px] text-[#8A7D6B] hover:text-primary">
      <MessageSquare size={13} /> {open > 0 && <span className="text-primary font-semibold">{open}</span>}
    </button>
  );
}

// Asks first; `className` lets a list show it on hover only.
function RemoveButton({ t, label, confirmText, onRemove, className = '' }) {
  return (
    <button type="button" title={t.remove} aria-label={`${t.remove} ${label}`}
      onClick={() => { if (window.confirm(confirmText)) onRemove(); }}
      className={`inline-flex items-center text-[#B0A595] hover:text-red-600 ${className}`}>
      <Trash2 size={13} />
    </button>
  );
}

function AddButton({ label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="btn-secondary text-[13px]">
      <Plus size={14} /> {label}
    </button>
  );
}

function AddForm({ t, title, canSubmit, onSubmit, onCancel, children, error }) {
  return (
    <form aria-label={title} onSubmit={e => { e.preventDefault(); if (canSubmit) onSubmit(); }}
      className="rounded-[12px] border border-primary/30 bg-[#F7F9FF] p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[#2B251F]">{title}</span>
        <button type="button" onClick={onCancel} aria-label={t.cancel} className="text-[#8A7D6B] hover:text-[#2B251F]"><X size={14} /></button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary">{t.cancel}</button>
        <button type="submit" disabled={!canSubmit} className="btn-primary">{t.add}</button>
      </div>
    </form>
  );
}

// One labelled input or select (the label names the field alone).
function FormField({ label, children }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[12px] font-medium text-[#645648]">{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}

const inputClass = 'px-2 py-1.5 text-[13px] rounded-lg';
const isNumberIn = (text, min, max) => text !== '' && Number.isFinite(Number(text)) && Number(text) >= min && Number(text) <= max;

function Facts({ facts }) {
  if (!facts?.length) return null;
  return (
    <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[max-content_1fr] text-[13px] mb-3">
      {facts.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-medium text-[#645648]">{label}</dt>
          <dd className="text-[#2B251F]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const Card = ({ title, children }) => (
  <section className="card" style={{ padding: 18 }}>
    <h2 className="text-[16px] font-bold text-[#2B251F] mb-3">{title}</h2>
    {children}
  </section>
);

const th = 'px-2 py-1.5 font-semibold text-left';
const td = 'px-2 py-2 align-middle';

// ── Configuration ────────────────────────────────────────────────────
// Setup answers come live from the saved program (`setup`, as the checklist
// reads them); the points and tier settings from the published program.
const SETUP_KEYS = ['cms', 'crm', 'international', 'multiLanguage', 'multiCurrency', 'physicalStore', 'posSystem'];

function Choice({ label, options, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button key={String(key)} type="button" onClick={() => key !== value && onChange(key)} aria-pressed={key === value}
          className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all ${key === value ? 'bg-primary text-white' : 'bg-[#EEEDE6] text-[#645648] hover:bg-[#E5E1D8]'}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

const ConfigRow = ({ label, children, sub }) => (
  <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2 ${sub ? 'pl-4 border-l-2 border-[#E5E1D8] ml-1' : ''}`}>
    <span className={`text-[13px] ${sub ? 'text-[#645648] min-w-[178px]' : 'font-medium text-[#2B251F] min-w-[200px]'}`}>{label}</span>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);

function ConfigEditor({ t, lang, program, setup, onEdit }) {
  const config = { ...(program.config || {}), ...Object.fromEntries(SETUP_KEYS.map(k => [k, setup?.[k] ?? program.config?.[k] ?? null])) };
  const settings = program.settings || {};
  const yesNo = v => (v === true ? t.yes : v === false ? t.no : '—');
  const yesNoOptions = [[true, t.yes], [false, t.no]];
  const typeText = v => (v === 'fixed' ? t.fixed : t.rolling);
  const set = (card, label, field, value, show, current = config[field]) => onEdit({
    op: { kind: 'config', field, value }, itemLabel: label, fieldLabel: card,
    oldValue: show(current), newValue: show(value),
  });
  const autoRate = defaultEarnRate(settings.aov);
  const rateText = (manual, rate) => (manual ? `${rate} pt${rate > 1 ? 's' : ''}/€` : t.auto(autoRate));
  const rateValue = settings.earnRateManual ? settings.earnRate : 'auto';
  const basisOptions = ['spend', 'orders', ...(config.hasMissions ? ['points'] : [])].map(b => [b, t.basis[b]]);

  return (
    <>
      <Card title={t.setup}>
        <p className="text-[12px] text-[#8A7D6B] -mt-2 mb-1">{t.setupHint}</p>
        <ConfigRow label="CMS">
          <Choice label="CMS" value={config.cms} options={CMS_OPTIONS.map(o => [o.id, o.label])}
            onChange={v => set(t.setup, 'CMS', 'cms', v, cmsLabel)} />
        </ConfigRow>
        <ConfigRow label="CRM">
          <select value={config.crm ?? ''} aria-label="CRM" className="px-2 text-[13px] min-w-[200px]" style={{ height: 32, borderRadius: 8 }}
            onChange={e => e.target.value && set(t.setup, 'CRM', 'crm', e.target.value, v => crmLabel(v, lang) ?? '—')}>
            <option value="" disabled>{t.choose}</option>
            {CRM_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            <option value={CRM_NONE}>{t.noCrm}</option>
            <option value={CRM_OTHER}>{t.otherCrm}</option>
          </select>
        </ConfigRow>
        <ConfigRow label={t.international}>
          <Choice label={t.international} value={config.international} options={yesNoOptions}
            onChange={v => set(t.setup, t.international, 'international', v, yesNo)} />
        </ConfigRow>
        {config.international && (
          <>
            <ConfigRow label={t.languages} sub>
              <Choice label={t.languages} value={config.multiLanguage} options={yesNoOptions}
                onChange={v => set(t.setup, t.languages, 'multiLanguage', v, yesNo)} />
            </ConfigRow>
            <ConfigRow label={t.currencies} sub>
              <Choice label={t.currencies} value={config.multiCurrency} options={yesNoOptions}
                onChange={v => set(t.setup, t.currencies, 'multiCurrency', v, yesNo)} />
            </ConfigRow>
          </>
        )}
        <ConfigRow label={t.store}>
          <Choice label={t.store} value={config.physicalStore} options={yesNoOptions}
            onChange={v => set(t.setup, t.store, 'physicalStore', v, yesNo)} />
        </ConfigRow>
        {config.physicalStore && (
          <ConfigRow label={t.pos} sub>
            <Choice label={t.pos} value={config.posSystem} options={POS_OPTIONS.map(o => [o.id, posLabel(o.id, lang)])}
              onChange={v => set(t.setup, t.pos, 'posSystem', v, x => posLabel(x, lang) ?? '—')} />
          </ConfigRow>
        )}
      </Card>

      {config.hasMissions && (
        <Card title={t.points}>
          <ConfigRow label={t.earnRate}>
            <Choice label={t.earnRate} value={rateValue}
              options={[['auto', t.auto(autoRate)], ...EARN_RATES.map(r => [r, `${r} pt${r > 1 ? 's' : ''}/€`])]}
              onChange={v => onEdit({
                op: { kind: 'settings', field: 'earnRate', value: v === 'auto' ? null : v }, itemLabel: t.earnRate, fieldLabel: t.points,
                oldValue: rateText(settings.earnRateManual, settings.earnRate), newValue: rateText(v !== 'auto', v),
              })} />
          </ConfigRow>
          <ConfigRow label={t.pointsExpire}>
            <Choice label={t.pointsExpire} value={config.pointsExpire !== false} options={yesNoOptions}
              onChange={v => set(t.points, t.pointsExpire, 'pointsExpire', v, yesNo, config.pointsExpire !== false)} />
          </ConfigRow>
          {config.pointsExpire !== false && (
            <ConfigRow label={t.expiryDelay} sub>
              <NumberField key={config.expirationMonths ?? 12} value={config.expirationMonths ?? 12} min={1} max={120} integer width="w-16"
                suffix={t.months} label={`${t.expiryDelay} ${t.pointsExpire}`}
                onCommit={v => set(t.points, `${t.pointsExpire} — ${t.expiryDelay}`, 'expirationMonths', v, m => `${m ?? 12} ${t.months}`)} />
              <Choice label={`${t.pointsExpire} — type`} value={config.expirationType || 'rolling'} options={[['rolling', t.rolling], ['fixed', t.fixed]]}
                onChange={v => set(t.points, t.pointsExpire, 'expirationType', v, typeText)} />
            </ConfigRow>
          )}
        </Card>
      )}

      {config.hasTiers && (
        <Card title={t.vip}>
          <ConfigRow label={t.tierBasis}>
            <Choice label={t.tierBasis} value={config.tierBasis || 'spend'} options={basisOptions}
              onChange={v => set(t.vip, t.tierBasis, 'tierBasis', v, b => t.basis[b || 'spend'])} />
          </ConfigRow>
          <ConfigRow label={t.tiersExpire}>
            <Choice label={t.tiersExpire} value={config.tiersExpire !== false} options={yesNoOptions}
              onChange={v => set(t.vip, t.tiersExpire, 'tiersExpire', v, yesNo, config.tiersExpire !== false)} />
          </ConfigRow>
          {config.tiersExpire !== false && (
            <ConfigRow label={t.every} sub>
              <NumberField key={config.tierExpirationMonths ?? 12} value={config.tierExpirationMonths ?? 12} min={1} max={120} integer width="w-16"
                suffix={t.months} label={`${t.every} ${t.tiersExpire}`}
                onCommit={v => set(t.vip, `${t.tiersExpire} — ${t.every}`, 'tierExpirationMonths', v, m => `${m ?? 12} ${t.months}`)} />
              <Choice label={`${t.tiersExpire} — type`} value={config.tierExpirationType || 'rolling'} options={[['rolling', t.rolling], ['fixed', t.fixed]]}
                onChange={v => set(t.vip, t.tiersExpire, 'tierExpirationType', v, typeText)} />
            </ConfigRow>
          )}
        </Card>
      )}
    </>
  );
}

// ── Missions ─────────────────────────────────────────────────────────
function MissionsEditor({ t, lang, program, onEdit, onComment, openCountOf, pointsFacts, note, emptyText }) {
  const [adding, setAdding] = useState(false);
  const { settings } = program;
  if (!program.config?.hasMissions) return <div className="card text-[13px] text-[#8A7D6B]">{note || emptyText}</div>;
  const { earnRate } = pointsModel(settings);
  const missions = [...(program.missions || []), ...(program.customMissions || [])];
  const yesNo = v => (v ? t.yes : t.no);
  const pointsText = m => (m.isPurchaseMission ? `${fmt(earnRate, lang)} pt/€` : `${fmt(missionPoints(m, settings), lang)} pts`);
  return (
    <>
      {pointsFacts && <Card title={t.points}><Facts facts={pointsFacts} /></Card>}
      <Card title={t.missions}>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-[#8A7D6B]">
                <th className={th}>{t.active}</th><th className={th}>{t.mission}</th><th className={th}>{t.pts}</th><th className={th} />
              </tr>
            </thead>
            <tbody>
              {missions.map(m => {
                const name = nameOf(m, lang);
                const points = missionPoints(m, settings);
                return (
                  <tr key={m.id} className={`border-t border-[#E5E1D8] ${m.enabled ? '' : 'opacity-60'}`} data-item={`mission:${m.id}`}>
                    <td className={td}>
                      <Switch checked={!!m.enabled} label={`${t.active} ${name}`}
                        onChange={v => onEdit({ op: { kind: 'mission', id: m.id, field: 'enabled', value: v }, itemLabel: name, fieldLabel: t.active, oldValue: yesNo(m.enabled), newValue: yesNo(v) })} />
                    </td>
                    <td className={`${td} font-medium text-[#2B251F]`}>{m.icon ? `${m.icon} ` : ''}{name}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {m.isPurchaseMission
                        ? <span className="text-[#52473C]">{fmt(earnRate, lang)} {earnRate > 1 ? 'pts' : 'pt'} {t.perPurchase}</span>
                        : <NumberField key={points} value={points} max={1000000} suffix="pts" label={`${t.pts} ${name}`}
                            onCommit={v => onEdit({ op: { kind: 'mission', id: m.id, field: 'basePoints', value: basePointsFromPoints(v, settings) }, itemLabel: name, fieldLabel: t.pts, oldValue: `${fmt(points, lang)} pts`, newValue: `${fmt(v, lang)} pts` })} />}
                    </td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      <span className="inline-flex items-center gap-3">
                        {m.enabled && <CommentButton t={t} refId={`mission:${m.id}`} label={name} onComment={onComment} openCountOf={openCountOf} />}
                        <RemoveButton t={t} label={name} confirmText={t.confirmMission(name)}
                          onRemove={() => onEdit({ op: { kind: 'mission', id: m.id, field: 'remove' }, itemLabel: name, fieldLabel: t.missionRemoved, oldValue: pointsText(m), newValue: '' })} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          {adding
            ? <AddMissionForm t={t} lang={lang} program={program} earnRate={earnRate} onCancel={() => setAdding(false)}
                onAdd={edit => { onEdit(edit); setAdding(false); }} />
            : <AddButton label={t.addMission} onClick={() => setAdding(true)} />}
        </div>
      </Card>
    </>
  );
}

// A mission of the Loyoly catalog the program does not have yet, or a custom one.
function AddMissionForm({ t, lang, program, earnRate, onAdd, onCancel }) {
  const taken = new Set([...(program.missions || []), ...(program.customMissions || [])].map(m => m.id));
  const available = MISSION_CATALOG.filter(m => !taken.has(m.id));
  const [choice, setChoice] = useState('');
  const [name, setName] = useState('');
  const [points, setPoints] = useState('');
  const catalog = available.find(m => m.id === choice);
  const isCustom = choice === CUSTOM;
  const purchase = !!catalog?.isPurchaseMission;
  const canSubmit = !!choice && (!isCustom || name.trim() !== '') && (purchase || isNumberIn(points, 0, 1000000));

  const pick = id => {
    setChoice(id);
    const item = available.find(m => m.id === id);
    setPoints(String(Math.round((item ? item.basePoints : 20) * earnRate)));
  };
  const submit = () => {
    const value = isCustom
      ? { id: uid('m'), nameFr: name.trim(), nameEn: name.trim(), basePoints: Number(points) / earnRate, enabled: true }
      : {
        id: catalog.id, icon: catalog.icon, nameFr: catalog.nameFr, nameEn: catalog.nameEn, category: catalog.category,
        basePoints: purchase ? catalog.basePoints : Number(points) / earnRate, enabled: true,
        ...(purchase ? { isPurchaseMission: true } : {}),
      };
    onAdd({
      op: { kind: 'mission', field: 'add', list: isCustom ? 'customMissions' : 'missions', value },
      itemLabel: isCustom ? name.trim() : nameOf(catalog, lang), fieldLabel: t.missionAdded, oldValue: '',
      newValue: purchase ? `${fmt(earnRate, lang)} pt/€` : `${fmt(Number(points), lang)} pts`,
    });
  };

  return (
    <AddForm t={t} title={t.addMission} canSubmit={canSubmit} onSubmit={submit} onCancel={onCancel}>
      <FormField label={t.mission}>
        <select value={choice} onChange={e => pick(e.target.value)} className={inputClass}>
          <option value="">{t.pickMission}</option>
          {MISSION_CATEGORIES.map(category => {
            const items = available.filter(m => m.category === category.id);
            return items.length > 0 && (
              <optgroup key={category.id} label={lang === 'fr' ? category.labelFr : category.labelEn}>
                {items.map(m => <option key={m.id} value={m.id}>{m.icon} {nameOf(m, lang)}</option>)}
              </optgroup>
            );
          })}
          <option value={CUSTOM}>{t.customMission}</option>
        </select>
      </FormField>
      {!purchase && (
        <FormField label={t.pts}>
          <input type="number" min={0} max={1000000} value={points} onChange={e => setPoints(e.target.value)} className={inputClass} />
        </FormField>
      )}
      {isCustom && (
        <FormField label={t.name}>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={120} className={inputClass} />
        </FormField>
      )}
    </AddForm>
  );
}

// ── Points rewards ───────────────────────────────────────────────────
function RewardsEditor({ t, lang, program, onEdit, onComment, openCountOf, emptyText }) {
  const [adding, setAdding] = useState(false);
  if (!program.config?.hasMissions) return <div className="card text-[13px] text-[#8A7D6B]">{emptyText}</div>;
  const { settings, tiers = [] } = program;
  const rewards = (program.rewards || []).filter(r => isBurnReward(r) && r.assignedTiers?.some(Boolean));
  const tierNames = r => {
    const idxs = (r.assignedTiers || []).map((on, i) => (on ? i : -1)).filter(i => i >= 0 && i < tiers.length);
    return idxs.length === tiers.length ? t.all : idxs.map(i => tiers[i]?.name).join(', ');
  };
  const minText = v => (v > 0 ? `${fmt(v, lang)} €` : t.noMinimum);
  return (
    <Card title={t.rewards}>
      {rewards.length === 0 && <p className="text-[13px] text-[#8A7D6B]">{t.noRewards}</p>}
      {rewards.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-[#8A7D6B]">
                <th className={th}>{t.reward}</th><th className={th}>{t.price}</th><th className={th}>{t.expiry}</th>
                <th className={th}>{t.minPurchase}</th><th className={th}>{t.tiersCol}</th><th className={th} />
              </tr>
            </thead>
            <tbody>
              {rewards.map(r => {
                const name = nameOf(r, lang);
                const price = rewardPointsCost(r, settings);
                const min = rewardMinPurchase(r, settings);
                const expiry = r.expirationDays ?? 90;
                const edit = (field, value, fieldLabel, oldValue, newValue) =>
                  onEdit({ op: { kind: 'reward', id: r.id, field, value }, itemLabel: name, fieldLabel, oldValue, newValue });
                return (
                  <tr key={r.id} className="border-t border-[#E5E1D8]" data-item={`reward:${r.id}`}>
                    <td className={`${td} font-medium text-[#2B251F]`}>{name}</td>
                    <td className={td}>
                      <NumberField key={price} value={price} max={1000000} suffix="pts" label={`${t.price} ${name}`}
                        onCommit={v => edit('pointsBase', rewardBaseFromPoints(v, settings), t.price, `${fmt(price, lang)} pts`, `${fmt(v, lang)} pts`)} />
                    </td>
                    <td className={td}>
                      <NumberField key={expiry} value={expiry} max={3650} suffix={t.days} label={`${t.expiry} ${name}`} width="w-16"
                        onCommit={v => edit('expirationDays', v, t.expiry, `${expiry} ${t.days}`, `${v} ${t.days}`)} />
                    </td>
                    <td className={td}>
                      <NumberField key={min} value={min} max={1000000} suffix="€" label={`${t.minPurchase} ${name}`}
                        onCommit={v => edit('minPurchase', v, t.minPurchase, minText(min), minText(v))} />
                    </td>
                    <td className={`${td} text-[#52473C]`}>{tierNames(r)}</td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      <span className="inline-flex items-center gap-3">
                        <CommentButton t={t} refId={`reward:${r.id}`} label={name} onComment={onComment} openCountOf={openCountOf} />
                        <RemoveButton t={t} label={name} confirmText={t.confirmReward(name)}
                          onRemove={() => onEdit({ op: { kind: 'reward', id: r.id, field: 'remove' }, itemLabel: name, fieldLabel: t.rewardRemoved, oldValue: `${fmt(price, lang)} pts`, newValue: '' })} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3">
        {adding
          ? <AddRewardForm t={t} lang={lang} program={program} usage="burn" onCancel={() => setAdding(false)}
              onAdd={edit => { onEdit(edit); setAdding(false); }} />
          : <AddButton label={t.addReward} onClick={() => setAdding(true)} />}
      </div>
    </Card>
  );
}

// A points reward (all tiers) or a VIP perk (from one tier up).
function AddRewardForm({ t, lang, program, usage, onAdd, onCancel }) {
  const tiers = program.tiers || [];
  const { earnRate } = pointsModel(program.settings);
  const types = usage === 'burn' ? BURN_TYPES : PERK_TYPES;
  const [type, setType] = useState(types[0]);
  const [name, setName] = useState('');
  const [points, setPoints] = useState('');
  const [from, setFrom] = useState(0);
  const canSubmit = name.trim() !== '' && (usage !== 'burn' || isNumberIn(points, 0, 1000000));

  const submit = () => {
    const label = name.trim();
    const base = { type, nameFr: label, nameEn: label, expirationDays: 90, minPurchase: 0 };
    if (usage === 'burn') {
      onAdd({
        op: { kind: 'reward', field: 'add', value: { id: uid('r'), ...base, rewardUsage: 'burn', pointsBase: Number(points) / earnRate, minPurchaseAuto: true, assignedTiers: tiers.map(() => true) } },
        itemLabel: label, fieldLabel: t.rewardAdded, oldValue: '', newValue: `${fmt(Number(points), lang)} pts`,
      });
    } else {
      onAdd({
        op: { kind: 'reward', field: 'add', value: { id: uid('p'), ...base, rewardUsage: 'perk', pointsBase: 0, minPurchaseAuto: false, assignedTiers: tiers.map((_, i) => i >= from) } },
        itemLabel: label, fieldLabel: t.perkAdded, oldValue: '', newValue: t.from(tiers[from]?.name),
      });
    }
  };

  return (
    <AddForm t={t} title={usage === 'burn' ? t.addReward : t.addPerk} canSubmit={canSubmit} onSubmit={submit} onCancel={onCancel}>
      <FormField label={t.type}>
        <select value={type} onChange={e => setType(e.target.value)} className={inputClass}>
          {types.map(id => <option key={id} value={id}>{typeLabel(id, lang)}</option>)}
        </select>
      </FormField>
      <FormField label={t.name}>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={120} className={inputClass} />
      </FormField>
      {usage === 'burn' ? (
        <FormField label={t.price}>
          <input type="number" min={0} max={1000000} value={points} onChange={e => setPoints(e.target.value)} className={inputClass} />
        </FormField>
      ) : (
        <FormField label={t.fromTier}>
          <select value={from} onChange={e => setFrom(Number(e.target.value))} className={inputClass}>
            {tiers.map((tier, i) => <option key={i} value={i}>{tier.name}</option>)}
          </select>
        </FormField>
      )}
    </AddForm>
  );
}

// ── Referral ─────────────────────────────────────────────────────────
function ReferralEditor({ t, lang, program, onEdit, onComment, openCountOf, emptyText }) {
  const config = program.referralConfig;
  if (!config?.enabled) return <div className="card text-[13px] text-[#8A7D6B]">{emptyText}</div>;
  const r = resolveReferral(config, program.settings?.aov);
  const minText = v => (v > 0 ? `${fmt(v, lang)} €` : t.noMinimum);
  const amounts = { rewardsAuto: false, referrerType: r.referrerType, referrerValue: r.referrerValue, refereeType: r.refereeType, refereeValue: r.refereeValue };
  const expirations = { expirationsAuto: false, referrerExpirationDays: r.referrerExpirationDays, refereeExpirationDays: r.refereeExpirationDays };
  const patch = (value, itemLabel, fieldLabel, oldValue, newValue) =>
    onEdit({ op: { kind: 'referral', field: 'patch', value }, itemLabel, fieldLabel, oldValue, newValue });

  return (
    <Card title={t.referral}>
      <div className="grid gap-3 sm:grid-cols-2">
        {['referrer', 'referee'].map(side => {
          const label = side === 'referrer' ? t.referrer : t.referee;
          const type = r[`${side}Type`];
          const value = r[`${side}Value`];
          const min = r[`${side}MinPurchase`];
          const days = r[`${side}ExpirationDays`];
          return (
            <div key={side} className="rounded-[12px] border border-[#E5E1D8] bg-white p-4 space-y-3" data-item={`referral:${side}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-[#2B251F]">{label}</h3>
                <CommentButton t={t} refId={`referral:${side}`} label={label} onComment={onComment} openCountOf={openCountOf} />
              </div>
              <Row label={t.rewardAmount}>
                <NumberField key={`${value}-${type}`} value={value} max={1000} label={`${t.rewardAmount} ${label}`}
                  onCommit={v => patch({ ...amounts, [`${side}Value`]: v }, label, t.rewardAmount, formatReferralReward(type, value), formatReferralReward(type, v))} />
                <select value={type} aria-label={`${t.type} ${label}`} className="px-2 py-1 text-[13px] rounded-lg"
                  onChange={e => patch({ ...amounts, [`${side}Type`]: e.target.value }, label, t.rewardAmount, formatReferralReward(type, value), formatReferralReward(e.target.value, value))}>
                  <option value="fixed">€</option>
                  <option value="percent">%</option>
                </select>
              </Row>
              <Row label={t.minPurchase}>
                <NumberField key={min} value={min} max={1000000} suffix="€" label={`${t.minPurchase} ${label}`}
                  onCommit={v => patch({ [`${side}MinPurchaseAuto`]: false, [`${side}MinPurchase`]: v }, label, t.minPurchase, minText(min), minText(v))} />
              </Row>
              <Row label={t.expiry}>
                <NumberField key={days} value={days} max={3650} suffix={t.days} label={`${t.expiry} ${label}`} width="w-16"
                  onCommit={v => patch({ ...expirations, [`${side}ExpirationDays`]: v }, label, t.expiry, `${days} ${t.days}`, `${v} ${t.days}`)} />
              </Row>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const Row = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-[12px] font-medium text-[#645648]">{label}</span>
    <span className="flex items-center gap-1.5">{children}</span>
  </div>
);

// ── VIP tiers: one column each ───────────────────────────────────────
function TiersEditor({ t, lang, program, onEdit, onComment, openCountOf, vipFacts, emptyText }) {
  const [adding, setAdding] = useState(null); // 'perk' | 'tier'
  const { config = {}, settings, tiers = [] } = program;
  if (!config.hasTiers || !tiers.length) return <div className="card text-[13px] text-[#8A7D6B]">{emptyText}</div>;
  const { earnRate } = pointsModel(settings);
  const basis = config.tierBasis || 'spend';
  const unit = basis === 'orders' ? t.orders : basis === 'points' ? 'pts' : '€';
  const perks = (program.rewards || []).filter(isPerkReward);
  const thresholdOf = tier => Math.round(thresholdForBasis(tier, basis, earnRate));
  const thresholdOp = (index, v) => (basis === 'orders'
    ? { kind: 'tier', index, field: 'orderThreshold', value: v }
    : { kind: 'tier', index, field: 'spendThreshold', value: basis === 'points' ? v / earnRate : v });
  const added = edit => { onEdit(edit); setAdding(null); };

  return (
    <Card title={t.vip}>
      <Facts facts={vipFacts} />
      <div className="flex flex-wrap gap-2 mb-3">
        <AddButton label={t.addPerk} onClick={() => setAdding('perk')} />
        {tiers.length < MAX_TIERS && <AddButton label={t.addTier} onClick={() => setAdding('tier')} />}
      </div>
      {adding === 'perk' && (
        <div className="mb-3">
          <AddRewardForm t={t} lang={lang} program={program} usage="perk" onCancel={() => setAdding(null)} onAdd={added} />
        </div>
      )}
      {adding === 'tier' && (
        <div className="mb-3">
          <AddTierForm t={t} lang={lang} program={program} basis={basis} unit={unit} earnRate={earnRate}
            thresholdOf={thresholdOf} onCancel={() => setAdding(null)} onAdd={added} />
        </div>
      )}
      <div className="flex gap-3 overflow-x-auto tier-row" data-testid="tier-columns">
        {tiers.map((tier, i) => {
          const threshold = thresholdOf(tier);
          const multiplier = tier.pointsMultiplier ?? 1;
          const active = perks.filter(r => r.assignedTiers?.[i]);
          const inactive = perks.filter(r => !r.assignedTiers?.[i]);
          return (
            <div key={`${i}-${tier.name}`} className="rounded-[12px] border border-[#E5E1D8] bg-white flex flex-col overflow-hidden"
              style={{ flex: '1 0 220px', borderTop: `4px solid ${DEFAULT_TIER_COLORS[i % DEFAULT_TIER_COLORS.length]}` }} data-item={`tier:${i}`}>
              <div className="px-4 pt-3 pb-3 border-b border-[#E5E1D8] space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[17px] font-bold text-[#2B251F]">{tier.name}</h3>
                  <span className="inline-flex items-center gap-2.5 pt-1">
                    <CommentButton t={t} refId={`tier:${i}`} label={tier.name} onComment={onComment} openCountOf={openCountOf} />
                    {tiers.length > MIN_TIERS && (
                      <RemoveButton t={t} label={tier.name} confirmText={t.confirmTier(tier.name)}
                        onRemove={() => onEdit({ op: { kind: 'tier', index: i, name: tier.name, field: 'remove' }, itemLabel: tier.name, fieldLabel: t.tierRemoved, oldValue: `${t.threshold} ${fmt(threshold, lang)} ${unit}`, newValue: '' })} />
                    )}
                  </span>
                </div>
                <Row label={t.threshold}>
                  <NumberField key={threshold} value={threshold} max={1000000000} suffix={unit} label={`${t.threshold} ${tier.name}`} width="w-24"
                    onCommit={v => onEdit({ op: thresholdOp(i, v), itemLabel: tier.name, fieldLabel: t.threshold, oldValue: `${fmt(threshold, lang)} ${unit}`, newValue: `${fmt(v, lang)} ${unit}` })} />
                </Row>
                {config.hasMissions && (
                  <Row label={t.multiplier}>
                    <NumberField key={multiplier} value={multiplier} step={0.25} min={1} max={10} suffix="×" label={`${t.multiplier} ${tier.name}`} width="w-16"
                      onCommit={v => onEdit({ op: { kind: 'tier', index: i, field: 'pointsMultiplier', value: v }, itemLabel: tier.name, fieldLabel: t.multiplier, oldValue: `×${fmt(multiplier, lang)}`, newValue: `×${fmt(v, lang)}` })} />
                  </Row>
                )}
              </div>
              <ul className="px-3 py-3 space-y-1.5">
                {[...active, ...inactive].map(r => {
                  const on = !!r.assignedTiers?.[i];
                  const name = nameOf(r, lang);
                  const isNew = on && i > 0 && !r.assignedTiers?.[i - 1];
                  const inTiers = tiers.filter((_, j) => r.assignedTiers?.[j]).map(x => x.name).join(', ');
                  return (
                    <li key={r.id} className={`group flex items-center gap-2 text-[13px] ${on ? '' : 'opacity-60'}`}>
                      <Switch checked={on} label={`${t.perk} ${name} ${tier.name}`}
                        onChange={v => onEdit({ op: { kind: 'perk', id: r.id, index: i, field: 'assigned', value: v }, itemLabel: tier.name, fieldLabel: `${t.perk} « ${name} »`, oldValue: on ? t.on : t.off, newValue: v ? t.on : t.off })} />
                      <span className={`min-w-0 ${on ? 'font-medium text-[#2B251F]' : 'text-[#645648]'}`}>{name}</span>
                      {isNew && <span className="pill text-[10px] bg-[#ECFDF5] text-[#047857] shrink-0">{t.newPerk}</span>}
                      <RemoveButton t={t} label={`${name} (${tier.name})`} confirmText={t.confirmPerk(name)} className="ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100"
                        onRemove={() => onEdit({ op: { kind: 'reward', id: r.id, field: 'remove' }, itemLabel: name, fieldLabel: t.perkRemoved, oldValue: inTiers, newValue: '' })} />
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// A new top tier, above the current last one.
function AddTierForm({ t, lang, program, basis, unit, earnRate, thresholdOf, onAdd, onCancel }) {
  const tiers = program.tiers || [];
  const index = tiers.length;
  const last = tiers[index - 1];
  const lastThreshold = thresholdOf(last);
  const names = lang === 'fr' ? DEFAULT_TIER_NAMES_FR : DEFAULT_TIER_NAMES_EN;
  const [name, setName] = useState(names[index] || `${lang === 'fr' ? 'Palier' : 'Tier'} ${index + 1}`);
  const [threshold, setThreshold] = useState(String(lastThreshold * 2 || 1000));
  const [multiplier, setMultiplier] = useState(String(Math.min(10, (last?.pointsMultiplier ?? 1) + 0.5)));
  const hasMissions = !!program.config?.hasMissions;
  const thresholdOk = isNumberIn(threshold, 0, 1000000000) && Number(threshold) > lastThreshold;
  const canSubmit = name.trim() !== '' && thresholdOk && (!hasMissions || isNumberIn(multiplier, 1, 10));

  const submit = () => {
    const v = Number(threshold);
    const spend = basis === 'orders' ? (last?.spendThreshold || 0) * 2 || 5000 : basis === 'points' ? v / earnRate : v;
    const orders = basis === 'orders' ? v : Math.max(1, Math.round((last?.orderThreshold || 1) * 2));
    const value = {
      name: name.trim(), color: DEFAULT_TIER_COLORS[index % DEFAULT_TIER_COLORS.length],
      spendThreshold: spend, orderThreshold: orders,
      pointsMultiplier: hasMissions ? Number(multiplier) : (last?.pointsMultiplier ?? 1),
    };
    onAdd({
      op: { kind: 'tier', index, field: 'add', value },
      itemLabel: value.name, fieldLabel: t.tierAdded, oldValue: '', newValue: `${t.threshold} ${fmt(v, lang)} ${unit}`,
    });
  };

  return (
    <AddForm t={t} title={t.addTier} canSubmit={canSubmit} onSubmit={submit} onCancel={onCancel}
      error={threshold !== '' && !thresholdOk ? t.thresholdAbove(last?.name) : null}>
      <FormField label={t.name}>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={60} className={inputClass} />
      </FormField>
      <FormField label={`${t.threshold} (${unit})`}>
        <input type="number" min={0} value={threshold} onChange={e => setThreshold(e.target.value)} className={inputClass} />
      </FormField>
      {hasMissions && (
        <FormField label={`${t.multiplier} (×)`}>
          <input type="number" min={1} max={10} step={0.25} value={multiplier} onChange={e => setMultiplier(e.target.value)} className={inputClass} />
        </FormField>
      )}
    </AddForm>
  );
}
