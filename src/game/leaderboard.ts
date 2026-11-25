import { CourtVenueId, PlayMode } from './types';

export interface GlobalLeaderboardEntry {
  playerId: string;
  name: string;
  bestScore: number;
  venue: CourtVenueId;
  mode: PlayMode;
  wins: number;
  bullseyes: number;
  houses: number;
  updatedAt: string;
}

export interface GlobalLeaderboardResponse {
  entries: GlobalLeaderboardEntry[];
  totalPlayers: number;
  yourEntry: GlobalLeaderboardEntry | null;
  yourRank: number | null;
}

export interface LeaderboardSubmission {
  playerId: string;
  name: string;
  score: number;
  venue: CourtVenueId;
  mode: PlayMode;
  wins: number;
  bullseyes: number;
  houses: number;
}

const PLAYER_ID_KEY = 'sonko_player_id_v1';
const PLAYER_NAME_KEY = 'sonko_player_name_v1';

export function getOrCreateLeaderboardPlayerId(): string {
  if (typeof window === 'undefined') return 'local_player_default';
  try {
    const existing = window.localStorage.getItem(PLAYER_ID_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
      return existing;
    }
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `sk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(PLAYER_ID_KEY, generated);
    return generated;
  } catch {
    return `sk_${Date.now().toString(36)}`;
  }
}

export function loadPlayerDisplayName(): string {
  if (typeof window === 'undefined') return 'Courtyard Player';
  try {
    const saved = window.localStorage.getItem(PLAYER_NAME_KEY)?.trim();
    if (saved && saved.length > 0) {
      return saved.slice(0, 24);
    }
  } catch {
    // Ignore storage read errors
  }
  return 'Courtyard Player';
}

export function savePlayerDisplayName(name: string): string {
  const cleaned = name.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 24) || 'Courtyard Player';
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PLAYER_NAME_KEY, cleaned);
    } catch {
      // Ignore storage write errors
    }
  }
  return cleaned;
}

export async function fetchGlobalLeaderboard(
  playerId?: string
): Promise<GlobalLeaderboardResponse> {
  const qs = playerId ? `?playerId=${encodeURIComponent(playerId)}` : '';
  const res = await fetch(`/api/leaderboard${qs}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to load leaderboard (${res.status})`);
  }
  const data = (await res.json()) as Partial<GlobalLeaderboardResponse>;
  return {
    entries: Array.isArray(data.entries) ? data.entries : [],
    totalPlayers: typeof data.totalPlayers === 'number' ? data.totalPlayers : 0,
    yourEntry: data.yourEntry ?? null,
    yourRank: typeof data.yourRank === 'number' ? data.yourRank : null,
  };
}

export async function submitGlobalLeaderboardScore(
  payload: LeaderboardSubmission
): Promise<GlobalLeaderboardResponse> {
  const res = await fetch('/api/leaderboard', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errBody?.error ?? `Failed to submit score (${res.status})`);
  }
  const data = (await res.json()) as Partial<GlobalLeaderboardResponse>;
  return {
    entries: Array.isArray(data.entries) ? data.entries : [],
    totalPlayers: typeof data.totalPlayers === 'number' ? data.totalPlayers : 0,
    yourEntry: data.yourEntry ?? null,
    yourRank: typeof data.yourRank === 'number' ? data.yourRank : null,
  };
}
