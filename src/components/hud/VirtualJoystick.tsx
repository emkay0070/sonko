import React, { useCallback, useEffect, useRef, useState } from 'react';

interface VirtualJoystickProps {
  label: string;
  onAxisChange: (x: number) => void;
  disabled?: boolean;
  compact?: boolean;
}

const MAX_RADIUS_PX = 38;
const COMPACT_RADIUS_PX = 30;

export function VirtualJoystick({
  label,
  onAxisChange,
  disabled = false,
  compact = false,
}: VirtualJoystickProps) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const onAxisChangeRef = useRef(onAxisChange);
  onAxisChangeRef.current = onAxisChange;

  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [engaged, setEngaged] = useState(false);

  const maxRadius = compact ? COMPACT_RADIUS_PX : MAX_RADIUS_PX;

  const resetStick = useCallback(() => {
    pointerIdRef.current = null;
    setEngaged(false);
    setOffset({ x: 0, y: 0 });
    onAxisChangeRef.current(0);
  }, []);

  useEffect(() => {
    if (disabled) {
      resetStick();
    }
  }, [disabled, resetStick]);

  useEffect(() => {
    return () => {
      onAxisChangeRef.current(0);
    };
  }, []);

  const updateFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const el = padRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      const scale = dist > maxRadius ? maxRadius / dist : 1;
      const clampedX = dx * scale;
      const clampedY = dy * scale;

      setOffset({ x: clampedX, y: clampedY });

      const normX = clampedX / maxRadius;
      // Small deadzone near center so releasing / hovering near zero feels steady
      const outX = Math.abs(normX) < 0.08 ? 0 : Math.max(-1, Math.min(1, normX));
      onAxisChangeRef.current(outX);
    },
    [maxRadius]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    if (pointerIdRef.current !== null) return;
    pointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic capture failures
    }
    setEngaged(true);
    updateFromClient(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || pointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    updateFromClient(e.clientX, e.clientY);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
    resetStick();
  };

  const sizeClass = compact
    ? 'w-24 h-24'
    : 'w-28 h-28 sm:w-32 sm:h-32 [@media(max-height:480px)]:w-24 [@media(max-height:480px)]:h-24';

  return (
    <div
      className={`pointer-events-auto flex flex-col items-center gap-1.5 select-none transition-opacity duration-150 ${
        disabled ? 'opacity-35 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div
        ref={padRef}
        role="slider"
        aria-label={`${label} steering stick`}
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={Math.round((offset.x / maxRadius) * 100)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className={`relative ${sizeClass} rounded-full touch-none select-none cursor-grab active:cursor-grabbing flex items-center justify-center border transition-colors ${
          engaged
            ? 'bg-[#160B07]/70 border-amber-300/50 shadow-[0_0_24px_rgba(245,158,11,0.18)]'
            : 'bg-[#140A06]/52 border-[#FAF3E8]/18 shadow-[inset_0_1px_0_rgba(255,248,235,0.08)]'
        }`}
      >
        {/* Subtle outer crosshair & directional cues */}
        <div
          aria-hidden="true"
          className="absolute inset-2.5 rounded-full border border-[#FAF3E8]/10 pointer-events-none"
        />
        <span
          aria-hidden="true"
          className="absolute left-2.5 text-[10px] font-bold text-[#FAF3E8]/35 pointer-events-none"
        >
          ‹
        </span>
        <span
          aria-hidden="true"
          className="absolute right-2.5 text-[10px] font-bold text-[#FAF3E8]/35 pointer-events-none"
        >
          ›
        </span>
        <div
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-full bg-[#FAF3E8]/20 pointer-events-none"
        />

        {/* Thumb puck (GPU compositor transform only) */}
        <div
          aria-hidden="true"
          style={{
            transform: `translate3d(${offset.x.toFixed(1)}px, ${offset.y.toFixed(1)}px, 0)`,
          }}
          className={`absolute w-11 h-11 sm:w-12 sm:h-12 [@media(max-height:480px)]:w-10 [@media(max-height:480px)]:h-10 rounded-full border transition-colors pointer-events-none flex items-center justify-center ${
            engaged
              ? 'bg-[#F59E0B]/85 border-[#FEF3C7]/85 shadow-lg'
              : 'bg-[#2C160E]/82 border-[#FAF3E8]/35 shadow-md'
          }`}
        >
          <span
            className={`w-3 h-3 rounded-full ${
              engaged ? 'bg-[#1A0B07]/75' : 'bg-amber-300/75'
            }`}
          />
        </div>
      </div>

      <span className="px-2 py-0.5 rounded-md bg-[#140A06]/55 border border-[#FAF3E8]/12 text-[10px] font-semibold uppercase tracking-wider text-[#FAF3E8]/80">
        {label}
      </span>
    </div>
  );
}
