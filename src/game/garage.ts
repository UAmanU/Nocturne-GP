import {
  DEFAULT_CAR_APPEARANCE,
  type CarAppearance,
  type CarBodyStyle,
  type GameMode,
  type GraphicsQuality,
  type LiveryStyle,
  type MapId,
  type PursuitMapId,
  type RaceMapId,
  type RimFinish,
  type SpoilerStyle,
  type WeatherMode,
} from './types';
import { normalizeGraphicsQuality } from './graphics';

const CAR_STORAGE_KEY = 'nocturne_gp_car_v1';
const SETTINGS_STORAGE_KEY = 'nocturne_gp_settings_v1';

const VALID_BODY_STYLES = new Set<CarBodyStyle>([
  'lamborghini',
  'ferrari',
  'bmw',
  'porsche',
  'nissan',
  'muscle',
]);
const VALID_SPOILERS = new Set<SpoilerStyle>(['gt-wing', 'ducktail', 'none']);
const VALID_RIMS = new Set<RimFinish>(['silver', 'gold', 'obsidian']);
const VALID_LIVERIES = new Set<LiveryStyle>(['stripe', 'twin', 'clean']);

export const RACE_MAP_IDS: readonly RaceMapId[] = [
  'night-city',
  'beach',
  'day-city',
  'ice-arena',
  'construction',
];

export const PURSUIT_MAP_IDS: readonly PursuitMapId[] = [
  'pursuit-highway',
  'pursuit-docks',
  'pursuit-industrial',
];

const VALID_MAPS = new Set<MapId>([...RACE_MAP_IDS, ...PURSUIT_MAP_IDS]);
const VALID_WEATHERS = new Set<WeatherMode>(['clear', 'rain', 'snow']);

export const ALLOWED_WEATHER_BY_MAP: Record<MapId, readonly WeatherMode[]> = {
  'ice-arena': ['clear', 'snow'],
  beach: ['clear'],
  'night-city': ['clear', 'rain', 'snow'],
  'day-city': ['clear', 'snow'],
  construction: ['clear'],
  'pursuit-highway': ['clear', 'rain', 'snow'],
  'pursuit-docks': ['clear', 'rain', 'snow'],
  'pursuit-industrial': ['clear', 'rain', 'snow'],
};

export function isPursuitMap(mapId: MapId): mapId is PursuitMapId {
  return (PURSUIT_MAP_IDS as readonly string[]).includes(mapId);
}

export function pickRandomMap(
  rng: () => number = Math.random,
  excludeMapId?: MapId,
  mode: GameMode = 'race'
): MapId {
  const sourcePool: readonly MapId[] =
    mode === 'pursuit' ? PURSUIT_MAP_IDS : RACE_MAP_IDS;
  const pool =
    excludeMapId && sourcePool.length > 1
      ? sourcePool.filter((id) => id !== excludeMapId)
      : sourcePool;
  const idx = Math.min(pool.length - 1, Math.max(0, Math.floor(rng() * pool.length)));
  return pool[idx];
}

export function resolveWeatherForMap(
  mapId: MapId,
  candidate?: WeatherMode | string | null
): WeatherMode {
  const allowed = ALLOWED_WEATHER_BY_MAP[mapId] ?? ALLOWED_WEATHER_BY_MAP['night-city'];
  if (candidate && VALID_WEATHERS.has(candidate as WeatherMode)) {
    const mode = candidate as WeatherMode;
    if (allowed.includes(mode)) return mode;
  }
  return allowed[0];
}

export function pickWeatherForMap(
  mapId: MapId,
  rng: () => number = Math.random
): WeatherMode {
  const allowed = ALLOWED_WEATHER_BY_MAP[mapId] ?? ALLOWED_WEATHER_BY_MAP['night-city'];
  const idx = Math.min(allowed.length - 1, Math.max(0, Math.floor(rng() * allowed.length)));
  return allowed[idx];
}

export interface GameSettings {
  mode: GameMode;
  mapId: MapId;
  weather: WeatherMode;
  graphicsQuality: GraphicsQuality;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  mode: 'race',
  mapId: 'night-city',
  weather: 'clear',
  graphicsQuality: 'medium',
};

function mapBodyStyle(rawStyle: string | undefined): CarBodyStyle {
  if (!rawStyle) return DEFAULT_CAR_APPEARANCE.bodyStyle;
  if (rawStyle === 'gt') return 'bmw';
  if (rawStyle === 'hyper') return 'lamborghini';
  if (VALID_BODY_STYLES.has(rawStyle as CarBodyStyle)) {
    return rawStyle as CarBodyStyle;
  }
  return DEFAULT_CAR_APPEARANCE.bodyStyle;
}

export function normalizeCarAppearance(
  raw: (Partial<Omit<CarAppearance, 'bodyStyle'>> & { bodyStyle?: string }) | null | undefined
): CarAppearance {
  if (!raw) return { ...DEFAULT_CAR_APPEARANCE };
  return {
    bodyStyle: mapBodyStyle(raw.bodyStyle),
    primaryColor:
      typeof raw.primaryColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.primaryColor)
        ? raw.primaryColor
        : DEFAULT_CAR_APPEARANCE.primaryColor,
    accentColor:
      typeof raw.accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.accentColor)
        ? raw.accentColor
        : DEFAULT_CAR_APPEARANCE.accentColor,
    spoilerStyle:
      raw.spoilerStyle && VALID_SPOILERS.has(raw.spoilerStyle)
        ? raw.spoilerStyle
        : DEFAULT_CAR_APPEARANCE.spoilerStyle,
    rimFinish:
      raw.rimFinish && VALID_RIMS.has(raw.rimFinish)
        ? raw.rimFinish
        : DEFAULT_CAR_APPEARANCE.rimFinish,
    livery:
      raw.livery && VALID_LIVERIES.has(raw.livery)
        ? raw.livery
        : DEFAULT_CAR_APPEARANCE.livery,
  };
}

export function loadCarAppearance(): CarAppearance {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_CAR_APPEARANCE };
  }
  try {
    const raw = window.localStorage.getItem(CAR_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CAR_APPEARANCE };
    return normalizeCarAppearance(JSON.parse(raw) as Partial<CarAppearance>);
  } catch {
    return { ...DEFAULT_CAR_APPEARANCE };
  }
}

export function saveCarAppearance(appearance: CarAppearance): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(CAR_STORAGE_KEY, JSON.stringify(appearance));
  } catch {
    // Ignore storage quota issues
  }
}

export function normalizeGameSettings(
  raw: Partial<GameSettings> | null | undefined
): GameSettings {
  if (!raw) return { ...DEFAULT_GAME_SETTINGS };
  const rawMode: GameMode = raw.mode === 'pursuit' ? 'pursuit' : 'race';
  let mapId: MapId =
    raw.mapId && VALID_MAPS.has(raw.mapId)
      ? raw.mapId
      : rawMode === 'pursuit'
        ? PURSUIT_MAP_IDS[0]
        : DEFAULT_GAME_SETTINGS.mapId;

  const mode: GameMode =
    raw.mode === undefined && isPursuitMap(mapId) ? 'pursuit' : rawMode;

  if (mode === 'pursuit' && !isPursuitMap(mapId)) {
    mapId = PURSUIT_MAP_IDS[0];
  } else if (mode === 'race' && isPursuitMap(mapId)) {
    mapId = RACE_MAP_IDS[0];
  }

  return {
    mode,
    mapId,
    weather: resolveWeatherForMap(mapId, raw.weather),
    graphicsQuality: normalizeGraphicsQuality(raw.graphicsQuality),
  };
}

export function loadGameSettings(): GameSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_GAME_SETTINGS };
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GAME_SETTINGS };
    return normalizeGameSettings(JSON.parse(raw) as Partial<GameSettings>);
  } catch {
    return { ...DEFAULT_GAME_SETTINGS };
  }
}

export function saveGameSettings(settings: GameSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota issues
  }
}
