import React, { useState } from 'react';
import { Check, Copy, Globe, KeyRound, Link2, Loader2, Sparkles, X } from 'lucide-react';
import { OnlineRoomState } from '../game/onlineClient';
import { COURT_VENUES, getVenueSpec } from '../game/progression';
import { CourtSize, CourtVenueId } from '../game/types';

interface OnlineLobbyModalProps {
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  selectedCourtSize: CourtSize;
  selectedVenue: CourtVenueId;
  initialJoinCode?: string;
  activeRoom: OnlineRoomState | null;
  yourSlot: 0 | 1 | null;
  wsConnected: boolean;
  errorMessage: string | null;
  onCreateRoom: (isPublic: boolean) => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
  onClose: () => void;
}

export function OnlineLobbyModal({
  playerName,
  onPlayerNameChange,
  selectedCourtSize,
  selectedVenue,
  initialJoinCode = '',
  activeRoom,
  yourSlot,
  wsConnected,
  errorMessage,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onClose,
}: OnlineLobbyModalProps) {
  const [joinCode, setJoinCode] = useState(initialJoinCode.toUpperCase());
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);

  const venueSpec = getVenueSpec(activeRoom?.venue ?? selectedVenue);

  const handleCopy = async (kind: 'code' | 'link') => {
    if (!activeRoom) return;
    const text =
      kind === 'code'
        ? activeRoom.code
        : `${window.location.origin}${window.location.pathname}?room=${activeRoom.code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(kind);
      window.setTimeout(() => setCopiedType(null), 1800);
    } catch {
      // Fallback ignored gracefully
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Online 1v1 Courtyard"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
    >
      <div className="w-full max-w-lg flex flex-col bg-[#24120C] border border-[#FAF3E8]/20 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#FAF3E8]/12">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#FAF3E8]">Online 1v1 Courtyard</h2>
            <p className="text-xs text-[#E5D3BE]/75 mt-0.5">
              Play live head-to-head with your unlocked stone, Kitenge outfit, and House stencil
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Online Lobby"
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-[#FAF3E8]/15 text-[#FAF3E8] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Player Name Input */}
          <div>
            <label
              htmlFor="online-player-name"
              className="block text-xs font-medium text-[#E5D3BE]/80 mb-1.5"
            >
              Your Courtyard Name
            </label>
            <input
              id="online-player-name"
              type="text"
              maxLength={20}
              value={playerName}
              onChange={(e) => onPlayerNameChange(e.target.value)}
              placeholder="e.g. Nakato"
              disabled={Boolean(activeRoom)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#1A0B07] border border-[#FAF3E8]/20 text-sm text-[#FAF3E8] placeholder:text-[#E5D3BE]/35 focus:outline-2 focus:outline-amber-400 disabled:opacity-65"
            />
          </div>

          {errorMessage && (
            <div className="px-3.5 py-2.5 rounded-lg bg-red-950/60 border border-red-400/40 text-xs text-red-200">
              {errorMessage}
            </div>
          )}

          {/* Waiting Room View OR Create/Join View */}
          {activeRoom && activeRoom.status === 'WAITING' ? (
            <div className="bg-[#1A0B07]/90 border border-amber-400/35 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-[#E5D3BE]/75">
                    {activeRoom.isPublic ? 'Public Quick Match Waiting' : 'Private Courtyard Room'}
                  </div>
                  <div className="font-mono-num text-3xl font-extrabold tracking-widest text-amber-300 mt-1">
                    {activeRoom.code}
                  </div>
                </div>
                <div className="text-right text-xs text-[#E5D3BE]/80">
                  <div className="font-semibold text-[#FAF3E8]">{venueSpec.name}</div>
                  <div className="font-mono-num">
                    {activeRoom.courtSize === 10 ? 'Classic 10' : 'Quick 5'} · Slot{' '}
                    {(yourSlot ?? 0) + 1}/2
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy('code')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#341A11] hover:bg-[#49281B] border border-[#FAF3E8]/15 text-xs font-medium text-[#FAF3E8] transition-colors cursor-pointer"
                >
                  {copiedType === 'code' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copied Code</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-amber-300" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy('link')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#341A11] hover:bg-[#49281B] border border-[#FAF3E8]/15 text-xs font-medium text-[#FAF3E8] transition-colors cursor-pointer"
                >
                  {copiedType === 'link' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Invite Link Copied</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3.5 h-3.5 text-amber-300" />
                      <span>Copy Invite Link</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#FAF3E8]/10 text-xs text-[#E5D3BE]/85">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                  <span>Waiting for challenger to step onto the court...</span>
                </span>
                <button
                  type="button"
                  onClick={onLeaveRoom}
                  className="text-red-300 hover:text-red-200 font-medium cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Match Settings Preview */}
              <div className="flex items-center justify-between text-xs text-[#E5D3BE]/80 px-3 py-2 rounded-lg bg-[#1A0B07]/70 border border-[#FAF3E8]/10">
                <span>
                  Hosting on <strong className="text-[#FAF3E8]">{getVenueSpec(selectedVenue).name}</strong>{' '}
                  ({selectedCourtSize === 10 ? 'Classic 10' : 'Quick 5'})
                </span>
                <span className="font-mono-num text-amber-300">
                  {COURT_VENUES.find((v) => v.id === selectedVenue)?.cowrieMultiplier ?? 1}x Cowries
                </span>
              </div>

              {/* Create Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onCreateRoom(true)}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] font-display font-bold text-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Globe className="w-4 h-4" />
                  <span>Quick Match</span>
                </button>

                <button
                  type="button"
                  onClick={() => onCreateRoom(false)}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-amber-400/35 text-amber-200 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Create Invite Room</span>
                </button>
              </div>

              {/* Join by Code */}
              <div className="pt-3 border-t border-[#FAF3E8]/12">
                <label
                  htmlFor="online-join-code"
                  className="block text-xs font-medium text-[#E5D3BE]/80 mb-2"
                >
                  Have a Friend&apos;s Room Code?
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="w-4 h-4 text-[#E5D3BE]/45 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="online-join-code"
                      type="text"
                      maxLength={8}
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="ENTER CODE"
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#1A0B07] border border-[#FAF3E8]/20 text-sm font-mono-num uppercase tracking-widest text-[#FAF3E8] placeholder:text-[#E5D3BE]/35 focus:outline-2 focus:outline-amber-400"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={joinCode.trim().length < 4}
                    onClick={() => onJoinRoom(joinCode)}
                    className="px-5 py-2.5 rounded-lg bg-[#FAF3E8] hover:bg-white disabled:bg-[#2C1810] disabled:text-[#E5D3BE]/40 text-[#1A0B07] font-semibold text-sm transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Join Match
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Subtle Connection Footer */}
          <div className="flex items-center justify-between text-[11px] text-[#E5D3BE]/60 pt-1">
            <span>
              {wsConnected ? 'Connected to Courtyard Server' : 'Connecting to Courtyard Server...'}
            </span>
            <span>Real-time turn sync</span>
          </div>
        </div>
      </div>
    </div>
  );
}
