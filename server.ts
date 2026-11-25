import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response } from 'express';
import { unzipSync } from 'fflate';
import { WebSocketServer, WebSocket } from 'ws';
import {
  type CompliancePageId,
  injectAdsenseHeadIntoHtml,
  renderAdsTxt,
  renderComplianceHtmlPage,
  renderRobotsTxt,
  renderSitemapXml,
  resolveAdsenseRuntimeConfig,
  resolveSafeOrigin,
} from './server/adsenseCompliance.ts';

type CourtSize = 5 | 10;
type CourtVenueId = 'kampala_murram' | 'entebbe_sand' | 'jinja_rain' | 'ndere_night';
type StoneId = 'river_pebble' | 'kisii_soapstone' | 'entebbe_basalt' | 'cowrie_inlaid' | 'royal_sunstone';
type OutfitId = 'banana_emerald' | 'kampala_sunset' | 'lake_victoria' | 'barkcloth_royal' | 'crested_plumage';
type StencilId = 'basket_weave' | 'sunburst' | 'royal_drums' | 'crested_crown';

interface PlayerCosmetics {
  stoneId: StoneId;
  outfitId: OutfitId;
  stencilId: StencilId;
  hairStyle: 'braids' | 'afro' | 'bun' | 'fade';
  skinTone: string;
  primaryColor?: string;
  accentColor?: string;
}

interface ServerPlayerSlot {
  clientId: string;
  slot: 0 | 1;
  name: string;
  connected: boolean;
  cosmetics: PlayerCosmetics;
  targetSquare: number;
  score: number;
  housesOwned: number[];
  streak: number;
  bestStreak: number;
  perfectTosses: number;
  fouls: number;
  roundsCleared: number;
  ws: WebSocket | null;
}

interface RoomState {
  code: string;
  isPublic: boolean;
  courtSize: CourtSize;
  venue: CourtVenueId;
  status: 'WAITING' | 'PLAYING' | 'GAME_OVER';
  activeSlot: 0 | 1;
  turnCount: number;
  windX: number;
  puddleSquares: number[];
  houses: Record<number, 0 | 1>;
  winnerSlot: 0 | 1 | null;
  winReason: string | null;
  rematchVotes: [boolean, boolean];
  slots: [ServerPlayerSlot | null, ServerPlayerSlot | null];
  lastActiveAt: number;
}

interface SquareBox {
  id: number;
  row: number;
  isHome: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

function buildServerSquares(courtSize: CourtSize): SquareBox[] {
  const rows =
    courtSize === 5
      ? [
          { row: 0, items: [{ id: 1, side: 'center' as const, isHome: false }] },
          {
            row: 1,
            items: [
              { id: 2, side: 'left' as const, isHome: false },
              { id: 3, side: 'right' as const, isHome: false },
            ],
          },
          { row: 2, items: [{ id: 4, side: 'center' as const, isHome: false }] },
          { row: 3, items: [{ id: 5, side: 'center' as const, isHome: true }] },
        ]
      : [
          { row: 0, items: [{ id: 1, side: 'center' as const, isHome: false }] },
          { row: 1, items: [{ id: 2, side: 'center' as const, isHome: false }] },
          { row: 2, items: [{ id: 3, side: 'center' as const, isHome: false }] },
          {
            row: 3,
            items: [
              { id: 4, side: 'left' as const, isHome: false },
              { id: 5, side: 'right' as const, isHome: false },
            ],
          },
          { row: 4, items: [{ id: 6, side: 'center' as const, isHome: false }] },
          {
            row: 5,
            items: [
              { id: 7, side: 'left' as const, isHome: false },
              { id: 8, side: 'right' as const, isHome: false },
            ],
          },
          { row: 6, items: [{ id: 9, side: 'center' as const, isHome: false }] },
          { row: 7, items: [{ id: 10, side: 'center' as const, isHome: true }] },
        ];

  const squares: SquareBox[] = [];
  const totalRows = rows.length;
  const topPad = 0.07;
  const bottomPad = 0.14;
  const rowH = (1 - topPad - bottomPad) / totalRows;
  const singleW = 0.34;
  const doubleW = 0.34;
  const homeW = 0.56;

  for (const r of rows) {
    const y = 1 - bottomPad - (r.row + 1) * rowH;
    for (const item of r.items) {
      let w = singleW;
      let x = 0.5 - singleW / 2;
      if (item.isHome) {
        w = homeW;
        x = 0.5 - homeW / 2;
      } else if (item.side === 'left') {
        w = doubleW;
        x = 0.5 - doubleW;
      } else if (item.side === 'right') {
        w = doubleW;
        x = 0.5;
      }
      squares.push({ id: item.id, row: r.row, isHome: item.isHome, x, y, w, h: rowH });
    }
  }
  return squares;
}

function generateRoomCode(existing: Map<string, RoomState>): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += alphabet[crypto.randomInt(0, alphabet.length)];
    }
    if (!existing.has(code)) return code;
  }
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function rollVenueWind(venue: CourtVenueId): number {
  if (venue !== 'entebbe_sand') return 0;
  const dir = Math.random() > 0.5 ? 1 : -1;
  return Number((dir * (0.045 + Math.random() * 0.08)).toFixed(4));
}

function getVenuePuddles(venue: CourtVenueId, courtSize: CourtSize): number[] {
  if (venue !== 'jinja_rain') return [];
  return courtSize === 10 ? [2, 5, 8] : [2, 4];
}

function serializeRoom(room: RoomState) {
  return {
    code: room.code,
    isPublic: room.isPublic,
    courtSize: room.courtSize,
    venue: room.venue,
    status: room.status,
    activeSlot: room.activeSlot,
    turnCount: room.turnCount,
    windX: room.windX,
    puddleSquares: room.puddleSquares,
    houses: room.houses,
    winnerSlot: room.winnerSlot,
    winReason: room.winReason,
    rematchVotes: room.rematchVotes,
    players: room.slots.map((slot) =>
      slot
        ? {
            slot: slot.slot,
            name: slot.name,
            connected: slot.connected,
            cosmetics: slot.cosmetics,
            targetSquare: slot.targetSquare,
            score: slot.score,
            housesOwned: slot.housesOwned,
            streak: slot.streak,
            bestStreak: slot.bestStreak,
            perfectTosses: slot.perfectTosses,
            fouls: slot.fouls,
            roundsCleared: slot.roundsCleared,
          }
        : null
    ),
  };
}

function sendJson(ws: WebSocket | null, payload: unknown) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function broadcastRoom(room: RoomState, payload: unknown, exceptSlot?: 0 | 1) {
  for (const slot of room.slots) {
    if (!slot || slot.slot === exceptSlot) continue;
    sendJson(slot.ws, payload);
  }
}

async function startServer() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'sonko-courtyard' });
  });

  // Global Leaderboard persistence (/data/leaderboard.json)
  type LeaderboardMode = 'SOLO' | 'VS_BOT' | 'TWO_PLAYER' | 'TEAM_2V2' | 'ONLINE_1V1';
  interface LeaderboardEntry {
    playerId: string;
    name: string;
    bestScore: number;
    venue: CourtVenueId;
    mode: LeaderboardMode;
    wins: number;
    bullseyes: number;
    houses: number;
    updatedAt: string;
  }

  const leaderboardDataDir = path.resolve(__dirname, 'data');
  const leaderboardFilePath = path.resolve(leaderboardDataDir, 'leaderboard.json');
  const LEADERBOARD_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
  const VALID_VENUES = new Set<CourtVenueId>([
    'kampala_murram',
    'entebbe_sand',
    'jinja_rain',
    'ndere_night',
  ]);
  const VALID_MODES = new Set<LeaderboardMode>([
    'SOLO',
    'VS_BOT',
    'TWO_PLAYER',
    'TEAM_2V2',
    'ONLINE_1V1',
  ]);

  const sanitizePlayerName = (raw: unknown): string => {
    const cleaned = String(raw ?? '')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .trim()
      .slice(0, 24);
    return cleaned || 'Courtyard Player';
  };

  const sortLeaderboard = (entries: LeaderboardEntry[]): LeaderboardEntry[] =>
    [...entries].sort(
      (a, b) =>
        b.bestScore - a.bestScore ||
        b.wins - a.wins ||
        a.updatedAt.localeCompare(b.updatedAt)
    );

  const readLeaderboardEntries = (): LeaderboardEntry[] => {
    try {
      if (!fs.existsSync(leaderboardFilePath)) return [];
      const parsed = JSON.parse(fs.readFileSync(leaderboardFilePath, 'utf8'));
      if (!Array.isArray(parsed)) return [];
      const sanitized: LeaderboardEntry[] = [];
      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        const row = item as Partial<LeaderboardEntry>;
        if (typeof row.playerId !== 'string' || !LEADERBOARD_ID_RE.test(row.playerId)) continue;
        if (typeof row.bestScore !== 'number' || !Number.isFinite(row.bestScore) || row.bestScore < 1) {
          continue;
        }
        const venue: CourtVenueId = VALID_VENUES.has(row.venue as CourtVenueId)
          ? (row.venue as CourtVenueId)
          : 'kampala_murram';
        const mode: LeaderboardMode = VALID_MODES.has(row.mode as LeaderboardMode)
          ? (row.mode as LeaderboardMode)
          : 'VS_BOT';
        sanitized.push({
          playerId: row.playerId,
          name: sanitizePlayerName(row.name),
          bestScore: Math.min(50000, Math.floor(row.bestScore)),
          venue,
          mode,
          wins: typeof row.wins === 'number' && Number.isFinite(row.wins) ? Math.max(0, Math.floor(row.wins)) : 0,
          bullseyes:
            typeof row.bullseyes === 'number' && Number.isFinite(row.bullseyes)
              ? Math.max(0, Math.floor(row.bullseyes))
              : 0,
          houses:
            typeof row.houses === 'number' && Number.isFinite(row.houses)
              ? Math.max(0, Math.floor(row.houses))
              : 0,
          updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date().toISOString(),
        });
      }
      return sortLeaderboard(sanitized);
    } catch {
      return [];
    }
  };

  const writeLeaderboardEntries = (entries: LeaderboardEntry[]) => {
    fs.mkdirSync(leaderboardDataDir, { recursive: true });
    const sorted = sortLeaderboard(entries).slice(0, 200);
    fs.writeFileSync(leaderboardFilePath, JSON.stringify(sorted, null, 2), 'utf8');
  };

  const buildLeaderboardPayload = (entries: LeaderboardEntry[], playerId?: string) => {
    const sorted = sortLeaderboard(entries);
    const top10 = sorted.slice(0, 10);
    let yourEntry: LeaderboardEntry | null = null;
    let yourRank: number | null = null;
    if (playerId && LEADERBOARD_ID_RE.test(playerId)) {
      const idx = sorted.findIndex((e) => e.playerId === playerId);
      if (idx >= 0) {
        yourEntry = sorted[idx];
        yourRank = idx + 1;
      }
    }
    return {
      entries: top10,
      totalPlayers: sorted.length,
      yourEntry,
      yourRank,
    };
  };

  const upsertLeaderboardEntry = (input: {
    playerId: string;
    name: string;
    score: number;
    venue: CourtVenueId;
    mode: LeaderboardMode;
    wins: number;
    bullseyes: number;
    houses: number;
  }): LeaderboardEntry[] => {
    const entries = readLeaderboardEntries();
    const nowIso = new Date().toISOString();
    const existingIdx = entries.findIndex((e) => e.playerId === input.playerId);

    if (existingIdx >= 0) {
      const prev = entries[existingIdx];
      const beatBest = input.score >= prev.bestScore;
      entries[existingIdx] = {
        playerId: prev.playerId,
        name: input.name,
        bestScore: Math.max(prev.bestScore, input.score),
        venue: beatBest ? input.venue : prev.venue,
        mode: beatBest ? input.mode : prev.mode,
        wins: Math.max(prev.wins, input.wins),
        bullseyes: Math.max(prev.bullseyes, input.bullseyes),
        houses: Math.max(prev.houses, input.houses),
        updatedAt: beatBest ? nowIso : prev.updatedAt,
      };
    } else {
      entries.push({
        playerId: input.playerId,
        name: input.name,
        bestScore: input.score,
        venue: input.venue,
        mode: input.mode,
        wins: input.wins,
        bullseyes: input.bullseyes,
        houses: input.houses,
        updatedAt: nowIso,
      });
    }

    const sorted = sortLeaderboard(entries);
    writeLeaderboardEntries(sorted);
    return sorted;
  };

  app.get('/api/leaderboard', (req: Request, res: Response) => {
    const playerId = typeof req.query.playerId === 'string' ? req.query.playerId : undefined;
    const entries = readLeaderboardEntries();
    res.json(buildLeaderboardPayload(entries, playerId));
  });

  app.post('/api/leaderboard', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const playerId = typeof body.playerId === 'string' ? body.playerId.trim() : '';
    if (!LEADERBOARD_ID_RE.test(playerId)) {
      res.status(400).json({ error: 'Valid playerId (8-64 alphanumeric/dash chars) is required.' });
      return;
    }

    const rawScore = Number(body.score);
    if (!Number.isFinite(rawScore) || rawScore < 1 || rawScore > 50000) {
      res.status(400).json({ error: 'Score must be between 1 and 50,000 points.' });
      return;
    }

    const venueRaw = String(body.venue ?? 'kampala_murram') as CourtVenueId;
    if (!VALID_VENUES.has(venueRaw)) {
      res.status(400).json({ error: 'Invalid venue identifier.' });
      return;
    }

    const modeRaw = String(body.mode ?? 'VS_BOT') as LeaderboardMode;
    if (!VALID_MODES.has(modeRaw)) {
      res.status(400).json({ error: 'Invalid play mode.' });
      return;
    }

    const clampStat = (val: unknown, maxVal: number) => {
      const n = Number(val ?? 0);
      return Number.isFinite(n) ? Math.min(maxVal, Math.max(0, Math.floor(n))) : 0;
    };

    const sorted = upsertLeaderboardEntry({
      playerId,
      name: sanitizePlayerName(body.name),
      score: Math.floor(rawScore),
      venue: venueRaw,
      mode: modeRaw,
      wins: clampStat(body.wins, 10000),
      bullseyes: clampStat(body.bullseyes, 100000),
      houses: clampStat(body.houses, 100000),
    });

    res.json({
      ok: true,
      ...buildLeaderboardPayload(sorted, playerId),
    });
  });

  // Persistent Avatar Customization & Unlocked Equipment (/data/loadouts.json)
  interface StoredAvatarLoadout {
    version: 1;
    avatar: {
      hairStyle: 'braids' | 'afro' | 'bun' | 'fade';
      primaryColor: string;
      accentColor: string;
    };
    unlockedStones: string[];
    unlockedOutfits: string[];
    unlockedStencils: string[];
    equippedStone: string;
    equippedOutfit: string;
    equippedStencil: string;
    updatedAt: string;
  }

  const loadoutsFilePath = path.resolve(leaderboardDataDir, 'loadouts.json');
  const LOADOUT_HEX_RE = /^#[0-9a-fA-F]{6}$/;
  const LOADOUT_HAIR_STYLES = new Set(['braids', 'afro', 'bun', 'fade']);
  const LOADOUT_STONES = new Set([
    'river_pebble',
    'kisii_soapstone',
    'entebbe_basalt',
    'cowrie_inlaid',
    'royal_sunstone',
  ]);
  const LOADOUT_OUTFITS = new Set([
    'banana_emerald',
    'kampala_sunset',
    'lake_victoria',
    'barkcloth_royal',
    'crested_plumage',
  ]);
  const LOADOUT_STENCILS = new Set([
    'basket_weave',
    'sunburst',
    'royal_drums',
    'crested_crown',
  ]);
  const LOADOUT_OUTFIT_COLORS: Record<string, { primaryColor: string; accentColor: string }> = {
    banana_emerald: { primaryColor: '#15803D', accentColor: '#FBBF24' },
    kampala_sunset: { primaryColor: '#EA580C', accentColor: '#FEF08A' },
    lake_victoria: { primaryColor: '#1D4ED8', accentColor: '#FDE047' },
    barkcloth_royal: { primaryColor: '#7C2D12', accentColor: '#FBBF24' },
    crested_plumage: { primaryColor: '#18181B', accentColor: '#EF4444' },
  };

  const dedupeLoadoutList = (
    rawList: unknown,
    allowed: Set<string>,
    starter: string,
    equipped: string
  ): string[] => {
    const out: string[] = [starter];
    const seen = new Set<string>([starter]);
    if (Array.isArray(rawList)) {
      for (const item of rawList) {
        if (typeof item === 'string' && allowed.has(item) && !seen.has(item)) {
          seen.add(item);
          out.push(item);
        }
      }
    }
    if (allowed.has(equipped) && !seen.has(equipped)) {
      out.push(equipped);
    }
    return out;
  };

  const sanitizeStoredLoadout = (raw: unknown): StoredAvatarLoadout => {
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const equippedStone =
      typeof obj.equippedStone === 'string' && LOADOUT_STONES.has(obj.equippedStone)
        ? obj.equippedStone
        : 'river_pebble';
    const equippedOutfit =
      typeof obj.equippedOutfit === 'string' && LOADOUT_OUTFITS.has(obj.equippedOutfit)
        ? obj.equippedOutfit
        : 'banana_emerald';
    const equippedStencil =
      typeof obj.equippedStencil === 'string' && LOADOUT_STENCILS.has(obj.equippedStencil)
        ? obj.equippedStencil
        : 'basket_weave';

    const unlockedStones = dedupeLoadoutList(
      obj.unlockedStones,
      LOADOUT_STONES,
      'river_pebble',
      equippedStone
    );
    const unlockedOutfits = dedupeLoadoutList(
      obj.unlockedOutfits,
      LOADOUT_OUTFITS,
      'banana_emerald',
      equippedOutfit
    );
    const unlockedStencils = dedupeLoadoutList(
      obj.unlockedStencils,
      LOADOUT_STENCILS,
      'basket_weave',
      equippedStencil
    );

    const rawAvatar =
      obj.avatar && typeof obj.avatar === 'object' ? (obj.avatar as Record<string, unknown>) : {};
    const fallbackColors = LOADOUT_OUTFIT_COLORS[equippedOutfit] ?? LOADOUT_OUTFIT_COLORS.banana_emerald;
    const hairStyle =
      typeof rawAvatar.hairStyle === 'string' && LOADOUT_HAIR_STYLES.has(rawAvatar.hairStyle)
        ? (rawAvatar.hairStyle as StoredAvatarLoadout['avatar']['hairStyle'])
        : 'braids';
    const primaryColor =
      typeof rawAvatar.primaryColor === 'string' && LOADOUT_HEX_RE.test(rawAvatar.primaryColor.trim())
        ? rawAvatar.primaryColor.trim().toUpperCase()
        : fallbackColors.primaryColor;
    const accentColor =
      typeof rawAvatar.accentColor === 'string' && LOADOUT_HEX_RE.test(rawAvatar.accentColor.trim())
        ? rawAvatar.accentColor.trim().toUpperCase()
        : fallbackColors.accentColor;

    const parsedTime = typeof obj.updatedAt === 'string' ? Date.parse(obj.updatedAt) : NaN;
    const updatedAt = Number.isFinite(parsedTime)
      ? new Date(parsedTime).toISOString()
      : new Date().toISOString();

    return {
      version: 1,
      avatar: { hairStyle, primaryColor, accentColor },
      unlockedStones,
      unlockedOutfits,
      unlockedStencils,
      equippedStone,
      equippedOutfit,
      equippedStencil,
      updatedAt,
    };
  };

  const readStoredLoadouts = (): Record<string, StoredAvatarLoadout> => {
    try {
      if (!fs.existsSync(loadoutsFilePath)) return {};
      const parsed = JSON.parse(fs.readFileSync(loadoutsFilePath, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const clean: Record<string, StoredAvatarLoadout> = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (LEADERBOARD_ID_RE.test(key)) {
          clean[key] = sanitizeStoredLoadout(value);
        }
      }
      return clean;
    } catch {
      return {};
    }
  };

  const writeStoredLoadouts = (records: Record<string, StoredAvatarLoadout>) => {
    fs.mkdirSync(leaderboardDataDir, { recursive: true });
    const entries = Object.entries(records)
      .sort((a, b) => Date.parse(b[1].updatedAt) - Date.parse(a[1].updatedAt))
      .slice(0, 500);
    const bounded = Object.fromEntries(entries);
    fs.writeFileSync(loadoutsFilePath, JSON.stringify(bounded, null, 2), 'utf8');
  };

  app.get('/api/loadout/:playerId', (req: Request, res: Response) => {
    const playerId = String(req.params.playerId ?? '').trim();
    if (!LEADERBOARD_ID_RE.test(playerId)) {
      res.status(400).json({ error: 'Valid playerId (8-64 alphanumeric/dash chars) is required.' });
      return;
    }
    const allLoadouts = readStoredLoadouts();
    res.json({ loadout: allLoadouts[playerId] ?? null });
  });

  app.put('/api/loadout/:playerId', (req: Request, res: Response) => {
    const playerId = String(req.params.playerId ?? '').trim();
    if (!LEADERBOARD_ID_RE.test(playerId)) {
      res.status(400).json({ error: 'Valid playerId (8-64 alphanumeric/dash chars) is required.' });
      return;
    }
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      res.status(400).json({ error: 'Loadout JSON object is required.' });
      return;
    }

    const allLoadouts = readStoredLoadouts();
    const existing = allLoadouts[playerId];
    const incoming = sanitizeStoredLoadout(req.body);

    const merged = existing
      ? sanitizeStoredLoadout({
          ...incoming,
          unlockedStones: [...existing.unlockedStones, ...incoming.unlockedStones],
          unlockedOutfits: [...existing.unlockedOutfits, ...incoming.unlockedOutfits],
          unlockedStencils: [...existing.unlockedStencils, ...incoming.unlockedStencils],
          updatedAt: new Date().toISOString(),
        })
      : { ...incoming, updatedAt: new Date().toISOString() };

    allLoadouts[playerId] = merged;
    writeStoredLoadouts(allLoadouts);
    res.json({ ok: true, loadout: merged });
  });

  // Phase 1 Monetization: Server-Authorized Ad Sessions & Single-Use Reward Claims (/data/monetization.json)
  type AdPlacement = 'double_match' | 'mission_reroll' | 'bonus_chest' | 'interstitial';
  const VALID_AD_PLACEMENTS = new Set<AdPlacement>([
    'double_match',
    'mission_reroll',
    'bonus_chest',
    'interstitial',
  ]);
  const VALID_MISSION_IDS = [
    'score_500_match',
    'clean_win',
    'bullseyes_3_day',
    'claim_2_houses',
    'streak_3_match',
    'win_2_matches',
    'rounds_6_day',
  ] as const;
  const VALID_MISSION_ID_SET = new Set<string>(VALID_MISSION_IDS);
  const MATCH_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
  const MONETIZATION_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const MAX_MATCH_DOUBLE_COWRIES = 600;
  const MAX_DOUBLE_CLAIMS_PER_DAY = 25;
  const BONUS_CHEST_TIERS = [30, 35, 40, 45, 50] as const;
  const AD_SESSION_TTL_MS = 10 * 60 * 1000;
  const monetizationFilePath = path.resolve(leaderboardDataDir, 'monetization.json');

  interface MonetizationPlayerRecord {
    claimedMatches: Record<string, { cowries: number; claimedAt: string; receiptId: string }>;
    recordedMatches: Record<string, { baseCowries: number; dateKey: string; recordedAt: string }>;
    doubleClaimsByDate: Record<string, number>;
    bonusChestDates: string[];
    missionRerollDates: string[];
    interstitialCount: number;
    updatedAt: string;
  }

  interface MonetizationAdSession {
    sessionId: string;
    tokenHash: string;
    playerId: string;
    placement: AdPlacement;
    dateKey: string;
    matchId?: string;
    baseCowries?: number;
    currentMissionId?: string;
    used: boolean;
    createdAt: number;
    expiresAt: number;
  }

  interface MonetizationStore {
    players: Record<string, MonetizationPlayerRecord>;
    sessions: Record<string, MonetizationAdSession>;
  }

  const hashSessionToken = (rawToken: string): string =>
    crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');

  const verifySessionToken = (rawToken: string, expectedHash: string): boolean => {
    const candidateHash = hashSessionToken(rawToken);
    const a = Buffer.from(candidateHash, 'hex');
    const b = Buffer.from(expectedHash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };

  const isValidLocalDateKey = (raw: unknown): raw is string => {
    if (typeof raw !== 'string') return false;
    const m = MONETIZATION_DATE_RE.exec(raw.trim());
    if (!m) return false;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
    const candidateDay = Math.floor(Date.UTC(y, mo - 1, d) / 86_400_000);
    const now = new Date();
    const utcTodayDay = Math.floor(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000
    );
    return Math.abs(candidateDay - utcTodayDay) <= 1;
  };

  const getServerFallbackDateKey = (): string => new Date().toISOString().slice(0, 10);

  const emptyMonetizationPlayer = (): MonetizationPlayerRecord => ({
    claimedMatches: {},
    recordedMatches: {},
    doubleClaimsByDate: {},
    bonusChestDates: [],
    missionRerollDates: [],
    interstitialCount: 0,
    updatedAt: new Date().toISOString(),
  });

  const readMonetizationStore = (): MonetizationStore => {
    try {
      if (!fs.existsSync(monetizationFilePath)) {
        return { players: {}, sessions: {} };
      }
      const parsed = JSON.parse(fs.readFileSync(monetizationFilePath, 'utf8')) as Partial<MonetizationStore>;
      const players: Record<string, MonetizationPlayerRecord> = {};
      if (parsed.players && typeof parsed.players === 'object') {
        for (const [pid, rec] of Object.entries(parsed.players)) {
          if (!LEADERBOARD_ID_RE.test(pid) || !rec || typeof rec !== 'object') continue;
          const base = emptyMonetizationPlayer();
          if (rec.claimedMatches && typeof rec.claimedMatches === 'object') {
            for (const [mid, val] of Object.entries(rec.claimedMatches)) {
              if (MATCH_ID_RE.test(mid) && val && typeof val === 'object') {
                base.claimedMatches[mid] = {
                  cowries: Math.min(MAX_MATCH_DOUBLE_COWRIES, Math.max(1, Math.floor(Number(val.cowries) || 1))),
                  claimedAt: typeof val.claimedAt === 'string' ? val.claimedAt : new Date().toISOString(),
                  receiptId: typeof val.receiptId === 'string' ? val.receiptId : '',
                };
              }
            }
          }
          if (rec.recordedMatches && typeof rec.recordedMatches === 'object') {
            for (const [mid, val] of Object.entries(rec.recordedMatches)) {
              if (MATCH_ID_RE.test(mid) && val && typeof val === 'object') {
                base.recordedMatches[mid] = {
                  baseCowries: Math.min(MAX_MATCH_DOUBLE_COWRIES, Math.max(1, Math.floor(Number(val.baseCowries) || 1))),
                  dateKey: typeof val.dateKey === 'string' ? val.dateKey : getServerFallbackDateKey(),
                  recordedAt: typeof val.recordedAt === 'string' ? val.recordedAt : new Date().toISOString(),
                };
              }
            }
          }
          if (rec.doubleClaimsByDate && typeof rec.doubleClaimsByDate === 'object') {
            for (const [dk, cnt] of Object.entries(rec.doubleClaimsByDate)) {
              if (MONETIZATION_DATE_RE.test(dk)) {
                base.doubleClaimsByDate[dk] = Math.max(0, Math.floor(Number(cnt) || 0));
              }
            }
          }
          if (Array.isArray(rec.bonusChestDates)) {
            base.bonusChestDates = Array.from(
              new Set(rec.bonusChestDates.filter((d): d is string => typeof d === 'string' && MONETIZATION_DATE_RE.test(d)))
            ).slice(-45);
          }
          if (Array.isArray(rec.missionRerollDates)) {
            base.missionRerollDates = Array.from(
              new Set(rec.missionRerollDates.filter((d): d is string => typeof d === 'string' && MONETIZATION_DATE_RE.test(d)))
            ).slice(-45);
          }
          base.interstitialCount =
            typeof rec.interstitialCount === 'number' && Number.isFinite(rec.interstitialCount)
              ? Math.max(0, Math.floor(rec.interstitialCount))
              : 0;
          base.updatedAt = typeof rec.updatedAt === 'string' ? rec.updatedAt : new Date().toISOString();
          players[pid] = base;
        }
      }

      const sessions: Record<string, MonetizationAdSession> = {};
      const now = Date.now();
      if (parsed.sessions && typeof parsed.sessions === 'object') {
        for (const [sid, sess] of Object.entries(parsed.sessions)) {
          if (!sess || typeof sess !== 'object') continue;
          if (sess.expiresAt && now - Number(sess.expiresAt) > 60 * 60 * 1000) continue;
          if (!LEADERBOARD_ID_RE.test(String(sess.playerId ?? ''))) continue;
          if (!VALID_AD_PLACEMENTS.has(sess.placement as AdPlacement)) continue;
          sessions[sid] = sess as MonetizationAdSession;
        }
      }

      return { players, sessions };
    } catch {
      return { players: {}, sessions: {} };
    }
  };

  const writeMonetizationStore = (store: MonetizationStore) => {
    fs.mkdirSync(leaderboardDataDir, { recursive: true });
    const now = Date.now();
    // Prune sessions older than 1 hour beyond expiry and cap stored match history per player
    const prunedSessions: Record<string, MonetizationAdSession> = {};
    for (const [sid, sess] of Object.entries(store.sessions)) {
      if (now - sess.expiresAt <= 60 * 60 * 1000) {
        prunedSessions[sid] = sess;
      }
    }
    const boundedPlayers = Object.fromEntries(
      Object.entries(store.players)
        .sort((a, b) => Date.parse(b[1].updatedAt) - Date.parse(a[1].updatedAt))
        .slice(0, 500)
        .map(([pid, rec]) => {
          const claimKeys = Object.keys(rec.claimedMatches);
          if (claimKeys.length > 80) {
            const keep = new Set(claimKeys.slice(-80));
            for (const k of claimKeys) {
              if (!keep.has(k)) delete rec.claimedMatches[k];
            }
          }
          const recKeys = Object.keys(rec.recordedMatches);
          if (recKeys.length > 80) {
            const keep = new Set(recKeys.slice(-80));
            for (const k of recKeys) {
              if (!keep.has(k)) delete rec.recordedMatches[k];
            }
          }
          return [pid, rec] as const;
        })
    );
    fs.writeFileSync(
      monetizationFilePath,
      JSON.stringify({ players: boundedPlayers, sessions: prunedSessions }, null, 2),
      'utf8'
    );
  };

  const buildMonetizationStatusPayload = (rec: MonetizationPlayerRecord | undefined, dateKey: string) => ({
    dateKey,
    bonusChestClaimedToday: Boolean(rec?.bonusChestDates.includes(dateKey)),
    missionRerollUsedToday: Boolean(rec?.missionRerollDates.includes(dateKey)),
    claimedMatchIds: rec ? Object.keys(rec.claimedMatches).slice(-50) : [],
    doubleClaimsToday: rec?.doubleClaimsByDate[dateKey] ?? 0,
    maxDoubleClaimsPerDay: MAX_DOUBLE_CLAIMS_PER_DAY,
  });

  app.get('/api/monetization/status', (req: Request, res: Response) => {
    const playerId = String(req.query.playerId ?? '').trim();
    if (!LEADERBOARD_ID_RE.test(playerId)) {
      res.status(400).json({ error: 'Valid playerId (8-64 alphanumeric/dash chars) is required.' });
      return;
    }
    const rawDateKey = req.query.dateKey;
    const dateKey = isValidLocalDateKey(rawDateKey) ? rawDateKey.trim() : getServerFallbackDateKey();
    const store = readMonetizationStore();
    res.json({
      ok: true,
      ...buildMonetizationStatusPayload(store.players[playerId], dateKey),
    });
  });

  app.post('/api/monetization/match-result', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const playerId = typeof body.playerId === 'string' ? body.playerId.trim() : '';
    const matchId = typeof body.matchId === 'string' ? body.matchId.trim() : '';
    if (!LEADERBOARD_ID_RE.test(playerId) || !MATCH_ID_RE.test(matchId)) {
      res.status(400).json({ error: 'Valid playerId and matchId are required.' });
      return;
    }
    const rawBase = Number(body.baseCowries);
    if (!Number.isFinite(rawBase) || rawBase < 1 || rawBase > MAX_MATCH_DOUBLE_COWRIES) {
      res.status(400).json({ error: `baseCowries must be between 1 and ${MAX_MATCH_DOUBLE_COWRIES}.` });
      return;
    }
    const dateKey = isValidLocalDateKey(body.dateKey) ? body.dateKey.trim() : getServerFallbackDateKey();
    const store = readMonetizationStore();
    const rec = store.players[playerId] ?? emptyMonetizationPlayer();
    if (!rec.recordedMatches[matchId]) {
      rec.recordedMatches[matchId] = {
        baseCowries: Math.floor(rawBase),
        dateKey,
        recordedAt: new Date().toISOString(),
      };
      rec.updatedAt = new Date().toISOString();
      store.players[playerId] = rec;
      writeMonetizationStore(store);
    }
    res.json({ ok: true, matchId });
  });

  app.post('/api/monetization/ad-session', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const playerId = typeof body.playerId === 'string' ? body.playerId.trim() : '';
    if (!LEADERBOARD_ID_RE.test(playerId)) {
      res.status(400).json({ error: 'Valid playerId (8-64 alphanumeric/dash chars) is required.' });
      return;
    }

    const placement = String(body.placement ?? '') as AdPlacement;
    if (!VALID_AD_PLACEMENTS.has(placement)) {
      res.status(400).json({ error: 'Invalid ad placement.' });
      return;
    }

    const dateKey = isValidLocalDateKey(body.dateKey) ? body.dateKey.trim() : getServerFallbackDateKey();
    const store = readMonetizationStore();
    const rec = store.players[playerId] ?? emptyMonetizationPlayer();

    let matchId: string | undefined;
    let baseCowries: number | undefined;
    let currentMissionId: string | undefined;

    if (placement === 'double_match') {
      matchId = typeof body.matchId === 'string' ? body.matchId.trim() : '';
      if (!MATCH_ID_RE.test(matchId)) {
        res.status(400).json({ error: 'Valid matchId is required to double match cowries.' });
        return;
      }
      if (rec.claimedMatches[matchId]) {
        res.status(409).json({ error: 'Match cowries have already been doubled for this match.' });
        return;
      }
      if ((rec.doubleClaimsByDate[dateKey] ?? 0) >= MAX_DOUBLE_CLAIMS_PER_DAY) {
        res.status(429).json({ error: 'Daily 2x match bonus limit reached. Come back tomorrow!' });
        return;
      }
      const recorded = rec.recordedMatches[matchId];
      const candidateBase = recorded ? recorded.baseCowries : Number(body.baseCowries);
      if (!Number.isFinite(candidateBase) || candidateBase < 1 || candidateBase > MAX_MATCH_DOUBLE_COWRIES) {
        res.status(400).json({
          error: `Match reward must be between 1 and ${MAX_MATCH_DOUBLE_COWRIES} Cowries.`,
        });
        return;
      }
      baseCowries = Math.floor(candidateBase);
    } else if (placement === 'bonus_chest') {
      if (rec.bonusChestDates.includes(dateKey)) {
        res.status(409).json({ error: 'Today’s bonus treasure chest has already been claimed.' });
        return;
      }
    } else if (placement === 'mission_reroll') {
      if (rec.missionRerollDates.includes(dateKey)) {
        res.status(409).json({ error: 'Today’s daily mission reroll has already been used.' });
        return;
      }
      const rawMissionId = typeof body.currentMissionId === 'string' ? body.currentMissionId.trim() : '';
      if (!VALID_MISSION_ID_SET.has(rawMissionId)) {
        res.status(400).json({ error: 'Valid currentMissionId is required for mission reroll.' });
        return;
      }
      currentMissionId = rawMissionId;
    }

    const sessionId = crypto.randomUUID();
    const sessionToken = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();
    const session: MonetizationAdSession = {
      sessionId,
      tokenHash: hashSessionToken(sessionToken),
      playerId,
      placement,
      dateKey,
      ...(matchId ? { matchId } : {}),
      ...(baseCowries !== undefined ? { baseCowries } : {}),
      ...(currentMissionId ? { currentMissionId } : {}),
      used: false,
      createdAt: now,
      expiresAt: now + AD_SESSION_TTL_MS,
    };

    store.players[playerId] = rec;
    store.sessions[sessionId] = session;
    writeMonetizationStore(store);

    res.json({
      ok: true,
      sessionId,
      sessionToken,
      expiresAt: session.expiresAt,
      status: buildMonetizationStatusPayload(rec, dateKey),
    });
  });

  app.post('/api/monetization/claim-reward', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const playerId = typeof body.playerId === 'string' ? body.playerId.trim() : '';
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const sessionToken = typeof body.sessionToken === 'string' ? body.sessionToken.trim() : '';

    if (!LEADERBOARD_ID_RE.test(playerId) || !sessionId || !sessionToken) {
      res.status(400).json({ error: 'Valid playerId, sessionId, and sessionToken are required.' });
      return;
    }

    const store = readMonetizationStore();
    const session = store.sessions[sessionId];
    if (!session || session.playerId !== playerId || !verifySessionToken(sessionToken, session.tokenHash)) {
      res.status(403).json({ error: 'Invalid or unauthorized ad reward session.' });
      return;
    }
    if (session.used) {
      res.status(409).json({ error: 'This ad reward has already been claimed.' });
      return;
    }
    if (Date.now() > session.expiresAt) {
      session.used = true;
      writeMonetizationStore(store);
      res.status(410).json({ error: 'Ad reward session expired. Watch another ad to claim.' });
      return;
    }

    const rec = store.players[playerId] ?? emptyMonetizationPlayer();
    const receiptId = crypto.randomUUID();
    let cowriesGranted = 0;
    let nextMissionId: string | null = null;

    if (session.placement === 'double_match') {
      const matchId = session.matchId ?? '';
      if (!matchId || rec.claimedMatches[matchId]) {
        session.used = true;
        writeMonetizationStore(store);
        res.status(409).json({ error: 'Match cowries have already been doubled for this match.' });
        return;
      }
      if ((rec.doubleClaimsByDate[session.dateKey] ?? 0) >= MAX_DOUBLE_CLAIMS_PER_DAY) {
        session.used = true;
        writeMonetizationStore(store);
        res.status(429).json({ error: 'Daily 2x match bonus limit reached.' });
        return;
      }
      const recorded = rec.recordedMatches[matchId];
      const resolvedBase = recorded ? recorded.baseCowries : (session.baseCowries ?? 0);
      cowriesGranted = Math.min(MAX_MATCH_DOUBLE_COWRIES, Math.max(1, Math.floor(resolvedBase)));
      rec.claimedMatches[matchId] = {
        cowries: cowriesGranted,
        claimedAt: new Date().toISOString(),
        receiptId,
      };
      rec.doubleClaimsByDate[session.dateKey] = (rec.doubleClaimsByDate[session.dateKey] ?? 0) + 1;
    } else if (session.placement === 'bonus_chest') {
      if (rec.bonusChestDates.includes(session.dateKey)) {
        session.used = true;
        writeMonetizationStore(store);
        res.status(409).json({ error: 'Today’s bonus treasure chest has already been claimed.' });
        return;
      }
      cowriesGranted = BONUS_CHEST_TIERS[crypto.randomInt(0, BONUS_CHEST_TIERS.length)];
      rec.bonusChestDates.push(session.dateKey);
    } else if (session.placement === 'mission_reroll') {
      if (rec.missionRerollDates.includes(session.dateKey)) {
        session.used = true;
        writeMonetizationStore(store);
        res.status(409).json({ error: 'Today’s daily mission reroll has already been used.' });
        return;
      }
      const candidates = VALID_MISSION_IDS.filter((id) => id !== session.currentMissionId);
      nextMissionId = candidates[crypto.randomInt(0, candidates.length)] ?? VALID_MISSION_IDS[0];
      rec.missionRerollDates.push(session.dateKey);
    } else if (session.placement === 'interstitial') {
      rec.interstitialCount += 1;
    }

    session.used = true;
    rec.updatedAt = new Date().toISOString();
    store.players[playerId] = rec;
    store.sessions[sessionId] = session;
    writeMonetizationStore(store);

    res.json({
      ok: true,
      receiptId,
      placement: session.placement,
      cowriesGranted,
      nextMissionId,
      status: buildMonetizationStatusPayload(rec, session.dateKey),
    });
  });

  // Curated Blender GLB / glTF / ZIP models directory (/public/models)
  const modelsDir = path.resolve(__dirname, 'public', 'models');
  const voicesDir = path.resolve(__dirname, 'public', 'audio', 'voices');
  const manifestPath = path.join(modelsDir, 'manifest.json');
  const ALLOWED_SLOTS = new Set([
    'kato',
    'namukasa',
    'auma',
    'ssemakula',
    'prop',
    'stone',
    'surface',
  ]);

  interface CharacterAppearance {
    skinTone: string;
    outfitStyle: string;
    shoeStyle: string;
  }

  interface SurfaceTextureSet {
    albedo?: string;
    normal?: string;
    roughness?: string;
    ao?: string;
  }

  interface StoredModelEntry {
    slot: string;
    fileName: string;
    originalName: string;
    url: string;
    bytes: number;
    uploadedAt: string;
    assetType?: 'model' | 'surface-textures';
    textureSet?: SurfaceTextureSet;
    appearance?: CharacterAppearance;
  }

  const ensureModelsDir = () => {
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }
  };

  const clearSlotFiles = (slot: string) => {
    for (const ext of [
      '.glb',
      '.gltf',
      '.usdz',
      '.usd',
      '.usda',
      '.usdc',
      '.png',
      '.jpg',
      '.jpeg',
      '.webp',
    ]) {
      const f = path.join(modelsDir, `${slot}${ext}`);
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
      }
    }
    const slotSubDir = path.join(modelsDir, slot);
    if (fs.existsSync(slotSubDir)) {
      fs.rmSync(slotSubDir, { recursive: true, force: true });
    }
  };

  const readModelManifest = (): Record<string, StoredModelEntry> => {
    try {
      if (!fs.existsSync(manifestPath)) return {};
      const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, StoredModelEntry>) : {};
    } catch {
      return {};
    }
  };

  const writeModelManifest = (manifest: Record<string, StoredModelEntry>) => {
    ensureModelsDir();
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  };

  const isStudioUploadAuthorized = (req: Request): boolean => {
    if (req.headers['x-studio-intent'] !== 'sonko-creator') return false;
    const configuredKey = process.env.SONKO_STUDIO_KEY?.trim();
    if (process.env.NODE_ENV === 'production') {
      if (!configuredKey) return false;
      return req.headers['x-studio-key'] === configuredKey;
    }
    if (configuredKey) {
      return req.headers['x-studio-key'] === configuredKey;
    }
    return true;
  };

  // Serve persisted /public/models and /public/audio files cleanly (404 if missing)
  app.use(
    '/models',
    express.static(modelsDir, {
      setHeaders: (res, filePath) => {
        if (filePath.toLowerCase().endsWith('.usdz')) {
          res.setHeader('Content-Type', 'model/vnd.usdz+zip');
        }
      },
    }),
    (_req: Request, res: Response) => {
      res.status(404).json({ error: 'Model file not found' });
    }
  );
  app.use('/audio', express.static(path.resolve(__dirname, 'public', 'audio')));

  const assetsDir = path.resolve(__dirname, 'public', 'assets');
  const DEFAULT_ASSET_FOLDERS = [
    'worlds',
    'worlds/kampala_compound',
    'worlds/primary_schoolyard',
    'worlds/entebbe_lakeside',
    'worlds/trading_centre',
    'worlds/ndere_festival',
    'characters',
    'props',
    'vehicles',
    'textures',
    'audio',
    'unsorted',
  ];
  const LEGACY_FOLDER_MIGRATIONS: Record<string, string> = {
    kampala_compound: 'worlds/kampala_compound',
    primary_schoolyard: 'worlds/primary_schoolyard',
    entebbe_lakeside: 'worlds/entebbe_lakeside',
    trading_centre: 'worlds/trading_centre',
    ndere_festival: 'worlds/ndere_festival',
    story_vehicles: 'vehicles',
  };
  const ASSET_EXT_RE = /\.(glb|gltf|usdz|usd|usda|usdc|zip|png|jpg|jpeg|webp|mp3|ogg|wav|m4a|webm)$/i;

  const sanitizeAssetFolder = (raw: unknown): string | null => {
    const normalized = String(raw ?? '').trim().replace(/\\/g, '/');
    if (!normalized) return null;
    const rawParts = normalized.split('/').filter(Boolean);
    if (rawParts.length === 0 || rawParts.length > 3) return null;
    const safeParts: string[] = [];
    for (const part of rawParts) {
      if (part === '.' || part === '..') return null;
      const cleaned = part
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
      if (!cleaned || cleaned === '.' || cleaned === '..' || cleaned.length > 40) return null;
      safeParts.push(cleaned);
    }
    return safeParts.join('/');
  };

  const sanitizeAssetFile = (raw: unknown): string | null => {
    const base = path.basename(String(raw ?? '')).replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!base || base.startsWith('.') || base === '..') return null;
    return base;
  };

  const resolveInsideAssets = (folder: string, fileName?: string): string | null => {
    const parts = folder.split('/').filter(Boolean);
    const target = fileName
      ? path.resolve(assetsDir, ...parts, fileName)
      : path.resolve(assetsDir, ...parts);
    if (!target.startsWith(assetsDir + path.sep)) return null;
    return target;
  };

  const ensureAssetFolders = () => {
    fs.mkdirSync(assetsDir, { recursive: true });
    for (const f of DEFAULT_ASSET_FOLDERS) {
      fs.mkdirSync(path.join(assetsDir, ...f.split('/')), { recursive: true });
    }
    // Migrate legacy flat world/vehicle folders cleanly into hierarchical structure
    for (const [oldRel, newRel] of Object.entries(LEGACY_FOLDER_MIGRATIONS)) {
      const oldDir = path.join(assetsDir, oldRel);
      const newDir = path.join(assetsDir, ...newRel.split('/'));
      if (!fs.existsSync(oldDir)) continue;
      try {
        const entries = fs.readdirSync(oldDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const src = path.join(oldDir, entry.name);
          const dst = path.join(newDir, entry.name);
          if (entry.isFile() && !fs.existsSync(dst)) {
            fs.renameSync(src, dst);
          }
        }
        const remaining = fs.readdirSync(oldDir).filter((n) => !n.startsWith('.'));
        if (remaining.length === 0) {
          fs.rmSync(oldDir, { recursive: true, force: true });
        }
      } catch {
        // Ignore partial migration edge cases
      }
    }
  };

  const listAssetsLibrary = () => {
    ensureAssetFolders();
    const discoveredFolders = new Set<string>();
    const files: Array<{
      name: string;
      folder: string;
      sizeBytes: number;
      ext: string;
      url: string;
      modifiedAt: string;
    }> = [];

    const walk = (dir: string, relFolder: string, depth: number) => {
      if (depth > 4) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const nextRel = relFolder ? `${relFolder}/${entry.name}` : entry.name;
          discoveredFolders.add(nextRel);
          walk(full, nextRel, depth + 1);
        } else if (entry.isFile() && relFolder) {
          const stat = fs.statSync(full);
          const urlSegments = ['assets', ...relFolder.split('/'), entry.name]
            .map((seg) => encodeURIComponent(seg))
            .join('/');
          files.push({
            name: entry.name,
            folder: relFolder,
            sizeBytes: stat.size,
            ext: path.extname(entry.name).toLowerCase().replace(/^\./, ''),
            url: `/${urlSegments}`,
            modifiedAt: stat.mtime.toISOString(),
          });
        }
      }
    };

    walk(assetsDir, '', 0);

    const orderedFolders = [
      ...DEFAULT_ASSET_FOLDERS.filter((f) => discoveredFolders.has(f)),
      ...[...discoveredFolders].filter((f) => !DEFAULT_ASSET_FOLDERS.includes(f)).sort(),
    ];

    files.sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));
    return { folders: orderedFolders, files };
  };

  ensureAssetFolders();

  app.use(
    '/assets',
    express.static(assetsDir, {
      setHeaders: (res, filePath) => {
        const lower = filePath.toLowerCase();
        if (lower.endsWith('.usdz')) {
          res.setHeader('Content-Type', 'model/vnd.usdz+zip');
        } else if (lower.endsWith('.glb')) {
          res.setHeader('Content-Type', 'model/gltf-binary');
        }
      },
    }),
    (_req: Request, res: Response) => {
      res.status(404).json({ error: 'Asset file not found' });
    }
  );

  // List organized World Assets directory (/public/assets/<folder>/<file>)
  app.get('/api/assets', (_req: Request, res: Response) => {
    const { folders, files } = listAssetsLibrary();
    const isProd = process.env.NODE_ENV === 'production';
    const hasProdKey = Boolean(process.env.SONKO_STUDIO_KEY?.trim());
    res.json({
      folders,
      files,
      defaultFolders: DEFAULT_ASSET_FOLDERS,
      studioUploadAvailable: !isProd || hasProdKey,
      requiresKey: isProd || hasProdKey,
    });
  });

  // Create a custom folder inside /public/assets (supports nested e.g. worlds/schoolyard_ext)
  app.post('/api/assets/folders', (req: Request, res: Response) => {
    if (!isStudioUploadAuthorized(req)) {
      res.status(403).json({ error: 'Creator Studio access required.' });
      return;
    }
    const folder = sanitizeAssetFolder((req.body as { name?: string })?.name);
    if (!folder) {
      res.status(400).json({ error: 'Folder name must contain letters or numbers (max 3 levels deep).' });
      return;
    }
    const target = resolveInsideAssets(folder);
    if (!target) {
      res.status(400).json({ error: 'Invalid folder path.' });
      return;
    }
    fs.mkdirSync(target, { recursive: true });
    const lib = listAssetsLibrary();
    res.json({ ok: true, folder, ...lib });
  });

  const handleDeleteFolder = (req: Request, res: Response, rawFolder: unknown) => {
    if (!isStudioUploadAuthorized(req)) {
      res.status(403).json({ error: 'Creator Studio access required.' });
      return;
    }
    const folder = sanitizeAssetFolder(rawFolder);
    if (!folder || DEFAULT_ASSET_FOLDERS.includes(folder)) {
      res.status(400).json({ error: 'Built-in folders cannot be deleted.' });
      return;
    }
    const target = resolveInsideAssets(folder);
    if (!target || !fs.existsSync(target)) {
      res.status(404).json({ error: 'Folder not found.' });
      return;
    }
    const contents = fs.readdirSync(target).filter((n) => !n.startsWith('.'));
    if (contents.length > 0) {
      res.status(400).json({ error: 'Move or delete files/subfolders inside this folder before removing it.' });
      return;
    }
    fs.rmdirSync(target);
    const lib = listAssetsLibrary();
    res.json({ ok: true, ...lib });
  };

  // Delete an empty custom folder inside /public/assets (supports nested folder paths via body or param)
  app.delete('/api/assets/folders', (req: Request, res: Response) => {
    handleDeleteFolder(req, res, (req.body as { folder?: string } | undefined)?.folder);
  });

  app.delete('/api/assets/folders/:folder', (req: Request, res: Response) => {
    handleDeleteFolder(req, res, req.params.folder);
  });

  // Upload a single file into a target folder inside /public/assets (called per-file for batch uploads)
  app.post(
    '/api/assets/upload',
    express.raw({ type: 'application/octet-stream', limit: '80mb' }),
    (req: Request, res: Response) => {
      if (!isStudioUploadAuthorized(req)) {
        res.status(403).json({ error: 'Creator Studio upload access required.' });
        return;
      }
      const buf = req.body as Buffer;
      if (!Buffer.isBuffer(buf) || buf.length < 16) {
        res.status(400).json({ error: 'Missing binary asset payload.' });
        return;
      }
      const folder = sanitizeAssetFolder(req.headers['x-asset-folder'] ?? 'unsorted') ?? 'unsorted';
      const rawName = sanitizeAssetFile(req.headers['x-file-name'] ?? 'asset.glb');
      if (!rawName || !ASSET_EXT_RE.test(rawName)) {
        res.status(400).json({
          error: 'Supported files: .glb, .gltf, .usdz, .usd, .zip, .png, .jpg, .webp, .mp3, .ogg, .wav',
        });
        return;
      }
      const folderPath = resolveInsideAssets(folder);
      if (!folderPath) {
        res.status(400).json({ error: 'Invalid folder path.' });
        return;
      }
      fs.mkdirSync(folderPath, { recursive: true });

      const ext = path.extname(rawName);
      const stem = path.basename(rawName, ext);
      let finalName = rawName;
      let counter = 1;
      while (fs.existsSync(path.join(folderPath, finalName))) {
        finalName = `${stem}_${counter}${ext}`;
        counter++;
      }

      const destPath = resolveInsideAssets(folder, finalName);
      if (!destPath) {
        res.status(400).json({ error: 'Invalid file destination.' });
        return;
      }
      fs.writeFileSync(destPath, buf);
      const lib = listAssetsLibrary();
      const created = lib.files.find((f) => f.folder === folder && f.name === finalName);
      res.json({ ok: true, entry: created, ...lib });
    }
  );

  // Move or rename an asset file between /public/assets folders
  app.patch('/api/assets/move', (req: Request, res: Response) => {
    if (!isStudioUploadAuthorized(req)) {
      res.status(403).json({ error: 'Creator Studio access required.' });
      return;
    }
    const body = (req.body ?? {}) as {
      fromFolder?: string;
      fileName?: string;
      toFolder?: string;
      newName?: string;
    };
    const fromFolder = sanitizeAssetFolder(body.fromFolder);
    const toFolder = sanitizeAssetFolder(body.toFolder);
    const fileName = sanitizeAssetFile(body.fileName);
    const requestedNewName = body.newName ? sanitizeAssetFile(body.newName) : fileName;

    if (!fromFolder || !toFolder || !fileName || !requestedNewName) {
      res.status(400).json({ error: 'Invalid folder or filename.' });
      return;
    }

    const srcPath = resolveInsideAssets(fromFolder, fileName);
    const dstFolderPath = resolveInsideAssets(toFolder);
    if (!srcPath || !dstFolderPath || !fs.existsSync(srcPath)) {
      res.status(404).json({ error: 'Source asset not found.' });
      return;
    }
    fs.mkdirSync(dstFolderPath, { recursive: true });

    const ext = path.extname(requestedNewName) || path.extname(fileName);
    const stem = path.basename(requestedNewName, path.extname(requestedNewName));
    let finalName = `${stem}${ext}`;
    if (fromFolder !== toFolder || finalName !== fileName) {
      let counter = 1;
      while (fs.existsSync(path.join(dstFolderPath, finalName))) {
        finalName = `${stem}_${counter}${ext}`;
        counter++;
      }
    }

    const dstPath = resolveInsideAssets(toFolder, finalName);
    if (!dstPath) {
      res.status(400).json({ error: 'Invalid destination path.' });
      return;
    }
    fs.renameSync(srcPath, dstPath);
    const lib = listAssetsLibrary();
    const moved = lib.files.find((f) => f.folder === toFolder && f.name === finalName);
    res.json({ ok: true, entry: moved, ...lib });
  });

  // Delete an asset file from /public/assets
  app.delete('/api/assets/file', (req: Request, res: Response) => {
    if (!isStudioUploadAuthorized(req)) {
      res.status(403).json({ error: 'Creator Studio access required.' });
      return;
    }
    const body = (req.body ?? {}) as { folder?: string; fileName?: string };
    const folder = sanitizeAssetFolder(body.folder);
    const fileName = sanitizeAssetFile(body.fileName);
    if (!folder || !fileName) {
      res.status(400).json({ error: 'Invalid folder or filename.' });
      return;
    }
    const target = resolveInsideAssets(folder, fileName);
    if (!target || !fs.existsSync(target)) {
      res.status(404).json({ error: 'Asset not found.' });
      return;
    }
    fs.unlinkSync(target);
    const lib = listAssetsLibrary();
    res.json({ ok: true, ...lib });
  });

  const buildEnrichedManifest = (manifest: Record<string, StoredModelEntry>) => {
    const enriched: Record<string, StoredModelEntry & { fileExists: boolean }> = {};
    for (const [k, entry] of Object.entries(manifest)) {
      const target = entry?.fileName ? path.resolve(modelsDir, entry.fileName) : '';
      const exists = Boolean(
        target && (target.startsWith(modelsDir + path.sep) || target === modelsDir) && fs.existsSync(target)
      );
      enriched[k] = { ...entry, fileExists: exists };
    }
    return enriched;
  };

  // Public read-only manifest so visitors automatically see curated 3D models & surfaces
  app.get('/api/models', (_req: Request, res: Response) => {
    const manifest = readModelManifest();
    const enriched = buildEnrichedManifest(manifest);
    const isProd = process.env.NODE_ENV === 'production';
    const hasProdKey = Boolean(process.env.SONKO_STUDIO_KEY?.trim());
    res.json({
      slots: enriched,
      studioUploadAvailable: !isProd || hasProdKey,
      requiresKey: isProd || hasProdKey,
    });
  });

  // Creator-only GLB / glTF / ZIP / surface texture upload endpoint
  app.post(
    '/api/models/:slot',
    express.raw({ type: 'application/octet-stream', limit: '80mb' }),
    (req: Request, res: Response) => {
      if (!isStudioUploadAuthorized(req)) {
        res.status(403).json({ error: 'Creator Studio upload access required.' });
        return;
      }

      const slot = String(req.params.slot ?? '').toLowerCase();
      if (!ALLOWED_SLOTS.has(slot)) {
        res.status(400).json({ error: 'Invalid asset slot.' });
        return;
      }

      const buf = req.body as Buffer;
      if (!Buffer.isBuffer(buf) || buf.length < 16) {
        res.status(400).json({ error: 'Missing binary asset payload.' });
        return;
      }

      const originalRaw = String(req.headers['x-file-name'] ?? `${slot}.glb`);
      const originalName = path.basename(originalRaw).replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = path.extname(originalName).toLowerCase();
      const isZipMagic = buf[0] === 0x50 && buf[1] === 0x4b;
      const isGlbMagic = buf.subarray(0, 4).toString('ascii') === 'glTF';
      const isUsdExt = ext === '.usdz' || ext === '.usd' || ext === '.usda' || ext === '.usdc';
      const versionTs = Date.now();

      ensureModelsDir();
      clearSlotFiles(slot);

      let fileName = '';
      let url = '';
      let assetType: 'model' | 'surface-textures' = 'model';
      let textureSet: SurfaceTextureSet | undefined;

      if (isUsdExt) {
        if (ext === '.usdz' && !isZipMagic) {
          clearSlotFiles(slot);
          res.status(400).json({ error: 'Invalid .usdz package header.' });
          return;
        }
        fileName = `${slot}${ext}`;
        fs.writeFileSync(path.join(modelsDir, fileName), buf);
        url = `/models/${fileName}?v=${versionTs}`;
      } else if (ext === '.zip' || isZipMagic) {
        let archive: Record<string, Uint8Array>;
        try {
          archive = unzipSync(new Uint8Array(buf));
        } catch {
          res.status(400).json({ error: 'Could not read .zip archive.' });
          return;
        }

        const slotDir = path.join(modelsDir, slot);
        fs.mkdirSync(slotDir, { recursive: true });

        const extractedRelPaths: string[] = [];
        for (const [rawEntryPath, fileBytes] of Object.entries(archive)) {
          const norm = rawEntryPath.replace(/\\/g, '/').replace(/^\/+/, '');
          if (!norm || norm.endsWith('/') || norm.startsWith('__MACOSX/') || path.posix.basename(norm).startsWith('._')) {
            continue;
          }
          const parts = norm.split('/').filter(Boolean);
          if (parts.some((p) => p === '..' || p === '.')) {
            continue;
          }
          const safeRel = parts.join('/');
          const destPath = path.resolve(slotDir, safeRel);
          if (!destPath.startsWith(slotDir + path.sep)) {
            continue;
          }
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.writeFileSync(destPath, fileBytes);
          extractedRelPaths.push(safeRel);
        }

        const modelCandidates = extractedRelPaths
          .filter((p) => /\.(glb|gltf|usdz|usd|usda|usdc)$/i.test(p))
          .sort((a, b) => a.split('/').length - b.split('/').length);

        const imageCandidates = extractedRelPaths.filter((p) =>
          /\.(png|jpg|jpeg|webp)$/i.test(p)
        );

        if (modelCandidates.length > 0 && !(slot === 'surface' && imageCandidates.length >= 2 && modelCandidates.length === 0)) {
          const pickedModel = modelCandidates[0];
          fileName = path.posix.join(slot, pickedModel);
          url = `/models/${fileName.split('/').map(encodeURIComponent).join('/')}?v=${versionTs}`;
        } else if (slot === 'surface' && imageCandidates.length > 0) {
          assetType = 'surface-textures';
          const pickMap = (re: RegExp) => imageCandidates.find((p) => re.test(path.posix.basename(p)));
          const normal = pickMap(/normal|nrm|_nor\b|norm/i);
          const roughness = pickMap(/rough|rgh/i);
          const ao = pickMap(/\bao\b|ambient|occlusion/i);
          const albedo =
            pickMap(/albedo|base[_-]?color|diffuse|color|\bdiff\b|\bcol\b/i) ??
            imageCandidates.find((p) => p !== normal && p !== roughness && p !== ao) ??
            imageCandidates[0];

          const toUrl = (rel?: string) =>
            rel ? `/models/${slot}/${rel.split('/').map(encodeURIComponent).join('/')}?v=${versionTs}` : undefined;

          textureSet = {
            albedo: toUrl(albedo),
            normal: toUrl(normal),
            roughness: toUrl(roughness),
            ao: toUrl(ao),
          };
          fileName = path.posix.join(slot, albedo);
          url = textureSet.albedo ?? `/models/${fileName}`;
        } else {
          clearSlotFiles(slot);
          res.status(400).json({
            error:
              slot === 'surface'
                ? 'ZIP must contain a .glb/.gltf/.usdz file or surface texture images (.png/.jpg/.webp).'
                : 'ZIP archive must contain a .glb, .gltf, or .usdz model file.',
          });
          return;
        }
      } else if (isGlbMagic) {
        fileName = `${slot}.glb`;
        fs.writeFileSync(path.join(modelsDir, fileName), buf);
        url = `/models/${fileName}?v=${versionTs}`;
      } else if (ext === '.gltf') {
        try {
          const parsed = JSON.parse(buf.toString('utf8')) as { asset?: { version?: string } };
          if (!parsed?.asset?.version) {
            throw new Error('Missing glTF asset version');
          }
        } catch {
          res.status(400).json({
            error: 'Invalid .gltf JSON. Note: external .bin/textures should be uploaded together inside a .zip.',
          });
          return;
        }
        fileName = `${slot}.gltf`;
        fs.writeFileSync(path.join(modelsDir, fileName), buf);
        url = `/models/${fileName}?v=${versionTs}`;
      } else if (slot === 'surface' && /\.(png|jpg|jpeg|webp)$/i.test(ext)) {
        assetType = 'surface-textures';
        fileName = `${slot}${ext}`;
        fs.writeFileSync(path.join(modelsDir, fileName), buf);
        url = `/models/${fileName}?v=${versionTs}`;
        textureSet = { albedo: url };
      } else {
        res.status(400).json({
          error: 'Unsupported format. Upload .glb, .gltf, .usdz, or .zip (plus .png/.jpg for surface textures).',
        });
        return;
      }

      const manifest = readModelManifest();
      const prevAppearance = manifest[slot]?.appearance;
      const entry: StoredModelEntry = {
        slot,
        fileName,
        originalName,
        url,
        bytes: buf.length,
        uploadedAt: new Date().toISOString(),
        assetType,
        ...(textureSet ? { textureSet } : {}),
        ...(prevAppearance ? { appearance: prevAppearance } : {}),
      };

      manifest[slot] = entry;
      writeModelManifest(manifest);

      const enriched = buildEnrichedManifest(manifest);
      res.json({ ok: true, entry: enriched[slot], slots: enriched });
    }
  );

  // Assign an existing /public/assets/<folder>/<fileName> asset persistently into a slot
  app.post('/api/models/:slot/assign', (req: Request, res: Response) => {
    if (!isStudioUploadAuthorized(req)) {
      res.status(403).json({ error: 'Creator Studio access required.' });
      return;
    }

    const slot = String(req.params.slot ?? '').toLowerCase();
    if (!ALLOWED_SLOTS.has(slot)) {
      res.status(400).json({ error: 'Invalid asset slot.' });
      return;
    }

    const body = (req.body ?? {}) as { folder?: string; fileName?: string };
    const folder = sanitizeAssetFolder(body.folder);
    const assetFileName = sanitizeAssetFile(body.fileName);
    if (!folder || !assetFileName) {
      res.status(400).json({ error: 'Valid asset folder and file name are required.' });
      return;
    }

    const srcPath = resolveInsideAssets(folder, assetFileName);
    if (!srcPath || !fs.existsSync(srcPath) || !fs.statSync(srcPath).isFile()) {
      res.status(404).json({ error: 'Source asset not found in /public/assets/.' });
      return;
    }

    const ext = path.extname(assetFileName).toLowerCase();
    const isModelExt = /\.(glb|gltf|usdz|usd|usda|usdc)$/i.test(ext);
    const isSurfaceImg = slot === 'surface' && /\.(png|jpg|jpeg|webp)$/i.test(ext);
    if (!isModelExt && !isSurfaceImg) {
      res.status(400).json({ error: `Unsupported file type "${ext}" for slot "${slot}".` });
      return;
    }

    ensureModelsDir();
    clearSlotFiles(slot);

    const versionTs = Date.now();
    const fileSize = fs.statSync(srcPath).size;
    let fileName = `${slot}${ext}`;
    let url = `/models/${fileName}?v=${versionTs}`;
    let assetType: 'model' | 'surface-textures' = isSurfaceImg ? 'surface-textures' : 'model';
    let textureSet: SurfaceTextureSet | undefined = isSurfaceImg ? { albedo: url } : undefined;

    fs.copyFileSync(srcPath, path.join(modelsDir, fileName));

    const manifest = readModelManifest();
    const prevAppearance = manifest[slot]?.appearance;
    const isCharSlot = !['prop', 'stone', 'surface'].includes(slot);
    const entry: StoredModelEntry = {
      slot,
      fileName,
      originalName: assetFileName,
      url,
      bytes: fileSize,
      uploadedAt: new Date().toISOString(),
      assetType,
      ...(textureSet ? { textureSet } : {}),
      ...(isCharSlot && prevAppearance ? { appearance: prevAppearance } : {}),
    };

    manifest[slot] = entry;
    writeModelManifest(manifest);

    const enriched = buildEnrichedManifest(manifest);
    res.json({ ok: true, entry: enriched[slot], slots: enriched });
  });

  // Duplicate an existing slot's model/assets into another slot
  app.post('/api/models/:slot/duplicate', (req: Request, res: Response) => {
    if (!isStudioUploadAuthorized(req)) {
      res.status(403).json({ error: 'Creator Studio access required.' });
      return;
    }

    const targetSlot = String(req.params.slot ?? '').toLowerCase();
    const sourceSlot = String((req.body as { sourceSlot?: string } | undefined)?.sourceSlot ?? '').toLowerCase();
    if (!ALLOWED_SLOTS.has(targetSlot) || !ALLOWED_SLOTS.has(sourceSlot) || targetSlot === sourceSlot) {
      res.status(400).json({ error: 'Choose two distinct valid slots to duplicate.' });
      return;
    }

    const manifest = readModelManifest();
    const sourceEntry = manifest[sourceSlot];
    if (!sourceEntry) {
      res.status(404).json({ error: `Source slot "${sourceSlot}" has no saved model.` });
      return;
    }

    const sourceFull = path.resolve(modelsDir, sourceEntry.fileName);
    if (!fs.existsSync(sourceFull)) {
      res.status(404).json({ error: `Source file for "${sourceSlot}" is missing on disk.` });
      return;
    }

    ensureModelsDir();
    clearSlotFiles(targetSlot);

    const versionTs = Date.now();
    let targetFileName = '';
    let targetUrl = '';
    let targetTextureSet: SurfaceTextureSet | undefined;

    const sourceSubDir = path.join(modelsDir, sourceSlot);
    if (sourceEntry.fileName.startsWith(`${sourceSlot}/`) && fs.existsSync(sourceSubDir)) {
      const targetSubDir = path.join(modelsDir, targetSlot);
      fs.cpSync(sourceSubDir, targetSubDir, { recursive: true, force: true });
      const relInside = sourceEntry.fileName.slice(sourceSlot.length + 1);
      targetFileName = path.posix.join(targetSlot, relInside);
      targetUrl = `/models/${targetFileName.split('/').map(encodeURIComponent).join('/')}?v=${versionTs}`;
      if (sourceEntry.textureSet) {
        const remap = (u?: string) =>
          u ? u.replace(`/models/${sourceSlot}/`, `/models/${targetSlot}/`).replace(/\?v=\d+$/, `?v=${versionTs}`) : undefined;
        targetTextureSet = {
          albedo: remap(sourceEntry.textureSet.albedo),
          normal: remap(sourceEntry.textureSet.normal),
          roughness: remap(sourceEntry.textureSet.roughness),
          ao: remap(sourceEntry.textureSet.ao),
        };
      }
    } else {
      const srcExt = path.extname(sourceEntry.fileName) || '.glb';
      targetFileName = `${targetSlot}${srcExt}`;
      fs.copyFileSync(sourceFull, path.join(modelsDir, targetFileName));
      targetUrl = `/models/${targetFileName}?v=${versionTs}`;
      if (sourceEntry.textureSet?.albedo) {
        targetTextureSet = { albedo: targetUrl };
      }
    }

    const prevTargetAppearance = manifest[targetSlot]?.appearance;
    const isCharTarget = !['prop', 'stone', 'surface'].includes(targetSlot);
    const copiedEntry: StoredModelEntry = {
      slot: targetSlot,
      fileName: targetFileName,
      originalName: `${sourceEntry.originalName} (copy)`,
      url: targetUrl,
      bytes: sourceEntry.bytes,
      uploadedAt: new Date().toISOString(),
      assetType: sourceEntry.assetType ?? 'model',
      ...(targetTextureSet ? { textureSet: targetTextureSet } : {}),
      ...(isCharTarget && (prevTargetAppearance || sourceEntry.appearance)
        ? { appearance: prevTargetAppearance ?? sourceEntry.appearance }
        : {}),
    };

    manifest[targetSlot] = copiedEntry;
    writeModelManifest(manifest);
    const enriched = buildEnrichedManifest(manifest);
    res.json({ ok: true, entry: enriched[targetSlot], slots: enriched });
  });

  // Creator-only voice audio (.mp3/.ogg/.wav) upload endpoint
  app.post(
    '/api/voices/upload',
    express.raw({ type: 'application/octet-stream', limit: '15mb' }),
    (req: Request, res: Response) => {
      if (!isStudioUploadAuthorized(req)) {
        res.status(403).json({ error: 'Creator Studio access required.' });
        return;
      }
      const buf = req.body as Buffer;
      if (!Buffer.isBuffer(buf) || buf.length < 32) {
        res.status(400).json({ error: 'Missing audio clip payload.' });
        return;
      }
      const rawName = String(req.headers['x-file-name'] ?? 'clip.mp3');
      const safeName = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '_');
      if (!/\.(mp3|ogg|wav|m4a|webm)$/i.test(safeName)) {
        res.status(400).json({ error: 'Audio clip must be .mp3, .ogg, .wav, .m4a, or .webm.' });
        return;
      }
      fs.mkdirSync(voicesDir, { recursive: true });
      fs.writeFileSync(path.join(voicesDir, safeName), buf);
      res.json({ ok: true, fileName: safeName, url: `/audio/voices/${safeName}` });
    }
  );

  // Creator-only character appearance customization persistence (skin tone, outfit fabric, shoes)
  app.patch('/api/models/:slot/appearance', (req: Request, res: Response) => {
    if (!isStudioUploadAuthorized(req)) {
      res.status(403).json({ error: 'Creator Studio access required.' });
      return;
    }

    const slot = String(req.params.slot ?? '').toLowerCase();
    if (!ALLOWED_SLOTS.has(slot)) {
      res.status(400).json({ error: 'Invalid character slot.' });
      return;
    }

    const manifest = readModelManifest();
    const existing = manifest[slot];
    if (!existing) {
      res.status(404).json({ error: 'No saved model in this slot yet.' });
      return;
    }

    const body = (req.body ?? {}) as Partial<CharacterAppearance>;
    existing.appearance = {
      skinTone: String(body.skinTone ?? existing.appearance?.skinTone ?? 'original'),
      outfitStyle: String(body.outfitStyle ?? existing.appearance?.outfitStyle ?? 'original'),
      shoeStyle: String(body.shoeStyle ?? existing.appearance?.shoeStyle ?? 'original'),
    };
    writeModelManifest(manifest);

    const enriched = buildEnrichedManifest(manifest);
    res.json({ ok: true, entry: enriched[slot], slots: enriched });
  });

  // Creator-only clear slot back to built-in model
  app.delete('/api/models/:slot', (req: Request, res: Response) => {
    if (!isStudioUploadAuthorized(req)) {
      res.status(403).json({ error: 'Creator Studio access required.' });
      return;
    }

    const slot = String(req.params.slot ?? '').toLowerCase();
    if (!ALLOWED_SLOTS.has(slot)) {
      res.status(400).json({ error: 'Invalid character slot.' });
      return;
    }

    clearSlotFiles(slot);

    const manifest = readModelManifest();
    delete manifest[slot];
    writeModelManifest(manifest);

    const enriched = buildEnrichedManifest(manifest);
    res.json({ ok: true, slots: enriched });
  });

  // ---------------------------------------------------------------------------
  // Google AdSense / H5 Games Ads Compliance, Crawler Files & Editorial Pages
  // ---------------------------------------------------------------------------
  const contactMessagesFilePath = path.resolve(leaderboardDataDir, 'contact-messages.json');
  const CONTACT_EMAIL_RE = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[^\s@<>]{2,32}$/;
  const ALLOWED_CONTACT_TOPICS = new Set([
    'Support',
    'Privacy / Ad Preferences',
    'Copyright / Creator Studio',
    'Business & Press',
  ]);
  const contactRateBuckets = new Map<string, number[]>();

  interface StoredContactMessage {
    id: string;
    name: string;
    email: string;
    topic: string;
    message: string;
    createdAt: string;
  }

  const sanitizeContactText = (raw: unknown, maxLen: number): string =>
    String(raw ?? '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim()
      .slice(0, maxLen);

  const checkContactRateLimit = (ipKey: string): boolean => {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const recent = (contactRateBuckets.get(ipKey) ?? []).filter((ts) => now - ts < windowMs);
    if (recent.length >= 5) {
      contactRateBuckets.set(ipKey, recent);
      return false;
    }
    recent.push(now);
    contactRateBuckets.set(ipKey, recent);
    if (contactRateBuckets.size > 500) {
      for (const [k, list] of contactRateBuckets.entries()) {
        if (list.every((ts) => now - ts >= windowMs)) {
          contactRateBuckets.delete(k);
        }
      }
    }
    return true;
  };

  const persistContactMessage = (entry: StoredContactMessage): void => {
    fs.mkdirSync(leaderboardDataDir, { recursive: true });
    let list: StoredContactMessage[] = [];
    try {
      if (fs.existsSync(contactMessagesFilePath)) {
        const parsed = JSON.parse(fs.readFileSync(contactMessagesFilePath, 'utf8'));
        if (Array.isArray(parsed)) {
          list = parsed.filter(
            (item): item is StoredContactMessage =>
              Boolean(item && typeof item === 'object' && typeof item.id === 'string')
          );
        }
      }
    } catch {
      list = [];
    }
    list.push(entry);
    fs.writeFileSync(contactMessagesFilePath, JSON.stringify(list.slice(-200), null, 2), 'utf8');
  };

  const processContactSubmission = (
    rawBody: Record<string, unknown>,
    clientIp: string
  ):
    | { ok: true; record: StoredContactMessage }
    | { ok: false; statusCode: number; error: string; name: string; email: string; topic: string; body: string } => {
    const name = sanitizeContactText(rawBody.name, 80);
    const email = sanitizeContactText(rawBody.email, 160);
    const topicRaw = sanitizeContactText(rawBody.topic, 60);
    const topic = ALLOWED_CONTACT_TOPICS.has(topicRaw) ? topicRaw : 'Support';
    const message = sanitizeContactText(rawBody.message, 2000);

    if (!checkContactRateLimit(clientIp)) {
      return {
        ok: false,
        statusCode: 429,
        error: 'Too many messages sent recently. Please wait a few minutes before trying again.',
        name,
        email,
        topic,
        body: message,
      };
    }
    if (name.length < 2) {
      return {
        ok: false,
        statusCode: 400,
        error: 'Please enter your name (at least 2 characters).',
        name,
        email,
        topic,
        body: message,
      };
    }
    if (!CONTACT_EMAIL_RE.test(email)) {
      return {
        ok: false,
        statusCode: 400,
        error: 'Please provide a valid email address.',
        name,
        email,
        topic,
        body: message,
      };
    }
    if (message.length < 10) {
      return {
        ok: false,
        statusCode: 400,
        error: 'Please enter a message of at least 10 characters.',
        name,
        email,
        topic,
        body: message,
      };
    }

    const record: StoredContactMessage = {
      id: crypto.randomUUID(),
      name,
      email,
      topic,
      message,
      createdAt: new Date().toISOString(),
    };
    persistContactMessage(record);
    return { ok: true, record };
  };

  app.get('/ads.txt', (_req: Request, res: Response) => {
    const cfg = resolveAdsenseRuntimeConfig();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(renderAdsTxt(cfg));
  });

  app.get('/robots.txt', (req: Request, res: Response) => {
    const origin = resolveSafeOrigin(req);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(renderRobotsTxt(origin));
  });

  app.get('/sitemap.xml', (req: Request, res: Response) => {
    const origin = resolveSafeOrigin(req);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(renderSitemapXml(origin));
  });

  const COMPLIANCE_PAGES: CompliancePageId[] = [
    'about',
    'how-to-play',
    'privacy-policy',
    'terms',
    'contact',
  ];

  for (const pageId of COMPLIANCE_PAGES) {
    app.get([`/${pageId}`, `/${pageId}.html`], (req: Request, res: Response) => {
      const cfg = resolveAdsenseRuntimeConfig();
      const origin = resolveSafeOrigin(req);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(renderComplianceHtmlPage(pageId, origin, cfg));
    });
  }

  app.post(
    '/contact',
    express.urlencoded({ extended: false, limit: '16kb' }),
    (req: Request, res: Response) => {
      const cfg = resolveAdsenseRuntimeConfig();
      const origin = resolveSafeOrigin(req);
      const result = processContactSubmission(
        (req.body ?? {}) as Record<string, unknown>,
        String(req.ip || 'unknown')
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (!result.ok) {
        res.status(result.statusCode).send(
          renderComplianceHtmlPage('contact', origin, cfg, {
            status: 'error',
            message: result.error,
            name: result.name,
            email: result.email,
            topic: result.topic,
            body: result.body,
          })
        );
        return;
      }
      res.send(
        renderComplianceHtmlPage('contact', origin, cfg, {
          status: 'success',
          message: 'Thank you! Your message has been received by the Sonko team.',
        })
      );
    }
  );

  app.post('/api/contact', (req: Request, res: Response) => {
    const result = processContactSubmission(
      (req.body ?? {}) as Record<string, unknown>,
      String(req.ip || 'unknown')
    );
    if (!result.ok) {
      res.status(result.statusCode).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, id: result.record.id });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    // When HMR is disabled in middlewareMode, Vite 8 still injects @vite/client which attempts
    // to connect a WebSocket to port 24678. Neutralize transport.connect while preserving CSS helpers.
    app.use('/@vite/client', (req, res, next) => {
      delete req.headers['accept-encoding'];
      const chunks: Buffer[] = [];
      const origWrite = res.write.bind(res);
      const origEnd = res.end.bind(res);

      res.write = ((chunk: unknown) => {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        }
        return true;
      }) as typeof res.write;

      res.end = ((chunk?: unknown, ...rest: unknown[]) => {
        if (chunk && typeof chunk !== 'function') {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        }
        let body = Buffer.concat(chunks).toString('utf8');
        body = body.replace(
          'transport.connect(createHMRHandler(handleMessage));',
          '/* HMR WebSocket disabled */'
        );
        res.removeHeader('content-length');
        res.write = origWrite;
        res.end = origEnd;
        return origEnd(body, ...(rest as []));
      }) as typeof res.end;

      next();
    });

    app.get(['/', '/index.html'], async (req: Request, res: Response, next) => {
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        const rawHtml = fs.readFileSync(indexPath, 'utf8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        const cfg = resolveAdsenseRuntimeConfig();
        const finalHtml = injectAdsenseHeadIntoHtml(transformed, cfg);
        res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').end(finalHtml);
      } catch (err) {
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir, { index: false }));
      app.get('*', (_req: Request, res: Response) => {
        const indexFile = path.join(distDir, 'index.html');
        const rawHtml = fs.readFileSync(indexFile, 'utf8');
        const cfg = resolveAdsenseRuntimeConfig();
        const finalHtml = injectAdsenseHeadIntoHtml(rawHtml, cfg);
        res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(finalHtml);
      });
    }
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const rooms = new Map<string, RoomState>();

  // Track socket -> { roomCode, slot, clientId }
  const socketMeta = new WeakMap<WebSocket, { roomCode: string; slot: 0 | 1; clientId: string }>();

  const hexColorRe = /^#[0-9a-fA-F]{6}$/;
  const defaultCosmetics = (raw?: Partial<PlayerCosmetics>): PlayerCosmetics => ({
    stoneId: raw?.stoneId ?? 'river_pebble',
    outfitId: raw?.outfitId ?? 'banana_emerald',
    stencilId: raw?.stencilId ?? 'basket_weave',
    hairStyle: raw?.hairStyle && ['braids', 'afro', 'bun', 'fade'].includes(raw.hairStyle)
      ? raw.hairStyle
      : 'braids',
    skinTone: raw?.skinTone ?? '#6B3A24',
    primaryColor:
      typeof raw?.primaryColor === 'string' && hexColorRe.test(raw.primaryColor)
        ? raw.primaryColor
        : undefined,
    accentColor:
      typeof raw?.accentColor === 'string' && hexColorRe.test(raw.accentColor)
        ? raw.accentColor
        : undefined,
  });

  const makeSlot = (
    slot: 0 | 1,
    clientId: string,
    name: string,
    cosmetics: PlayerCosmetics,
    ws: WebSocket
  ): ServerPlayerSlot => ({
    clientId,
    slot,
    name: name.trim().slice(0, 22) || (slot === 0 ? 'Host' : 'Challenger'),
    connected: true,
    cosmetics,
    targetSquare: 1,
    score: 0,
    housesOwned: [],
    streak: 0,
    bestStreak: 0,
    perfectTosses: 0,
    fouls: 0,
    roundsCleared: 0,
    ws,
  });

  const resetRoomForMatch = (room: RoomState) => {
    room.status = 'PLAYING';
    room.activeSlot = 0;
    room.turnCount = 1;
    room.windX = rollVenueWind(room.venue);
    room.puddleSquares = getVenuePuddles(room.venue, room.courtSize);
    room.houses = {};
    room.winnerSlot = null;
    room.winReason = null;
    room.rematchVotes = [false, false];
    for (const sl of room.slots) {
      if (!sl) continue;
      sl.targetSquare = 1;
      sl.score = 0;
      sl.housesOwned = [];
      sl.streak = 0;
      sl.bestStreak = 0;
      sl.perfectTosses = 0;
      sl.fouls = 0;
      sl.roundsCleared = 0;
    }
  };

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (rawData) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(rawData.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = String(msg.type ?? '');
      const clientId = String(msg.clientId ?? crypto.randomUUID());

      if (type === 'ping') {
        sendJson(ws, { type: 'pong' });
        return;
      }

      if (type === 'room:create' || type === 'room:quickmatch') {
        const isPublic = type === 'room:quickmatch';
        const playerName = String(msg.playerName ?? 'Host');
        const courtSize: CourtSize = msg.courtSize === 5 ? 5 : 10;
        const venueRaw = String(msg.venue ?? 'kampala_murram') as CourtVenueId;
        const venue: CourtVenueId = ['kampala_murram', 'entebbe_sand', 'jinja_rain', 'ndere_night'].includes(venueRaw)
          ? venueRaw
          : 'kampala_murram';
        const cosmetics = defaultCosmetics(msg.cosmetics as Partial<PlayerCosmetics> | undefined);

        // For Quick Match, look for an existing waiting public room first
        if (isPublic) {
          for (const existing of rooms.values()) {
            if (
              existing.isPublic &&
              existing.status === 'WAITING' &&
              existing.slots[0] &&
              existing.slots[0].clientId !== clientId &&
              !existing.slots[1]
            ) {
              existing.slots[1] = makeSlot(1, clientId, playerName, cosmetics, ws);
              existing.lastActiveAt = Date.now();
              socketMeta.set(ws, { roomCode: existing.code, slot: 1, clientId });
              resetRoomForMatch(existing);
              sendJson(ws, {
                type: 'room:joined',
                yourSlot: 1,
                room: serializeRoom(existing),
              });
              broadcastRoom(
                existing,
                {
                  type: 'room:state',
                  room: serializeRoom(existing),
                },
                1
              );
              return;
            }
          }
        }

        const code = generateRoomCode(rooms);
        const room: RoomState = {
          code,
          isPublic,
          courtSize,
          venue,
          status: 'WAITING',
          activeSlot: 0,
          turnCount: 1,
          windX: rollVenueWind(venue),
          puddleSquares: getVenuePuddles(venue, courtSize),
          houses: {},
          winnerSlot: null,
          winReason: null,
          rematchVotes: [false, false],
          slots: [makeSlot(0, clientId, playerName, cosmetics, ws), null],
          lastActiveAt: Date.now(),
        };
        rooms.set(code, room);
        socketMeta.set(ws, { roomCode: code, slot: 0, clientId });
        sendJson(ws, {
          type: 'room:joined',
          yourSlot: 0,
          room: serializeRoom(room),
        });
        return;
      }

      if (type === 'room:join') {
        const code = String(msg.code ?? '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          sendJson(ws, { type: 'room:error', message: `Courtyard room "${code}" was not found.` });
          return;
        }
        room.lastActiveAt = Date.now();
        const playerName = String(msg.playerName ?? 'Challenger');
        const cosmetics = defaultCosmetics(msg.cosmetics as Partial<PlayerCosmetics> | undefined);

        // Reconnect check by clientId
        const existingSlot = room.slots.find((sl) => sl?.clientId === clientId);
        if (existingSlot) {
          existingSlot.ws = ws;
          existingSlot.connected = true;
          existingSlot.cosmetics = cosmetics;
          socketMeta.set(ws, { roomCode: room.code, slot: existingSlot.slot, clientId });
          sendJson(ws, {
            type: 'room:joined',
            yourSlot: existingSlot.slot,
            room: serializeRoom(room),
          });
          broadcastRoom(room, { type: 'room:state', room: serializeRoom(room) }, existingSlot.slot);
          return;
        }

        if (room.slots[1]) {
          sendJson(ws, { type: 'room:error', message: `Room ${code} already has 2 players.` });
          return;
        }

        room.slots[1] = makeSlot(1, clientId, playerName, cosmetics, ws);
        socketMeta.set(ws, { roomCode: room.code, slot: 1, clientId });
        resetRoomForMatch(room);

        sendJson(ws, {
          type: 'room:joined',
          yourSlot: 1,
          room: serializeRoom(room),
        });
        broadcastRoom(room, { type: 'room:state', room: serializeRoom(room) }, 1);
        return;
      }

      const meta = socketMeta.get(ws);
      if (!meta) return;
      const room = rooms.get(meta.roomCode);
      if (!room) return;
      room.lastActiveAt = Date.now();
      const player = room.slots[meta.slot];
      if (!player) return;

      if (type === 'room:leave') {
        player.connected = false;
        player.ws = null;
        socketMeta.delete(ws);
        broadcastRoom(room, { type: 'room:state', room: serializeRoom(room) }, meta.slot);
        return;
      }

      if (type === 'room:rematch') {
        if (room.status !== 'GAME_OVER') return;
        room.rematchVotes[meta.slot] = true;
        if (room.rematchVotes[0] && room.rematchVotes[1]) {
          resetRoomForMatch(room);
          broadcastRoom(room, { type: 'room:rematch_start', room: serializeRoom(room) });
        } else {
          broadcastRoom(room, { type: 'room:state', room: serializeRoom(room) });
        }
        return;
      }

      // Live gameplay actions require PLAYING and active turn ownership
      if (room.status !== 'PLAYING' || room.activeSlot !== meta.slot) {
        return;
      }

      if (type === 'player:aim') {
        broadcastRoom(
          room,
          {
            type: 'remote:aim',
            slot: meta.slot,
            angleOffset: Number(msg.angleOffset ?? 0),
            aimPower: Number(msg.aimPower ?? 0.12),
            isCharging: Boolean(msg.isCharging),
          },
          meta.slot
        );
        return;
      }

      if (type === 'player:toss') {
        const isClaim = Boolean(msg.isClaim);
        const angleOffset = Math.max(-0.48, Math.min(0.48, Number(msg.angleOffset ?? 0)));
        const aimPower = Math.max(0.06, Math.min(1, Number(msg.aimPower ?? 0.15)));
        const jitter = isClaim ? 0.04 : 0.005;
        const dist = 0.08 + aimPower * 0.82;
        const angle = -Math.PI / 2 + angleOffset;
        const targetX = 0.5 + Math.cos(angle) * dist * 0.65 + (Math.random() - 0.5) * jitter;
        const targetY = 0.945 + Math.sin(angle) * dist + (Math.random() - 0.5) * jitter;

        broadcastRoom(room, {
          type: 'game:toss',
          slot: meta.slot,
          isClaim,
          targetX,
          targetY,
          windX: room.windX,
        });
        return;
      }

      if (type === 'player:hop') {
        broadcastRoom(
          room,
          {
            type: 'remote:hop',
            slot: meta.slot,
          },
          meta.slot
        );
        return;
      }

      if (type === 'player:pickup') {
        player.score += 40;
        broadcastRoom(
          room,
          {
            type: 'remote:pickup',
            slot: meta.slot,
            score: player.score,
          },
          meta.slot
        );
        return;
      }

      if (type === 'player:balance') {
        broadcastRoom(
          room,
          {
            type: 'remote:balance',
            slot: meta.slot,
            balance: Number(msg.balance ?? 100),
            balanceSway: Number(msg.balanceSway ?? 0),
          },
          meta.slot
        );
        return;
      }

      if (type === 'player:toss_result') {
        const kind = String(msg.kind ?? '');
        if (kind === 'BULLSEYE') {
          player.perfectTosses += 1;
          player.score += 60;
        } else if (kind === 'CLEAN') {
          player.score += 25;
        } else if (kind === 'CLAIM_SUCCESS') {
          const squareId = Number(msg.squareId ?? 0);
          const sqs = buildServerSquares(room.courtSize);
          const validSq = sqs.find((s) => s.id === squareId && !s.isHome);
          if (validSq && room.houses[squareId] === undefined) {
            room.houses[squareId] = meta.slot;
            player.housesOwned.push(squareId);
            player.score += 180;
          }
        }
        broadcastRoom(room, { type: 'room:state', room: serializeRoom(room) });
        return;
      }

      if (type === 'player:turn_end') {
        const outcome = String(msg.outcome ?? 'FOUL');
        if (outcome === 'FOUL') {
          player.fouls += 1;
          player.streak = 0;
          room.activeSlot = room.activeSlot === 0 ? 1 : 0;
          room.turnCount += 1;
          room.windX = rollVenueWind(room.venue);
          broadcastRoom(room, {
            type: 'game:turn_advance',
            reason: String(msg.reason ?? 'Foul!'),
            room: serializeRoom(room),
          });
          return;
        }

        if (outcome === 'ROUND_CLEAR') {
          player.roundsCleared += 1;
          player.streak += 1;
          player.bestStreak = Math.max(player.bestStreak, player.streak);
          player.score += 100 + player.streak * 25;

          const finishedCourse = player.targetSquare >= room.courtSize;
          if (finishedCourse) {
            player.score += 250;
            room.status = 'GAME_OVER';
            room.winnerSlot = meta.slot;
            room.winReason = `${player.name} conquered Square ${room.courtSize}!`;
            broadcastRoom(room, {
              type: 'game:over',
              room: serializeRoom(room),
            });
            return;
          }

          const midTrigger = room.courtSize === 10 ? 5 : 3;
          const justClearedMid = player.targetSquare === midTrigger && player.housesOwned.length === 0;
          player.targetSquare += 1;

          if (justClearedMid) {
            // Same active player gets a blind Claim Toss!
            broadcastRoom(room, {
              type: 'game:claim_phase',
              slot: meta.slot,
              room: serializeRoom(room),
            });
            return;
          }

          room.activeSlot = room.activeSlot === 0 ? 1 : 0;
          room.turnCount += 1;
          room.windX = rollVenueWind(room.venue);
          broadcastRoom(room, {
            type: 'game:turn_advance',
            reason: 'ROUND_CLEAR',
            room: serializeRoom(room),
          });
          return;
        }

        if (outcome === 'CLAIM_COMPLETE') {
          room.activeSlot = room.activeSlot === 0 ? 1 : 0;
          room.turnCount += 1;
          room.windX = rollVenueWind(room.venue);
          broadcastRoom(room, {
            type: 'game:turn_advance',
            reason: 'CLAIM_COMPLETE',
            room: serializeRoom(room),
          });
        }
      }
    });

    ws.on('close', () => {
      const meta = socketMeta.get(ws);
      if (!meta) return;
      const room = rooms.get(meta.roomCode);
      if (!room) return;
      const slot = room.slots[meta.slot];
      if (slot && slot.ws === ws) {
        slot.connected = false;
        slot.ws = null;
        broadcastRoom(room, { type: 'room:state', room: serializeRoom(room) }, meta.slot);
      }
    });
  });

  // Periodic stale room cleanup
  setInterval(() => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [code, room] of rooms.entries()) {
      const anyConnected = room.slots.some((sl) => sl?.connected);
      if (!anyConnected && room.lastActiveAt < cutoff) {
        rooms.delete(code);
      }
    }
  }, 60 * 1000);

  server.listen(port, '0.0.0.0', () => {
    console.log(`Sonko Courtyard server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Sonko server:', err);
  process.exit(1);
});
