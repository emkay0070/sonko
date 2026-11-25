import React, { useState } from 'react';
import { Check, Lock, Palette, X } from 'lucide-react';
import {
  OUTFIT_CATALOG,
  ProgressionData,
  STENCIL_CATALOG,
  STONE_CATALOG,
} from '../game/progression';
import { OutfitId, StencilId, StoneId } from '../game/types';

interface CourtyardStallModalProps {
  progression: ProgressionData;
  onClose: () => void;
  onOpenWardrobe?: () => void;
  onBuyOrEquipStone: (id: StoneId) => void;
  onBuyOrEquipOutfit: (id: OutfitId) => void;
  onBuyOrEquipStencil: (id: StencilId) => void;
}

type StallTab = 'STONES' | 'OUTFITS' | 'STENCILS';

export function CowrieIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <ellipse cx="12" cy="12" rx="7.5" ry="10" fill="#FAF3E8" stroke="#78350F" strokeWidth="1.6" />
      <path
        d="M12 4.2 C10.5 8, 10.5 16, 12 19.8"
        fill="none"
        stroke="#451A03"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8.5 7.5 L10.7 8 M8 12 L10.6 12 M8.5 16.5 L10.7 16 M15.5 7.5 L13.3 8 M16 12 L13.4 12 M15.5 16.5 L13.3 16"
        stroke="#78350F"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CourtyardStallModal({
  progression,
  onClose,
  onOpenWardrobe,
  onBuyOrEquipStone,
  onBuyOrEquipOutfit,
  onBuyOrEquipStencil,
}: CourtyardStallModalProps) {
  const [tab, setTab] = useState<StallTab>('STONES');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Courtyard Stall"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
    >
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-[#24120C] border border-[#FAF3E8]/20 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#FAF3E8]/12">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#FAF3E8]">Courtyard Stall</h2>
            <p className="text-xs text-[#E5D3BE]/75 mt-0.5">
              Unlock carved stones, Kitenge outfits, and House chalk stencils with Cowries
            </p>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-200 font-mono-num">
              <CowrieIcon className="w-5 h-5" />
              <span>{progression.cowries} Cowries</span>
            </div>
            {onOpenWardrobe && (
              <button
                type="button"
                onClick={onOpenWardrobe}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-amber-400/30 text-xs font-semibold text-amber-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Palette className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                <span className="hidden sm:inline">Avatar Wardrobe</span>
                <span className="sm:hidden">Wardrobe</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Courtyard Stall"
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-[#FAF3E8]/15 text-[#FAF3E8] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-6 pt-4 pb-2">
          <div
            role="tablist"
            aria-label="Stall categories"
            className="inline-grid grid-cols-3 gap-1.5 p-1 bg-[#1A0B07] border border-[#FAF3E8]/15 rounded-lg"
          >
            {(
              [
                { id: 'STONES', label: 'River Stones' },
                { id: 'OUTFITS', label: 'Kitenge Outfits' },
                { id: 'STENCILS', label: 'House Stencils' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  tab === t.id
                    ? 'bg-[#F59E0B] text-[#1A0B07] font-semibold'
                    : 'text-[#F3E6D6]/80 hover:text-white hover:bg-white/5'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === 'STONES' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {STONE_CATALOG.map((item) => {
                const unlocked = progression.unlockedStones.includes(item.id);
                const equipped = progression.equippedStone === item.id;
                const canAfford = progression.cowries >= item.price;

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between gap-4 p-4 rounded-lg border transition-colors ${
                      equipped
                        ? 'bg-[#341A11] border-amber-400/70'
                        : 'bg-[#1A0B07]/75 border-[#FAF3E8]/12'
                    }`}
                  >
                    <div className="flex flex-col gap-3">
                      {/* Stone SVG Preview */}
                      <div className="h-20 rounded-md bg-[#7C2D12]/45 border border-[#FAF3E8]/10 flex items-center justify-center">
                        <svg viewBox="0 0 80 60" className="w-20 h-14">
                          <ellipse cx="42" cy="34" rx="22" ry="16" fill="rgba(20,8,4,0.45)" />
                          <ellipse
                            cx="40"
                            cy="30"
                            rx="22"
                            ry="16"
                            fill={item.midColor}
                            stroke={item.edgeColor}
                            strokeWidth="2.5"
                          />
                          <ellipse cx="36" cy="26" rx="12" ry="7" fill={item.coreColor} opacity="0.55" />
                          {item.motif === 'circle' && (
                            <circle cx="40" cy="30" r="7" fill="none" stroke={item.motifColor} strokeWidth="2" />
                          )}
                          {item.motif === 'spiral' && (
                            <path
                              d="M40 30 C43 30, 44 26, 40 25 C34 24, 33 34, 40 35 C47 36, 49 24, 41 21"
                              fill="none"
                              stroke={item.motifColor}
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          )}
                          {item.motif === 'ember' && (
                            <ellipse
                              cx="40"
                              cy="30"
                              rx="19"
                              ry="13"
                              fill="none"
                              stroke={item.motifColor}
                              strokeWidth="2"
                            />
                          )}
                          {item.motif === 'cowrie' && (
                            <g fill={item.motifColor}>
                              <circle cx="40" cy="21" r="2.2" />
                              <circle cx="48" cy="25" r="2.2" />
                              <circle cx="48" cy="35" r="2.2" />
                              <circle cx="40" cy="39" r="2.2" />
                              <circle cx="32" cy="35" r="2.2" />
                              <circle cx="32" cy="25" r="2.2" />
                            </g>
                          )}
                          {item.motif === 'sunburst' && (
                            <g stroke={item.motifColor} strokeWidth="1.8" strokeLinecap="round">
                              <circle cx="40" cy="30" r="4.5" fill="none" />
                              <line x1="40" y1="20" x2="40" y2="23" />
                              <line x1="40" y1="37" x2="40" y2="40" />
                              <line x1="30" y1="30" x2="33" y2="30" />
                              <line x1="47" y1="30" x2="50" y2="30" />
                            </g>
                          )}
                        </svg>
                      </div>

                      <div>
                        <h3 className="font-display font-bold text-base text-[#FAF3E8]">
                          {item.name}
                        </h3>
                        <p className="text-xs text-[#E5D3BE]/75 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!unlocked && !canAfford}
                      onClick={() => onBuyOrEquipStone(item.id)}
                      className={`w-full py-2 px-3 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                        equipped
                          ? 'bg-emerald-700/60 text-emerald-100 border border-emerald-400/40 cursor-default'
                          : unlocked
                            ? 'bg-[#FAF3E8] hover:bg-white text-[#1A0B07] cursor-pointer'
                            : canAfford
                              ? 'bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] cursor-pointer'
                              : 'bg-[#2C1810] text-[#E5D3BE]/45 border border-[#FAF3E8]/10 cursor-not-allowed'
                      }`}
                    >
                      {equipped ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Equipped</span>
                        </>
                      ) : unlocked ? (
                        <span>Equip</span>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span className="font-mono-num">Unlock · {item.price}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'OUTFITS' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {OUTFIT_CATALOG.map((item) => {
                const unlocked = progression.unlockedOutfits.includes(item.id);
                const equipped = progression.equippedOutfit === item.id;
                const canAfford = progression.cowries >= item.price;

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between gap-4 p-4 rounded-lg border transition-colors ${
                      equipped
                        ? 'bg-[#341A11] border-amber-400/70'
                        : 'bg-[#1A0B07]/75 border-[#FAF3E8]/12'
                    }`}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="h-28 rounded-md bg-[#7C2D12]/45 border border-[#FAF3E8]/10 flex items-center justify-center">
                        <svg viewBox="0 0 80 86" className="w-24 h-24">
                          {/* Ground shadow */}
                          <ellipse cx="40" cy="79" rx="14" ry="4" fill="rgba(20,8,4,0.45)" />
                          {/* Legs & sandals */}
                          <line x1="35" y1="53" x2="33" y2="76" stroke="#6B3A24" strokeWidth="4.5" strokeLinecap="round" />
                          <line x1="45" y1="53" x2="47" y2="76" stroke="#6B3A24" strokeWidth="4.5" strokeLinecap="round" />
                          <ellipse cx="33" cy="77" rx="4.5" ry="2.2" fill="#3E2723" />
                          <ellipse cx="47" cy="77" rx="4.5" ry="2.2" fill="#3E2723" />
                          {/* Shorts */}
                          <rect x="30" y="48" width="20" height="9" rx="2" fill="#291711" />
                          {/* Arms */}
                          <line x1="29" y1="31" x2="21" y2="45" stroke="#6B3A24" strokeWidth="3.8" strokeLinecap="round" />
                          <line x1="51" y1="31" x2="59" y2="45" stroke="#6B3A24" strokeWidth="3.8" strokeLinecap="round" />
                          {/* Kitenge Tunic */}
                          <polygon
                            points="28,28 52,28 55,50 25,50"
                            fill={item.primaryColor}
                            stroke="#180B07"
                            strokeWidth="1.6"
                          />
                          <rect x="26" y="44.5" width="28" height="3.5" fill={item.accentColor} />
                          <polygon points="40,31 44,36 40,41 36,36" fill="none" stroke={item.accentColor} strokeWidth="1.4" />
                          {/* Head, braids & headband */}
                          <rect x="34" y="13" width="3" height="12" rx="1.5" fill="#1E110B" />
                          <rect x="43" y="13" width="3" height="12" rx="1.5" fill="#1E110B" />
                          <circle cx="40" cy="18" r="8" fill="#6B3A24" stroke="#180B07" strokeWidth="1.4" />
                          <path d="M32 16 A8 8 0 0 1 48 16 Z" fill="#1E110B" />
                          <path d="M33 14.5 Q40 12 47 14.5" fill="none" stroke={item.accentColor} strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                      </div>

                      <div>
                        <h3 className="font-display font-bold text-base text-[#FAF3E8]">
                          {item.name}
                        </h3>
                        <p className="text-xs text-[#E5D3BE]/75 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!unlocked && !canAfford}
                      onClick={() => onBuyOrEquipOutfit(item.id)}
                      className={`w-full py-2 px-3 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                        equipped
                          ? 'bg-emerald-700/60 text-emerald-100 border border-emerald-400/40 cursor-default'
                          : unlocked
                            ? 'bg-[#FAF3E8] hover:bg-white text-[#1A0B07] cursor-pointer'
                            : canAfford
                              ? 'bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] cursor-pointer'
                              : 'bg-[#2C1810] text-[#E5D3BE]/45 border border-[#FAF3E8]/10 cursor-not-allowed'
                      }`}
                    >
                      {equipped ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Equipped</span>
                        </>
                      ) : unlocked ? (
                        <span>Equip</span>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span className="font-mono-num">Unlock · {item.price}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'STENCILS' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {STENCIL_CATALOG.map((item) => {
                const unlocked = progression.unlockedStencils.includes(item.id);
                const equipped = progression.equippedStencil === item.id;
                const canAfford = progression.cowries >= item.price;

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between gap-4 p-4 rounded-lg border transition-colors ${
                      equipped
                        ? 'bg-[#341A11] border-amber-400/70'
                        : 'bg-[#1A0B07]/75 border-[#FAF3E8]/12'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-md bg-[#7C2D12]/55 border border-[#FAF3E8]/25 flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 60 60" className="w-16 h-16">
                          <rect
                            x="6"
                            y="6"
                            width="48"
                            height="48"
                            fill="rgba(22,163,74,0.22)"
                            stroke="#FAF3E8"
                            strokeWidth="2.5"
                          />
                          <g stroke="#86EFAC" strokeWidth="1.6" fill="none" opacity="0.85">
                            {item.id === 'basket_weave' && (
                              <>
                                <line x1="6" y1="22" x2="22" y2="6" />
                                <line x1="6" y1="42" x2="42" y2="6" />
                                <line x1="18" y1="54" x2="54" y2="18" />
                                <line x1="38" y1="54" x2="54" y2="38" />
                                <line x1="6" y1="38" x2="22" y2="54" />
                                <line x1="6" y1="18" x2="42" y2="54" />
                                <line x1="18" y1="6" x2="54" y2="42" />
                              </>
                            )}
                            {item.id === 'sunburst' && (
                              <>
                                <circle cx="30" cy="30" r="8" />
                                <line x1="30" y1="10" x2="30" y2="18" />
                                <line x1="30" y1="42" x2="30" y2="50" />
                                <line x1="10" y1="30" x2="18" y2="30" />
                                <line x1="42" y1="30" x2="50" y2="30" />
                                <line x1="15" y1="15" x2="22" y2="22" />
                                <line x1="38" y1="38" x2="45" y2="45" />
                                <line x1="45" y1="15" x2="38" y2="22" />
                                <line x1="22" y1="38" x2="15" y2="45" />
                              </>
                            )}
                            {item.id === 'royal_drums' && (
                              <>
                                <circle cx="30" cy="30" r="7" />
                                <circle cx="30" cy="30" r="14" />
                                <circle cx="30" cy="30" r="20" />
                                <rect x="12" y="12" width="36" height="36" />
                              </>
                            )}
                            {item.id === 'crested_crown' && (
                              <>
                                <polyline points="12,24 30,14 48,24" />
                                <polyline points="12,34 30,24 48,34" />
                                <polyline points="12,44 30,34 48,44" />
                                <circle cx="30" cy="14" r="2.5" />
                              </>
                            )}
                          </g>
                        </svg>
                      </div>

                      <div>
                        <h3 className="font-display font-bold text-base text-[#FAF3E8]">
                          {item.name}
                        </h3>
                        <p className="text-xs text-[#E5D3BE]/75 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!unlocked && !canAfford}
                      onClick={() => onBuyOrEquipStencil(item.id)}
                      className={`w-full py-2 px-3 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                        equipped
                          ? 'bg-emerald-700/60 text-emerald-100 border border-emerald-400/40 cursor-default'
                          : unlocked
                            ? 'bg-[#FAF3E8] hover:bg-white text-[#1A0B07] cursor-pointer'
                            : canAfford
                              ? 'bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] cursor-pointer'
                              : 'bg-[#2C1810] text-[#E5D3BE]/45 border border-[#FAF3E8]/10 cursor-not-allowed'
                      }`}
                    >
                      {equipped ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Equipped</span>
                        </>
                      ) : unlocked ? (
                        <span>Equip</span>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span className="font-mono-num">Unlock · {item.price}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
