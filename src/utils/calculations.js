// ══════════════════════════════════════════════════════════════
// Core calculation engine for VIP Tiers Calculator
// ══════════════════════════════════════════════════════════════

// ── Points derivation from cashback rate ──
// Fixed: 100 pts = 1€. So cashbackRate% → that many pts per €.
export function derivePointsFromCashback(cashbackRate) {
  const rate = parseFloat(cashbackRate) || 3;
  const pointsToEuro = 100; // 100 pts = 1€
  const pointsPerEuro = rate; // 3% → 3 pts/€
  return { pointsToEuro, pointsPerEuro };
}

// ── Cashback recommendation based on gross margin ──
export function getCashbackRecommendation(grossMargin) {
  if (!grossMargin || grossMargin <= 0) return null;
  if (grossMargin < 40) {
    return {
      bracket: 'low', minRate: 3, maxRate: 6,
      warningFr: 'Marge faible — privilégiez les perks non-monétaires',
      warningEn: 'Low margin — prefer non-monetary perks',
    };
  } else if (grossMargin <= 60) {
    return { bracket: 'mid', minRate: 6, maxRate: 12, warningFr: null, warningEn: null };
  } else {
    return { bracket: 'high', minRate: 12, maxRate: 20, warningFr: null, warningEn: null };
  }
}

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

// ── Tier assignment ──
export function assignTiers(sortedCustomers, tiers, tierBasis, programConfig) {
  if (tierBasis === 'points') {
    return assignTiersByPoints(sortedCustomers, tiers, programConfig);
  }
  return assignTiersByPercentile(sortedCustomers, tiers);
}

function assignTiersByPercentile(sortedCustomers, tiers) {
  const total = sortedCustomers.length;
  if (total === 0) return [];
  const thresholds = tiers.map(t => t.threshold);
  return sortedCustomers.map((customer, index) => {
    const percentile = ((index + 1) / total) * 100;
    let assignedTier = 0;
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (percentile <= thresholds[i]) {
        assignedTier = i;
        break;
      }
    }
    return { ...customer, tier: assignedTier };
  });
}

function assignTiersByPoints(customers, tiers, programConfig) {
  const pointsPerEuro = programConfig?.pointsPerEuro || 10;
  return customers.map(customer => {
    const estimatedPoints = customer.total_ordered_TTC * pointsPerEuro;
    let assignedTier = 0;
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (estimatedPoints >= (tiers[i].pointsThreshold || 0)) {
        assignedTier = i;
        break;
      }
    }
    return { ...customer, tier: assignedTier, estimatedPoints };
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

// ── Mission points calculations (per tier, with engagement rates) ──
export function computeMissionPointsByTier(missions, customMissions, tiers, tierStats, scenarioMultiplier = 1) {
  const allMissions = [...missions, ...customMissions].filter(m => m.enabled);

  return tiers.map((tier, tierIndex) => {
    const stat = tierStats[tierIndex];
    if (!stat || stat.count === 0) {
      return { tierIndex, totalPoints: 0, totalCompletions: 0, missionBreakdown: [] };
    }

    const missionBreakdown = allMissions.map(m => {
      const engagementRate = (m.engagementByTier?.[tierIndex] ?? 20) / 100;
      const adjustedRate = Math.min(engagementRate * scenarioMultiplier, 1);
      const completionsPerYear = stat.count * adjustedRate * (m.frequency || 1);
      const pointsGenerated = completionsPerYear * m.points;
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

// ── Purchase points per year for a tier ──
export function computePurchasePointsPerYear(avgLTV, pointsPerEuro, multiplier) {
  return avgLTV * pointsPerEuro * multiplier;
}

// ── Reward cost calculations (with burn/perk split + utilization) ──
export function computeRewardsCost(rewards, burnRate, tierStats, tiers) {
  const totalCustomers = tierStats.reduce((s, t) => s + t.count, 0);
  if (totalCustomers === 0) return { totalCost: 0, burnCost: 0, perkCost: 0, incrementalRevenue: 0, details: [] };

  let burnCost = 0;
  let perkCost = 0;
  let incrementalRevenue = 0;
  const details = [];

  tierStats.forEach((stat, tierIndex) => {
    const normalized = rewards.map(r => normalizeReward(r, tiers.length));

    normalized.forEach(reward => {
      if (!reward.assignedTiers?.[tierIndex]) return;

      const utilization = (reward.utilizationByTier?.[tierIndex] ?? burnRate) / 100;
      const isBurn = reward.rewardUsage === 'burn' || reward.rewardUsage === 'both';
      const isPerk = reward.rewardUsage === 'perk' || reward.rewardUsage === 'both';

      if (isBurn) {
        const cost = stat.count * reward.realCost * utilization;
        burnCost += cost;
        // Incremental revenue from minPurchase
        if (reward.minPurchase > 0) {
          incrementalRevenue += stat.count * reward.minPurchase * utilization;
        }
      }
      if (isPerk) {
        const cost = stat.count * reward.realCost * utilization;
        perkCost += cost;
        if (reward.minPurchase > 0) {
          incrementalRevenue += stat.count * reward.minPurchase * utilization;
        }
      }
    });
  });

  return { totalCost: burnCost + perkCost, burnCost, perkCost, incrementalRevenue, details };
}

// ── Per-tier financial summary ──
export function computeTierFinancials(tierIndex, tierStat, rewards, grossMargin, burnRate) {
  if (!tierStat || tierStat.count === 0) {
    return { rewardsCost: 0, incrementalRevenue: 0, grossProfit: 0, netProfit: 0, roi: 0 };
  }

  let rewardsCost = 0;
  let incrementalRevenue = 0;

  const normalized = rewards.map(r => normalizeReward(r, 4));

  normalized.forEach(reward => {
    if (!reward.assignedTiers?.[tierIndex]) return;
    const utilization = (reward.utilizationByTier?.[tierIndex] ?? burnRate) / 100;
    const cost = tierStat.count * reward.realCost * utilization;
    rewardsCost += cost;
    if (reward.minPurchase > 0) {
      incrementalRevenue += tierStat.count * reward.minPurchase * utilization;
    }
  });

  const grossProfit = incrementalRevenue * (grossMargin / 100);
  const netProfit = grossProfit - rewardsCost;
  const roi = rewardsCost > 0 ? ((grossProfit - rewardsCost) / rewardsCost) * 100 : 0;

  return { rewardsCost, incrementalRevenue, grossProfit, netProfit, roi };
}

// ── Normalize reward: legacy minTier → assignedTiers ──
export function normalizeReward(reward, tierCount) {
  if (reward.assignedTiers && reward.assignedTiers.length >= tierCount) return reward;
  const assignedTiers = Array.from({ length: tierCount }, (_, i) =>
    reward.assignedTiers ? (reward.assignedTiers[i] ?? false) : i >= (reward.minTier || 0)
  );
  const utilizationByTier = Array.from({ length: tierCount }, (_, i) =>
    reward.utilizationByTier?.[i] ?? 30
  );
  return {
    ...reward,
    assignedTiers,
    utilizationByTier,
    rewardUsage: reward.rewardUsage || 'burn',
    minPurchase: reward.minPurchase || 0,
  };
}

// ── Resize assignedTiers & utilizationByTier when tier count changes ──
export function resizeAssignedTiers(rewards, newTierCount) {
  return rewards.map(r => {
    const currentAssigned = r.assignedTiers || [];
    const currentUtil = r.utilizationByTier || [];
    const assignedTiers = Array.from({ length: newTierCount }, (_, i) =>
      i < currentAssigned.length ? currentAssigned[i] : false
    );
    const utilizationByTier = Array.from({ length: newTierCount }, (_, i) =>
      i < currentUtil.length ? currentUtil[i] : 30
    );
    return { ...r, assignedTiers, utilizationByTier };
  });
}

// ── Resize mission engagement rates when tier count changes ──
export function resizeMissionEngagement(missions, newTierCount) {
  return missions.map(m => {
    const current = m.engagementByTier || [];
    const engagementByTier = Array.from({ length: newTierCount }, (_, i) =>
      i < current.length ? current[i] : 20
    );
    return { ...m, engagementByTier };
  });
}

// ── Program funnel calculation ──
export function computeProgramFunnel(tierStats, missions, customMissions, rewards, settings, tiers, scenarioMultiplier = 1) {
  const { cashbackRate, grossMargin } = settings;
  const { pointsPerEuro } = derivePointsFromCashback(cashbackRate);

  const totalCustomers = tierStats.reduce((s, t) => s + t.count, 0);
  const totalRevenue = tierStats.reduce((s, t) => s + t.revenue, 0);

  // Points from purchases
  let totalPurchasePoints = 0;
  tierStats.forEach((stat, i) => {
    const multiplier = tiers[i]?.pointsMultiplier || 1;
    totalPurchasePoints += stat.revenue * pointsPerEuro * multiplier;
  });

  // Points from missions
  const missionData = computeMissionPointsByTier(missions, customMissions, tiers, tierStats, scenarioMultiplier);
  const totalMissionPoints = missionData.reduce((s, d) => s + d.totalPoints, 0);

  const totalPointsEarned = totalPurchasePoints + totalMissionPoints;

  // Points redeemed (estimated from burn rate)
  const avgBurnRate = 40; // will be overridden
  const pointsRedeemed = totalPointsEarned * (avgBurnRate / 100);

  // Rewards triggered
  const rewardCosts = computeRewardsCost(rewards, avgBurnRate, tierStats, tiers);

  return {
    totalCustomers,
    totalRevenue,
    totalPurchasePoints: Math.round(totalPurchasePoints),
    totalMissionPoints: Math.round(totalMissionPoints),
    totalPointsEarned: Math.round(totalPointsEarned),
    pointsRedeemed: Math.round(pointsRedeemed),
    rewardsCost: rewardCosts.totalCost,
    burnCost: rewardCosts.burnCost,
    perkCost: rewardCosts.perkCost,
    incrementalRevenue: rewardCosts.incrementalRevenue,
    grossProfit: rewardCosts.incrementalRevenue * (grossMargin / 100),
    netProfit: rewardCosts.incrementalRevenue * (grossMargin / 100) - rewardCosts.totalCost,
    roi: rewardCosts.totalCost > 0
      ? ((rewardCosts.incrementalRevenue * (grossMargin / 100) - rewardCosts.totalCost) / rewardCosts.totalCost * 100)
      : 0,
  };
}

// ── Expiration impact (rough estimate) ──
export function computeExpirationImpact(expirationMonths, isRolling) {
  if (!expirationMonths || expirationMonths <= 0) return 0;
  const base = Math.max(0, 1 - expirationMonths / 24);
  const factor = isRolling ? 0.6 : 1;
  return Math.min(base * factor * 100, 80);
}

// ── 12-month projection ──
export function compute12MonthProjection(tierStats, rewards, settings, tiers, missions, customMissions, scenarioMultiplier = 1) {
  const months = [];
  const { cashbackRate, grossMargin } = settings;
  const { pointsPerEuro } = derivePointsFromCashback(cashbackRate);

  for (let m = 1; m <= 12; m++) {
    const factor = m / 12;
    let cumulativeCost = 0;
    let cumulativeRevenue = 0;
    let cumulativeProfit = 0;

    tierStats.forEach((stat, i) => {
      const multiplier = tiers[i]?.pointsMultiplier || 1;
      const monthlyRevenue = (stat.revenue / 12) * m;

      const normalized = rewards.map(r => normalizeReward(r, tiers.length));
      normalized.forEach(reward => {
        if (!reward.assignedTiers?.[i]) return;
        const utilization = (reward.utilizationByTier?.[i] ?? 30) / 100 * factor * scenarioMultiplier;
        cumulativeCost += stat.count * reward.realCost * utilization;
        if (reward.minPurchase > 0) {
          cumulativeRevenue += stat.count * reward.minPurchase * utilization;
        }
      });
    });

    cumulativeProfit = cumulativeRevenue * (grossMargin / 100) - cumulativeCost;
    months.push({
      month: m,
      cost: Math.round(cumulativeCost),
      revenue: Math.round(cumulativeRevenue),
      profit: Math.round(cumulativeProfit),
    });
  }

  return months;
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
