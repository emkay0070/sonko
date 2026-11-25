import { COURT_VENUES, ProgressionData } from './progression';

export type AchievementCategory = 'COURTYARD' | 'TOUR' | 'COLLECTION';

export type AchievementIconKey =
  | 'footprints'
  | 'trophy'
  | 'target'
  | 'crosshair'
  | 'home'
  | 'crown'
  | 'shield'
  | 'flame'
  | 'compass'
  | 'wind'
  | 'droplets'
  | 'sparkles'
  | 'award'
  | 'swords'
  | 'shopping'
  | 'star';

export interface AchievementProgress {
  current: number;
  target: number;
}

export interface LiveAchievementContext {
  bullseyes?: number;
  houses?: number;
  bestStreak?: number;
  score?: number;
}

export interface AchievementSpec {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  cowrieReward: number;
  icon: AchievementIconKey;
  getProgress: (prog: ProgressionData, live?: LiveAchievementContext) => AchievementProgress;
  isEarned: (prog: ProgressionData, live?: LiveAchievementContext) => boolean;
}

function customGearCount(prog: ProgressionData): number {
  const extraStones = Math.max(0, prog.unlockedStones.length - 1);
  const extraOutfits = Math.max(0, prog.unlockedOutfits.length - 1);
  const extraStencils = Math.max(0, prog.unlockedStencils.length - 1);
  return extraStones + extraOutfits + extraStencils;
}

function venuesConqueredCount(prog: ProgressionData): number {
  return COURT_VENUES.filter((v) => (prog.tourWins[v.id] ?? 0) > 0).length;
}

export const ACHIEVEMENT_CATALOG: AchievementSpec[] = [
  {
    id: 'first_match',
    title: 'First Chalk Line',
    description: 'Complete your first full match of Sonko on any court.',
    category: 'COURTYARD',
    cowrieReward: 15,
    icon: 'footprints',
    getProgress: (p) => ({ current: Math.min(1, p.stats.matchesPlayed), target: 1 }),
    isEarned: (p) => p.stats.matchesPlayed >= 1,
  },
  {
    id: 'first_win',
    title: 'Compound Champion',
    description: 'Win your first match against a rival or in Solo Mastery.',
    category: 'COURTYARD',
    cowrieReward: 25,
    icon: 'trophy',
    getProgress: (p) => ({ current: Math.min(1, p.stats.matchesWon), target: 1 }),
    isEarned: (p) => p.stats.matchesWon >= 1,
  },
  {
    id: 'first_bullseye',
    title: 'Dead-Center Toss',
    description: 'Land your river stone dead-center inside a chalk square for a Bullseye.',
    category: 'COURTYARD',
    cowrieReward: 20,
    icon: 'target',
    getProgress: (p, live) => ({
      current: Math.min(1, Math.max(p.stats.totalBullseyes, live?.bullseyes ?? 0)),
      target: 1,
    }),
    isEarned: (p, live) => Math.max(p.stats.totalBullseyes, live?.bullseyes ?? 0) >= 1,
  },
  {
    id: 'bullseyes_10',
    title: 'Sharp Courtyard Eye',
    description: 'Land 10 career Bullseye tosses across your matches.',
    category: 'COURTYARD',
    cowrieReward: 40,
    icon: 'crosshair',
    getProgress: (p) => ({ current: Math.min(10, p.stats.totalBullseyes), target: 10 }),
    isEarned: (p) => p.stats.totalBullseyes >= 10,
  },
  {
    id: 'first_house',
    title: 'Ekizimbe Founder',
    description: 'Claim your first House with a blind over-the-shoulder toss.',
    category: 'COURTYARD',
    cowrieReward: 25,
    icon: 'home',
    getProgress: (p, live) => ({
      current: Math.min(1, Math.max(p.stats.totalHouses, live?.houses ?? 0)),
      target: 1,
    }),
    isEarned: (p, live) => Math.max(p.stats.totalHouses, live?.houses ?? 0) >= 1,
  },
  {
    id: 'houses_5',
    title: 'Village Landlord',
    description: 'Claim 5 Houses across your courtyard career.',
    category: 'COURTYARD',
    cowrieReward: 50,
    icon: 'crown',
    getProgress: (p) => ({ current: Math.min(5, p.stats.totalHouses), target: 5 }),
    isEarned: (p) => p.stats.totalHouses >= 5,
  },
  {
    id: 'streak_4',
    title: 'Unbroken Rhythm',
    description: 'Reach a 4-square clearing streak without a single foul.',
    category: 'COURTYARD',
    cowrieReward: 30,
    icon: 'flame',
    getProgress: (p, live) => ({
      current: Math.min(4, Math.max(p.stats.bestStreak, live?.bestStreak ?? 0)),
      target: 4,
    }),
    isEarned: (p, live) => Math.max(p.stats.bestStreak, live?.bestStreak ?? 0) >= 4,
  },
  {
    id: 'zero_foul_win',
    title: 'Flawless Footwork',
    description: 'Win a match without committing a single line, toss, or balance foul.',
    category: 'COURTYARD',
    cowrieReward: 50,
    icon: 'shield',
    getProgress: (p) => ({ current: Math.min(1, p.stats.cleanMatchesWon), target: 1 }),
    isEarned: (p) => p.stats.cleanMatchesWon >= 1,
  },
  {
    id: 'score_1000',
    title: 'Grand Scorer',
    description: 'Reach 1,000 or more points in a single match.',
    category: 'COURTYARD',
    cowrieReward: 45,
    icon: 'star',
    getProgress: (p, live) => ({
      current: Math.min(1000, Math.max(p.stats.bestScore, live?.score ?? 0)),
      target: 1000,
    }),
    isEarned: (p, live) => Math.max(p.stats.bestScore, live?.score ?? 0) >= 1000,
  },
  {
    id: 'hard_win',
    title: 'Neighborhood Legend',
    description: 'Defeat the AI rival on Hard difficulty.',
    category: 'COURTYARD',
    cowrieReward: 60,
    icon: 'swords',
    getProgress: (p) => ({ current: Math.min(1, p.stats.hardWins), target: 1 }),
    isEarned: (p) => p.stats.hardWins >= 1,
  },
  {
    id: 'tour_kampala',
    title: 'Kampala Red Earth',
    description: 'Win a match on the classic Kampala Murram court.',
    category: 'TOUR',
    cowrieReward: 25,
    icon: 'compass',
    getProgress: (p) => ({ current: Math.min(1, p.tourWins.kampala_murram), target: 1 }),
    isEarned: (p) => p.tourWins.kampala_murram >= 1,
  },
  {
    id: 'tour_entebbe',
    title: 'Lakeside Breeze',
    description: 'Conquer the coastal winds at Entebbe Lakeside.',
    category: 'TOUR',
    cowrieReward: 30,
    icon: 'wind',
    getProgress: (p) => ({ current: Math.min(1, p.tourWins.entebbe_sand), target: 1 }),
    isEarned: (p) => p.tourWins.entebbe_sand >= 1,
  },
  {
    id: 'tour_jinja',
    title: 'Rainy Yard Dancer',
    description: 'Win through the slick puddles of Jinja Rainy Yard.',
    category: 'TOUR',
    cowrieReward: 35,
    icon: 'droplets',
    getProgress: (p) => ({ current: Math.min(1, p.tourWins.jinja_rain), target: 1 }),
    isEarned: (p) => p.tourWins.jinja_rain >= 1,
  },
  {
    id: 'tour_ndere',
    title: 'Lantern Keeper',
    description: 'Win under the fireflies at Ndere Lantern Court.',
    category: 'TOUR',
    cowrieReward: 40,
    icon: 'sparkles',
    getProgress: (p) => ({ current: Math.min(1, p.tourWins.ndere_night), target: 1 }),
    isEarned: (p) => p.tourWins.ndere_night >= 1,
  },
  {
    id: 'tour_all_4',
    title: 'Uganda Tour Champion',
    description: 'Stamp your Tour card with victories at all 4 regional venues.',
    category: 'TOUR',
    cowrieReward: 80,
    icon: 'award',
    getProgress: (p) => ({ current: venuesConqueredCount(p), target: 4 }),
    isEarned: (p) => venuesConqueredCount(p) >= 4,
  },
  {
    id: 'gear_collector',
    title: 'Stall Connoisseur',
    description: 'Unlock 3 custom Stones, Kitenge Outfits, or House Stencils.',
    category: 'COLLECTION',
    cowrieReward: 40,
    icon: 'shopping',
    getProgress: (p) => ({ current: Math.min(3, customGearCount(p)), target: 3 }),
    isEarned: (p) => customGearCount(p) >= 3,
  },
  {
    id: 'daily_streak_3',
    title: 'Morning Regular',
    description: 'Log in to Sonko 3 days in a row to build a daily courtyard streak.',
    category: 'COURTYARD',
    cowrieReward: 35,
    icon: 'flame',
    getProgress: (p) => ({
      current: Math.min(3, Math.max(p.dailyStreak.currentStreak, p.dailyStreak.bestStreak)),
      target: 3,
    }),
    isEarned: (p) => Math.max(p.dailyStreak.currentStreak, p.dailyStreak.bestStreak) >= 3,
  },
];

export function evaluateAchievements(
  progression: ProgressionData,
  live?: LiveAchievementContext
): { next: ProgressionData; newlyUnlocked: AchievementSpec[] } {
  const unlockedAchievements = { ...progression.unlockedAchievements };
  const newlyUnlocked: AchievementSpec[] = [];
  let bonusCowries = 0;
  const nowIso = new Date().toISOString();

  for (const spec of ACHIEVEMENT_CATALOG) {
    if (unlockedAchievements[spec.id]) continue;
    if (spec.isEarned(progression, live)) {
      unlockedAchievements[spec.id] = nowIso;
      newlyUnlocked.push(spec);
      bonusCowries += spec.cowrieReward;
    }
  }

  if (newlyUnlocked.length === 0) {
    return { next: progression, newlyUnlocked: [] };
  }

  return {
    next: {
      ...progression,
      cowries: progression.cowries + bonusCowries,
      unlockedAchievements,
    },
    newlyUnlocked,
  };
}
