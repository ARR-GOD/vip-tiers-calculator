/**
 * Pure JS recommendation engine — returns personalized text per step.
 * No runtime AI — all logic is deterministic based on config/settings/data.
 */

const INDUSTRY_NAMES_FR = {
  fashion: 'la mode', beauty: 'la beauté', food: "l'alimentation",
  health: 'la santé', electronics: "l'électronique", sports: 'le sport',
  home: 'la maison', other: "l'e-commerce",
};
const INDUSTRY_NAMES_EN = {
  fashion: 'fashion', beauty: 'beauty', food: 'food & beverage',
  health: 'health', electronics: 'electronics', sports: 'sports',
  home: 'home & garden', other: 'e-commerce',
};

export function getRecommendation(stepKey, { brandAnalysis, config, settings, customers, lang }) {
  const t = lang === 'fr';
  const industry = brandAnalysis?.industry || '';
  const indFr = INDUSTRY_NAMES_FR[industry] || "l'e-commerce";
  const indEn = INDUSTRY_NAMES_EN[industry] || 'e-commerce';
  const margin = settings?.grossMargin || 50;
  const programType = brandAnalysis?.recommended_program || (config?.hasMissions ? 'mid' : 'luxury');
  const customerCount = customers?.length || 0;

  switch (stepKey) {
    case 1: // CSV Import
      return {
        body: t
          ? `Pour le secteur ${indFr}, nous recommandons d'importer au moins 6 mois de données clients. Plus le volume est important, plus les paliers seront précis.`
          : `For the ${indEn} sector, we recommend importing at least 6 months of customer data. The larger the volume, the more precise the tiers will be.`,
      };

    case 2: // Program Config
      if (margin < 40) {
        return {
          body: t
            ? `Avec ${margin}% de marge, un programme VIP pur est idéal. Privilégiez les avantages exclusifs plutôt que les réductions.`
            : `With ${margin}% margin, a pure VIP program is ideal. Favor exclusive perks over discounts.`,
        };
      }
      return {
        body: t
          ? `Avec ${margin}% de marge, un programme ${programType === 'luxury' ? 'prestige' : 'à points'} est bien adapté. Le taux de récompense optimal se situe entre ${Math.round(margin * 0.04)}% et ${Math.round(margin * 0.08)}%.`
          : `With ${margin}% margin, a ${programType === 'luxury' ? 'prestige' : 'points-based'} program is well suited. Optimal reward rate is between ${Math.round(margin * 0.04)}% and ${Math.round(margin * 0.08)}%.`,
      };

    case 3: // Missions
      if (!config?.hasMissions) return null;
      return {
        body: t
          ? `Pour le secteur ${indFr}, les missions les plus efficaces sont le parrainage et les avis produit. Elles génèrent un fort ROI avec un coût maîtrisé.`
          : `For the ${indEn} sector, the most effective missions are referrals and product reviews. They generate strong ROI with controlled cost.`,
      };

    case 4: // Rewards
      return {
        body: t
          ? `Avec votre marge de ${margin}%, privilégiez les récompenses expérientielles (accès VIP, événements) qui ont un coût réel faible mais une valeur perçue élevée.`
          : `With your ${margin}% margin, favor experiential rewards (VIP access, events) which have low real cost but high perceived value.`,
      };

    case 5: // Tiers
      if (customerCount < 500) {
        return {
          body: t
            ? `Pour ${customerCount} clients, 2 ou 3 paliers sont optimaux. Au-delà, les paliers supérieurs seront trop peu peuplés pour être significatifs.`
            : `For ${customerCount} customers, 2 or 3 tiers are optimal. Beyond that, upper tiers will be too sparsely populated to be meaningful.`,
        };
      }
      return {
        body: t
          ? `Pour ${customerCount} clients, 3 paliers est un bon équilibre. Le palier supérieur devrait représenter 10–15% des clients pour créer un sentiment d'exclusivité.`
          : `For ${customerCount} customers, 3 tiers is a good balance. The top tier should represent 10–15% of customers to create a sense of exclusivity.`,
      };

    case 6: // Dashboard
      return {
        body: t
          ? `Votre programme est prêt ! Téléchargez le dashboard et partagez-le avec votre équipe. Ajustez le scénario pour voir l'impact sur les projections.`
          : `Your program is ready! Download the dashboard and share it with your team. Adjust the scenario to see the impact on projections.`,
      };

    default:
      return null;
  }
}
