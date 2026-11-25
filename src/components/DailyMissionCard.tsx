import React from 'react';
import {
  Check,
  Flame,
  Footprints,
  Home,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Star,
  Target,
  Trophy,
} from 'lucide-react';
import {
  DailyMissionIconKey,
  DailyMissionState,
  getDailyMissionSpec,
} from '../game/dailyMission';
import { CowrieIcon } from './CourtyardStallModal';

interface DailyMissionCardProps {
  missionState: DailyMissionState;
  onStartMission?: () => void;
  onRerollMission?: () => void;
  rerollAvailable?: boolean;
  rerollLoading?: boolean;
  rerollMessage?: string | null;
}

function MissionGlyph({
  icon,
  className = 'w-4 h-4',
}: {
  icon: DailyMissionIconKey;
  className?: string;
}) {
  switch (icon) {
    case 'target':
      return <Target className={className} aria-hidden="true" />;
    case 'shield':
      return <ShieldCheck className={className} aria-hidden="true" />;
    case 'flame':
      return <Flame className={className} aria-hidden="true" />;
    case 'home':
      return <Home className={className} aria-hidden="true" />;
    case 'trophy':
      return <Trophy className={className} aria-hidden="true" />;
    case 'footprints':
      return <Footprints className={className} aria-hidden="true" />;
    case 'star':
    default:
      return <Star className={className} aria-hidden="true" />;
  }
}

export function DailyMissionCard({
  missionState,
  onStartMission,
  onRerollMission,
  rerollAvailable = false,
  rerollLoading = false,
  rerollMessage = null,
}: DailyMissionCardProps) {
  const spec = getDailyMissionSpec(missionState.missionId);
  const clamped = Math.min(spec.target, Math.max(0, missionState.progress));
  const pct = Math.round((clamped / Math.max(1, spec.target)) * 100);
  const isComplete = missionState.completed;
  const wasRerolledToday = missionState.rerolledOnDate === missionState.dateKey;

  const headerBody = (
    <div className="flex flex-col gap-2.5 w-full">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${
              isComplete
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                : 'bg-amber-400/15 border-amber-400/35 text-amber-300'
            }`}
          >
            {isComplete ? (
              <Check className="w-4 h-4" aria-hidden="true" />
            ) : (
              <MissionGlyph icon={spec.icon} className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  isComplete ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                Daily Mission
              </span>
              {isComplete ? (
                <span className="text-[10px] font-semibold text-emerald-300/90">
                  · Completed
                </span>
              ) : (
                <span className="text-[10px] font-mono-num text-[#E5D3BE]/65">
                  · {clamped}/{spec.target} {spec.unitLabel}
                </span>
              )}
              {wasRerolledToday && (
                <span className="text-[10px] font-medium text-amber-200/75">
                  · Rerolled
                </span>
              )}
            </div>

            <div className="font-display font-bold text-sm text-[#FAF3E8] leading-snug mt-0.5">
              {spec.description}
            </div>
          </div>
        </div>

        <div
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-mono-num font-bold shrink-0 ${
            isComplete
              ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
              : 'bg-[#2D170F] border-amber-400/40 text-amber-200'
          }`}
        >
          <CowrieIcon className="w-3.5 h-3.5" />
          <span>+{spec.cowrieReward}</span>
        </div>
      </div>

      <div className="h-1.5 w-full rounded-full bg-[#120805] border border-[#FAF3E8]/10 overflow-hidden">
        <div
          className={`h-full transition-[width] duration-300 ${
            isComplete ? 'bg-emerald-400' : 'bg-[#F59E0B]'
          }`}
          style={{ width: `${isComplete ? 100 : pct}%` }}
        />
      </div>
    </div>
  );

  return (
    <section
      aria-label={`Daily Mission: ${spec.description}`}
      className={`w-full rounded-xl border transition-colors ${
        isComplete
          ? 'bg-[#161B12]/92 border-emerald-400/45 p-3.5'
          : 'bg-[#1C0D08]/95 border-amber-400/40'
      }`}
    >
      {!isComplete && onStartMission ? (
        <button
          type="button"
          onClick={onStartMission}
          aria-label={`Active Daily Mission: ${spec.description} Reward: ${spec.cowrieReward} Cowries`}
          className="w-full text-left p-3.5 rounded-xl hover:bg-[#2A140D] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          {headerBody}
        </button>
      ) : (
        <div className={isComplete ? '' : 'p-3.5'}>{headerBody}</div>
      )}

      {!isComplete && onRerollMission && (
        <div className="px-3.5 pb-3 pt-0.5 flex items-center justify-between gap-2 border-t border-[#FAF3E8]/8">
          <span className="text-[11px] text-[#E5D3BE]/70 truncate">
            {rerollMessage
              ? rerollMessage
              : rerollAvailable
                ? 'Want a different challenge today?'
                : 'Daily mission reroll used today'}
          </span>

          {rerollAvailable && (
            <button
              type="button"
              onClick={onRerollMission}
              disabled={rerollLoading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2D170F] hover:bg-[#3E2014] disabled:opacity-55 border border-amber-400/40 text-[11px] font-semibold text-amber-200 transition-colors cursor-pointer disabled:cursor-wait shrink-0 whitespace-nowrap"
            >
              {rerollLoading ? (
                <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
              ) : (
                <PlayCircle className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              )}
              <span>{rerollLoading ? 'Loading Ad...' : 'Ad · Reroll Mission'}</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}

