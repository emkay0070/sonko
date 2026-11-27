import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { sonkoAudio } from './audio';
import {
  buildCourtSquares,
  buildHopSequence,
  evaluateClaimLanding,
  evaluateStoneLanding,
  getSquareCenter,
} from './courtLayout';
import {
  computeCourtTransform,
  CourtyardRenderer,
  FloatingCallout,
  Particle,
  RenderState,
  SidelineCharacter,
  unprojectCourt,
} from './courtyardRenderer';
import { OnlinePlayerCosmetics, OnlineRoomState, sonkoOnline } from './onlineClient';
import { AvatarCustomization, computeMatchRewards, getOutfitSpec, getStoneSpec } from './progression';
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
  StencilId,
  StoneId,
  TurnPhase,
} from './types';
import { resolveWeatherFromPeriodAndVenue, WEATHER_SPECS } from './weather';

export interface SonkoCanvasHandle {
  startGame: (mode: PlayMode, difficulty: Difficulty, courtSize: CourtSize, venue?: CourtVenueId) => void;
  startOnlineGame: (room: OnlineRoomState, localSlot: 0 | 1) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  returnToTitle: () => void;
  nudgeBalance: (dir: -1 | 1) => void;
  triggerAction: () => void;
}

interface SonkoCanvasProps {
  equippedStone: StoneId;
  equippedOutfit: OutfitId;
  equippedStencil: StencilId;
  avatar: AvatarCustomization;
  previewVenue?: CourtVenueId;
  onHudChange: (snapshot: HudSnapshot) => void;
  onMatchComplete?: (
    reward: MatchRewardSummary,
    won: boolean,
    humanStats: PlayerState,
    venue: CourtVenueId
  ) => void;
}

interface SimState {
  screen: GameScreen;
  mode: PlayMode;
  difficulty: Difficulty;
  courtSize: CourtSize;
  venue: CourtVenueId;
  windX: number;
  puddleSquares: number[];
  squares: CourtSquare[];
  houses: Record<number, 0 | 1>;
  activePlayerIndex: number;
  players: PlayerState[];
  teamTargets: [number, number];
  teamScores: [number, number];
  phase: TurnPhase;
  turnCount: number;
  winnerTeamId: 0 | 1 | null;
  winnerLabel: string | null;
  winReason: string | null;
  foulReason: string | null;
  statusBanner: string;
  lastMatchReward: MatchRewardSummary | null;
  cheerTimer: number;
  onlineRoomCode: string | null;
  onlineLocalSlot: 0 | 1 | null;
  onlineOpponentConnected: boolean;
  onlineRematchVotes: [boolean, boolean];
  onlineCosmetics: [OnlinePlayerCosmetics, OnlinePlayerCosmetics] | null;
  awaitingTossAck: boolean;

  // Stone physics
  stoneX: number;
  stoneY: number;
  stoneZ: number;
  stoneVx: number;
  stoneVy: number;
  stoneVz: number;
  stoneRot: number;
  stoneInHand: boolean;
  stonePlacedSquareId: number | null;
  stoneBounces: number;

  // Player animation & physics
  playerX: number;
  playerY: number;
  playerZ: number;
  playerFacing: number;
  playerStance: 'TWO_FEET' | 'LEFT_FOOT' | 'RIGHT_FOOT' | 'BENDING';
  playerSquashX: number;
  playerSquashY: number;

  // Hopping tween
  hopAnimating: boolean;
  hopFromX: number;
  hopFromY: number;
  hopToX: number;
  hopToY: number;
  hopProgress: number;
  hopDuration: number;
  outSteps: HopStep[];
  backSteps: HopStep[];
  stepCursor: number;
  stepCountTotal: number;
  turnTimer: number;
  phaseTimer: number;

  // Balance
  balance: number;
  balanceSway: number;
  balanceDriftDir: number;

  // Aiming
  aimAngleOffset: number;
  aimPower: number;
  aimChargeDir: 1 | -1;
  isCharging: boolean;
  chargeStartTime: number;
  pointerInside: boolean;

  // Visual juice
  time: number;
  hitstopTimer: number;
  shakeMag: number;
  foulFlashTimer: number;
  foulSquareId: number | null;
  particles: Particle[];
  callouts: FloatingCallout[];

  // Bot AI
  botTimer: number;
  botTargetPower: number;
  botTargetAngle: number;
  botSubPhase: 'AIM' | 'CHARGE' | 'WAIT';

  // Input tracking
  heldKeys: Set<string>;
}

const MAX_PARTICLES = 120;

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

function createEmptyParticles(): Particle[] {
  return Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: 4,
    life: 0,
    maxLife: 0.4,
    color: '#D97706',
    alpha: 0.7,
  }));
}

export const SonkoCanvas = forwardRef<SonkoCanvasHandle, SonkoCanvasProps>(
  function SonkoCanvas(
    {
      equippedStone,
      equippedOutfit,
      equippedStencil,
      avatar,
      previewVenue = 'kampala_murram',
      onHudChange,
      onMatchComplete,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rendererRef = useRef<CourtyardRenderer | null>(null);
    const lastHudPushRef = useRef<number>(0);
    const cosmeticsRef = useRef({
      equippedStone,
      equippedOutfit,
      equippedStencil,
      avatar,
      previewVenue,
    });
    cosmeticsRef.current = {
      equippedStone,
      equippedOutfit,
      equippedStencil,
      avatar,
      previewVenue,
    };
    const onMatchCompleteRef = useRef(onMatchComplete);
    onMatchCompleteRef.current = onMatchComplete;

    const simRef = useRef<SimState>({
      screen: 'TITLE_MENU',
      mode: 'VS_BOT',
      difficulty: 'NORMAL',
      courtSize: 10,
      venue: 'kampala_murram',
      windX: 0,
      puddleSquares: [],
      squares: buildCourtSquares(10),
      houses: {},
      activePlayerIndex: 0,
      players: createInitialPlayers('VS_BOT', equippedOutfit, avatar),
      teamTargets: [1, 1],
      teamScores: [0, 0],
      phase: 'TOSS_AIM',
      turnCount: 1,
      winnerTeamId: null,
      winnerLabel: null,
      winReason: null,
      foulReason: null,
      statusBanner: 'Hold Click or Space — Release inside Square 1',
      lastMatchReward: null,
      cheerTimer: 0,
      onlineRoomCode: null,
      onlineLocalSlot: null,
      onlineOpponentConnected: true,
      onlineRematchVotes: [false, false],
      onlineCosmetics: null,
      awaitingTossAck: false,
      stoneX: 0.5,
      stoneY: 0.94,
      stoneZ: 0,
      stoneVx: 0,
      stoneVy: 0,
      stoneVz: 0,
      stoneRot: 0,
      stoneInHand: true,
      stonePlacedSquareId: null,
      stoneBounces: 0,
      playerX: 0.5,
      playerY: 0.945,
      playerZ: 0,
      playerFacing: -Math.PI / 2,
      playerStance: 'TWO_FEET',
      playerSquashX: 1,
      playerSquashY: 1,
      hopAnimating: false,
      hopFromX: 0.5,
      hopFromY: 0.945,
      hopToX: 0.5,
      hopToY: 0.945,
      hopProgress: 0,
      hopDuration: 0.2,
      outSteps: [],
      backSteps: [],
      stepCursor: 0,
      stepCountTotal: 0,
      turnTimer: 0,
      phaseTimer: 0,
      balance: 100,
      balanceSway: 0,
      balanceDriftDir: 1,
      aimAngleOffset: 0,
      aimPower: 0.14,
      aimChargeDir: 1,
      isCharging: false,
      chargeStartTime: 0,
      pointerInside: false,
      time: 0,
      hitstopTimer: 0,
      shakeMag: 0,
      foulFlashTimer: 0,
      foulSquareId: null,
      particles: createEmptyParticles(),
      callouts: [],
      botTimer: 0,
      botTargetPower: 0.25,
      botTargetAngle: 0,
      botSubPhase: 'AIM',
      heldKeys: new Set<string>(),
    });

    const pushHud = (force = false) => {
      const now = performance.now();
      if (!force && now - lastHudPushRef.current < 90) return;
      lastHudPushRef.current = now;
      const s = simRef.current;
      const derivedWeather =
        s.puddleSquares.length > 0 || s.venue === 'jinja_rain'
          ? 'storm_shower'
          : Math.abs(s.windX) > 0.025
            ? 'breezy'
            : resolveWeatherFromPeriodAndVenue('auto', s.venue);
      onHudChange({
        screen: s.screen,
        mode: s.mode,
        difficulty: s.difficulty,
        courtSize: s.courtSize,
        venue: s.venue,
        windX: s.windX,
        puddleSquares: s.puddleSquares,
        weatherCondition: derivedWeather,
        weatherMode: 'auto',
        weatherLabel: WEATHER_SPECS[derivedWeather].label,
        activePlayerIndex: s.activePlayerIndex,
        players: s.players.map((pl) => ({ ...pl })),
        teamScores: [s.teamScores[0], s.teamScores[1]],
        teamTargets: [s.teamTargets[0], s.teamTargets[1]],
        phase: s.phase,
        balance: Math.round(s.balance),
        balanceSway: Number(s.balanceSway.toFixed(3)),
        isBalancingOneFoot:
          s.screen === 'PLAYING' &&
          s.playerStance !== 'TWO_FEET' &&
          !s.hopAnimating &&
          (s.phase === 'HOP_OUT' ||
            s.phase === 'HOP_BACK' ||
            s.phase === 'PICKUP_STONE' ||
            s.phase === 'HOP_EXIT'),
        hopNextStepLabel:
          s.phase === 'PICKUP_STONE'
            ? 'Scoop'
            : s.phase === 'HOP_EXIT'
              ? 'Leap'
              : s.phase === 'HOP_OUT' || s.phase === 'HOP_BACK'
                ? 'Hop'
                : null,
        aimPower: s.aimPower,
        isCharging: s.isCharging,
        statusBanner: s.statusBanner,
        foulReason: s.foulReason,
        winnerTeamId: s.winnerTeamId,
        winnerLabel: s.winnerLabel,
        winReason: s.winReason,
        houses: { ...s.houses },
        turnCount: s.turnCount,
        lastMatchReward: s.lastMatchReward,
        onlineRoomCode: s.onlineRoomCode,
        onlineLocalSlot: s.onlineLocalSlot,
        onlineOpponentConnected: s.onlineOpponentConnected,
        onlineRematchVotes: s.onlineRematchVotes,
      });
    };

    const isLocalInputLocked = (s: SimState): boolean => {
      if (s.screen !== 'PLAYING') return true;
      const p = s.players[s.activePlayerIndex];
      if (!p || p.isBot) return true;
      if (s.mode === 'ONLINE_1V1' && s.activePlayerIndex !== s.onlineLocalSlot) return true;
      return false;
    };

    const spawnDust = (nx: number, ny: number, count: number, color = '#D68C6B') => {
      const particles = simRef.current.particles;
      let spawned = 0;
      for (let i = 0; i < particles.length && spawned < count; i++) {
        if (!particles[i].active) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.04 + Math.random() * 0.11;
          particles[i].active = true;
          particles[i].x = nx;
          particles[i].y = ny;
          particles[i].vx = Math.cos(angle) * speed;
          particles[i].vy = Math.sin(angle) * speed;
          particles[i].size = 3 + Math.random() * 4.5;
          particles[i].life = 0;
          particles[i].maxLife = 0.28 + Math.random() * 0.24;
          particles[i].color = color;
          particles[i].alpha = 0.72;
          spawned++;
        }
      }
    };

    const addCallout = (text: string, nx: number, ny: number, color = '#FEF08A') => {
      simRef.current.callouts.push({
        text,
        x: nx,
        y: ny,
        life: 0,
        maxLife: 1.05,
        color,
      });
    };

    const computePredictedLanding = (s: SimState): { x: number; y: number } => {
      // Throw originates from baseline (0.5, 0.945) upward into court (-PI/2)
      const dist = 0.08 + s.aimPower * 0.82;
      const angle = -Math.PI / 2 + s.aimAngleOffset;
      return {
        x: s.playerX + Math.cos(angle) * dist * 0.65,
        y: s.playerY + Math.sin(angle) * dist,
      };
    };

    const resetTurnToBaseline = (s: SimState, phase: TurnPhase) => {
      const p = s.players[s.activePlayerIndex];
      s.phase = phase;
      s.playerX = 0.5;
      s.playerY = 0.945;
      s.playerZ = 0;
      s.playerFacing = phase === 'CLAIM_AIM' ? Math.PI / 2 : -Math.PI / 2;
      s.playerStance = 'TWO_FEET';
      s.playerSquashX = 1;
      s.playerSquashY = 1;
      s.hopAnimating = false;
      s.stoneInHand = true;
      s.stonePlacedSquareId = null;
      s.stoneX = 0.5;
      s.stoneY = 0.945;
      s.stoneZ = 0;
      s.balance = 100;
      s.balanceSway = 0;
      s.aimAngleOffset = 0;
      s.aimPower = 0.12;
      s.aimChargeDir = 1;
      s.isCharging = false;
      s.foulReason = null;

      if (s.mode !== 'ONLINE_1V1') {
        if (s.venue === 'entebbe_sand') {
          const dir = Math.random() > 0.5 ? 1 : -1;
          s.windX = dir * (0.045 + Math.random() * 0.08);
        } else {
          s.windX = 0;
        }
      }
      s.awaitingTossAck = false;

      if (phase === 'CLAIM_AIM') {
        if (p.isBot) {
          s.statusBanner = `${p.name} tosses over the shoulder for a House...`;
          s.botTargetPower = 0.22 + Math.random() * 0.52;
          s.botTargetAngle = (Math.random() - 0.5) * 0.28;
          s.botTimer = 0.5;
          s.botSubPhase = 'AIM';
        } else if (s.mode === 'ONLINE_1V1' && s.activePlayerIndex !== s.onlineLocalSlot) {
          s.statusBanner = `${p.name} aims over the shoulder for a House...`;
        } else {
          s.statusBanner = `${p.name}: Bonus! Hold Click or Space to toss blind for a House`;
        }
      } else if (p.isBot) {
        s.statusBanner = `${p.name} is aiming for Square ${p.targetSquare}...`;
        // Configure Bot AI toss parameters (mildly compensate for Lake Breeze on Hard)
        const targetSq = s.squares.find((sq) => sq.id === p.targetSquare);
        const center = targetSq ? getSquareCenter(targetSq) : { x: 0.5, y: 0.5 };
        const errScale =
          s.difficulty === 'EASY' ? 0.075 : s.difficulty === 'NORMAL' ? 0.036 : 0.018;
        const windCompFactor = s.difficulty === 'HARD' ? 0.9 : s.difficulty === 'NORMAL' ? 0.55 : 0.2;
        const windDriftEst = s.windX * 0.56 * windCompFactor;
        const dx = center.x - windDriftEst - 0.5 + (Math.random() - 0.5) * errScale;
        const dy = center.y - 0.945 + (Math.random() - 0.5) * errScale;
        const neededDist = Math.abs(dy);
        s.botTargetPower = Math.max(0.08, Math.min(0.98, (neededDist - 0.08) / 0.82));
        s.botTargetAngle = Math.atan2(dx / 0.65, Math.abs(dy));
        s.botTimer = 0.55;
        s.botSubPhase = 'AIM';
      } else if (s.mode === 'ONLINE_1V1' && s.activePlayerIndex !== s.onlineLocalSlot) {
        s.statusBanner = `Waiting for ${p.name} to toss into Square ${p.targetSquare}...`;
      } else {
        s.statusBanner = `${p.name}: Aim & hold Click or Space — release inside Square ${p.targetSquare}`;
      }
    };

    const advanceToNextPlayer = (s: SimState) => {
      if (s.mode === 'ONLINE_1V1') return;
      if (s.players.length > 1) {
        s.activePlayerIndex = (s.activePlayerIndex + 1) % s.players.length;
      }
      s.turnCount += 1;
      resetTurnToBaseline(s, 'TOSS_AIM');
      pushHud(true);
    };

    const triggerFoul = (s: SimState, reason: string, squareId: number | null = null) => {
      const p = s.players[s.activePlayerIndex];
      p.fouls += 1;
      p.streak = 0;
      s.phase = 'FOUL_RECOVERY';
      s.foulReason = reason;
      s.foulSquareId = squareId;
      s.foulFlashTimer = 0.9;
      s.phaseTimer = 1.25;
      s.hitstopTimer = 0.045;
      s.shakeMag = 7;
      s.statusBanner = `${p.name} fouled: ${reason}`;
      sonkoAudio.playFoul();
      addCallout(reason.toUpperCase(), s.playerX, Math.max(0.18, s.playerY - 0.07), '#FCA5A5');
      if (s.mode === 'ONLINE_1V1' && s.activePlayerIndex === s.onlineLocalSlot) {
        sonkoOnline.sendTurnEnd('FOUL', reason);
      }
      pushHud(true);
    };

    const launchStoneWithCoords = (
      s: SimState,
      isClaim: boolean,
      targetX: number,
      targetY: number
    ) => {
      const flightTime = 0.56;
      s.stoneInHand = false;
      s.stoneX = s.playerX;
      s.stoneY = s.playerY;
      s.stoneZ = 0.08;
      s.stoneVx = (targetX - s.playerX) / flightTime;
      s.stoneVy = (targetY - s.playerY) / flightTime;
      const gravity = 2.6;
      s.stoneVz = (0.5 * gravity * flightTime * flightTime - 0.08) / flightTime;
      s.stoneBounces = 0;
      s.isCharging = false;
      s.awaitingTossAck = false;
      s.phase = isClaim ? 'CLAIM_FLIGHT' : 'STONE_FLIGHT';
      sonkoAudio.playToss();
      pushHud(true);
    };

    const launchStoneThrow = (s: SimState, isClaim: boolean) => {
      if (s.mode === 'ONLINE_1V1') {
        if (s.awaitingTossAck || s.activePlayerIndex !== s.onlineLocalSlot) return;
        s.awaitingTossAck = true;
        s.isCharging = false;
        sonkoOnline.sendToss(s.aimAngleOffset, s.aimPower, isClaim);
        return;
      }
      const landing = computePredictedLanding(s);
      const jitter = isClaim ? 0.04 : s.difficulty === 'HARD' ? 0.012 : 0.005;
      const targetX = landing.x + (Math.random() - 0.5) * jitter;
      const targetY = landing.y + (Math.random() - 0.5) * jitter;
      launchStoneWithCoords(s, isClaim, targetX, targetY);
    };

    const beginHopStep = (s: SimState, step: HopStep) => {
      const sqs = step.squares
        .map((id) => s.squares.find((sq) => sq.id === id))
        .filter((sq): sq is CourtSquare => Boolean(sq));
      if (sqs.length === 0) return;

      // Average center of 1 or 2 squares
      const avgX = sqs.reduce((acc, sq) => acc + sq.x + sq.w / 2, 0) / sqs.length;
      const avgY = sqs.reduce((acc, sq) => acc + sq.y + sq.h / 2, 0) / sqs.length;

      s.hopAnimating = true;
      s.hopFromX = s.playerX;
      s.hopFromY = s.playerY;
      s.hopToX = avgX;
      s.hopToY = avgY;
      s.hopProgress = 0;
      s.hopDuration = 0.21;
      s.playerSquashX = 0.84;
      s.playerSquashY = 1.18;
      s.playerFacing = step.leg === 'OUT' ? -Math.PI / 2 : Math.PI / 2;

      if (step.stance === 'TWO_FEET' || step.stance === 'HOUSE_REST') {
        s.playerStance = 'TWO_FEET';
      } else {
        s.playerStance = s.stepCountTotal % 2 === 0 ? 'LEFT_FOOT' : 'RIGHT_FOOT';
      }
      s.stepCountTotal += 1;
      sonkoAudio.playHop(step.stance !== 'ONE_FOOT', s.stepCountTotal);
    };

    const getCurrentNextStep = (s: SimState): HopStep | null => {
      if (s.phase === 'HOP_OUT') {
        return s.outSteps[s.stepCursor] ?? null;
      }
      if (s.phase === 'HOP_BACK') {
        return s.backSteps[s.stepCursor] ?? null;
      }
      return null;
    };

    const advanceHopAction = (s: SimState, fromRemote = false) => {
      if (s.hopAnimating) {
        if (!fromRemote) return;
        // Snap active remote hop to finish cleanly before starting next relayed hop
        s.hopAnimating = false;
        s.playerX = s.hopToX;
        s.playerY = s.hopToY;
        s.playerZ = 0;
      }

      if (s.phase === 'HOP_OUT') {
        const next = s.outSteps[s.stepCursor];
        if (next) {
          if (s.mode === 'ONLINE_1V1' && !fromRemote && s.activePlayerIndex === s.onlineLocalSlot) {
            sonkoOnline.sendHop();
          }
          beginHopStep(s, next);
          return;
        }
      } else if (s.phase === 'HOP_BACK') {
        const next = s.backSteps[s.stepCursor];
        if (next) {
          if (s.mode === 'ONLINE_1V1' && !fromRemote && s.activePlayerIndex === s.onlineLocalSlot) {
            sonkoOnline.sendHop();
          }
          beginHopStep(s, next);
          return;
        }
      } else if (s.phase === 'HOP_EXIT') {
        if (s.mode === 'ONLINE_1V1' && !fromRemote && s.activePlayerIndex === s.onlineLocalSlot) {
          sonkoOnline.sendHop();
        }
        // Leap past Square 1 back to baseline!
        s.hopAnimating = true;
        s.hopFromX = s.playerX;
        s.hopFromY = s.playerY;
        s.hopToX = 0.5;
        s.hopToY = 0.945;
        s.hopProgress = 0;
        s.hopDuration = 0.24;
        s.playerSquashX = 0.82;
        s.playerSquashY = 1.2;
        s.playerStance = 'TWO_FEET';
        sonkoAudio.playHop(true, s.stepCountTotal + 1);
      } else if (s.phase === 'PICKUP_STONE') {
        if (s.mode === 'ONLINE_1V1' && !fromRemote && s.activePlayerIndex === s.onlineLocalSlot) {
          sonkoOnline.sendPickup();
        }
        // Scoop up the stone!
        s.playerStance = 'BENDING';
        s.stoneInHand = true;
        s.stonePlacedSquareId = null;
        s.balance = Math.min(100, s.balance + 18);
        s.players[s.activePlayerIndex].score += 40;
        s.teamScores[s.players[s.activePlayerIndex].teamId] += 40;
        sonkoAudio.playPickup();
        spawnDust(s.stoneX, s.stoneY, 8, '#FDE047');
        addCallout('STONE SCOOPED +40', s.playerX, s.playerY - 0.05, '#FEF08A');

        const p = s.players[s.activePlayerIndex];
        const remoteTurn = s.mode === 'ONLINE_1V1' && s.activePlayerIndex !== s.onlineLocalSlot;
        if (s.stepCursor < s.backSteps.length) {
          s.phase = 'HOP_BACK';
          s.statusBanner = p.isBot || remoteTurn
            ? `${p.name} scooped the stone and hops back!`
            : 'Hop back to the baseline! (Space / S / Click tile)';
        } else {
          s.phase = 'HOP_EXIT';
          s.statusBanner = p.isBot || remoteTurn
            ? `${p.name} leaps out to finish!`
            : 'Final leap to baseline! (Space / S / Click baseline)';
        }
        pushHud(true);
      }
    };

    const finalizeMatch = (s: SimState, winnerTeamId: 0 | 1, winnerLabel: string, reason: string) => {
      s.winnerTeamId = winnerTeamId;
      s.winnerLabel = winnerLabel;
      s.winReason = reason;
      const localSlot = s.mode === 'ONLINE_1V1' ? (s.onlineLocalSlot ?? 0) : 0;
      const team0Players = s.players.filter((pl) => pl.teamId === localSlot);
      const primaryHuman = s.players[localSlot] ?? s.players[0];
      const aggregatedHuman: PlayerState = {
        ...primaryHuman,
        score: s.teamScores[localSlot],
        roundsCleared: team0Players.reduce((sum, pl) => sum + pl.roundsCleared, 0),
        perfectTosses: team0Players.reduce((sum, pl) => sum + pl.perfectTosses, 0),
        housesOwned: team0Players.flatMap((pl) => pl.housesOwned),
      };
      const won = winnerTeamId === localSlot;
      const reward = computeMatchRewards(aggregatedHuman, won, s.mode, s.difficulty, s.venue);
      s.lastMatchReward = reward;
      s.screen = 'GAME_OVER';
      sonkoAudio.playVictory();
      onMatchCompleteRef.current?.(reward, won, aggregatedHuman, s.venue);
      pushHud(true);
    };

    const completeRoundForActivePlayer = (s: SimState) => {
      const p = s.players[s.activePlayerIndex];
      const teamId = p.teamId;
      p.roundsCleared += 1;
      p.streak += 1;
      p.bestStreak = Math.max(p.bestStreak, p.streak);
      const pts = 100 + p.streak * 25;
      p.score += pts;
      s.teamScores[teamId] += pts;
      s.cheerTimer = 1.6;
      addCallout(`SQUARE ${p.targetSquare} CLEARED!`, 0.5, 0.72, '#86EFAC');

      if (s.mode === 'ONLINE_1V1') {
        s.phase = 'ROUND_CLEAR';
        s.phaseTimer = 999; // Waits for authoritative server game:turn_advance / claim_phase / game:over
        s.statusBanner = `${p.name} cleared Square ${p.targetSquare}!`;
        sonkoAudio.playRoundClear();
        if (s.activePlayerIndex === s.onlineLocalSlot) {
          sonkoOnline.sendTurnEnd('ROUND_CLEAR');
        }
        pushHud(true);
        return;
      }

      const midHouseTrigger = s.courtSize === 10 ? 5 : 3;
      const earnedMidHouse = p.targetSquare === midHouseTrigger;
      const finishedCourse = p.targetSquare >= s.courtSize;

      if (finishedCourse) {
        p.cyclesCompleted += 1;
        p.score += 250;
        s.teamScores[teamId] += 250;
        if (s.mode === 'SOLO') {
          s.phase = 'ROUND_CLEAR';
          s.phaseTimer = 0.85;
          s.statusBanner = `Cycle Complete! Claim your Victory House!`;
          sonkoAudio.playVictory();
          pushHud(true);
          return;
        } else {
          const label =
            s.mode === 'TEAM_2V2'
              ? teamId === 0
                ? 'Team Cranes Win!'
                : 'Team Waves Win!'
              : `${p.name} Wins!`;
          finalizeMatch(s, teamId, label, `${p.name} conquered Square ${s.courtSize}!`);
          return;
        }
      }

      const nextTarget = p.targetSquare + 1;
      s.teamTargets[teamId] = nextTarget;
      for (const mate of s.players) {
        if (mate.teamId === teamId) {
          mate.targetSquare = nextTarget;
        }
      }

      if (earnedMidHouse) {
        s.phase = 'ROUND_CLEAR';
        s.phaseTimer = 0.85;
        s.statusBanner = `${p.name} unlocked a Mid-Court House Toss!`;
        sonkoAudio.playRoundClear();
        pushHud(true);
        return;
      }

      s.phase = 'ROUND_CLEAR';
      s.phaseTimer = 0.8;
      s.statusBanner = `Square cleared! Next target: Square ${nextTarget}`;
      sonkoAudio.playRoundClear();
      pushHud(true);
    };

    const syncSimFromOnlineRoom = (s: SimState, room: OnlineRoomState) => {
      s.courtSize = room.courtSize;
      s.venue = room.venue;
      s.windX = room.windX;
      s.puddleSquares = room.puddleSquares;
      s.houses = { ...room.houses };
      s.activePlayerIndex = room.activeSlot;
      s.turnCount = room.turnCount;
      s.onlineRoomCode = room.code;
      s.onlineRematchVotes = room.rematchVotes;
      const otherSlot = (s.onlineLocalSlot ?? 0) === 0 ? 1 : 0;
      s.onlineOpponentConnected = Boolean(room.players[otherSlot]?.connected);

      const p0 = room.players[0];
      const p1 = room.players[1];
      if (p0 && p1) {
        const outfit0 = getOutfitSpec(p0.cosmetics.outfitId);
        const outfit1 = getOutfitSpec(p1.cosmetics.outfitId);
        s.onlineCosmetics = [p0.cosmetics, p1.cosmetics];
        s.teamScores = [p0.score, p1.score];
        s.teamTargets = [p0.targetSquare, p1.targetSquare];
        s.players = [
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
    };

    const startOnlineMatchInternal = (room: OnlineRoomState, localSlot: 0 | 1) => {
      const s = simRef.current;
      s.mode = 'ONLINE_1V1';
      s.difficulty = 'NORMAL';
      s.onlineLocalSlot = localSlot;
      s.squares = buildCourtSquares(room.courtSize);
      syncSimFromOnlineRoom(s, room);
      s.winnerTeamId = null;
      s.winnerLabel = null;
      s.winReason = null;
      s.foulReason = null;
      s.lastMatchReward = null;
      s.cheerTimer = 0;
      s.foulFlashTimer = 0;
      s.foulSquareId = null;
      s.callouts = [];
      for (const pt of s.particles) pt.active = false;
      s.screen = 'PLAYING';
      resetTurnToBaseline(s, 'TOSS_AIM');
      pushHud(true);
    };

    const startNewGame = (
      mode: PlayMode,
      difficulty: Difficulty,
      courtSize: CourtSize,
      venue: CourtVenueId = 'kampala_murram'
    ) => {
      const s = simRef.current;
      if (s.mode === 'ONLINE_1V1') {
        sonkoOnline.leaveRoom();
      }
      s.mode = mode;
      s.difficulty = difficulty;
      s.courtSize = courtSize;
      s.venue = venue;
      s.onlineRoomCode = null;
      s.onlineLocalSlot = null;
      s.onlineOpponentConnected = true;
      s.onlineCosmetics = null;
      s.puddleSquares =
        venue === 'jinja_rain'
          ? courtSize === 10
            ? [2, 5, 8]
            : [2, 4]
          : [];
      s.squares = buildCourtSquares(courtSize);
      s.houses = {};
      s.activePlayerIndex = 0;
      s.players = createInitialPlayers(
        mode,
        cosmeticsRef.current.equippedOutfit,
        cosmeticsRef.current.avatar
      );
      s.teamTargets = [1, 1];
      s.teamScores = [0, 0];
      s.turnCount = 1;
      s.winnerTeamId = null;
      s.winnerLabel = null;
      s.winReason = null;
      s.foulReason = null;
      s.lastMatchReward = null;
      s.cheerTimer = 0;
      s.foulFlashTimer = 0;
      s.foulSquareId = null;
      s.callouts = [];
      for (const pt of s.particles) pt.active = false;
      s.screen = 'PLAYING';
      resetTurnToBaseline(s, 'TOSS_AIM');
      pushHud(true);
    };

    useImperativeHandle(ref, () => ({
      startGame: startNewGame,
      startOnlineGame: startOnlineMatchInternal,
      pauseGame: () => {
        if (simRef.current.screen === 'PLAYING') {
          simRef.current.screen = 'PAUSED';
          simRef.current.heldKeys.clear();
          simRef.current.isCharging = false;
          pushHud(true);
        }
      },
      resumeGame: () => {
        if (simRef.current.screen === 'PAUSED') {
          simRef.current.screen = 'PLAYING';
          pushHud(true);
        }
      },
      restartGame: () => {
        const s = simRef.current;
        if (s.mode === 'ONLINE_1V1') {
          sonkoOnline.requestRematch();
          return;
        }
        startNewGame(s.mode, s.difficulty, s.courtSize, s.venue);
      },
      returnToTitle: () => {
        const s = simRef.current;
        if (s.mode === 'ONLINE_1V1') {
          sonkoOnline.leaveRoom();
        }
        s.mode = 'VS_BOT';
        s.onlineRoomCode = null;
        s.onlineLocalSlot = null;
        s.onlineCosmetics = null;
        s.screen = 'TITLE_MENU';
        s.houses = {};
        s.squares = buildCourtSquares(s.courtSize);
        s.players = createInitialPlayers(
          'VS_BOT',
          cosmeticsRef.current.equippedOutfit,
          cosmeticsRef.current.avatar
        );
        s.heldKeys.clear();
        resetTurnToBaseline(s, 'TOSS_AIM');
        pushHud(true);
      },
      nudgeBalance: (dir: -1 | 1) => {
        const s = simRef.current;
        if (isLocalInputLocked(s)) return;
        s.balanceSway = Math.max(-1, Math.min(1, s.balanceSway + dir * 0.24));
      },
      triggerAction: () => {
        const s = simRef.current;
        if (isLocalInputLocked(s)) return;
        if (
          s.phase === 'HOP_OUT' ||
          s.phase === 'HOP_BACK' ||
          s.phase === 'PICKUP_STONE' ||
          s.phase === 'HOP_EXIT'
        ) {
          advanceHopAction(s);
        }
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (!rendererRef.current) {
        rendererRef.current = new CourtyardRenderer();
      }

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resize();
      window.addEventListener('resize', resize);

      // Keyboard input handlers
      const onKeyDown = (e: KeyboardEvent) => {
        const s = simRef.current;
        if (e.key === 'Escape') {
          if (s.screen === 'PLAYING') {
            s.screen = 'PAUSED';
            s.heldKeys.clear();
            s.isCharging = false;
            pushHud(true);
          } else if (s.screen === 'PAUSED') {
            s.screen = 'PLAYING';
            pushHud(true);
          }
          return;
        }

        if (isLocalInputLocked(s)) return;

        const code = e.code;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
          e.preventDefault();
        }

        const wasHeld = s.heldKeys.has(code);
        s.heldKeys.add(code);

        if (!wasHeld) {
          if ((code === 'Space' || code === 'Enter') && (s.phase === 'TOSS_AIM' || s.phase === 'CLAIM_AIM')) {
            s.isCharging = true;
            s.aimPower = 0.08;
            s.aimChargeDir = 1;
            s.chargeStartTime = performance.now();
          } else if (
            (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') &&
            s.phase === 'HOP_OUT'
          ) {
            advanceHopAction(s);
          } else if (
            (code === 'Space' || code === 'KeyS' || code === 'ArrowDown') &&
            (s.phase === 'HOP_BACK' || s.phase === 'HOP_EXIT')
          ) {
            advanceHopAction(s);
          } else if (
            (code === 'Space' || code === 'KeyE' || code === 'Enter') &&
            s.phase === 'PICKUP_STONE'
          ) {
            advanceHopAction(s);
          }
        }
      };

      const onKeyUp = (e: KeyboardEvent) => {
        const s = simRef.current;
        const code = e.code;
        s.heldKeys.delete(code);

        if (isLocalInputLocked(s)) return;

        if ((code === 'Space' || code === 'Enter') && s.isCharging) {
          if (s.phase === 'TOSS_AIM' || s.phase === 'CLAIM_AIM') {
            launchStoneThrow(s, s.phase === 'CLAIM_AIM');
          }
        }
      };

      const onBlur = () => {
        const s = simRef.current;
        s.heldKeys.clear();
        s.isCharging = false;
      };

      // Pointer input handlers on 3/4 Perspective Canvas
      const clientToNorm = (clientX: number, clientY: number) => {
        const rect = canvas.getBoundingClientRect();
        const ct = computeCourtTransform(rect.width, rect.height);
        return unprojectCourt(ct, clientX - rect.left, clientY - rect.top);
      };

      const onPointerMove = (e: PointerEvent) => {
        const s = simRef.current;
        if (isLocalInputLocked(s)) return;
        const { nx } = clientToNorm(e.clientX, e.clientY);
        s.pointerInside = true;
        if (s.phase === 'TOSS_AIM' || s.phase === 'CLAIM_AIM') {
          const dx = Math.max(-0.42, Math.min(0.42, nx - 0.5));
          s.aimAngleOffset = dx * 0.95;
          if (s.mode === 'ONLINE_1V1') {
            sonkoOnline.sendAim(s.aimAngleOffset, s.aimPower, s.isCharging);
          }
        }
      };

      const onPointerDown = (e: PointerEvent) => {
        const s = simRef.current;
        if (isLocalInputLocked(s)) return;
        const { nx, ny } = clientToNorm(e.clientX, e.clientY);

        if (s.phase === 'TOSS_AIM' || s.phase === 'CLAIM_AIM') {
          const dx = Math.max(-0.42, Math.min(0.42, nx - 0.5));
          s.aimAngleOffset = dx * 0.95;
          s.isCharging = true;
          s.aimPower = 0.08;
          s.aimChargeDir = 1;
          s.chargeStartTime = performance.now();
          return;
        }

        if (s.phase === 'PICKUP_STONE') {
          advanceHopAction(s);
          return;
        }

        if (s.phase === 'HOP_OUT' || s.phase === 'HOP_BACK' || s.phase === 'HOP_EXIT') {
          const activeTeam = s.players[s.activePlayerIndex].teamId;
          const clickedSq = s.squares.find(
            (sq) => nx >= sq.x && nx <= sq.x + sq.w && ny >= sq.y && ny <= sq.y + sq.h
          );
          if (clickedSq) {
            if (clickedSq.id === s.stonePlacedSquareId) {
              triggerFoul(s, 'Stepped in stone square!', clickedSq.id);
              return;
            }
            const owner = s.houses[clickedSq.id];
            if (owner !== undefined && owner !== activeTeam) {
              triggerFoul(s, "Stepped in rival's House!", clickedSq.id);
              return;
            }
          }

          // Clicking valid square or anywhere else hops forward!
          const targetStep = getCurrentNextStep(s);
          if (targetStep && clickedSq && targetStep.squares.includes(clickedSq.id)) {
            const center = getSquareCenter(clickedSq);
            const offset = (nx - center.x) * 0.6;
            s.balanceSway = Math.max(-0.85, Math.min(0.85, s.balanceSway + offset));
          }
          advanceHopAction(s);
        }
      };

      const onPointerUp = () => {
        const s = simRef.current;
        if (isLocalInputLocked(s)) return;
        if (s.isCharging && (s.phase === 'TOSS_AIM' || s.phase === 'CLAIM_AIM')) {
          const heldMs = performance.now() - s.chargeStartTime;
          if (heldMs < 110) {
            s.isCharging = false;
            s.aimPower = 0.12;
            s.statusBanner = `Hold Click or Space briefly, then release inside Square ${s.players[s.activePlayerIndex].targetSquare}!`;
            pushHud(true);
            return;
          }
          launchStoneThrow(s, s.phase === 'CLAIM_AIM');
        }
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointerup', onPointerUp);

      let rafId = 0;
      let lastTime = performance.now();

      const tick = (now: number) => {
        const rawDt = (now - lastTime) / 1000;
        lastTime = now;
        const dt = Math.min(rawDt, 0.05);
        const s = simRef.current;
        s.time += dt;

        // Decay camera shake & foul flash
        s.shakeMag *= Math.pow(0.0005, dt);
        if (s.shakeMag < 0.1) s.shakeMag = 0;
        if (s.foulFlashTimer > 0) {
          s.foulFlashTimer = Math.max(0, s.foulFlashTimer - dt);
        }

        // Update particles
        for (const p of s.particles) {
          if (!p.active) continue;
          p.life += dt;
          if (p.life >= p.maxLife) {
            p.active = false;
          } else {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.92;
            p.vy *= 0.92;
          }
        }

        // Update floating callouts
        for (let i = s.callouts.length - 1; i >= 0; i--) {
          s.callouts[i].life += dt;
          if (s.callouts[i].life >= s.callouts[i].maxLife) {
            s.callouts.splice(i, 1);
          }
        }

        if (s.cheerTimer > 0) {
          s.cheerTimer = Math.max(0, s.cheerTimer - dt);
        }

        // Recover squash-stretch smoothly
        s.playerSquashX += (1 - s.playerSquashX) * Math.min(1, dt * 14);
        s.playerSquashY += (1 - s.playerSquashY) * Math.min(1, dt * 14);

        if (s.screen === 'PLAYING') {
          if (s.hitstopTimer > 0) {
            s.hitstopTimer = Math.max(0, s.hitstopTimer - dt);
          } else {
            updatePlayingSimulation(s, dt);
          }
        }

        // Render frame
        const cssW = window.innerWidth;
        const cssH = window.innerHeight;
        const shakeX = s.shakeMag > 0 ? (Math.random() - 0.5) * 2 * s.shakeMag : 0;
        const shakeY = s.shakeMag > 0 ? (Math.random() - 0.5) * 2 * s.shakeMag : 0;
        const predicted = computePredictedLanding(s);

        const p1Avatar = cosmeticsRef.current.avatar;
        const curPlayer = s.players[s.activePlayerIndex] ?? s.players[0];

        let activeStoneSpec =
          curPlayer.teamId === 0
            ? getStoneSpec(cosmeticsRef.current.equippedStone)
            : getStoneSpec('river_pebble');
        let team0Color = p1Avatar.primaryColor;
        let team0Accent = p1Avatar.accentColor;
        let team1Color = '#B91C1C';
        let team1Accent = '#FDE047';
        let stencil0 = cosmeticsRef.current.equippedStencil;
        let stencil1: StencilId = 'basket_weave';

        if (s.mode === 'ONLINE_1V1' && s.onlineCosmetics) {
          const o0 = getOutfitSpec(s.onlineCosmetics[0].outfitId);
          const o1 = getOutfitSpec(s.onlineCosmetics[1].outfitId);
          team0Color = s.onlineCosmetics[0].primaryColor ?? o0.primaryColor;
          team0Accent = s.onlineCosmetics[0].accentColor ?? o0.accentColor;
          team1Color = s.onlineCosmetics[1].primaryColor ?? o1.primaryColor;
          team1Accent = s.onlineCosmetics[1].accentColor ?? o1.accentColor;
          stencil0 = s.onlineCosmetics[0].stencilId;
          stencil1 = s.onlineCosmetics[1].stencilId;
          activeStoneSpec = getStoneSpec(s.onlineCosmetics[curPlayer.teamId].stoneId);
        }

        const sidelineCharacters: SidelineCharacter[] = [];
        let leftSlot = 0;
        let rightSlot = 0;
        s.players.forEach((pl, idx) => {
          if (idx === s.activePlayerIndex) return;
          const isTeam0 = pl.teamId === 0;
          const slot = isTeam0 ? leftSlot++ : rightSlot++;
          sidelineCharacters.push({
            id: pl.id,
            teamId: pl.teamId,
            name: pl.name,
            hairStyle:
              pl.id === 0 && s.mode !== 'ONLINE_1V1' ? p1Avatar.hairStyle : pl.hairStyle,
            skinTone: pl.skinTone,
            primaryColor: isTeam0 ? team0Color : team1Color,
            accentColor: isTeam0 ? team0Accent : team1Accent,
            nx: isTeam0 ? -0.06 - slot * 0.14 : 1.06 + slot * 0.14,
            ny: 0.87 + slot * 0.05,
            cheering: s.cheerTimer > 0 && pl.teamId === curPlayer.teamId,
          });
        });

        const activeVenue = s.screen === 'TITLE_MENU' ? cosmeticsRef.current.previewVenue : s.venue;
        const activeHairStyle =
          curPlayer.id === 0 && s.mode !== 'ONLINE_1V1' ? p1Avatar.hairStyle : curPlayer.hairStyle;
        const renderState: RenderState = {
          time: s.time,
          venue: activeVenue,
          windX: s.windX,
          puddleSquares: s.puddleSquares,
          squares: s.squares,
          houses: s.houses,
          activePlayerIndex: s.activePlayerIndex,
          activeTeamId: curPlayer.teamId,
          activeHairStyle,
          activeSkinTone: curPlayer.skinTone,
          playerColors: [team0Color, team1Color],
          playerAccents: [team0Accent, team1Accent],
          playerNames: [s.players[0]?.name ?? 'Player 1', s.players[1]?.name ?? 'Rival'],
          playerStencils: [stencil0, stencil1],
          activeStoneSpec,
          sidelineCharacters,
          phase: s.phase,
          targetSquareId: curPlayer.targetSquare,
          stoneX: s.stoneX,
          stoneY: s.stoneY,
          stoneZ: s.stoneZ,
          stoneRot: s.stoneRot,
          stoneInHand: s.stoneInHand,
          stonePlacedSquareId: s.stonePlacedSquareId,
          playerX: s.playerX,
          playerY: s.playerY,
          playerZ: s.playerZ,
          playerFacing: s.playerFacing,
          playerStance: s.playerStance,
          playerSquashX: s.playerSquashX,
          playerSquashY: s.playerSquashY,
          balance: s.balance,
          balanceSway: s.balanceSway,
          aimAngleOffset: s.aimAngleOffset,
          aimPower: s.aimPower,
          isCharging: s.isCharging,
          predictedLandX: predicted.x,
          predictedLandY: predicted.y,
          nextStep: getCurrentNextStep(s),
          foulFlashTimer: s.foulFlashTimer,
          foulSquareId: s.foulSquareId,
          shakeX,
          shakeY,
          particles: s.particles,
          callouts: s.callouts,
        };

        rendererRef.current?.render(ctx, cssW, cssH, renderState);
        rafId = requestAnimationFrame(tick);
      };

      const updatePlayingSimulation = (s: SimState, dt: number) => {
        const activePlayer = s.players[s.activePlayerIndex];

        // 1. Aiming & Charging
        if (s.phase === 'TOSS_AIM' || s.phase === 'CLAIM_AIM') {
          if (activePlayer.isBot) {
            s.botTimer -= dt;
            if (s.botSubPhase === 'AIM') {
              s.aimAngleOffset += (s.botTargetAngle - s.aimAngleOffset) * Math.min(1, dt * 6);
              if (s.botTimer <= 0) {
                s.botSubPhase = 'CHARGE';
                s.isCharging = true;
                s.aimPower = 0.08;
              }
            } else if (s.botSubPhase === 'CHARGE') {
              s.aimPower += dt * 0.72;
              if (s.aimPower >= s.botTargetPower) {
                s.aimPower = s.botTargetPower;
                launchStoneThrow(s, s.phase === 'CLAIM_AIM');
              }
            }
          } else if (s.mode === 'ONLINE_1V1' && s.activePlayerIndex !== s.onlineLocalSlot) {
            // Remote player aim is driven by remote:aim messages
            return;
          } else {
            // Keyboard steering
            if (s.heldKeys.has('ArrowLeft') || s.heldKeys.has('KeyA')) {
              s.aimAngleOffset = Math.max(-0.42, s.aimAngleOffset - dt * 0.75);
            }
            if (s.heldKeys.has('ArrowRight') || s.heldKeys.has('KeyD')) {
              s.aimAngleOffset = Math.min(0.42, s.aimAngleOffset + dt * 0.75);
            }
            if (s.isCharging) {
              const speed = 0.72;
              s.aimPower += s.aimChargeDir * speed * dt;
              if (s.aimPower >= 1) {
                s.aimPower = 1;
                s.aimChargeDir = -1;
              } else if (s.aimPower <= 0.06) {
                s.aimPower = 0.06;
                s.aimChargeDir = 1;
              }
            } else if (s.phase === 'CLAIM_AIM') {
              // Gentle blind oscillation for over-the-shoulder house claim!
              s.aimAngleOffset = Math.sin(s.time * 2.1) * 0.24;
            }
            if (s.mode === 'ONLINE_1V1' && s.activePlayerIndex === s.onlineLocalSlot) {
              sonkoOnline.sendAim(s.aimAngleOffset, s.aimPower, s.isCharging);
            }
            pushHud(false);
          }
          return;
        }

        // 2. Stone Flight Physics (with Lake Victoria wind & surface-specific bounces)
        if (s.phase === 'STONE_FLIGHT' || s.phase === 'CLAIM_FLIGHT') {
          const gravity = 2.6;
          if (s.venue === 'entebbe_sand' && s.stoneBounces === 0) {
            s.stoneVx += s.windX * dt * 1.45;
          }
          s.stoneX += s.stoneVx * dt;
          s.stoneY += s.stoneVy * dt;
          s.stoneZ += s.stoneVz * dt;
          s.stoneVz -= gravity * dt;
          s.stoneRot += dt * 7.5;

          if (s.stoneZ <= 0) {
            s.stoneZ = 0;
            s.stoneBounces += 1;
            if (s.stoneBounces === 1) {
              const hitSq = s.squares.find(
                (sq) =>
                  s.stoneX >= sq.x &&
                  s.stoneX <= sq.x + sq.w &&
                  s.stoneY >= sq.y &&
                  s.stoneY <= sq.y + sq.h
              );
              const inPuddle = hitSq !== undefined && s.puddleSquares.includes(hitSq.id);

              if (inPuddle) {
                sonkoAudio.playSplash();
                spawnDust(s.stoneX, s.stoneY, 14, '#93C5FD');
                // Wet puddle causes a low slick skid!
                s.stoneVz = 0.2;
                s.stoneVx *= 0.34;
                s.stoneVy *= 0.38;
              } else if (s.venue === 'entebbe_sand') {
                sonkoAudio.playStoneBounce(0.65);
                spawnDust(s.stoneX, s.stoneY, 11, '#FDE68A');
                // Soft shoreline sand absorbs bounce!
                s.stoneVz = 0.16;
                s.stoneVx *= 0.08;
                s.stoneVy *= 0.08;
              } else {
                sonkoAudio.playStoneBounce(1);
                const dustCol =
                  activePlayer.teamId === 0
                    ? getStoneSpec(cosmeticsRef.current.equippedStone).dustColor
                    : '#D68C6B';
                spawnDust(s.stoneX, s.stoneY, 10, dustCol);
                s.stoneVz = 0.34;
                s.stoneVx *= 0.22;
                s.stoneVy *= 0.22;
              }
            } else {
              // Stone settled!
              s.stoneVx = 0;
              s.stoneVy = 0;
              s.stoneVz = 0;

              const lineTol = s.venue === 'ndere_night' ? 0.019 : 0.016;

              if (s.phase === 'CLAIM_FLIGHT') {
                const res = evaluateClaimLanding(s.squares, s.houses, s.stoneX, s.stoneY, lineTol);
                if (res.status === 'CLAIMED' && res.squareId !== null) {
                  s.houses[res.squareId] = activePlayer.teamId;
                  activePlayer.housesOwned.push(res.squareId);
                  activePlayer.score += 180;
                  s.teamScores[activePlayer.teamId] += 180;
                  s.cheerTimer = 1.6;
                  sonkoAudio.playHouseClaim();
                  spawnDust(s.stoneX, s.stoneY, 18, '#86EFAC');
                  addCallout(`EKIZIMBE! HOUSE ${res.squareId}`, s.stoneX, s.stoneY - 0.04, '#86EFAC');
                  s.statusBanner = `${activePlayer.name} claimed Square ${res.squareId} as a House!`;
                  if (s.mode === 'ONLINE_1V1' && s.activePlayerIndex === s.onlineLocalSlot) {
                    sonkoOnline.sendTossResult('CLAIM_SUCCESS', res.squareId);
                  }
                } else {
                  sonkoAudio.playFoul();
                  addCallout('NO HOUSE CLAIMED', s.stoneX, s.stoneY - 0.04, '#FCA5A5');
                  s.statusBanner = `No House claimed (${res.status.replace('_', ' ').toLowerCase()})`;
                }

                // Check if Solo cycle just completed!
                if (s.mode === 'SOLO' && activePlayer.cyclesCompleted >= 1 && activePlayer.targetSquare >= s.courtSize) {
                  finalizeMatch(s, 0, 'You Win!', `You mastered all ${s.courtSize} squares of Sonko!`);
                  return;
                }

                if (s.mode === 'ONLINE_1V1') {
                  s.phase = 'ROUND_CLEAR';
                  s.phaseTimer = 999;
                  if (s.activePlayerIndex === s.onlineLocalSlot) {
                    sonkoOnline.sendTurnEnd('CLAIM_COMPLETE');
                  }
                  pushHud(true);
                  return;
                }

                s.phase = 'ROUND_CLEAR';
                s.phaseTimer = 1.05;
                pushHud(true);
                return;
              }

              // Regular round toss evaluation
              const evalRes = evaluateStoneLanding(
                s.squares,
                s.stoneX,
                s.stoneY,
                activePlayer.targetSquare,
                lineTol
              );

              if (evalRes.status === 'CLEAN' || evalRes.status === 'BULLSEYE') {
                s.stonePlacedSquareId = activePlayer.targetSquare;
                const isBullseye = evalRes.status === 'BULLSEYE';
                if (isBullseye) {
                  activePlayer.perfectTosses += 1;
                  activePlayer.score += 60;
                  s.teamScores[activePlayer.teamId] += 60;
                  addCallout('BULLSEYE +60', s.stoneX, s.stoneY - 0.04, '#FDE047');
                  if (s.mode === 'ONLINE_1V1' && s.activePlayerIndex === s.onlineLocalSlot) {
                    sonkoOnline.sendTossResult('BULLSEYE');
                  }
                } else {
                  activePlayer.score += 25;
                  s.teamScores[activePlayer.teamId] += 25;
                  addCallout('CLEAN TOSS +25', s.stoneX, s.stoneY - 0.04, '#FEF08A');
                  if (s.mode === 'ONLINE_1V1' && s.activePlayerIndex === s.onlineLocalSlot) {
                    sonkoOnline.sendTossResult('CLEAN');
                  }
                }
                sonkoAudio.playTossSuccess(isBullseye);

                // Build hop sequence using teamId so teammates share Houses!
                const seq = buildHopSequence(
                  s.squares,
                  activePlayer.targetSquare,
                  s.houses,
                  activePlayer.teamId
                );
                s.outSteps = seq.outSteps;
                s.backSteps = seq.backSteps;
                s.stepCursor = 0;
                s.stepCountTotal = 0;
                s.phase = 'HOP_OUT';
                s.botTimer = 0.45;
                const remoteTurn = s.mode === 'ONLINE_1V1' && s.activePlayerIndex !== s.onlineLocalSlot;
                s.statusBanner = activePlayer.isBot || remoteTurn
                  ? `${activePlayer.name} landed it! Hopping through...`
                  : `Clean toss! Hop through the court — skip Square ${activePlayer.targetSquare} (Space / Click)`;
                pushHud(true);
              } else {
                const reason =
                  evalRes.status === 'LINE_FOUL'
                    ? 'Stone touched chalk line!'
                    : `Missed Square ${activePlayer.targetSquare}!`;
                triggerFoul(s, reason, evalRes.landedSquareId);
              }
            }
          }
          return;
        }

        // 3. Hop Animation & Balance Update
        if (
          s.phase === 'HOP_OUT' ||
          s.phase === 'HOP_BACK' ||
          s.phase === 'PICKUP_STONE' ||
          s.phase === 'HOP_EXIT'
        ) {
          const controlsBalanceLocally =
            !activePlayer.isBot &&
            (s.mode !== 'ONLINE_1V1' || s.activePlayerIndex === s.onlineLocalSlot);

          // Human balance control
          if (controlsBalanceLocally && s.playerStance !== 'TWO_FEET' && !s.hopAnimating) {
            const standingSq = s.squares.find(
              (sq) =>
                s.playerX >= sq.x &&
                s.playerX <= sq.x + sq.w &&
                s.playerY >= sq.y &&
                s.playerY <= sq.y + sq.h
            );
            const inPuddle = standingSq !== undefined && s.puddleSquares.includes(standingSq.id);
            const puddleMult = inPuddle ? 1.32 : 1;
            const roundDifficulty = (0.28 + (activePlayer.targetSquare / s.courtSize) * 0.34) * puddleMult;

            // Gentle sway drift (+ lakeside breeze nudge on Entebbe)
            if (Math.random() < dt * 1.4) {
              s.balanceDriftDir = Math.random() > 0.5 ? 1 : -1;
            }
            s.balanceSway += (s.balanceDriftDir * roundDifficulty + s.windX * 1.1) * dt;

            if (s.heldKeys.has('ArrowLeft') || s.heldKeys.has('KeyA')) {
              s.balanceSway -= 1.65 * dt;
            }
            if (s.heldKeys.has('ArrowRight') || s.heldKeys.has('KeyD')) {
              s.balanceSway += 1.65 * dt;
            }
            s.balanceSway = Math.max(-1.05, Math.min(1.05, s.balanceSway));

            if (Math.abs(s.balanceSway) > 0.65) {
              s.balance = Math.max(0, s.balance - Math.abs(s.balanceSway) * 32 * dt);
            } else {
              s.balance = Math.min(100, s.balance + 10 * dt);
            }

            if (s.mode === 'ONLINE_1V1') {
              sonkoOnline.sendBalance(s.balance, s.balanceSway);
            }

            if (s.balance <= 0) {
              triggerFoul(s, 'Lost balance on one foot!');
              return;
            }
            pushHud(false);
          }

          // Hop interpolation
          if (s.hopAnimating) {
            s.hopProgress += dt / s.hopDuration;
            if (s.hopProgress >= 1) {
              s.hopProgress = 1;
              s.hopAnimating = false;
              s.playerX = s.hopToX;
              s.playerY = s.hopToY;
              s.playerZ = 0;
              s.playerSquashX = 1.22;
              s.playerSquashY = 0.8;

              const landedSq = s.squares.find(
                (sq) =>
                  s.playerX >= sq.x &&
                  s.playerX <= sq.x + sq.w &&
                  s.playerY >= sq.y &&
                  s.playerY <= sq.y + sq.h
              );
              const landedInPuddle = landedSq !== undefined && s.puddleSquares.includes(landedSq.id);
              if (landedInPuddle) {
                sonkoAudio.playSplash();
                spawnDust(s.playerX, s.playerY, 9, '#93C5FD');
              } else {
                const dustColor =
                  s.venue === 'entebbe_sand'
                    ? '#FDE68A'
                    : s.venue === 'ndere_night'
                      ? '#F59E0B'
                      : '#D68C6B';
                spawnDust(s.playerX, s.playerY, 6, dustColor);
              }

              // Refill balance slightly on clean hop, full refill on TWO_FEET / HOUSE_REST
              if (s.playerStance === 'TWO_FEET') {
                s.balance = 100;
                s.balanceSway *= 0.2;
              } else {
                s.balance = Math.min(100, s.balance + 14);
                s.balanceSway *= 0.55;
              }
              activePlayer.score += 15;

              if (s.phase === 'HOP_EXIT') {
                completeRoundForActivePlayer(s);
                return;
              }

              const currentList = s.phase === 'HOP_OUT' ? s.outSteps : s.backSteps;
              const landedStep = currentList[s.stepCursor];
              s.stepCursor += 1;

              if (landedStep?.triggersPickupAfterLand) {
                s.phase = 'PICKUP_STONE';
                s.botTimer = 0.42;
                s.statusBanner = activePlayer.isBot
                  ? `${activePlayer.name} stops to scoop the stone...`
                  : 'Press E / Space or Click stone to scoop it up!';
                pushHud(true);
                return;
              }

              if (s.phase === 'HOP_OUT' && s.stepCursor >= s.outSteps.length) {
                // Reached turnaround (Home)!
                s.phase = 'TURN_HOME';
                s.turnTimer = 0.34;
                s.statusBanner = 'Turning around at Home!';
                pushHud(true);
                return;
              }

              if (s.phase === 'HOP_BACK' && s.stepCursor >= s.backSteps.length) {
                s.phase = 'HOP_EXIT';
                s.botTimer = 0.34;
                s.statusBanner = activePlayer.isBot
                  ? `${activePlayer.name} leaps to baseline!`
                  : 'Final leap past Square 1 to baseline! (Space / Click)';
                pushHud(true);
                return;
              }

              pushHud(true);
            } else {
              const t = s.hopProgress;
              const smooth = t * (2 - t);
              s.playerX = s.hopFromX + (s.hopToX - s.hopFromX) * smooth;
              s.playerY = s.hopFromY + (s.hopToY - s.hopFromY) * smooth;
              s.playerZ = Math.sin(t * Math.PI) * 0.42;
            }
          } else if (activePlayer.isBot) {
            // Bot executes next hop smoothly
            s.botTimer -= dt;
            if (s.botTimer <= 0) {
              // Small bot balance foul chance on hard rounds if Easy/Normal
              const foulChance = s.difficulty === 'EASY' ? 0.045 : s.difficulty === 'NORMAL' ? 0.015 : 0;
              if (s.playerStance !== 'TWO_FEET' && Math.random() < foulChance) {
                triggerFoul(s, 'Stepped on a line!');
                return;
              }
              advanceHopAction(s);
              s.botTimer = 0.36;
            }
          }
          return;
        }

        // 4. Turnaround at Home
        if (s.phase === 'TURN_HOME') {
          s.turnTimer -= dt;
          s.playerFacing = -Math.PI / 2 + (1 - Math.max(0, s.turnTimer) / 0.34) * Math.PI;
          if (s.turnTimer <= 0) {
            s.playerFacing = Math.PI / 2;
            s.stepCursor = 0;
            if (s.backSteps.length > 0) {
              s.phase = 'HOP_BACK';
              s.botTimer = 0.35;
              s.statusBanner = activePlayer.isBot
                ? `${activePlayer.name} hops back!`
                : 'Hop back down the court! (Space / S / Click tile)';
            } else {
              s.phase = 'HOP_EXIT';
              s.botTimer = 0.35;
            }
            pushHud(true);
          }
          return;
        }

        // 5. Foul recovery or Round clear transitions
        if (s.phase === 'FOUL_RECOVERY') {
          s.phaseTimer -= dt;
          if (s.phaseTimer <= 0 && s.mode !== 'ONLINE_1V1') {
            advanceToNextPlayer(s);
          }
          return;
        }

        if (s.phase === 'ROUND_CLEAR') {
          s.phaseTimer -= dt;
          if (s.phaseTimer <= 0 && s.mode !== 'ONLINE_1V1') {
            const midHouseTrigger = s.courtSize === 10 ? 6 : 4; // targetSquare just incremented!
            const teamHousesCount = Object.values(s.houses).filter(
              (owner) => owner === activePlayer.teamId
            ).length;
            const justEarnedMidHouse =
              activePlayer.targetSquare === midHouseTrigger && teamHousesCount === 0;
            const justFinishedSolo =
              s.mode === 'SOLO' &&
              activePlayer.cyclesCompleted >= 1 &&
              activePlayer.targetSquare >= s.courtSize;

            if (justEarnedMidHouse || justFinishedSolo) {
              resetTurnToBaseline(s, 'CLAIM_AIM');
              pushHud(true);
            } else {
              advanceToNextPlayer(s);
            }
          }
        }
      };

      const unsubOnline = sonkoOnline.subscribe((ev) => {
        const s = simRef.current;
        if (s.mode !== 'ONLINE_1V1') return;

        if (ev.type === 'room:state') {
          syncSimFromOnlineRoom(s, ev.room);
          pushHud(true);
        } else if (ev.type === 'room:rematch_start') {
          startOnlineMatchInternal(ev.room, s.onlineLocalSlot ?? 0);
        } else if (ev.type === 'remote:aim') {
          if (ev.slot !== s.onlineLocalSlot && (s.phase === 'TOSS_AIM' || s.phase === 'CLAIM_AIM')) {
            s.aimAngleOffset = ev.angleOffset;
            s.aimPower = ev.aimPower;
            s.isCharging = ev.isCharging;
          }
        } else if (ev.type === 'game:toss') {
          s.windX = ev.windX;
          launchStoneWithCoords(s, ev.isClaim, ev.targetX, ev.targetY);
        } else if (ev.type === 'remote:hop') {
          if (ev.slot !== s.onlineLocalSlot) {
            advanceHopAction(s, true);
          }
        } else if (ev.type === 'remote:pickup') {
          if (ev.slot !== s.onlineLocalSlot && s.phase === 'PICKUP_STONE') {
            advanceHopAction(s, true);
          }
        } else if (ev.type === 'remote:balance') {
          if (ev.slot !== s.onlineLocalSlot) {
            s.balance = ev.balance;
            s.balanceSway = ev.balanceSway;
          }
        } else if (ev.type === 'game:claim_phase') {
          syncSimFromOnlineRoom(s, ev.room);
          resetTurnToBaseline(s, 'CLAIM_AIM');
          pushHud(true);
        } else if (ev.type === 'game:turn_advance') {
          syncSimFromOnlineRoom(s, ev.room);
          resetTurnToBaseline(s, 'TOSS_AIM');
          pushHud(true);
        } else if (ev.type === 'game:over') {
          syncSimFromOnlineRoom(s, ev.room);
          const winSlot = ev.room.winnerSlot ?? 0;
          const winnerName = ev.room.players[winSlot]?.name ?? 'Winner';
          finalizeMatch(s, winSlot, `${winnerName} Wins!`, ev.room.winReason ?? 'Match complete!');
        }
      });

      rafId = requestAnimationFrame(tick);

      return () => {
        unsubOnline();
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', resize);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointerup', onPointerUp);
      };
    }, []);

    return (
      <canvas
        ref={canvasRef}
        className="block w-full h-full touch-none select-none cursor-crosshair"
        aria-label="Sonko courtyard playfield"
      />
    );
  }
);
