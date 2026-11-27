import React from 'react';
import {
  Compass,
  Eye,
  EyeOff,
  Flame,
  Home,
  Settings,
  Swords,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Link } from '../../router';
import { CowrieIcon } from '../CourtyardStallModal';
import { PWAInstallButton } from '../PWAInstallButton';

export type LobbyTabId = 'HOME' | 'PLAY' | 'COMPETE' | 'WORLD' | 'SOCIAL';

export const LOBBY_TABS: Array<{
  id: LobbyTabId;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'HOME', label: 'HOME', Icon: Home },
  { id: 'PLAY', label: 'PLAY', Icon: Swords },
  { id: 'COMPETE', label: 'COMPETE', Icon: Trophy },
  { id: 'WORLD', label: 'WORLD', Icon: Compass },
  { id: 'SOCIAL', label: 'SOCIAL', Icon: Users },
];

interface LobbyTopBarProps {
  activeTab: LobbyTabId;
  onSelectTab: (tab: LobbyTabId) => void;
  playerName: string;
  cowries: number;
  streakDays: number;
  muted: boolean;
  titlePeekMode: boolean;
  onToggleMute: () => void;
  onTogglePeekMode: () => void;
  onOpenStall: () => void;
  onOpenStreak: () => void;
  onOpenSettings: () => void;
}

export function LobbyTopBar({
  activeTab,
  onSelectTab,
  playerName,
  cowries,
  streakDays,
  muted,
  titlePeekMode,
  onToggleMute,
  onTogglePeekMode,
  onOpenStall,
  onOpenStreak,
  onOpenSettings,
}: LobbyTopBarProps) {
  return (
    <>
      {/* Top Perimeter Header (Desktop 3-zone bar, Compact Single-Row on Mobile) */}
      <header className="pointer-events-none relative z-30 w-full px-3 sm:px-6 lg:px-10 pt-3">
        <div className="pointer-events-auto flex items-center justify-between gap-2 sm:gap-4 h-12 sm:h-13 px-3 sm:px-4 rounded-xl bg-[#160B07]/90 border border-[#FAF3E8]/12 shadow-lg">
          {/* Left Zone: Wordmark & Website Link */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onSelectTab('HOME')}
              className="flex items-center gap-2 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 rounded-md"
              aria-label="Sonko Lobby Home"
            >
              <svg
                viewBox="0 0 28 28"
                className="w-6 h-6 shrink-0"
                aria-hidden="true"
              >
                <rect
                  x="2"
                  y="14"
                  width="11"
                  height="11"
                  rx="2"
                  fill="none"
                  stroke="#FAF3E8"
                  strokeOpacity="0.7"
                  strokeWidth="2"
                />
                <rect
                  x="15"
                  y="14"
                  width="11"
                  height="11"
                  rx="2"
                  fill="none"
                  stroke="#FAF3E8"
                  strokeOpacity="0.7"
                  strokeWidth="2"
                />
                <rect
                  x="8.5"
                  y="3"
                  width="11"
                  height="11"
                  rx="2"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2.2"
                />
                <circle cx="14" cy="8.5" r="2.2" fill="#FBBF24" />
              </svg>
              <span className="font-display font-extrabold text-base sm:text-lg tracking-tight text-[#FAF3E8] whitespace-nowrap">
                SONKO
              </span>
            </button>

            <span className="hidden sm:inline-block h-4 w-px bg-[#FAF3E8]/15" aria-hidden="true" />

            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-[#E5D3BE]/75 hover:text-[#FAF3E8] transition-colors whitespace-nowrap"
            >
              <span>Website</span>
            </Link>
          </div>

          {/* Center Zone: Primary Lobby Navigation Tabs (Desktop md+) */}
          <nav
            aria-label="Lobby Sections"
            className="hidden md:flex items-center gap-1 lg:gap-2 h-full"
          >
            {LOBBY_TABS.map(({ id, label }) => {
              const active = !titlePeekMode && activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative h-full px-3 lg:px-4 inline-flex items-center text-xs font-display font-bold tracking-[0.08em] transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                    active
                      ? 'text-[#FAF3E8]'
                      : 'text-[#E5D3BE]/70 hover:text-[#FAF3E8]'
                  }`}
                >
                  <span>{label}</span>
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-2 bottom-0 h-[2.5px] rounded-t-full bg-[#F59E0B]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Zone: Player Identity, Cowries, Streak, Utilities */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onSelectTab('SOCIAL')}
              title={`Player: ${playerName}`}
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#24120C] hover:bg-[#321911] border border-[#FAF3E8]/12 text-xs font-medium text-[#FAF3E8] transition-colors whitespace-nowrap cursor-pointer max-w-[140px]"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
              <span className="truncate">{playerName}</span>
            </button>

            <button
              type="button"
              onClick={onOpenStall}
              aria-label={`Cowries balance: ${cowries}. Open Courtyard Stall`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#24120C] hover:bg-[#321911] border border-amber-400/30 text-xs font-semibold text-amber-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              <CowrieIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono-num">{cowries}</span>
            </button>

            <button
              type="button"
              onClick={onOpenStreak}
              aria-label={`Daily login streak: ${streakDays} ${streakDays === 1 ? 'day' : 'days'}. Open reward calendar`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#24120C] hover:bg-[#321911] border border-[#FAF3E8]/12 text-xs font-semibold text-amber-300 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
              <span className="font-mono-num">{streakDays}d</span>
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              title={muted ? 'Unmute audio' : 'Mute audio'}
              className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-[#24120C] hover:bg-[#321911] border border-[#FAF3E8]/12 text-[#E5D3BE] hover:text-white transition-colors cursor-pointer shrink-0"
            >
              {muted ? (
                <VolumeX className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              )}
            </button>

            <div className="hidden sm:block">
              <PWAInstallButton variant="title" />
            </div>

            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Open Settings"
              title="Settings"
              className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-[#24120C] hover:bg-[#321911] border border-[#FAF3E8]/12 text-[#E5D3BE] hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <Settings className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onTogglePeekMode}
              aria-label={titlePeekMode ? 'Show Lobby Menu' : 'Inspect 3D Yard'}
              title={titlePeekMode ? 'Show Lobby Menu' : 'Inspect 3D Yard'}
              className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
                titlePeekMode
                  ? 'bg-[#D97706] border-[#F59E0B] text-[#1A0B07] font-semibold'
                  : 'bg-[#24120C] hover:bg-[#321911] border-[#FAF3E8]/12 text-[#E5D3BE] hover:text-white'
              }`}
            >
              {titlePeekMode ? (
                <>
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden lg:inline">Show Lobby</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                  <span className="hidden lg:inline">Inspect Yard</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom 5-Tab Navigation Bar (< md) */}
      <nav
        aria-label="Mobile Lobby Navigation"
        className="md:hidden pointer-events-auto fixed inset-x-0 bottom-0 z-30 bg-[#160B07]/96 border-t border-[#FAF3E8]/14 px-2 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]"
      >
        <div className="grid grid-cols-5 gap-1">
          {LOBBY_TABS.map(({ id, label, Icon }) => {
            const active = !titlePeekMode && activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-display font-bold tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#2D170F] text-[#FBBF24] border border-amber-400/35'
                    : 'text-[#E5D3BE]/70 hover:text-[#FAF3E8]'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
