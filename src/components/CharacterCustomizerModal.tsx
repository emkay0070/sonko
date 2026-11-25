import React, { useEffect } from 'react';
import { Check, RotateCcw, ShoppingBag, X } from 'lucide-react';
import { AvatarCustomization, getOutfitSpec, getStoneSpec, ProgressionData } from '../game/progression';
import { HairStyle } from '../game/types';

interface CharacterCustomizerModalProps {
  progression: ProgressionData;
  onUpdateAvatar: (patch: Partial<AvatarCustomization>, playFeedback?: boolean) => void;
  onOpenStall?: () => void;
  onClose: () => void;
}

const HAIR_STYLE_OPTIONS: Array<{ id: HairStyle; label: string }> = [
  { id: 'braids', label: 'Braids' },
  { id: 'afro', label: 'Afro' },
  { id: 'bun', label: 'Top Bun' },
  { id: 'fade', label: 'Fade' },
];

const PRIMARY_COLOR_SWATCHES: Array<{ label: string; hex: string }> = [
  { label: 'Emerald Leaf', hex: '#15803D' },
  { label: 'Sunset Orange', hex: '#EA580C' },
  { label: 'Nile Indigo', hex: '#1D4ED8' },
  { label: 'Barkcloth Brown', hex: '#7C2D12' },
  { label: 'Crane Crimson', hex: '#B91C1C' },
  { label: 'Savanna Ochre', hex: '#CA8A04' },
  { label: 'Mulberry Dye', hex: '#7E22CE' },
  { label: 'Obsidian Ink', hex: '#18181B' },
];

const ACCENT_COLOR_SWATCHES: Array<{ label: string; hex: string }> = [
  { label: 'Marigold Gold', hex: '#FBBF24' },
  { label: 'Sunlit Chalk', hex: '#FEF08A' },
  { label: 'Courtyard Cream', hex: '#FAF3E8' },
  { label: 'Crimson Crown', hex: '#EF4444' },
  { label: 'Lake Breeze', hex: '#38BDF8' },
  { label: 'Fresh Shoot', hex: '#4ADE80' },
  { label: 'Warm Coral', hex: '#FB923C' },
  { label: 'Twilight Lilac', hex: '#C084FC' },
];

function HairIcon({ style }: { style: HairStyle }) {
  return (
    <svg viewBox="0 0 36 36" className="w-7 h-7" aria-hidden="true">
      {style === 'afro' && <circle cx="18" cy="17" r="12" fill="#1E110B" />}
      {style === 'braids' && (
        <g fill="#1E110B">
          <rect x="7.5" y="13" width="3.5" height="16" rx="1.75" />
          <rect x="12" y="12" width="3.5" height="17" rx="1.75" />
          <rect x="20.5" y="12" width="3.5" height="17" rx="1.75" />
          <rect x="25" y="13" width="3.5" height="16" rx="1.75" />
        </g>
      )}
      {style === 'bun' && <circle cx="18" cy="8.5" r="5" fill="#1E110B" />}
      <circle cx="18" cy="18.5" r="8" fill="#6B3A24" stroke="#180B07" strokeWidth="1.4" />
      <path d="M10 17.5 A8 8 0 0 1 26 17.5 Z" fill="#1E110B" />
      {style === 'fade' && (
        <path d="M11 16.5 A7.5 7.5 0 0 1 25 16.5" fill="none" stroke="#3B2317" strokeWidth="1.5" />
      )}
    </svg>
  );
}

export function CharacterCustomizerModal({
  progression,
  onUpdateAvatar,
  onOpenStall,
  onClose,
}: CharacterCustomizerModalProps) {
  const { avatar, equippedOutfit, equippedStone } = progression;
  const outfitSpec = getOutfitSpec(equippedOutfit);
  const stoneSpec = getStoneSpec(equippedStone);
  const skinTone = '#6B3A24';

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

  const activeHairLabel =
    HAIR_STYLE_OPTIONS.find((item) => item.id === avatar.hairStyle)?.label ?? 'Braids';
  const matchesEquippedKitenge =
    avatar.primaryColor.toLowerCase() === outfitSpec.primaryColor.toLowerCase() &&
    avatar.accentColor.toLowerCase() === outfitSpec.accentColor.toLowerCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Character Customizer"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#24120C] border border-[#FAF3E8]/20 rounded-xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#FAF3E8]/12">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#FAF3E8]">
              Character Customizer
            </h2>
            <p className="text-xs text-[#E5D3BE]/75 mt-0.5">
              Personalize your courtyard hair style, Kitenge tunic color, and trim accent
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {onOpenStall && (
              <button
                type="button"
                onClick={onOpenStall}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-amber-400/30 text-xs font-semibold text-amber-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                <span className="hidden sm:inline">Courtyard Stall</span>
                <span className="sm:hidden">Stall</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Character Customizer"
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-[#FAF3E8]/15 text-[#FAF3E8] transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left Column: Live Courtyard Avatar Preview */}
            <div className="md:col-span-5 flex flex-col gap-4">
              <div className="relative rounded-lg bg-[#1A0B07] border border-[#FAF3E8]/15 p-5 flex flex-col items-center justify-center min-h-[280px]">
                {/* Sunlit Murram Court Floor Tile */}
                <svg
                  viewBox="0 0 180 210"
                  className="w-44 h-52 select-none"
                  role="img"
                  aria-label={`Avatar preview with ${activeHairLabel} hair`}
                >
                  {/* Perspective courtyard chalk square */}
                  <polygon
                    points="30,186 150,186 168,154 12,154"
                    fill="#7C2D12"
                    stroke="#FAF3E8"
                    strokeOpacity="0.6"
                    strokeWidth="2"
                  />
                  {/* Ground shadow */}
                  <ellipse cx="90" cy="172" rx="28" ry="8" fill="rgba(16,6,3,0.52)" />

                  {/* Articulated Legs & Sandals */}
                  <line
                    x1="79"
                    y1="122"
                    x2="74"
                    y2="167"
                    stroke={skinTone}
                    strokeWidth="9.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="101"
                    y1="122"
                    x2="106"
                    y2="167"
                    stroke={skinTone}
                    strokeWidth="9.5"
                    strokeLinecap="round"
                  />
                  <ellipse cx="74" cy="169" rx="9" ry="4.5" fill="#3E2723" />
                  <path
                    d="M67 167 Q74 162 81 167"
                    fill="none"
                    stroke={avatar.accentColor}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                  <ellipse cx="106" cy="169" rx="9" ry="4.5" fill="#3E2723" />
                  <path
                    d="M99 167 Q106 162 113 167"
                    fill="none"
                    stroke={avatar.accentColor}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />

                  {/* Shorts */}
                  <rect
                    x="70"
                    y="112"
                    width="40"
                    height="19"
                    rx="4"
                    fill="#291711"
                    stroke="#180B07"
                    strokeWidth="1.6"
                  />

                  {/* Arms */}
                  <line
                    x1="68"
                    y1="74"
                    x2="52"
                    y2="104"
                    stroke={skinTone}
                    strokeWidth="8.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="112"
                    y1="74"
                    x2="128"
                    y2="104"
                    stroke={skinTone}
                    strokeWidth="8.5"
                    strokeLinecap="round"
                  />

                  {/* Equipped Stone in Right Hand */}
                  <ellipse
                    cx="129"
                    cy="106"
                    rx="7.5"
                    ry="5.5"
                    fill={stoneSpec.midColor}
                    stroke={stoneSpec.motifColor}
                    strokeWidth="1.6"
                  />

                  {/* Kitenge Tunic with Live Primary + Accent Colors */}
                  <defs>
                    <clipPath id="customizer-tunic-clip">
                      <polygon points="65,68 115,68 121,116 59,116" />
                    </clipPath>
                  </defs>
                  <polygon
                    points="65,68 115,68 121,116 59,116"
                    fill={avatar.primaryColor}
                  />
                  <g clipPath="url(#customizer-tunic-clip)">
                    {/* Kitenge geometric diamond weave */}
                    <g
                      fill="none"
                      stroke={avatar.accentColor}
                      strokeOpacity="0.72"
                      strokeWidth="1.8"
                    >
                      <polygon points="72,77 80,87 72,97 64,87" />
                      <polygon points="90,77 98,87 90,97 82,87" />
                      <polygon points="108,77 116,87 108,97 100,87" />
                    </g>
                    {/* Waist Sash */}
                    <rect
                      x="58"
                      y="104"
                      width="64"
                      height="7"
                      fill={avatar.accentColor}
                    />
                  </g>
                  <polygon
                    points="65,68 115,68 121,116 59,116"
                    fill="none"
                    stroke="#180B07"
                    strokeWidth="2"
                  />

                  {/* Neck */}
                  <rect x="84" y="57" width="12" height="13" fill={skinTone} />

                  {/* Back Hair Layer */}
                  {avatar.hairStyle === 'afro' && (
                    <circle cx="90" cy="40" r="22" fill="#1E110B" />
                  )}
                  {avatar.hairStyle === 'braids' && (
                    <g fill="#1E110B">
                      <rect x="69" y="37" width="5.5" height="29" rx="2.75" />
                      <rect x="76.5" y="34" width="5.5" height="32" rx="2.75" />
                      <rect x="98" y="34" width="5.5" height="32" rx="2.75" />
                      <rect x="105.5" y="37" width="5.5" height="29" rx="2.75" />
                    </g>
                  )}
                  {avatar.hairStyle === 'bun' && (
                    <circle cx="90" cy="23" r="9.5" fill="#1E110B" />
                  )}

                  {/* Head */}
                  <circle
                    cx="90"
                    cy="43"
                    r="17"
                    fill={skinTone}
                    stroke="#180B07"
                    strokeWidth="1.8"
                  />

                  {/* Hair Crown */}
                  <path d="M73 41 A17 17 0 0 1 107 41 Z" fill="#1E110B" />
                  {avatar.hairStyle === 'fade' && (
                    <path
                      d="M74.5 39 A15.5 15.5 0 0 1 105.5 39"
                      fill="none"
                      stroke="#3B2317"
                      strokeWidth="2.5"
                    />
                  )}

                  {/* Woven Headband */}
                  <path
                    d="M74 37.5 Q90 32.5 106 37.5"
                    fill="none"
                    stroke={avatar.accentColor}
                    strokeWidth="4.2"
                    strokeLinecap="round"
                  />

                  {/* Facial Expression */}
                  <circle cx="84" cy="45" r="2.1" fill="#180B07" />
                  <circle cx="96" cy="45" r="2.1" fill="#180B07" />
                  <path
                    d="M84.5 50.5 Q90 55 95.5 50.5"
                    fill="none"
                    stroke="#2B130B"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>

                {/* Unboxed metadata summary */}
                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-[#E5D3BE]/80 font-mono-num">
                  <span className="text-[#FAF3E8] font-medium font-sans">{activeHairLabel}</span>
                  <span aria-hidden="true" className="text-[#FAF3E8]/30">
                    ·
                  </span>
                  <span>{avatar.primaryColor.toUpperCase()}</span>
                  <span aria-hidden="true" className="text-[#FAF3E8]/30">
                    ·
                  </span>
                  <span>{avatar.accentColor.toUpperCase()}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={matchesEquippedKitenge}
                onClick={() =>
                  onUpdateAvatar(
                    {
                      primaryColor: outfitSpec.primaryColor,
                      accentColor: outfitSpec.accentColor,
                    },
                    true
                  )
                }
                className={`w-full py-2.5 px-4 rounded-lg border text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                  matchesEquippedKitenge
                    ? 'bg-[#1A0B07]/60 border-[#FAF3E8]/10 text-[#E5D3BE]/45 cursor-default'
                    : 'bg-[#381E14] hover:bg-[#49281B] border-[#FAF3E8]/20 text-[#FAF3E8] cursor-pointer'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                <span>Match {outfitSpec.name}</span>
              </button>
            </div>

            {/* Right Column: Hair Style, Primary Color & Accent Color Controls */}
            <div className="md:col-span-7 flex flex-col gap-6">
              {/* Hair Style Selector */}
              <div>
                <div className="text-xs font-medium text-[#E5D3BE]/80 mb-2.5">Hair Style</div>
                <div
                  role="radiogroup"
                  aria-label="Select hair style"
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                >
                  {HAIR_STYLE_OPTIONS.map((opt) => {
                    const selected = avatar.hairStyle === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onUpdateAvatar({ hairStyle: opt.id }, true)}
                        className={`flex flex-col items-center gap-1.5 py-2.5 px-3 rounded-lg border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                          selected
                            ? 'bg-[#341A11] border-amber-400 text-[#FAF3E8]'
                            : 'bg-[#1A0B07]/85 border-[#FAF3E8]/15 text-[#E5D3BE]/80 hover:border-[#FAF3E8]/35 hover:text-white'
                        }`}
                      >
                        <HairIcon style={opt.id} />
                        <span className="text-xs font-semibold whitespace-nowrap">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Primary Tunic Color */}
              <div className="pt-4 border-t border-[#FAF3E8]/12">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="text-xs font-medium text-[#E5D3BE]/80">
                    Primary Color (Tunic)
                  </span>
                  <label className="inline-flex items-center gap-2 text-xs font-mono-num text-[#FAF3E8] cursor-pointer">
                    <span className="text-[#E5D3BE]/70">Custom</span>
                    <input
                      type="color"
                      aria-label="Custom primary tunic color"
                      value={avatar.primaryColor}
                      onChange={(e) => onUpdateAvatar({ primaryColor: e.target.value }, false)}
                      className="w-7 h-7 rounded cursor-pointer bg-transparent border border-[#FAF3E8]/25 p-0.5"
                    />
                  </label>
                </div>

                <div
                  role="radiogroup"
                  aria-label="Select primary tunic color"
                  className="grid grid-cols-4 sm:grid-cols-8 gap-2"
                >
                  {PRIMARY_COLOR_SWATCHES.map((swatch) => {
                    const selected =
                      avatar.primaryColor.toLowerCase() === swatch.hex.toLowerCase();
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`${swatch.label} (${swatch.hex})`}
                        title={swatch.label}
                        onClick={() => onUpdateAvatar({ primaryColor: swatch.hex }, true)}
                        className={`h-10 rounded-lg border flex items-center justify-center transition-transform active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                          selected
                            ? 'border-amber-300 ring-2 ring-amber-400/60'
                            : 'border-[#FAF3E8]/20 hover:border-[#FAF3E8]/60'
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      >
                        {selected && (
                          <Check className="w-4 h-4 text-white drop-shadow" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accent Trim Color */}
              <div className="pt-4 border-t border-[#FAF3E8]/12">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="text-xs font-medium text-[#E5D3BE]/80">
                    Accent Color (Headband &amp; Sash)
                  </span>
                  <label className="inline-flex items-center gap-2 text-xs font-mono-num text-[#FAF3E8] cursor-pointer">
                    <span className="text-[#E5D3BE]/70">Custom</span>
                    <input
                      type="color"
                      aria-label="Custom accent trim color"
                      value={avatar.accentColor}
                      onChange={(e) => onUpdateAvatar({ accentColor: e.target.value }, false)}
                      className="w-7 h-7 rounded cursor-pointer bg-transparent border border-[#FAF3E8]/25 p-0.5"
                    />
                  </label>
                </div>

                <div
                  role="radiogroup"
                  aria-label="Select accent trim color"
                  className="grid grid-cols-4 sm:grid-cols-8 gap-2"
                >
                  {ACCENT_COLOR_SWATCHES.map((swatch) => {
                    const selected =
                      avatar.accentColor.toLowerCase() === swatch.hex.toLowerCase();
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`${swatch.label} (${swatch.hex})`}
                        title={swatch.label}
                        onClick={() => onUpdateAvatar({ accentColor: swatch.hex }, true)}
                        className={`h-10 rounded-lg border flex items-center justify-center transition-transform active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                          selected
                            ? 'border-white ring-2 ring-amber-400/75'
                            : 'border-[#FAF3E8]/20 hover:border-[#FAF3E8]/60'
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      >
                        {selected && (
                          <Check className="w-4 h-4 text-[#1A0B07]" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#FAF3E8]/12 flex items-center justify-between gap-4">
          <div className="text-xs text-[#E5D3BE]/70">
            Saved automatically to your player profile
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
