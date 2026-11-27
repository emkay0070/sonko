import { sonkoAudio } from '../game/audio';
import { sonkoVoice } from '../game/voiceEngine';
import {
  buildCourtSquares,
  buildHopSequence,
  evaluateClaimLanding,
  evaluateStoneLanding,
  getSquareCenter,
} from '../game/courtLayout';
import { OnlinePlayerCosmetics, OnlineRoomState, sonkoOnline } from '../game/onlineClient';
import {
  AvatarCustomization,
  computeMatchRewards,
  getOutfitSpec,
  getStoneSpec,
  WorldPlaceId,
} from '../game/progression';
import { PeriodPreset } from '../game/settings';
import {
  CourtSize,
  CourtSquare,
  CourtVenueId,
  Difficulty,
  GameScreen,
  HopStep,
  HudSnapshot,
  MatchRewardSummary,
  OutfitId,
  PlayerState,
  PlayMode,
  SpeechState,
  StencilId,
  StoneId,
  TurnPhase,
  WeatherCondition,
  WeatherMode,
} from '../game/types';
import {
  pickWeatherPuddleSquares,
  resolveWeatherFromPeriodAndVenue,
  rollRandomMatchWeather,
  WEATHER_SPECS,
} from '../game/weather';
import { CHARACTER_SLOTS, ChildStyle } from './characters';
import { CharacterEmotion } from './glbAppearance';
import { CharacterPoseCommand } from './glbCharacterController';
import { courtNormalizedToWorld, CourtRenderSyncState, SonkoCourt3D } from './sonkoCourt3D';

export interface EngineCameraFocusState {
  screen: GameScreen;
  phase: TurnPhase;
  isCharging: boolean;
  aimPower: number;
  aimAngleOffset: number;
  isClaimAim: boolean;
  turnCount: number;
  playerWorldX: number;
  playerWorldZ: number;
  playerFacingYaw: number;
  stoneInWorld: boolean;
  stoneWorldX: number;
  stoneWorldY: number;
  stoneWorldZ: number;
  stoneBounces: number;
  targetSquareWorldX: number;
  targetSquareWorldZ: number;
  predictedWorldX: number;
  predictedWorldZ: number;
  throwFollowTimer: number;
  foulFlashTimer: number;
  cheerTimer: number;
}

export interface EngineCosmetics {
  equippedStone: StoneId;
  equippedOutfit: OutfitId;
  equippedStencil: StencilId;
  avatar: AvatarCustomization;
  previewVenue: CourtVenueId;
  previewCourtSize: CourtSize;
  previewPlace?: WorldPlaceId;
  previewPeriod?: PeriodPreset;
  weatherMode?: WeatherMode;
}

export interface Callout3D {
  id: number;
  text: string;
  worldX: number;
  worldY: number;
  worldZ: number;
  life: number;
  maxLife: number;
  color: string;
}

const SLOT_ORDER: ChildStyle[] = ['kato', 'namukasa', 'ssemakula', 'auma'];

function createInitialPlayers(
  mode: PlayMode,
  outfitId: OutfitId,
  avatar: AvatarCustomization
): PlayerState[] {
  const outfit = getOutfitSpec(outfitId);
  const p0Primary = avatar.primaryColor || outfit.primaryColor;
  const p0Accent = avatar.accentColor || outfit.accentColor;
  const p0Hair = avatar.hairStyle || 'braids';

  const makePlayer = (
    id: number,
    teamId: 0 | 1,
    name: string,
    isBot: boolean,
    hairStyle: PlayerState['hairStyle'],
    skinTone: string,
    primaryColor: string,
    accentColor: string
  ): PlayerState => ({
    id,
    teamId,
    name,
    isBot,
    hairStyle,
    skinTone,
    primaryColor,
    accentColor,
    targetSquare: 1,
    cyclesCompleted: 0,
    score: 0,
    housesOwned: [],
    streak: 0,
    bestStreak: 0,
    perfectTosses: 0,
    fouls: 0,
    roundsCleared: 0,
  });

  if (mode === 'SOLO') {
    return [makePlayer(0, 0, 'You', false, p0Hair, '#6B3A24', p0Primary, p0Accent)];
  }

  if (mode === 'TEAM_2V2') {
    return [
      makePlayer(0, 0, 'You (Cranes)', false, p0Hair, '#6B3A24', p0Primary, p0Accent),
      makePlayer(1, 1, 'Amina (Waves)', true, 'bun', '#7A4329', '#B91C1C', '#FDE047'),
      makePlayer(2, 0, 'Kato (Cranes)', true, 'fade', '#562C19', p0Primary, p0Accent),
      makePlayer(3, 1, 'Mugisha (Waves)', true, 'afro', '#6D3B22', '#B91C1C', '#FDE047'),
    ];
  }

  return [
    makePlayer(0, 0, 'Player 1', false, p0Hair, '#6B3A24', p0Primary, p0Accent),
    makePlayer(
      1,
      1,
      mode === 'VS_BOT' ? 'Amina (Bot)' : 'Player 2',
      mode === 'VS_BOT',
      'bun',
      '#7A4329',
      '#B91C1C',
      '#FDE047'
    ),
  ];
}

export class Sonko3DGameEngine {
  private screen: GameScreen = 'TITLE_MENU';
  private mode: PlayMode = 'VS_BOT';
  private difficulty: Difficulty = 'NORMAL';
  private courtSize: CourtSize = 10;
  private venue: CourtVenueId = 'kampala_murram';
  private periodPreset: PeriodPreset = 'auto';
  private weatherMode: WeatherMode = 'auto';
  private weatherCondition: WeatherCondition = 'clear';
  private windX = 0;
  private puddleSquares: number[] = [];
  private squares: CourtSquare[] = buildCourtSquares(10);
  private houses: Record<number, 0 | 1> = {};
  private activePlayerIndex = 0;
  private players: PlayerState[];
  private teamTargets: [number, number] = [1, 1];
  private teamScores: [number, number] = [0, 0];
  private phase: TurnPhase = 'TOSS_AIM';
  private turnCount = 1;
  private winnerTeamId: 0 | 1 | null = null;
  private winnerLabel: string | null = null;
  private winReason: string | null = null;
  private foulReason: string | null = null;
  private statusBanner = 'Hold Click or Space — Release inside Square 1';
  private lastMatchReward: MatchRewardSummary | null = null;
  private cheerTimer = 0;
  private victoryElapsed = 0;

  // Online 1v1 sync state
  private onlineRoomCode: string | null = null;
  private onlineLocalSlot: 0 | 1 | null = null;
  private onlineOpponentConnected = true;
  private onlineRematchVotes: [boolean, boolean] = [false, false];
  private onlineCosmetics: [OnlinePlayerCosmetics, OnlinePlayerCosmetics] | null = null;
  private awaitingTossAck = false;

  // Stone kinematics (normalized court space + vertical Z)
  private stoneX = 0.5;
  private stoneY = 0.945;
  private stoneZ = 0;
  private stoneVx = 0;
  private stoneVy = 0;
  private stoneVz = 0;
  private stoneRot = 0;
  private stoneInHand = true;
  private stonePlacedSquareId: number | null = null;
  private stoneBounces = 0;

  // Active player kinematics
  private playerX = 0.5;
  private playerY = 0.945;
  private playerZ = 0;
  private playerFacingYaw = Math.PI;
  private playerStance: 'TWO_FEET' | 'LEFT_FOOT' | 'RIGHT_FOOT' | 'BENDING' = 'TWO_FEET';
  private throwFollowTimer = 0;

  // Hop tween state
  private hopAnimating = false;
  private hopFromX = 0.5;
  private hopFromY = 0.945;
  private hopToX = 0.5;
  private hopToY = 0.945;
  private hopProgress = 0;
  private hopDuration = 0.21;
  private outSteps: HopStep[] = [];
  private backSteps: HopStep[] = [];
  private stepCursor = 0;
  private stepCountTotal = 0;
  private turnTimer = 0;
  private phaseTimer = 0;

  // Single-foot balance
  private balance = 100;
  private balanceSway = 0;
  private balanceDriftDir = 1;

  // Aiming & Charge
  private aimAngleOffset = 0;
  private aimPower = 0.14;
  private aimChargeDir: 1 | -1 = 1;
  private isCharging = false;
  private chargeStartTime = 0;

  // Juice & Effects
  private time = 0;
  private hitstopTimer = 0;
  private shakeMag = 0;
  private foulFlashTimer = 0;
  private foulSquareId: number | null = null;
  private callouts: Callout3D[] = [];
  private nextCalloutId = 1;

  // Bot AI
  private botTimer = 0;
  private botTargetPower = 0.25;
  private botTargetAngle = 0;
  private botSubPhase: 'AIM' | 'CHARGE' | 'WAIT' = 'AIM';

  // Held keys
  private heldKeys = new Set<string>();
  private lastHudPushTime = 0;
  private unsubOnline: (() => void) | null = null;
  private cosmetics: EngineCosmetics;

  // Per-character personality & emotion timers
  private slotEmotions = new Map<
    ChildStyle,
    { emotion: CharacterEmotion; expiresAt: number; emoteMode?: 'EMOTE_LAUGH' | 'EMOTE_ANNOYED' | 'SIDELINE_CHEER' }
  >();
  private lastWobbleCallAt = -10;

  constructor(
    initialCosmetics: EngineCosmetics,
    private court3D: SonkoCourt3D,
    private onHudChange?: (snapshot: HudSnapshot) => void,
    private onMatchComplete?: (
      reward: MatchRewardSummary,
      won: boolean,
      humanStats: PlayerState,
      venue: CourtVenueId,
      meta?: { mode: PlayMode; difficulty: Difficulty }
    ) => void
  ) {
    this.cosmetics = initialCosmetics;
    this.venue = initialCosmetics.previewVenue;
    this.courtSize = initialCosmetics.previewCourtSize;
    this.squares = buildCourtSquares(this.courtSize);
    this.periodPreset = initialCosmetics.previewPeriod ?? 'auto';
    this.weatherMode = initialCosmetics.weatherMode ?? 'auto';
    this.applyPreviewWeatherState(this.weatherMode === 'random');
    this.players = createInitialPlayers('VS_BOT', initialCosmetics.equippedOutfit, initialCosmetics.avatar);
    this.subscribeOnlineEvents();
    this.pushHud(true);
  }

  public setCallbacks(
    onHudChange?: (snapshot: HudSnapshot) => void,
    onMatchComplete?: (
      reward: MatchRewardSummary,
      won: boolean,
      humanStats: PlayerState,
      venue: CourtVenueId,
      meta?: { mode: PlayMode; difficulty: Difficulty }
    ) => void
  ) {
    this.onHudChange = onHudChange;
    this.onMatchComplete = onMatchComplete;
    this.pushHud(true);
  }

  private resolveWeatherCondition(
    venue: CourtVenueId,
    period: PeriodPreset,
    mode: WeatherMode,
    rerollRandom: boolean
  ): WeatherCondition {
    if (mode === 'random') {
      return rerollRandom
        ? rollRandomMatchWeather(period, venue)
        : this.weatherCondition || rollRandomMatchWeather(period, venue);
    }
    if (mode === 'auto') {
      return resolveWeatherFromPeriodAndVenue(period, venue);
    }
    return mode;
  }

  private applyPreviewWeatherState(rerollRandom = false) {
    const venue = this.getActiveVenue();
    this.weatherCondition = this.resolveWeatherCondition(
      venue,
      this.periodPreset,
      this.weatherMode,
      rerollRandom
    );
    const spec = WEATHER_SPECS[this.weatherCondition];
    this.puddleSquares = pickWeatherPuddleSquares(
      this.courtSize,
      spec.puddleCount,
      rerollRandom ? undefined : 1
    );
    this.windX =
      venue === 'entebbe_sand'
        ? 0.045 * Math.max(0.4, spec.windStrength)
        : spec.windStrength >= 0.35
          ? spec.windStrength * 0.055
          : 0;
  }

  public setWeatherConfig(
    period: PeriodPreset,
    weatherMode: WeatherMode,
    rerollRandom = false
  ) {
    const changed = this.periodPreset !== period || this.weatherMode !== weatherMode;
    this.periodPreset = period;
    this.weatherMode = weatherMode;
    if (this.screen === 'TITLE_MENU') {
      this.applyPreviewWeatherState(rerollRandom || (changed && weatherMode === 'random'));
      this.pushHud(true);
    } else if (this.mode !== 'ONLINE_1V1') {
      const nextCond =
        weatherMode === 'random'
          ? rerollRandom
            ? rollRandomMatchWeather(period, this.venue)
            : this.weatherCondition
          : weatherMode === 'auto'
            ? resolveWeatherFromPeriodAndVenue(period, this.venue)
            : weatherMode;
      this.weatherCondition = nextCond;
      const spec = WEATHER_SPECS[nextCond];
      this.puddleSquares = pickWeatherPuddleSquares(this.courtSize, spec.puddleCount);
      this.pushHud(true);
    }
  }

  public getWeatherCondition(): WeatherCondition {
    return this.weatherCondition;
  }

  public getWeatherMode(): WeatherMode {
    return this.weatherMode;
  }

  public updateCosmetics(next: EngineCosmetics) {
    const prevVenue = this.cosmetics.previewVenue;
    const prevCourt = this.cosmetics.previewCourtSize;
    const prevPeriod = this.periodPreset;
    const prevWeatherMode = this.weatherMode;
    this.cosmetics = next;
    if (next.previewPeriod) {
      this.periodPreset = next.previewPeriod;
    }
    if (next.weatherMode) {
      this.weatherMode = next.weatherMode;
    }

    if (this.screen === 'TITLE_MENU') {
      const layoutOrVenueChanged =
        next.previewCourtSize !== prevCourt ||
        next.previewVenue !== prevVenue ||
        this.periodPreset !== prevPeriod ||
        this.weatherMode !== prevWeatherMode;

      if (next.previewCourtSize !== prevCourt) {
        this.courtSize = next.previewCourtSize;
        this.squares = buildCourtSquares(this.courtSize);
      }
      if (next.previewVenue !== prevVenue) {
        this.venue = next.previewVenue;
      }
      if (layoutOrVenueChanged) {
        this.applyPreviewWeatherState(
          this.weatherMode === 'random' && this.weatherMode !== prevWeatherMode
        );
        this.pushHud(true);
      }
      if (this.players[0] && this.mode !== 'ONLINE_1V1') {
        const outfit = getOutfitSpec(next.equippedOutfit);
        this.players[0].primaryColor = next.avatar.primaryColor || outfit.primaryColor;
        this.players[0].accentColor = next.avatar.accentColor || outfit.accentColor;
        this.players[0].hairStyle = next.avatar.hairStyle;
      }
    }
  }

  public getScreen(): GameScreen {
    return this.screen;
  }

  public getPhase(): TurnPhase {
    return this.phase;
  }

  public getActiveVenue(): CourtVenueId {
    return this.screen === 'TITLE_MENU' ? this.cosmetics.previewVenue : this.venue;
  }

  public getWindX(): number {
    return this.windX;
  }

  public getShakeMag(): number {
    return this.shakeMag;
  }

  public getActiveWorldPosition(): { x: number; z: number } {
    return courtNormalizedToWorld(this.playerX, this.playerY);
  }

  public getCameraFocusState(): EngineCameraFocusState {
    const playerW = courtNormalizedToWorld(this.playerX, this.playerY);
    const stoneW = courtNormalizedToWorld(this.stoneX, this.stoneY);
    const curPlayer = this.players[this.activePlayerIndex] ?? this.players[0];
    const targetSq = this.squares.find((sq) => sq.id === curPlayer.targetSquare);
    const targetNorm = targetSq ? getSquareCenter(targetSq) : { x: 0.5, y: 0.5 };
    const targetW = courtNormalizedToWorld(targetNorm.x, targetNorm.y);
    const predNorm = this.computePredictedLanding();
    const predW = courtNormalizedToWorld(predNorm.x, predNorm.y);

    return {
      screen: this.screen,
      phase: this.phase,
      isCharging: this.isCharging,
      aimPower: this.aimPower,
      aimAngleOffset: this.aimAngleOffset,
      isClaimAim: this.phase === 'CLAIM_AIM',
      turnCount: this.turnCount,
      playerWorldX: playerW.x,
      playerWorldZ: playerW.z,
      playerFacingYaw: this.playerFacingYaw,
      stoneInWorld: this.screen === 'PLAYING' && !this.stoneInHand,
      stoneWorldX: stoneW.x,
      stoneWorldY: this.stoneZ * 2.15,
      stoneWorldZ: stoneW.z,
      stoneBounces: this.stoneBounces,
      targetSquareWorldX: targetW.x,
      targetSquareWorldZ: targetW.z,
      predictedWorldX: predW.x,
      predictedWorldZ: predW.z,
      throwFollowTimer: this.throwFollowTimer,
      foulFlashTimer: this.foulFlashTimer,
      cheerTimer: this.cheerTimer,
    };
  }

  public getActiveCallouts(): readonly Callout3D[] {
    return this.callouts;
  }

  public isLocalInputLocked(): boolean {
    if (this.screen !== 'PLAYING') return true;
    const p = this.players[this.activePlayerIndex];
    if (!p || p.isBot) return true;
    if (this.mode === 'ONLINE_1V1' && this.activePlayerIndex !== this.onlineLocalSlot) return true;
    return false;
  }

  public startGame(
    mode: PlayMode,
    difficulty: Difficulty,
    courtSize: CourtSize,
    venue: CourtVenueId = 'kampala_murram',
    options?: { period?: PeriodPreset; weatherMode?: WeatherMode }
  ) {
    if (this.mode === 'ONLINE_1V1') {
      sonkoOnline.leaveRoom();
    }
    this.mode = mode;
    this.difficulty = difficulty;
    this.courtSize = courtSize;
    this.venue = venue;
    if (options?.period) this.periodPreset = options.period;
    if (options?.weatherMode) this.weatherMode = options.weatherMode;

    this.weatherCondition =
      this.weatherMode === 'random'
        ? rollRandomMatchWeather(this.periodPreset, venue)
        : this.weatherMode === 'auto'
          ? resolveWeatherFromPeriodAndVenue(this.periodPreset, venue)
          : this.weatherMode;

    const weatherSpec = WEATHER_SPECS[this.weatherCondition];
    this.puddleSquares = pickWeatherPuddleSquares(courtSize, weatherSpec.puddleCount);
    this.onlineRoomCode = null;
    this.onlineLocalSlot = null;
    this.onlineOpponentConnected = true;
    this.onlineCosmetics = null;
    this.squares = buildCourtSquares(courtSize);
    this.houses = {};
    this.activePlayerIndex = 0;
    this.players = createInitialPlayers(
      mode,
      this.cosmetics.equippedOutfit,
      this.cosmetics.avatar
    );
    this.teamTargets = [1, 1];
    this.teamScores = [0, 0];
    this.turnCount = 1;
    this.winnerTeamId = null;
    this.winnerLabel = null;
    this.winReason = null;
    this.foulReason = null;
    this.lastMatchReward = null;
    this.cheerTimer = 0;
    this.foulFlashTimer = 0;
    this.foulSquareId = null;
    this.callouts = [];
    this.slotEmotions.clear();
    this.screen = 'PLAYING';
    this.resetTurnToBaseline('TOSS_AIM');
    const leadSlot = this.getSlotForPlayer(0);
    this.setSlotEmotion(leadSlot, 'happy', 2.4);
    sonkoVoice.speakEvent(leadSlot, 'INTRO', 'happy', { priority: 'high' });
    this.pushHud(true);
  }

  public startOnlineGame(room: OnlineRoomState, localSlot: 0 | 1) {
    this.mode = 'ONLINE_1V1';
    this.difficulty = 'NORMAL';
    this.onlineLocalSlot = localSlot;
    this.squares = buildCourtSquares(room.courtSize);
    this.syncFromOnlineRoom(room);
    this.winnerTeamId = null;
    this.winnerLabel = null;
    this.winReason = null;
    this.foulReason = null;
    this.lastMatchReward = null;
    this.cheerTimer = 0;
    this.victoryElapsed = 0;
    this.foulFlashTimer = 0;
    this.foulSquareId = null;
    this.callouts = [];
    this.screen = 'PLAYING';
    this.resetTurnToBaseline('TOSS_AIM');
    this.pushHud(true);
  }

  public pauseGame() {
    if (this.screen === 'PLAYING') {
      this.screen = 'PAUSED';
      this.heldKeys.clear();
      this.isCharging = false;
      sonkoVoice.stopSpeech();
      this.pushHud(true);
    }
  }

  public resumeGame() {
    if (this.screen === 'PAUSED') {
      this.screen = 'PLAYING';
      this.pushHud(true);
    }
  }

  public restartGame() {
    if (this.mode === 'ONLINE_1V1') {
      sonkoOnline.requestRematch();
      return;
    }
    this.startGame(this.mode, this.difficulty, this.courtSize, this.venue);
  }

  public returnToTitle() {
    if (this.mode === 'ONLINE_1V1') {
      sonkoOnline.leaveRoom();
    }
    this.mode = 'VS_BOT';
    this.onlineRoomCode = null;
    this.onlineLocalSlot = null;
    this.onlineCosmetics = null;
    this.screen = 'TITLE_MENU';
    this.houses = {};
    this.courtSize = this.cosmetics.previewCourtSize;
    this.venue = this.cosmetics.previewVenue;
    this.squares = buildCourtSquares(this.courtSize);
    this.applyPreviewWeatherState(false);
    this.players = createInitialPlayers(
      'VS_BOT',
      this.cosmetics.equippedOutfit,
      this.cosmetics.avatar
    );
    this.activePlayerIndex = 0;
    this.heldKeys.clear();
    this.slotEmotions.clear();
    this.victoryElapsed = 0;
    sonkoVoice.stopSpeech();
    this.resetTurnToBaseline('TOSS_AIM');
    this.pushHud(true);
  }

  public nudgeBalance(dir: -1 | 1) {
    if (this.isLocalInputLocked()) return;
    this.balanceSway = Math.max(-1, Math.min(1, this.balanceSway + dir * 0.24));
  }

  public nudgeAim(dir: -1 | 1) {
    if (this.isLocalInputLocked()) return;
    if (this.phase !== 'TOSS_AIM' && this.phase !== 'CLAIM_AIM') return;
    this.aimAngleOffset = Math.max(-0.4, Math.min(0.4, this.aimAngleOffset + dir * 0.055));
    if (this.mode === 'ONLINE_1V1') {
      sonkoOnline.sendAim(this.aimAngleOffset, this.aimPower, this.isCharging);
    }
    this.pushHud(true);
  }

  public startTossCharge() {
    if (this.isLocalInputLocked()) return;
    if (this.phase !== 'TOSS_AIM' && this.phase !== 'CLAIM_AIM') return;
    this.isCharging = true;
    this.aimPower = 0.08;
    this.aimChargeDir = 1;
    this.chargeStartTime = performance.now();
    this.pushHud(true);
  }

  public releaseTossCharge() {
    if (this.isLocalInputLocked()) return;
    if (this.isCharging && (this.phase === 'TOSS_AIM' || this.phase === 'CLAIM_AIM')) {
      const heldMs = performance.now() - this.chargeStartTime;
      if (heldMs < 110) {
        this.isCharging = false;
        this.aimPower = 0.12;
        this.statusBanner = `Hold Toss button briefly, then release inside Square ${
          this.players[this.activePlayerIndex]?.targetSquare ?? 1
        }!`;
        this.pushHud(true);
        return;
      }
      this.launchStoneThrow(this.phase === 'CLAIM_AIM');
    }
  }

  public triggerAction() {
    if (this.isLocalInputLocked()) return;
    if (
      this.phase === 'HOP_OUT' ||
      this.phase === 'HOP_BACK' ||
      this.phase === 'PICKUP_STONE' ||
      this.phase === 'HOP_EXIT'
    ) {
      this.advanceHopAction();
    }
  }

  public handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (this.screen === 'PLAYING') {
        this.pauseGame();
      } else if (this.screen === 'PAUSED') {
        this.resumeGame();
      }
      return;
    }

    if (this.isLocalInputLocked()) return;
    const code = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      e.preventDefault();
    }

    const wasHeld = this.heldKeys.has(code);
    this.heldKeys.add(code);

    if (!wasHeld) {
      if ((code === 'Space' || code === 'Enter') && (this.phase === 'TOSS_AIM' || this.phase === 'CLAIM_AIM')) {
        this.isCharging = true;
        this.aimPower = 0.08;
        this.aimChargeDir = 1;
        this.chargeStartTime = performance.now();
      } else if ((code === 'Space' || code === 'KeyW' || code === 'ArrowUp') && this.phase === 'HOP_OUT') {
        this.advanceHopAction();
      } else if (
        (code === 'Space' || code === 'KeyS' || code === 'ArrowDown') &&
        (this.phase === 'HOP_BACK' || this.phase === 'HOP_EXIT')
      ) {
        this.advanceHopAction();
      } else if ((code === 'Space' || code === 'KeyE' || code === 'Enter') && this.phase === 'PICKUP_STONE') {
        this.advanceHopAction();
      }
    }
  }

  public handleKeyUp(e: KeyboardEvent) {
    const code = e.code;
    this.heldKeys.delete(code);

    if (this.isLocalInputLocked()) return;

    if ((code === 'Space' || code === 'Enter') && this.isCharging) {
      if (this.phase === 'TOSS_AIM' || this.phase === 'CLAIM_AIM') {
        this.launchStoneThrow(this.phase === 'CLAIM_AIM');
      }
    }
  }

  public handleWindowBlur() {
    this.heldKeys.clear();
    this.isCharging = false;
  }

  public handleCourtPointerMove(nx: number, _ny: number) {
    if (this.isLocalInputLocked()) return;
    if (this.phase === 'TOSS_AIM' || this.phase === 'CLAIM_AIM') {
      const dx = Math.max(-0.42, Math.min(0.42, nx - 0.5));
      this.aimAngleOffset = dx * 0.95;
      if (this.mode === 'ONLINE_1V1') {
        sonkoOnline.sendAim(this.aimAngleOffset, this.aimPower, this.isCharging);
      }
    }
  }

  public handleCourtPointerDown(nx: number, ny: number) {
    if (this.isLocalInputLocked()) return;

    if (this.phase === 'TOSS_AIM' || this.phase === 'CLAIM_AIM') {
      const dx = Math.max(-0.42, Math.min(0.42, nx - 0.5));
      this.aimAngleOffset = dx * 0.95;
      this.isCharging = true;
      this.aimPower = 0.08;
      this.aimChargeDir = 1;
      this.chargeStartTime = performance.now();
      return;
    }

    if (this.phase === 'PICKUP_STONE') {
      this.advanceHopAction();
      return;
    }

    if (this.phase === 'HOP_OUT' || this.phase === 'HOP_BACK' || this.phase === 'HOP_EXIT') {
      const activeTeam = this.players[this.activePlayerIndex].teamId;
      const clickedSq = this.squares.find(
        (sq) => nx >= sq.x && nx <= sq.x + sq.w && ny >= sq.y && ny <= sq.y + sq.h
      );
      if (clickedSq) {
        if (clickedSq.id === this.stonePlacedSquareId) {
          this.triggerFoul('Stepped in stone square!', clickedSq.id);
          return;
        }
        const owner = this.houses[clickedSq.id];
        if (owner !== undefined && owner !== activeTeam) {
          this.triggerFoul("Stepped in rival's House!", clickedSq.id);
          return;
        }
      }

      const targetStep = this.getCurrentNextStep();
      if (targetStep && clickedSq && targetStep.squares.includes(clickedSq.id)) {
        const center = getSquareCenter(clickedSq);
        const offset = (nx - center.x) * 0.6;
        this.balanceSway = Math.max(-0.85, Math.min(0.85, this.balanceSway + offset));
      }
      this.advanceHopAction();
    }
  }

  public handleCourtPointerUp() {
    if (this.isLocalInputLocked()) return;
    if (this.isCharging && (this.phase === 'TOSS_AIM' || this.phase === 'CLAIM_AIM')) {
      const heldMs = performance.now() - this.chargeStartTime;
      if (heldMs < 110) {
        this.isCharging = false;
        this.aimPower = 0.12;
        this.statusBanner = `Hold Click or Space briefly, then release inside Square ${
          this.players[this.activePlayerIndex]?.targetSquare ?? 1
        }!`;
        this.pushHud(true);
        return;
      }
      this.launchStoneThrow(this.phase === 'CLAIM_AIM');
    }
  }

  public update(dt: number) {
    this.time += dt;

    this.shakeMag *= Math.pow(0.0005, dt);
    if (this.shakeMag < 0.05) this.shakeMag = 0;

    if (this.foulFlashTimer > 0) {
      this.foulFlashTimer = Math.max(0, this.foulFlashTimer - dt);
    }
    if (this.cheerTimer > 0) {
      this.cheerTimer = Math.max(0, this.cheerTimer - dt);
    }
    if (this.throwFollowTimer > 0) {
      this.throwFollowTimer = Math.max(0, this.throwFollowTimer - dt);
    }

    for (let i = this.callouts.length - 1; i >= 0; i--) {
      this.callouts[i].life += dt;
      if (this.callouts[i].life >= this.callouts[i].maxLife) {
        this.callouts.splice(i, 1);
      }
    }

    if (this.screen === 'PLAYING') {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      } else {
        this.updatePlayingSimulation(dt);
      }
    } else if (this.screen === 'GAME_OVER') {
      this.victoryElapsed += dt;
    }
  }

  public getCourtSyncState(): CourtRenderSyncState {
    const p1Avatar = this.cosmetics.avatar;
    const curPlayer = this.players[this.activePlayerIndex] ?? this.players[0];

    let activeStoneId: StoneId =
      curPlayer.teamId === 0 ? this.cosmetics.equippedStone : 'river_pebble';
    let team0Color = p1Avatar.primaryColor;
    let team0Accent = p1Avatar.accentColor;
    let team1Color = '#B91C1C';
    let team1Accent = '#FDE047';
    let stencil0: StencilId = this.cosmetics.equippedStencil;
    let stencil1: StencilId = 'basket_weave';

    if (this.mode === 'ONLINE_1V1' && this.onlineCosmetics) {
      const o0 = getOutfitSpec(this.onlineCosmetics[0].outfitId);
      const o1 = getOutfitSpec(this.onlineCosmetics[1].outfitId);
      team0Color = this.onlineCosmetics[0].primaryColor ?? o0.primaryColor;
      team0Accent = this.onlineCosmetics[0].accentColor ?? o0.accentColor;
      team1Color = this.onlineCosmetics[1].primaryColor ?? o1.primaryColor;
      team1Accent = this.onlineCosmetics[1].accentColor ?? o1.accentColor;
      stencil0 = this.onlineCosmetics[0].stencilId;
      stencil1 = this.onlineCosmetics[1].stencilId;
      activeStoneId = this.onlineCosmetics[curPlayer.teamId].stoneId;
    }

    const nextStep = this.getCurrentNextStep();
    const predicted = this.computePredictedLanding();
    const showAimArc =
      this.screen === 'PLAYING' &&
      (this.phase === 'TOSS_AIM' || this.phase === 'CLAIM_AIM') &&
      !curPlayer.isBot &&
      (this.mode !== 'ONLINE_1V1' || this.activePlayerIndex === this.onlineLocalSlot);

    return {
      courtSize: this.courtSize,
      venue: this.getActiveVenue(),
      squares: this.squares,
      houses: this.houses,
      playerColors: [team0Color, team1Color],
      playerAccents: [team0Accent, team1Accent],
      playerStencils: [stencil0, stencil1],
      puddleSquares: this.puddleSquares,
      targetSquareId: this.screen === 'PLAYING' ? curPlayer.targetSquare : 1,
      highlightSquareIds: this.screen === 'PLAYING' && nextStep ? nextStep.squares : [],
      foulSquareId: this.foulSquareId,
      foulFlashTimer: this.foulFlashTimer,
      stoneId: activeStoneId,
      stoneInWorld: this.screen === 'PLAYING' && !this.stoneInHand,
      stoneNx: this.stoneX,
      stoneNy: this.stoneY,
      stoneZLift: this.stoneZ * 2.15,
      stoneRot: this.stoneRot,
      showAimArc,
      aimStartNx: this.playerX,
      aimStartNy: this.playerY,
      aimLandNx: predicted.x,
      aimLandNy: predicted.y,
      windX: this.windX,
      isClaimAim: this.phase === 'CLAIM_AIM',
      weatherCondition: this.weatherCondition,
    };
  }

  public getCharacterPoses(elapsed: number): Partial<Record<ChildStyle, CharacterPoseCommand>> {
    const poses: Partial<Record<ChildStyle, CharacterPoseCommand>> = {};
    const activeWorld = courtNormalizedToWorld(this.playerX, this.playerY);
    const curPlayer = this.players[this.activePlayerIndex] ?? this.players[0];
    const activeSlotId: ChildStyle = this.getSlotForPlayer(this.activePlayerIndex);
    const nowMs = performance.now();

    if (this.screen === 'TITLE_MENU') {
      // Diorama standby around courtyard ready for match
      for (const spec of CHARACTER_SLOTS) {
        const yaw = Math.atan2(spec.lookTarget[0] - spec.x, spec.lookTarget[1] - spec.z);
        const isLead = spec.id === 'kato';
        const emo = this.getSlotEmotion(spec.id);
        const speechIntensity = sonkoVoice.getLipSyncIntensity(spec.id, nowMs);
        const speechState: SpeechState = sonkoVoice.getSpeechState(spec.id, nowMs);
        poses[spec.id] = {
          worldX: spec.x,
          worldZ: spec.z,
          zLift: 0,
          facingYaw: yaw,
          mode: emo.emoteMode ?? 'SIDELINE_IDLE',
          emotion: emo.emotion !== 'neutral' ? emo.emotion : isLead ? 'happy' : 'neutral',
          speechIntensity,
          speechState,
          hopProgress: 0,
          aimPower: 0,
          aimAngleOffset: 0,
          balanceSway: 0,
          actionTimer: elapsed,
          stoneInHand: isLead,
          isClaimPose: false,
        };
      }
      return poses;
    }

    if (this.screen === 'GAME_OVER') {
      const winTeam = this.winnerTeamId ?? 0;
      const curPl = this.players[this.activePlayerIndex];
      const leadWinnerIdx =
        curPl && curPl.teamId === winTeam
          ? this.activePlayerIndex
          : Math.max(0, this.players.findIndex((pl) => pl.teamId === winTeam));
      const leadWinnerSlot = this.getSlotForPlayer(leadWinnerIdx);
      const STAGE_X = 0.48;
      const STAGE_Z = 1.72;
      const SIDELINE_SPOTS: Record<ChildStyle, { x: number; z: number }> = {
        kato: { x: -1.58, z: 2.35 },
        namukasa: { x: 2.08, z: 2.25 },
        ssemakula: { x: -1.68, z: 0.45 },
        auma: { x: 2.15, z: 0.55 },
      };

      for (let i = 0; i < SLOT_ORDER.length; i++) {
        const slotId = SLOT_ORDER[i];
        const speechIntensity = sonkoVoice.getLipSyncIntensity(slotId, nowMs);
        const speechState: SpeechState = sonkoVoice.getSpeechState(slotId, nowMs);

        if (slotId === leadWinnerSlot) {
          poses[slotId] = {
            worldX: STAGE_X,
            worldZ: STAGE_Z,
            zLift: 0,
            facingYaw: 0,
            mode: 'VICTORY_DANCE',
            emotion: 'cheer',
            speechIntensity,
            speechState,
            hopProgress: 0,
            aimPower: 0,
            aimAngleOffset: 0,
            balanceSway: 0,
            actionTimer: this.victoryElapsed,
            stoneInHand: false,
            isClaimPose: false,
          };
          continue;
        }

        const sp = SIDELINE_SPOTS[slotId];
        const playerForSlot = this.players[i];
        const isWinningMate = Boolean(playerForSlot && playerForSlot.teamId === winTeam);
        const lookYaw = Math.atan2(STAGE_X - sp.x, STAGE_Z - sp.z);
        const emo = this.getSlotEmotion(slotId);

        poses[slotId] = {
          worldX: sp.x,
          worldZ: sp.z,
          zLift: 0,
          facingYaw: isWinningMate ? 0 : lookYaw,
          mode: isWinningMate ? 'VICTORY_DANCE' : (emo.emoteMode ?? 'SIDELINE_IDLE'),
          emotion: isWinningMate ? 'cheer' : (emo.emotion !== 'neutral' ? emo.emotion : 'happy'),
          speechIntensity,
          speechState,
          hopProgress: 0,
          aimPower: 0,
          aimAngleOffset: 0,
          balanceSway: 0,
          actionTimer: isWinningMate ? this.victoryElapsed + 0.45 : elapsed,
          stoneInHand: false,
          isClaimPose: false,
        };
      }
      return poses;
    }

    // Active player pose on the court
    const activeEmo = this.getSlotEmotion(activeSlotId);
    let mode: CharacterPoseCommand['mode'] = 'IDLE_AIM';
    if (this.phase === 'PLAYER_SWITCH') {
      mode = this.phaseTimer > 0.16 ? 'WALK_STRIDE' : 'IDLE_AIM';
    } else if (this.phase === 'FOUL_RECOVERY') {
      mode = activeEmo.emoteMode ?? 'EMOTE_ANNOYED';
    } else if (this.throwFollowTimer > 0) {
      mode = 'THROW_FOLLOW';
    } else if (this.phase === 'PICKUP_STONE' || this.playerStance === 'BENDING') {
      mode = 'BEND_PICKUP';
    } else if (this.phase === 'TOSS_AIM' || this.phase === 'CLAIM_AIM') {
      mode = 'IDLE_AIM';
    } else if (this.playerStance === 'LEFT_FOOT') {
      mode = 'HOP_LEFT_FOOT';
    } else if (this.playerStance === 'RIGHT_FOOT') {
      mode = 'HOP_RIGHT_FOOT';
    } else if (this.playerStance === 'TWO_FEET') {
      if (this.phase === 'ROUND_CLEAR') {
        mode = 'SIDELINE_CHEER';
      } else if (this.hopAnimating) {
        mode = 'HOP_TWO_FEET';
      } else if (
        this.phase === 'HOP_OUT' ||
        this.phase === 'HOP_BACK' ||
        this.phase === 'HOP_EXIT' ||
        this.phase === 'TURN_HOME'
      ) {
        mode = 'STAND_TWO_FEET';
      } else {
        mode = 'IDLE_AIM';
      }
    }

    let facingYaw = this.playerFacingYaw;
    if (this.phase === 'TOSS_AIM') {
      facingYaw = Math.PI - this.aimAngleOffset * 0.65;
    } else if (this.phase === 'CLAIM_AIM') {
      facingYaw = 0;
    }

    let derivedActiveEmotion: CharacterEmotion = activeEmo.emotion;
    if (derivedActiveEmotion === 'neutral') {
      if (this.phase === 'TOSS_AIM' || this.phase === 'CLAIM_AIM') {
        derivedActiveEmotion = 'focused';
      } else if (this.balance < 45) {
        derivedActiveEmotion = 'surprised';
      }
    }

    poses[activeSlotId] = {
      worldX: activeWorld.x,
      worldZ: activeWorld.z,
      zLift: this.playerZ * 1.45,
      facingYaw,
      mode,
      emotion: derivedActiveEmotion,
      speechIntensity: sonkoVoice.getLipSyncIntensity(activeSlotId, nowMs),
      speechState: sonkoVoice.getSpeechState(activeSlotId, nowMs),
      hopProgress: this.hopAnimating ? this.hopProgress : 0,
      aimPower: this.aimPower,
      aimAngleOffset: this.aimAngleOffset,
      balanceSway: this.balanceSway,
      actionTimer: elapsed,
      stoneInHand: this.stoneInHand,
      isClaimPose: this.phase === 'CLAIM_AIM',
    };

    // Fixed sideline resting spots per character so non-switching bystanders stay planted while active players walk cleanly
    const SIDELINE_SPOTS: Record<ChildStyle, { x: number; z: number }> = {
      kato: { x: -1.58, z: 2.35 },
      namukasa: { x: 2.08, z: 2.25 },
      ssemakula: { x: -1.68, z: 0.45 },
      auma: { x: 2.15, z: 0.55 },
    };
    for (let i = 0; i < SLOT_ORDER.length; i++) {
      const slotId = SLOT_ORDER[i];
      if (slotId === activeSlotId) continue;

      const sp = SIDELINE_SPOTS[slotId];
      const lookYaw = Math.atan2(activeWorld.x - sp.x, activeWorld.z - sp.z);
      const mate = this.players[i];
      const shouldCheer =
        this.cheerTimer > 0 && (!mate || mate.teamId === curPlayer.teamId);
      const emo = this.getSlotEmotion(slotId);
      const sideMode: CharacterPoseCommand['mode'] =
        emo.emoteMode ?? (shouldCheer ? 'SIDELINE_CHEER' : 'SIDELINE_IDLE');
      const sideEmotion: CharacterEmotion =
        emo.emotion !== 'neutral' ? emo.emotion : shouldCheer ? 'cheer' : 'neutral';

      poses[slotId] = {
        worldX: sp.x,
        worldZ: sp.z,
        zLift: 0,
        facingYaw: lookYaw,
        mode: sideMode,
        emotion: sideEmotion,
        speechIntensity: sonkoVoice.getLipSyncIntensity(slotId, nowMs),
        speechState: sonkoVoice.getSpeechState(slotId, nowMs),
        hopProgress: 0,
        aimPower: 0,
        aimAngleOffset: 0,
        balanceSway: 0,
        actionTimer: elapsed,
        stoneInHand: false,
        isClaimPose: false,
      };
    }

    return poses;
  }

  private getSlotForPlayer(playerIndex: number): ChildStyle {
    return SLOT_ORDER[playerIndex % SLOT_ORDER.length];
  }

  private setSlotEmotion(
    slot: ChildStyle,
    emotion: CharacterEmotion,
    durationSec: number,
    emoteMode?: 'EMOTE_LAUGH' | 'EMOTE_ANNOYED' | 'SIDELINE_CHEER'
  ) {
    this.slotEmotions.set(slot, {
      emotion,
      expiresAt: this.time + durationSec,
      emoteMode,
    });
  }

  private getSlotEmotion(slot: ChildStyle): {
    emotion: CharacterEmotion;
    emoteMode?: 'EMOTE_LAUGH' | 'EMOTE_ANNOYED' | 'SIDELINE_CHEER';
  } {
    const rec = this.slotEmotions.get(slot);
    if (!rec || this.time > rec.expiresAt) {
      if (rec) this.slotEmotions.delete(slot);
      return { emotion: 'neutral' };
    }
    return { emotion: rec.emotion, emoteMode: rec.emoteMode };
  }

  public dispose() {
    sonkoVoice.stopSpeech();
    this.unsubOnline?.();
    this.unsubOnline = null;
  }

  private pushHud(force = false) {
    const now = performance.now();
    if (!force && now - this.lastHudPushTime < 90) return;
    this.lastHudPushTime = now;
    this.onHudChange?.({
      screen: this.screen,
      mode: this.mode,
      difficulty: this.difficulty,
      courtSize: this.courtSize,
      venue: this.venue,
      windX: this.windX,
      puddleSquares: this.puddleSquares,
      activePlayerIndex: this.activePlayerIndex,
      players: this.players.map((pl) => ({ ...pl })),
      teamScores: [this.teamScores[0], this.teamScores[1]],
      teamTargets: [this.teamTargets[0], this.teamTargets[1]],
      phase: this.phase,
      balance: Math.round(this.balance),
      aimPower: this.aimPower,
      isCharging: this.isCharging,
      statusBanner: this.statusBanner,
      foulReason: this.foulReason,
      winnerTeamId: this.winnerTeamId,
      winnerLabel: this.winnerLabel,
      winReason: this.winReason,
      houses: { ...this.houses },
      turnCount: this.turnCount,
      lastMatchReward: this.lastMatchReward,
      speechStates: sonkoVoice.getAllSpeechStates(),
      onlineRoomCode: this.onlineRoomCode,
      onlineLocalSlot: this.onlineLocalSlot,
      onlineOpponentConnected: this.onlineOpponentConnected,
      onlineRematchVotes: this.onlineRematchVotes,
      weatherCondition: this.weatherCondition,
      weatherMode: this.weatherMode,
      weatherLabel: WEATHER_SPECS[this.weatherCondition].label,
    });
  }

  private addCallout(text: string, nx: number, ny: number, color = '#FEF08A') {
    const w = courtNormalizedToWorld(nx, ny);
    this.callouts.push({
      id: this.nextCalloutId++,
      text,
      worldX: w.x,
      worldY: 0.95,
      worldZ: w.z,
      life: 0,
      maxLife: 1.1,
      color,
    });
  }

  private computePredictedLanding(): { x: number; y: number } {
    const dist = 0.08 + this.aimPower * 0.82;
    const angle = -Math.PI / 2 + this.aimAngleOffset;
    return {
      x: this.playerX + Math.cos(angle) * dist * 0.65,
      y: this.playerY + Math.sin(angle) * dist,
    };
  }

  private resetTurnToBaseline(phase: TurnPhase) {
    const p = this.players[this.activePlayerIndex] ?? this.players[0];
    this.phase = phase;
    this.playerX = 0.5;
    this.playerY = 0.945;
    this.playerZ = 0;
    this.playerFacingYaw = phase === 'CLAIM_AIM' ? 0 : Math.PI;
    this.playerStance = 'TWO_FEET';
    this.throwFollowTimer = 0;
    this.hopAnimating = false;
    this.stoneInHand = true;
    this.stonePlacedSquareId = null;
    this.stoneX = 0.5;
    this.stoneY = 0.945;
    this.stoneZ = 0;
    this.balance = 100;
    this.balanceSway = 0;
    this.aimAngleOffset = 0;
    this.aimPower = 0.14;
    this.aimChargeDir = 1;
    this.isCharging = false;
    this.foulReason = null;

    if (this.mode !== 'ONLINE_1V1') {
      const weatherSpec = WEATHER_SPECS[this.weatherCondition];
      if (this.venue === 'entebbe_sand' || weatherSpec.windStrength >= 0.35) {
        const dir = Math.random() > 0.5 ? 1 : -1;
        const baseWind = (this.venue === 'entebbe_sand' ? 0.04 : 0) + weatherSpec.windStrength * 0.07;
        this.windX = dir * (baseWind * (0.65 + Math.random() * 0.55));
      } else {
        this.windX = 0;
      }
    }
    this.awaitingTossAck = false;

    if (phase === 'CLAIM_AIM') {
      if (p.isBot) {
        this.statusBanner = `${p.name} tosses over the shoulder for a House...`;
        this.botTargetPower = 0.22 + Math.random() * 0.52;
        this.botTargetAngle = (Math.random() - 0.5) * 0.28;
        this.botTimer = 0.5;
        this.botSubPhase = 'AIM';
      } else if (this.mode === 'ONLINE_1V1' && this.activePlayerIndex !== this.onlineLocalSlot) {
        this.statusBanner = `${p.name} aims over the shoulder for a House...`;
      } else {
        this.statusBanner = `${p.name}: Bonus! Hold Click or Space to toss blind for a House`;
      }
    } else if (p.isBot) {
      this.statusBanner = `${p.name} is aiming for Square ${p.targetSquare}...`;
      const targetSq = this.squares.find((sq) => sq.id === p.targetSquare);
      const center = targetSq ? getSquareCenter(targetSq) : { x: 0.5, y: 0.5 };
      const errScale =
        this.difficulty === 'EASY' ? 0.075 : this.difficulty === 'NORMAL' ? 0.036 : 0.018;
      const windCompFactor =
        this.difficulty === 'HARD' ? 0.9 : this.difficulty === 'NORMAL' ? 0.55 : 0.2;
      const windDriftEst = this.windX * 0.56 * windCompFactor;
      const dx = center.x - windDriftEst - 0.5 + (Math.random() - 0.5) * errScale;
      const dy = center.y - 0.945 + (Math.random() - 0.5) * errScale;
      const neededDist = Math.abs(dy);
      this.botTargetPower = Math.max(0.08, Math.min(0.98, (neededDist - 0.08) / 0.82));
      this.botTargetAngle = Math.atan2(dx / 0.65, Math.abs(dy));
      this.botTimer = 0.55;
      this.botSubPhase = 'AIM';
    } else if (this.mode === 'ONLINE_1V1' && this.activePlayerIndex !== this.onlineLocalSlot) {
      this.statusBanner = `Waiting for ${p.name} to toss into Square ${p.targetSquare}...`;
    } else {
      this.statusBanner = `${p.name}: Aim & hold Click or Space — release inside Square ${p.targetSquare}`;
    }

    if (
      this.screen === 'PLAYING' &&
      (phase === 'TOSS_AIM' || phase === 'CLAIM_AIM') &&
      this.turnCount > 1 &&
      Math.random() < 0.45
    ) {
      const activeSlot = this.getSlotForPlayer(this.activePlayerIndex);
      sonkoVoice.speakEvent(activeSlot, 'AIM', 'focused', { priority: 'normal' });
    }
  }

  private advanceToNextPlayer() {
    if (this.mode === 'ONLINE_1V1') return;
    const hadMultiple = this.players.length > 1;
    if (hadMultiple) {
      this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
    }
    this.turnCount += 1;
    if (hadMultiple) {
      this.resetTurnToBaseline('PLAYER_SWITCH');
      this.phaseTimer = 0.95;
      const nextP = this.players[this.activePlayerIndex];
      this.statusBanner = `${nextP.name} walks up to the baseline...`;
    } else {
      this.resetTurnToBaseline('TOSS_AIM');
    }
    this.pushHud(true);
  }

  private triggerFoul(reason: string, squareId: number | null = null) {
    const p = this.players[this.activePlayerIndex];
    const activeSlot = this.getSlotForPlayer(this.activePlayerIndex);
    p.fouls += 1;
    p.streak = 0;
    this.phase = 'FOUL_RECOVERY';
    this.foulReason = reason;
    this.foulSquareId = squareId;
    this.foulFlashTimer = 0.9;
    this.phaseTimer = 1.45;
    this.hitstopTimer = 0.045;
    this.shakeMag = 0.14;
    this.statusBanner = `${p.name} fouled: ${reason}`;
    sonkoAudio.playFoul();
    this.addCallout(reason.toUpperCase(), this.playerX, Math.max(0.18, this.playerY - 0.07), '#FCA5A5');

    // Active player shows annoyed reaction; sideline rival laughs playfully!
    this.setSlotEmotion(activeSlot, 'annoyed', 1.85, 'EMOTE_ANNOYED');
    const rivals = SLOT_ORDER.filter((s, idx) => s !== activeSlot && (this.players[idx]?.teamId ?? idx % 2) !== p.teamId);
    const laughingRival = rivals.length > 0 ? rivals[Math.floor(Math.random() * rivals.length)] : undefined;
    if (laughingRival && Math.random() < 0.6) {
      this.setSlotEmotion(laughingRival, 'laugh', 2.2, 'EMOTE_LAUGH');
      sonkoVoice.speakEvent(laughingRival, 'LAUGH', 'laugh', { priority: 'high' });
    } else {
      if (laughingRival) {
        this.setSlotEmotion(laughingRival, 'laugh', 1.8, 'EMOTE_LAUGH');
      }
      sonkoVoice.speakEvent(activeSlot, 'ANNOYED', 'annoyed', { priority: 'high' });
    }

    if (this.mode === 'ONLINE_1V1' && this.activePlayerIndex === this.onlineLocalSlot) {
      sonkoOnline.sendTurnEnd('FOUL', reason);
    }
    this.pushHud(true);
  }

  private launchStoneWithCoords(isClaim: boolean, targetX: number, targetY: number) {
    const flightTime = 0.56;
    this.stoneInHand = false;
    this.stoneX = this.playerX;
    this.stoneY = this.playerY;
    this.stoneZ = 0.08;
    this.stoneVx = (targetX - this.playerX) / flightTime;
    this.stoneVy = (targetY - this.playerY) / flightTime;
    const gravity = 2.6;
    this.stoneVz = (0.5 * gravity * flightTime * flightTime - 0.08) / flightTime;
    this.stoneBounces = 0;
    this.isCharging = false;
    this.awaitingTossAck = false;
    this.throwFollowTimer = 0.36;
    this.phase = isClaim ? 'CLAIM_FLIGHT' : 'STONE_FLIGHT';
    sonkoAudio.playToss();
    const activeSlot = this.getSlotForPlayer(this.activePlayerIndex);
    sonkoVoice.speakEvent(activeSlot, 'THROW', 'focused', { priority: 'normal' });
    this.pushHud(true);
  }

  private launchStoneThrow(isClaim: boolean) {
    if (this.mode === 'ONLINE_1V1') {
      if (this.awaitingTossAck || this.activePlayerIndex !== this.onlineLocalSlot) return;
      this.awaitingTossAck = true;
      this.isCharging = false;
      sonkoOnline.sendToss(this.aimAngleOffset, this.aimPower, isClaim);
      return;
    }
    const landing = this.computePredictedLanding();
    const jitter = isClaim ? 0.04 : this.difficulty === 'HARD' ? 0.012 : 0.005;
    const targetX = landing.x + (Math.random() - 0.5) * jitter;
    const targetY = landing.y + (Math.random() - 0.5) * jitter;
    this.launchStoneWithCoords(isClaim, targetX, targetY);
  }

  private beginHopStep(step: HopStep) {
    const sqs = step.squares
      .map((id) => this.squares.find((sq) => sq.id === id))
      .filter((sq): sq is CourtSquare => Boolean(sq));
    if (sqs.length === 0) return;

    const avgX = sqs.reduce((acc, sq) => acc + sq.x + sq.w / 2, 0) / sqs.length;
    const avgY = sqs.reduce((acc, sq) => acc + sq.y + sq.h / 2, 0) / sqs.length;

    this.hopAnimating = true;
    this.hopFromX = this.playerX;
    this.hopFromY = this.playerY;
    this.hopToX = avgX;
    this.hopToY = avgY;
    this.hopProgress = 0;
    this.hopDuration = 0.27;
    this.playerFacingYaw = step.leg === 'OUT' ? Math.PI : 0;

    if (step.stance === 'TWO_FEET' || step.stance === 'HOUSE_REST') {
      this.playerStance = 'TWO_FEET';
    } else {
      this.playerStance = this.stepCountTotal % 2 === 0 ? 'LEFT_FOOT' : 'RIGHT_FOOT';
    }
    this.stepCountTotal += 1;
    sonkoAudio.playHop(step.stance !== 'ONE_FOOT', this.stepCountTotal);
  }

  private getCurrentNextStep(): HopStep | null {
    if (this.phase === 'HOP_OUT') {
      return this.outSteps[this.stepCursor] ?? null;
    }
    if (this.phase === 'HOP_BACK') {
      return this.backSteps[this.stepCursor] ?? null;
    }
    return null;
  }

  private advanceHopAction(fromRemote = false) {
    if (this.hopAnimating) {
      if (!fromRemote) return;
      this.hopAnimating = false;
      this.playerX = this.hopToX;
      this.playerY = this.hopToY;
      this.playerZ = 0;
    }

    if (this.phase === 'HOP_OUT') {
      const next = this.outSteps[this.stepCursor];
      if (next) {
        if (this.mode === 'ONLINE_1V1' && !fromRemote && this.activePlayerIndex === this.onlineLocalSlot) {
          sonkoOnline.sendHop();
        }
        this.beginHopStep(next);
        return;
      }
    } else if (this.phase === 'HOP_BACK') {
      const next = this.backSteps[this.stepCursor];
      if (next) {
        if (this.mode === 'ONLINE_1V1' && !fromRemote && this.activePlayerIndex === this.onlineLocalSlot) {
          sonkoOnline.sendHop();
        }
        this.beginHopStep(next);
        return;
      }
    } else if (this.phase === 'HOP_EXIT') {
      if (this.mode === 'ONLINE_1V1' && !fromRemote && this.activePlayerIndex === this.onlineLocalSlot) {
        sonkoOnline.sendHop();
      }
      this.hopAnimating = true;
      this.hopFromX = this.playerX;
      this.hopFromY = this.playerY;
      this.hopToX = 0.5;
      this.hopToY = 0.945;
      this.hopProgress = 0;
      this.hopDuration = 0.24;
      this.playerStance = 'TWO_FEET';
      sonkoAudio.playHop(true, this.stepCountTotal + 1);
    } else if (this.phase === 'PICKUP_STONE') {
      if (this.mode === 'ONLINE_1V1' && !fromRemote && this.activePlayerIndex === this.onlineLocalSlot) {
        sonkoOnline.sendPickup();
      }
      this.playerStance = 'BENDING';
      this.stoneInHand = true;
      this.stonePlacedSquareId = null;
      this.balance = Math.min(100, this.balance + 18);
      this.players[this.activePlayerIndex].score += 40;
      this.teamScores[this.players[this.activePlayerIndex].teamId] += 40;
      sonkoAudio.playPickup();
      this.court3D.spawnBurst(this.stoneX, this.stoneY, 10, '#FDE047');
      this.addCallout('STONE SCOOPED +40', this.playerX, this.playerY - 0.05, '#FEF08A');

      const p = this.players[this.activePlayerIndex];
      const remoteTurn = this.mode === 'ONLINE_1V1' && this.activePlayerIndex !== this.onlineLocalSlot;
      if (this.stepCursor < this.backSteps.length) {
        this.phase = 'HOP_BACK';
        this.statusBanner =
          p.isBot || remoteTurn
            ? `${p.name} scooped the stone and hops back!`
            : 'Hop back to the baseline! (Space / S / Click tile)';
      } else {
        this.phase = 'HOP_EXIT';
        this.statusBanner =
          p.isBot || remoteTurn
            ? `${p.name} leaps out to finish!`
            : 'Final leap to baseline! (Space / S / Click baseline)';
      }
      this.pushHud(true);
    }
  }

  private finalizeMatch(winnerTeamId: 0 | 1, winnerLabel: string, reason: string) {
    this.winnerTeamId = winnerTeamId;
    this.winnerLabel = winnerLabel;
    this.winReason = reason;
    const localSlot = this.mode === 'ONLINE_1V1' ? (this.onlineLocalSlot ?? 0) : 0;
    const team0Players = this.players.filter((pl) => pl.teamId === localSlot);
    const primaryHuman = this.players[localSlot] ?? this.players[0];
    const aggregatedHuman: PlayerState = {
      ...primaryHuman,
      score: this.teamScores[localSlot],
      roundsCleared: team0Players.reduce((sum, pl) => sum + pl.roundsCleared, 0),
      perfectTosses: team0Players.reduce((sum, pl) => sum + pl.perfectTosses, 0),
      housesOwned: team0Players.flatMap((pl) => pl.housesOwned),
      bestStreak: Math.max(primaryHuman.bestStreak, ...team0Players.map((pl) => pl.bestStreak)),
      fouls: primaryHuman.fouls,
    };
    const won = winnerTeamId === localSlot;
    const reward = computeMatchRewards(aggregatedHuman, won, this.mode, this.difficulty, this.venue);
    this.lastMatchReward = reward;
    this.victoryElapsed = 0;
    this.screen = 'GAME_OVER';
    sonkoAudio.playVictory();
    this.court3D.spawnBurst(0.5, 0.72, 22, '#FDE047');
    const winIdx = this.players.findIndex((pl) => pl.teamId === winnerTeamId);
    const winnerSlot = this.getSlotForPlayer(winIdx >= 0 ? winIdx : 0);
    this.setSlotEmotion(winnerSlot, 'cheer', 8.0, 'SIDELINE_CHEER');
    sonkoVoice.speakEvent(winnerSlot, 'WIN', 'cheer', { priority: 'high' });
    this.onMatchComplete?.(reward, won, aggregatedHuman, this.venue, {
      mode: this.mode,
      difficulty: this.difficulty,
    });
    this.pushHud(true);
  }

  private completeRoundForActivePlayer() {
    const p = this.players[this.activePlayerIndex];
    const teamId = p.teamId;
    p.roundsCleared += 1;
    p.streak += 1;
    p.bestStreak = Math.max(p.bestStreak, p.streak);
    const pts = 100 + p.streak * 25;
    p.score += pts;
    this.teamScores[teamId] += pts;
    this.cheerTimer = 1.6;
    this.addCallout(`SQUARE ${p.targetSquare} CLEARED!`, 0.5, 0.72, '#86EFAC');
    const activeSlot = this.getSlotForPlayer(this.activePlayerIndex);
    this.setSlotEmotion(activeSlot, 'happy', 1.8);
    if (p.streak >= 2) {
      const cheerer = SLOT_ORDER.find((s) => s !== activeSlot);
      if (cheerer) {
        this.setSlotEmotion(cheerer, 'cheer', 1.8, 'SIDELINE_CHEER');
        sonkoVoice.speakEvent(cheerer, 'CHEER', 'cheer', { priority: 'normal' });
      }
    }

    if (this.mode === 'ONLINE_1V1') {
      this.phase = 'ROUND_CLEAR';
      this.phaseTimer = 999;
      this.statusBanner = `${p.name} cleared Square ${p.targetSquare}!`;
      sonkoAudio.playRoundClear();
      if (this.activePlayerIndex === this.onlineLocalSlot) {
        sonkoOnline.sendTurnEnd('ROUND_CLEAR');
      }
      this.pushHud(true);
      return;
    }

    const midHouseTrigger = this.courtSize === 10 ? 5 : 3;
    const earnedMidHouse = p.targetSquare === midHouseTrigger;
    const finishedCourse = p.targetSquare >= this.courtSize;

    if (finishedCourse) {
      p.cyclesCompleted += 1;
      p.score += 250;
      this.teamScores[teamId] += 250;
      if (this.mode === 'SOLO') {
        this.phase = 'ROUND_CLEAR';
        this.phaseTimer = 0.85;
        this.statusBanner = `Cycle Complete! Claim your Victory House!`;
        sonkoAudio.playVictory();
        this.pushHud(true);
        return;
      } else {
        const label =
          this.mode === 'TEAM_2V2'
            ? teamId === 0
              ? 'Team Cranes Win!'
              : 'Team Waves Win!'
            : `${p.name} Wins!`;
        this.finalizeMatch(teamId, label, `${p.name} conquered Square ${this.courtSize}!`);
        return;
      }
    }

    const nextTarget = p.targetSquare + 1;
    this.teamTargets[teamId] = nextTarget;
    for (const mate of this.players) {
      if (mate.teamId === teamId) {
        mate.targetSquare = nextTarget;
      }
    }

    if (earnedMidHouse) {
      this.phase = 'ROUND_CLEAR';
      this.phaseTimer = 0.85;
      this.statusBanner = `${p.name} unlocked a Mid-Court House Toss!`;
      sonkoAudio.playRoundClear();
      this.pushHud(true);
      return;
    }

    this.phase = 'ROUND_CLEAR';
    this.phaseTimer = 0.8;
    this.statusBanner = `Square cleared! Next target: Square ${nextTarget}`;
    sonkoAudio.playRoundClear();
    this.pushHud(true);
  }

  private updatePlayingSimulation(dt: number) {
    const activePlayer = this.players[this.activePlayerIndex];

    // 1. Aiming & Charging
    if (this.phase === 'TOSS_AIM' || this.phase === 'CLAIM_AIM') {
      if (activePlayer.isBot) {
        this.botTimer -= dt;
        if (this.botSubPhase === 'AIM') {
          this.aimAngleOffset += (this.botTargetAngle - this.aimAngleOffset) * Math.min(1, dt * 6);
          if (this.botTimer <= 0) {
            this.botSubPhase = 'CHARGE';
            this.isCharging = true;
            this.aimPower = 0.08;
          }
        } else if (this.botSubPhase === 'CHARGE') {
          this.aimPower += dt * 0.72;
          if (this.aimPower >= this.botTargetPower) {
            this.aimPower = this.botTargetPower;
            this.launchStoneThrow(this.phase === 'CLAIM_AIM');
          }
        }
      } else if (this.mode === 'ONLINE_1V1' && this.activePlayerIndex !== this.onlineLocalSlot) {
        return;
      } else {
        if (this.heldKeys.has('ArrowLeft') || this.heldKeys.has('KeyA')) {
          this.aimAngleOffset = Math.max(-0.42, this.aimAngleOffset - dt * 0.75);
        }
        if (this.heldKeys.has('ArrowRight') || this.heldKeys.has('KeyD')) {
          this.aimAngleOffset = Math.min(0.42, this.aimAngleOffset + dt * 0.75);
        }
        if (this.isCharging) {
          const speed = 0.72;
          this.aimPower += this.aimChargeDir * speed * dt;
          if (this.aimPower >= 1) {
            this.aimPower = 1;
            this.aimChargeDir = -1;
          } else if (this.aimPower <= 0.06) {
            this.aimPower = 0.06;
            this.aimChargeDir = 1;
          }
        } else if (this.phase === 'CLAIM_AIM') {
          this.aimAngleOffset = Math.sin(this.time * 2.1) * 0.24;
        }
        if (this.mode === 'ONLINE_1V1' && this.activePlayerIndex === this.onlineLocalSlot) {
          sonkoOnline.sendAim(this.aimAngleOffset, this.aimPower, this.isCharging);
        }
        this.pushHud(false);
      }
      return;
    }

    // 2. Stone Flight Physics
    if (this.phase === 'STONE_FLIGHT' || this.phase === 'CLAIM_FLIGHT') {
      const gravity = 2.6;
      if (Math.abs(this.windX) > 0.002 && this.stoneBounces === 0) {
        this.stoneVx += this.windX * dt * 1.45;
      }
      this.stoneX += this.stoneVx * dt;
      this.stoneY += this.stoneVy * dt;
      this.stoneZ += this.stoneVz * dt;
      this.stoneVz -= gravity * dt;
      this.stoneRot += dt * 7.5;

      if (this.stoneZ <= 0) {
        this.stoneZ = 0;
        this.stoneBounces += 1;
        if (this.stoneBounces === 1) {
          const hitSq = this.squares.find(
            (sq) =>
              this.stoneX >= sq.x &&
              this.stoneX <= sq.x + sq.w &&
              this.stoneY >= sq.y &&
              this.stoneY <= sq.y + sq.h
          );
          const inPuddle = hitSq !== undefined && this.puddleSquares.includes(hitSq.id);

          if (inPuddle) {
            sonkoAudio.playSplash();
            this.court3D.spawnBurst(this.stoneX, this.stoneY, 16, '#93C5FD');
            this.stoneVz = 0.2;
            this.stoneVx *= 0.34;
            this.stoneVy *= 0.38;
          } else if (this.venue === 'entebbe_sand') {
            sonkoAudio.playStoneBounce(0.65);
            this.court3D.spawnBurst(this.stoneX, this.stoneY, 12, '#FDE68A');
            this.stoneVz = 0.16;
            this.stoneVx *= 0.08;
            this.stoneVy *= 0.08;
          } else {
            sonkoAudio.playStoneBounce(1);
            const dustCol =
              activePlayer.teamId === 0
                ? getStoneSpec(this.cosmetics.equippedStone).dustColor
                : '#D68C6B';
            this.court3D.spawnBurst(this.stoneX, this.stoneY, 12, dustCol);
            this.stoneVz = 0.34;
            this.stoneVx *= 0.22;
            this.stoneVy *= 0.22;
          }
        } else {
          this.stoneVx = 0;
          this.stoneVy = 0;
          this.stoneVz = 0;

          const lineTol = this.venue === 'ndere_night' ? 0.019 : 0.016;

          if (this.phase === 'CLAIM_FLIGHT') {
            const res = evaluateClaimLanding(
              this.squares,
              this.houses,
              this.stoneX,
              this.stoneY,
              lineTol
            );
            if (res.status === 'CLAIMED' && res.squareId !== null) {
              this.houses[res.squareId] = activePlayer.teamId;
              activePlayer.housesOwned.push(res.squareId);
              activePlayer.score += 180;
              this.teamScores[activePlayer.teamId] += 180;
              this.cheerTimer = 1.6;
              sonkoAudio.playHouseClaim();
              this.court3D.spawnBurst(this.stoneX, this.stoneY, 20, '#86EFAC');
              this.addCallout(
                `EKIZIMBE! HOUSE ${res.squareId}`,
                this.stoneX,
                this.stoneY - 0.04,
                '#86EFAC'
              );
              this.statusBanner = `${activePlayer.name} claimed Square ${res.squareId} as a House!`;
              const activeSlot = this.getSlotForPlayer(this.activePlayerIndex);
              this.setSlotEmotion(activeSlot, 'cheer', 2.4, 'SIDELINE_CHEER');
              sonkoVoice.speakEvent(activeSlot, 'HOUSE_CLAIM', 'cheer', { priority: 'high' });
              if (this.mode === 'ONLINE_1V1' && this.activePlayerIndex === this.onlineLocalSlot) {
                sonkoOnline.sendTossResult('CLAIM_SUCCESS', res.squareId);
              }
            } else {
              sonkoAudio.playFoul();
              this.addCallout('NO HOUSE CLAIMED', this.stoneX, this.stoneY - 0.04, '#FCA5A5');
              this.statusBanner = `No House claimed (${res.status.replace('_', ' ').toLowerCase()})`;
              const activeSlot = this.getSlotForPlayer(this.activePlayerIndex);
              this.setSlotEmotion(activeSlot, 'annoyed', 1.6, 'EMOTE_ANNOYED');
              sonkoVoice.speakEvent(activeSlot, 'ANNOYED', 'annoyed', { priority: 'normal' });
            }

            if (
              this.mode === 'SOLO' &&
              activePlayer.cyclesCompleted >= 1 &&
              activePlayer.targetSquare >= this.courtSize
            ) {
              this.finalizeMatch(0, 'You Win!', `You mastered all ${this.courtSize} squares of Sonko!`);
              return;
            }

            if (this.mode === 'ONLINE_1V1') {
              this.phase = 'ROUND_CLEAR';
              this.phaseTimer = 999;
              if (this.activePlayerIndex === this.onlineLocalSlot) {
                sonkoOnline.sendTurnEnd('CLAIM_COMPLETE');
              }
              this.pushHud(true);
              return;
            }

            this.phase = 'ROUND_CLEAR';
            this.phaseTimer = 1.05;
            this.pushHud(true);
            return;
          }

          const evalRes = evaluateStoneLanding(
            this.squares,
            this.stoneX,
            this.stoneY,
            activePlayer.targetSquare,
            lineTol
          );

          if (evalRes.status === 'CLEAN' || evalRes.status === 'BULLSEYE') {
            this.stonePlacedSquareId = activePlayer.targetSquare;
            const isBullseye = evalRes.status === 'BULLSEYE';
            const activeSlot = this.getSlotForPlayer(this.activePlayerIndex);
            if (isBullseye) {
              activePlayer.perfectTosses += 1;
              activePlayer.score += 60;
              this.teamScores[activePlayer.teamId] += 60;
              this.addCallout('BULLSEYE +60', this.stoneX, this.stoneY - 0.04, '#FDE047');
              this.setSlotEmotion(activeSlot, 'cheer', 2.0);
              sonkoVoice.speakEvent(activeSlot, 'BULLSEYE', 'cheer', { priority: 'high' });
              if (this.mode === 'ONLINE_1V1' && this.activePlayerIndex === this.onlineLocalSlot) {
                sonkoOnline.sendTossResult('BULLSEYE');
              }
            } else {
              activePlayer.score += 25;
              this.teamScores[activePlayer.teamId] += 25;
              this.addCallout('CLEAN TOSS +25', this.stoneX, this.stoneY - 0.04, '#FEF08A');
              this.setSlotEmotion(activeSlot, 'happy', 1.4);
              if (Math.random() < 0.45) {
                sonkoVoice.speakEvent(activeSlot, 'GOOD_TOSS', 'happy', { priority: 'normal' });
              }
              if (this.mode === 'ONLINE_1V1' && this.activePlayerIndex === this.onlineLocalSlot) {
                sonkoOnline.sendTossResult('CLEAN');
              }
            }
            sonkoAudio.playTossSuccess(isBullseye);

            const seq = buildHopSequence(
              this.squares,
              activePlayer.targetSquare,
              this.houses,
              activePlayer.teamId
            );
            this.outSteps = seq.outSteps;
            this.backSteps = seq.backSteps;
            this.stepCursor = 0;
            this.stepCountTotal = 0;
            this.phase = 'HOP_OUT';
            this.botTimer = 0.45;
            const remoteTurn =
              this.mode === 'ONLINE_1V1' && this.activePlayerIndex !== this.onlineLocalSlot;
            this.statusBanner =
              activePlayer.isBot || remoteTurn
                ? `${activePlayer.name} landed it! Hopping through...`
                : `Clean toss! Hop through the court — skip Square ${activePlayer.targetSquare} (Space / Click)`;
            this.pushHud(true);
          } else {
            const reason =
              evalRes.status === 'LINE_FOUL'
                ? 'Stone touched chalk line!'
                : `Missed Square ${activePlayer.targetSquare}!`;
            this.triggerFoul(reason, evalRes.landedSquareId);
          }
        }
      }
      return;
    }

    // 3. Hop Animation & Balance Update
    if (
      this.phase === 'HOP_OUT' ||
      this.phase === 'HOP_BACK' ||
      this.phase === 'PICKUP_STONE' ||
      this.phase === 'HOP_EXIT'
    ) {
      const controlsBalanceLocally =
        !activePlayer.isBot &&
        (this.mode !== 'ONLINE_1V1' || this.activePlayerIndex === this.onlineLocalSlot);

      if (controlsBalanceLocally && this.playerStance !== 'TWO_FEET' && !this.hopAnimating) {
        const standingSq = this.squares.find(
          (sq) =>
            this.playerX >= sq.x &&
            this.playerX <= sq.x + sq.w &&
            this.playerY >= sq.y &&
            this.playerY <= sq.y + sq.h
        );
        const inPuddle = standingSq !== undefined && this.puddleSquares.includes(standingSq.id);
        const puddleMult = inPuddle ? 1.32 : 1;
        const roundDifficulty =
          (0.28 + (activePlayer.targetSquare / this.courtSize) * 0.34) * puddleMult;

        if (Math.random() < dt * 1.4) {
          this.balanceDriftDir = Math.random() > 0.5 ? 1 : -1;
        }
        this.balanceSway += (this.balanceDriftDir * roundDifficulty + this.windX * 1.1) * dt;

        if (this.heldKeys.has('ArrowLeft') || this.heldKeys.has('KeyA')) {
          this.balanceSway -= 1.65 * dt;
        }
        if (this.heldKeys.has('ArrowRight') || this.heldKeys.has('KeyD')) {
          this.balanceSway += 1.65 * dt;
        }
        this.balanceSway = Math.max(-1.05, Math.min(1.05, this.balanceSway));

        if (Math.abs(this.balanceSway) > 0.65) {
          this.balance = Math.max(0, this.balance - Math.abs(this.balanceSway) * 32 * dt);
        } else {
          this.balance = Math.min(100, this.balance + 10 * dt);
        }

        if (this.mode === 'ONLINE_1V1') {
          sonkoOnline.sendBalance(this.balance, this.balanceSway);
        }

        if (this.balance <= 0) {
          this.triggerFoul('Lost balance on one foot!');
          return;
        }
        if (this.balance < 45 && this.time - this.lastWobbleCallAt > 4.5) {
          this.lastWobbleCallAt = this.time;
          const activeSlot = this.getSlotForPlayer(this.activePlayerIndex);
          this.setSlotEmotion(activeSlot, 'surprised', 1.2);
          sonkoVoice.speakEvent(activeSlot, 'WOBBLE', 'surprised', { priority: 'normal' });
        }
        this.pushHud(false);
      }

      if (this.hopAnimating) {
        this.hopProgress += dt / this.hopDuration;
        if (this.hopProgress >= 1) {
          this.hopProgress = 1;
          this.hopAnimating = false;
          this.playerX = this.hopToX;
          this.playerY = this.hopToY;
          this.playerZ = 0;

          const landedSq = this.squares.find(
            (sq) =>
              this.playerX >= sq.x &&
              this.playerX <= sq.x + sq.w &&
              this.playerY >= sq.y &&
              this.playerY <= sq.y + sq.h
          );
          const landedInPuddle =
            landedSq !== undefined && this.puddleSquares.includes(landedSq.id);
          if (landedInPuddle) {
            sonkoAudio.playSplash();
            this.court3D.spawnBurst(this.playerX, this.playerY, 10, '#93C5FD');
          } else {
            const dustColor =
              this.venue === 'entebbe_sand'
                ? '#FDE68A'
                : this.venue === 'ndere_night'
                  ? '#F59E0B'
                  : '#D68C6B';
            this.court3D.spawnBurst(this.playerX, this.playerY, 7, dustColor);
          }

          if (this.playerStance === 'TWO_FEET') {
            this.balance = 100;
            this.balanceSway *= 0.2;
          } else {
            this.balance = Math.min(100, this.balance + 14);
            this.balanceSway *= 0.55;
          }
          activePlayer.score += 15;

          if (this.phase === 'HOP_EXIT') {
            this.completeRoundForActivePlayer();
            return;
          }

          const currentList = this.phase === 'HOP_OUT' ? this.outSteps : this.backSteps;
          const landedStep = currentList[this.stepCursor];
          this.stepCursor += 1;

          if (landedStep?.triggersPickupAfterLand) {
            this.phase = 'PICKUP_STONE';
            this.botTimer = 0.42;
            this.statusBanner = activePlayer.isBot
              ? `${activePlayer.name} stops to scoop the stone...`
              : 'Press E / Space or Click stone to scoop it up!';
            this.pushHud(true);
            return;
          }

          if (this.phase === 'HOP_OUT' && this.stepCursor >= this.outSteps.length) {
            this.phase = 'TURN_HOME';
            this.turnTimer = 0.34;
            this.statusBanner = 'Turning around at Home!';
            this.pushHud(true);
            return;
          }

          if (this.phase === 'HOP_BACK' && this.stepCursor >= this.backSteps.length) {
            this.phase = 'HOP_EXIT';
            this.botTimer = 0.34;
            this.statusBanner = activePlayer.isBot
              ? `${activePlayer.name} leaps to baseline!`
              : 'Final leap past Square 1 to baseline! (Space / Click)';
            this.pushHud(true);
            return;
          }

          this.pushHud(true);
        } else {
          const t = this.hopProgress;
          const smooth = t * (2 - t);
          this.playerX = this.hopFromX + (this.hopToX - this.hopFromX) * smooth;
          this.playerY = this.hopFromY + (this.hopToY - this.hopFromY) * smooth;
          this.playerZ = Math.sin(t * Math.PI) * 0.42;
        }
      } else if (activePlayer.isBot) {
        this.botTimer -= dt;
        if (this.botTimer <= 0) {
          const foulChance =
            this.difficulty === 'EASY' ? 0.045 : this.difficulty === 'NORMAL' ? 0.015 : 0;
          if (this.playerStance !== 'TWO_FEET' && Math.random() < foulChance) {
            this.triggerFoul('Stepped on a line!');
            return;
          }
          this.advanceHopAction();
          this.botTimer = 0.36;
        }
      }
      return;
    }

    // 4. Turnaround at Home
    if (this.phase === 'TURN_HOME') {
      this.turnTimer -= dt;
      const frac = 1 - Math.max(0, this.turnTimer) / 0.34;
      this.playerFacingYaw = Math.PI * (1 - frac);
      if (this.turnTimer <= 0) {
        this.playerFacingYaw = 0;
        this.stepCursor = 0;
        if (this.backSteps.length > 0) {
          this.phase = 'HOP_BACK';
          this.botTimer = 0.35;
          this.statusBanner = activePlayer.isBot
            ? `${activePlayer.name} hops back!`
            : 'Hop back down the court! (Space / S / Click tile)';
        } else {
          this.phase = 'HOP_EXIT';
          this.botTimer = 0.35;
        }
        this.pushHud(true);
      }
      return;
    }

    // 5. Player switch walk-in, Foul recovery, or Round clear transitions
    if (this.phase === 'PLAYER_SWITCH') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.resetTurnToBaseline('TOSS_AIM');
        this.pushHud(true);
      }
      return;
    }

    if (this.phase === 'FOUL_RECOVERY') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0 && this.mode !== 'ONLINE_1V1') {
        this.advanceToNextPlayer();
      }
      return;
    }

    if (this.phase === 'ROUND_CLEAR') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0 && this.mode !== 'ONLINE_1V1') {
        const midHouseTrigger = this.courtSize === 10 ? 6 : 4;
        const teamHousesCount = Object.values(this.houses).filter(
          (owner) => owner === activePlayer.teamId
        ).length;
        const justEarnedMidHouse =
          activePlayer.targetSquare === midHouseTrigger && teamHousesCount === 0;
        const justFinishedSolo =
          this.mode === 'SOLO' &&
          activePlayer.cyclesCompleted >= 1 &&
          activePlayer.targetSquare >= this.courtSize;

        if (justEarnedMidHouse || justFinishedSolo) {
          this.resetTurnToBaseline('CLAIM_AIM');
          this.pushHud(true);
        } else {
          this.advanceToNextPlayer();
        }
      }
    }
  }

  private syncFromOnlineRoom(room: OnlineRoomState) {
    this.courtSize = room.courtSize;
    this.venue = room.venue;
    this.windX = room.windX;
    this.puddleSquares = room.puddleSquares;
    this.weatherCondition =
      room.puddleSquares.length > 0 || room.venue === 'jinja_rain'
        ? 'storm_shower'
        : Math.abs(room.windX) > 0.025
          ? 'breezy'
          : resolveWeatherFromPeriodAndVenue('auto', room.venue);
    this.houses = { ...room.houses };
    this.activePlayerIndex = room.activeSlot;
    this.turnCount = room.turnCount;
    this.onlineRoomCode = room.code;
    this.onlineRematchVotes = room.rematchVotes;
    const otherSlot = (this.onlineLocalSlot ?? 0) === 0 ? 1 : 0;
    this.onlineOpponentConnected = Boolean(room.players[otherSlot]?.connected);

    const p0 = room.players[0];
    const p1 = room.players[1];
    if (p0 && p1) {
      const outfit0 = getOutfitSpec(p0.cosmetics.outfitId);
      const outfit1 = getOutfitSpec(p1.cosmetics.outfitId);
      this.onlineCosmetics = [p0.cosmetics, p1.cosmetics];
      this.teamScores = [p0.score, p1.score];
      this.teamTargets = [p0.targetSquare, p1.targetSquare];
      this.players = [
        {
          id: 0,
          teamId: 0,
          name: p0.name,
          isBot: false,
          hairStyle: p0.cosmetics.hairStyle,
          skinTone: p0.cosmetics.skinTone,
          primaryColor: p0.cosmetics.primaryColor ?? outfit0.primaryColor,
          accentColor: p0.cosmetics.accentColor ?? outfit0.accentColor,
          targetSquare: p0.targetSquare,
          cyclesCompleted: 0,
          score: p0.score,
          housesOwned: [...p0.housesOwned],
          streak: p0.streak,
          bestStreak: p0.bestStreak,
          perfectTosses: p0.perfectTosses,
          fouls: p0.fouls,
          roundsCleared: p0.roundsCleared,
        },
        {
          id: 1,
          teamId: 1,
          name: p1.name,
          isBot: false,
          hairStyle: p1.cosmetics.hairStyle,
          skinTone: p1.cosmetics.skinTone,
          primaryColor: p1.cosmetics.primaryColor ?? outfit1.primaryColor,
          accentColor: p1.cosmetics.accentColor ?? outfit1.accentColor,
          targetSquare: p1.targetSquare,
          cyclesCompleted: 0,
          score: p1.score,
          housesOwned: [...p1.housesOwned],
          streak: p1.streak,
          bestStreak: p1.bestStreak,
          perfectTosses: p1.perfectTosses,
          fouls: p1.fouls,
          roundsCleared: p1.roundsCleared,
        },
      ];
    }
  }

  private subscribeOnlineEvents() {
    this.unsubOnline = sonkoOnline.subscribe((ev) => {
      if (this.mode !== 'ONLINE_1V1') return;

      if (ev.type === 'room:state') {
        this.syncFromOnlineRoom(ev.room);
        this.pushHud(true);
      } else if (ev.type === 'room:rematch_start') {
        this.startOnlineGame(ev.room, this.onlineLocalSlot ?? 0);
      } else if (ev.type === 'remote:aim') {
        if (ev.slot !== this.onlineLocalSlot && (this.phase === 'TOSS_AIM' || this.phase === 'CLAIM_AIM')) {
          this.aimAngleOffset = ev.angleOffset;
          this.aimPower = ev.aimPower;
          this.isCharging = ev.isCharging;
        }
      } else if (ev.type === 'game:toss') {
        this.windX = ev.windX;
        this.launchStoneWithCoords(ev.isClaim, ev.targetX, ev.targetY);
      } else if (ev.type === 'remote:hop') {
        if (ev.slot !== this.onlineLocalSlot) {
          this.advanceHopAction(true);
        }
      } else if (ev.type === 'remote:pickup') {
        if (ev.slot !== this.onlineLocalSlot && this.phase === 'PICKUP_STONE') {
          this.advanceHopAction(true);
        }
      } else if (ev.type === 'remote:balance') {
        if (ev.slot !== this.onlineLocalSlot) {
          this.balance = ev.balance;
          this.balanceSway = ev.balanceSway;
        }
      } else if (ev.type === 'game:claim_phase') {
        this.syncFromOnlineRoom(ev.room);
        this.resetTurnToBaseline('CLAIM_AIM');
        this.pushHud(true);
      } else if (ev.type === 'game:turn_advance') {
        const prevSlot = this.activePlayerIndex;
        this.syncFromOnlineRoom(ev.room);
        if (prevSlot !== this.activePlayerIndex && this.players.length > 1) {
          this.resetTurnToBaseline('PLAYER_SWITCH');
          this.phaseTimer = 0.85;
          const nextP = this.players[this.activePlayerIndex];
          this.statusBanner = `${nextP.name} walks up to the baseline...`;
        } else {
          this.resetTurnToBaseline('TOSS_AIM');
        }
        this.pushHud(true);
      } else if (ev.type === 'game:over') {
        this.syncFromOnlineRoom(ev.room);
        const winSlot = ev.room.winnerSlot ?? 0;
        const winnerName = ev.room.players[winSlot]?.name ?? 'Winner';
        this.finalizeMatch(winSlot, `${winnerName} Wins!`, ev.room.winReason ?? 'Match complete!');
      }
    });
  }
}
