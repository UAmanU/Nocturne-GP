import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRAPHICS_QUALITY_OPTIONS,
  getGraphicsProfile,
  normalizeGraphicsQuality,
} from './graphics';
import { normalizeGameSettings } from './garage';
import { createSkidMarksSystem, shouldEmitSkidMark } from './skidMarks';
import { createVolumetricCloudsSystem } from './clouds';
import type { RacerState } from './types';

function makeRacerStub(overrides: Partial<RacerState> = {}): RacerState {
  return {
    id: 'player',
    name: 'You',
    isPlayer: true,
    role: 'racer',
    primaryColor: '#f8fafc',
    accentColor: '#f97316',
    number: '01',
    x: 0,
    z: 0,
    vx: 0,
    vz: 20,
    yaw: 0,
    speed: 20,
    lateralSpeed: 0,
    steerAngle: 0,
    wheelSpin: 0,
    pitch: 0,
    roll: 0,
    nitro: 50,
    isNitroActive: false,
    padBoostTimer: 0,
    padCooldown: 0,
    isBraking: false,
    isDrifting: false,
    isOnSand: false,
    hp: 200,
    maxHp: 200,
    wrecked: false,
    wallHitCooldown: 0,
    ramCooldown: 0,
    justTookDamage: 0,
    trackT: 0,
    nearestSampleIndex: 0,
    activeBranchId: null,
    lap: 1,
    highestSector: 0,
    totalProgress: 0,
    finished: false,
    finishTime: null,
    currentLapStartTime: 0,
    bestLapTime: null,
    lastLapTime: null,
    aiSkill: 1,
    preferredLane: 0,
    aiLaneOffset: 0,
    aiNitroCooldown: 0,
    justActivatedNitro: false,
    justHitBoostPad: false,
    justCollidedStrength: 0,
    justFellInWater: false,
    waterSplashX: 0,
    waterSplashZ: 0,
    justWrecked: false,
    wreckX: 0,
    wreckZ: 0,
    wreckReason: null,
    wreckGraceTimer: 0,
    ...overrides,
  };
}

test('normalizeGraphicsQuality falls back to medium for invalid values', () => {
  assert.equal(normalizeGraphicsQuality('low'), 'low');
  assert.equal(normalizeGraphicsQuality('medium'), 'medium');
  assert.equal(normalizeGraphicsQuality('high'), 'high');
  assert.equal(normalizeGraphicsQuality('ultra'), 'medium');
  assert.equal(normalizeGraphicsQuality(null), 'medium');
  assert.equal(normalizeGraphicsQuality(undefined), 'medium');
});

test('getGraphicsProfile separates Low, Medium, and High capabilities cleanly', () => {
  assert.equal(GRAPHICS_QUALITY_OPTIONS.length, 3);

  const low = getGraphicsProfile('low');
  const med = getGraphicsProfile('medium');
  const high = getGraphicsProfile('high');

  // Low optimizes loading & draw cost: flat shaders, no banners, scaled textures & density
  assert.equal(low.shadows, false);
  assert.equal(low.showBanners, false);
  assert.equal(low.buildingDetail, 'simple');
  assert.equal(low.carDetail, 'simple');
  assert.equal(low.npcDetail, 'simple');
  assert.equal(low.lampPools, false);
  assert.equal(low.textureSizeScale, 0.5);
  assert.equal(low.densityScale, 0.5);
  assert.equal(low.npcDensityScale, 0.5);
  assert.equal(low.skidMarks, false);
  assert.equal(low.volumetricClouds, false);
  assert.equal(low.gridlessGround, false);

  // Medium matches balanced baseline
  assert.equal(med.shadows, false);
  assert.equal(med.showBanners, true);
  assert.equal(med.buildingDetail, 'standard');
  assert.equal(med.carDetail, 'standard');
  assert.equal(med.npcDetail, 'standard');
  assert.equal(med.densityScale, 1);

  // High unlocks shadows, gridless ground, skid marks, 3D clouds, and high-detail assets
  assert.equal(high.shadows, true);
  assert.ok(high.shadowMapSize >= 2048);
  assert.equal(high.gridlessGround, true);
  assert.equal(high.skidMarks, true);
  assert.equal(high.volumetricClouds, true);
  assert.equal(high.buildingDetail, 'high');
  assert.equal(high.carDetail, 'high');
  assert.equal(high.npcDetail, 'high');
  assert.ok(high.densityScale > med.densityScale);
});

test('normalizeGameSettings persists valid graphicsQuality and defaults missing values', () => {
  const withHigh = normalizeGameSettings({
    mode: 'race',
    mapId: 'day-city',
    graphicsQuality: 'high',
  });
  assert.equal(withHigh.graphicsQuality, 'high');

  const withUnknown = normalizeGameSettings({
    mode: 'pursuit',
    mapId: 'pursuit-highway',
    graphicsQuality: 'invalid' as never,
  });
  assert.equal(withUnknown.graphicsQuality, 'medium');
});

test('shouldEmitSkidMark gates wrecked/slow cars and triggers on drift, heavy brake, or slip', () => {
  assert.equal(
    shouldEmitSkidMark({ wrecked: true, speed: 30, isDrifting: true, isBraking: false, lateralSpeed: 8 }),
    false
  );
  assert.equal(
    shouldEmitSkidMark({ wrecked: false, speed: 3, isDrifting: true, isBraking: true, lateralSpeed: 5 }),
    false
  );
  assert.equal(
    shouldEmitSkidMark({ wrecked: false, speed: 18, isDrifting: false, isBraking: false, lateralSpeed: 1 }),
    false
  );
  assert.equal(
    shouldEmitSkidMark({ wrecked: false, speed: 18, isDrifting: true, isBraking: false, lateralSpeed: 1 }),
    true
  );
  assert.equal(
    shouldEmitSkidMark({ wrecked: false, speed: 14, isDrifting: false, isBraking: true, lateralSpeed: 0 }),
    true
  );
  assert.equal(
    shouldEmitSkidMark({ wrecked: false, speed: 18, isDrifting: false, isBraking: false, lateralSpeed: 4.5 }),
    true
  );
});

test('createSkidMarksSystem records tire marks and resets cleanly', () => {
  const skids = createSkidMarksSystem('day-city');
  assert.equal(skids.mesh.count, 0);

  const player = makeRacerStub({ x: 10, z: 20, yaw: 0.4, speed: 24, isDrifting: true });
  skids.record([player]);
  assert.equal(skids.mesh.count, 2); // 2 rear wheels

  // Stationary / tiny movement below MIN_STAMP_DISTANCE_SQ shouldn't double-stamp
  skids.record([makeRacerStub({ x: 10.1, z: 20.1, yaw: 0.4, speed: 24, isDrifting: true })]);
  assert.equal(skids.mesh.count, 2);

  // Moving > 0.48m stamps another pair
  skids.record([makeRacerStub({ x: 11.2, z: 21.0, yaw: 0.4, speed: 24, isDrifting: true })]);
  assert.equal(skids.mesh.count, 4);

  skids.reset();
  assert.equal(skids.mesh.count, 0);
  skids.dispose();
});

test('createVolumetricCloudsSystem creates animated cloud meshes across race & pursuit maps', () => {
  const dayClouds = createVolumetricCloudsSystem('day-city', 'clear', 600);
  assert.ok(dayClouds.group.children.length > 0);
  dayClouds.update(0.5, 1.0);
  dayClouds.dispose();

  const pursuitClouds = createVolumetricCloudsSystem('pursuit-highway', 'rain', 900);
  assert.ok(pursuitClouds.group.children.length > 0);
  pursuitClouds.update(0.25, 2.5);
  pursuitClouds.dispose();
});
