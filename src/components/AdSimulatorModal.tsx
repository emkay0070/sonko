import React, { useEffect, useState } from 'react';
import { CheckCircle2, Film, Sparkles, VolumeX, X } from 'lucide-react';
import { adService } from '../game/adService';
import type { AdSimulatorSession } from '../game/types';

export function AdSimulatorModal() {
  const [session, setSession] = useState<AdSimulatorSession | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);

  useEffect(() => {
    return adService.subscribeSimulator((nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        setRemainingSec(nextSession.durationSec);
      }
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    const interval = window.setInterval(() => {
      const elapsed = (Date.now() - session.startedAt) / 1000;
      const left = Math.max(0, Math.ceil(session.durationSec - elapsed));
      setRemainingSec(left);
    }, 150);
    return () => window.clearInterval(interval);
  }, [session]);

  if (!session) return null;

  const isRewarded = session.format === 'rewarded';
  const elapsedSec = Math.min(session.durationSec, Math.max(0, (Date.now() - session.startedAt) / 1000));
  const progressPct = Math.round((elapsedSec / Math.max(1, session.durationSec)) * 100);
  const readyToFinish = remainingSec <= 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${session.title} Sponsor Preview`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#1F100B] border border-amber-400/40 shadow-2xl overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#150A06] border-b border-[#FAF3E8]/12">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-300">
            <Film className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Development Ad Simulator</span>
          </div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono-num text-[#E5D3BE]/75">
            <VolumeX className="w-3.5 h-3.5 text-amber-300/80" aria-hidden="true" />
            <span>Game Muted</span>
          </div>
        </div>

        {/* Simulated video stage */}
        <div className="p-6 flex flex-col gap-5">
          <div className="rounded-xl bg-gradient-to-br from-[#351B11] via-[#26120B] to-[#170A06] border border-amber-400/30 p-5 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-300">
              {readyToFinish ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-300" aria-hidden="true" />
              ) : (
                <Sparkles className="w-6 h-6" aria-hidden="true" />
              )}
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300/90">
                {isRewarded ? 'Rewarded Ad Placement' : 'Interstitial Break'}
              </div>
              <h3 className="font-display text-xl font-extrabold text-[#FAF3E8] mt-1">
                {session.title}
              </h3>
              <p className="text-xs text-[#E5D3BE]/80 mt-1.5 leading-relaxed">
                {session.subtitle}
              </p>
            </div>

            {session.rewardLabel && (
              <div className="px-3 py-1 rounded-lg bg-[#1A0B07] border border-amber-400/35 text-xs font-mono-num font-bold text-amber-200">
                Reward: {session.rewardLabel}
              </div>
            )}

            <div className="w-full flex flex-col gap-1.5 pt-1">
              <div className="h-2 w-full rounded-full bg-[#120805] border border-[#FAF3E8]/12 overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-150 ${
                    readyToFinish ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                  style={{ width: `${readyToFinish ? 100 : progressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono-num text-[#E5D3BE]/70">
                <span>Placement: {session.placement}</span>
                <span>
                  {readyToFinish ? 'Ready to collect' : `Completes in ${remainingSec}s`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isRewarded && (
              <button
                type="button"
                onClick={session.dismiss}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#2E170E] hover:bg-[#3E2014] border border-[#FAF3E8]/15 text-xs font-semibold text-[#E5D3BE] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Skip (No Reward)</span>
              </button>
            )}

            <button
              type="button"
              disabled={!readyToFinish}
              onClick={session.complete}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] disabled:bg-[#3A2218] disabled:text-[#E5D3BE]/45 text-[#1A0B07] text-xs sm:text-sm font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>
                {readyToFinish
                  ? isRewarded
                    ? 'Complete & Claim Reward'
                    : 'Continue'
                  : `Please wait (${remainingSec}s)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
