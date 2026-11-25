import {
  CourtVenueId,
  Difficulty,
  HairStyle,
  MatchRewardSummary,
  OutfitId,
  PlayMode,
  PlayerState,
  StencilId,
  StoneId,
} from './types';
import {
  DailyStreakState,
  DEFAULT_DAILY_STREAK,
  sanitizeDailyStreak,
} from './dailyStreak';
import {
  createDefaultDailyMission,
  DailyMissionState,
  sanitizeDailyMission,
} from './dailyMission';
import {
  applyLoadoutToProgression,
  extractAvatarLoadout,
  loadLocalAvatarLoadout,
  mergeAvatarLoadouts,
  sanitizeAvatarLoadout,
  saveLocalAvatarLoadout,
} from './avatarLoadoutService';

export interface CourtVenueSpec {
  id: CourtVenueId;
  name: string;
  shortName: string;
  region: string;
  mechanicTag: string;
  description: string;
  cowrieMultiplier: number;
  swatchTop: string;
  swatchBottom: string;
  accentHex: string;
}

export const COURT_VENUES: CourtVenueSpec[] = [
  {
    id: 'kampala_murram',
    name: 'Kampala Murram',
    shortName: 'Kampala',
    region: 'Central Compound',
    mechanicTag: 'Classic Soil',
    description: 'Packed red laterite earth with crisp chalk lines and true bounce.',
    cowrieMultiplier: 1.0,
    swatchTop: '#78321C',
    swatchBottom: '#AA4A2C',
    accentHex: '#F59E0B',
  },
  {
    id: 'entebbe_sand',
    name: 'Entebbe Lakeside',
    shortName: 'Entebbe',
    region: 'Lake Victoria Shore',
    mechanicTag: 'Breeze + Soft Sand',
    description: 'Lake winds nudge high stone throws while shoreline sand cushions bounces.',
    cowrieMultiplier: 1.2,
    swatchTop: '#1E5B70',
    swatchBottom: '#C79B5E',
    accentHex: '#38BDF8',
  },
  {
    id: 'jinja_rain',
    name: 'Jinja Rainy Yard',
    shortName: 'Jinja',
    region: 'Nile Mist Grounds',
    mechanicTag: 'Slick Puddles',
    description: 'Standing rain puddles cause stone skids and test single-foot balance.',
    cowrieMultiplier: 1.35,
    swatchTop: '#2E3B3E',
    swatchBottom: '#573628',
    accentHex: '#60A5FA',
  },
  {
    id: 'ndere_night',
    name: 'Ndere Lantern Court',
    shortName: 'Ndere Night',
    region: 'Twilight Arena',
    mechanicTag: 'Tight Chalk Lines',
    description: 'Glowing courtyard lanterns, rising fireflies, and sharper line judgment.',
    cowrieMultiplier: 1.5,
    swatchTop: '#161124',
    swatchBottom: '#3B1E14',
    accentHex: '#FBBF24',
  },
];

export function getVenueSpec(id: CourtVenueId): CourtVenueSpec {
  return COURT_VENUES.find((v) => v.id === id) ?? COURT_VENUES[0];
}

export type WorldPlaceId =
  | 'kampala_compound'
  | 'primary_schoolyard'
  | 'entebbe_lakeside'
  | 'trading_centre'
  | 'ndere_festival';

export interface WorldPlaceSpec {
  id: WorldPlaceId;
  name: string;
  shortName: string;
  region: string;
  venueId: CourtVenueId;
  defaultPeriod: 'morning' | 'midday' | 'golden' | 'night';
  tag: string;
  description: string;
}

export const WORLD_PLACES: WorldPlaceSpec[] = [
  {
    id: 'kampala_compound',
    name: 'Kampala Compound',
    shortName: 'Kampala Compound',
    region: 'Family Courtyard',
    venueId: 'kampala_murram',
    defaultPeriod: 'midday',
    tag: 'Classic Soil',
    description: 'Home red-earth courtyard beside the banana garden with true bounce.',
  },
  {
    id: 'primary_schoolyard',
    name: 'Primary Schoolyard',
    shortName: 'Schoolyard',
    region: 'Park & Playground',
    venueId: 'kampala_murram',
    defaultPeriod: 'morning',
    tag: 'Crisp Murram',
    description: 'Sunlit park & primary schoolyard with shaded lawns and playground swings.',
  },
  {
    id: 'entebbe_lakeside',
    name: 'Entebbe Lakeside',
    shortName: 'Entebbe Lakeside',
    region: 'Lake Victoria Shore',
    venueId: 'entebbe_sand',
    defaultPeriod: 'golden',
    tag: 'Breeze + Sand',
    description: 'Lake winds nudge high stone throws while shoreline sand cushions bounces.',
  },
  {
    id: 'trading_centre',
    name: 'Trading Centre',
    shortName: 'Trading Centre',
    region: 'Market Square',
    venueId: 'jinja_rain',
    defaultPeriod: 'midday',
    tag: 'Slick Puddles',
    description: 'Lively market court with standing puddles that test balance and skids.',
  },
  {
    id: 'ndere_festival',
    name: 'Ndere Festival',
    shortName: 'Ndere Festival',
    region: 'Lantern Arena',
    venueId: 'ndere_night',
    defaultPeriod: 'night',
    tag: 'Tight Lines',
    description: 'Lantern-lit cultural grounds with fireflies and sharp chalk judgment.',
  },
];

export function getPlaceSpec(id: WorldPlaceId): WorldPlaceSpec {
  return WORLD_PLACES.find((p) => p.id === id) ?? WORLD_PLACES[0];
}

export interface StoneCatalogItem {
  id: StoneId;
  name: string;
  description: string;
  price: number;
  coreColor: string;
  midColor: string;
  edgeColor: string;
  motifColor: string;
  dustColor: string;
  motif: 'circle' | 'spiral' | 'ember' | 'cowrie' | 'sunburst';
}

export interface OutfitCatalogItem {
  id: OutfitId;
  name: string;
  description: string;
  price: number;
  primaryColor: string;
  accentColor: string;
}

export interface StencilCatalogItem {
  id: StencilId;
  name: string;
  description: string;
  price: number;
}

export const STONE_CATALOG: StoneCatalogItem[] = [
  {
    id: 'river_pebble',
    name: 'Nile River Pebble',
    description: 'Classic flat grey stone worn smooth by river currents.',
    price: 0,
    coreColor: '#D6CFC7',
    midColor: '#8A817C',
    edgeColor: '#463F3A',
    motifColor: '#FBBF24',
    dustColor: '#D68C6B',
    motif: 'circle',
  },
  {
    id: 'kisii_soapstone',
    name: 'Kisii Soapstone',
    description: 'Warm rose-cream carved stone with pale chalk spiral.',
    price: 50,
    coreColor: '#FDE8D7',
    midColor: '#D9A796',
    edgeColor: '#8C584C',
    motifColor: '#FFFBEB',
    dustColor: '#FDE8D7',
    motif: 'spiral',
  },
  {
    id: 'entebbe_basalt',
    name: 'Entebbe Basalt',
    description: 'Dark volcanic slab rimmed with marigold chalk.',
    price: 90,
    coreColor: '#4B5563',
    midColor: '#27272A',
    edgeColor: '#09090B',
    motifColor: '#F59E0B',
    dustColor: '#FBBF24',
    motif: 'ember',
  },
  {
    id: 'cowrie_inlaid',
    name: 'Cowrie-Inlaid Stone',
    description: 'Polished amber earth stone set with a white shell ring.',
    price: 150,
    coreColor: '#F59E0B',
    midColor: '#92400E',
    edgeColor: '#451A03',
    motifColor: '#FAF3E8',
    dustColor: '#FEF08A',
    motif: 'cowrie',
  },
  {
    id: 'royal_sunstone',
    name: 'Royal Sunstone',
    description: 'Gleaming gold-ochre stone engraved with radiant rays.',
    price: 260,
    coreColor: '#FEF08A',
    midColor: '#D97706',
    edgeColor: '#78350F',
    motifColor: '#FFFFFF',
    dustColor: '#FDE047',
    motif: 'sunburst',
  },
];

export const OUTFIT_CATALOG: OutfitCatalogItem[] = [
  {
    id: 'banana_emerald',
    name: 'Banana-Leaf Kitenge',
    description: 'Lush Ugandan emerald tunic with marigold sash.',
    price: 0,
    primaryColor: '#15803D',
    accentColor: '#FBBF24',
  },
  {
    id: 'kampala_sunset',
    name: 'Kampala Sunset',
    description: 'Burnt terracotta-orange wrap trimmed in sunlit lemon.',
    price: 60,
    primaryColor: '#EA580C',
    accentColor: '#FEF08A',
  },
  {
    id: 'lake_victoria',
    name: 'Lake Victoria Indigo',
    description: 'Deep Nile blue tunic accented with bright gold weave.',
    price: 100,
    primaryColor: '#1D4ED8',
    accentColor: '#FDE047',
  },
  {
    id: 'barkcloth_royal',
    name: 'Buganda Barkcloth',
    description: 'Traditional warm olubugo earth brown with ceremonial trim.',
    price: 180,
    primaryColor: '#7C2D12',
    accentColor: '#FBBF24',
  },
  {
    id: 'crested_plumage',
    name: 'Crested Crane Regalia',
    description: 'Obsidian courtyard tunic with crane crimson and gold.',
    price: 280,
    primaryColor: '#18181B',
    accentColor: '#EF4444',
  },
];

export const STENCIL_CATALOG: StencilCatalogItem[] = [
  {
    id: 'basket_weave',
    name: 'Basket Weave',
    description: 'Classic diagonal reed-basket chalk crosshatch.',
    price: 0,
  },
  {
    id: 'sunburst',
    name: 'Kampala Sunburst',
    description: 'Radiating midday rays etched inside every claimed square.',
    price: 55,
  },
  {
    id: 'royal_drums',
    name: 'Ngoma Drum Rings',
    description: 'Concentric royal drum circles and diamond corner notches.',
    price: 110,
  },
  {
    id: 'crested_crown',
    name: 'Crested Crown',
    description: 'Ceremonial chevron and three-feather crown chalk emblem.',
    price: 200,
  },
];

export interface AvatarCustomization {
  hairStyle: HairStyle;
  primaryColor: string;
  accentColor: string;
}

export interface MonetizationLocalState {
  claimedDoubleMatchIds: string[];
  bonusChestClaimedDates: string[];
  missionRerollDates: string[];
  matchesCompletedSinceInterstitial: number;
  lastInterstitialAt: number;
}

export interface ProgressionData {
  cowries: number;
  unlockedStones: StoneId[];
  unlockedOutfits: OutfitId[];
  unlockedStencils: StencilId[];
  equippedStone: StoneId;
  equippedOutfit: OutfitId;
  equippedStencil: StencilId;
  avatar: AvatarCustomization;
  tourWins: Record<CourtVenueId, number>;
  unlockedAchievements: Record<string, string>;
  dailyStreak: DailyStreakState;
  dailyMission: DailyMissionState;
  monetization: MonetizationLocalState;
  stats: {
    matchesPlayed: number;
    matchesWon: number;
    totalBullseyes: number;
    totalHouses: number;
    bestScore: number;
    bestStreak: number;
    cleanMatchesWon: number;
    hardWins: number;
    onlineWins: number;
  };
}

const STORAGE_KEY = 'sonko_uganda_progression_v1';

const VALID_HAIR_STYLES: HairStyle[] = ['braids', 'afro', 'bun', 'fade'];
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const DEFAULT_TOUR_WINS: Record<CourtVenueId, number> = {
  kampala_murram: 0,
  entebbe_sand: 0,
  jinja_rain: 0,
  ndere_night: 0,
};

const DEFAULT_AVATAR: AvatarCustomization = {
  hairStyle: 'braids',
  primaryColor: OUTFIT_CATALOG[0].primaryColor,
  accentColor: OUTFIT_CATALOG[0].accentColor,
};

const DEFAULT_MONETIZATION: MonetizationLocalState = {
  claimedDoubleMatchIds: [],
  bonusChestClaimedDates: [],
  missionRerollDates: [],
  matchesCompletedSinceInterstitial: 0,
  lastInterstitialAt: 0,
};

function sanitizeMonetizationState(raw: unknown): MonetizationLocalState {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_MONETIZATION,
      claimedDoubleMatchIds: [],
      bonusChestClaimedDates: [],
      missionRerollDates: [],
    };
  }
  const obj = raw as Partial<MonetizationLocalState>;
  const safeStrings = (list: unknown, maxLen: number) =>
    Array.isArray(list)
      ? Array.from(
          new Set(
            list.filter(
              (item): item is string => typeof item === 'string' && item.trim().length > 0 && item.length <= 64
            )
          )
        ).slice(-maxLen)
      : [];

  return {
    claimedDoubleMatchIds: safeStrings(obj.claimedDoubleMatchIds, 80),
    bonusChestClaimedDates: safeStrings(obj.bonusChestClaimedDates, 30),
    missionRerollDates: safeStrings(obj.missionRerollDates, 30),
    matchesCompletedSinceInterstitial:
      typeof obj.matchesCompletedSinceInterstitial === 'number' &&
      Number.isFinite(obj.matchesCompletedSinceInterstitial)
        ? Math.max(0, Math.floor(obj.matchesCompletedSinceInterstitial))
        : 0,
    lastInterstitialAt:
      typeof obj.lastInterstitialAt === 'number' && Number.isFinite(obj.lastInterstitialAt)
        ? Math.max(0, Math.floor(obj.lastInterstitialAt))
        : 0,
  };
}

const DEFAULT_PROGRESSION: ProgressionData = {
  cowries: 30,
  unlockedStones: ['river_pebble'],
  unlockedOutfits: ['banana_emerald'],
  unlockedStencils: ['basket_weave'],
  equippedStone: 'river_pebble',
  equippedOutfit: 'banana_emerald',
  equippedStencil: 'basket_weave',
  avatar: { ...DEFAULT_AVATAR },
  tourWins: { ...DEFAULT_TOUR_WINS },
  unlockedAchievements: {},
  dailyStreak: { ...DEFAULT_DAILY_STREAK },
  dailyMission: createDefaultDailyMission(),
  monetization: {
    ...DEFAULT_MONETIZATION,
    claimedDoubleMatchIds: [],
    bonusChestClaimedDates: [],
    missionRerollDates: [],
  },
  stats: {
    matchesPlayed: 0,
    matchesWon: 0,
    totalBullseyes: 0,
    totalHouses: 0,
    bestScore: 0,
    bestStreak: 0,
    cleanMatchesWon: 0,
    hardWins: 0,
    onlineWins: 0,
  },
};

function createDefaultProgressionData(): ProgressionData {
  return {
    ...DEFAULT_PROGRESSION,
    unlockedStones: [...DEFAULT_PROGRESSION.unlockedStones],
    unlockedOutfits: [...DEFAULT_PROGRESSION.unlockedOutfits],
    unlockedStencils: [...DEFAULT_PROGRESSION.unlockedStencils],
    avatar: { ...DEFAULT_AVATAR },
    tourWins: { ...DEFAULT_TOUR_WINS },
    unlockedAchievements: {},
    dailyStreak: { ...DEFAULT_DAILY_STREAK },
    dailyMission: createDefaultDailyMission(),
    monetization: sanitizeMonetizationState(null),
    stats: { ...DEFAULT_PROGRESSION.stats },
  };
}

export function loadProgression(): ProgressionData {
  if (typeof window === 'undefined') {
    return createDefaultProgressionData();
  }
  const localLoadout = loadLocalAvatarLoadout();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaults = createDefaultProgressionData();
      return localLoadout ? applyLoadoutToProgression(defaults, localLoadout) : defaults;
    }
    const parsed = JSON.parse(raw) as Partial<ProgressionData>;
    const equippedOutfit = parsed.equippedOutfit ?? DEFAULT_PROGRESSION.equippedOutfit;
    const outfitFallback = getOutfitSpec(equippedOutfit);
    const rawAvatar = parsed.avatar;
    const hairStyle: HairStyle =
      rawAvatar && VALID_HAIR_STYLES.includes(rawAvatar.hairStyle)
        ? rawAvatar.hairStyle
        : DEFAULT_AVATAR.hairStyle;
    const primaryColor =
      rawAvatar && typeof rawAvatar.primaryColor === 'string' && HEX_COLOR_RE.test(rawAvatar.primaryColor)
        ? rawAvatar.primaryColor
        : outfitFallback.primaryColor;
    const accentColor =
      rawAvatar && typeof rawAvatar.accentColor === 'string' && HEX_COLOR_RE.test(rawAvatar.accentColor)
        ? rawAvatar.accentColor
        : outfitFallback.accentColor;

    const unlockedAchievements: Record<string, string> = {};
    if (parsed.unlockedAchievements && typeof parsed.unlockedAchievements === 'object') {
      for (const [k, v] of Object.entries(parsed.unlockedAchievements)) {
        if (typeof v === 'string') unlockedAchievements[k] = v;
      }
    }

    const baseProg: ProgressionData = {
      cowries: typeof parsed.cowries === 'number' ? Math.max(0, parsed.cowries) : DEFAULT_PROGRESSION.cowries,
      unlockedStones: Array.isArray(parsed.unlockedStones) && parsed.unlockedStones.length > 0
        ? parsed.unlockedStones
        : DEFAULT_PROGRESSION.unlockedStones,
      unlockedOutfits: Array.isArray(parsed.unlockedOutfits) && parsed.unlockedOutfits.length > 0
        ? parsed.unlockedOutfits
        : DEFAULT_PROGRESSION.unlockedOutfits,
      unlockedStencils: Array.isArray(parsed.unlockedStencils) && parsed.unlockedStencils.length > 0
        ? parsed.unlockedStencils
        : DEFAULT_PROGRESSION.unlockedStencils,
      equippedStone: parsed.equippedStone ?? DEFAULT_PROGRESSION.equippedStone,
      equippedOutfit,
      equippedStencil: parsed.equippedStencil ?? DEFAULT_PROGRESSION.equippedStencil,
      avatar: {
        hairStyle,
        primaryColor,
        accentColor,
      },
      tourWins: {
        kampala_murram: parsed.tourWins?.kampala_murram ?? 0,
        entebbe_sand: parsed.tourWins?.entebbe_sand ?? 0,
        jinja_rain: parsed.tourWins?.jinja_rain ?? 0,
        ndere_night: parsed.tourWins?.ndere_night ?? 0,
      },
      unlockedAchievements,
      dailyStreak: sanitizeDailyStreak(parsed.dailyStreak),
      dailyMission: sanitizeDailyMission(parsed.dailyMission),
      monetization: sanitizeMonetizationState(parsed.monetization),
      stats: {
        matchesPlayed: parsed.stats?.matchesPlayed ?? 0,
        matchesWon: parsed.stats?.matchesWon ?? 0,
        totalBullseyes: parsed.stats?.totalBullseyes ?? 0,
        totalHouses: parsed.stats?.totalHouses ?? 0,
        bestScore: parsed.stats?.bestScore ?? 0,
        bestStreak: parsed.stats?.bestStreak ?? 0,
        cleanMatchesWon: parsed.stats?.cleanMatchesWon ?? 0,
        hardWins: parsed.stats?.hardWins ?? 0,
        onlineWins: parsed.stats?.onlineWins ?? 0,
      },
    };

    const progLoadout = extractAvatarLoadout(baseProg, localLoadout?.updatedAt);
    const reconciledLoadout = localLoadout
      ? mergeAvatarLoadouts(progLoadout, localLoadout)
      : sanitizeAvatarLoadout(progLoadout);

    return applyLoadoutToProgression(baseProg, reconciledLoadout);
  } catch {
    const defaults = createDefaultProgressionData();
    return localLoadout ? applyLoadoutToProgression(defaults, localLoadout) : defaults;
  }
}

export function saveProgression(data: ProgressionData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota errors gracefully
  }
  saveLocalAvatarLoadout(extractAvatarLoadout(data));
}

export function getStoneSpec(id: StoneId): StoneCatalogItem {
  return STONE_CATALOG.find((s) => s.id === id) ?? STONE_CATALOG[0];
}

export function getOutfitSpec(id: OutfitId): OutfitCatalogItem {
  return OUTFIT_CATALOG.find((o) => o.id === id) ?? OUTFIT_CATALOG[0];
}

export function computeMatchRewards(
  humanPlayer: PlayerState,
  won: boolean,
  mode: PlayMode,
  difficulty: Difficulty,
  venue: CourtVenueId
): MatchRewardSummary {
  const diffMult =
    mode === 'VS_BOT' || mode === 'TEAM_2V2'
      ? difficulty === 'HARD'
        ? 1.5
        : difficulty === 'NORMAL'
          ? 1.25
          : 1
      : 1;
  const venueSpec = getVenueSpec(venue);
  const mult = diffMult * venueSpec.cowrieMultiplier;
  const cleanTossCowries = Math.round(humanPlayer.roundsCleared * 4 * mult);
  const bullseyeCowries = Math.round(humanPlayer.perfectTosses * 10 * mult);
  const roundsCowries = Math.round((humanPlayer.roundsCleared * 12 + humanPlayer.bestStreak * 4) * mult);
  const housesCowries = Math.round(humanPlayer.housesOwned.length * 25 * mult);
  const winBonusCowries = won ? Math.round(55 * mult) : 10;

  const totalEarned =
    cleanTossCowries + bullseyeCowries + roundsCowries + housesCowries + winBonusCowries;

  return {
    cleanTossCowries,
    bullseyeCowries,
    roundsCowries,
    housesCowries,
    winBonusCowries,
    venueMultiplier: venueSpec.cowrieMultiplier,
    totalEarned,
  };
}
