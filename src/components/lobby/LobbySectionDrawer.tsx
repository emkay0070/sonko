import React, { useState } from 'react';
import {
  Camera,
  Check,
  CloudRain,
  Compass,
  Globe,
  Play,
  SlidersHorizontal,
  Sun,
  Swords,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react';
import { Link } from '../../router';
import { ACHIEVEMENT_CATALOG } from '../../game/achievements';
import {
  COURT_VENUES,
  ProgressionData,
  WORLD_PLACES,
  WorldPlaceId,
} from '../../game/progression';
import { PeriodPreset } from '../../game/settings';
import { CourtSize, Difficulty, PlayMode, SpeechState, WeatherMode } from '../../game/types';
import { WEATHER_MODE_OPTIONS } from '../../game/weather';
import {
  CharacterViewportPose,
  CompoundCameraPreset,
} from '../UgandanCompoundViewport';
import { DailyMissionCard } from '../DailyMissionCard';
import { GlobalLeaderboard } from '../GlobalLeaderboard';
import { LobbyTabId } from './LobbyTopBar';

interface LobbySectionDrawerProps {
  activeTab: Exclude<LobbyTabId, 'HOME'>;
  onClose: () => void;
  // Shared match/world settings
  selectedMode: PlayMode;
  onSelectMode: (mode: PlayMode) => void;
  selectedDifficulty: Difficulty;
  onSelectDifficulty: (diff: Difficulty) => void;
  selectedCourtSize: CourtSize;
  onSelectCourtSize: (size: CourtSize) => void;
  selectedPlace: WorldPlaceId;
  onSelectPlace: (place: WorldPlaceId) => void;
  selectedPeriod: PeriodPreset;
  onSelectPeriod: (period: PeriodPreset) => void;
  selectedWeatherMode: WeatherMode;
  onSelectWeatherMode: (weather: WeatherMode) => void;
  // Camera & Actor stage inspection
  cameraPreset: CompoundCameraPreset;
  onSelectCamera: (cam: CompoundCameraPreset) => void;
  characterPose: CharacterViewportPose;
  onSelectPose: (pose: CharacterViewportPose) => void;
  characterSpeech: SpeechState;
  onSelectSpeech: (speech: SpeechState) => void;
  studioAvailable: boolean;
  onOpenStudio: () => void;
  onInspectFullYard: () => void;
  // Player & progression
  progression: ProgressionData;
  leaderboardPlayerId: string;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  isOnline: boolean;
  // Actions
  onStartMatch: () => void;
  onStartQuickMode: (mode: PlayMode) => void;
  onOpenQuickMatchSetup: () => void;
  onOpenTour: () => void;
  onOpenOnlineLobby: () => void;
  onJoinOnlineInvite: (code: string) => void;
  onOpenAchievements: () => void;
  onOpenWardrobe: () => void;
  onOpenStall: () => void;
  // Daily Mission
  missionRerollAvailable: boolean;
  rerollLoading: boolean;
  rerollMessage: string | null;
  onRerollDailyMission: () => void;
}

const WORLD_CAMERAS: Array<{ id: CompoundCameraPreset; label: string }> = [
  { id: 'lobby_world', label: 'Wide Yard' },
  { id: 'lobby_home', label: 'Hero Stage' },
  { id: 'characters', label: 'Cast Lineup' },
  { id: 'courtyard', label: 'Courtyard' },
  { id: 'veranda', label: 'Veranda' },
  { id: 'ground_low', label: 'Ground Low' },
  { id: 'overhead', label: 'Overhead' },
];

const SKY_OPTIONS: Array<{ id: PeriodPreset; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'morning', label: 'Morning' },
  { id: 'midday', label: 'Midday' },
  { id: 'golden', label: 'Golden' },
  { id: 'night', label: 'Night' },
];

const POSE_OPTIONS: Array<{ id: CharacterViewportPose; label: string }> = [
  { id: 'idle', label: 'Idle' },
  { id: 'hopping', label: 'Hopping' },
  { id: 'balancing', label: 'Balancing' },
  { id: 'landing', label: 'Landing' },
  { id: 'victory', label: 'Victory' },
];

const SPEECH_OPTIONS: Array<{ id: SpeechState; label: string }> = [
  { id: 'silent', label: 'Silent' },
  { id: 'cheering', label: 'Cheer' },
  { id: 'laughing', label: 'Laugh' },
  { id: 'banter', label: 'Banter' },
];

export function LobbySectionDrawer({
  activeTab,
  onClose,
  selectedMode,
  onSelectMode,
  selectedDifficulty,
  onSelectDifficulty,
  selectedCourtSize,
  onSelectCourtSize,
  selectedPlace,
  onSelectPlace,
  selectedPeriod,
  onSelectPeriod,
  selectedWeatherMode,
  onSelectWeatherMode,
  cameraPreset,
  onSelectCamera,
  characterPose,
  onSelectPose,
  characterSpeech,
  onSelectSpeech,
  studioAvailable,
  onOpenStudio,
  onInspectFullYard,
  progression,
  leaderboardPlayerId,
  playerName,
  onPlayerNameChange,
  isOnline,
  onStartMatch,
  onStartQuickMode,
  onOpenQuickMatchSetup,
  onOpenTour,
  onOpenOnlineLobby,
  onJoinOnlineInvite,
  onOpenAchievements,
  onOpenWardrobe,
  onOpenStall,
  missionRerollAvailable,
  rerollLoading,
  rerollMessage,
  onRerollDailyMission,
}: LobbySectionDrawerProps) {
  const [nameDraft, setNameDraft] = useState(playerName);
  const [roomCodeDraft, setRoomCodeDraft] = useState('');
  const [nameSavedNotice, setNameSavedNotice] = useState(false);

  const venuesConquered = COURT_VENUES.filter(
    (v) => (progression.tourWins[v.id] ?? 0) > 0
  ).length;
  const achievementsUnlocked = ACHIEVEMENT_CATALOG.filter((a) =>
    Boolean(progression.unlockedAchievements?.[a.id])
  ).length;
  const activePlaceSpec =
    WORLD_PLACES.find((p) => p.id === selectedPlace) ?? WORLD_PLACES[0];

  const tabMeta: Record<Exclude<LobbyTabId, 'HOME'>, { title: string; subtitle: string }> = {
    PLAY: {
      title: 'Play Ejjinja',
      subtitle: 'Quick Match, Solo Practice & Uganda Tour progression',
    },
    COMPETE: {
      title: 'Compete & Rankings',
      subtitle: 'Online 1v1 duels, Global Top 10 & Courtyard Badges',
    },
    WORLD: {
      title: 'World & Atmosphere',
      subtitle: '5 Ugandan yards, camera framing, sky & weather',
    },
    SOCIAL: {
      title: 'Social & Party',
      subtitle: 'Online room codes, local multiplayer & player identity',
    },
  };

  const effectiveMode: PlayMode = selectedMode === 'ONLINE_1V1' ? 'VS_BOT' : selectedMode;

  return (
    <div className="pointer-events-none fixed inset-0 z-25 flex items-end md:items-stretch justify-end px-2.5 sm:px-6 lg:px-10 pt-16 pb-16 md:pt-20 md:pb-6">
      <aside
        aria-label={tabMeta[activeTab].title}
        className="pointer-events-auto w-full md:w-[min(450px,44vw)] max-h-[68vh] md:max-h-full flex flex-col bg-[#160B07]/95 border border-[#FAF3E8]/16 rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#FAF3E8]/12 bg-[#1D0E09]">
          <div className="min-w-0">
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#FAF3E8] truncate">
              {tabMeta[activeTab].title}
            </h2>
            <p className="text-xs text-[#E5D3BE]/75 truncate">
              {tabMeta[activeTab].subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Return to Lobby Home"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#2B150E] hover:bg-[#3B1E14] border border-[#FAF3E8]/15 text-[#FAF3E8] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {activeTab === 'PLAY' && (
            <>
              {/* Quick Match Launcher Card */}
              <div className="p-4 rounded-xl bg-[#1F100B] border border-[#FAF3E8]/14 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                    <Swords className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Ejjinja Match</span>
                  </span>
                  <span className="text-xs text-[#E5D3BE]/75 font-mono-num">
                    {activePlaceSpec.shortName}
                  </span>
                </div>

                {/* Mode Selection */}
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'VS_BOT', label: 'VS Bot' },
                      { id: 'SOLO', label: 'Practice' },
                      { id: 'TEAM_2V2', label: '2v2 Teams' },
                      { id: 'TWO_PLAYER', label: '2P Local' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSelectMode(m.id)}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                        effectiveMode === m.id
                          ? 'bg-[#D97706] border-[#FBBF24] text-[#1A0B07]'
                          : 'bg-[#140905] border-[#FAF3E8]/12 text-[#E5D3BE]/85 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Court Size & Difficulty */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <div className="text-[11px] font-medium text-[#E5D3BE]/70 mb-1">
                      Court Layout
                    </div>
                    <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#140905] border border-[#FAF3E8]/12">
                      {([5, 10] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => onSelectCourtSize(sz)}
                          className={`py-1.5 rounded-md text-xs font-mono-num font-semibold transition-colors cursor-pointer ${
                            selectedCourtSize === sz
                              ? 'bg-[#2E170F] text-amber-300 border border-amber-400/40'
                              : 'text-[#E5D3BE]/70 hover:text-white'
                          }`}
                        >
                          {sz} Sq
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-medium text-[#E5D3BE]/70 mb-1">
                      AI Level
                    </div>
                    <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#140905] border border-[#FAF3E8]/12">
                      {(['EASY', 'NORMAL', 'HARD'] as const).map((diff) => (
                        <button
                          key={diff}
                          type="button"
                          onClick={() => onSelectDifficulty(diff)}
                          className={`py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                            selectedDifficulty === diff
                              ? 'bg-[#2E170F] text-amber-300 border border-amber-400/40'
                              : 'text-[#E5D3BE]/70 hover:text-white'
                          }`}
                        >
                          {diff === 'EASY' ? 'Easy' : diff === 'HARD' ? 'Hard' : 'Std'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-stretch gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onStartMatch}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#D97706] hover:bg-[#EA8A1A] text-[#1A0B07] font-display font-extrabold text-sm transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                    <span>Start Match</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenQuickMatchSetup}
                    className="px-3.5 rounded-lg bg-[#2A150D] hover:bg-[#381C12] border border-[#FAF3E8]/16 text-xs font-semibold text-[#FAF3E8] cursor-pointer whitespace-nowrap"
                  >
                    Full Setup
                  </button>
                </div>
              </div>

              {/* Uganda Tour Card */}
              <button
                type="button"
                onClick={onOpenTour}
                className="text-left p-4 rounded-xl bg-[#1F100B] hover:bg-[#2A150E] border border-amber-400/30 hover:border-amber-400/60 transition-colors cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-amber-400/15 border border-amber-400/25 flex items-center justify-center shrink-0">
                    <Compass className="w-4 h-4 text-amber-300" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-bold text-sm text-[#FAF3E8]">
                      Story · Uganda Tour
                    </div>
                    <div className="text-xs text-[#E5D3BE]/75 mt-0.5">
                      Conquer all 4 regional courtyards across Uganda
                    </div>
                  </div>
                </div>
                <span className="font-mono-num text-xs font-bold text-amber-300 shrink-0">
                  {venuesConquered}/4
                </span>
              </button>

              {/* Daily Mission */}
              <DailyMissionCard
                missionState={progression.dailyMission}
                onStartMission={onStartMatch}
                onRerollMission={onRerollDailyMission}
                rerollAvailable={missionRerollAvailable}
                rerollLoading={rerollLoading}
                rerollMessage={rerollMessage}
              />

              {/* Honest Roadmap Note + Guide Link */}
              <div className="p-3.5 rounded-xl bg-[#120805] border border-[#FAF3E8]/10 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-semibold text-[#E5D3BE]">Kisenda Traditional Game</div>
                  <div className="text-[11px] text-[#E5D3BE]/60">
                    Planned future traditional-sport mode
                  </div>
                </div>
                <Link
                  to="/how-to-play"
                  className="text-xs font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-2 whitespace-nowrap"
                >
                  Rules Guide
                </Link>
              </div>
            </>
          )}

          {activeTab === 'COMPETE' && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onOpenOnlineLobby}
                  className="text-left p-3.5 rounded-xl bg-[#1F100B] hover:bg-[#2B160F] border border-amber-400/35 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                    <Globe className="w-4 h-4" aria-hidden="true" />
                    <span>Online 1v1</span>
                  </div>
                  <div className="text-[11px] text-[#E5D3BE]/75 mt-1">
                    {isOnline ? 'Create or join live duel' : 'Offline — reconnect'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={onOpenAchievements}
                  className="text-left p-3.5 rounded-xl bg-[#1F100B] hover:bg-[#2B160F] border border-[#FAF3E8]/15 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                    <Trophy className="w-4 h-4" aria-hidden="true" />
                    <span>Achievements</span>
                  </div>
                  <div className="text-[11px] text-[#E5D3BE]/75 font-mono-num mt-1">
                    {achievementsUnlocked}/{ACHIEVEMENT_CATALOG.length} Badges
                  </div>
                </button>
              </div>

              <GlobalLeaderboard
                playerId={leaderboardPlayerId}
                playerName={playerName}
                onPlayerNameChange={onPlayerNameChange}
                bestScore={progression.stats.bestScore}
                totalWins={progression.stats.matchesWon}
                totalBullseyes={progression.stats.totalBullseyes}
                totalHouses={progression.stats.totalHouses}
                preferredVenue={WORLD_PLACES.find((p) => p.id === selectedPlace)?.venueId ?? 'kampala_murram'}
                preferredMode={selectedMode}
                onPlayNow={onStartMatch}
              />

              <div className="p-3.5 rounded-xl bg-[#120805] border border-[#FAF3E8]/10 text-xs">
                <div className="font-semibold text-[#E5D3BE]">
                  School, Parish &amp; National Brackets
                </div>
                <div className="text-[11px] text-[#E5D3BE]/60 mt-0.5">
                  Planned multi-round seasonal tournament brackets
                </div>
              </div>
            </>
          )}

          {activeTab === 'WORLD' && (
            <>
              {/* 5 Ugandan Worlds */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-2">
                  Ugandan Destinations
                </div>
                <div className="flex flex-col gap-1.5">
                  {WORLD_PLACES.map((pl) => {
                    const active = selectedPlace === pl.id;
                    return (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => onSelectPlace(pl.id)}
                        className={`text-left p-3 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                          active
                            ? 'bg-[#2E170F] border-amber-400/70 text-[#FAF3E8]'
                            : 'bg-[#1D0E09] border-[#FAF3E8]/12 text-[#E5D3BE]/85 hover:border-[#FAF3E8]/30'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-display font-bold text-sm truncate">
                            {pl.name}
                          </div>
                          <div className="text-[11px] text-[#E5D3BE]/70 truncate">
                            {pl.region} · {pl.tag}
                          </div>
                        </div>
                        {active && <Check className="w-4 h-4 text-amber-300 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lighting / Time of Day */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E5D3BE]/85 mb-2">
                  <Sun className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                  <span>Daylight &amp; Atmosphere</span>
                </div>
                <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-[#120805] border border-[#FAF3E8]/12">
                  {SKY_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onSelectPeriod(opt.id)}
                      className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        selectedPeriod === opt.id
                          ? 'bg-[#FAF3E8] text-[#1A0B07]'
                          : 'text-[#E5D3BE]/75 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weather Mode */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E5D3BE]/85 mb-2">
                  <CloudRain className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
                  <span>Courtyard Weather</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {WEATHER_MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      title={opt.hint}
                      onClick={() => onSelectWeatherMode(opt.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                        selectedWeatherMode === opt.id
                          ? 'bg-sky-300 border-sky-200 text-[#071520] font-semibold'
                          : 'bg-[#1D0E09] border-[#FAF3E8]/12 text-[#E5D3BE]/80 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera Presets */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E5D3BE]/85 mb-2">
                  <Camera className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                  <span>Camera Framing</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {WORLD_CAMERAS.map((cam) => (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => onSelectCamera(cam.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                        cameraPreset === cam.id
                          ? 'bg-[#D97706] border-[#FBBF24] text-[#1A0B07] font-semibold'
                          : 'bg-[#1D0E09] border-[#FAF3E8]/12 text-[#E5D3BE]/80 hover:text-white'
                      }`}
                    >
                      {cam.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actor Pose & Expression */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#FAF3E8]/10">
                <div>
                  <div className="text-[11px] font-medium text-[#E5D3BE]/75 mb-1.5">
                    Cast Pose
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {POSE_OPTIONS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelectPose(p.id)}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                          characterPose === p.id
                            ? 'bg-emerald-500 text-[#0B1910]'
                            : 'bg-[#1D0E09] text-[#E5D3BE]/80 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-[#E5D3BE]/75 mb-1.5">
                    Expression
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {SPEECH_OPTIONS.map((sp) => (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => onSelectSpeech(sp.id)}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                          characterSpeech === sp.id
                            ? 'bg-sky-400 text-[#071520]'
                            : 'bg-[#1D0E09] text-[#E5D3BE]/80 hover:text-white'
                        }`}
                      >
                        {sp.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Full Yard Inspection & Studio */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onInspectFullYard}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#2B150E] hover:bg-[#3A1D13] border border-[#FAF3E8]/15 text-xs font-semibold text-[#FAF3E8] cursor-pointer whitespace-nowrap"
                >
                  Inspect Full 3D Yard
                </button>
                {studioAvailable && (
                  <button
                    type="button"
                    onClick={onOpenStudio}
                    className="inline-flex items-center gap-1.5 py-2 px-3 rounded-lg bg-[#24120C] hover:bg-[#351B12] border border-amber-400/35 text-xs font-semibold text-amber-200 cursor-pointer whitespace-nowrap"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Creator Studio</span>
                  </button>
                )}
              </div>
            </>
          )}

          {activeTab === 'SOCIAL' && (
            <>
              {/* Player Identity */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const cleaned = nameDraft.trim().slice(0, 24) || 'Courtyard Player';
                  setNameDraft(cleaned);
                  onPlayerNameChange(cleaned);
                  setNameSavedNotice(true);
                  window.setTimeout(() => setNameSavedNotice(false), 1800);
                }}
                className="p-4 rounded-xl bg-[#1F100B] border border-[#FAF3E8]/14 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <User className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Player Identity</span>
                  </span>
                  {nameSavedNotice && (
                    <span className="text-[11px] font-semibold text-emerald-300">Saved</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={24}
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    aria-label="Display name"
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#120805] border border-[#FAF3E8]/16 text-xs text-[#FAF3E8] focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-lg bg-[#D97706] hover:bg-[#EA8A1A] text-xs font-bold text-[#1A0B07] cursor-pointer whitespace-nowrap"
                  >
                    Save
                  </button>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={onOpenWardrobe}
                    className="text-xs font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-2 cursor-pointer"
                  >
                    Customize Avatar
                  </button>
                  <button
                    type="button"
                    onClick={onOpenStall}
                    className="text-xs font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-2 cursor-pointer"
                  >
                    Courtyard Stall
                  </button>
                </div>
              </form>

              {/* Online 1v1 Room Code / Matchmaking */}
              <div className="p-4 rounded-xl bg-[#1F100B] border border-[#FAF3E8]/14 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Play With a Friend Online</span>
                  </span>
                  <span className="text-[11px] text-[#E5D3BE]/70">
                    {isOnline ? 'Server Ready' : 'Offline'}
                  </span>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const cleaned = roomCodeDraft.trim().toUpperCase();
                    if (cleaned.length >= 4) {
                      onJoinOnlineInvite(cleaned);
                    } else {
                      onOpenOnlineLobby();
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    maxLength={8}
                    placeholder="Enter Room Code"
                    value={roomCodeDraft}
                    onChange={(e) => setRoomCodeDraft(e.target.value.toUpperCase())}
                    aria-label="Online room invite code"
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#120805] border border-[#FAF3E8]/16 text-xs font-mono-num uppercase tracking-wider text-[#FAF3E8] placeholder:text-[#E5D3BE]/40 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-lg bg-[#2E170F] hover:bg-[#3E1F14] border border-amber-400/40 text-xs font-semibold text-amber-200 cursor-pointer whitespace-nowrap"
                  >
                    {roomCodeDraft.trim().length >= 4 ? 'Join Code' : 'Open Lobby'}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={onOpenOnlineLobby}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#D97706] hover:bg-[#EA8A1A] text-xs font-extrabold text-[#1A0B07] cursor-pointer"
                >
                  Host or Browse Online 1v1 Rooms
                </button>
              </div>

              {/* Couch / Courtyard Local Multiplayer */}
              <div className="p-4 rounded-xl bg-[#1F100B] border border-[#FAF3E8]/14 flex flex-col gap-2.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FAF3E8]">
                  <Users className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                  <span>Same-Device Courtyard Play</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onStartQuickMode('TWO_PLAYER')}
                    className="py-2.5 px-3 rounded-lg bg-[#2B150E] hover:bg-[#3A1D13] border border-[#FAF3E8]/15 text-xs font-semibold text-[#FAF3E8] cursor-pointer"
                  >
                    Start 2P Pass &amp; Play
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartQuickMode('TEAM_2V2')}
                    className="py-2.5 px-3 rounded-lg bg-[#2B150E] hover:bg-[#3A1D13] border border-[#FAF3E8]/15 text-xs font-semibold text-[#FAF3E8] cursor-pointer"
                  >
                    Start 2v2 Teams
                  </button>
                </div>
              </div>

              {/* Honest Future Social Features Note */}
              <div className="p-3.5 rounded-xl bg-[#120805] border border-[#FAF3E8]/10 text-xs">
                <div className="font-semibold text-[#E5D3BE]">
                  Friends List, Party Chat &amp; Live Spectators
                </div>
                <div className="text-[11px] text-[#E5D3BE]/60 mt-0.5">
                  Planned social ecosystem updates — use Room Codes above for live 1v1 invitations today.
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
