import React, { useEffect, useState } from 'react';
import {
  Award,
  Check,
  Compass,
  Crosshair,
  Droplets,
  Flame,
  Footprints,
  Home,
  Lock,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Swords,
  Target,
  Trophy,
  Wind,
  X,
  Crown,
} from 'lucide-react';
import {
  ACHIEVEMENT_CATALOG,
  AchievementCategory,
  AchievementIconKey,
} from '../game/achievements';
import { ProgressionData } from '../game/progression';
import { CowrieIcon } from './CourtyardStallModal';

interface AchievementsModalProps {
  progression: ProgressionData;
  onClose: () => void;
}

type FilterTab = 'ALL' | AchievementCategory;

export function AchievementGlyph({
  icon,
  className = 'w-5 h-5',
}: {
  icon: AchievementIconKey;
  className?: string;
}) {
  switch (icon) {
    case 'footprints':
      return <Footprints className={className} aria-hidden="true" />;
    case 'trophy':
      return <Trophy className={className} aria-hidden="true" />;
    case 'target':
      return <Target className={className} aria-hidden="true" />;
    case 'crosshair':
      return <Crosshair className={className} aria-hidden="true" />;
    case 'home':
      return <Home className={className} aria-hidden="true" />;
    case 'crown':
      return <Crown className={className} aria-hidden="true" />;
    case 'shield':
      return <ShieldCheck className={className} aria-hidden="true" />;
    case 'flame':
      return <Flame className={className} aria-hidden="true" />;
    case 'compass':
      return <Compass className={className} aria-hidden="true" />;
    case 'wind':
      return <Wind className={className} aria-hidden="true" />;
    case 'droplets':
      return <Droplets className={className} aria-hidden="true" />;
    case 'sparkles':
      return <Sparkles className={className} aria-hidden="true" />;
    case 'award':
      return <Award className={className} aria-hidden="true" />;
    case 'swords':
      return <Swords className={className} aria-hidden="true" />;
    case 'shopping':
      return <ShoppingBag className={className} aria-hidden="true" />;
    case 'star':
    default:
      return <Star className={className} aria-hidden="true" />;
  }
}

export function AchievementsModal({ progression, onClose }: AchievementsModalProps) {
  const [tab, setTab] = useState<FilterTab>('ALL');

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

  const unlockedMap = progression.unlockedAchievements ?? {};
  const unlockedCount = ACHIEVEMENT_CATALOG.filter((a) => Boolean(unlockedMap[a.id])).length;
  const totalCount = ACHIEVEMENT_CATALOG.length;
  const pct = Math.round((unlockedCount / Math.max(1, totalCount)) * 100);
  const bonusCowriesEarned = ACHIEVEMENT_CATALOG.reduce(
    (sum, a) => sum + (unlockedMap[a.id] ? a.cowrieReward : 0),
    0
  );

  const visibleItems = ACHIEVEMENT_CATALOG.filter((item) =>
    tab === 'ALL' ? true : item.category === tab
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Courtyard Achievements"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
    >
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-[#22110B] border border-[#FAF3E8]/20 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#FAF3E8]/12 bg-[#1A0B07]">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-300 uppercase tracking-wider">
              <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Career Honors</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-[#FAF3E8] mt-0.5">
              Courtyard Achievements
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2D170F] border border-amber-400/25 text-xs font-mono-num font-semibold text-amber-200">
              <CowrieIcon className="w-4 h-4" />
              <span>+{bonusCowriesEarned} Earned</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2D170F] border border-[#FAF3E8]/15 text-xs font-mono-num font-semibold text-[#FAF3E8]">
              <Award className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              <span>
                {unlockedCount}/{totalCount}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Achievements"
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-[#FAF3E8]/15 text-[#FAF3E8] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary Bar & Category Tabs */}
        <div className="px-6 pt-4 pb-3 border-b border-[#FAF3E8]/10 bg-[#1C0E09] flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 text-xs text-[#E5D3BE]/80">
            <span>Unlock badges across matches &amp; regional courts to earn bonus Cowries.</span>
            <span className="font-mono-num font-semibold text-amber-300 shrink-0">{pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#120805] border border-[#FAF3E8]/12 overflow-hidden">
            <div
              className="h-full bg-[#F59E0B] transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <div
              role="tablist"
              aria-label="Achievement categories"
              className="inline-grid grid-cols-4 gap-1 p-1 bg-[#140906] border border-[#FAF3E8]/12 rounded-lg"
            >
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'COURTYARD', label: 'Courtyard' },
                  { id: 'TOUR', label: 'Uganda Tour' },
                  { id: 'COLLECTION', label: 'Collection' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    tab === t.id
                      ? 'bg-[#F59E0B] text-[#1A0B07] font-semibold'
                      : 'text-[#F3E6D6]/80 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="text-[11px] font-mono-num text-[#E5D3BE]/70 flex items-center gap-2.5">
              <span>Clean Wins {progression.stats.cleanMatchesWon}</span>
              <span aria-hidden="true">·</span>
              <span>Best Streak {progression.stats.bestStreak}</span>
              <span aria-hidden="true">·</span>
              <span>Bullseyes {progression.stats.totalBullseyes}</span>
            </div>
          </div>
        </div>

        {/* Achievement Cards */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visibleItems.map((item) => {
              const unlockedAt = unlockedMap[item.id];
              const isUnlocked = Boolean(unlockedAt);
              const prog = item.getProgress(progression);
              const clamped = Math.min(prog.target, Math.max(0, prog.current));
              const fillPct = Math.round((clamped / Math.max(1, prog.target)) * 100);

              let dateLabel: string | null = null;
              if (unlockedAt) {
                try {
                  dateLabel = new Date(unlockedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  });
                } catch {
                  dateLabel = null;
                }
              }

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border flex items-start gap-3.5 transition-colors ${
                    isUnlocked
                      ? 'bg-[#341A11] border-amber-400/70'
                      : 'bg-[#170B07]/90 border-[#FAF3E8]/12'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
                      isUnlocked
                        ? 'bg-[#F59E0B]/20 border-amber-400/50 text-amber-300'
                        : 'bg-[#26140D] border-[#FAF3E8]/10 text-[#E5D3BE]/45'
                    }`}
                  >
                    <AchievementGlyph icon={item.icon} className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className={`font-display font-bold text-sm leading-snug ${
                          isUnlocked ? 'text-[#FAF3E8]' : 'text-[#E5D3BE]/85'
                        }`}
                      >
                        {item.title}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-mono-num font-semibold shrink-0 ${
                          isUnlocked ? 'text-amber-300' : 'text-[#E5D3BE]/55'
                        }`}
                      >
                        <CowrieIcon className="w-3.5 h-3.5" />
                        <span>+{item.cowrieReward}</span>
                      </span>
                    </div>

                    <p className="text-xs text-[#E5D3BE]/75 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="pt-1 flex items-center justify-between gap-2">
                      {isUnlocked ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Unlocked{dateLabel ? ` · ${dateLabel}` : ''}</span>
                        </span>
                      ) : prog.target > 1 ? (
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-[#120805] border border-[#FAF3E8]/10 overflow-hidden">
                            <div
                              className="h-full bg-amber-400/75"
                              style={{ width: `${fillPct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono-num text-[#E5D3BE]/65 shrink-0">
                            {clamped}/{prog.target}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#E5D3BE]/50">
                          <Lock className="w-3 h-3" aria-hidden="true" />
                          <span>Locked</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
