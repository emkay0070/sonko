import type { AvatarCustomization, ProgressionData } from './progression';
import type { HairStyle, OutfitId, StencilId, StoneId } from './types';

export interface UnlockedEquipmentState {
  unlockedStones: StoneId[];
  unlockedOutfits: OutfitId[];
  unlockedStencils: StencilId[];
  equippedStone: StoneId;
  equippedOutfit: OutfitId;
  equippedStencil: StencilId;
}

export interface SerializedAvatarLoadout extends UnlockedEquipmentState {
  version: 1;
  avatar: AvatarCustomization;
  updatedAt: string;
}

const STORAGE_KEY = 'sonko_avatar_loadout_v1';
const IDB_NAME = 'sonko_loadout_persistence_v1';
const IDB_VERSION = 1;
const IDB_STORE = 'loadouts';
const IDB_RECORD_KEY = 'active_player_loadout';

export const VALID_HAIR_STYLES: readonly HairStyle[] = ['braids', 'afro', 'bun', 'fade'];

export const VALID_STONE_IDS: readonly StoneId[] = [
  'river_pebble',
  'kisii_soapstone',
  'entebbe_basalt',
  'cowrie_inlaid',
  'royal_sunstone',
];

export const VALID_OUTFIT_IDS: readonly OutfitId[] = [
  'banana_emerald',
  'kampala_sunset',
  'lake_victoria',
  'barkcloth_royal',
  'crested_plumage',
];

export const VALID_STENCIL_IDS: readonly StencilId[] = [
  'basket_weave',
  'sunburst',
  'royal_drums',
  'crested_crown',
];

const OUTFIT_FALLBACK_COLORS: Record<OutfitId, { primaryColor: string; accentColor: string }> = {
  banana_emerald: { primaryColor: '#15803D', accentColor: '#FBBF24' },
  kampala_sunset: { primaryColor: '#EA580C', accentColor: '#FEF08A' },
  lake_victoria: { primaryColor: '#1D4ED8', accentColor: '#FDE047' },
  barkcloth_royal: { primaryColor: '#7C2D12', accentColor: '#FBBF24' },
  crested_plumage: { primaryColor: '#18181B', accentColor: '#EF4444' },
};

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const PLAYER_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

function dedupeAllowed<T extends string>(
  rawList: unknown,
  allowed: readonly T[],
  requiredStarter: T
): T[] {
  const allowedSet = new Set<string>(allowed);
  const out: T[] = [requiredStarter];
  const seen = new Set<string>([requiredStarter]);

  if (Array.isArray(rawList)) {
    for (const item of rawList) {
      if (typeof item === 'string' && allowedSet.has(item) && !seen.has(item)) {
        seen.add(item);
        out.push(item as T);
      }
    }
  }
  return out;
}

function normalizeHex(val: unknown, fallback: string): string {
  if (typeof val === 'string' && HEX_COLOR_RE.test(val.trim())) {
    return val.trim().toUpperCase();
  }
  return fallback.toUpperCase();
}

export function createDefaultAvatarLoadout(): SerializedAvatarLoadout {
  return {
    version: 1,
    avatar: {
      hairStyle: 'braids',
      primaryColor: OUTFIT_FALLBACK_COLORS.banana_emerald.primaryColor,
      accentColor: OUTFIT_FALLBACK_COLORS.banana_emerald.accentColor,
    },
    unlockedStones: ['river_pebble'],
    unlockedOutfits: ['banana_emerald'],
    unlockedStencils: ['basket_weave'],
    equippedStone: 'river_pebble',
    equippedOutfit: 'banana_emerald',
    equippedStencil: 'basket_weave',
    updatedAt: new Date(0).toISOString(),
  };
}

export function sanitizeAvatarCustomization(
  raw: unknown,
  fallbackOutfit: OutfitId = 'banana_emerald'
): AvatarCustomization {
  const obj = raw && typeof raw === 'object' ? (raw as Partial<AvatarCustomization>) : {};
  const colors = OUTFIT_FALLBACK_COLORS[fallbackOutfit] ?? OUTFIT_FALLBACK_COLORS.banana_emerald;
  const hairStyle: HairStyle = VALID_HAIR_STYLES.includes(obj.hairStyle as HairStyle)
    ? (obj.hairStyle as HairStyle)
    : 'braids';

  return {
    hairStyle,
    primaryColor: normalizeHex(obj.primaryColor, colors.primaryColor),
    accentColor: normalizeHex(obj.accentColor, colors.accentColor),
  };
}

export function sanitizeAvatarLoadout(raw: unknown): SerializedAvatarLoadout {
  const defaults = createDefaultAvatarLoadout();
  if (!raw || typeof raw !== 'object') return defaults;

  const obj = raw as Partial<SerializedAvatarLoadout>;
  const unlockedStones = dedupeAllowed(obj.unlockedStones, VALID_STONE_IDS, 'river_pebble');
  const unlockedOutfits = dedupeAllowed(obj.unlockedOutfits, VALID_OUTFIT_IDS, 'banana_emerald');
  const unlockedStencils = dedupeAllowed(obj.unlockedStencils, VALID_STENCIL_IDS, 'basket_weave');

  const equippedStone: StoneId = VALID_STONE_IDS.includes(obj.equippedStone as StoneId)
    ? (obj.equippedStone as StoneId)
    : 'river_pebble';
  if (!unlockedStones.includes(equippedStone)) {
    unlockedStones.push(equippedStone);
  }

  const equippedOutfit: OutfitId = VALID_OUTFIT_IDS.includes(obj.equippedOutfit as OutfitId)
    ? (obj.equippedOutfit as OutfitId)
    : 'banana_emerald';
  if (!unlockedOutfits.includes(equippedOutfit)) {
    unlockedOutfits.push(equippedOutfit);
  }

  const equippedStencil: StencilId = VALID_STENCIL_IDS.includes(obj.equippedStencil as StencilId)
    ? (obj.equippedStencil as StencilId)
    : 'basket_weave';
  if (!unlockedStencils.includes(equippedStencil)) {
    unlockedStencils.push(equippedStencil);
  }

  const avatar = sanitizeAvatarCustomization(obj.avatar, equippedOutfit);
  const parsedTime = typeof obj.updatedAt === 'string' ? Date.parse(obj.updatedAt) : NaN;
  const updatedAt = Number.isFinite(parsedTime)
    ? new Date(parsedTime).toISOString()
    : new Date().toISOString();

  return {
    version: 1,
    avatar,
    unlockedStones,
    unlockedOutfits,
    unlockedStencils,
    equippedStone,
    equippedOutfit,
    equippedStencil,
    updatedAt,
  };
}

export function extractAvatarLoadout(
  prog: Pick<
    ProgressionData,
    | 'avatar'
    | 'unlockedStones'
    | 'unlockedOutfits'
    | 'unlockedStencils'
    | 'equippedStone'
    | 'equippedOutfit'
    | 'equippedStencil'
  >,
  updatedAt?: string
): SerializedAvatarLoadout {
  return sanitizeAvatarLoadout({
    version: 1,
    avatar: prog.avatar,
    unlockedStones: prog.unlockedStones,
    unlockedOutfits: prog.unlockedOutfits,
    unlockedStencils: prog.unlockedStencils,
    equippedStone: prog.equippedStone,
    equippedOutfit: prog.equippedOutfit,
    equippedStencil: prog.equippedStencil,
    updatedAt: updatedAt ?? new Date().toISOString(),
  });
}

export function serializeAvatarLoadout(
  state:
    | SerializedAvatarLoadout
    | Pick<
        ProgressionData,
        | 'avatar'
        | 'unlockedStones'
        | 'unlockedOutfits'
        | 'unlockedStencils'
        | 'equippedStone'
        | 'equippedOutfit'
        | 'equippedStencil'
      >
): string {
  const normalized = sanitizeAvatarLoadout(state);
  return JSON.stringify(normalized);
}

export function deserializeAvatarLoadout(raw: string | unknown): SerializedAvatarLoadout | null {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return null;
    return sanitizeAvatarLoadout(parsed);
  } catch {
    return null;
  }
}

export function loadoutsMatch(a: SerializedAvatarLoadout, b: SerializedAvatarLoadout): boolean {
  if (
    a.avatar.hairStyle !== b.avatar.hairStyle ||
    a.avatar.primaryColor.toUpperCase() !== b.avatar.primaryColor.toUpperCase() ||
    a.avatar.accentColor.toUpperCase() !== b.avatar.accentColor.toUpperCase() ||
    a.equippedStone !== b.equippedStone ||
    a.equippedOutfit !== b.equippedOutfit ||
    a.equippedStencil !== b.equippedStencil
  ) {
    return false;
  }
  const sameSet = <T extends string>(x: T[], y: T[]) => {
    if (x.length !== y.length) return false;
    const setY = new Set(y);
    return x.every((item) => setY.has(item));
  };
  return (
    sameSet(a.unlockedStones, b.unlockedStones) &&
    sameSet(a.unlockedOutfits, b.unlockedOutfits) &&
    sameSet(a.unlockedStencils, b.unlockedStencils)
  );
}

/**
 * Merges two loadout snapshots without ever losing unlocked items:
 * - Unlocks are combined via catalog-validated union.
 * - Equipped items & AvatarCustomization come from whichever snapshot is more recent
 *   (or has non-default selections when timestamps tie).
 */
export function mergeAvatarLoadouts(
  a: SerializedAvatarLoadout,
  b: SerializedAvatarLoadout
): SerializedAvatarLoadout {
  const tA = Date.parse(a.updatedAt) || 0;
  const tB = Date.parse(b.updatedAt) || 0;
  const newer = tB > tA ? b : a;

  return sanitizeAvatarLoadout({
    version: 1,
    avatar: newer.avatar,
    equippedStone: newer.equippedStone,
    equippedOutfit: newer.equippedOutfit,
    equippedStencil: newer.equippedStencil,
    unlockedStones: [...a.unlockedStones, ...b.unlockedStones],
    unlockedOutfits: [...a.unlockedOutfits, ...b.unlockedOutfits],
    unlockedStencils: [...a.unlockedStencils, ...b.unlockedStencils],
    updatedAt: new Date(Math.max(tA, tB, Date.now())).toISOString(),
  });
}

export function applyLoadoutToProgression(
  prog: ProgressionData,
  loadout: SerializedAvatarLoadout
): ProgressionData {
  const clean = sanitizeAvatarLoadout(loadout);
  return {
    ...prog,
    avatar: { ...clean.avatar },
    unlockedStones: [...clean.unlockedStones],
    unlockedOutfits: [...clean.unlockedOutfits],
    unlockedStencils: [...clean.unlockedStencils],
    equippedStone: clean.equippedStone,
    equippedOutfit: clean.equippedOutfit,
    equippedStencil: clean.equippedStencil,
  };
}

function openLoadoutIDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveAvatarLoadoutToIDB(loadout: SerializedAvatarLoadout): Promise<void> {
  const db = await openLoadoutIDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put({ id: IDB_RECORD_KEY, ...sanitizeAvatarLoadout(loadout) });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function loadAvatarLoadoutFromIDB(): Promise<SerializedAvatarLoadout | null> {
  const db = await openLoadoutIDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_RECORD_KEY);
      req.onsuccess = () => {
        const result = deserializeAvatarLoadout(req.result);
        db.close();
        resolve(result);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export function loadLocalAvatarLoadout(): SerializedAvatarLoadout | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return deserializeAvatarLoadout(raw);
  } catch {
    return null;
  }
}

export function saveLocalAvatarLoadout(loadout: SerializedAvatarLoadout): SerializedAvatarLoadout {
  const clean = sanitizeAvatarLoadout(loadout);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeAvatarLoadout(clean));
    } catch {
      // Ignore quota errors gracefully
    }
    void saveAvatarLoadoutToIDB(clean);
  }
  return clean;
}

export async function fetchRemoteAvatarLoadout(
  playerId: string
): Promise<SerializedAvatarLoadout | null> {
  if (!PLAYER_ID_RE.test(playerId)) return null;
  try {
    const res = await fetch(`/api/loadout/${encodeURIComponent(playerId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { loadout?: unknown };
    if (!body?.loadout) return null;
    return deserializeAvatarLoadout(body.loadout);
  } catch {
    return null;
  }
}

export async function saveRemoteAvatarLoadout(
  playerId: string,
  loadout: SerializedAvatarLoadout
): Promise<SerializedAvatarLoadout | null> {
  if (!PLAYER_ID_RE.test(playerId)) return null;
  const clean = sanitizeAvatarLoadout(loadout);
  try {
    const res = await fetch(`/api/loadout/${encodeURIComponent(playerId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: serializeAvatarLoadout(clean),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { loadout?: unknown };
    return body?.loadout ? deserializeAvatarLoadout(body.loadout) : clean;
  } catch {
    return null;
  }
}

/**
 * Reconciles current client progression with IndexedDB and server-stored loadout,
 * ensuring unlocked equipment and customized appearance stay consistent across sessions.
 */
export async function hydrateAvatarLoadout(
  playerId: string,
  currentProg: ProgressionData
): Promise<SerializedAvatarLoadout | null> {
  const currentLoadout = extractAvatarLoadout(currentProg, loadLocalAvatarLoadout()?.updatedAt);
  const [idbLoadout, remoteLoadout] = await Promise.all([
    loadAvatarLoadoutFromIDB(),
    fetchRemoteAvatarLoadout(playerId),
  ]);

  let merged = currentLoadout;
  if (idbLoadout) {
    merged = mergeAvatarLoadouts(merged, idbLoadout);
  }
  if (remoteLoadout) {
    merged = mergeAvatarLoadouts(merged, remoteLoadout);
  }

  saveLocalAvatarLoadout(merged);

  // If local/IDB had newer customization or unlocks than the server, sync up
  if (!remoteLoadout || !loadoutsMatch(remoteLoadout, merged)) {
    void saveRemoteAvatarLoadout(playerId, merged);
  }

  return loadoutsMatch(currentLoadout, merged) ? null : merged;
}

let syncTimer: number | null = null;
let lastSyncedSnapshotKey = '';

export function scheduleAvatarLoadoutSync(
  playerId: string,
  prog: ProgressionData
): void {
  const loadout = extractAvatarLoadout(prog);
  saveLocalAvatarLoadout(loadout);

  const snapshotKey = JSON.stringify({
    avatar: loadout.avatar,
    s: loadout.equippedStone,
    o: loadout.equippedOutfit,
    t: loadout.equippedStencil,
    us: loadout.unlockedStones,
    uo: loadout.unlockedOutfits,
    ut: loadout.unlockedStencils,
  });
  if (snapshotKey === lastSyncedSnapshotKey) return;
  lastSyncedSnapshotKey = snapshotKey;

  if (typeof window === 'undefined') return;
  if (syncTimer !== null) {
    window.clearTimeout(syncTimer);
  }
  syncTimer = window.setTimeout(() => {
    syncTimer = null;
    void saveRemoteAvatarLoadout(playerId, loadout);
  }, 350);
}
