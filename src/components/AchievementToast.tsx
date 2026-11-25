import React from 'react';
import { AchievementSpec } from '../game/achievements';
import { AchievementGlyph } from './AchievementsModal';
import { CowrieIcon } from './CourtyardStallModal';

interface AchievementToastProps {
  items: AchievementSpec[];
}

export function AchievementToast({ items }: AchievementToastProps) {
  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 w-[min(360px,92vw)]"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="w-full bg-[#1F100B]/95 border border-amber-400/65 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-lg bg-[#F59E0B]/20 border border-amber-400/50 text-amber-300 flex items-center justify-center shrink-0">
            <AchievementGlyph icon={item.icon} className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              Achievement Unlocked
            </div>
            <div className="font-display font-bold text-sm text-[#FAF3E8] truncate">
              {item.title}
            </div>
          </div>
          <div className="inline-flex items-center gap-1 text-xs font-mono-num font-bold text-amber-200 shrink-0">
            <CowrieIcon className="w-4 h-4" />
            <span>+{item.cowrieReward}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
