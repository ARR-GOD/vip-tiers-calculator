import { describe, it, expect } from 'vitest';
import { MISSION_CATALOG, RECOMMENDED_MISSION_IDS, catalogMission, recommendedMissions } from './missionCatalog';
import { buildProgramDefaults } from './programDefaults';
import { missionPoints } from '../utils/pointsModel';

const at = earnRate => ({ aov: 80, cashbackRate: 5, earnRate, earnRateManual: true });

describe('mission catalog', () => {
  it('holds the 39 missions of the Loyoly grid with unique ids', () => {
    expect(MISSION_CATALOG).toHaveLength(39);
    expect(new Set(MISSION_CATALOG.map(m => m.id)).size).toBe(39);
  });

  it('prices missions on the 1 pt/€ grid (Avis Google: 70 / 350 / 700)', () => {
    const review = catalogMission('review_google');
    expect([1, 5, 10].map(rate => missionPoints(review, at(rate)))).toEqual([70, 350, 700]);
    expect(missionPoints(catalogMission('reel_instagram'), at(10))).toBe(2000);
  });

  it('recommends 11 missions from the catalog, purchase first', () => {
    expect(RECOMMENDED_MISSION_IDS).toHaveLength(11);
    expect(RECOMMENDED_MISSION_IDS.every(id => catalogMission(id))).toBe(true);
    expect(recommendedMissions()[0].isPurchaseMission).toBe(true);
  });

  it('gives new programs the recommended preset (purchase only for luxury)', () => {
    expect(buildProgramDefaults({ aov: 80 }).missions.map(m => m.id)).toEqual(RECOMMENDED_MISSION_IDS);
    expect(buildProgramDefaults({ aov: 300, programType: 'luxury' }).missions.map(m => m.id)).toEqual(['purchase']);
  });

  it('returns fresh objects, so editing a program never touches the catalog', () => {
    const [first] = recommendedMissions();
    first.basePoints = 999;
    expect(catalogMission(first.id).basePoints).toBe(1);
  });
});
