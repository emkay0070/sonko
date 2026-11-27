import React, { useRef } from 'react';
import { Footprints, Hand, Target } from 'lucide-react';
import { TurnPhase } from '../../game/types';

interface TouchActionPadProps {
  phase: TurnPhase;
  aimPower: number;
  isCharging: boolean;
  hopNextStepLabel: 'Hop' | 'Land 2-Feet' | 'Leap' | 'Scoop' | null;
  onStartAimCharge: () => void;
  onReleaseAimCharge: () => void;
  onCancelAimCharge: () => void;
  onTriggerAction: () => void;
}

const RING_RADIUS = 41;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function TouchActionPad({
  phase,
  aimPower,
  isCharging,
  hopNextStepLabel,
  onStartAimCharge,
  onReleaseAimCharge,
  onCancelAimCharge,
  onTriggerAction,
}: TouchActionPadProps) {
  const chargePointerIdRef = useRef<number | null>(null);

  const isAimPhase = phase === 'TOSS_AIM' || phase === 'CLAIM_AIM';
  const isHopOrScoop =
    phase === 'HOP_OUT' ||
    phase === 'HOP_BACK' ||
    phase === 'HOP_EXIT' ||
    phase === 'PICKUP_STONE';

  if (!isAimPhase && !isHopOrScoop) {
    return null;
  }

  if (isAimPhase) {
    const clampedPower = Math.max(0, Math.min(1, aimPower));
    const dashOffset = RING_CIRCUMFERENCE * (1 - clampedPower);
    const isClaim = phase === 'CLAIM_AIM';

    return (
      <div className="pointer-events-auto flex flex-col items-center gap-1.5 select-none">
        <button
          type="button"
          aria-label={isCharging ? 'Release to toss river stone' : 'Hold to charge toss'}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (chargePointerIdRef.current !== null) return;
            chargePointerIdRef.current = e.pointerId;
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // Ignore
            }
            onStartAimCharge();
          }}
          onPointerUp={(e) => {
            if (chargePointerIdRef.current !== e.pointerId) return;
            e.preventDefault();
            e.stopPropagation();
            chargePointerIdRef.current = null;
            try {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            } catch {
              // Ignore
            }
            onReleaseAimCharge();
          }}
          onPointerCancel={(e) => {
            if (chargePointerIdRef.current !== e.pointerId) return;
            e.preventDefault();
            e.stopPropagation();
            chargePointerIdRef.current = null;
            onCancelAimCharge();
          }}
          className={`relative w-24 h-24 sm:w-28 sm:h-28 [@media(max-height:480px)]:w-22 [@media(max-height:480px)]:h-22 rounded-full touch-none select-none flex flex-col items-center justify-center transition-transform active:scale-95 cursor-pointer ${
            isCharging
              ? 'bg-[#D97706]/82 text-[#1A0B07] shadow-[0_0_28px_rgba(245,158,11,0.38)]'
              : 'bg-[#160B07]/66 border border-amber-300/45 text-[#FAF3E8] shadow-[0_8px_24px_rgba(0,0,0,0.4)]'
          }`}
        >
          <svg
            viewBox="0 0 96 96"
            className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
            aria-hidden="true"
          >
            <circle
              cx="48"
              cy="48"
              r={RING_RADIUS}
              fill="none"
              stroke="rgba(250, 243, 232, 0.14)"
              strokeWidth="5"
            />
            <circle
              cx="48"
              cy="48"
              r={RING_RADIUS}
              fill="none"
              stroke={isCharging ? '#FEF3C7' : '#F59E0B'}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          </svg>

          <Target
            className={`w-5 h-5 mb-0.5 ${isCharging ? 'text-[#1A0B07]' : 'text-amber-300'}`}
            aria-hidden="true"
          />
          <span className="text-xs font-extrabold uppercase tracking-wide leading-tight">
            {isCharging ? 'Release' : isClaim ? 'Blind' : 'Hold'}
          </span>
          <span
            className={`font-mono-num text-[11px] font-bold leading-tight ${
              isCharging ? 'text-[#1A0B07]/85' : 'text-amber-200/90'
            }`}
          >
            {isCharging ? `${Math.round(clampedPower * 100)}%` : 'Toss'}
          </span>
        </button>

        <span className="px-2 py-0.5 rounded-md bg-[#140A06]/55 border border-[#FAF3E8]/12 text-[10px] font-semibold uppercase tracking-wider text-[#FAF3E8]/80">
          {isCharging ? 'Charging' : 'Hold & Release'}
        </span>
      </div>
    );
  }

  const isScoop = phase === 'PICKUP_STONE';
  const isLeap = phase === 'HOP_EXIT';
  const actionLabel = hopNextStepLabel ?? (isScoop ? 'Scoop' : isLeap ? 'Leap' : 'Hop');

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1.5 select-none">
      <button
        type="button"
        aria-label={
          isScoop
            ? 'Scoop river stone'
            : isLeap
              ? 'Leap to baseline'
              : `Perform ${actionLabel}`
        }
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onTriggerAction();
        }}
        className={`w-24 h-24 sm:w-28 sm:h-28 [@media(max-height:480px)]:w-22 [@media(max-height:480px)]:h-22 rounded-full touch-none select-none flex flex-col items-center justify-center gap-1 border transition-transform active:scale-92 cursor-pointer ${
          isScoop
            ? 'bg-[#D97706]/85 border-amber-200/75 text-[#1A0B07] shadow-[0_0_26px_rgba(245,158,11,0.35)]'
            : isLeap
              ? 'bg-emerald-500/80 border-emerald-200/70 text-[#071A11] shadow-[0_0_24px_rgba(16,185,129,0.3)]'
              : 'bg-[#160B07]/68 border-amber-300/50 text-[#FAF3E8] shadow-[0_8px_24px_rgba(0,0,0,0.4)]'
        }`}
      >
        {isScoop ? (
          <Hand className="w-6 h-6" aria-hidden="true" />
        ) : (
          <Footprints
            className={`w-6 h-6 ${isLeap ? 'text-[#071A11]' : 'text-amber-300'}`}
            aria-hidden="true"
          />
        )}
        <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wide leading-tight text-center px-2">
          {actionLabel}
        </span>
      </button>

      <span className="px-2 py-0.5 rounded-md bg-[#140A06]/55 border border-[#FAF3E8]/12 text-[10px] font-semibold uppercase tracking-wider text-[#FAF3E8]/80">
        {isScoop ? 'Pick Up Stone' : isLeap ? 'Final Jump' : 'Tap to Step'}
      </span>
    </div>
  );
}
