import React, { useEffect } from 'react';
import { CloudRain, MapPin, Play, Sun, Trophy, X } from 'lucide-react';
import { PeriodPreset } from '../game/settings';
import { ProgressionData, WORLD_PLACES, WorldPlaceId } from '../game/progression';
import { CourtSize, Difficulty, PlayMode, WeatherMode } from '../game/types';
import { WEATHER_MODE_OPTIONS } from '../game/weather';

interface QuickMatchModalProps {
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
  onSelectWeatherMode: (mode: WeatherMode) => void;
  progression: ProgressionData;
  onStartMatch: () => void;
  onClose: () => void;
}

const QUICK_MODES: Array<{ id: Exclude<PlayMode, 'ONLINE_1V1'>; label: string; hint: string }> = [
  { id: 'SOLO', label: 'Solo', hint: 'Practice & records' },
  { id: 'VS_BOT', label: 'VS Bot', hint: 'Challenge Amina' },
  { id: 'TEAM_2V2', label: '2v2', hint: 'Cranes vs Waves' },
  { id: 'TWO_PLAYER', label: '2P Local', hint: 'Pass & play' },
];

const PERIOD_OPTIONS: Array<{ id: PeriodPreset; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'morning', label: 'Morning' },
  { id: 'midday', label: 'Midday' },
  { id: 'golden', label: 'Golden Hour' },
  { id: 'night', label: 'Night' },
];

export function QuickMatchModal({
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
  progression,
  onStartMatch,
  onClose,
}: QuickMatchModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const activeMode: Exclude<PlayMode, 'ONLINE_1V1'> =
    selectedMode === 'ONLINE_1V1' ? 'VS_BOT' : selectedMode;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick Match Configuration"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#22110B]/96 border border-[#FAF3E8]/20 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#FAF3E8]/12 bg-[#1A0B07]">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#FAF3E8]">Quick Match</h2>
            <p className="text-xs text-[#E5D3BE]/75 mt-0.5">
              Choose mode, courtyard place, time of day, and chalk layout
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Quick Match"
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-[#FAF3E8]/15 text-[#FAF3E8] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Mode */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-300/90 mb-2">
              Match Mode
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUICK_MODES.map((m) => {
                const active = activeMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelectMode(m.id)}
                    className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#D97706] border-[#F59E0B] text-[#1A0B07]'
                        : 'bg-[#170B07] border-[#FAF3E8]/12 text-[#FAF3E8] hover:border-[#FAF3E8]/30'
                    }`}
                  >
                    <div className="font-display font-bold text-sm">{m.label}</div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        active ? 'text-[#1A0B07]/80 font-medium' : 'text-[#E5D3BE]/65'
                      }`}
                    >
                      {m.hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Place Selector (kept separate from Period) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300/90">
                <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Place</span>
              </span>
              <span className="text-[11px] text-[#E5D3BE]/65">
                Live courtyard physics &amp; rewards
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {WORLD_PLACES.map((place) => {
                const active = selectedPlace === place.id;
                const wins = progression.tourWins[place.venueId] ?? 0;
                return (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => onSelectPlace(place.id)}
                    title={place.description}
                    className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#341A11] border-amber-400 text-[#FAF3E8]'
                        : 'bg-[#170B07] border-[#FAF3E8]/12 text-[#E5D3BE]/85 hover:border-[#FAF3E8]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold text-xs sm:text-sm text-[#FAF3E8] truncate">
                        {place.name}
                      </span>
                      {wins > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono-num text-emerald-300 shrink-0">
                          <Trophy className="w-2.5 h-2.5" aria-hidden="true" />
                          <span>{wins}W</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-amber-300/90 mt-0.5">{place.tag}</div>
                    <div className="text-[10px] text-[#E5D3BE]/60 truncate mt-0.5">
                      {place.region}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Period Selector (Separate from Place) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300/90">
                <Sun className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Period (Time of Day)</span>
              </span>
              <span className="text-[11px] text-[#E5D3BE]/65">Updates live 3D sky</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 p-1 bg-[#140906] border border-[#FAF3E8]/12 rounded-lg">
              {PERIOD_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPeriod(p.id)}
                  className={`py-2 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    selectedPeriod === p.id
                      ? 'bg-[#FAF3E8] text-[#1A0B07] font-semibold'
                      : 'text-[#E5D3BE]/80 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Match Weather */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300/90">
                <CloudRain className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
                <span>Weather Conditions</span>
              </span>
              <span className="text-[11px] text-[#E5D3BE]/65">
                {WEATHER_MODE_OPTIONS.find((w) => w.id === selectedWeatherMode)?.hint}
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 p-1 bg-[#140906] border border-[#FAF3E8]/12 rounded-lg">
              {WEATHER_MODE_OPTIONS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => onSelectWeatherMode(w.id)}
                  className={`py-2 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    selectedWeatherMode === w.id
                      ? 'bg-sky-300 text-[#071520] font-semibold'
                      : 'text-[#E5D3BE]/80 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* Court & Bot Skill */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-300/90 mb-2">
                Court Squares
              </div>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#140906] border border-[#FAF3E8]/12 rounded-lg">
                {(
                  [
                    { id: 10, label: 'Classic 10' },
                    { id: 5, label: 'Quick 5' },
                  ] as const
                ).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectCourtSize(c.id)}
                    className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      selectedCourtSize === c.id
                        ? 'bg-[#FAF3E8] text-[#1A0B07]'
                        : 'text-[#E5D3BE]/80 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {(activeMode === 'VS_BOT' || activeMode === 'TEAM_2V2') && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-300/90 mb-2">
                  Bot Skill
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#140906] border border-[#FAF3E8]/12 rounded-lg">
                  {(['EASY', 'NORMAL', 'HARD'] as const).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => onSelectDifficulty(diff)}
                      className={`py-2 px-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        selectedDifficulty === diff
                          ? 'bg-[#FAF3E8] text-[#1A0B07]'
                          : 'text-[#E5D3BE]/80 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {diff === 'EASY' ? 'Easy' : diff === 'NORMAL' ? 'Normal' : 'Hard'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-6 py-4 border-t border-[#FAF3E8]/12 bg-[#1A0B07] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-[#FAF3E8]/15 text-xs font-medium text-[#E5D3BE] cursor-pointer"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onStartMatch}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] font-display font-bold text-sm transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            <span>Start Match</span>
          </button>
        </div>
      </div>
    </div>
  );
}
