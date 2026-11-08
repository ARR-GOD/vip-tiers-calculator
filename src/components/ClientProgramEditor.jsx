import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { pointsModel, missionPoints, basePointsFromPoints } from '../utils/pointsModel';
import { rewardPointsCost, rewardBaseFromPoints, rewardMinPurchase, isBurnReward, isPerkReward } from '../utils/rewardModel';
import { resolveReferral, formatReferralReward } from '../utils/referralModel';
import { thresholdForBasis } from '../utils/calculations';
import { DEFAULT_TIER_COLORS } from '../data/defaults';

// ════════════════════════════════════════════════════════════════════
// Client program editor — the brand edits its published program
// ════════════════════════════════════════════════════════════════════
// Each change is one op (utils/programOps.js) sent with readable labels for
// the CSM's activity feed. Numbers are saved when the field is left (or on
// Enter); switches right away.

const FR = {
  points: 'Programme de points', missions: 'Missions', mission: 'Mission', active: 'Activée', pts: 'Points',
  rewards: 'Récompenses en points', reward: 'Récompense', price: 'Prix en points', expiry: 'Expiration',
  minPurchase: 'Achat minimum', tiersCol: 'Paliers', days: 'jours', all: 'tous', noMinimum: 'aucun',
  referral: 'Parrainage', referrer: 'Parrain', referee: 'Filleul', rewardAmount: 'Récompense', type: 'Type',
  vip: 'Programme VIP', threshold: 'Seuil', multiplier: 'Multiplicateur', perks: 'Avantages du palier',
  perk: 'Avantage', newPerk: 'Nouveau', on: 'Activé', off: 'Désactivé', yes: 'Oui', no: 'Non',
  perPurchase: 'par € dépensé', orders: 'commandes', comment: 'Commenter',
  hint: 'Modifiez directement les valeurs : elles sont enregistrées dès que vous quittez le champ, et votre CSM Loyoly en est informé.',
};
const EN = {
  points: 'Points program', missions: 'Missions', mission: 'Mission', active: 'Active', pts: 'Points',
  rewards: 'Points rewards', reward: 'Reward', price: 'Points price', expiry: 'Expiry',
  minPurchase: 'Min purchase', tiersCol: 'Tiers', days: 'days', all: 'all', noMinimum: 'none',
  referral: 'Referral', referrer: 'Referrer', referee: 'Referee', rewardAmount: 'Reward', type: 'Type',
  vip: 'VIP program', threshold: 'Threshold', multiplier: 'Multiplier', perks: 'Tier perks',
  perk: 'Perk', newPerk: 'New', on: 'On', off: 'Off', yes: 'Yes', no: 'No',
  perPurchase: 'per € spent', orders: 'orders', comment: 'Comment',
  hint: 'Edit the values directly: they are saved as soon as you leave the field, and your Loyoly CSM is notified.',
};

const fmt = (n, lang) => Number(n || 0).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 2 });
const nameOf = (item, lang) => (lang === 'fr' ? item.nameFr : item.nameEn) || item.nameFr || item.nameEn || '';

export default function ClientProgramEditor({ lang, page, program, sections, onEdit, onComment, openCountOf, emptyText }) {
  const t = lang === 'fr' ? FR : EN;
  const ctx = { t, lang, program, onEdit, onComment, openCountOf, emptyText };
  const facts = key => sections.find(s => s.key === key)?.facts;
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-[#8A7D6B]">{t.hint}</p>
      {page === 'missions' && <MissionsEditor {...ctx} pointsFacts={facts('points')} note={sections.find(s => s.note)?.note} />}
      {page === 'rewards' && <RewardsEditor {...ctx} />}
      {page === 'referral' && <ReferralEditor {...ctx} />}
      {page === 'tiers' && <TiersEditor {...ctx} vipFacts={facts('vip')} />}
    </div>
  );
}

// ── Building blocks ──────────────────────────────────────────────────
function NumberField({ value, onCommit, step = 1, min = 0, max, suffix, label, width = 'w-20' }) {
  const [draft, setDraft] = useState(String(value ?? ''));
  const commit = () => {
    const next = Number(String(draft).replace(',', '.'));
    if (draft === '' || !Number.isFinite(next) || next < min || (max !== undefined && next > max)) {
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

// ── Missions ─────────────────────────────────────────────────────────
function MissionsEditor({ t, lang, program, onEdit, onComment, openCountOf, pointsFacts, note, emptyText }) {
  const { settings } = program;
  if (!program.config?.hasMissions) return <div className="card text-[13px] text-[#8A7D6B]">{note || emptyText}</div>;
  const { earnRate } = pointsModel(settings);
  const missions = [...(program.missions || []), ...(program.customMissions || [])];
  const yesNo = v => (v ? t.yes : t.no);
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
                    <td className={`${td} text-right`}>
                      {m.enabled && <CommentButton t={t} refId={`mission:${m.id}`} label={name} onComment={onComment} openCountOf={openCountOf} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// ── Points rewards ───────────────────────────────────────────────────
function RewardsEditor({ t, lang, program, onEdit, onComment, openCountOf, emptyText }) {
  const { settings, tiers = [] } = program;
  const rewards = program.config?.hasMissions
    ? (program.rewards || []).filter(r => isBurnReward(r) && r.assignedTiers?.some(Boolean))
    : [];
  if (!rewards.length) return <div className="card text-[13px] text-[#8A7D6B]">{emptyText}</div>;
  const tierNames = r => {
    const idxs = (r.assignedTiers || []).map((on, i) => (on ? i : -1)).filter(i => i >= 0 && i < tiers.length);
    return idxs.length === tiers.length ? t.all : idxs.map(i => tiers[i]?.name).join(', ');
  };
  const minText = v => (v > 0 ? `${fmt(v, lang)} €` : t.noMinimum);
  return (
    <Card title={t.rewards}>
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
                  <td className={`${td} text-right`}>
                    <CommentButton t={t} refId={`reward:${r.id}`} label={name} onComment={onComment} openCountOf={openCountOf} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
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
  const { config = {}, settings, tiers = [] } = program;
  if (!config.hasTiers || !tiers.length) return <div className="card text-[13px] text-[#8A7D6B]">{emptyText}</div>;
  const { earnRate } = pointsModel(settings);
  const basis = config.tierBasis || 'spend';
  const unit = basis === 'orders' ? t.orders : basis === 'points' ? 'pts' : '€';
  const perks = (program.rewards || []).filter(isPerkReward);
  const thresholdOp = (index, v) => (basis === 'orders'
    ? { kind: 'tier', index, field: 'orderThreshold', value: v }
    : { kind: 'tier', index, field: 'spendThreshold', value: basis === 'points' ? v / earnRate : v });

  return (
    <Card title={t.vip}>
      <Facts facts={vipFacts} />
      <div className="flex gap-3 overflow-x-auto tier-row" data-testid="tier-columns">
        {tiers.map((tier, i) => {
          const threshold = Math.round(thresholdForBasis(tier, basis, earnRate));
          const multiplier = tier.pointsMultiplier ?? 1;
          const active = perks.filter(r => r.assignedTiers?.[i]);
          const inactive = perks.filter(r => !r.assignedTiers?.[i]);
          return (
            <div key={i} className="rounded-[12px] border border-[#E5E1D8] bg-white flex flex-col overflow-hidden"
              style={{ flex: '1 0 220px', borderTop: `4px solid ${DEFAULT_TIER_COLORS[i % DEFAULT_TIER_COLORS.length]}` }} data-item={`tier:${i}`}>
              <div className="px-4 pt-3 pb-3 border-b border-[#E5E1D8] space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[17px] font-bold text-[#2B251F]">{tier.name}</h3>
                  <CommentButton t={t} refId={`tier:${i}`} label={tier.name} onComment={onComment} openCountOf={openCountOf} />
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
                  return (
                    <li key={r.id} className={`flex items-center gap-2 text-[13px] ${on ? '' : 'opacity-60'}`}>
                      <Switch checked={on} label={`${t.perk} ${name} ${tier.name}`}
                        onChange={v => onEdit({ op: { kind: 'perk', id: r.id, index: i, field: 'assigned', value: v }, itemLabel: tier.name, fieldLabel: `${t.perk} « ${name} »`, oldValue: on ? t.on : t.off, newValue: v ? t.on : t.off })} />
                      <span className={on ? 'font-medium text-[#2B251F]' : 'text-[#645648]'}>{name}</span>
                      {isNew && <span className="pill text-[10px] bg-[#ECFDF5] text-[#047857] shrink-0">{t.newPerk}</span>}
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
