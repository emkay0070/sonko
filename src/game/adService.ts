import { sonkoAudio } from './audio';
import { getLocalDateKey } from './dailyStreak';
import type {
  AdDisplayRequest,
  AdPlacement,
  AdProviderAdapter,
  AdProviderId,
  AdShowOutcome,
  AdSimulatorSession,
  MonetizationStatus,
  PlayMode,
} from './types';
import { sonkoVoice } from './voiceEngine';

type AdsByGoogleQueue = Array<Record<string, unknown>> & {
  requestNonPersonalizedAds?: 0 | 1;
};

declare global {
  interface Window {
    adsbygoogle?: AdsByGoogleQueue;
    adBreak?: (config: H5AdBreakConfig) => void;
    adConfig?: (config: {
      preloadAdBreaks?: 'on' | 'auto';
      sound?: 'on' | 'off';
      onReady?: () => void;
    }) => void;
  }
}

export function applyAdConsentPreference(
  consent: 'unset' | 'personalized' | 'non_personalized'
): void {
  if (typeof window === 'undefined') return;
  const queue = (window.adsbygoogle || []) as AdsByGoogleQueue;
  queue.requestNonPersonalizedAds = consent === 'non_personalized' ? 1 : 0;
  window.adsbygoogle = queue;
}

interface H5AdBreakConfig {
  type: 'reward' | 'next' | 'browse' | 'pause' | 'start';
  name: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward?: (showAdFn: () => void) => void;
  adDismissed?: () => void;
  adViewed?: () => void;
  adBreakDone?: (placementInfo: {
    breakType?: string;
    breakName?: string;
    breakFormat?: 'interstitial' | 'reward';
    breakStatus?: 'notReady' | 'timeout' | 'error' | 'noAdPreloaded' | 'frequencyCapped' | 'ignored' | 'other' | 'viewed' | 'dismissed';
  }) => void;
}

const ADSENSE_CLIENT_RE = /^ca-pub-\d{10,20}$/;

function getPlacementCopy(
  placement: AdPlacement,
  rewardLabel?: string
): { title: string; subtitle: string } {
  switch (placement) {
    case 'double_match':
      return {
        title: 'Double Match Cowries',
        subtitle: rewardLabel
          ? `Watch this short sponsor spot to earn ${rewardLabel}.`
          : 'Watch this short sponsor spot to double your match Cowries.',
      };
    case 'mission_reroll':
      return {
        title: 'Reroll Daily Mission',
        subtitle: 'Watch a short sponsor spot to deal a fresh Daily Mission for today.',
      };
    case 'bonus_chest':
      return {
        title: 'Bonus Courtyard Chest',
        subtitle: 'Watch a short sponsor spot to unlock today’s extra Cowrie chest (+30 to +50).',
      };
    case 'interstitial':
    default:
      return {
        title: 'Courtyard Intermission',
        subtitle: 'Quick sponsor break between matches.',
      };
  }
}

/**
 * Google H5 Games Ads (Ad Placement API: adConfig / adBreak) adapter.
 * Dynamically loads adsbygoogle.js only when a valid VITE_ADSENSE_CLIENT_ID is present.
 */
export class GoogleH5AdsAdapter implements AdProviderAdapter {
  public readonly id: AdProviderId = 'google_h5';
  public readonly label = 'Google H5 Games Ads';

  private readonly clientId: string;
  private readonly testMode: boolean;
  private ready = false;
  private initPromise: Promise<boolean> | null = null;

  constructor(clientId: string, testMode = false) {
    this.clientId = clientId.trim();
    this.testMode = testMode;
  }

  public isReady(): boolean {
    return this.ready;
  }

  public init(): Promise<boolean> {
    if (this.initPromise) return this.initPromise;
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return Promise.resolve(false);
    }
    if (!ADSENSE_CLIENT_RE.test(this.clientId)) {
      return Promise.resolve(false);
    }

    this.initPromise = new Promise<boolean>((resolve) => {
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        if (!window.adBreak) {
          window.adBreak = (o: H5AdBreakConfig) => {
            window.adsbygoogle?.push(o as unknown as Record<string, unknown>);
          };
        }
        if (!window.adConfig) {
          window.adConfig = (o) => {
            window.adsbygoogle?.push(o as unknown as Record<string, unknown>);
          };
        }

        const existingScript = document.querySelector<HTMLScriptElement>(
          'script[data-sonko-h5-ads="1"], script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'
        );
        const configure = () => {
          let resolved = false;
          const timeoutId = window.setTimeout(() => {
            if (!resolved) {
              resolved = true;
              this.ready = typeof window.adBreak === 'function';
              resolve(this.ready);
            }
          }, 3500);

          try {
            window.adConfig?.({
              preloadAdBreaks: 'on',
              sound: sonkoAudio.isMuted() ? 'off' : 'on',
              onReady: () => {
                if (!resolved) {
                  resolved = true;
                  window.clearTimeout(timeoutId);
                  this.ready = true;
                  resolve(true);
                }
              },
            });
          } catch {
            if (!resolved) {
              resolved = true;
              window.clearTimeout(timeoutId);
              this.ready = false;
              resolve(false);
            }
          }
        };

        if (existingScript) {
          existingScript.dataset.sonkoH5Ads = '1';
          if (typeof window.adConfig === 'function') {
            configure();
          } else {
            existingScript.addEventListener('load', configure, { once: true });
            existingScript.addEventListener(
              'error',
              () => {
                this.ready = false;
                resolve(false);
              },
              { once: true }
            );
            window.setTimeout(configure, 1200);
          }
          return;
        }

        const script = document.createElement('script');
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
          this.clientId
        )}`;
        script.dataset.sonkoH5Ads = '1';
        if (this.testMode) {
          script.dataset.adbreakTest = 'on';
        }
        script.onload = configure;
        script.onerror = () => {
          this.ready = false;
          resolve(false);
        };
        document.head.appendChild(script);
      } catch {
        this.ready = false;
        resolve(false);
      }
    });

    return this.initPromise;
  }

  public async showRewarded(request: AdDisplayRequest): Promise<AdShowOutcome> {
    const initialized = await this.init();
    if (!initialized || typeof window.adBreak !== 'function') {
      return { status: 'unavailable', provider: this.id, detail: 'H5 Ads script unavailable.' };
    }

    return new Promise<AdShowOutcome>((resolve) => {
      let settled = false;
      let rewardedStatus: 'viewed' | 'dismissed' | null = null;
      let rewardShown = false;

      const finish = (outcome: AdShowOutcome) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(outcome);
      };

      const timer = window.setTimeout(() => {
        if (rewardShown) {
          request.onAfterAd?.();
        }
        finish({ status: 'no_fill', provider: this.id, detail: 'Rewarded ad timed out.' });
      }, 6500);

      try {
        window.adBreak?.({
          type: 'reward',
          name: request.breakName,
          beforeAd: () => {
            window.clearTimeout(timer);
            request.onBeforeAd?.();
          },
          beforeReward: (showAdFn) => {
            rewardShown = true;
            showAdFn();
          },
          adViewed: () => {
            rewardedStatus = 'viewed';
          },
          adDismissed: () => {
            rewardedStatus = 'dismissed';
          },
          afterAd: () => {
            request.onAfterAd?.();
          },
          adBreakDone: (info) => {
            if (rewardedStatus === 'viewed' || info?.breakStatus === 'viewed') {
              finish({ status: 'completed', provider: this.id });
              return;
            }
            if (rewardedStatus === 'dismissed' || info?.breakStatus === 'dismissed') {
              finish({ status: 'dismissed', provider: this.id });
              return;
            }
            finish({
              status: 'no_fill',
              provider: this.id,
              detail: info?.breakStatus ?? 'no_fill',
            });
          },
        });
      } catch {
        finish({ status: 'unavailable', provider: this.id });
      }
    });
  }

  public async showInterstitial(request: AdDisplayRequest): Promise<AdShowOutcome> {
    const initialized = await this.init();
    if (!initialized || typeof window.adBreak !== 'function') {
      return { status: 'unavailable', provider: this.id };
    }

    return new Promise<AdShowOutcome>((resolve) => {
      let settled = false;
      const finish = (outcome: AdShowOutcome) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(outcome);
      };

      const timer = window.setTimeout(() => {
        finish({ status: 'no_fill', provider: this.id });
      }, 4500);

      try {
        window.adBreak?.({
          type: 'next',
          name: request.breakName,
          beforeAd: () => {
            window.clearTimeout(timer);
            request.onBeforeAd?.();
          },
          afterAd: () => {
            request.onAfterAd?.();
          },
          adBreakDone: (info) => {
            const st = info?.breakStatus;
            if (st === 'viewed') {
              finish({ status: 'completed', provider: this.id });
            } else if (st === 'dismissed') {
              finish({ status: 'dismissed', provider: this.id });
            } else {
              finish({ status: 'no_fill', provider: this.id, detail: st });
            }
          },
        });
      } catch {
        finish({ status: 'unavailable', provider: this.id });
      }
    });
  }
}

/**
 * Interactive Development Simulator adapter.
 * Emits a timed preview session to AdSimulatorModal with full beforeAd/afterAd lifecycle hooks.
 */
export class DevAdSimulatorAdapter implements AdProviderAdapter {
  public readonly id: AdProviderId = 'dev_simulator';
  public readonly label = 'Development Ad Simulator';

  private activeSession: AdSimulatorSession | null = null;
  private listeners = new Set<(session: AdSimulatorSession | null) => void>();

  public async init(): Promise<boolean> {
    return true;
  }

  public isReady(): boolean {
    return true;
  }

  public subscribe(listener: (session: AdSimulatorSession | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.activeSession);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(session: AdSimulatorSession | null) {
    this.activeSession = session;
    for (const cb of this.listeners) {
      cb(session);
    }
  }

  public showRewarded(request: AdDisplayRequest): Promise<AdShowOutcome> {
    return this.runSimulatedAd(request, 3);
  }

  public showInterstitial(request: AdDisplayRequest): Promise<AdShowOutcome> {
    return this.runSimulatedAd(request, 2);
  }

  private runSimulatedAd(
    request: AdDisplayRequest,
    durationSec: number
  ): Promise<AdShowOutcome> {
    if (this.activeSession) {
      return Promise.resolve({
        status: 'unavailable',
        provider: this.id,
        detail: 'An ad is already playing.',
      });
    }

    return new Promise<AdShowOutcome>((resolve) => {
      const { title, subtitle } = getPlacementCopy(request.placement, request.rewardLabel);
      let settled = false;

      request.onBeforeAd?.();

      const finish = (status: 'completed' | 'dismissed') => {
        if (settled) return;
        settled = true;
        this.emit(null);
        request.onAfterAd?.();
        resolve({ status, provider: this.id });
      };

      const session: AdSimulatorSession = {
        id: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        placement: request.placement,
        format: request.format,
        title,
        subtitle,
        rewardLabel: request.rewardLabel,
        durationSec,
        startedAt: Date.now(),
        complete: () => finish('completed'),
        dismiss: () => finish('dismissed'),
      };

      this.emit(session);
    });
  }
}

export interface RewardedPlacementRequest {
  playerId: string;
  placement: Exclude<AdPlacement, 'interstitial'>;
  matchId?: string;
  baseCowries?: number;
  currentMissionId?: string;
  rewardLabel?: string;
}

export interface RewardedPlacementResult {
  ok: boolean;
  cancelled?: boolean;
  error?: string;
  receiptId?: string;
  cowriesGranted: number;
  nextMissionId?: string | null;
  providerUsed?: AdProviderId;
  status?: MonetizationStatus;
}

export const INTERSTITIAL_MATCH_INTERVAL = 2;
export const INTERSTITIAL_COOLDOWN_MS = 120_000;

export class AdService {
  private readonly h5Adapter: GoogleH5AdsAdapter | null;
  private readonly simAdapter: DevAdSimulatorAdapter;
  private activeAdapter: AdProviderAdapter;
  private inFlight = false;
  private savedAudioMuted = false;
  private savedVoiceMuted = false;
  private audioSuspended = false;

  constructor() {
    const clientId = String(import.meta.env.VITE_ADSENSE_CLIENT_ID ?? '').trim();
    const forceSimulator = String(import.meta.env.VITE_AD_SIMULATOR ?? '').toLowerCase() === 'true';
    const testMode = String(import.meta.env.VITE_ADSENSE_TEST_MODE ?? '').toLowerCase() === 'true';

    this.simAdapter = new DevAdSimulatorAdapter();
    this.h5Adapter =
      !forceSimulator && ADSENSE_CLIENT_RE.test(clientId)
        ? new GoogleH5AdsAdapter(clientId, testMode)
        : null;

    this.activeAdapter = this.h5Adapter ?? this.simAdapter;
  }

  public getProviderInfo(): { id: AdProviderId; label: string; isSimulator: boolean } {
    return {
      id: this.activeAdapter.id,
      label: this.activeAdapter.label,
      isSimulator: this.activeAdapter.id === 'dev_simulator',
    };
  }

  public setAdapter(adapter: AdProviderAdapter) {
    this.activeAdapter = adapter;
  }

  public subscribeSimulator(
    listener: (session: AdSimulatorSession | null) => void
  ): () => void {
    return this.simAdapter.subscribe(listener);
  }

  public preload(): void {
    void this.activeAdapter.init();
  }

  private suspendGameAudio = () => {
    if (this.audioSuspended) return;
    this.savedAudioMuted = sonkoAudio.isMuted();
    this.savedVoiceMuted = sonkoVoice.isMuted();
    this.audioSuspended = true;
    sonkoAudio.setMuted(true);
    sonkoVoice.setMuted(true);
  };

  private restoreGameAudio = () => {
    if (!this.audioSuspended) return;
    this.audioSuspended = false;
    sonkoAudio.setMuted(this.savedAudioMuted);
    sonkoVoice.setMuted(this.savedVoiceMuted);
  };

  public async fetchStatus(
    playerId: string,
    dateKey = getLocalDateKey()
  ): Promise<MonetizationStatus | null> {
    try {
      const res = await fetch(
        `/api/monetization/status?playerId=${encodeURIComponent(playerId)}&dateKey=${encodeURIComponent(dateKey)}`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
        }
      );
      if (!res.ok) return null;
      const body = (await res.json()) as { ok?: boolean } & Partial<MonetizationStatus>;
      if (!body?.ok) return null;
      return {
        dateKey: body.dateKey ?? dateKey,
        bonusChestClaimedToday: Boolean(body.bonusChestClaimedToday),
        missionRerollUsedToday: Boolean(body.missionRerollUsedToday),
        claimedMatchIds: Array.isArray(body.claimedMatchIds) ? body.claimedMatchIds : [],
        doubleClaimsToday: Number(body.doubleClaimsToday ?? 0),
        maxDoubleClaimsPerDay: Number(body.maxDoubleClaimsPerDay ?? 25),
      };
    } catch {
      return null;
    }
  }

  public async recordMatchResult(
    playerId: string,
    matchId: string,
    baseCowries: number,
    dateKey = getLocalDateKey()
  ): Promise<void> {
    if (baseCowries <= 0) return;
    try {
      await fetch('/api/monetization/match-result', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          playerId,
          matchId,
          baseCowries: Math.floor(baseCowries),
          dateKey,
        }),
      });
    } catch {
      // Non-blocking: ad-session still accepts bounded baseCowries if offline during match end
    }
  }

  private async showWithFallback(
    format: 'rewarded' | 'interstitial',
    req: AdDisplayRequest
  ): Promise<AdShowOutcome> {
    const primary = this.activeAdapter;
    const outcome =
      format === 'rewarded'
        ? await primary.showRewarded(req)
        : await primary.showInterstitial(req);

    // If H5 Ads has no fill / is blocked in development mode, seamlessly fall back to the simulator
    if (
      primary.id === 'google_h5' &&
      (outcome.status === 'no_fill' || outcome.status === 'unavailable') &&
      import.meta.env.DEV
    ) {
      return format === 'rewarded'
        ? this.simAdapter.showRewarded(req)
        : this.simAdapter.showInterstitial(req);
    }

    return outcome;
  }

  public async runRewardedPlacement(
    req: RewardedPlacementRequest
  ): Promise<RewardedPlacementResult> {
    if (this.inFlight) {
      return { ok: false, cowriesGranted: 0, error: 'An ad is already in progress.' };
    }
    this.inFlight = true;
    const dateKey = getLocalDateKey();

    try {
      // 1. Server-authorize ad session BEFORE displaying the ad
      const sessionRes = await fetch('/api/monetization/ad-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          playerId: req.playerId,
          placement: req.placement,
          dateKey,
          matchId: req.matchId,
          baseCowries: req.baseCowries,
          currentMissionId: req.currentMissionId,
        }),
      });

      const sessionBody = (await sessionRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        sessionId?: string;
        sessionToken?: string;
      };

      if (!sessionRes.ok || !sessionBody.sessionId || !sessionBody.sessionToken) {
        return {
          ok: false,
          cowriesGranted: 0,
          error: sessionBody.error ?? 'Unable to authorize reward session right now.',
        };
      }

      // 2. Display the rewarded ad with audio pause/restore hooks
      const adOutcome = await this.showWithFallback('rewarded', {
        placement: req.placement,
        format: 'rewarded',
        breakName: `sonko_${req.placement}`,
        rewardLabel: req.rewardLabel,
        onBeforeAd: this.suspendGameAudio,
        onAfterAd: this.restoreGameAudio,
      });

      if (adOutcome.status === 'dismissed') {
        return {
          ok: false,
          cancelled: true,
          cowriesGranted: 0,
          providerUsed: adOutcome.provider,
          error: 'Finish watching the ad to collect your reward.',
        };
      }

      if (adOutcome.status !== 'completed') {
        return {
          ok: false,
          cowriesGranted: 0,
          providerUsed: adOutcome.provider,
          error: 'No sponsored ad is available right now. Please try again shortly.',
        };
      }

      // 3. Redeem single-use server token
      const claimRes = await fetch('/api/monetization/claim-reward', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          playerId: req.playerId,
          sessionId: sessionBody.sessionId,
          sessionToken: sessionBody.sessionToken,
        }),
      });

      const claimBody = (await claimRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        receiptId?: string;
        cowriesGranted?: number;
        nextMissionId?: string | null;
        status?: MonetizationStatus;
      };

      if (!claimRes.ok || !claimBody.ok) {
        return {
          ok: false,
          cowriesGranted: 0,
          providerUsed: adOutcome.provider,
          error: claimBody.error ?? 'Could not verify ad reward with the server.',
        };
      }

      return {
        ok: true,
        receiptId: claimBody.receiptId,
        cowriesGranted: Number(claimBody.cowriesGranted ?? 0),
        nextMissionId: claimBody.nextMissionId ?? null,
        providerUsed: adOutcome.provider,
        status: claimBody.status,
      };
    } catch {
      return {
        ok: false,
        cowriesGranted: 0,
        error: 'Network connection is required to authorize and claim rewards.',
      };
    } finally {
      this.restoreGameAudio();
      this.inFlight = false;
    }
  }

  public shouldShowInterstitial(params: {
    mode: PlayMode;
    matchesCompletedSinceInterstitial: number;
    lastInterstitialAt: number;
    now?: number;
  }): boolean {
    if (params.mode === 'ONLINE_1V1') return false;
    if (params.matchesCompletedSinceInterstitial < INTERSTITIAL_MATCH_INTERVAL) return false;
    const now = params.now ?? Date.now();
    return now - params.lastInterstitialAt >= INTERSTITIAL_COOLDOWN_MS;
  }

  public async showInterstitialBreak(playerId: string): Promise<boolean> {
    if (this.inFlight) return false;
    this.inFlight = true;
    try {
      const outcome = await this.showWithFallback('interstitial', {
        placement: 'interstitial',
        format: 'interstitial',
        breakName: 'sonko_match_break',
        onBeforeAd: this.suspendGameAudio,
        onAfterAd: this.restoreGameAudio,
      });

      if (outcome.status === 'completed') {
        // Optional best-effort server counter increment; never blocks navigation
        void fetch('/api/monetization/ad-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId,
            placement: 'interstitial',
            dateKey: getLocalDateKey(),
          }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((sess: { sessionId?: string; sessionToken?: string } | null) => {
            if (!sess?.sessionId || !sess?.sessionToken) return;
            return fetch('/api/monetization/claim-reward', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                playerId,
                sessionId: sess.sessionId,
                sessionToken: sess.sessionToken,
              }),
            });
          })
          .catch(() => {});
        return true;
      }

      return outcome.status === 'dismissed';
    } finally {
      this.restoreGameAudio();
      this.inFlight = false;
    }
  }
}

export const adService = new AdService();
