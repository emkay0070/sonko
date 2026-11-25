export type GraphicsQuality = 'low' | 'medium' | 'high';
export type DefaultMatchCamera = 'play' | 'aim_target' | 'top_aim';
export type PeriodPreset = 'auto' | 'morning' | 'midday' | 'golden' | 'night';

export type AdPersonalizationConsent = 'unset' | 'personalized' | 'non_personalized';

export interface SonkoSettings {
  sfxVolume: number;
  voiceVolume: number;
  subtitlesEnabled: boolean;
  graphicsQuality: GraphicsQuality;
  shadowsEnabled: boolean;
  dustEnabled: boolean;
  pixelRatioScale: number;
  defaultCamera: DefaultMatchCamera;
  cameraShake: boolean;
  dynamicWeather: boolean;
  adPersonalizationConsent: AdPersonalizationConsent;
}

const SETTINGS_STORAGE_KEY = 'sonko_settings_v1';

export const QUALITY_PRESET_VALUES: Record<
  GraphicsQuality,
  { shadowsEnabled: boolean; dustEnabled: boolean; pixelRatioScale: number }
> = {
  low: { shadowsEnabled: false, dustEnabled: false, pixelRatioScale: 1 },
  medium: { shadowsEnabled: true, dustEnabled: true, pixelRatioScale: 1.25 },
  high: { shadowsEnabled: true, dustEnabled: true, pixelRatioScale: 1.5 },
};

export const DEFAULT_SETTINGS: SonkoSettings = {
  sfxVolume: 0.85,
  voiceVolume: 0.9,
  subtitlesEnabled: true,
  graphicsQuality: 'medium',
  shadowsEnabled: true,
  dustEnabled: true,
  pixelRatioScale: 1.25,
  defaultCamera: 'play',
  cameraShake: true,
  dynamicWeather: true,
  adPersonalizationConsent: 'unset',
};

function clamp01(val: unknown, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(0, Math.min(1, val));
}

export function loadSettings(): SonkoSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<SonkoSettings>;
    const graphicsQuality: GraphicsQuality =
      parsed.graphicsQuality === 'low' ||
      parsed.graphicsQuality === 'medium' ||
      parsed.graphicsQuality === 'high'
        ? parsed.graphicsQuality
        : DEFAULT_SETTINGS.graphicsQuality;
    const defaultCamera: DefaultMatchCamera =
      parsed.defaultCamera === 'play' ||
      parsed.defaultCamera === 'aim_target' ||
      parsed.defaultCamera === 'top_aim'
        ? parsed.defaultCamera
        : DEFAULT_SETTINGS.defaultCamera;
    const pixelRatioScale =
      typeof parsed.pixelRatioScale === 'number' &&
      [0.75, 1, 1.25, 1.5, 2].includes(parsed.pixelRatioScale)
        ? parsed.pixelRatioScale
        : DEFAULT_SETTINGS.pixelRatioScale;

    const adPersonalizationConsent: AdPersonalizationConsent =
      parsed.adPersonalizationConsent === 'personalized' ||
      parsed.adPersonalizationConsent === 'non_personalized'
        ? parsed.adPersonalizationConsent
        : DEFAULT_SETTINGS.adPersonalizationConsent;

    return {
      sfxVolume: clamp01(parsed.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
      voiceVolume: clamp01(parsed.voiceVolume, DEFAULT_SETTINGS.voiceVolume),
      subtitlesEnabled:
        typeof parsed.subtitlesEnabled === 'boolean'
          ? parsed.subtitlesEnabled
          : DEFAULT_SETTINGS.subtitlesEnabled,
      graphicsQuality,
      shadowsEnabled:
        typeof parsed.shadowsEnabled === 'boolean'
          ? parsed.shadowsEnabled
          : DEFAULT_SETTINGS.shadowsEnabled,
      dustEnabled:
        typeof parsed.dustEnabled === 'boolean'
          ? parsed.dustEnabled
          : DEFAULT_SETTINGS.dustEnabled,
      pixelRatioScale,
      defaultCamera,
      cameraShake:
        typeof parsed.cameraShake === 'boolean'
          ? parsed.cameraShake
          : DEFAULT_SETTINGS.cameraShake,
      dynamicWeather:
        typeof parsed.dynamicWeather === 'boolean'
          ? parsed.dynamicWeather
          : DEFAULT_SETTINGS.dynamicWeather,
      adPersonalizationConsent,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: SonkoSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}
