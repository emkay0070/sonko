export type GameScreen = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'ROUND_SUMMARY' | 'GAME_OVER';

export type PlayMode = 'SOLO' | 'VS_BOT' | 'TWO_PLAYER' | 'TEAM_2V2' | 'ONLINE_1V1';

export type Difficulty = 'EASY' | 'NORMAL' | 'HARD';

export type CourtSize = 5 | 10;

export type CourtVenueId =
  | 'kampala_murram'
  | 'entebbe_sand'
  | 'jinja_rain'
  | 'ndere_night';

export type StoneId =
  | 'river_pebble'
  | 'kisii_soapstone'
  | 'entebbe_basalt'
  | 'cowrie_inlaid'
  | 'royal_sunstone';

export type OutfitId =
  | 'banana_emerald'
  | 'kampala_sunset'
  | 'lake_victoria'
  | 'barkcloth_royal'
  | 'crested_plumage';

export type StencilId =
  | 'basket_weave'
  | 'sunburst'
  | 'royal_drums'
  | 'crested_crown';

export type TurnPhase =
  | 'TOSS_AIM'
  | 'STONE_FLIGHT'
  | 'HOP_OUT'
  | 'TURN_HOME'
  | 'HOP_BACK'
  | 'PICKUP_STONE'
  | 'HOP_EXIT'
  | 'CLAIM_AIM'
  | 'CLAIM_FLIGHT'
  | 'FOUL_RECOVERY'
  | 'ROUND_CLEAR'
  | 'PLAYER_SWITCH';

export interface CourtSquare {
  id: number;
  row: number;
  side: 'center' | 'left' | 'right';
  isDouble: boolean;
  isHome: boolean;
  /** Normalized court coordinates (0..1) */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HopStep {
  row: number;
  squares: number[];
  stance: 'ONE_FOOT' | 'TWO_FEET' | 'HOUSE_REST';
  leg: 'OUT' | 'BACK';
  triggersPickupAfterLand?: boolean;
}

export type HairStyle = 'braids' | 'afro' | 'bun' | 'fade';

export interface PlayerState {
  id: number;
  teamId: 0 | 1;
  name: string;
  isBot: boolean;
  hairStyle: HairStyle;
  skinTone: string;
  primaryColor: string;
  accentColor: string;
  targetSquare: number;
  cyclesCompleted: number;
  score: number;
  housesOwned: number[];
  streak: number;
  bestStreak: number;
  perfectTosses: number;
  fouls: number;
  roundsCleared: number;
}

export interface MatchRewardSummary {
  cleanTossCowries: number;
  bullseyeCowries: number;
  roundsCowries: number;
  housesCowries: number;
  winBonusCowries: number;
  venueMultiplier: number;
  totalEarned: number;
}

export type SpeechState =
  | 'silent'
  | 'aiming'
  | 'throwing'
  | 'cheering'
  | 'laughing'
  | 'annoyed'
  | 'wobbling'
  | 'banter'
  | 'celebrating';

export type WeatherCondition =
  | 'clear'
  | 'breezy'
  | 'misty_dew'
  | 'light_rain'
  | 'storm_shower';

export type WeatherMode = 'auto' | 'random' | WeatherCondition;

export interface HudSnapshot {
  screen: GameScreen;
  mode: PlayMode;
  difficulty: Difficulty;
  courtSize: CourtSize;
  venue: CourtVenueId;
  weatherCondition: WeatherCondition;
  weatherMode: WeatherMode;
  weatherLabel: string;
  windX: number;
  puddleSquares: number[];
  activePlayerIndex: number;
  players: PlayerState[];
  teamScores: [number, number];
  teamTargets: [number, number];
  phase: TurnPhase;
  balance: number; // 0..100
  aimPower: number; // 0..1
  isCharging: boolean;
  statusBanner: string;
  foulReason: string | null;
  winnerTeamId: 0 | 1 | null;
  winnerLabel: string | null;
  winReason: string | null;
  houses: Record<number, 0 | 1>;
  turnCount: number;
  lastMatchReward: MatchRewardSummary | null;
  speechStates?: Record<string, SpeechState>;
  onlineRoomCode?: string | null;
  onlineLocalSlot?: 0 | 1 | null;
  onlineOpponentConnected?: boolean;
  onlineRematchVotes?: [boolean, boolean];
}

export type AdPlacement =
  | 'double_match'
  | 'mission_reroll'
  | 'bonus_chest'
  | 'interstitial';

export type AdFormat = 'rewarded' | 'interstitial';

export type AdProviderId = 'google_h5' | 'dev_simulator';

export type AdShowStatus = 'completed' | 'dismissed' | 'no_fill' | 'unavailable';

export interface AdShowOutcome {
  status: AdShowStatus;
  provider: AdProviderId;
  detail?: string;
}

export interface AdDisplayRequest {
  placement: AdPlacement;
  format: AdFormat;
  breakName: string;
  rewardLabel?: string;
  onBeforeAd?: () => void;
  onAfterAd?: () => void;
}

export interface AdProviderAdapter {
  readonly id: AdProviderId;
  readonly label: string;
  init(): Promise<boolean>;
  isReady(): boolean;
  showRewarded(request: AdDisplayRequest): Promise<AdShowOutcome>;
  showInterstitial(request: AdDisplayRequest): Promise<AdShowOutcome>;
}

export interface AdSimulatorSession {
  id: string;
  placement: AdPlacement;
  format: AdFormat;
  title: string;
  subtitle: string;
  rewardLabel?: string;
  durationSec: number;
  startedAt: number;
  complete: () => void;
  dismiss: () => void;
}

export interface MonetizationStatus {
  dateKey: string;
  bonusChestClaimedToday: boolean;
  missionRerollUsedToday: boolean;
  claimedMatchIds: string[];
  doubleClaimsToday: number;
  maxDoubleClaimsPerDay: number;
}

