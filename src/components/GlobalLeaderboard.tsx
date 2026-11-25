import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Crown,
  Globe,
  Medal,
  Play,
  RefreshCw,
  Send,
  Trophy,
  UserCheck,
} from 'lucide-react';
import {
  fetchGlobalLeaderboard,
  GlobalLeaderboardResponse,
  submitGlobalLeaderboardScore,
} from '../game/leaderboard';
import { getVenueSpec } from '../game/progression';
import { CourtVenueId, PlayMode } from '../game/types';

interface GlobalLeaderboardProps {
  playerId: string;
  playerName: string;
  onPlayerNameChange: (nextName: string) => void;
  bestScore: number;
  totalWins: number;
  totalBullseyes: number;
  totalHouses: number;
  preferredVenue: CourtVenueId;
  preferredMode: PlayMode;
  onPlayNow: () => void;
}

function formatModeTag(mode: PlayMode): string {
  switch (mode) {
    case 'SOLO':
      return 'Solo';
    case 'TWO_PLAYER':
      return '2P Local';
    case 'TEAM_2V2':
      return '2v2';
    case 'ONLINE_1V1':
      return 'Online 1v1';
    case 'VS_BOT':
    default:
      return 'VS Bot';
  }
}

export function GlobalLeaderboard({
  playerId,
  playerName,
  onPlayerNameChange,
  bestScore,
  totalWins,
  totalBullseyes,
  totalHouses,
  preferredVenue,
  preferredMode,
  onPlayNow,
}: GlobalLeaderboardProps) {
  const [data, setData] = useState<GlobalLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState(playerName);

  useEffect(() => {
    setDraftName(playerName);
  }, [playerName]);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchGlobalLeaderboard(playerId);
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach global rankings.');
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const handleSubmitProfileOrScore = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = draftName.trim().slice(0, 24) || 'Courtyard Player';
    onPlayerNameChange(cleaned);
    setDraftName(cleaned);

    const scoreToSubmit = Math.max(bestScore, data?.yourEntry?.bestScore ?? 0);
    if (scoreToSubmit <= 0) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const updated = await submitGlobalLeaderboardScore({
        playerId,
        name: cleaned,
        score: scoreToSubmit,
        venue: data?.yourEntry?.venue ?? preferredVenue,
        mode: data?.yourEntry?.mode ?? preferredMode,
        wins: totalWins,
        bullseyes: totalBullseyes,
        houses: totalHouses,
      });
      setData(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update global score.');
    } finally {
      setSubmitting(false);
    }
  };

  const entries = data?.entries ?? [];
  const yourEntry = data?.yourEntry ?? null;
  const yourRank = data?.yourRank ?? null;
  const needsSync =
    bestScore > 0 &&
    (!yourEntry ||
      bestScore > yourEntry.bestScore ||
      (draftName.trim() || 'Courtyard Player') !== yourEntry.name);

  return (
    <section
      aria-label="Global Top 10 Leaderboard"
      className="w-full rounded-xl bg-[#1D0E09]/96 border border-amber-400/35 shadow-2xl overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-[#FAF3E8]/12 bg-[#160906] flex items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
            <Globe className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Top 10 Global Scores</span>
          </div>
          <h2 className="font-display text-xl font-bold text-[#FAF3E8] leading-tight mt-0.5">
            Global Leaderboard
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {data && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2A150E] border border-[#FAF3E8]/12 text-[11px] font-mono-num text-[#E5D3BE]/80">
              <Trophy className="w-3 h-3 text-amber-300" aria-hidden="true" />
              <span>{data.totalPlayers} Ranked</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => void loadLeaderboard()}
            disabled={loading}
            aria-label="Refresh global leaderboard"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#2D170F] hover:bg-[#3B1E14] border border-[#FAF3E8]/15 text-amber-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Player Handle & Personal Best Bar */}
      <form
        onSubmit={handleSubmitProfileOrScore}
        className="px-4 py-3 border-b border-[#FAF3E8]/10 bg-[#24110B] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <label htmlFor="leaderboard-player-name" className="sr-only">
            Your Leaderboard Name
          </label>
          <input
            id="leaderboard-player-name"
            type="text"
            maxLength={24}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Your player name"
            className="min-w-0 flex-1 px-2.5 py-1.5 rounded-lg bg-[#140906] border border-[#FAF3E8]/18 focus:border-amber-400 focus:outline-none text-xs text-[#FAF3E8] placeholder:text-[#E5D3BE]/40"
          />
          {bestScore > 0 ? (
            <button
              type="submit"
              disabled={submitting}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 disabled:opacity-60 ${
                needsSync
                  ? 'bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07]'
                  : 'bg-[#341A11] hover:bg-[#442317] border border-[#FAF3E8]/15 text-[#FAF3E8]'
              }`}
            >
              <Send className="w-3 h-3" aria-hidden="true" />
              <span>{submitting ? 'Saving...' : needsSync ? `Post ${bestScore} pts` : 'Save Name'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onPlayerNameChange(draftName.trim().slice(0, 24) || 'Courtyard Player');
                onPlayNow();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] text-xs font-semibold transition-colors cursor-pointer shrink-0"
            >
              <Play className="w-3 h-3 fill-current" aria-hidden="true" />
              <span>Play to Rank</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono-num text-[#E5D3BE]/80 shrink-0">
          {yourRank !== null && yourEntry ? (
            <span className="inline-flex items-center gap-1 text-amber-200 font-semibold">
              <UserCheck className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
              <span>
                You #{yourRank} · {yourEntry.bestScore} pts
              </span>
            </span>
          ) : (
            <span>Career Best: {bestScore} pts</span>
          )}
        </div>
      </form>

      {/* Error State */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-red-950/60 border border-red-400/40 text-xs text-red-200 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadLeaderboard()}
            className="underline font-semibold text-red-100 cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Top 10 List */}
      <div className="p-3.5 max-h-[340px] overflow-y-auto flex flex-col gap-1.5">
        {loading && !data ? (
          <div className="py-8 text-center text-xs text-[#E5D3BE]/70">
            Loading global courtyard rankings...
          </div>
        ) : entries.length === 0 ? (
          <div className="py-8 px-4 text-center flex flex-col items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[#2D170F] border border-amber-400/30 flex items-center justify-center text-amber-300">
              <Trophy className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="text-sm font-semibold text-[#FAF3E8]">
              No Global Scores Recorded Yet
            </div>
            <p className="text-xs text-[#E5D3BE]/70 max-w-xs">
              Finish a match in any mode or post your career best above to claim Rank #1 on the
              global board.
            </p>
          </div>
        ) : (
          entries.map((entry, idx) => {
            const rank = idx + 1;
            const isYou = entry.playerId === playerId;
            const venueSpec = getVenueSpec(entry.venue);

            return (
              <div
                key={entry.playerId}
                className={`px-3 py-2.5 rounded-lg border flex items-center justify-between gap-3 transition-colors ${
                  isYou
                    ? 'bg-[#361C12] border-amber-400'
                    : rank === 1
                      ? 'bg-[#2E1810] border-amber-400/55'
                      : rank <= 3
                        ? 'bg-[#24120C] border-[#FAF3E8]/18'
                        : 'bg-[#170B07]/90 border-[#FAF3E8]/10'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Rank Medal */}
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-mono-num text-xs font-extrabold border ${
                      rank === 1
                        ? 'bg-[#F59E0B] border-amber-300 text-[#1A0B07]'
                        : rank === 2
                          ? 'bg-slate-300/20 border-slate-300/50 text-slate-200'
                          : rank === 3
                            ? 'bg-orange-500/20 border-orange-400/50 text-orange-200'
                            : 'bg-[#25130D] border-[#FAF3E8]/12 text-[#E5D3BE]/80'
                    }`}
                  >
                    {rank === 1 ? (
                      <Crown className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : rank === 2 || rank === 3 ? (
                      <Medal className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <span>#{rank}</span>
                    )}
                  </div>

                  {/* Player Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display font-bold text-sm text-[#FAF3E8] truncate">
                        {entry.name}
                      </span>
                      {isYou && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-[10px] font-bold uppercase text-amber-200 shrink-0">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#E5D3BE]/65 truncate">
                      {venueSpec.shortName} · {formatModeTag(entry.mode)}
                      {entry.wins > 0 ? ` · ${entry.wins}W` : ''}
                      {entry.bullseyes > 0 ? ` · ${entry.bullseyes} Bullseyes` : ''}
                    </div>
                  </div>
                </div>

                {/* High Score */}
                <div className="text-right shrink-0">
                  <div className="inline-flex items-center gap-1 font-mono-num text-sm font-extrabold text-amber-200">
                    {rank === 1 && <Award className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />}
                    <span>{entry.bestScore.toLocaleString()}</span>
                  </div>
                  <div className="text-[10px] font-mono-num text-[#E5D3BE]/55 uppercase">
                    pts
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
