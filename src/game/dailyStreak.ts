export interface DailyStreakState {
  currentStreak: number;
  bestStreak: number;
  lastClaimDate: string | null; // Local calendar YYYY-MM-DD
  totalDaysLogged: number;
}

export interface DailyStreakRewardTier {
  cycleDay: number;
  title: string;
  baseCowries: number;
}

export interface DailyStreakCheckInResult {
  nextStreak: DailyStreakState;
  claimedNow: boolean;
  rewardCowries: number;
  cycleDay: number;
  weekBonus: number;
  wasReset: boolean;
}

export const DEFAULT_DAILY_STREAK: DailyStreakState = {
  currentStreak: 0,
  bestStreak: 0,
  lastClaimDate: null,
  totalDaysLogged: 0,
};

export const DAILY_STREAK_REWARDS: DailyStreakRewardTier[] = [
  { cycleDay: 1, title: 'Morning Chalk', baseCowries: 15 },
  { cycleDay: 2, title: 'River Pebble', baseCowries: 20 },
  { cycleDay: 3, title: 'Midday Shade', baseCowries: 25 },
  { cycleDay: 4, title: 'Ekizimbe Warmup', baseCowries: 35 },
  { cycleDay: 5, title: 'Ngoma Rhythm', baseCowries: 45 },
  { cycleDay: 6, title: 'Golden Hour', baseCowries: 60 },
  { cycleDay: 7, title: 'Courtyard Jackpot', baseCowries: 100 },
];

const LOCAL_DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseUtcDayNumber(dateKey: string): number | null {
  const match = LOCAL_DATE_KEY_RE.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function diffLocalDays(fromKey: string, toKey: string): number | null {
  const fromDay = parseUtcDayNumber(fromKey);
  const toDay = parseUtcDayNumber(toKey);
  if (fromDay === null || toDay === null) return null;
  return toDay - fromDay;
}

export function sanitizeDailyStreak(raw: unknown): DailyStreakState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_DAILY_STREAK };
  }
  const candidate = raw as Partial<DailyStreakState>;
  const currentStreak =
    typeof candidate.currentStreak === 'number' && Number.isFinite(candidate.currentStreak)
      ? Math.max(0, Math.floor(candidate.currentStreak))
      : 0;
  const bestStreak =
    typeof candidate.bestStreak === 'number' && Number.isFinite(candidate.bestStreak)
      ? Math.max(currentStreak, Math.floor(candidate.bestStreak))
      : currentStreak;
  const lastClaimDate =
    typeof candidate.lastClaimDate === 'string' && LOCAL_DATE_KEY_RE.test(candidate.lastClaimDate)
      ? candidate.lastClaimDate
      : null;
  const totalDaysLogged =
    typeof candidate.totalDaysLogged === 'number' && Number.isFinite(candidate.totalDaysLogged)
      ? Math.max(currentStreak > 0 ? 1 : 0, Math.floor(candidate.totalDaysLogged))
      : currentStreak;

  return {
    currentStreak,
    bestStreak,
    lastClaimDate,
    totalDaysLogged,
  };
}

export function getCycleRewardForStreak(streakDay: number): {
  cycleDay: number;
  weekNumber: number;
  baseCowries: number;
  weekBonus: number;
  totalCowries: number;
  title: string;
} {
  const safeStreak = Math.max(1, Math.floor(streakDay));
  const cycleDay = ((safeStreak - 1) % 7) + 1;
  const weekNumber = Math.floor((safeStreak - 1) / 7) + 1;
  const tier = DAILY_STREAK_REWARDS[cycleDay - 1] ?? DAILY_STREAK_REWARDS[0];
  const weekBonus = Math.min(45, (weekNumber - 1) * 15);
  return {
    cycleDay,
    weekNumber,
    baseCowries: tier.baseCowries,
    weekBonus,
    totalCowries: tier.baseCowries + weekBonus,
    title: tier.title,
  };
}

export function applyDailyLoginCheckIn(
  prev: DailyStreakState,
  now = new Date()
): DailyStreakCheckInResult {
  const todayKey = getLocalDateKey(now);

  if (prev.lastClaimDate === todayKey) {
    const info = getCycleRewardForStreak(Math.max(1, prev.currentStreak));
    return {
      nextStreak: prev,
      claimedNow: false,
      rewardCowries: 0,
      cycleDay: info.cycleDay,
      weekBonus: 0,
      wasReset: false,
    };
  }

  let nextCount = 1;
  let wasReset = false;

  if (prev.lastClaimDate !== null) {
    const delta = diffLocalDays(prev.lastClaimDate, todayKey);
    if (delta !== null && delta < 0) {
      const info = getCycleRewardForStreak(Math.max(1, prev.currentStreak));
      return {
        nextStreak: prev,
        claimedNow: false,
        rewardCowries: 0,
        cycleDay: info.cycleDay,
        weekBonus: 0,
        wasReset: false,
      };
    }
    if (delta === 1) {
      nextCount = Math.max(1, prev.currentStreak + 1);
    } else {
      nextCount = 1;
      wasReset = prev.currentStreak > 0;
    }
  }

  const reward = getCycleRewardForStreak(nextCount);
  const nextStreak: DailyStreakState = {
    currentStreak: nextCount,
    bestStreak: Math.max(prev.bestStreak, nextCount),
    lastClaimDate: todayKey,
    totalDaysLogged: prev.totalDaysLogged + 1,
  };

  return {
    nextStreak,
    claimedNow: true,
    rewardCowries: reward.totalCowries,
    cycleDay: reward.cycleDay,
    weekBonus: reward.weekBonus,
    wasReset,
  };
}
