import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Compass,
  Pause,
  Play,
  PlayCircle,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  ArrowLeft,
  ArrowRight,
  Footprints,
  ShoppingBag,
  Wind,
  Globe,
  Eye,
  EyeOff,
  Flame,
  Target,
  Trophy,
  CloudRain,
  CloudDrizzle,
  CloudFog,
  Sun,
} from 'lucide-react';
import { AchievementsModal, AchievementGlyph } from './components/AchievementsModal';
import { AchievementToast } from './components/AchievementToast';
import { AdSimulatorModal } from './components/AdSimulatorModal';
import { CharacterCustomizerModal } from './components/CharacterCustomizerModal';
import { ConsentBanner } from './components/ConsentBanner';
import { CourtyardStallModal, CowrieIcon } from './components/CourtyardStallModal';
import { DailyMissionCard } from './components/DailyMissionCard';
import {
  DailyStreakModal,
  JustClaimedDailyInfo,
} from './components/DailyStreakModal';
import { GlobalLeaderboard } from './components/GlobalLeaderboard';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OnlineLobbyModal } from './components/OnlineLobbyModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { QuickMatchModal } from './components/QuickMatchModal';
import { SettingsModal } from './components/SettingsModal';
import { TourModal } from './components/TourModal';
import {
  CharacterViewportPose,
  CompoundCameraPreset,
  SpeechState,
  UgandanCompoundHandle,
  UgandanCompoundViewport,
} from './components/UgandanCompoundViewport';
import { useOnlineStatus } from './hooks/usePWAInstall';
import { adService, applyAdConsentPreference } from './game/adService';
import { sonkoAudio } from './game/audio';
import { sonkoVoice } from './game/voiceEngine';
import { OnlineRoomState, sonkoOnline } from './game/onlineClient';
import {
  ACHIEVEMENT_CATALOG,
  AchievementSpec,
  evaluateAchievements,
  LiveAchievementContext,
} from './game/achievements';
import {
  applyDailyMissionReroll,
  DailyMissionSpec,
  evaluateDailyMissionMatch,
  syncDailyMissionForToday,
} from './game/dailyMission';
import { applyDailyLoginCheckIn, getLocalDateKey } from './game/dailyStreak';
import {
  getOrCreateLeaderboardPlayerId,
  loadPlayerDisplayName,
  savePlayerDisplayName,
  submitGlobalLeaderboardScore,
} from './game/leaderboard';
import {
  AvatarCustomization,
  COURT_VENUES,
  getPlaceSpec,
  getVenueSpec,
  loadProgression,
  OUTFIT_CATALOG,
  ProgressionData,
  saveProgression,
  STENCIL_CATALOG,
  STONE_CATALOG,
  WORLD_PLACES,
  WorldPlaceId,
} from './game/progression';
import {
  applyLoadoutToProgression,
  hydrateAvatarLoadout,
  scheduleAvatarLoadoutSync,
} from './game/avatarLoadoutService';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  PeriodPreset,
  saveSettings,
  SonkoSettings,
} from './game/settings';
import {
  CourtSize,
  CourtVenueId,
  Difficulty,
  HudSnapshot,
  MatchRewardSummary,
  MonetizationStatus,
  OutfitId,
  PlayerState,
  PlayMode,
  StencilId,
  StoneId,
  WeatherMode,
} from './game/types';

const INITIAL_HUD: HudSnapshot = {
  screen: 'TITLE_MENU',
  mode: 'VS_BOT',
  difficulty: 'NORMAL',
  courtSize: 10,
  venue: 'kampala_murram',
  windX: 0,
  puddleSquares: [],
  weatherCondition: 'clear',
  weatherMode: 'auto',
  weatherLabel: 'Clear Sky',
  activePlayerIndex: 0,
  players: [
    {
      id: 0,
      teamId: 0,
      name: 'Player 1',
      isBot: false,
      hairStyle: 'braids',
      skinTone: '#6B3A24',
      primaryColor: '#15803D',
      accentColor: '#FBBF24',
      targetSquare: 1,
      cyclesCompleted: 0,
      score: 0,
      housesOwned: [],
      streak: 0,
      bestStreak: 0,
      perfectTosses: 0,
      fouls: 0,
      roundsCleared: 0,
    },
    {
      id: 1,
      teamId: 1,
      name: 'Amina (Bot)',
      isBot: true,
      hairStyle: 'bun',
      skinTone: '#7A4329',
      primaryColor: '#B91C1C',
      accentColor: '#FDE047',
      targetSquare: 1,
      cyclesCompleted: 0,
      score: 0,
      housesOwned: [],
      streak: 0,
      bestStreak: 0,
      perfectTosses: 0,
      fouls: 0,
      roundsCleared: 0,
    },
  ],
  teamScores: [0, 0],
  teamTargets: [1, 1],
  phase: 'TOSS_AIM',
  balance: 100,
  aimPower: 0.14,
  isCharging: false,
  statusBanner: 'Hold Click or Space — Release inside Square 1',
  foulReason: null,
  winnerTeamId: null,
  winnerLabel: null,
  winReason: null,
  houses: {},
  turnCount: 1,
  lastMatchReward: null,
};

function SonkoTitleLockup() {
  return (
    <svg
      viewBox="0 0 380 112"
      className="w-full max-w-[330px] h-auto select-none"
      role="img"
      aria-label="Sonko"
    >
      <g transform="translate(4, 14)">
        <rect
          x="2"
          y="42"
          width="36"
          height="36"
          rx="3"
          fill="none"
          stroke="#FAF3E8"
          strokeWidth="2.5"
          strokeOpacity="0.7"
        />
        <rect
          x="2"
          y="4"
          width="18"
          height="36"
          rx="2"
          fill="none"
          stroke="#FBBF24"
          strokeWidth="2.5"
        />
        <rect
          x="20"
          y="4"
          width="18"
          height="36"
          rx="2"
          fill="none"
          stroke="#FAF3E8"
          strokeWidth="2.5"
          strokeOpacity="0.7"
        />
        <ellipse cx="11" cy="22" rx="6" ry="5" fill="#D6CFC7" stroke="#1F100B" strokeWidth="1.5" />
        <circle cx="11" cy="22" r="2.2" fill="#F59E0B" />
      </g>

      <text
        x="58"
        y="76"
        fontFamily="'Bricolage Grotesque', sans-serif"
        fontWeight="800"
        fontSize="74"
        letterSpacing="-2"
        fill="#2A1108"
        transform="translate(3, 3)"
      >
        SONKO
      </text>
      <text
        x="58"
        y="76"
        fontFamily="'Bricolage Grotesque', sans-serif"
        fontWeight="800"
        fontSize="74"
        letterSpacing="-2"
        fill="#FAF3E8"
      >
        SONKO
      </text>

      <path
        d="M60 92 Q 190 86 346 93"
        fill="none"
        stroke="#F59E0B"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <text
        x="62"
        y="108"
        fontFamily="'Plus Jakarta Sans', sans-serif"
        fontWeight="600"
        fontSize="12.5"
        letterSpacing="1.6"
        fill="#FDE68A"
      >
        UGANDAN COURTYARD HOPSCOTCH · 3D
      </text>
    </svg>
  );
}

const ALL_INSPECT_CAMERAS: Array<{ id: CompoundCameraPreset; label: string }> = [
  { id: 'characters', label: 'Characters' },
  { id: 'courtyard', label: 'Courtyard' },
  { id: 'play', label: 'Dynamic' },
  { id: 'aim_target', label: 'Aim Focus' },
  { id: 'top_aim', label: 'Top-Down' },
  { id: 'ground_low', label: 'Ground Low' },
  { id: 'veranda', label: 'Veranda' },
  { id: 'overhead', label: 'Overhead' },
];

export default function App() {
  const compoundRef = useRef<UgandanCompoundHandle | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [selectedMode, setSelectedMode] = useState<PlayMode>('VS_BOT');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('NORMAL');
  const [selectedCourtSize, setSelectedCourtSize] = useState<CourtSize>(10);
  const [selectedPlace, setSelectedPlace] = useState<WorldPlaceId>('kampala_compound');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>('auto');
  const [selectedWeatherMode, setSelectedWeatherMode] = useState<WeatherMode>('auto');
  const [selectedVenue, setSelectedVenue] = useState<CourtVenueId>('kampala_murram');
  const [settings, setSettings] = useState<SonkoSettings>(() => loadSettings());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [muted, setMuted] = useState(false);
  const [titlePeekMode, setTitlePeekMode] = useState(false);
  const [characterPose, setCharacterPose] = useState<CharacterViewportPose>('idle');
  const [characterSpeech, setCharacterSpeech] = useState<SpeechState>('silent');
  const [matchCamera, setMatchCamera] = useState<CompoundCameraPreset>('characters');
  const [progression, setProgression] = useState<ProgressionData>(() => loadProgression());
  const progressionRef = useRef<ProgressionData>(progression);
  progressionRef.current = progression;
  const [stallOpen, setStallOpen] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [quickMatchOpen, setQuickMatchOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [dailyStreakOpen, setDailyStreakOpen] = useState(false);
  const [justClaimedDaily, setJustClaimedDaily] = useState<JustClaimedDailyInfo | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [studioAvailable, setStudioAvailable] = useState(false);
  const [arrivalPlaying, setArrivalPlaying] = useState(false);
  const [toastAchievements, setToastAchievements] = useState<AchievementSpec[]>([]);
  const [lastMatchBadges, setLastMatchBadges] = useState<AchievementSpec[]>([]);
  const [lastMatchMission, setLastMatchMission] = useState<DailyMissionSpec | null>(null);
  const lastLiveMilestoneRef = useRef<string>('');
  const dailyCheckDoneRef = useRef(false);
  const toastTimersRef = useRef<number[]>([]);

  // Online 1v1 & Global Leaderboard identity state
  const [mainMenuTab, setMainMenuTab] = useState<'menu' | 'leaderboard'>('menu');
  const [leaderboardPlayerId] = useState<string>(() => getOrCreateLeaderboardPlayerId());
  const [onlineLobbyOpen, setOnlineLobbyOpen] = useState(false);
  const [onlineName, setOnlineName] = useState<string>(() => loadPlayerDisplayName());
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoomState | null>(null);
  const [onlineSlot, setOnlineSlot] = useState<0 | 1 | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [inviteJoinCode, setInviteJoinCode] = useState('');
  const onlineLobbyOpenRef = useRef(onlineLobbyOpen);
  onlineLobbyOpenRef.current = onlineLobbyOpen;
  const onlineSlotRef = useRef(onlineSlot);
  onlineSlotRef.current = onlineSlot;
  const isOnline = useOnlineStatus();

  // Phase 1 Monetization state
  const [monetizationStatus, setMonetizationStatus] = useState<MonetizationStatus | null>(null);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [doubleMatchLoading, setDoubleMatchLoading] = useState(false);
  const [doubleMatchClaimedAmount, setDoubleMatchClaimedAmount] = useState<number | null>(null);
  const [doubleMatchError, setDoubleMatchError] = useState<string | null>(null);
  const [rerollLoading, setRerollLoading] = useState(false);
  const [rerollMessage, setRerollMessage] = useState<string | null>(null);
  const [bonusChestLoading, setBonusChestLoading] = useState(false);
  const [bonusChestReward, setBonusChestReward] = useState<number | null>(null);
  const [bonusChestError, setBonusChestError] = useState<string | null>(null);
  const [interstitialBusy, setInterstitialBusy] = useState(false);

  const handlePlayerNameChange = useCallback((nextName: string) => {
    const saved = savePlayerDisplayName(nextName);
    setOnlineName(saved);
  }, []);

  const updateSettings = useCallback((patch: Partial<SonkoSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  // Sync Audio, Voice, Subtitle & Ad Consent preferences whenever settings or mute state change
  useEffect(() => {
    sonkoAudio.setVolume(settings.sfxVolume);
    sonkoVoice.setVolume(settings.voiceVolume);
    sonkoVoice.setSubtitlesEnabled(settings.subtitlesEnabled);
    sonkoAudio.setMuted(muted);
    sonkoVoice.setMuted(muted);
    applyAdConsentPreference(settings.adPersonalizationConsent);
  }, [
    settings.sfxVolume,
    settings.voiceVolume,
    settings.subtitlesEnabled,
    settings.adPersonalizationConsent,
    muted,
  ]);

  const handleSelectPlace = useCallback((placeId: WorldPlaceId) => {
    setSelectedPlace(placeId);
    setSelectedVenue(getPlaceSpec(placeId).venueId);
  }, []);

  const handleSelectVenue = useCallback((venueId: CourtVenueId) => {
    setSelectedVenue(venueId);
    const matchingPlace = WORLD_PLACES.find((p) => p.venueId === venueId);
    if (matchingPlace) {
      setSelectedPlace(matchingPlace.id);
    }
  }, []);

  const enqueueAchievementToasts = useCallback(
    (unlocked: AchievementSpec[], playChime = true) => {
      if (unlocked.length === 0) return;
      if (playChime) {
        sonkoAudio.playHouseClaim();
      }
      setToastAchievements((prev) => {
        const existing = new Set(prev.map((a) => a.id));
        const additions = unlocked.filter((a) => !existing.has(a.id));
        return additions.length > 0 ? [...prev, ...additions] : prev;
      });
      const idsToClear = new Set(unlocked.map((u) => u.id));
      const timer = window.setTimeout(() => {
        setToastAchievements((prev) => prev.filter((a) => !idsToClear.has(a.id)));
      }, 4200);
      toastTimersRef.current.push(timer);
    },
    []
  );

  useEffect(() => {
    return () => {
      for (const id of toastTimersRef.current) {
        window.clearTimeout(id);
      }
      toastTimersRef.current = [];
    };
  }, []);

  const updateProgression = useCallback(
    (
      updater: (prev: ProgressionData) => ProgressionData,
      options?: {
        live?: LiveAchievementContext;
        playChime?: boolean;
        recordMatchBadges?: boolean;
      }
    ) => {
      const updated = updater(progressionRef.current);
      const { next, newlyUnlocked } = evaluateAchievements(updated, options?.live);
      progressionRef.current = next;
      saveProgression(next);
      setProgression(next);
      scheduleAvatarLoadoutSync(leaderboardPlayerId, next);
      if (newlyUnlocked.length > 0) {
        enqueueAchievementToasts(newlyUnlocked, options?.playChime ?? true);
        if (options?.recordMatchBadges) {
          setLastMatchBadges((prev) => {
            const seen = new Set(prev.map((b) => b.id));
            const unique = newlyUnlocked.filter((b) => !seen.has(b.id));
            return unique.length > 0 ? [...prev, ...unique] : prev;
          });
        }
      }
      return newlyUnlocked;
    },
    [enqueueAchievementToasts, leaderboardPlayerId]
  );

  // Hydrate avatar customization & unlocked equipment from IndexedDB / server persistence
  useEffect(() => {
    let cancelled = false;
    void hydrateAvatarLoadout(leaderboardPlayerId, progressionRef.current).then((hydratedLoadout) => {
      if (cancelled || !hydratedLoadout) return;
      const merged = applyLoadoutToProgression(progressionRef.current, hydratedLoadout);
      progressionRef.current = merged;
      saveProgression(merged);
      setProgression(merged);
    });
    return () => {
      cancelled = true;
    };
  }, [leaderboardPlayerId]);

  // Daily login streak check-in + retroactive career badge check on startup
  useEffect(() => {
    if (dailyCheckDoneRef.current) return;
    dailyCheckDoneRef.current = true;
    let claimedPayload: JustClaimedDailyInfo | null = null;
    updateProgression(
      (prev) => {
        const syncedMission = syncDailyMissionForToday(prev.dailyMission);
        const res = applyDailyLoginCheckIn(prev.dailyStreak);
        if (!res.claimedNow) {
          return syncedMission === prev.dailyMission
            ? prev
            : { ...prev, dailyMission: syncedMission };
        }
        claimedPayload = {
          streak: res.nextStreak.currentStreak,
          cowries: res.rewardCowries,
          cycleDay: res.cycleDay,
          weekBonus: res.weekBonus,
          wasReset: res.wasReset,
        };
        return {
          ...prev,
          cowries: prev.cowries + res.rewardCowries,
          dailyStreak: res.nextStreak,
          dailyMission: syncedMission,
        };
      },
      { playChime: false }
    );
    if (claimedPayload) {
      setJustClaimedDaily(claimedPayload);
      setDailyStreakOpen(true);
    }
  }, [updateProgression]);

  // Preload ad provider adapter & hydrate server monetization state
  useEffect(() => {
    adService.preload();
    let cancelled = false;
    void adService.fetchStatus(leaderboardPlayerId).then((status) => {
      if (!cancelled && status) {
        setMonetizationStatus(status);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [leaderboardPlayerId]);

  const handleHudChange = useCallback(
    (snapshot: HudSnapshot) => {
      setHud((prev) => {
        if (prev.screen !== snapshot.screen) {
          if (snapshot.screen === 'PLAYING' && prev.screen === 'TITLE_MENU') {
            const cam = settingsRef.current.defaultCamera;
            setMatchCamera(cam);
            compoundRef.current?.setCameraPreset(cam);
            setLastMatchBadges([]);
            setLastMatchMission(null);
            setCurrentMatchId(null);
            setDoubleMatchClaimedAmount(null);
            setDoubleMatchError(null);
            lastLiveMilestoneRef.current = '';
          } else if (snapshot.screen === 'TITLE_MENU') {
            setMatchCamera('characters');
            setLastMatchBadges([]);
            setLastMatchMission(null);
            setCurrentMatchId(null);
            setDoubleMatchClaimedAmount(null);
            setDoubleMatchError(null);
            lastLiveMilestoneRef.current = '';
          } else if (snapshot.screen === 'PLAYING' && prev.screen === 'GAME_OVER') {
            setLastMatchBadges([]);
            setLastMatchMission(null);
            setCurrentMatchId(null);
            setDoubleMatchClaimedAmount(null);
            setDoubleMatchError(null);
            lastLiveMilestoneRef.current = '';
          }
        }
        return snapshot;
      });

      if (snapshot.screen === 'PLAYING') {
        const localSlot = snapshot.mode === 'ONLINE_1V1' ? (snapshot.onlineLocalSlot ?? 0) : 0;
        const humanTeam = snapshot.players.filter((pl) => pl.teamId === localSlot);
        const bullseyes = humanTeam.reduce((s, pl) => s + pl.perfectTosses, 0);
        const houses = humanTeam.reduce((s, pl) => s + pl.housesOwned.length, 0);
        const bestStreak = humanTeam.reduce((m, pl) => Math.max(m, pl.bestStreak), 0);
        const score = snapshot.teamScores[localSlot] ?? 0;
        const key = `${bullseyes > 0 ? 1 : 0}-${houses > 0 ? 1 : 0}-${bestStreak >= 4 ? 1 : 0}-${score >= 1000 ? 1 : 0}`;
        if (key !== '0-0-0-0' && key !== lastLiveMilestoneRef.current) {
          lastLiveMilestoneRef.current = key;
          updateProgression((prev) => prev, {
            live: { bullseyes, houses, bestStreak, score },
            playChime: true,
            recordMatchBadges: true,
          });
        }
      }
    },
    [updateProgression]
  );

  const handleMatchComplete = useCallback(
    (
      reward: MatchRewardSummary,
      won: boolean,
      humanStats: PlayerState,
      venue: CourtVenueId,
      meta?: { mode: PlayMode; difficulty: Difficulty }
    ) => {
      const isCleanWin = won && humanStats.fouls === 0;
      const isHardWin =
        won &&
        meta?.difficulty === 'HARD' &&
        (meta.mode === 'VS_BOT' || meta.mode === 'TEAM_2V2');
      const isOnlineWin = won && meta?.mode === 'ONLINE_1V1';
      const matchId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `match_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      setCurrentMatchId(matchId);
      setDoubleMatchClaimedAmount(null);
      setDoubleMatchError(null);
      void adService.recordMatchResult(leaderboardPlayerId, matchId, reward.totalEarned);

      let completedMissionSpec: DailyMissionSpec | null = null;
      updateProgression(
        (prev) => {
          const missionEval = evaluateDailyMissionMatch(prev.dailyMission, {
            won,
            score: humanStats.score,
            fouls: humanStats.fouls,
            perfectTosses: humanStats.perfectTosses,
            housesClaimed: humanStats.housesOwned.length,
            bestStreak: humanStats.bestStreak,
            roundsCleared: humanStats.roundsCleared,
          });
          if (missionEval.completedNow) {
            completedMissionSpec = missionEval.spec;
          }
          return {
            ...prev,
            cowries: prev.cowries + reward.totalEarned + missionEval.rewardCowries,
            dailyMission: missionEval.nextState,
            monetization: {
              ...prev.monetization,
              matchesCompletedSinceInterstitial:
                meta?.mode === 'ONLINE_1V1'
                  ? prev.monetization.matchesCompletedSinceInterstitial
                  : prev.monetization.matchesCompletedSinceInterstitial + 1,
            },
            tourWins: {
              ...prev.tourWins,
              [venue]: (prev.tourWins[venue] ?? 0) + (won ? 1 : 0),
            },
            stats: {
              matchesPlayed: prev.stats.matchesPlayed + 1,
              matchesWon: prev.stats.matchesWon + (won ? 1 : 0),
              totalBullseyes: prev.stats.totalBullseyes + humanStats.perfectTosses,
              totalHouses: prev.stats.totalHouses + humanStats.housesOwned.length,
              bestScore: Math.max(prev.stats.bestScore, humanStats.score),
              bestStreak: Math.max(prev.stats.bestStreak, humanStats.bestStreak),
              cleanMatchesWon: prev.stats.cleanMatchesWon + (isCleanWin ? 1 : 0),
              hardWins: prev.stats.hardWins + (isHardWin ? 1 : 0),
              onlineWins: prev.stats.onlineWins + (isOnlineWin ? 1 : 0),
            },
          };
        },
        { playChime: false, recordMatchBadges: true }
      );
      if (completedMissionSpec) {
        sonkoAudio.playHouseClaim();
        setLastMatchMission(completedMissionSpec);
      }

      if (humanStats.score > 0) {
        const latest = progressionRef.current;
        void submitGlobalLeaderboardScore({
          playerId: leaderboardPlayerId,
          name: onlineName,
          score: humanStats.score,
          venue,
          mode: meta?.mode ?? 'VS_BOT',
          wins: latest.stats.matchesWon,
          bullseyes: latest.stats.totalBullseyes,
          houses: latest.stats.totalHouses,
        }).catch(() => {
          // Non-blocking: ignore offline or transient network failures
        });
      }
    },
    [leaderboardPlayerId, onlineName, updateProgression]
  );

  const handleDoubleMatchCowries = useCallback(async () => {
    if (doubleMatchLoading || !currentMatchId || !hud.lastMatchReward || hud.lastMatchReward.totalEarned <= 0) {
      return;
    }
    setDoubleMatchError(null);
    setDoubleMatchLoading(true);
    try {
      const res = await adService.runRewardedPlacement({
        playerId: leaderboardPlayerId,
        placement: 'double_match',
        matchId: currentMatchId,
        baseCowries: hud.lastMatchReward.totalEarned,
        rewardLabel: `+${hud.lastMatchReward.totalEarned} Cowries`,
      });
      if (res.status) {
        setMonetizationStatus(res.status);
      }
      if (!res.ok) {
        setDoubleMatchError(res.error ?? 'Unable to claim 2x match bonus.');
        return;
      }
      sonkoAudio.playHouseClaim();
      setDoubleMatchClaimedAmount(res.cowriesGranted);
      updateProgression(
        (prev) => ({
          ...prev,
          cowries: prev.cowries + res.cowriesGranted,
          monetization: {
            ...prev.monetization,
            claimedDoubleMatchIds: prev.monetization.claimedDoubleMatchIds.includes(currentMatchId)
              ? prev.monetization.claimedDoubleMatchIds
              : [...prev.monetization.claimedDoubleMatchIds, currentMatchId].slice(-80),
          },
        }),
        { playChime: false }
      );
    } finally {
      setDoubleMatchLoading(false);
    }
  }, [currentMatchId, doubleMatchLoading, hud.lastMatchReward, leaderboardPlayerId, updateProgression]);

  const handleRerollDailyMission = useCallback(async () => {
    if (rerollLoading || progressionRef.current.dailyMission.completed) return;
    setRerollMessage(null);
    setRerollLoading(true);
    try {
      const res = await adService.runRewardedPlacement({
        playerId: leaderboardPlayerId,
        placement: 'mission_reroll',
        currentMissionId: progressionRef.current.dailyMission.missionId,
        rewardLabel: 'Fresh Daily Mission',
      });
      if (res.status) {
        setMonetizationStatus(res.status);
      }
      if (!res.ok || !res.nextMissionId) {
        setRerollMessage(res.error ?? 'Could not reroll Daily Mission.');
        return;
      }
      const nextMissionId = res.nextMissionId;
      const todayKey = getLocalDateKey();
      sonkoAudio.playHouseClaim();
      setRerollMessage('New Daily Mission dealt!');
      updateProgression(
        (prev) => ({
          ...prev,
          dailyMission: applyDailyMissionReroll(prev.dailyMission, nextMissionId),
          monetization: {
            ...prev.monetization,
            missionRerollDates: prev.monetization.missionRerollDates.includes(todayKey)
              ? prev.monetization.missionRerollDates
              : [...prev.monetization.missionRerollDates, todayKey].slice(-30),
          },
        }),
        { playChime: false }
      );
    } finally {
      setRerollLoading(false);
    }
  }, [leaderboardPlayerId, rerollLoading, updateProgression]);

  const handleClaimBonusChest = useCallback(async () => {
    if (bonusChestLoading) return;
    setBonusChestError(null);
    setBonusChestLoading(true);
    try {
      const res = await adService.runRewardedPlacement({
        playerId: leaderboardPlayerId,
        placement: 'bonus_chest',
        rewardLabel: '+30 to +50 Cowries',
      });
      if (res.status) {
        setMonetizationStatus(res.status);
      }
      if (!res.ok) {
        setBonusChestError(res.error ?? 'Could not open Bonus Treasure Chest.');
        return;
      }
      const todayKey = getLocalDateKey();
      sonkoAudio.playHouseClaim();
      setBonusChestReward(res.cowriesGranted);
      updateProgression(
        (prev) => ({
          ...prev,
          cowries: prev.cowries + res.cowriesGranted,
          monetization: {
            ...prev.monetization,
            bonusChestClaimedDates: prev.monetization.bonusChestClaimedDates.includes(todayKey)
              ? prev.monetization.bonusChestClaimedDates
              : [...prev.monetization.bonusChestClaimedDates, todayKey].slice(-30),
          },
        }),
        { playChime: false }
      );
    } finally {
      setBonusChestLoading(false);
    }
  }, [bonusChestLoading, leaderboardPlayerId, updateProgression]);

  const runPostMatchTransition = useCallback(
    async (action: () => void) => {
      if (interstitialBusy) return;
      const mon = progressionRef.current.monetization;
      const shouldPlayBreak = adService.shouldShowInterstitial({
        mode: hud.mode,
        matchesCompletedSinceInterstitial: mon.matchesCompletedSinceInterstitial,
        lastInterstitialAt: mon.lastInterstitialAt,
      });
      if (!shouldPlayBreak) {
        action();
        return;
      }
      setInterstitialBusy(true);
      try {
        await adService.showInterstitialBreak(leaderboardPlayerId);
        const nowTs = Date.now();
        updateProgression(
          (prev) => ({
            ...prev,
            monetization: {
              ...prev.monetization,
              matchesCompletedSinceInterstitial: 0,
              lastInterstitialAt: nowTs,
            },
          }),
          { playChime: false }
        );
      } finally {
        setInterstitialBusy(false);
        action();
      }
    },
    [hud.mode, interstitialBusy, leaderboardPlayerId, updateProgression]
  );

  const handleBuyOrEquipStone = useCallback(
    (id: StoneId) => {
      const item = STONE_CATALOG.find((s) => s.id === id);
      if (!item) return;
      updateProgression((prev) => {
        if (prev.unlockedStones.includes(id)) {
          sonkoAudio.playPickup();
          return { ...prev, equippedStone: id };
        }
        if (prev.cowries < item.price) return prev;
        sonkoAudio.playHouseClaim();
        return {
          ...prev,
          cowries: prev.cowries - item.price,
          unlockedStones: [...prev.unlockedStones, id],
          equippedStone: id,
        };
      });
    },
    [updateProgression]
  );

  const handleBuyOrEquipOutfit = useCallback(
    (id: OutfitId) => {
      const item = OUTFIT_CATALOG.find((o) => o.id === id);
      if (!item) return;
      updateProgression((prev) => {
        if (prev.unlockedOutfits.includes(id)) {
          sonkoAudio.playPickup();
          return {
            ...prev,
            equippedOutfit: id,
            avatar: {
              ...prev.avatar,
              primaryColor: item.primaryColor,
              accentColor: item.accentColor,
            },
          };
        }
        if (prev.cowries < item.price) return prev;
        sonkoAudio.playHouseClaim();
        return {
          ...prev,
          cowries: prev.cowries - item.price,
          unlockedOutfits: [...prev.unlockedOutfits, id],
          equippedOutfit: id,
          avatar: {
            ...prev.avatar,
            primaryColor: item.primaryColor,
            accentColor: item.accentColor,
          },
        };
      });
    },
    [updateProgression]
  );

  const handleUpdateAvatar = useCallback(
    (patch: Partial<AvatarCustomization>, playFeedback = true) => {
      if (playFeedback) {
        sonkoAudio.playPickup();
      }
      updateProgression((prev) => ({
        ...prev,
        avatar: {
          ...prev.avatar,
          ...patch,
        },
      }));
    },
    [updateProgression]
  );

  const handleBuyOrEquipStencil = useCallback(
    (id: StencilId) => {
      const item = STENCIL_CATALOG.find((st) => st.id === id);
      if (!item) return;
      updateProgression((prev) => {
        if (prev.unlockedStencils.includes(id)) {
          sonkoAudio.playPickup();
          return { ...prev, equippedStencil: id };
        }
        if (prev.cowries < item.price) return prev;
        sonkoAudio.playHouseClaim();
        return {
          ...prev,
          cowries: prev.cowries - item.price,
          unlockedStencils: [...prev.unlockedStencils, id],
          equippedStencil: id,
        };
      });
    },
    [updateProgression]
  );

  const handleStartQuickMatch = useCallback(() => {
    const mode = selectedMode === 'ONLINE_1V1' ? 'VS_BOT' : selectedMode;
    setSelectedMode(mode);
    setQuickMatchOpen(false);
    setTitlePeekMode(false);
    const cam = settingsRef.current.defaultCamera;
    setMatchCamera(cam);
    compoundRef.current?.startGame(
      mode,
      selectedDifficulty,
      selectedCourtSize,
      selectedVenue
    );
    compoundRef.current?.setCameraPreset(cam);
  }, [selectedMode, selectedDifficulty, selectedCourtSize, selectedVenue]);

  const handleStartTourStop = useCallback(
    (venueId: CourtVenueId) => {
      handleSelectVenue(venueId);
      setSelectedMode('VS_BOT');
      setTourOpen(false);
      setTitlePeekMode(false);
      const cam = settingsRef.current.defaultCamera;
      setMatchCamera(cam);
      compoundRef.current?.startGame('VS_BOT', selectedDifficulty, selectedCourtSize, venueId);
      compoundRef.current?.setCameraPreset(cam);
    },
    [handleSelectVenue, selectedDifficulty, selectedCourtSize]
  );

  const handleOpenOnlineLobby = useCallback(() => {
    setSelectedMode('ONLINE_1V1');
    setOnlineError(
      isOnline ? null : 'You appear offline — reconnect to play Online 1v1, or choose Solo / vs Bot.'
    );
    if (isOnline) {
      sonkoOnline.connect();
    }
    setOnlineLobbyOpen(true);
  }, [isOnline]);

  // Auto-open Online Lobby if URL has ?room=CODE invite parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam && roomParam.trim().length >= 4) {
      setSelectedMode('ONLINE_1V1');
      setInviteJoinCode(roomParam.trim().toUpperCase());
      sonkoOnline.connect();
      setOnlineLobbyOpen(true);
    }
  }, []);

  // Subscribe to Online Lobby events
  useEffect(() => {
    const unsub = sonkoOnline.subscribe((ev) => {
      if (ev.type === 'ws:status') {
        setWsConnected(ev.connected);
      } else if (ev.type === 'room:error') {
        setOnlineError(ev.message);
      } else if (ev.type === 'room:joined') {
        setOnlineError(null);
        setOnlineRoom(ev.room);
        setOnlineSlot(ev.yourSlot);
        onlineSlotRef.current = ev.yourSlot;
        if (ev.room.status === 'PLAYING') {
          setOnlineLobbyOpen(false);
          compoundRef.current?.startOnlineGame(ev.room, ev.yourSlot);
        }
      } else if (ev.type === 'room:state') {
        setOnlineRoom(ev.room);
        const slot = onlineSlotRef.current;
        if (ev.room.status === 'PLAYING' && onlineLobbyOpenRef.current && slot !== null) {
          setOnlineLobbyOpen(false);
          compoundRef.current?.startOnlineGame(ev.room, slot);
        }
      }
    });
    return unsub;
  }, []);

  const handleCreateOnlineRoom = useCallback(
    (isPublic: boolean) => {
      setOnlineError(null);
      sonkoOnline.createRoom(
        onlineName,
        selectedCourtSize,
        selectedVenue,
        {
          stoneId: progression.equippedStone,
          outfitId: progression.equippedOutfit,
          stencilId: progression.equippedStencil,
          hairStyle: progression.avatar.hairStyle,
          skinTone: '#6B3A24',
          primaryColor: progression.avatar.primaryColor,
          accentColor: progression.avatar.accentColor,
        },
        isPublic
      );
    },
    [onlineName, selectedCourtSize, selectedVenue, progression]
  );

  const handleJoinOnlineRoom = useCallback(
    (code: string) => {
      setOnlineError(null);
      sonkoOnline.joinRoom(code, onlineName, {
        stoneId: progression.equippedStone,
        outfitId: progression.equippedOutfit,
        stencilId: progression.equippedStencil,
        hairStyle: progression.avatar.hairStyle,
        skinTone: '#5C311C',
        primaryColor: progression.avatar.primaryColor,
        accentColor: progression.avatar.accentColor,
      });
    },
    [onlineName, progression]
  );

  const handleLeaveOnlineRoom = useCallback(() => {
    sonkoOnline.leaveRoom();
    setOnlineRoom(null);
    setOnlineSlot(null);
    setOnlineError(null);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      sonkoAudio.setMuted(next);
      sonkoVoice.setMuted(next);
      return next;
    });
  }, []);

  // Enter / Space on bare Title Screen opens Quick Match cleanly if no modal is open
  useEffect(() => {
    const onTitleKey = (e: KeyboardEvent) => {
      if (
        hud.screen !== 'TITLE_MENU' ||
        mainMenuTab !== 'menu' ||
        stallOpen ||
        customizerOpen ||
        onlineLobbyOpen ||
        quickMatchOpen ||
        tourOpen ||
        achievementsOpen ||
        dailyStreakOpen ||
        settingsOpen ||
        titlePeekMode
      ) {
        return;
      }
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === 'Enter' || e.code === 'Space') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'BUTTON' && document.activeElement?.id !== 'home-quick-match-btn') return;
        e.preventDefault();
        setQuickMatchOpen(true);
      }
    };
    window.addEventListener('keydown', onTitleKey);
    return () => window.removeEventListener('keydown', onTitleKey);
  }, [
    hud.screen,
    mainMenuTab,
    stallOpen,
    customizerOpen,
    onlineLobbyOpen,
    quickMatchOpen,
    tourOpen,
    achievementsOpen,
    dailyStreakOpen,
    settingsOpen,
    titlePeekMode,
  ]);

  // Quick Match Camera Cycle shortcut ('C') during PLAYING
  useEffect(() => {
    if (hud.screen !== 'PLAYING') return;
    const quickPresets: CompoundCameraPreset[] = ['play', 'aim_target', 'top_aim', 'courtyard'];
    const onCamKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.code === 'KeyC' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        setMatchCamera((prev) => {
          const idx = quickPresets.indexOf(prev);
          const next = quickPresets[(idx + 1) % quickPresets.length];
          compoundRef.current?.setCameraPreset(next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', onCamKey);
    return () => window.removeEventListener('keydown', onCamKey);
  }, [hud.screen]);

  const activePlayer = hud.players[hud.activePlayerIndex] ?? hud.players[0];
  const balanceStateLabel =
    hud.balance >= 65 ? 'STEADY' : hud.balance >= 35 ? 'WOBBLE' : 'DANGER';
  const balanceTextColor =
    hud.balance >= 65
      ? 'text-emerald-300'
      : hud.balance >= 35
        ? 'text-amber-300'
        : 'text-red-300';

  const isHopPhase =
    hud.phase === 'HOP_OUT' ||
    hud.phase === 'HOP_BACK' ||
    hud.phase === 'HOP_EXIT' ||
    hud.phase === 'PICKUP_STONE';

  const isAimPhase = hud.phase === 'TOSS_AIM' || hud.phase === 'CLAIM_AIM';

  const isLocalTurn =
    !activePlayer.isBot &&
    !(hud.mode === 'ONLINE_1V1' && hud.activePlayerIndex !== hud.onlineLocalSlot);

  const activeVenueSpec = getVenueSpec(hud.venue);
  const activePlaceSpec = getPlaceSpec(selectedPlace);
  const venuesConquered = COURT_VENUES.filter((v) => (progression.tourWins[v.id] ?? 0) > 0).length;
  const achievementsUnlockedCount = ACHIEVEMENT_CATALOG.filter((a) =>
    Boolean(progression.unlockedAchievements?.[a.id])
  ).length;
  const quickModeLabel =
    selectedMode === 'SOLO'
      ? 'Solo'
      : selectedMode === 'TEAM_2V2'
        ? '2v2'
        : selectedMode === 'TWO_PLAYER'
          ? '2P Local'
          : 'VS Bot';

  const activeViewportPose: CharacterViewportPose =
    hud.screen === 'TITLE_MENU'
      ? characterPose
      : hud.screen === 'GAME_OVER'
        ? 'victory'
        : hud.screen === 'PLAYING'
          ? hud.phase === 'ROUND_CLEAR' || hud.phase === 'TURN_HOME'
            ? 'landing'
            : isHopPhase
              ? hud.balance < 55
                ? 'balancing'
                : 'hopping'
              : 'idle'
          : 'idle';

  const activeSlotName = (['kato', 'namukasa', 'ssemakula', 'auma'] as const)[
    hud.activePlayerIndex % 4
  ];
  const activeViewportSpeech: SpeechState =
    hud.screen === 'TITLE_MENU'
      ? characterSpeech
      : (hud.speechStates?.[activeSlotName] ?? 'silent');

  const todayDateKey = getLocalDateKey();
  const bonusChestAvailable =
    !progression.monetization.bonusChestClaimedDates.includes(todayDateKey) &&
    !(monetizationStatus?.dateKey === todayDateKey && monetizationStatus.bonusChestClaimedToday);
  const missionRerollAvailable =
    !progression.monetization.missionRerollDates.includes(todayDateKey) &&
    !(monetizationStatus?.dateKey === todayDateKey && monetizationStatus.missionRerollUsedToday) &&
    progression.dailyMission.rerolledOnDate !== todayDateKey;
  const isDoubleMatchClaimed = Boolean(
    doubleMatchClaimedAmount !== null ||
      (currentMatchId &&
        (progression.monetization.claimedDoubleMatchIds.includes(currentMatchId) ||
          monetizationStatus?.claimedMatchIds.includes(currentMatchId)))
  );

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#1A0D08] text-[#FAF3E8]">
      {/* Unified Full-Viewport 3D Ugandan Compound & Game Engine */}
      <UgandanCompoundViewport
        ref={compoundRef}
        screen={hud.screen}
        pose={activeViewportPose}
        onPoseChange={setCharacterPose}
        speechState={activeViewportSpeech}
        onSpeechStateChange={setCharacterSpeech}
        cameraPreset={matchCamera}
        onCameraPresetChange={setMatchCamera}
        daylight={selectedPeriod}
        onDaylightChange={setSelectedPeriod}
        weatherMode={selectedWeatherMode}
        onWeatherModeChange={setSelectedWeatherMode}
        graphicsSettings={{
          shadowsEnabled: settings.shadowsEnabled,
          dustEnabled: settings.dustEnabled,
          dynamicWeather: settings.dynamicWeather,
          pixelRatioScale: settings.pixelRatioScale,
          cameraShake: settings.cameraShake,
          defaultCamera: settings.defaultCamera,
        }}
        onStudioAvailabilityChange={setStudioAvailable}
        onArrivalPlayingChange={setArrivalPlaying}
        equippedStone={progression.equippedStone}
        equippedOutfit={progression.equippedOutfit}
        equippedStencil={progression.equippedStencil}
        avatar={progression.avatar}
        previewVenue={selectedVenue}
        previewPlace={selectedPlace}
        previewCourtSize={selectedCourtSize}
        onHudChange={handleHudChange}
        onMatchComplete={handleMatchComplete}
      />

      {/* GAME HOME HUB OVERLAY ON TOP OF LIVE 3D COURTYARD */}
      {hud.screen === 'TITLE_MENU' && (
        <section
          aria-label="Sonko Game Home Hub"
          className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between overflow-y-auto"
        >
          {/* Left-weighted warm gradient scrim so 3D characters & courtyard breathe on the right */}
          {!titlePeekMode && (
            <div
              className="pointer-events-none fixed inset-0 -z-10"
              style={{
                background:
                  'linear-gradient(90deg, rgba(22,10,6,0.90) 0%, rgba(26,12,7,0.72) 34%, rgba(26,12,7,0.18) 62%, rgba(26,12,7,0.04) 100%)',
              }}
            />
          )}

          {/* Top Bar: Daily Streak, Sound, Install, Inspect 3D Yard */}
          <div className="px-5 sm:px-10 pt-4 flex items-center justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setJustClaimedDaily(null);
                setDailyStreakOpen(true);
              }}
              aria-label={`Daily login streak: ${progression.dailyStreak.currentStreak} ${
                progression.dailyStreak.currentStreak === 1 ? 'day' : 'days'
              }. Open reward calendar`}
              className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2D170F]/95 hover:bg-[#3B1E14] border border-amber-400/45 text-xs font-semibold text-amber-200 hover:text-amber-100 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span className="font-mono-num">
                {progression.dailyStreak.currentStreak}{' '}
                {progression.dailyStreak.currentStreak === 1 ? 'Day Streak' : 'Days Streak'}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A0B07]/90 hover:bg-[#2E160E] border border-[#FAF3E8]/20 text-xs font-medium text-[#E5D3BE] hover:text-white cursor-pointer"
            >
              {muted ? (
                <VolumeX className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              )}
              <span>{muted ? 'Muted' : 'Audio'}</span>
            </button>

            <div className="pointer-events-auto">
              <PWAInstallButton variant="title" />
            </div>

            <button
              type="button"
              onClick={() => setTitlePeekMode((v) => !v)}
              className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A0B07]/90 hover:bg-[#2E160E] border border-[#FAF3E8]/20 text-xs font-medium text-[#E5D3BE] hover:text-white cursor-pointer"
            >
              {titlePeekMode ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                  <span>Show Menu</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                  <span>Inspect 3D Yard</span>
                </>
              )}
            </button>
          </div>

          {!titlePeekMode ? (
            <div className="flex-1 flex items-center px-5 sm:px-10 lg:px-14 py-4">
              <div className="pointer-events-auto w-full max-w-lg flex flex-col items-start gap-4">
                <SonkoTitleLockup />

                {/* Main Menu View Toggle: Courtyard Menu vs Global Top 10 */}
                <div
                  role="tablist"
                  aria-label="Main Menu Section"
                  className="inline-grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#180A06]/92 border border-[#FAF3E8]/18"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mainMenuTab === 'menu'}
                    onClick={() => setMainMenuTab('menu')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      mainMenuTab === 'menu'
                        ? 'bg-[#F59E0B] text-[#1A0B07]'
                        : 'text-[#E5D3BE]/85 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Courtyard Menu
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mainMenuTab === 'leaderboard'}
                    onClick={() => setMainMenuTab('leaderboard')}
                    className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      mainMenuTab === 'leaderboard'
                        ? 'bg-[#F59E0B] text-[#1A0B07]'
                        : 'text-[#E5D3BE]/85 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Global Leaderboard</span>
                  </button>
                </div>

                {mainMenuTab === 'leaderboard' ? (
                  <GlobalLeaderboard
                    playerId={leaderboardPlayerId}
                    playerName={onlineName}
                    onPlayerNameChange={handlePlayerNameChange}
                    bestScore={progression.stats.bestScore}
                    totalWins={progression.stats.matchesWon}
                    totalBullseyes={progression.stats.totalBullseyes}
                    totalHouses={progression.stats.totalHouses}
                    preferredVenue={selectedVenue}
                    preferredMode={selectedMode}
                    onPlayNow={() => {
                      setMainMenuTab('menu');
                      setQuickMatchOpen(true);
                    }}
                  />
                ) : (
                  <>
                    <p className="text-sm leading-relaxed text-[#F3E6D6]/90 max-w-md">
                      Toss your river stone cleanly, hop across the sunlit compound on one foot,
                      scoop on return, and claim your House.
                    </p>

                    {/* Main Game Home Menu Cards */}
                    <nav
                      aria-label="Main Navigation"
                      className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                    >
                      {/* 1. Quick Match */}
                      <button
                        id="home-quick-match-btn"
                        type="button"
                        onClick={() => setQuickMatchOpen(true)}
                        className="group text-left p-4 rounded-xl bg-[#D97706] hover:bg-[#EA8A1A] active:translate-y-px border border-[#FBBF24] text-[#1A0B07] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 flex items-start gap-3 shadow-lg"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#1A0B07]/15 flex items-center justify-center shrink-0 mt-0.5">
                          <Play className="w-5 h-5 fill-current" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-display font-extrabold text-base leading-tight">
                            Quick Match
                          </div>
                          <div className="text-xs font-semibold text-[#1A0B07]/80 truncate mt-1">
                            {quickModeLabel} · {activePlaceSpec.name}
                          </div>
                        </div>
                      </button>

                      {/* 2. Story / Uganda Tour */}
                      <button
                        type="button"
                        onClick={() => setTourOpen(true)}
                        className="group text-left p-4 rounded-xl bg-[#1C0D08]/92 hover:bg-[#2E160E] border border-amber-400/35 hover:border-amber-400/70 text-[#FAF3E8] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 flex items-start gap-3"
                      >
                        <div className="w-9 h-9 rounded-lg bg-amber-400/15 border border-amber-400/25 flex items-center justify-center shrink-0 mt-0.5">
                          <Compass className="w-5 h-5 text-amber-300" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-display font-bold text-base leading-tight">
                            Story / Uganda Tour
                          </div>
                          <div className="text-xs text-[#E5D3BE]/75 truncate mt-1">
                            Tour Stamps {venuesConquered}/4 · 4 Stops
                          </div>
                        </div>
                      </button>

                      {/* 3. Online 1v1 */}
                      <button
                        type="button"
                        onClick={handleOpenOnlineLobby}
                        className="group text-left p-4 rounded-xl bg-[#1C0D08]/92 hover:bg-[#2E160E] border border-[#FAF3E8]/15 hover:border-amber-400/50 text-[#FAF3E8] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 flex items-start gap-3"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#2D170F] border border-[#FAF3E8]/12 flex items-center justify-center shrink-0 mt-0.5">
                          <Globe className="w-5 h-5 text-amber-300" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-display font-bold text-base leading-tight">
                            Online 1v1
                          </div>
                          <div className="text-xs text-[#E5D3BE]/75 truncate mt-1">
                            {isOnline ? 'Room codes & live duels' : 'Offline — reconnect to play'}
                          </div>
                        </div>
                      </button>

                      {/* 4. Wardrobe & Courtyard Stall */}
                      <button
                        type="button"
                        onClick={() => setStallOpen(true)}
                        className="group text-left p-4 rounded-xl bg-[#1C0D08]/92 hover:bg-[#2E160E] border border-[#FAF3E8]/15 hover:border-amber-400/50 text-[#FAF3E8] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 flex items-start gap-3"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#2D170F] border border-[#FAF3E8]/12 flex items-center justify-center shrink-0 mt-0.5">
                          <ShoppingBag className="w-5 h-5 text-amber-300" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-display font-bold text-base leading-tight">
                            Wardrobe &amp; Stall
                          </div>
                          <div className="text-xs text-amber-200/90 font-mono-num truncate mt-1">
                            {progression.cowries} Cowries · Gear &amp; Hair
                          </div>
                        </div>
                      </button>

                      {/* 5. Achievements */}
                      <button
                        type="button"
                        onClick={() => setAchievementsOpen(true)}
                        className="group text-left p-4 rounded-xl bg-[#1C0D08]/92 hover:bg-[#2E160E] border border-amber-400/25 hover:border-amber-400/60 text-[#FAF3E8] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 flex items-start gap-3"
                      >
                        <div className="w-9 h-9 rounded-lg bg-amber-400/15 border border-amber-400/25 flex items-center justify-center shrink-0 mt-0.5">
                          <Trophy className="w-5 h-5 text-amber-300" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-display font-bold text-base leading-tight">
                            Achievements
                          </div>
                          <div className="text-xs text-amber-200/85 font-mono-num truncate mt-1">
                            {achievementsUnlockedCount}/{ACHIEVEMENT_CATALOG.length} Badges · Cowrie
                            Rewards
                          </div>
                        </div>
                      </button>

                      {/* 6. Settings */}
                      <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        className="group text-left p-4 rounded-xl bg-[#1C0D08]/92 hover:bg-[#2E160E] border border-[#FAF3E8]/15 hover:border-amber-400/50 text-[#FAF3E8] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 flex items-start gap-3"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#2D170F] border border-[#FAF3E8]/12 flex items-center justify-center shrink-0 mt-0.5">
                          <Settings className="w-5 h-5 text-amber-300" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-display font-bold text-base leading-tight">
                            Settings
                          </div>
                          <div className="text-xs text-[#E5D3BE]/75 truncate mt-1 capitalize">
                            {settings.graphicsQuality} Quality · Audio &amp; Camera
                          </div>
                        </div>
                      </button>

                      {/* 7. Creator Studio (only visible when unlocked / dev mode enabled) */}
                      {studioAvailable && (
                        <button
                          type="button"
                          onClick={() => compoundRef.current?.openCreatorStudio()}
                          className="group text-left p-4 rounded-xl bg-[#1C0D08]/92 hover:bg-[#2E160E] border border-amber-400/30 hover:border-amber-400/70 text-[#FAF3E8] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 flex items-start gap-3"
                        >
                          <div className="w-9 h-9 rounded-lg bg-amber-400/15 border border-amber-400/25 flex items-center justify-center shrink-0 mt-0.5">
                            <SlidersHorizontal className="w-5 h-5 text-amber-300" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-display font-bold text-base leading-tight">
                              Creator Studio
                            </div>
                            <div className="text-xs text-[#E5D3BE]/75 truncate mt-1">
                              Models, Surfaces &amp; Voices
                            </div>
                          </div>
                        </button>
                      )}
                    </nav>

                    {/* Active Daily Mission Card */}
                    <DailyMissionCard
                      missionState={progression.dailyMission}
                      onStartMission={() => setQuickMatchOpen(true)}
                      onRerollMission={handleRerollDailyMission}
                      rerollAvailable={missionRerollAvailable}
                      rerollLoading={rerollLoading}
                      rerollMessage={rerollMessage}
                    />

                    {/* Cowries & Career Stats Line */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#E5D3BE]/85 font-mono-num">
                      <span className="inline-flex items-center gap-1.5 text-amber-200 font-semibold">
                        <CowrieIcon className="w-4 h-4" />
                        <span>{progression.cowries} Cowries</span>
                      </span>
                      <span aria-hidden="true" className="text-[#FAF3E8]/30">
                        ·
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setJustClaimedDaily(null);
                          setDailyStreakOpen(true);
                        }}
                        className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 font-semibold cursor-pointer"
                      >
                        <Flame className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                        <span>{progression.dailyStreak.currentStreak}d Streak</span>
                      </button>
                      <span aria-hidden="true" className="text-[#FAF3E8]/30">
                        ·
                      </span>
                      <span>
                        Wins {progression.stats.matchesWon}/{progression.stats.matchesPlayed}
                      </span>
                      <span aria-hidden="true" className="text-[#FAF3E8]/30">
                        ·
                      </span>
                      <span>Best {progression.stats.bestScore} pts</span>
                      <span aria-hidden="true" className="text-[#FAF3E8]/30">
                        ·
                      </span>
                      <span>{selectedCourtSize} Squares</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Inspect 3D Yard Mode: keep ALL 8 cameras + all 5 World Places immediately accessible */
            <div className="flex-1 flex flex-col items-center justify-end gap-2 px-4 pb-16 pointer-events-none">
              <div
                role="group"
                aria-label="Inspect 3D world places"
                className="pointer-events-auto bg-[#1B100C]/92 border border-[#FAF3E8]/18 rounded-xl p-1.5 flex items-center gap-1 flex-wrap justify-center max-w-3xl shadow-xl"
              >
                <span className="inline-flex items-center gap-1.5 px-2 text-xs font-medium text-amber-300">
                  <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Worlds</span>
                </span>
                {WORLD_PLACES.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => handleSelectPlace(pl.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      selectedPlace === pl.id
                        ? 'bg-[#D97706] text-[#1A0B07] font-semibold'
                        : 'text-[#E5D3BE]/85 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {pl.shortName}
                  </button>
                ))}
                {selectedPlace === 'primary_schoolyard' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (arrivalPlaying) {
                        compoundRef.current?.skipArrivalSequence();
                      } else {
                        compoundRef.current?.playArrivalSequence();
                      }
                    }}
                    className="ml-1 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#071A0E] text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" aria-hidden="true" />
                    <span>{arrivalPlaying ? 'Skip Drive' : 'Car Arrival'}</span>
                  </button>
                )}
              </div>

              <div
                role="group"
                aria-label="Inspect 3D courtyard cameras"
                className="pointer-events-auto bg-[#1B100C]/92 border border-[#FAF3E8]/18 rounded-xl p-1.5 flex items-center gap-1 flex-wrap justify-center max-w-3xl shadow-xl"
              >
                <span className="inline-flex items-center gap-1.5 px-2 text-xs font-medium text-amber-300">
                  <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Cameras</span>
                </span>
                {ALL_INSPECT_CAMERAS.map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => {
                      setMatchCamera(cam.id);
                      compoundRef.current?.setCameraPreset(cam.id);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      matchCamera === cam.id
                        ? 'bg-[#D97706] text-[#1A0B07] font-semibold'
                        : 'text-[#E5D3BE]/85 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Control Hint & Policy Navigation Line */}
          <footer className="px-5 sm:px-10 lg:px-14 pb-4 pt-2 pointer-events-auto">
            <div className="max-w-4xl border-t border-[#FAF3E8]/15 pt-2.5 text-xs text-[#E5D3BE]/80 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Hold Click or Space to Toss</span>
                <span aria-hidden="true">·</span>
                <span>Click Tile or Space to Hop</span>
                <span aria-hidden="true">·</span>
                <span>A / D Steer Balance</span>
                <span aria-hidden="true">·</span>
                <span>Right-Drag Orbit</span>
                <span aria-hidden="true">·</span>
                <span>H View Bar</span>
              </div>
              <nav
                aria-label="Game guide and legal pages"
                className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px]"
              >
                <a href="/how-to-play" className="text-amber-300/90 hover:text-amber-200 underline underline-offset-2">
                  How to Play
                </a>
                <a href="/about" className="text-amber-300/90 hover:text-amber-200 underline underline-offset-2">
                  About
                </a>
                <a href="/privacy-policy" className="text-amber-300/90 hover:text-amber-200 underline underline-offset-2">
                  Privacy Policy
                </a>
                <a href="/terms" className="text-amber-300/90 hover:text-amber-200 underline underline-offset-2">
                  Terms
                </a>
                <a href="/contact" className="text-amber-300/90 hover:text-amber-200 underline underline-offset-2">
                  Contact
                </a>
              </nav>
            </div>
          </footer>
        </section>
      )}

      {/* ACTIVE PLAYING HUD (Low-occlusion, pointer-events-none wrapper, no backdrop-filter) */}
      {hud.screen === 'PLAYING' && (
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
          {/* Top Perimeter Clusters */}
          <div className="flex items-start justify-between gap-4">
            {/* Top-Left: Player / Team Status & Score */}
            <div className="bg-[#1F100B]/90 border border-[#FAF3E8]/15 rounded-lg px-3.5 py-2.5 flex flex-col gap-1.5">
              {hud.mode === 'TEAM_2V2' ? (
                ([0, 1] as const).map((teamId) => {
                  const isTeamTurn = activePlayer?.teamId === teamId;
                  const teamHouses = Object.values(hud.houses).filter((o) => o === teamId).length;
                  const teamLabel =
                    teamId === 0 ? 'Team Cranes (You & Kato)' : 'Team Waves (Amina & Mugisha)';
                  return (
                    <div
                      key={teamId}
                      className={`flex items-center gap-2.5 text-xs sm:text-sm ${
                        isTeamTurn ? 'text-[#FAF3E8] font-semibold' : 'text-[#E5D3BE]/65'
                      }`}
                    >
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-sm shrink-0 ${
                          teamId === 0 ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate max-w-[180px]">
                        {isTeamTurn ? `${activePlayer.name}` : teamLabel}
                      </span>
                      {isTeamTurn && (
                        <span className="text-[11px] font-mono-num text-amber-300">TURN</span>
                      )}
                      <span aria-hidden="true" className="text-[#FAF3E8]/30">
                        ·
                      </span>
                      <span className="font-mono-num">
                        Sq {hud.teamTargets[teamId]}/{hud.courtSize}
                      </span>
                      <span aria-hidden="true" className="text-[#FAF3E8]/30">
                        ·
                      </span>
                      <span className="font-mono-num">Houses {teamHouses}</span>
                      <span aria-hidden="true" className="text-[#FAF3E8]/30">
                        ·
                      </span>
                      <span className="font-mono-num text-amber-200">
                        {hud.teamScores[teamId]} pts
                      </span>
                    </div>
                  );
                })
              ) : (
                hud.players.map((p, idx) => {
                  const isTurn = hud.activePlayerIndex === idx;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2.5 text-xs sm:text-sm ${
                        isTurn ? 'text-[#FAF3E8] font-semibold' : 'text-[#E5D3BE]/65'
                      }`}
                    >
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-sm shrink-0 ${
                          p.teamId === 0 ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate max-w-[110px]">{p.name}</span>
                      {isTurn && (
                        <span className="text-[11px] font-mono-num text-amber-300">TURN</span>
                      )}
                      <span aria-hidden="true" className="text-[#FAF3E8]/30">
                        ·
                      </span>
                      <span className="font-mono-num">
                        Sq {p.targetSquare}/{hud.courtSize}
                      </span>
                      <span aria-hidden="true" className="text-[#FAF3E8]/30">
                        ·
                      </span>
                      <span className="font-mono-num">Houses {p.housesOwned.length}</span>
                      <span aria-hidden="true" className="text-[#FAF3E8]/30">
                        ·
                      </span>
                      <span className="font-mono-num text-amber-200">{p.score} pts</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Top-Right: Online Room Code, Venue Condition, Balance Readout + Controls */}
            <div className="flex items-center gap-2 pointer-events-auto">
              {hud.mode === 'ONLINE_1V1' && hud.onlineRoomCode && (
                <div className="hidden sm:flex items-center gap-2 bg-[#1F100B]/90 border border-amber-400/30 rounded-lg px-3 py-2.5 text-xs">
                  <Globe className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                  <span className="font-mono-num font-semibold text-amber-200">
                    {hud.onlineRoomCode}
                  </span>
                  {hud.onlineOpponentConnected === false && (
                    <span className="text-red-300">· Reconnecting</span>
                  )}
                </div>
              )}

              <div className="hidden md:flex items-center gap-2 bg-[#1F100B]/90 border border-[#FAF3E8]/15 rounded-lg px-3 py-2.5 text-xs">
                <span className="font-semibold text-[#FAF3E8]">{activeVenueSpec.shortName}</span>
                <span aria-hidden="true" className="text-[#FAF3E8]/30">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 text-amber-200 font-medium">
                  {hud.weatherCondition === 'storm_shower' ? (
                    <CloudRain className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
                  ) : hud.weatherCondition === 'light_rain' ? (
                    <CloudDrizzle className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
                  ) : hud.weatherCondition === 'misty_dew' ? (
                    <CloudFog className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
                  ) : hud.weatherCondition === 'breezy' ? (
                    <Wind className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                  )}
                  <span>{hud.weatherLabel}</span>
                </span>
                {Math.abs(hud.windX) > 0.008 && (
                  <>
                    <span aria-hidden="true" className="text-[#FAF3E8]/30">
                      ·
                    </span>
                    <span className="inline-flex items-center gap-1 text-sky-300 font-mono-num">
                      <Wind className="w-3 h-3" aria-hidden="true" />
                      <span>
                        {hud.windX >= 0 ? '→' : '←'} {Math.round(Math.abs(hud.windX) * 100)}
                      </span>
                    </span>
                  </>
                )}
                {hud.puddleSquares.length > 0 && (
                  <>
                    <span aria-hidden="true" className="text-[#FAF3E8]/30">
                      ·
                    </span>
                    <span className="text-sky-200 font-mono-num">
                      {hud.puddleSquares.length} Puddles
                    </span>
                  </>
                )}
              </div>

              <div className="hidden sm:flex items-center gap-2.5 bg-[#1F100B]/90 border border-[#FAF3E8]/15 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm">
                <Footprints className="w-4 h-4 text-amber-300" aria-hidden="true" />
                <span className="text-[#E5D3BE]/80">Balance</span>
                <span className={`font-mono-num font-semibold ${balanceTextColor}`}>
                  {hud.balance}% · {balanceStateLabel}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const quickPresets: CompoundCameraPreset[] = ['play', 'aim_target', 'top_aim', 'courtyard'];
                  setMatchCamera((prev) => {
                    const idx = quickPresets.indexOf(prev);
                    const next = quickPresets[(idx + 1) % quickPresets.length];
                    compoundRef.current?.setCameraPreset(next);
                    return next;
                  });
                }}
                aria-label="Switch match camera angle"
                className="sm:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#1F100B]/90 hover:bg-[#331B13] border border-[#FAF3E8]/15 text-[#FAF3E8] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                <Camera className="w-4 h-4 text-amber-300" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#1F100B]/90 hover:bg-[#331B13] border border-[#FAF3E8]/15 text-[#FAF3E8] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                {muted ? (
                  <VolumeX className="w-4 h-4 text-amber-300" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-4 h-4 text-amber-300" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={() => compoundRef.current?.pauseGame()}
                aria-label="Pause game"
                className="min-w-[44px] min-h-[44px] px-3 flex items-center gap-1.5 rounded-lg bg-[#1F100B]/90 hover:bg-[#331B13] border border-[#FAF3E8]/15 text-xs sm:text-sm font-medium text-[#FAF3E8] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                <Pause className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Pause</span>
              </button>
            </div>
          </div>

          {/* Bottom Perimeter Prompt, Power Gauge & Mobile Touch Controls */}
          <div className="flex flex-col items-center gap-2">
            {isAimPhase && isLocalTurn && (
              <div className="bg-[#1F100B]/90 border border-[#FAF3E8]/15 rounded-lg px-3.5 py-2 flex items-center gap-3 w-64">
                <span className="text-[11px] font-semibold text-amber-200 whitespace-nowrap">
                  TOSS POWER
                </span>
                <div className="flex-1 h-2.5 bg-[#120805] rounded-full overflow-hidden border border-[#FAF3E8]/15">
                  <div
                    className="h-full transition-[width] duration-75"
                    style={{
                      width: `${Math.round(hud.aimPower * 100)}%`,
                      backgroundColor: hud.isCharging ? '#FBBF24' : '#D97706',
                    }}
                  />
                </div>
                <span className="font-mono-num text-xs text-[#FAF3E8] w-9 text-right">
                  {Math.round(hud.aimPower * 100)}%
                </span>
              </div>
            )}

            <div className="w-full flex items-end justify-between gap-3">
              <div className="flex items-end gap-2">
                {isHopPhase && isLocalTurn && (
                  <button
                    type="button"
                    onClick={() => compoundRef.current?.nudgeBalance(-1)}
                    aria-label="Lean left to balance"
                    className="pointer-events-auto sm:hidden min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg bg-[#1F100B]/90 border border-[#FAF3E8]/20 text-[#FAF3E8] active:scale-95"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}

                {/* Quick In-Match Camera Switcher to see exact throw targets cleanly */}
                <div
                  role="group"
                  aria-label="Quick match camera angle"
                  className="pointer-events-auto hidden sm:flex items-center gap-1 p-1 bg-[#1F100B]/92 border border-[#FAF3E8]/15 rounded-lg"
                >
                  <Camera className="w-3.5 h-3.5 text-amber-300 ml-1.5 mr-0.5" aria-hidden="true" />
                  {(
                    [
                      { id: 'play', label: 'Dynamic' },
                      { id: 'aim_target', label: 'Aim' },
                      { id: 'top_aim', label: 'Top' },
                      { id: 'courtyard', label: 'Side' },
                    ] as const
                  ).map((cam) => (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => {
                        setMatchCamera(cam.id);
                        compoundRef.current?.setCameraPreset(cam.id);
                      }}
                      className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        matchCamera === cam.id
                          ? 'bg-[#D97706] text-[#1A0B07] font-semibold'
                          : 'text-[#E5D3BE]/85 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {cam.label}
                    </button>
                  ))}
                  <span className="text-[10px] text-[#E5D3BE]/55 px-1 font-mono-num">C</span>
                </div>
              </div>

              {!arrivalPlaying && (
                <div className="mx-auto bg-[#1F100B]/90 border border-[#FAF3E8]/15 rounded-lg px-4 py-2 text-xs sm:text-sm text-center text-[#FAF3E8] max-w-xl">
                  <span className={hud.foulReason ? 'text-red-300 font-medium' : 'text-[#FAF3E8]'}>
                    {hud.statusBanner}
                  </span>
                </div>
              )}

              <div className="flex items-end gap-2">
                {isHopPhase && isLocalTurn ? (
                  <div className="pointer-events-auto sm:hidden flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => compoundRef.current?.triggerAction()}
                      className="px-3 min-h-[48px] rounded-lg bg-[#D97706] text-[#1A0B07] font-bold text-xs active:scale-95"
                    >
                      {hud.phase === 'PICKUP_STONE' ? 'Scoop' : 'Hop'}
                    </button>
                    <button
                      type="button"
                      onClick={() => compoundRef.current?.nudgeBalance(1)}
                      aria-label="Lean right to balance"
                      className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg bg-[#1F100B]/90 border border-[#FAF3E8]/20 text-[#FAF3E8] active:scale-95"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="hidden sm:block w-36" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {hud.screen === 'PAUSED' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Game Paused"
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 p-4"
        >
          <div className="w-full max-w-sm bg-[#24120C] border border-[#FAF3E8]/20 rounded-xl p-6 flex flex-col gap-5">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#FAF3E8]">Game Paused</h2>
              <p className="text-sm text-[#E5D3BE]/75 mt-1">
                {hud.mode === 'SOLO'
                  ? 'Solo Mastery'
                  : hud.mode === 'VS_BOT'
                    ? 'Match vs Amina'
                    : hud.mode === 'TEAM_2V2'
                      ? '2v2 Teams (Cranes vs Waves)'
                      : hud.mode === 'ONLINE_1V1'
                        ? `Online Room ${hud.onlineRoomCode ?? ''}`
                        : '2-Player Courtyard Match'}{' '}
                · Turn {hud.turnCount}
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => compoundRef.current?.resumeGame()}
                className="w-full py-3 px-4 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Resume
              </button>
              {hud.mode !== 'ONLINE_1V1' && (
                <button
                  type="button"
                  onClick={() => compoundRef.current?.restartGame()}
                  className="w-full py-3 px-4 rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-[#FAF3E8]/15 text-[#FAF3E8] font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  Restart Match
                </button>
              )}
              <button
                type="button"
                onClick={() => setAchievementsOpen(true)}
                className="w-full py-3 px-4 rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-[#FAF3E8]/15 text-[#FAF3E8] font-medium text-sm transition-colors cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-2"
              >
                <Trophy className="w-4 h-4 text-amber-300" aria-hidden="true" />
                <span>
                  Achievements ({achievementsUnlockedCount}/{ACHIEVEMENT_CATALOG.length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="w-full py-3 px-4 rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-[#FAF3E8]/15 text-[#FAF3E8] font-medium text-sm transition-colors cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4 text-amber-300" aria-hidden="true" />
                <span>Settings</span>
              </button>
              <PWAInstallButton variant="compact" />
              <button
                type="button"
                onClick={() => {
                  setOnlineRoom(null);
                  setOnlineSlot(null);
                  compoundRef.current?.returnToTitle();
                }}
                className="w-full py-3 px-4 rounded-lg bg-transparent hover:bg-white/5 border border-[#FAF3E8]/15 text-[#E5D3BE] font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY / GAME OVER MODAL */}
      {hud.screen === 'GAME_OVER' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Match Results"
          className="pointer-events-none absolute inset-0 z-40 flex items-end md:items-center justify-center md:justify-start md:pl-10 lg:pl-14 bg-gradient-to-r from-[#120805]/80 via-[#120805]/35 to-transparent p-4"
        >
          <div className="pointer-events-auto w-full max-w-md bg-[#24120C]/95 border border-[#FAF3E8]/20 rounded-xl p-7 flex flex-col gap-6 shadow-2xl">
            <div>
              <div className="text-xs font-medium text-amber-300">
                {hud.mode === 'ONLINE_1V1'
                  ? hud.winnerTeamId === hud.onlineLocalSlot
                    ? 'Courtyard Champion'
                    : 'Match Complete'
                  : hud.winnerTeamId === 0
                    ? 'Courtyard Champion'
                    : 'Match Complete'}
              </div>
              <h2 className="font-display text-3xl font-bold text-[#FAF3E8] mt-1">
                {hud.winnerLabel ?? 'Round Complete'}
              </h2>
              {hud.winReason && (
                <p className="text-sm text-[#E5D3BE]/85 mt-1.5">{hud.winReason}</p>
              )}
            </div>

            <div className="border-t border-b border-[#FAF3E8]/12 py-4 flex flex-col gap-3">
              {hud.mode === 'TEAM_2V2' ? (
                ([0, 1] as const).map((teamId) => {
                  const members = hud.players.filter((pl) => pl.teamId === teamId);
                  const teamHouses = Object.values(hud.houses).filter((o) => o === teamId).length;
                  const teamBullseyes = members.reduce((s, m) => s + m.perfectTosses, 0);
                  return (
                    <div key={teamId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-sm ${
                            teamId === 0 ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="font-semibold text-[#FAF3E8]">
                          {teamId === 0
                            ? 'Team Cranes (You & Kato)'
                            : 'Team Waves (Amina & Mugisha)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs text-[#E5D3BE]/80 font-mono-num">
                        <span>{hud.teamScores[teamId]} pts</span>
                        <span aria-hidden="true">·</span>
                        <span>{teamHouses} Houses</span>
                        <span aria-hidden="true">·</span>
                        <span>{teamBullseyes} Bullseyes</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                hud.players.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-sm ${
                          p.teamId === 0 ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="font-semibold text-[#FAF3E8]">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#E5D3BE]/80 font-mono-num">
                      <span>{p.score} pts</span>
                      <span aria-hidden="true">·</span>
                      <span>{p.housesOwned.length} Houses</span>
                      <span aria-hidden="true">·</span>
                      <span>{p.perfectTosses} Bullseyes</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {hud.lastMatchReward && (
              <div className="bg-[#1A0B07]/80 border border-amber-400/25 rounded-lg p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-sm font-semibold text-amber-200">
                  <span className="inline-flex items-center gap-2">
                    <CowrieIcon className="w-4 h-4" />
                    <span>
                      Cowries Earned ({activeVenueSpec.shortName} ·{' '}
                      {hud.lastMatchReward.venueMultiplier}x)
                    </span>
                  </span>
                  <span className="font-mono-num">
                    +{hud.lastMatchReward.totalEarned + (doubleMatchClaimedAmount ?? 0)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#E5D3BE]/75 font-mono-num">
                  <span>Rounds +{hud.lastMatchReward.roundsCowries}</span>
                  <span aria-hidden="true">·</span>
                  <span>Bullseyes +{hud.lastMatchReward.bullseyeCowries}</span>
                  <span aria-hidden="true">·</span>
                  <span>Houses +{hud.lastMatchReward.housesCowries}</span>
                  <span aria-hidden="true">·</span>
                  <span>Bonus +{hud.lastMatchReward.winBonusCowries}</span>
                </div>

                {hud.lastMatchReward.totalEarned > 0 && currentMatchId && (
                  <div className="pt-1 border-t border-[#FAF3E8]/10 flex flex-col gap-1.5">
                    {isDoubleMatchClaimed ? (
                      <div className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-xs font-mono-num font-bold text-emerald-200">
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          2× Match Bonus Claimed (+
                          {doubleMatchClaimedAmount ?? hud.lastMatchReward.totalEarned} Cowries)
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleDoubleMatchCowries}
                        disabled={doubleMatchLoading}
                        className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#2D170F] hover:bg-[#3E2014] disabled:opacity-60 border border-amber-400/55 text-xs font-bold text-amber-200 transition-colors cursor-pointer disabled:cursor-wait"
                      >
                        <PlayCircle className="w-4 h-4 text-amber-300" aria-hidden="true" />
                        <span>
                          {doubleMatchLoading
                            ? 'Loading Sponsor Ad...'
                            : `Watch Ad for 2× Match Cowries (+${hud.lastMatchReward.totalEarned})`}
                        </span>
                      </button>
                    )}
                    {doubleMatchError && (
                      <p className="text-[11px] text-amber-200/90 text-center">{doubleMatchError}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {lastMatchMission && (
              <div className="bg-[#161B12] border border-emerald-400/50 rounded-lg p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Target className="w-4 h-4 text-emerald-300 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                      Daily Mission Complete!
                    </div>
                    <div className="text-xs font-semibold text-[#FAF3E8] truncate">
                      {lastMatchMission.description}
                    </div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 font-mono-num text-xs font-bold text-amber-200 shrink-0">
                  <CowrieIcon className="w-3.5 h-3.5" />
                  <span>+{lastMatchMission.cowrieReward}</span>
                </span>
              </div>
            )}

            {lastMatchBadges.length > 0 && (
              <div className="bg-[#2D170F] border border-amber-400/45 rounded-lg p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Badges Unlocked This Match</span>
                  </span>
                  <span className="font-mono-num">
                    +{lastMatchBadges.reduce((s, b) => s + b.cowrieReward, 0)} Cowries
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {lastMatchBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className="flex items-center justify-between gap-2 text-xs text-[#FAF3E8]"
                    >
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <AchievementGlyph
                          icon={badge.icon}
                          className="w-3.5 h-3.5 text-amber-300 shrink-0"
                        />
                        <span className="font-semibold truncate">{badge.title}</span>
                      </span>
                      <span className="font-mono-num text-amber-200 shrink-0">
                        +{badge.cowrieReward}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={interstitialBusy}
                onClick={() =>
                  void runPostMatchTransition(() => {
                    compoundRef.current?.restartGame();
                  })
                }
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] disabled:opacity-60 text-[#1A0B07] font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>
                  {hud.mode === 'ONLINE_1V1'
                    ? hud.onlineRematchVotes?.[hud.onlineLocalSlot ?? 0]
                      ? 'Waiting Rematch (1/2)'
                      : 'Rematch'
                    : 'Play Again'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStallOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-amber-400/30 text-amber-200 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                <span>Stall</span>
              </button>
              <button
                type="button"
                disabled={interstitialBusy}
                onClick={() =>
                  void runPostMatchTransition(() => {
                    setOnlineRoom(null);
                    setOnlineSlot(null);
                    compoundRef.current?.returnToTitle();
                  })
                }
                className="py-3 px-4 rounded-lg bg-[#381E14] hover:bg-[#49281B] disabled:opacity-60 border border-[#FAF3E8]/15 text-[#FAF3E8] font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK MATCH MODAL */}
      {quickMatchOpen && (
        <QuickMatchModal
          selectedMode={selectedMode}
          onSelectMode={setSelectedMode}
          selectedDifficulty={selectedDifficulty}
          onSelectDifficulty={setSelectedDifficulty}
          selectedCourtSize={selectedCourtSize}
          onSelectCourtSize={setSelectedCourtSize}
          selectedPlace={selectedPlace}
          onSelectPlace={handleSelectPlace}
          selectedPeriod={selectedPeriod}
          onSelectPeriod={setSelectedPeriod}
          selectedWeatherMode={selectedWeatherMode}
          onSelectWeatherMode={setSelectedWeatherMode}
          progression={progression}
          onStartMatch={handleStartQuickMatch}
          onClose={() => setQuickMatchOpen(false)}
        />
      )}

      {/* STORY / UGANDA TOUR MODAL */}
      {tourOpen && (
        <TourModal
          progression={progression}
          selectedVenue={selectedVenue}
          selectedCourtSize={selectedCourtSize}
          selectedDifficulty={selectedDifficulty}
          onSelectVenue={handleSelectVenue}
          onSelectCourtSize={setSelectedCourtSize}
          onSelectDifficulty={setSelectedDifficulty}
          onStartTourStop={handleStartTourStop}
          onClose={() => setTourOpen(false)}
        />
      )}

      {/* ACHIEVEMENTS MODAL */}
      {achievementsOpen && (
        <AchievementsModal
          progression={progression}
          onClose={() => setAchievementsOpen(false)}
        />
      )}

      {/* DAILY LOGIN STREAK MODAL */}
      {dailyStreakOpen && (
        <DailyStreakModal
          dailyStreak={progression.dailyStreak}
          justClaimed={justClaimedDaily}
          onClaimBonusChest={handleClaimBonusChest}
          bonusChestAvailable={bonusChestAvailable}
          bonusChestLoading={bonusChestLoading}
          bonusChestReward={bonusChestReward}
          bonusChestError={bonusChestError}
          onClose={() => {
            setDailyStreakOpen(false);
            setJustClaimedDaily(null);
            setBonusChestError(null);
          }}
        />
      )}

      {/* SETTINGS MODAL */}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onUpdateSettings={updateSettings}
          onResetDefaults={resetSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* COURTYARD STALL MODAL */}
      {stallOpen && (
        <CourtyardStallModal
          progression={progression}
          onClose={() => setStallOpen(false)}
          onOpenWardrobe={() => {
            setStallOpen(false);
            setCustomizerOpen(true);
          }}
          onBuyOrEquipStone={handleBuyOrEquipStone}
          onBuyOrEquipOutfit={handleBuyOrEquipOutfit}
          onBuyOrEquipStencil={handleBuyOrEquipStencil}
        />
      )}

      {/* CHARACTER CUSTOMIZER MODAL */}
      {customizerOpen && (
        <CharacterCustomizerModal
          progression={progression}
          onUpdateAvatar={handleUpdateAvatar}
          onOpenStall={() => {
            setCustomizerOpen(false);
            setStallOpen(true);
          }}
          onClose={() => setCustomizerOpen(false)}
        />
      )}

      {/* ONLINE 1V1 LOBBY MODAL */}
      {onlineLobbyOpen && (
        <OnlineLobbyModal
          playerName={onlineName}
          onPlayerNameChange={setOnlineName}
          selectedCourtSize={selectedCourtSize}
          selectedVenue={selectedVenue}
          initialJoinCode={inviteJoinCode}
          activeRoom={onlineRoom}
          yourSlot={onlineSlot}
          wsConnected={wsConnected}
          errorMessage={onlineError}
          onCreateRoom={handleCreateOnlineRoom}
          onJoinRoom={handleJoinOnlineRoom}
          onLeaveRoom={handleLeaveOnlineRoom}
          onClose={() => {
            if (onlineRoom?.status === 'WAITING') {
              handleLeaveOnlineRoom();
            }
            setOnlineLobbyOpen(false);
          }}
        />
      )}

      {/* ACHIEVEMENT UNLOCK TOASTS */}
      <AchievementToast items={toastAchievements} />

      {/* COOKIE & AD PERSONALIZATION CONSENT BANNER */}
      {hud.screen === 'TITLE_MENU' &&
        settings.adPersonalizationConsent === 'unset' &&
        !settingsOpen &&
        !stallOpen &&
        !customizerOpen &&
        !quickMatchOpen &&
        !tourOpen &&
        !achievementsOpen &&
        !dailyStreakOpen &&
        !onlineLobbyOpen && (
          <ConsentBanner
            onSelectConsent={(consent) =>
              updateSettings({ adPersonalizationConsent: consent })
            }
          />
        )}

      {/* DEVELOPMENT AD SIMULATOR OVERLAY */}
      <AdSimulatorModal />

      {/* OFFLINE CACHE CONNECTIVITY INDICATOR */}
      <OfflineIndicator />
    </main>
  );
}
