export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

import type { GraphicsQuality, GraphicsQualityOption } from './graphics';

export { GRAPHICS_QUALITY_OPTIONS } from './graphics';
export type { GraphicsQuality, GraphicsQualityOption };

export type GameMode = 'race' | 'pursuit';

export type RaceMapId =
  | 'night-city'
  | 'beach'
  | 'day-city'
  | 'ice-arena'
  | 'construction';

export type PursuitMapId =
  | 'pursuit-highway'
  | 'pursuit-docks'
  | 'pursuit-industrial';

export type MapId = RaceMapId | PursuitMapId;
export type WeatherMode = 'clear' | 'rain' | 'snow';

export interface MapOption {
  id: MapId;
  mode: GameMode;
  name: string;
  subtitle: string;
}

export const RACE_MAP_OPTIONS: MapOption[] = [
  { id: 'night-city', mode: 'race', name: 'Midnight City', subtitle: 'Neon Circuit' },
  { id: 'beach', mode: 'race', name: 'Coral Beach', subtitle: 'Waterpark & Resort' },
  { id: 'day-city', mode: 'race', name: 'Daylight Metro', subtitle: 'Sunlit Downtown' },
  { id: 'ice-arena', mode: 'race', name: 'Ice Peaks', subtitle: 'Frozen Arena' },
  { id: 'construction', mode: 'race', name: 'Skyscraper Build', subtitle: 'Construction Site' },
];

export const PURSUIT_MAP_OPTIONS: MapOption[] = [
  {
    id: 'pursuit-highway',
    mode: 'pursuit',
    name: 'Midnight Freeway',
    subtitle: 'Cargo Escape · Multi-Route Highway',
  },
  {
    id: 'pursuit-docks',
    mode: 'pursuit',
    name: 'Harbor Docks Run',
    subtitle: 'Night Port · Smuggler Shortcuts',
  },
  {
    id: 'pursuit-industrial',
    mode: 'pursuit',
    name: 'Refinery Alley',
    subtitle: 'Industrial Sector · High-Risk Bypass',
  },
];

export const MAP_OPTIONS: MapOption[] = [
  ...RACE_MAP_OPTIONS,
  ...PURSUIT_MAP_OPTIONS,
];

export const WEATHER_OPTIONS: Array<{ id: WeatherMode; name: string }> = [
  { id: 'clear', name: 'Clear' },
  { id: 'rain', name: 'Rain' },
  { id: 'snow', name: 'Snow' },
];

export type ControlAction =
  | 'accelerate'
  | 'brake'
  | 'left'
  | 'right'
  | 'drift'
  | 'nitro'
  | 'pause'
  | 'resetCar';

export type KeyBindings = Record<ControlAction, string>;

export interface ControlActionMeta {
  action: ControlAction;
  label: string;
  description: string;
}

export type CarBodyStyle =
  | 'lamborghini'
  | 'ferrari'
  | 'bmw'
  | 'porsche'
  | 'nissan'
  | 'muscle';

export type SpoilerStyle = 'gt-wing' | 'ducktail' | 'none';
export type RimFinish = 'silver' | 'gold' | 'obsidian';
export type LiveryStyle = 'stripe' | 'twin' | 'clean';

export interface CarAppearance {
  bodyStyle: CarBodyStyle;
  primaryColor: string;
  accentColor: string;
  spoilerStyle: SpoilerStyle;
  rimFinish: RimFinish;
  livery: LiveryStyle;
}

export interface CarModelOption {
  id: CarBodyStyle;
  name: string;
  subtitle: string;
}

export const CAR_MODELS: CarModelOption[] = [
  { id: 'lamborghini', name: 'Lamborghini SVJ', subtitle: 'V12 Razor Wedge' },
  { id: 'ferrari', name: 'Ferrari SF90', subtitle: 'Sculpted Twin-Turbo' },
  { id: 'bmw', name: 'BMW M4 GT3', subtitle: 'Twin-Kidney Coupe' },
  { id: 'porsche', name: 'Porsche 911 GT3', subtitle: 'Rear-Engine Track' },
  { id: 'nissan', name: 'Nissan GT-R R35', subtitle: 'AWD Street Legend' },
  { id: 'muscle', name: 'Dodge SRT Hellcat', subtitle: 'Widebody V8 Muscle' },
];

export const CAR_PAINT_OPTIONS: Array<{ name: string; hex: string }> = [
  { name: 'Pearl White', hex: '#f8fafc' },
  { name: 'Inferno Orange', hex: '#f97316' },
  { name: 'Rosso Corsa', hex: '#dc2626' },
  { name: 'Electric Cobalt', hex: '#2563eb' },
  { name: 'Emerald Verde', hex: '#059669' },
  { name: 'Violet Pulse', hex: '#7c3aed' },
  { name: 'Obsidian Slate', hex: '#1e293b' },
];

export const CAR_ACCENT_OPTIONS: Array<{ name: string; hex: string }> = [
  { name: 'Solar Orange', hex: '#f97316' },
  { name: 'Giallo Gold', hex: '#facc15' },
  { name: 'Neon Cyan', hex: '#38bdf8' },
  { name: 'Racing Red', hex: '#ef4444' },
  { name: 'Acid Lime', hex: '#a3e635' },
  { name: 'Arctic White', hex: '#f1f5f9' },
];

export const DEFAULT_CAR_APPEARANCE: CarAppearance = {
  bodyStyle: 'lamborghini',
  primaryColor: '#f8fafc',
  accentColor: '#f97316',
  spoilerStyle: 'gt-wing',
  rimFinish: 'silver',
  livery: 'stripe',
};

export interface CarSpec {
  id: string;
  name: string;
  isPlayer: boolean;
  bodyStyle: CarBodyStyle;
  primaryColor: string;
  accentColor: string;
  spoilerStyle: SpoilerStyle;
  rimFinish: RimFinish;
  livery: LiveryStyle;
  number: string;
  aiSkill: number;
  preferredLane: number; // -1..1 normalized track lateral offset
}

export interface BoostPadState {
  id: number;
  x: number;
  z: number;
  yaw: number;
  trackT: number;
  laneOffset: number;
}

export interface SandPatchState {
  id: number;
  x: number;
  z: number;
  yaw: number;
  radiusX: number;
  radiusZ: number;
  trackT: number;
  laneOffset: number;
}

export interface ConstructionHazardVehicle {
  id: number;
  kind: 'bulldozer' | 'excavator';
  x: number;
  z: number;
  yaw: number;
  speed: number;
  trackT: number;
  baseT: number;
  laneOffset: number;
  patrolDir: 1 | -1;
  dirCooldown: number;
  armPhase: number;
}

export interface WreckingBallState {
  pivotX: number;
  pivotZ: number;
  boomLength: number;
  boomYaw: number;
  swingPhase: number;
  ballX: number;
  ballY: number;
  ballZ: number;
  ballRadius: number;
}

export interface PursuitObstacle {
  id: number;
  kind: 'cone' | 'barrier';
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  radius: number;
  damage: number;
  trackT: number;
  branchId: number | null;
  knocked: boolean;
  vx: number;
  vy: number;
  vz: number;
  spinVel: number;
}

export type RacerRole = 'racer' | 'police-chaser' | 'police-roadblock';

export interface RacerState {
  id: string;
  name: string;
  isPlayer: boolean;
  role: RacerRole;
  primaryColor: string;
  accentColor: string;
  number: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  speed: number; // signed forward speed (m/s)
  lateralSpeed: number;
  steerAngle: number;
  wheelSpin: number;
  pitch: number;
  roll: number;
  nitro: number; // 0..100
  isNitroActive: boolean;
  padBoostTimer: number;
  padCooldown: number;
  isBraking: boolean;
  isDrifting: boolean;
  isOnSand: boolean;
  // Durability / Pursuit HP
  hp: number;
  maxHp: number;
  wrecked: boolean;
  wallHitCooldown: number;
  ramCooldown: number;
  justTookDamage: number;
  // Track progress
  trackT: number; // [0, 1]
  nearestSampleIndex: number;
  activeBranchId: number | null;
  lap: number; // 1..3 (4 when finished)
  highestSector: number; // 0..3 checkpoint validation
  totalProgress: number; // continuous lap + trackT for live ranking
  finished: boolean;
  finishTime: number | null;
  currentLapStartTime: number;
  bestLapTime: number | null;
  lastLapTime: number | null;
  // AI fields
  aiSkill: number;
  preferredLane: number;
  aiLaneOffset: number;
  aiNitroCooldown: number;
  // Visual/Audio event flags cleared per tick
  justActivatedNitro: boolean;
  justHitBoostPad: boolean;
  justCollidedStrength: number;
  justFellInWater: boolean;
  waterSplashX: number;
  waterSplashZ: number;
  justWrecked: boolean;
  wreckX: number;
  wreckZ: number;
  wreckReason: 'ball' | 'machinery' | null;
  wreckGraceTimer: number;
}

export interface RacerStanding {
  id: string;
  name: string;
  isPlayer: boolean;
  primaryColor: string;
  accentColor: string;
  number: string;
  position: number;
  lap: number;
  finished: boolean;
  finishTime: number | null;
  bestLapTime: number | null;
  totalProgress: number;
}

export interface IntroSpotlight {
  racerId: string;
  name: string;
  carModelName: string;
  number: string;
  gridPos: number; // 1..4
  isPlayer: boolean;
  primaryColor: string;
  accentColor: string;
  angleLabel: string;
}

export interface HudSnapshot {
  mode: GameMode;
  speedKmh: number;
  rpmRatio: number; // 0..1
  gear: number; // 1..6
  nitro: number; // 0..100
  isNitroActive: boolean;
  isPadBoostActive: boolean;
  isDrifting: boolean;
  isOnIce: boolean;
  isOnSand: boolean;
  // Pursuit HUD state
  hp: number;
  maxHp: number;
  isDamagedSlow: boolean;
  progressPct: number;
  distanceLeftMeters: number;
  policeActiveCount: number;
  policeWreckedCount: number;
  damageAlertTimer: number;
  lastDamageAmount: number;
  surroundPct: number;
  // Race alerts
  waterSplashTimer: number;
  wreckAlertTimer: number;
  wreckReason: 'ball' | 'machinery' | null;
  lap: number;
  totalLaps: number;
  position: number;
  totalCars: number;
  raceTime: number;
  countdown: number; // > 0 during pre-race showcase & 3-2-1 countdown
  goFlash: boolean;
  introSpotlight: IntroSpotlight | null;
  standings: RacerStanding[];
  minimapCars: Array<{
    id: string;
    x: number;
    z: number;
    yaw: number;
    isPlayer: boolean;
    role: RacerRole;
    wrecked: boolean;
    color: string;
  }>;
  minimapBoostPads: Array<{
    id: number;
    x: number;
    z: number;
  }>;
}

export interface RaceFinishSummary {
  mode: GameMode;
  winnerId: string;
  winnerName: string;
  playerWon: boolean;
  defeatReason: 'wrecked' | 'surrounded' | null;
  playerPosition: number;
  raceTime: number;
  bestLapTime: number | null;
  progressPct: number;
  remainingHp: number;
  damageTaken: number;
  policeWrecked: number;
  standings: RacerStanding[];
}

export const TOTAL_LAPS = 3;

export const CAR_ROSTER: CarSpec[] = [
  {
    id: 'player',
    name: 'You',
    isPlayer: true,
    bodyStyle: 'lamborghini',
    primaryColor: '#f8fafc',
    accentColor: '#f97316',
    spoilerStyle: 'gt-wing',
    rimFinish: 'silver',
    livery: 'stripe',
    number: '01',
    aiSkill: 1.0,
    preferredLane: -0.25,
  },
  {
    id: 'bot-1',
    name: 'Victor (Ferrari SF90)',
    isPlayer: false,
    bodyStyle: 'ferrari',
    primaryColor: '#dc2626',
    accentColor: '#facc15',
    spoilerStyle: 'gt-wing',
    rimFinish: 'gold',
    livery: 'twin',
    number: '07',
    aiSkill: 0.99,
    preferredLane: 0.25,
  },
  {
    id: 'bot-2',
    name: 'Alina (BMW M4 GT3)',
    isPlayer: false,
    bodyStyle: 'bmw',
    primaryColor: '#2563eb',
    accentColor: '#38bdf8',
    spoilerStyle: 'gt-wing',
    rimFinish: 'silver',
    livery: 'stripe',
    number: '14',
    aiSkill: 0.95,
    preferredLane: -0.28,
  },
  {
    id: 'bot-3',
    name: 'Max (Porsche 911 GT3)',
    isPlayer: false,
    bodyStyle: 'porsche',
    primaryColor: '#059669',
    accentColor: '#a3e635',
    spoilerStyle: 'ducktail',
    rimFinish: 'obsidian',
    livery: 'twin',
    number: '23',
    aiSkill: 0.91,
    preferredLane: 0.28,
  },
];
