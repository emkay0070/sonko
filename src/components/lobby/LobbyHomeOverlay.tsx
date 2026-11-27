import React from 'react';
import {
  Compass,
  Globe,
  Play,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { Link } from '../../router';
import { DailyMissionState } from '../../game/dailyMission';
import { COURT_VENUES, ProgressionData, WorldPlaceSpec } from '../../game/progression';
import { CourtSize, PlayMode } from '../../game/types';
import { DailyMissionCard } from '../DailyMissionCard';
import { LobbyTabId } from './LobbyTopBar';

interface LobbyHomeOverlayProps {
  activePlaceSpec: WorldPlaceSpec;
  weatherLabel: string;
  selectedMode: PlayMode;
  onSelectMode: (mode: PlayMode) => void;
  selectedCourtSize: CourtSize;
  progression: ProgressionData;
  dailyMission: DailyMissionState;
  missionRerollAvailable: boolean;
  rerollLoading: boolean;
  rerollMessage: string | null;
  onRerollDailyMission: () => void;
  isOnline: boolean;
  onPlayMatch: () => void;
  onOpenQuickMatchSetup: () => void;
  onOpenWardrobe: () => void;
  onOpenOnlineLobby: () => void;
  onOpenTour: () => void;
  onNavigateTab: (tab: LobbyTabId) => void;
}

const QUICK_MODE_CHOICES: Array<{ id: PlayMode; label: string }> = [
  { id: 'VS_BOT', label: 'VS Bot' },
  { id: 'SOLO', label: 'Solo' },
  { id: 'TEAM_2V2', label: '2v2' },
  { id: 'TWO_PLAYER', label: '2P' },
];

export function LobbyHomeOverlay({
  activePlaceSpec,
  weatherLabel,
  selectedMode,
  onSelectMode,
  selectedCourtSize,
  progression,
  dailyMission,
  missionRerollAvailable,
  rerollLoading,
  rerollMessage,
  onRerollDailyMission,
  isOnline,
  onPlayMatch,
  onOpenQuickMatchSetup,
  onOpenWardrobe,
  onOpenOnlineLobby,
  onOpenTour,
  onNavigateTab,
}: LobbyHomeOverlayProps) {
  const venuesConquered = COURT_VENUES.filter(
    (v) => (progression.tourWins[v.id] ?? 0) > 0
  ).length;
  const nextTourVenue =
    COURT_VENUES.find((v) => (progression.tourWins[v.id] ?? 0) === 0) ?? COURT_VENUES[0];

  const effectiveMode: PlayMode = selectedMode === 'ONLINE_1V1' ? 'VS_BOT' : selectedMode;

  return (
    <>
      {/* Edge-only atmospheric legibility vignettes (keep center >= 75% completely open) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-36 -z-10"
        style={{
          background:
            'linear-gradient(180deg, rgba(16,7,4,0.72) 0%, rgba(16,7,4,0.22) 60%, rgba(16,7,4,0) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 h-56 -z-10"
        style={{
          background:
            'linear-gradient(0deg, rgba(16,7,4,0.84) 0%, rgba(16,7,4,0.34) 55%, rgba(16,7,4,0) 100%)',
        }}
      />

      <div className="flex-1 flex flex-col justify-between px-3 sm:px-6 lg:px-10 pt-2.5 pb-16 md:pb-3 pointer-events-none">
        {/* Top-Left Unboxed World Context (zero pill badges) */}
        <div className="flex items-start justify-between gap-4">
          <div className="pointer-events-auto max-w-md drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300/90">
              {activePlaceSpec.region}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 mt-0.5">
              <h2 className="font-display font-bold text-lg sm:text-xl text-[#FAF3E8] leading-tight">
                {activePlaceSpec.name}
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('WORLD')}
                className="text-xs font-medium text-amber-200/85 hover:text-amber-200 underline underline-offset-2 cursor-pointer whitespace-nowrap"
              >
                Change Yard
              </button>
            </div>
            <div className="mt-0.5 text-xs text-[#E5D3BE]/85 font-mono-num">
              {selectedCourtSize} Squares
              <span aria-hidden="true" className="mx-1.5 text-[#FAF3E8]/35">·</span>
              <span className="font-sans">{weatherLabel}</span>
            </div>
          </div>
        </div>

        {/* Bottom Perimeter Dock: Match Launcher (Bottom-Left) + Daily Mission & Tour Anchor (Bottom-Right) */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4 mt-auto">
          {/* Bottom-Left Compact Match Launcher */}
          <div className="pointer-events-auto w-full md:w-[370px] flex flex-col gap-2">
            {/* Compact Mode Switcher */}
            <div
              role="group"
              aria-label="Quick Match Mode"
              className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#160B07]/90 border border-[#FAF3E8]/14"
            >
              {QUICK_MODE_CHOICES.map((m) => {
                const active = effectiveMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelectMode(m.id)}
                    aria-pressed={active}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#2E170F] text-[#FBBF24] border border-amber-400/45'
                        : 'text-[#E5D3BE]/75 hover:text-white border border-transparent'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {/* Primary Play Match + Full Setup */}
            <div className="flex items-stretch gap-2">
              <button
                id="home-quick-match-btn"
                type="button"
                onClick={onPlayMatch}
                className="flex-1 flex items-center justify-center gap-2.5 py-3 px-5 rounded-xl bg-[#D97706] hover:bg-[#EA8A1A] active:translate-y-px border border-[#FBBF24] text-[#1A0B07] shadow-xl transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                <Play className="w-5 h-5 fill-current shrink-0" aria-hidden="true" />
                <span className="font-display font-extrabold text-base tracking-tight whitespace-nowrap">
                  Play Match
                </span>
              </button>

              <button
                type="button"
                onClick={onOpenQuickMatchSetup}
                aria-label="Configure Match Rules & Venue"
                title="Match Setup (Court Size, AI, World)"
                className="px-3.5 rounded-xl bg-[#160B07]/92 hover:bg-[#2A140D] border border-[#FAF3E8]/16 text-[#FAF3E8] inline-flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <SlidersHorizontal className="w-4 h-4 text-amber-300" aria-hidden="true" />
                <span>Setup</span>
              </button>
            </div>

            {/* Compact Secondary Row: Wardrobe & Stall + Online 1v1 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onOpenWardrobe}
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#160B07]/90 hover:bg-[#2A140D] border border-[#FAF3E8]/14 text-xs font-semibold text-[#FAF3E8] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
                <span>Wardrobe &amp; Stall</span>
              </button>

              <button
                type="button"
                onClick={onOpenOnlineLobby}
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#160B07]/90 hover:bg-[#2A140D] border border-[#FAF3E8]/14 text-xs font-semibold text-[#FAF3E8] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Globe className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
                <span>{isOnline ? 'Online 1v1' : 'Offline Mode'}</span>
              </button>
            </div>
          </div>

          {/* Bottom-Right Activity Anchor (Daily Mission + Uganda Tour Strip, desktop md+) */}
          <div className="pointer-events-auto hidden md:flex flex-col gap-2 w-[345px]">
            <DailyMissionCard
              missionState={dailyMission}
              onStartMission={onPlayMatch}
              onRerollMission={onRerollDailyMission}
              rerollAvailable={missionRerollAvailable}
              rerollLoading={rerollLoading}
              rerollMessage={rerollMessage}
            />

            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#160B07]/90 border border-[#FAF3E8]/12">
              <button
                type="button"
                onClick={onOpenTour}
                className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer group"
              >
                <Compass className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#FAF3E8] group-hover:text-amber-200 transition-colors truncate">
                    Uganda Tour ·{' '}
                    <span className="font-mono-num text-amber-300">{venuesConquered}/4</span>
                  </div>
                  <div className="text-[11px] text-[#E5D3BE]/70 truncate">
                    Next: {nextTourVenue.shortName}
                  </div>
                </div>
              </button>

              <div className="text-right shrink-0 text-[11px] text-[#E5D3BE]/75 font-mono-num">
                <div>
                  Wins {progression.stats.matchesWon}/{progression.stats.matchesPlayed}
                </div>
                <div>Best {progression.stats.bestScore}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Slim Footer Line */}
        <footer className="hidden md:flex pointer-events-auto items-center justify-between gap-4 pt-2.5 mt-2 border-t border-[#FAF3E8]/10 text-[11px] text-[#E5D3BE]/70">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <span>Hold Click / Space to Toss</span>
            <span aria-hidden="true">·</span>
            <span>A / D Balance</span>
            <span aria-hidden="true">·</span>
            <span>Right-Drag Orbit</span>
            <span aria-hidden="true">·</span>
            <span>H View Bar</span>
          </div>
          <nav
            aria-label="Game guide and legal pages"
            className="flex flex-wrap items-center gap-x-3.5 gap-y-0.5"
          >
            <Link to="/how-to-play" className="text-amber-300/85 hover:text-amber-200 underline underline-offset-2">
              How to Play
            </Link>
            <Link to="/about" className="text-amber-300/85 hover:text-amber-200 underline underline-offset-2">
              About
            </Link>
            <Link to="/privacy" className="text-amber-300/85 hover:text-amber-200 underline underline-offset-2">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-amber-300/85 hover:text-amber-200 underline underline-offset-2">
              Terms
            </Link>
            <Link to="/contact" className="text-amber-300/85 hover:text-amber-200 underline underline-offset-2">
              Contact
            </Link>
          </nav>
        </footer>
      </div>
    </>
  );
}
