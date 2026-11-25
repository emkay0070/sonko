import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, RotateCcw, Sparkles } from 'lucide-react';
import { sonkoAudio } from '../game/audio';
import { CowrieIcon } from './CourtyardStallModal';

export type ChestPhase = 'sealed' | 'shaking' | 'opened';

interface CowrieParticle {
  id: number;
  dx: number;
  dy: number;
  rot: number;
  delay: number;
  scale: number;
}

const COWRIE_BURST_PARTICLES: CowrieParticle[] = [
  { id: 1, dx: -112, dy: -66, rot: -140, delay: 0.0, scale: 0.95 },
  { id: 2, dx: -82, dy: -96, rot: 110, delay: 0.03, scale: 1.05 },
  { id: 3, dx: -46, dy: -110, rot: -75, delay: 0.05, scale: 0.9 },
  { id: 4, dx: -14, dy: -118, rot: 95, delay: 0.02, scale: 1.1 },
  { id: 5, dx: 20, dy: -116, rot: -120, delay: 0.04, scale: 1.0 },
  { id: 6, dx: 54, dy: -104, rot: 135, delay: 0.06, scale: 0.95 },
  { id: 7, dx: 88, dy: -88, rot: -90, delay: 0.03, scale: 1.08 },
  { id: 8, dx: 116, dy: -60, rot: 150, delay: 0.05, scale: 0.9 },
  { id: 9, dx: -64, dy: -54, rot: 70, delay: 0.08, scale: 0.8 },
  { id: 10, dx: 68, dy: -52, rot: -65, delay: 0.08, scale: 0.85 },
  { id: 11, dx: -30, dy: -74, rot: 180, delay: 0.07, scale: 0.85 },
  { id: 12, dx: 34, dy: -76, rot: -160, delay: 0.07, scale: 0.85 },
];

interface DailyTreasureChestProps {
  rewardCowries: number;
  streakDay: number;
  weekBonus: number;
  wasReset: boolean;
  isNewClaim: boolean;
  phase: ChestPhase;
  onPhaseChange: (next: ChestPhase) => void;
}

function ChestSvg({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      viewBox="0 0 180 140"
      className="w-36 h-28 sm:w-40 sm:h-32 overflow-visible select-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sonkoChestWood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#854220" />
          <stop offset="55%" stopColor="#5A2812" />
          <stop offset="100%" stopColor="#3B180A" />
        </linearGradient>
        <linearGradient id="sonkoChestLid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9C5129" />
          <stop offset="100%" stopColor="#5E2B14" />
        </linearGradient>
        <linearGradient id="sonkoBrass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="45%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <radialGradient id="sonkoChestGlow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#FDE047" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#F59E0B" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft ground shadow */}
      <ellipse cx="90" cy="126" rx="58" ry="8" fill="#0B0402" fillOpacity="0.65" />

      {/* Warm interior treasure glow when open */}
      {isOpen && (
        <ellipse cx="90" cy="64" rx="64" ry="42" fill="url(#sonkoChestGlow)" />
      )}

      {/* Open interior cavity + piled cowries */}
      {isOpen && (
        <g>
          <path
            d="M32 62 L148 62 L142 74 L38 74 Z"
            fill="#1D0B05"
            stroke="#3B180A"
            strokeWidth="2"
          />
          {/* Gleaming cowrie mound peeking out */}
          <g transform="translate(50, 56)">
            <ellipse cx="14" cy="8" rx="9" ry="5.5" fill="#FFFBEB" stroke="#B45309" strokeWidth="1.2" />
            <ellipse cx="32" cy="5" rx="10" ry="6" fill="#FEF3C7" stroke="#B45309" strokeWidth="1.2" />
            <ellipse cx="50" cy="6" rx="9.5" ry="5.8" fill="#FFFBEB" stroke="#B45309" strokeWidth="1.2" />
            <ellipse cx="66" cy="9" rx="9" ry="5.5" fill="#FDE68A" stroke="#B45309" strokeWidth="1.2" />
            <ellipse cx="24" cy="11" rx="9" ry="5" fill="#FDE68A" stroke="#B45309" strokeWidth="1.2" />
            <ellipse cx="42" cy="11" rx="9.5" ry="5.5" fill="#FFFBEB" stroke="#B45309" strokeWidth="1.2" />
            <line x1="27" y1="5" x2="37" y2="5" stroke="#92400E" strokeWidth="1.3" strokeLinecap="round" />
            <line x1="45" y1="6" x2="55" y2="6" stroke="#92400E" strokeWidth="1.3" strokeLinecap="round" />
          </g>
        </g>
      )}

      {/* Chest Base Body */}
      <g>
        <path
          d="M30 66 L150 66 L144 120 Q143 125 137 125 L43 125 Q37 125 36 120 Z"
          fill="url(#sonkoChestWood)"
          stroke="#260F06"
          strokeWidth="2.5"
        />
        {/* Plank lines */}
        <line x1="33" y1="86" x2="147" y2="86" stroke="#2D1208" strokeWidth="1.6" strokeOpacity="0.6" />
        <line x1="35" y1="106" x2="145" y2="106" stroke="#2D1208" strokeWidth="1.6" strokeOpacity="0.6" />

        {/* Vertical Brass Straps */}
        <rect x="48" y="66" width="12" height="59" rx="2" fill="url(#sonkoBrass)" stroke="#78350F" strokeWidth="1.4" />
        <rect x="120" y="66" width="12" height="59" rx="2" fill="url(#sonkoBrass)" stroke="#78350F" strokeWidth="1.4" />

        {/* Top Rim */}
        <rect x="27" y="62" width="126" height="9" rx="3" fill="url(#sonkoBrass)" stroke="#78350F" strokeWidth="1.5" />

        {/* Center Lock Plate */}
        <path
          d="M80 65 L100 65 L100 84 Q90 92 80 84 Z"
          fill="url(#sonkoBrass)"
          stroke="#78350F"
          strokeWidth="1.6"
        />
        <circle cx="90" cy="75" r="3" fill="#2A1108" />
        <path d="M88.5 76 L91.5 76 L92 82 L88 82 Z" fill="#2A1108" />
      </g>

      {/* Chest Lid (springs upward & tilts back when open) */}
      <motion.g
        initial={false}
        animate={
          isOpen
            ? { y: -28, rotate: -14, scaleY: 0.86 }
            : { y: 0, rotate: 0, scaleY: 1 }
        }
        transition={{ type: 'spring', stiffness: 260, damping: 16 }}
        style={{ transformOrigin: '90px 62px' }}
      >
        <path
          d="M28 62 Q28 24 90 24 Q152 24 152 62 Z"
          fill="url(#sonkoChestLid)"
          stroke="#260F06"
          strokeWidth="2.5"
        />
        {/* Brass Lid Bands */}
        <path
          d="M48 62 Q49 28 56 26 L63 26 Q59 29 60 62 Z"
          fill="url(#sonkoBrass)"
          stroke="#78350F"
          strokeWidth="1.4"
        />
        <path
          d="M120 62 Q121 29 117 26 L124 26 Q131 28 132 62 Z"
          fill="url(#sonkoBrass)"
          stroke="#78350F"
          strokeWidth="1.4"
        />
        {/* Kitenge Diamond Crest on Lid */}
        <polygon
          points="90,34 99,45 90,56 81,45"
          fill="url(#sonkoBrass)"
          stroke="#78350F"
          strokeWidth="1.5"
        />
        <polygon points="90,39 94.5,45 90,51 85.5,45" fill="#FEF3C7" />
        {/* Lid Rim */}
        <rect x="26" y="55" width="128" height="8" rx="3" fill="url(#sonkoBrass)" stroke="#78350F" strokeWidth="1.5" />
      </motion.g>
    </svg>
  );
}

export function DailyTreasureChest({
  rewardCowries,
  streakDay,
  weekBonus,
  wasReset,
  isNewClaim,
  phase,
  onPhaseChange,
}: DailyTreasureChestProps) {
  const [burstKey, setBurstKey] = useState(0);
  const [displayCount, setDisplayCount] = useState(() => (isNewClaim ? 0 : rewardCowries));
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
      window.cancelAnimationFrame(id);
    }
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const animateCountUp = useCallback((target: number) => {
    const start = performance.now();
    const duration = 680;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayCount(Math.round(target * eased));
      if (t < 1) {
        const raf = window.requestAnimationFrame(step);
        timersRef.current.push(raf);
      }
    };
    const raf = window.requestAnimationFrame(step);
    timersRef.current.push(raf);
  }, []);

  const triggerOpenSequence = useCallback(() => {
    clearTimers();
    setDisplayCount(0);
    onPhaseChange('shaking');
    sonkoAudio.playStoneBounce(0.8);

    const shakeTimer = window.setTimeout(() => {
      onPhaseChange('opened');
      setBurstKey((k) => k + 1);
      sonkoAudio.playHouseClaim();
      animateCountUp(rewardCowries);
    }, 460);
    timersRef.current.push(shakeTimer);
  }, [animateCountUp, clearTimers, onPhaseChange, rewardCowries]);

  // Expose click/replay cleanly
  const isOpen = phase === 'opened';
  const isShaking = phase === 'shaking';
  const isSealed = phase === 'sealed';

  return (
    <div className="relative rounded-xl bg-gradient-to-b from-[#2F160D] via-[#221009] to-[#170A06] border border-amber-400/45 px-5 py-5 overflow-hidden">
      {/* Radial golden rays when chest opens */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key={`rays-${burstKey}`}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
          >
            <div
              className="w-72 h-72 rounded-full opacity-30"
              style={{
                background:
                  'repeating-conic-gradient(from 0deg, rgba(251,191,36,0.45) 0deg 12deg, transparent 12deg 30deg)',
                maskImage: 'radial-gradient(circle, black 20%, transparent 72%)',
                WebkitMaskImage: 'radial-gradient(circle, black 20%, transparent 72%)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-5">
        {/* Interactive Chest Stage */}
        <div className="relative flex flex-col items-center justify-center shrink-0">
          {/* Cowrie Burst Particles */}
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
          >
            <AnimatePresence>
              {isOpen &&
                burstKey > 0 &&
                COWRIE_BURST_PARTICLES.map((p) => (
                  <motion.div
                    key={`${burstKey}-${p.id}`}
                    initial={{ x: 0, y: 4, scale: 0.2, opacity: 0, rotate: 0 }}
                    animate={{
                      x: p.dx,
                      y: p.dy,
                      scale: [0.3, p.scale * 1.15, p.scale * 0.85],
                      opacity: [0, 1, 1, 0],
                      rotate: p.rot,
                    }}
                    transition={{
                      duration: 0.95,
                      delay: p.delay,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="absolute"
                  >
                    <CowrieIcon className="w-5 h-5" />
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={triggerOpenSequence}
            disabled={isShaking}
            aria-label={
              isSealed
                ? `Open Day ${streakDay} Daily Treasure Chest for ${rewardCowries} Cowries`
                : 'Replay Daily Treasure Chest animation'
            }
            className="group relative flex flex-col items-center cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 rounded-xl p-1 disabled:cursor-wait"
          >
            <motion.div
              animate={
                isShaking
                  ? {
                      rotate: [0, -7, 8, -8, 7, -5, 4, 0],
                      scale: [1, 1.06, 0.96, 1.07, 0.97, 1.04, 1],
                      y: [0, -3, 1, -5, 0, -2, 0],
                    }
                  : isSealed
                    ? {
                        y: [0, -4, 0],
                        rotate: [0, -1.5, 1.5, 0],
                      }
                    : { y: 0, rotate: 0, scale: 1 }
              }
              transition={
                isShaking
                  ? { duration: 0.45, ease: 'easeInOut' }
                  : isSealed
                    ? { duration: 2.0, repeat: Infinity, ease: 'easeInOut' }
                    : { duration: 0.25 }
              }
            >
              <ChestSvg isOpen={isOpen} />
            </motion.div>
          </button>
        </div>

        {/* Quest Copy + Animated Cowrie Reveal */}
        <div className="flex-1 min-w-0 flex flex-col items-center sm:items-start text-center sm:text-left gap-2.5">
          {isSealed && (
            <>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-400/15 border border-amber-400/45 text-[11px] font-bold uppercase tracking-wider text-amber-200">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                <span>Day {streakDay} Treasure Ready</span>
              </div>
              <h3 className="font-display text-xl font-extrabold text-[#FAF3E8] leading-tight">
                Your Courtyard Chest Has Arrived!
              </h3>
              <p className="text-xs text-[#E5D3BE]/80 leading-relaxed max-w-sm">
                {wasReset
                  ? 'Fresh streak started today. Open the chest to claim today’s Cowrie haul.'
                  : 'Tap the chest to crack the brass latch and claim today’s Cowrie reward.'}
              </p>
              <button
                type="button"
                onClick={triggerOpenSequence}
                className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] font-bold text-xs sm:text-sm transition-colors cursor-pointer shadow-md"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span>Open Treasure Chest</span>
              </button>
            </>
          )}

          {isShaking && (
            <div className="py-4 flex flex-col items-center sm:items-start gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Unlocking Latch...
              </span>
              <div className="font-display text-xl font-extrabold text-[#FAF3E8]">
                Day {streakDay} Daily Treasure Quest
              </div>
            </div>
          )}

          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full flex flex-col items-center sm:items-start gap-2"
            >
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300">
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {isNewClaim
                    ? `Day ${streakDay} Treasure Unlocked!`
                    : `Day ${streakDay} Chest Collected`}
                </span>
              </div>

              <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F59E0B] text-[#1A0B07] font-mono-num text-lg font-extrabold shadow-lg">
                  <CowrieIcon className="w-5 h-5" />
                  <span>+{displayCount} Cowries</span>
                </div>
                {weekBonus > 0 && (
                  <span className="text-[11px] font-mono-num font-semibold text-amber-200">
                    (Includes +{weekBonus} Week Bonus)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start pt-0.5">
                <p className="text-xs text-[#E5D3BE]/75">
                  Come back tomorrow to unlock the next chest on the ladder.
                </p>
                <button
                  type="button"
                  onClick={triggerOpenSequence}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  <span>Replay</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
