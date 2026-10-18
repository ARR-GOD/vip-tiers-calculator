// ════════════════════════════════════════════════════════════════════
// Points model — how many points customers earn and what they are worth
// ════════════════════════════════════════════════════════════════════
//
// Only reference values are stored; points are derived when read, so changing
// the earn rate never distorts what was configured:
//   - settings.earnRate        points earned per € spent (1, 5 or 10)
//   - settings.cashbackRate    % of spend given back as reward value
//   - mission.basePoints       mission points on the 1 pt/€ grid
//   - reward.pointsValueEur    € value of a reward bought with points

export const EARN_RATE_OPTIONS = [1, 5, 10];

// Loyoly rule: AOV ≥ 50€ → 1 pt/€, below → 10 pts/€.
export function defaultEarnRate(aov) {
  return (Number(aov) || 0) >= 50 ? 1 : 10;
}

// Until the CSM picks a rate, it follows the AOV rule.
export function pointsModel(settings = {}) {
  const manualRate = Number(settings.earnRate);
  const earnRate = settings.earnRateManual && manualRate > 0
    ? manualRate
    : defaultEarnRate(settings.aov);
  const cashback = Math.max(0, Number(settings.cashbackRate) || 0);
  // Points a customer spends for 1€ of reward; null when nothing is given back.
  const ptsPerRewardEur = cashback > 0 ? (earnRate * 100) / cashback : null;
  return { earnRate, cashback, ptsPerRewardEur };
}

export function missionPoints(mission, settings) {
  return Math.round((mission.basePoints ?? 0) * pointsModel(settings).earnRate);
}

export function basePointsFromPoints(points, settings) {
  return points / pointsModel(settings).earnRate;
}
