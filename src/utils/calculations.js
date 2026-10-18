// ══════════════════════════════════════════════════════════════
// Core calculation engine for Loyoly Setup
// ══════════════════════════════════════════════════════════════

import { pointsModel, missionPoints } from './pointsModel';
import { rewardRealCost, rewardMinPurchase, rewardPointsCost, isBurnReward } from './rewardModel';
import { defaultTierUtilization } from '../data/programDefaults';

// ── Customer scoring ──
export function computeCustomerScores(customers, segmentationType, caWeight = 0.5) {
  if (!customers || customers.length === 0) return [];

  let maxRevenue = 1;
  let maxOrders = 1;
  for (let i = 0; i < customers.length; i++) {
    if (customers[i].total_ordered_TTC > maxRevenue) maxRevenue = customers[i].total_ordered_TTC;
    if (customers[i].number_of_orders > maxOrders) maxOrders = customers[i].number_of_orders;
  }

  return customers.map(c => {
    let score;
    if (segmentationType === 'revenue') {
      score = c.total_ordered_TTC;
    } else if (segmentationType === 'orders') {
      score = c.number_of_orders;
    } else {
      const normRevenue = c.total_ordered_TTC / maxRevenue;
      const normOrders = c.number_of_orders / maxOrders;
      score = normRevenue * caWeight + normOrders * (1 - caWeight);
    }
    return { ...c, score };
  }).sort((a, b) => b.score - a.score);
}

// ── Tier basis helpers ──
// The points basis is the spend basis expressed in points (spend × earn rate):
// only spend and order thresholds are stored.
export function metricForBasis(customer, tierBasis, earnRate = 1) {
  if (tierBasis === 'orders') return customer.number_of_orders || 0;
  if (tierBasis === 'points') return (customer.total_ordered_TTC || 0) * earnRate;
  return customer.total_ordered_TTC || 0;
}

// Read the entry-threshold value of a tier for the chosen basis.
export function thresholdForBasis(tier, tierBasis, earnRate = 1) {
  if (tierBasis === 'orders') return tier?.orderThreshold ?? 0;
  if (tierBasis === 'points') return (tier?.spendThreshold ?? 0) * earnRate;
  return tier?.spendThreshold ?? 0;
}

// Tier field holding the threshold for a given basis.
export function thresholdKeyForBasis(tierBasis) {
  if (tierBasis === 'orders') return 'orderThreshold';
  return 'spendThreshold';
}

// Sort customers DESC by the chosen metric. Used for percentile lookups.
export function getSortedByMetric(customers, tierBasis, earnRate = 1) {
  return [...customers].sort((a, b) =>
    metricForBasis(b, tierBasis, earnRate) - metricForBasis(a, tierBasis, earnRate)
  );
}

/**
 * Given a desired % of customers in a specific tier, return the stored
 * threshold (€ or #orders, see thresholdKeyForBasis) that would produce that
 * distribution — assuming higher tiers' thresholds stay fixed. Lower tiers
 * absorb the remainder.
 *
 * Works for any tierIndex, including tier 0. Customers below the tier 0
 * threshold are considered non-members (tier = -1) in assignTiers.
 */
export function thresholdForTierPct({ customers, sortedCustomers, tiers, tierIndex, desiredPct, basis }) {
  // Points thresholds are stored in €: same ordering as the spend basis.
  const storedBasis = basis === 'points' ? 'spend' : basis;
  const sorted = sortedCustomers || getSortedByMetric(customers || [], storedBasis);
  const N = sorted.length;
  if (N === 0) return 0;

  const metric = c => metricForBasis(c, storedBasis);

  // Customers already taken by tiers strictly above tierIndex.
  let countAbove = 0;
  if (tierIndex < tiers.length - 1) {
    const upperT = thresholdForBasis(tiers[tierIndex + 1], storedBasis);
    // Count customers whose metric >= upperT (qualified for the tier above).
    let i = 0;
    while (i < N && metric(sorted[i]) >= upperT) i++;
    countAbove = i;
  }

  const desiredCount = Math.max(1, Math.round((Math.max(0, desiredPct) / 100) * N));
  const cutIdx = Math.max(0, Math.min(N - 1, countAbove + desiredCount - 1));
  return Math.max(0, Math.round(metric(sorted[cutIdx])));
}

// ── Tier assignment ──
// Unified: dispatches on tierBasis using the metric/threshold helpers above.
// Customers whose metric is below tier 0's threshold are non-members (tier = -1).
export function assignTiers(sortedCustomers, tiers, tierBasis, { earnRate = 1 } = {}) {
  if (!sortedCustomers || sortedCustomers.length === 0) return [];
  return sortedCustomers.map(customer => {
    const v = metricForBasis(customer, tierBasis, earnRate);
    let assignedTier = -1; // non-member by default
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (v >= thresholdForBasis(tiers[i], tierBasis, earnRate)) {
        assignedTier = i;
        break;
      }
    }
    const out = { ...customer, tier: assignedTier };
    if (tierBasis === 'points') out.estimatedPoints = v;
    return out;
  });
}

// ── Tier statistics ──
export function computeTierStats(assignedCustomers, tiers) {
  const totalRevenue = assignedCustomers.reduce((s, c) => s + c.total_ordered_TTC, 0);
  const totalCustomers = assignedCustomers.length;

  return tiers.map((tier, i) => {
    const customers = assignedCustomers.filter(c => c.tier === i);
    const tierRevenue = customers.reduce((s, c) => s + c.total_ordered_TTC, 0);
    const tierOrders = customers.reduce((s, c) => s + c.number_of_orders, 0);
    const count = customers.length;

    let minRevenue = 0;
    let maxRevenue = 0;
    if (customers.length > 0) {
      minRevenue = customers[0].total_ordered_TTC;
      maxRevenue = customers[0].total_ordered_TTC;
      for (let j = 1; j < customers.length; j++) {
        const v = customers[j].total_ordered_TTC;
        if (v < minRevenue) minRevenue = v;
        if (v > maxRevenue) maxRevenue = v;
      }
    }

    return {
      tierIndex: i,
      name: tier.name,
      color: tier.color,
      count,
      percentage: totalCustomers > 0 ? (count / totalCustomers) * 100 : 0,
      revenue: tierRevenue,
      revenuePercentage: totalRevenue > 0 ? (tierRevenue / totalRevenue) * 100 : 0,
      avgLTV: count > 0 ? tierRevenue / count : 0,
      avgAOV: tierOrders > 0 ? tierRevenue / tierOrders : 0,
      avgOrders: count > 0 ? tierOrders / count : 0,
      minRevenue,
      maxRevenue,
    };
  });
}

// Stats for customers below tier 0's threshold (non-members).
// Tier-aware code paths exclude them automatically; this helper surfaces them
// for the dashboard view.
export function computeNonMemberStats(assignedCustomers) {
  const nonMembers = assignedCustomers.filter(c => c.tier === -1);
  if (nonMembers.length === 0) return { count: 0, revenue: 0, avgLTV: 0, avgAOV: 0 };
  const revenue = nonMembers.reduce((s, c) => s + (c.total_ordered_TTC || 0), 0);
  const orders = nonMembers.reduce((s, c) => s + (c.number_of_orders || 0), 0);
  return {
    count: nonMembers.length,
    revenue,
    avgLTV: revenue / nonMembers.length,
    avgAOV: orders > 0 ? revenue / orders : 0,
  };
}

// ── Mission points calculations (per tier, with completion rates) ──
// The purchase mission is not a mission here: purchase points come from
// revenue × earn rate (see computePointsEconomy).
export function computeMissionPointsByTier(missions, customMissions, tiers, tierStats, settings, scenarioMultiplier = 1) {
  const allMissions = [...missions, ...customMissions].filter(m => m.enabled && !m.isPurchaseMission);

  return tiers.map((tier, tierIndex) => {
    const stat = tierStats[tierIndex];
    if (!stat || stat.count === 0) {
      return { tierIndex, totalPoints: 0, totalCompletions: 0, missionBreakdown: [] };
    }

    const missionBreakdown = allMissions.map(m => {
      const adjustedRate = Math.min(((m.completionRate ?? 20) / 100) * scenarioMultiplier, 1);
      const completionsPerYear = stat.count * adjustedRate * (m.frequency || 1);
      const pointsGenerated = completionsPerYear * missionPoints(m, settings);
      return {
        missionId: m.id,
        name: m.nameFr || m.nameEn,
        engagementRate: adjustedRate * 100,
        completionsPerYear: Math.round(completionsPerYear),
        pointsGenerated: Math.round(pointsGenerated),
      };
    });

    return {
      tierIndex,
      totalPoints: missionBreakdown.reduce((s, m) => s + m.pointsGenerated, 0),
      totalCompletions: missionBreakdown.reduce((s, m) => s + m.completionsPerYear, 0),
      missionBreakdown,
    };
  });
}

// Purchase points of a tier: revenue × earn rate × the tier's multiplier.
export function computePurchasePoints(tierStat, tier, settings) {
  return Math.round((tierStat?.revenue || 0) * pointsModel(settings).earnRate * (tier?.pointsMultiplier || 1));
}

// ── Reward cost per tier ──
// Every reward assigned to a tier is used by tier.avgUtilization % of the
// tier's members per year — scaled by the engagement scenario and, on the
// dashboard, by the share of customers active in the program.
// A reward available both with points and as a perk is counted once.
export function rewardCostByTier({ rewards, tiers, tierStats, settings }, { scenarioMultiplier = 1, participation = 1 } = {}) {
  return tiers.map((tier, i) => {
    const count = tierStats[i]?.count || 0;
    const baseUtil = (tier.avgUtilization ?? defaultTierUtilization(i)) / 100;
    const utilization = Math.min(1, baseUtil * scenarioMultiplier) * participation;
    let burnCost = 0;
    let perkCost = 0;
    let incrementalRevenue = 0;
    let rewardCount = 0;
    rewards.forEach(reward => {
      if (!reward.assignedTiers?.[i]) return;
      rewardCount++;
      const cost = count * rewardRealCost(reward, settings) * utilization;
      if (isBurnReward(reward)) burnCost += cost;
      else perkCost += cost;
      incrementalRevenue += count * rewardMinPurchase(reward, settings) * utilization;
    });
    return { tierIndex: i, rewardCount, burnCost, perkCost, totalCost: burnCost + perkCost, incrementalRevenue };
  });
}

export function sumRewardCosts(rows) {
  return rows.reduce((acc, r) => ({
    burnCost: acc.burnCost + r.burnCost,
    perkCost: acc.perkCost + r.perkCost,
    totalCost: acc.totalCost + r.totalCost,
    incrementalRevenue: acc.incrementalRevenue + r.incrementalRevenue,
  }), { burnCost: 0, perkCost: 0, totalCost: 0, incrementalRevenue: 0 });
}

// ── Per-tier financial summary ──
export function computeTierFinancials(costRow, tierStat, grossMargin) {
  if (!tierStat || tierStat.count === 0 || !costRow) {
    return { rewardsCost: 0, grossProfit: 0, netProfit: 0, hasRewards: false };
  }
  const hasRewards = costRow.rewardCount > 0;
  // Tier P&L view: only meaningful when there ARE rewards assigned to the tier.
  // Without rewards, the program doesn't impact the tier — no marge brute nor
  // profit net attributable.
  const grossProfit = hasRewards ? (tierStat.revenue || 0) * (grossMargin / 100) : 0;
  return { rewardsCost: costRow.totalCost, grossProfit, netProfit: grossProfit - costRow.totalCost, hasRewards };
}

// ── Resize assignedTiers when tier count changes ──
export function resizeAssignedTiers(rewards, newTierCount) {
  return rewards.map(r => ({
    ...r,
    assignedTiers: Array.from({ length: newTierCount }, (_, i) => r.assignedTiers?.[i] ?? false),
  }));
}

// ── Referral economics ──
export function computeReferralEconomics(referralConfig, aov) {
  if (!referralConfig || !referralConfig.enabled) {
    return { costReferrerPerYear: 0, costRefereePerYear: 0, totalCostPerYear: 0, revenuePerYear: 0, roi: 0 };
  }
  const { referrerType, referrerValue, refereeType, refereeValue, estimatedReferralsPerMonth, conversionRate, avgFirstOrderValue } = referralConfig;
  const referralsPerYear = (estimatedReferralsPerMonth || 0) * 12;
  const convRate = (conversionRate || 0) / 100;
  const convertedPerYear = referralsPerYear * convRate;

  // Cost per referrer reward
  const costPerReferrer = referrerType === 'percent'
    ? (referrerValue / 100) * (aov || 60)
    : referrerValue;
  const costReferrerPerYear = referralsPerYear * costPerReferrer;

  // Cost per referee reward
  const costPerReferee = refereeType === 'percent'
    ? (refereeValue / 100) * (avgFirstOrderValue || 80)
    : refereeValue;
  const costRefereePerYear = convertedPerYear * costPerReferee;

  const totalCostPerYear = costReferrerPerYear + costRefereePerYear;
  const revenuePerYear = convertedPerYear * (avgFirstOrderValue || 80);
  const roi = totalCostPerYear > 0 ? ((revenuePerYear - totalCostPerYear) / totalCostPerYear) * 100 : 0;

  return { costReferrerPerYear, costRefereePerYear, totalCostPerYear, revenuePerYear, roi };
}

// ── Points economy (emitted / burned / dormant) ──
// Burned points = emitted × burn rate (share of points actually redeemed).
export function computePointsEconomy(tierStats, tiers, missions, customMissions, settings, burnRate, scenarioMultiplier = 1) {
  const missionData = computeMissionPointsByTier(missions, customMissions, tiers, tierStats, settings, scenarioMultiplier);

  const perTier = tiers.map((tier, i) => {
    const stat = tierStats[i];
    if (!stat || stat.count === 0) return { emitted: 0, burned: 0, dormant: 0, purchasePoints: 0, missionPoints: 0 };
    const purchasePoints = computePurchasePoints(stat, tier, settings);
    const missionPts = missionData[i]?.totalPoints || 0;
    const emitted = purchasePoints + missionPts;
    const burned = Math.round(emitted * ((burnRate || 0) / 100));
    return { emitted, burned, dormant: emitted - burned, purchasePoints, missionPoints: missionPts };
  });

  const totalEmitted = perTier.reduce((s, t) => s + t.emitted, 0);
  const totalBurned = perTier.reduce((s, t) => s + t.burned, 0);
  const totalDormant = totalEmitted - totalBurned;
  const utilizationRate = totalEmitted > 0 ? (totalBurned / totalEmitted) * 100 : 0;

  return { perTier, totalEmitted, totalBurned, totalDormant, utilizationRate };
}

// € the brand actually pays per point redeemed: real cost / points price of
// the points rewards offered in at least one tier. Null without such rewards.
export function realCostPerPoint(rewards, settings) {
  let cost = 0;
  let points = 0;
  rewards.forEach(r => {
    if (!isBurnReward(r) || !r.assignedTiers?.some(Boolean)) return;
    const price = rewardPointsCost(r, settings);
    if (price <= 0) return;
    cost += rewardRealCost(r, settings);
    points += price;
  });
  return points > 0 ? cost / points : null;
}

// ── Formatters ──
export function formatCurrency(value) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value) {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0, maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value) {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 1, maximumFractionDigits: 1,
  }).format(value) + '%';
}

export function formatCompact(value) {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
  return Math.round(value).toString();
}
