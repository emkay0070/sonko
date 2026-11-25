import React, { useEffect } from 'react';
import { Award, Compass, Play, Trophy, X } from 'lucide-react';
import { COURT_VENUES, ProgressionData } from '../game/progression';
import { CourtSize, CourtVenueId, Difficulty } from '../game/types';

interface TourModalProps {
  progression: ProgressionData;
  selectedVenue: CourtVenueId;
  selectedCourtSize: CourtSize;
  selectedDifficulty: Difficulty;
  onSelectVenue: (venue: CourtVenueId) => void;
  onSelectCourtSize: (size: CourtSize) => void;
  onSelectDifficulty: (diff: Difficulty) => void;
  onStartTourStop: (venue: CourtVenueId) => void;
  onClose: () => void;
}

export function TourModal({
  progression,
  selectedVenue,
  selectedCourtSize,
  selectedDifficulty,
  onSelectVenue,
  onSelectCourtSize,
  onSelectDifficulty,
  onStartTourStop,
  onClose,
}: TourModalProps) {
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

  const venuesConquered = COURT_VENUES.filter((v) => (progression.tourWins[v.id] ?? 0) > 0).length;
  const nextStop =
    COURT_VENUES.find((v) => (progression.tourWins[v.id] ?? 0) === 0) ?? COURT_VENUES[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Story and Uganda Tour"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#22110B]/96 border border-[#FAF3E8]/20 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#FAF3E8]/12 bg-[#1A0B07]">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-300 uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Story · Uganda Courtyard Tour</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-[#FAF3E8] mt-0.5">
              4-Stop Regional Circuit
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2D170F] border border-amber-400/25 text-xs font-mono-num font-semibold text-amber-200">
              <Award className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              <span>Stamps {venuesConquered}/4</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Uganda Tour"
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-[#FAF3E8]/15 text-[#FAF3E8] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          <p className="text-xs sm:text-sm text-[#E5D3BE]/80 leading-relaxed">
            Challenge regional champions across Kampala, Entebbe, Jinja, and Ndere to stamp your
            Tour card and earn Cowrie multipliers. Selecting a stop updates the live 3D courtyard
            behind you.
          </p>

          {/* Tour Stops */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {COURT_VENUES.map((v, idx) => {
              const wins = progression.tourWins[v.id] ?? 0;
              const isSelected = selectedVenue === v.id;
              const isNextTarget = nextStop.id === v.id && wins === 0;
              return (
                <div
                  key={v.id}
                  onClick={() => onSelectVenue(v.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectVenue(v.id);
                    }
                  }}
                  className={`p-4 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-[#341A11] border-amber-400'
                      : 'bg-[#170B07] border-[#FAF3E8]/12 hover:border-[#FAF3E8]/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-3.5 h-3.5 rounded-sm border border-white/25 shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${v.swatchTop}, ${v.swatchBottom})`,
                          }}
                          aria-hidden="true"
                        />
                        <span className="text-[11px] font-mono-num font-semibold text-[#E5D3BE]/70">
                          Stop {idx + 1} · {v.region}
                        </span>
                      </div>
                      <span className="font-mono-num text-xs font-semibold text-amber-300">
                        {v.cowrieMultiplier.toFixed(2).replace(/\.00$/, '.0')}x Cowries
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-2">
                      <h3 className="font-display font-bold text-base text-[#FAF3E8]">{v.name}</h3>
                      {wins > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono-num text-emerald-300 font-semibold shrink-0">
                          <Trophy className="w-3 h-3" aria-hidden="true" />
                          <span>{wins}W</span>
                        </span>
                      ) : isNextTarget ? (
                        <span className="text-[11px] font-semibold text-amber-300 shrink-0">
                          Next Stop
                        </span>
                      ) : null}
                    </div>

                    <div className="text-xs font-medium text-amber-300/90 mt-0.5">
                      {v.mechanicTag}
                    </div>
                    <p className="text-xs text-[#E5D3BE]/70 mt-1.5 leading-relaxed">
                      {v.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectVenue(v.id);
                        onStartTourStop(v.id);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07]'
                          : 'bg-[#2C160F] hover:bg-[#3F2015] border border-[#FAF3E8]/15 text-[#FAF3E8]'
                      }`}
                    >
                      <Play className="w-3 h-3 fill-current" aria-hidden="true" />
                      <span>Play Stop</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Match Rules Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-[#FAF3E8]/10">
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

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-300/90 mb-2">
                Rival Difficulty
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
          </div>
        </div>

        {/* Footer */}
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
            onClick={() => {
              onSelectVenue(nextStop.id);
              onStartTourStop(nextStop.id);
            }}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] font-display font-bold text-sm transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            <span>
              {venuesConquered < 4
                ? `Start Next Stop (${nextStop.shortName})`
                : `Play ${nextStop.shortName}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
