import type { PeriodPreset } from './settings';
import type { CourtSize, CourtVenueId, WeatherCondition, WeatherMode } from './types';

export interface WeatherSpec {
  id: WeatherCondition;
  label: string;
  shortLabel: string;
  description: string;
  rainIntensity: number; // 0..1 (slanted rain streaks & splash rings)
  wetness: number; // 0..1 (wet court specular sheen & soil darkening)
  windStrength: number; // 0..1 (crosswind stone drift, sway & slanted rain)
  mistIntensity: number; // 0..1 (low courtyard haze & fog density boost)
  puddleCount: number; // 0..4 puddles on the court
  skyDimming: number; // 0..1 (overcast sky & sun dimming)
}

export const WEATHER_SPECS: Record<WeatherCondition, WeatherSpec> = {
  clear: {
    id: 'clear',
    label: 'Clear Sky',
    shortLabel: 'Clear',
    description: 'Dry red murram soil, crisp chalk lines, and true bounce.',
    rainIntensity: 0,
    wetness: 0,
    windStrength: 0.08,
    mistIntensity: 0,
    puddleCount: 0,
    skyDimming: 0,
  },
  breezy: {
    id: 'breezy',
    label: 'Gusty Breeze',
    shortLabel: 'Breezy',
    description: 'Swirling courtyard gusts sway the palms and nudge airborne throws.',
    rainIntensity: 0,
    wetness: 0.05,
    windStrength: 0.85,
    mistIntensity: 0.08,
    puddleCount: 0,
    skyDimming: 0.08,
  },
  misty_dew: {
    id: 'misty_dew',
    label: 'Morning Dew & Mist',
    shortLabel: 'Dew Mist',
    description: 'Cool courtyard mist settles over damp soil with light dew puddles.',
    rainIntensity: 0,
    wetness: 0.42,
    windStrength: 0.22,
    mistIntensity: 0.72,
    puddleCount: 2,
    skyDimming: 0.2,
  },
  light_rain: {
    id: 'light_rain',
    label: 'Tropical Drizzle',
    shortLabel: 'Light Rain',
    description: 'Warm Ugandan shower leaves shimmering puddles and dampened chalk.',
    rainIntensity: 0.55,
    wetness: 0.76,
    windStrength: 0.46,
    mistIntensity: 0.45,
    puddleCount: 3,
    skyDimming: 0.48,
  },
  storm_shower: {
    id: 'storm_shower',
    label: 'Rainstorm',
    shortLabel: 'Storm',
    description: 'Heavy slanted rain, slick reflective mud puddles, and blustery gusts.',
    rainIntensity: 1.0,
    wetness: 1.0,
    windStrength: 0.95,
    mistIntensity: 0.8,
    puddleCount: 4,
    skyDimming: 0.82,
  },
};

export const WEATHER_MODE_OPTIONS: Array<{
  id: WeatherMode;
  label: string;
  hint: string;
}> = [
  { id: 'auto', label: 'Auto (Period)', hint: 'Follows time of day & place' },
  { id: 'random', label: 'Random Match', hint: 'Fresh conditions every match' },
  { id: 'clear', label: 'Clear', hint: 'Dry court' },
  { id: 'breezy', label: 'Breezy', hint: 'Crosswind gusts' },
  { id: 'misty_dew', label: 'Dew Mist', hint: 'Damp & misty' },
  { id: 'light_rain', label: 'Light Rain', hint: 'Drizzle & puddles' },
  { id: 'storm_shower', label: 'Storm', hint: 'Heavy rain & wind' },
];

export function resolveWeatherFromPeriodAndVenue(
  period: PeriodPreset,
  venue: CourtVenueId
): WeatherCondition {
  if (period === 'auto') {
    switch (venue) {
      case 'jinja_rain':
        return 'storm_shower';
      case 'entebbe_sand':
        return 'breezy';
      case 'ndere_night':
        return 'misty_dew';
      case 'kampala_murram':
      default:
        return 'clear';
    }
  }

  if (period === 'morning') {
    return venue === 'jinja_rain' ? 'light_rain' : 'misty_dew';
  }
  if (period === 'midday') {
    if (venue === 'jinja_rain') return 'storm_shower';
    if (venue === 'entebbe_sand') return 'breezy';
    return 'clear';
  }
  if (period === 'golden') {
    return venue === 'jinja_rain' ? 'light_rain' : 'breezy';
  }
  // night
  return venue === 'jinja_rain' ? 'storm_shower' : 'misty_dew';
}

export function rollRandomMatchWeather(
  period: PeriodPreset,
  venue: CourtVenueId,
  rng: () => number = Math.random
): WeatherCondition {
  const weights: Record<WeatherCondition, number> = {
    clear: 26,
    breezy: 24,
    misty_dew: 18,
    light_rain: 20,
    storm_shower: 12,
  };

  if (period === 'morning') {
    weights.misty_dew += 22;
    weights.light_rain += 8;
  } else if (period === 'midday') {
    weights.clear += 22;
    weights.breezy += 10;
  } else if (period === 'golden') {
    weights.breezy += 20;
    weights.clear += 10;
  } else if (period === 'night') {
    weights.misty_dew += 18;
    weights.storm_shower += 10;
    weights.clear -= 10;
  }

  if (venue === 'jinja_rain') {
    weights.light_rain += 28;
    weights.storm_shower += 28;
    weights.clear = Math.max(4, weights.clear - 18);
  } else if (venue === 'entebbe_sand') {
    weights.breezy += 26;
  } else if (venue === 'ndere_night') {
    weights.misty_dew += 16;
  }

  const entries = (Object.entries(weights) as Array<[WeatherCondition, number]>).map(
    ([cond, w]) => [cond, Math.max(1, w)] as const
  );
  const total = entries.reduce((acc, [, w]) => acc + w, 0);
  let pick = rng() * total;
  for (const [cond, w] of entries) {
    pick -= w;
    if (pick <= 0) return cond;
  }
  return 'clear';
}

export function pickWeatherPuddleSquares(
  courtSize: CourtSize,
  count: number,
  seed?: number
): number[] {
  if (count <= 0) return [];
  const candidates =
    courtSize === 10 ? [2, 5, 8, 3, 6, 9, 4, 7] : [2, 4, 3];
  const clamped = Math.min(count, candidates.length);

  if (seed === undefined) {
    // Shuffle copy so random weather matches distribute puddles organically across squares
    const pool = [...candidates];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, clamped).sort((a, b) => a - b);
  }

  const offset = Math.abs(Math.floor(seed)) % candidates.length;
  const picked: number[] = [];
  for (let i = 0; i < clamped; i++) {
    picked.push(candidates[(offset + i) % candidates.length]);
  }
  return picked.sort((a, b) => a - b);
}
