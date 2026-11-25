import React, { useEffect, useState } from 'react';
import { CalendarDays, Check, Flame, PlayCircle, Sparkles, X } from 'lucide-react';
import {
  DAILY_STREAK_REWARDS,
  DailyStreakState,
  getCycleRewardForStreak,
} from '../game/dailyStreak';
import { CowrieIcon } from './CourtyardStallModal';
import { ChestPhase, DailyTreasureChest } from './DailyTreasureChest';

export interface JustClaimedDailyInfo {
  streak: number;
  cowries: number;
  cycleDay: number;
  weekBonus: number;
  wasReset: boolean;
}

interface DailyStreakModalProps {
  dailyStreak: DailyStreakState;
  justClaimed: JustClaimedDailyInfo | null;
  onClaimBonusChest?: () => void;
  bonusChestAvailable?: boolean;
  bonusChestLoading?: boolean;
  bonusChestReward?: number | null;
  bonusChestError?: string | null;
  onClose: () => void;
}

export function DailyStreakModal({
  dailyStreak,
  justClaimed,
  onClaimBonusChest,
  bonusChestAvailable = false,
  bonusChestLoading = false,
  bonusChestReward = null,
  bonusChestError = null,
  onClose,
}: DailyStreakModalProps) {
  const [chestPhase, setChestPhase] = useState<ChestPhase>(() =>
    justClaimed ? 'sealed' : 'opened'
  );

  useEffect(() => {
    setChestPhase(justClaimed ? 'sealed' : 'opened');
  }, [justClaimed]);

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

  const activeStreak = Math.max(1, dailyStreak.currentStreak);
  const currentRewardInfo = getCycleRewardForStreak(activeStreak);
  const nextRewardInfo = getCycleRewardForStreak(dailyStreak.currentStreak + 1);
  const activeCycleDay = currentRewardInfo.cycleDay;
  const weekNumber = currentRewardInfo.weekNumber;

  const displayStreakDay = justClaimed ? justClaimed.streak : dailyStreak.currentStreak;
  const displayCowries = justClaimed
    ? justClaimed.cowries
    : dailyStreak.currentStreak > 0
      ? currentRewardInfo.totalCowries
      : 0;
  const displayWeekBonus = justClaimed
    ? justClaimed.weekBonus
    : dailyStreak.currentStreak > 0
      ? currentRewardInfo.weekBonus
      : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Daily Treasure Quest & Login Streak"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#22110B] border border-[#FAF3E8]/20 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#FAF3E8]/12 bg-[#1A0B07]">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-300 uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>Daily Login Streak · Week {weekNumber}</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-[#FAF3E8] mt-0.5">
              Daily Treasure Quest
            </h2>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2D170F] border border-amber-400/25 text-xs font-mono-num text-amber-200">
              <CalendarDays className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              <span>Next: +{nextRewardInfo.totalCowries}</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Daily Treasure Quest"
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-[#FAF3E8]/15 text-[#FAF3E8] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Interactive Animated Daily Treasure Chest */}
          <DailyTreasureChest
            rewardCowries={displayCowries}
            streakDay={Math.max(1, displayStreakDay)}
            weekBonus={displayWeekBonus}
            wasReset={Boolean(justClaimed?.wasReset)}
            isNewClaim={Boolean(justClaimed)}
            phase={chestPhase}
            onPhaseChange={setChestPhase}
          />

          {/* Rewarded Bonus Treasure Chest */}
          {onClaimBonusChest && (
            <div className="rounded-xl bg-[#1A0C08] border border-amber-400/35 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-amber-400/15 border border-amber-400/35 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-amber-300" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Bonus Treasure Chest
                  </div>
                  <p className="text-xs text-[#E5D3BE]/80 mt-0.5">
                    {bonusChestReward
                      ? `Bonus chest unlocked! +${bonusChestReward} Cowries added to your pouch.`
                      : bonusChestAvailable
                        ? 'Watch a quick sponsored video for an extra +30 to +50 Cowries today.'
                        : 'Today’s Bonus Treasure Chest has already been collected.'}
                  </p>
                  {bonusChestError && (
                    <p className="text-[11px] text-amber-200/90 mt-1">{bonusChestError}</p>
                  )}
                </div>
              </div>

              {bonusChestAvailable && !bonusChestReward ? (
                <button
                  type="button"
                  onClick={onClaimBonusChest}
                  disabled={bonusChestLoading}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] disabled:opacity-60 text-[#1A0B07] text-xs font-bold transition-colors cursor-pointer disabled:cursor-wait shrink-0 whitespace-nowrap"
                >
                  <PlayCircle className="w-4 h-4" aria-hidden="true" />
                  <span>{bonusChestLoading ? 'Opening...' : 'Ad · Open Bonus Chest'}</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-xs font-mono-num font-bold text-emerald-200 shrink-0 whitespace-nowrap">
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{bonusChestReward ? `+${bonusChestReward} Claimed` : 'Claimed Today'}</span>
                </div>
              )}
            </div>
          )}

          {/* Streak Metrics Strip */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl bg-[#1A0C08] border border-amber-400/35 px-3.5 py-3 flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-[#E5D3BE]/65 font-semibold">
                Current Streak
              </span>
              <div className="mt-1 flex items-center gap-1.5 font-display text-2xl font-extrabold text-amber-300 font-mono-num">
                <Flame className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
                <span>{dailyStreak.currentStreak}d</span>
              </div>
            </div>

            <div className="rounded-xl bg-[#1A0C08] border border-[#FAF3E8]/12 px-3.5 py-3 flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-[#E5D3BE]/65 font-semibold">
                Best Streak
              </span>
              <div className="mt-1 font-display text-2xl font-extrabold text-[#FAF3E8] font-mono-num">
                {dailyStreak.bestStreak}d
              </div>
            </div>

            <div className="rounded-xl bg-[#1A0C08] border border-[#FAF3E8]/12 px-3.5 py-3 flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-[#E5D3BE]/65 font-semibold">
                Days Played
              </span>
              <div className="mt-1 font-display text-2xl font-extrabold text-[#FAF3E8] font-mono-num">
                {dailyStreak.totalDaysLogged}
              </div>
            </div>
          </div>

          {/* 7-Day Reward Ladder */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#E5D3BE]/80">
                7-Day Courtyard Reward Ladder
              </h3>
              {weekNumber > 1 && (
                <span className="text-xs font-mono-num text-amber-300 font-semibold">
                  Week {weekNumber} Bonus: +{currentRewardInfo.weekBonus} Cowries/day
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {DAILY_STREAK_REWARDS.map((tier) => {
                const isToday = dailyStreak.currentStreak > 0 && tier.cycleDay === activeCycleDay;
                const isCompleted = dailyStreak.currentStreak > 0 && tier.cycleDay < activeCycleDay;
                const isJackpot = tier.cycleDay === 7;
                const displayCowries = tier.baseCowries + currentRewardInfo.weekBonus;

                return (
                  <div
                    key={tier.cycleDay}
                    className={`rounded-xl p-3.5 border flex flex-col justify-between gap-2 transition-colors ${
                      isJackpot ? 'col-span-2' : ''
                    } ${
                      isToday
                        ? 'bg-[#3A1D12] border-amber-400 shadow-lg'
                        : isCompleted
                          ? 'bg-[#1D100B] border-emerald-400/40'
                          : 'bg-[#160A06] border-[#FAF3E8]/12'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-mono-num font-bold uppercase tracking-wide ${
                          isToday
                            ? 'text-amber-300'
                            : isCompleted
                              ? 'text-emerald-300'
                              : 'text-[#E5D3BE]/65'
                        }`}
                      >
                        Day {tier.cycleDay}
                      </span>

                      {isToday ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-[10px] font-semibold text-amber-200">
                          <Check className="w-3 h-3" aria-hidden="true" />
                          <span>Today</span>
                        </span>
                      ) : isCompleted ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
                          <Check className="w-3 h-3" aria-hidden="true" />
                          <span>Done</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#E5D3BE]/45 font-medium">Upcoming</span>
                      )}
                    </div>

                    <div>
                      <div
                        className={`text-xs font-semibold truncate ${
                          isToday || isCompleted ? 'text-[#FAF3E8]' : 'text-[#E5D3BE]/75'
                        }`}
                      >
                        {tier.title}
                      </div>
                      <div
                        className={`mt-1 inline-flex items-center gap-1.5 font-mono-num text-sm font-bold ${
                          isToday
                            ? 'text-amber-200'
                            : isCompleted
                              ? 'text-emerald-200/90'
                              : 'text-amber-300/80'
                        }`}
                      >
                        <CowrieIcon className="w-4 h-4" />
                        <span>+{displayCowries}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-6 py-4 border-t border-[#FAF3E8]/12 bg-[#1A0B07] flex items-center justify-between gap-3">
          <p className="text-xs text-[#E5D3BE]/70">
            Streaks reset to Day 1 if a calendar day is missed.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] font-semibold text-sm transition-colors cursor-pointer shrink-0"
          >
            {justClaimed ? 'Collect & Play' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}
