import { getLocalDateKey } from './dailyStreak';

export type DailyMissionIconKey =
  | 'target'
  | 'shield'
  | 'flame'
  | 'home'
  | 'trophy'
  | 'star'
  | 'footprints';

export interface DailyMissionSpec {
  id:
    | 'score_500_match'
    | 'clean_win'
    | 'bullseyes_3_day'
    | 'claim_2_houses'
    | 'streak_3_match'
    | 'win_2_matches'
    | 'rounds_6_day';
  title: string;
  description: string;
  target: number;
  unitLabel: string;
  cowrieReward: number;
  icon: DailyMissionIconKey;
}

export interface DailyMissionState {
  dateKey: string;
  missionId: DailyMissionSpec['id'];
  progress: number;
  completed: boolean;
  claimed: boolean;
  totalCompleted: number;
  rerolledOnDate?: string | null;
  rerolledCount?: number;
}

export interface DailyMissionMatchInput {
  won: boolean;
  score: number;
  fouls: number;
  perfectTosses: number;
  housesClaimed: number;
  bestStreak: number;
  roundsCleared: number;
}

export interface DailyMissionEvalResult {
  nextState: DailyMissionState;
  spec: DailyMissionSpec;
  completedNow: boolean;
  rewardCowries: number;
}

export const DAILY_MISSION_CATALOG: DailyMissionSpec[] = [
  {
    id: 'score_500_match',
    title: 'High Courtyard Score',
    description: 'Score 500 points in one match.',
    target: 500,
    unitLabel: 'pts',
    cowrieReward: 45,
    icon: 'star',
  },
  {
    id: 'clean_win',
    title: 'Steady Footwork',
    description: 'Win a match without any fouls.',
    target: 1,
    unitLabel: 'win',
    cowrieReward: 55,
    icon: 'shield',
  },
  {
    id: 'bullseyes_3_day',
    title: 'Dead-Center Trio',
    description: 'Land 3 Bullseye tosses today.',
    target: 3,
    unitLabel: 'bullseyes',
    cowrieReward: 50,
    icon: 'target',
  },
  {
    id: 'claim_2_houses',
    title: 'Ekizimbe Builder',
    description: 'Claim 2 Houses in matches today.',
    target: 2,
    unitLabel: 'houses',
    cowrieReward: 55,
    icon: 'home',
  },
  {
    id: 'streak_3_match',
    title: 'Unbroken Rhythm',
    description: 'Reach a 3-square streak in one match.',
    target: 3,
    unitLabel: 'streak',
    cowrieReward: 45,
    icon: 'flame',
  },
  {
    id: 'win_2_matches',
    title: 'Compound Regular',
    description: 'Win 2 matches today on any court.',
    target: 2,
    unitLabel: 'wins',
    cowrieReward: 60,
    icon: 'trophy',
  },
  {
    id: 'rounds_6_day',
    title: 'Sunlit Endurance',
    description: 'Clear 6 hopscotch rounds today.',
    target: 6,
    unitLabel: 'rounds',
    cowrieReward: 45,
    icon: 'footprints',
  },
];

const LOCAL_DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function getUtcDayNumber(dateKey: string): number {
  const match = LOCAL_DATE_KEY_RE.exec(dateKey);
  if (!match) return 0;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function pickMissionForDate(dateKey: string): DailyMissionSpec {
  const dayNum = Math.abs(getUtcDayNumber(dateKey));
  // Multiply by a prime coprime to catalog length (7) for varied day-to-day ordering
  const index = (dayNum * 3) % DAILY_MISSION_CATALOG.length;
  return DAILY_MISSION_CATALOG[index] ?? DAILY_MISSION_CATALOG[0];
}

export function getDailyMissionSpec(id: string): DailyMissionSpec {
  return DAILY_MISSION_CATALOG.find((m) => m.id === id) ?? DAILY_MISSION_CATALOG[0];
}

export function createDefaultDailyMission(now = new Date()): DailyMissionState {
  const dateKey = getLocalDateKey(now);
  const spec = pickMissionForDate(dateKey);
  return {
    dateKey,
    missionId: spec.id,
    progress: 0,
    completed: false,
    claimed: false,
    totalCompleted: 0,
    rerolledOnDate: null,
    rerolledCount: 0,
  };
}

export function syncDailyMissionForToday(
  state: DailyMissionState,
  now = new Date()
): DailyMissionState {
  const todayKey = getLocalDateKey(now);
  if (state.dateKey === todayKey) {
    return state;
  }
  const spec = pickMissionForDate(todayKey);
  return {
    dateKey: todayKey,
    missionId: spec.id,
    progress: 0,
    completed: false,
    claimed: false,
    totalCompleted: Math.max(0, state.totalCompleted),
    rerolledOnDate: null,
    rerolledCount: Math.max(0, state.rerolledCount ?? 0),
  };
}

export function applyDailyMissionReroll(
  state: DailyMissionState,
  nextMissionId: string,
  now = new Date()
): DailyMissionState {
  const synced = syncDailyMissionForToday(state, now);
  const matchedSpec = DAILY_MISSION_CATALOG.find((m) => m.id === nextMissionId);
  if (!matchedSpec) {
    return synced;
  }
  return {
    dateKey: synced.dateKey,
    missionId: matchedSpec.id,
    progress: 0,
    completed: false,
    claimed: false,
    totalCompleted: synced.totalCompleted,
    rerolledOnDate: synced.dateKey,
    rerolledCount: Math.max(0, synced.rerolledCount ?? 0) + 1,
  };
}

export function sanitizeDailyMission(raw: unknown, now = new Date()): DailyMissionState {
  const fallback = createDefaultDailyMission(now);
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }
  const candidate = raw as Partial<DailyMissionState>;
  const dateKey =
    typeof candidate.dateKey === 'string' && LOCAL_DATE_KEY_RE.test(candidate.dateKey)
      ? candidate.dateKey
      : fallback.dateKey;
  const totalCompleted =
    typeof candidate.totalCompleted === 'number' && Number.isFinite(candidate.totalCompleted)
      ? Math.max(0, Math.floor(candidate.totalCompleted))
      : 0;
  const rerolledCount =
    typeof candidate.rerolledCount === 'number' && Number.isFinite(candidate.rerolledCount)
      ? Math.max(0, Math.floor(candidate.rerolledCount))
      : 0;

  if (dateKey !== fallback.dateKey) {
    return {
      ...fallback,
      totalCompleted,
      rerolledCount,
    };
  }

  const expectedSpec = pickMissionForDate(dateKey);
  const validOverride =
    typeof candidate.missionId === 'string'
      ? DAILY_MISSION_CATALOG.find((m) => m.id === candidate.missionId)
      : undefined;
  const activeSpec = validOverride ?? expectedSpec;
  const missionId = activeSpec.id;
  const progress =
    typeof candidate.progress === 'number' && Number.isFinite(candidate.progress)
      ? Math.min(activeSpec.target, Math.max(0, Math.floor(candidate.progress)))
      : 0;
  const completed = Boolean(candidate.completed) || progress >= activeSpec.target;
  const claimed = completed ? Boolean(candidate.claimed) : false;
  const rerolledOnDate =
    typeof candidate.rerolledOnDate === 'string' && candidate.rerolledOnDate === dateKey
      ? dateKey
      : null;

  return {
    dateKey,
    missionId,
    progress: completed ? activeSpec.target : progress,
    completed,
    claimed,
    totalCompleted,
    rerolledOnDate,
    rerolledCount,
  };
}

export function evaluateDailyMissionMatch(
  prevState: DailyMissionState,
  match: DailyMissionMatchInput,
  now = new Date()
): DailyMissionEvalResult {
  const synced = syncDailyMissionForToday(prevState, now);
  const spec = getDailyMissionSpec(synced.missionId);

  if (synced.completed && synced.claimed) {
    return {
      nextState: synced,
      spec,
      completedNow: false,
      rewardCowries: 0,
    };
  }

  let nextProgress = synced.progress;
  switch (spec.id) {
    case 'score_500_match':
      nextProgress = Math.max(synced.progress, Math.min(spec.target, Math.floor(match.score)));
      break;
    case 'clean_win':
      nextProgress = match.won && match.fouls === 0 ? 1 : synced.progress;
      break;
    case 'bullseyes_3_day':
      nextProgress = Math.min(spec.target, synced.progress + Math.max(0, match.perfectTosses));
      break;
    case 'claim_2_houses':
      nextProgress = Math.min(spec.target, synced.progress + Math.max(0, match.housesClaimed));
      break;
    case 'streak_3_match':
      nextProgress = Math.max(synced.progress, Math.min(spec.target, Math.floor(match.bestStreak)));
      break;
    case 'win_2_matches':
      nextProgress = Math.min(spec.target, synced.progress + (match.won ? 1 : 0));
      break;
    case 'rounds_6_day':
      nextProgress = Math.min(spec.target, synced.progress + Math.max(0, match.roundsCleared));
      break;
  }

  const isNowComplete = nextProgress >= spec.target;
  if (isNowComplete) {
    const nextState: DailyMissionState = {
      ...synced,
      progress: spec.target,
      completed: true,
      claimed: true,
      totalCompleted: synced.totalCompleted + (synced.completed ? 0 : 1),
    };
    return {
      nextState,
      spec,
      completedNow: true,
      rewardCowries: spec.cowrieReward,
    };
  }

  return {
    nextState: {
      ...synced,
      progress: nextProgress,
    },
    spec,
    completedNow: false,
    rewardCowries: 0,
  };
}
