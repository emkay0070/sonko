import { CharacterEmotion } from '../scene3d/glbAppearance';
import { ChildStyle } from '../scene3d/characters';
import { DialogueEventTag, dialogueRepo } from './dialogueLoader';
import { SpeechState } from './types';

export type { SpeechState };

export interface CharacterVoiceProfile {
  id: ChildStyle;
  label: string;
  pitch: number;
  rate: number;
  baseHz: number;
  formantBright: number;
  genderHint: 'male' | 'female';
  laughStyle: 'ha' | 'hehe' | 'hoho';
}

export const VOICE_PROFILES: Record<ChildStyle, CharacterVoiceProfile> = {
  kato: {
    id: 'kato',
    label: 'Kato',
    pitch: 1.12,
    rate: 1.07,
    baseHz: 192,
    formantBright: 1.08,
    genderHint: 'male',
    laughStyle: 'ha',
  },
  namukasa: {
    id: 'namukasa',
    label: 'Namukasa',
    pitch: 1.32,
    rate: 1.02,
    baseHz: 268,
    formantBright: 1.24,
    genderHint: 'female',
    laughStyle: 'ha',
  },
  auma: {
    id: 'auma',
    label: 'Auma',
    pitch: 1.54,
    rate: 1.16,
    baseHz: 332,
    formantBright: 1.38,
    genderHint: 'female',
    laughStyle: 'hehe',
  },
  ssemakula: {
    id: 'ssemakula',
    label: 'Ssemakula',
    pitch: 0.78,
    rate: 0.92,
    baseHz: 128,
    formantBright: 0.84,
    genderHint: 'male',
    laughStyle: 'hoho',
  },
};

export interface ActiveSpeechBubble {
  character: ChildStyle;
  text: string;
  emotion: CharacterEmotion;
  speechState: SpeechState;
  startedAt: number;
  durationMs: number;
  isTalking: boolean;
}

function eventToSpeechState(event: DialogueEventTag, emotion: CharacterEmotion): SpeechState {
  switch (event) {
    case 'AIM':
      return 'aiming';
    case 'THROW':
      return 'throwing';
    case 'BULLSEYE':
    case 'GOOD_TOSS':
    case 'HOUSE_CLAIM':
    case 'CHEER':
      return 'cheering';
    case 'LAUGH':
      return 'laughing';
    case 'ANNOYED':
      return 'annoyed';
    case 'WOBBLE':
      return 'wobbling';
    case 'WIN':
      return 'celebrating';
    case 'INTRO':
    case 'IDLE_BANTER':
    default:
      return emotion === 'laugh' ? 'laughing' : 'banter';
  }
}

const SPEECH_STATE_CONFIG: Record<
  Exclude<SpeechState, 'silent'>,
  { event: DialogueEventTag; emotion: CharacterEmotion }
> = {
  aiming: { event: 'AIM', emotion: 'focused' },
  throwing: { event: 'THROW', emotion: 'focused' },
  cheering: { event: 'CHEER', emotion: 'cheer' },
  laughing: { event: 'LAUGH', emotion: 'laugh' },
  annoyed: { event: 'ANNOYED', emotion: 'annoyed' },
  wobbling: { event: 'WOBBLE', emotion: 'surprised' },
  banter: { event: 'IDLE_BANTER', emotion: 'happy' },
  celebrating: { event: 'WIN', emotion: 'cheer' },
};

class SonkoVoiceEngine {
  private audioCtx: AudioContext | null = null;
  private muted = false;
  private voicesEnabled = true;
  private volume = 0.9;
  private subtitlesEnabled = true;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private activeUtterances = new Map<ChildStyle, ActiveSpeechBubble>();
  private activeAudioEl: HTMLAudioElement | null = null;
  private lastGlobalSpeakAt = 0;
  private lastCharacterSpeakAt = new Map<ChildStyle, number>();

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const load = () => {
        this.cachedVoices = window.speechSynthesis.getVoices();
      };
      load();
      window.speechSynthesis.addEventListener?.('voiceschanged', load);
    }
    dialogueRepo.preloadAll();
  }

  private ensureAudio(): AudioContext | null {
    if (this.muted || !this.voicesEnabled || this.volume <= 0.001) return null;
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.audioCtx = new Ctx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.stopSpeech();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setVoicesEnabled(enabled: boolean) {
    this.voicesEnabled = enabled;
    if (!enabled) {
      this.stopSpeech();
    }
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.activeAudioEl) {
      this.activeAudioEl.volume = this.volume;
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setSubtitlesEnabled(enabled: boolean) {
    this.subtitlesEnabled = enabled;
  }

  public areSubtitlesEnabled(): boolean {
    return this.subtitlesEnabled;
  }

  public stopSpeech() {
    if (this.activeAudioEl) {
      try {
        this.activeAudioEl.pause();
        this.activeAudioEl.src = '';
      } catch {
        // Ignore audio stop error
      }
      this.activeAudioEl = null;
    }
    this.activeUtterances.clear();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore browser speech cancel error
      }
    }
  }

  /**
   * Selects a distinct OS/browser SpeechSynthesisVoice per character so each sounds unique.
   */
  private pickVoiceFor(character: ChildStyle): SpeechSynthesisVoice | null {
    if (this.cachedVoices.length === 0 && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.cachedVoices = window.speechSynthesis.getVoices();
    }
    if (this.cachedVoices.length === 0) return null;

    const profile = VOICE_PROFILES[character];
    const enVoices = this.cachedVoices.filter((v) => v.lang.toLowerCase().startsWith('en'));
    const pool = enVoices.length > 0 ? enVoices : this.cachedVoices;

    const femaleMatch = /female|samantha|victoria|karen|moira|tessa|fiona|serena|zira|hazel|susan|jenny|aria|sonia|libby|google uk english female/i;
    const maleMatch = /male|daniel|alex|fred|tom|oliver|george|ryan|david|mark|guy|chris|google uk english male/i;

    const preferred = pool.filter((v) =>
      profile.genderHint === 'female' ? femaleMatch.test(v.name) : maleMatch.test(v.name)
    );
    const list = preferred.length > 0 ? preferred : pool;

    // Deterministic spread across available voices so Kato !== Ssemakula and Namukasa !== Auma
    const slotOffset: Record<ChildStyle, number> = {
      kato: 0,
      namukasa: 0,
      auma: 1,
      ssemakula: 1,
    };
    return list[slotOffset[character] % list.length] ?? list[0];
  }

  /**
   * Expressive Web Audio formant vocalization for laughs, annoyed groans, and cheers.
   * Works 100% offline even on browsers without SpeechSynthesis voices.
   */
  private playVocalExpression(character: ChildStyle, emotion: CharacterEmotion) {
    const ctx = this.ensureAudio();
    if (!ctx) return;
    const profile = VOICE_PROFILES[character];
    const now = ctx.currentTime;

    if (emotion === 'laugh') {
      const syllables = profile.laughStyle === 'hehe' ? 4 : 3;
      const step = profile.laughStyle === 'hehe' ? 0.115 : 0.145;
      for (let i = 0; i < syllables; i++) {
        const t0 = now + i * step;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        const f0 = profile.baseHz * (1.16 - i * 0.06);
        osc.frequency.setValueAtTime(f0, t0);
        osc.frequency.exponentialRampToValueAtTime(f0 * 0.84, t0 + step * 0.82);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(760 * profile.formantBright, t0);
        filter.Q.setValueAtTime(3.2, t0);

        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.linearRampToValueAtTime(0.065 * this.volume, t0 + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + step * 0.86);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + step * 0.9);
      }
      return;
    }

    if (emotion === 'annoyed') {
      // Short descending nasal "hmmph / ugh"
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(profile.baseHz * 0.98, now);
      osc.frequency.exponentialRampToValueAtTime(profile.baseHz * 0.72, now + 0.24);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(480 * profile.formantBright, now);
      filter.Q.setValueAtTime(4.0, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.06 * this.volume, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.27);
      return;
    }

    if (emotion === 'cheer' || emotion === 'happy') {
      // Bright upward "eyy!" formant chirp
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(profile.baseHz * 1.05, now);
      osc.frequency.exponentialRampToValueAtTime(profile.baseHz * 1.38, now + 0.16);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(920 * profile.formantBright, now);
      filter.Q.setValueAtTime(2.6, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.055 * this.volume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.21);
    }
  }

  private speakWithBrowserTTS(
    character: ChildStyle,
    text: string,
    emotion: CharacterEmotion,
    bubble: ActiveSpeechBubble,
    priority: 'high' | 'normal'
  ) {
    this.playVocalExpression(character, emotion);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (priority === 'high') {
          window.speechSynthesis.cancel();
        }
        const utter = new SpeechSynthesisUtterance(text);
        const profile = VOICE_PROFILES[character];
        const chosenVoice = this.pickVoiceFor(character);
        if (chosenVoice) utter.voice = chosenVoice;

        let pitch = profile.pitch;
        let rate = profile.rate;
        if (emotion === 'laugh' || emotion === 'cheer') {
          pitch = Math.min(2, pitch * 1.08);
          rate = Math.min(1.5, rate * 1.06);
        } else if (emotion === 'annoyed') {
          pitch = Math.max(0.55, pitch * 0.92);
          rate = Math.max(0.75, rate * 0.95);
        }
        utter.pitch = pitch;
        utter.rate = rate;
        utter.volume = this.volume;

        utter.onend = () => {
          const current = this.activeUtterances.get(character);
          if (current === bubble) {
            current.isTalking = false;
          }
        };
        utter.onerror = () => {
          const current = this.activeUtterances.get(character);
          if (current === bubble) {
            current.isTalking = false;
          }
        };

        window.speechSynthesis.speak(utter);
      } catch {
        // Safe fallback if browser blocks synthesis before user gesture
      }
    }
  }

  public triggerSpeechState(
    character: ChildStyle,
    state: SpeechState,
    options?: { priority?: 'high' | 'normal'; customText?: string }
  ): string | null {
    if (state === 'silent') {
      this.activeUtterances.delete(character);
      return null;
    }
    const cfg = SPEECH_STATE_CONFIG[state];
    return this.speakEvent(character, cfg.event, cfg.emotion, {
      ...options,
      speechState: state,
    });
  }

  public speakEvent(
    character: ChildStyle,
    event: DialogueEventTag,
    emotion: CharacterEmotion,
    options?: { priority?: 'high' | 'normal'; customText?: string; speechState?: SpeechState }
  ): string | null {
    const now = performance.now();
    const priority = options?.priority ?? 'normal';
    const lastChar = this.lastCharacterSpeakAt.get(character) ?? 0;

    if (priority === 'normal') {
      if (now - this.lastGlobalSpeakAt < 1800) return null;
      if (now - lastChar < 3200) return null;
    } else if (now - this.lastGlobalSpeakAt < 450) {
      return null;
    }

    const picked = options?.customText
      ? { text: options.customText, audioUrl: undefined }
      : dialogueRepo.pickEntry(character, event);
    if (!picked?.text) return null;
    const { text, audioUrl } = picked;

    this.lastGlobalSpeakAt = now;
    this.lastCharacterSpeakAt.set(character, now);

    const estDuration = Math.max(1700, Math.min(4400, text.length * 58 + 700));
    const resolvedState = options?.speechState ?? eventToSpeechState(event, emotion);
    const bubble: ActiveSpeechBubble = {
      character,
      text,
      emotion,
      speechState: resolvedState,
      startedAt: now,
      durationMs: estDuration,
      isTalking: true,
    };
    this.activeUtterances.set(character, bubble);

    if (!this.muted && this.voicesEnabled && this.volume > 0.001) {
      if (audioUrl && typeof Audio !== 'undefined') {
        if (priority === 'high') {
          this.stopSpeech();
          this.activeUtterances.set(character, bubble);
        }
        const audio = new Audio(audioUrl);
        audio.volume = this.volume;
        this.activeAudioEl = audio;
        let fellBack = false;
        const fallbackToTTS = () => {
          if (fellBack || this.muted || !this.voicesEnabled) return;
          fellBack = true;
          if (this.activeAudioEl === audio) this.activeAudioEl = null;
          this.speakWithBrowserTTS(character, text, emotion, bubble, priority);
        };
        audio.addEventListener('loadedmetadata', () => {
          if (Number.isFinite(audio.duration) && audio.duration > 0.2) {
            bubble.durationMs = Math.max(1200, audio.duration * 1000 + 350);
          }
        });
        audio.addEventListener('ended', () => {
          if (this.activeAudioEl === audio) this.activeAudioEl = null;
          const current = this.activeUtterances.get(character);
          if (current === bubble) current.isTalking = false;
        });
        audio.addEventListener('error', fallbackToTTS);
        void audio.play().catch(fallbackToTTS);
      } else {
        this.speakWithBrowserTTS(character, text, emotion, bubble, priority);
      }
    }

    return text;
  }

  public getActiveSpeech(character: ChildStyle, now = performance.now()): ActiveSpeechBubble | null {
    const b = this.activeUtterances.get(character);
    if (!b) return null;
    const elapsed = now - b.startedAt;
    if (elapsed > b.durationMs) {
      this.activeUtterances.delete(character);
      return null;
    }
    return b;
  }

  public getSpeechState(character: ChildStyle, now = performance.now()): SpeechState {
    return this.getActiveSpeech(character, now)?.speechState ?? 'silent';
  }

  public getAllSpeechStates(now = performance.now()): Record<ChildStyle, SpeechState> {
    return {
      kato: this.getSpeechState('kato', now),
      namukasa: this.getSpeechState('namukasa', now),
      auma: this.getSpeechState('auma', now),
      ssemakula: this.getSpeechState('ssemakula', now),
    };
  }

  public getLipSyncIntensity(character: ChildStyle, now = performance.now()): number {
    const b = this.getActiveSpeech(character, now);
    if (!b) return 0;
    const elapsed = now - b.startedAt;
    // If browser speechSynthesis ended early, gently finish mouth motion after 1.3s minimum
    const talkCap = b.isTalking ? b.durationMs * 0.86 : Math.min(1400, b.durationMs * 0.65);
    if (elapsed >= talkCap) return 0;
    const fadeIn = Math.min(1, elapsed / 120);
    const fadeOut = Math.min(1, (talkCap - elapsed) / 180);
    return fadeIn * fadeOut;
  }
}

export const sonkoVoice = new SonkoVoiceEngine();
