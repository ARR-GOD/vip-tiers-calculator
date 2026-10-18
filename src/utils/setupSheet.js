// ════════════════════════════════════════════════════════════════════
// Setup sheet — the program structure, ready for Claude Cowork
// ════════════════════════════════════════════════════════════════════
//
// buildSetupSheet() gathers everything needed to configure the program in
// Loyoly (missions, points rewards, referral, VIP tiers) from the wizard
// state. The Dashboard prints it to PDF (SetupSheet.jsx) or copies it as
// Markdown (setupSheetMarkdown).

import { pointsModel, missionPoints } from './pointsModel';
import { rewardPointsCost, rewardMinPurchase, isBurnReward } from './rewardModel';
import { resolveReferral, formatReferralReward } from './referralModel';
import { thresholdForBasis } from './calculations';

const L = {
  fr: {
    title: 'Fiche de setup', points: 'Programme de points', missions: 'Missions',
    rewards: 'Récompenses en points', referral: 'Parrainage', vip: 'Programme VIP',
    earnRate: 'Points gagnés', perEuro: 'par € dépensé', pointsValue: 'Valeur des points',
    pointsExpiry: 'Expiration des points', none: 'aucune', months: 'mois', rolling: 'glissants', fixed: 'fixes',
    mission: 'Mission', pts: 'Points', reward: 'Récompense', expiry: 'Expiration', minPurchase: 'Achat minimum',
    tiers: 'Paliers', allTiers: 'tous', days: 'jours', referrer: 'Parrain', referee: 'Filleul',
    format: 'Format', formats: { spend: 'Montant dépensé (€)', orders: 'Nombre de commandes', points: 'Points cumulés' },
    reassessment: 'Réévaluation des paliers', every: 'tous les', noReassessment: 'aucune (statut acquis définitivement)',
    tier: 'Palier', threshold: 'Seuil', multiplier: 'Multiplicateur de points', tierRewards: 'Récompenses du palier',
    noReward: 'aucune', preparedBy: 'Préparée par', perPurchase: 'par € dépensé', noMinimum: 'aucun', noMinPurchase: 'sans achat minimum',
    noPoints: 'Programme sans points : statut VIP uniquement.',
  },
  en: {
    title: 'Setup sheet', points: 'Points program', missions: 'Missions',
    rewards: 'Points rewards', referral: 'Referral', vip: 'VIP program',
    earnRate: 'Points earned', perEuro: 'per € spent', pointsValue: 'Points value',
    pointsExpiry: 'Points expiration', none: 'none', months: 'months', rolling: 'rolling', fixed: 'fixed',
    mission: 'Mission', pts: 'Points', reward: 'Reward', expiry: 'Expiry', minPurchase: 'Min purchase',
    tiers: 'Tiers', allTiers: 'all', days: 'days', referrer: 'Referrer', referee: 'Referee',
    format: 'Format', formats: { spend: 'Amount spent (€)', orders: 'Number of orders', points: 'Points earned' },
    reassessment: 'Tier reassessment', every: 'every', noReassessment: 'none (status kept for good)',
    tier: 'Tier', threshold: 'Threshold', multiplier: 'Points multiplier', tierRewards: 'Tier rewards',
    noReward: 'none', preparedBy: 'Prepared by', perPurchase: 'per € spent', noMinimum: 'none', noMinPurchase: 'no minimum purchase',
    noPoints: 'No-points program: VIP status only.',
  },
};

const fmt = (n, lang) => Number(n || 0).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 2 });
const euro = (n, lang) => `${fmt(n, lang)} €`;
const name = (item, lang) => (lang === 'fr' ? item.nameFr : item.nameEn) || item.nameFr || item.nameEn || '';
const pts = (n, lang) => `${fmt(n, lang)} ${n > 1 ? 'pts' : 'pt'}`;

export function buildSetupSheet({ config, settings, tiers, rewards, missions, customMissions, referralConfig, clientName, author, lang = 'fr', date = new Date() }) {
  const l = L[lang] || L.fr;
  const { earnRate, ptsPerRewardEur } = pointsModel(settings);
  const colon = lang === 'fr' ? ' :' : ':';
  const minimum = value => (value > 0 ? euro(value, lang) : l.noMinimum);
  const minPurchase = r => minimum(rewardMinPurchase(r, settings));
  const tierNames = idxs => (idxs.length === tiers.length ? l.allTiers : idxs.map(i => tiers[i]?.name).join(', '));
  const sections = [];

  if (config.hasMissions) {
    sections.push({
      title: l.points,
      facts: [
        [l.earnRate, `${pts(earnRate, lang)} ${l.perEuro}`],
        [l.pointsValue, ptsPerRewardEur ? `${fmt(ptsPerRewardEur, lang)} pts = 1 €` : '—'],
        [l.pointsExpiry, config.pointsExpire
          ? `${config.expirationMonths} ${l.months} ${config.expirationType === 'fixed' ? l.fixed : l.rolling}`
          : l.none],
      ],
    });

    sections.push({
      title: l.missions,
      columns: [l.mission, l.pts],
      rows: [...missions, ...customMissions].filter(m => m.enabled).map(m => [
        name(m, lang),
        m.isPurchaseMission ? `${pts(earnRate, lang)} ${l.perPurchase}` : pts(missionPoints(m, settings), lang),
      ]),
    });

    sections.push({
      title: l.rewards,
      columns: [l.reward, l.pts, l.expiry, l.minPurchase, l.tiers],
      rows: rewards.filter(r => isBurnReward(r) && r.assignedTiers?.some(Boolean)).map(r => [
        name(r, lang),
        pts(rewardPointsCost(r, settings), lang),
        `${r.expirationDays ?? 90} ${l.days}`,
        minPurchase(r),
        tierNames(r.assignedTiers.map((on, i) => (on ? i : -1)).filter(i => i >= 0)),
      ]),
    });
  } else {
    sections.push({ title: l.points, note: l.noPoints });
  }

  if (referralConfig?.enabled) {
    const r = resolveReferral(referralConfig, settings.aov);
    sections.push({
      title: l.referral,
      columns: ['', l.reward, l.minPurchase, l.expiry],
      rows: [
        [l.referrer, formatReferralReward(r.referrerType, r.referrerValue), minimum(r.referrerMinPurchase), `${r.referrerExpirationDays} ${l.days}`],
        [l.referee, formatReferralReward(r.refereeType, r.refereeValue), minimum(r.refereeMinPurchase), `${r.refereeExpirationDays} ${l.days}`],
      ],
    });
  }

  if (config.hasTiers) {
    const basis = config.tierBasis;
    const unit = basis === 'orders' ? (lang === 'fr' ? ' commandes' : ' orders') : basis === 'points' ? ' pts' : ' €';
    sections.push({
      title: l.vip,
      facts: [
        [l.format, l.formats[basis] || l.formats.spend],
        [l.reassessment, config.tiersExpire
          ? `${l.every} ${config.tierExpirationMonths} ${l.months} ${config.tierExpirationType === 'fixed' ? l.fixed : l.rolling}`
          : l.noReassessment],
      ],
      columns: [l.tier, l.threshold, ...(config.hasMissions ? [l.multiplier] : []), l.tierRewards],
      rows: tiers.map((tier, i) => {
        const perks = rewards
          .filter(r => r.assignedTiers?.[i] && r.rewardUsage !== 'burn')
          .map(r => {
            const min = rewardMinPurchase(r, settings);
            const minText = min > 0 ? `${l.minPurchase.toLowerCase()}${colon} ${euro(min, lang)}` : l.noMinPurchase;
            return `${name(r, lang)} (${minText}, ${l.expiry.toLowerCase()}${colon} ${r.expirationDays ?? 90} ${l.days})`;
          });
        return [
          tier.name,
          `${fmt(Math.round(thresholdForBasis(tier, basis, earnRate)), lang)}${unit}`,
          ...(config.hasMissions ? [`×${fmt(tier.pointsMultiplier ?? 1, lang)}`] : []),
          perks.length ? perks : [l.noReward],
        ];
      }),
    });
  }

  return {
    lang,
    title: `${l.title} — ${clientName || 'Loyoly'}`,
    subtitle: [date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'long' }), author && `${l.preparedBy} ${author}`]
      .filter(Boolean).join(' · '),
    sections,
  };
}

// Same content as Markdown — the most reliable format for an AI assistant.
export function setupSheetMarkdown(sheet) {
  const cell = v => (Array.isArray(v) ? v.join(' ; ') : String(v)).replace(/\|/g, '/');
  const colon = sheet.lang === 'en' ? ':' : ' :';
  const lines = [`# ${sheet.title}`, '', sheet.subtitle, ''];
  sheet.sections.forEach(section => {
    lines.push(`## ${section.title}`, '');
    if (section.note) lines.push(section.note, '');
    (section.facts || []).forEach(([k, v]) => lines.push(`- **${k}**${colon} ${v}`));
    if (section.facts?.length) lines.push('');
    if (section.columns && section.rows?.length) {
      lines.push(`| ${section.columns.map(cell).join(' | ')} |`);
      lines.push(`| ${section.columns.map(() => '---').join(' | ')} |`);
      section.rows.forEach(row => lines.push(`| ${row.map(cell).join(' | ')} |`));
      lines.push('');
    } else if (section.columns) {
      lines.push('—', '');
    }
  });
  return lines.join('\n');
}
