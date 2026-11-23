import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createRaceTrack,
  isForkOpeningAtT,
  isTrackPointClear,
  projectOntoTrack,
  sampleAtT,
} from './track';
import {
  computeAiInput,
  createRaceSimulation,
  getStandings,
  stepRaceSimulation,
} from './physics';
import {
  ALLOWED_WEATHER_BY_MAP,
  normalizeCarAppearance,
  normalizeGameSettings,
  pickRandomMap,
  pickWeatherForMap,
  resolveWeatherForMap,
} from './garage';
import type { MapId } from './types';

test('all 5 map splines form enlarged ~1350-2050m closed loops with floor boost pads', () => {
  const mapIds: MapId[] = ['night-city', 'beach', 'day-city', 'ice-arena', 'construction'];
  for (const mapId of mapIds) {
    const track = createRaceTrack(mapId);
    assert.equal(track.mapId, mapId);
    assert.ok(
      track.totalLength > 1350 && track.totalLength < 2050,
      `Expected ~1350-2050m circuit for ${mapId}, got ${track.totalLength}`
    );
    assert.equal(track.samples.length, 900);

    const start = track.samples[0];
    const end = track.samples[track.samples.length - 1];
    const gap = Math.hypot(start.x - end.x, start.z - end.z);
    assert.ok(gap < 3.0, `Expected closed loop gap < 3m for ${mapId}, got ${gap}`);

    const proj = projectOntoTrack(track, start.x + start.rx * 3.5, start.z + start.rz * 3.5, 0);
    assert.ok(Math.abs(proj.lateralOffset - 3.5) < 0.25);

    const sim = createRaceSimulation(track, true);
    assert.ok(sim.boostPads.length >= 6);
  }
});

test('car accelerates gradually up to 120 km/h, boosts smoothly up to 165 km/h with Nitro, and decelerates gradually when coasting', () => {
  const track = createRaceTrack('night-city');

  const simCharge = createRaceSimulation(track, true);
  const player = simCharge.racers[0];
  assert.equal(player.nitro, 0);

  // Measure gradual acceleration milestones: 0.5s, 1.5s, 5.5s
  for (let i = 0; i < 30; i++) {
    stepRaceSimulation(
      simCharge,
      { throttle: 1, brake: 0, steer: 0, nitro: true, drift: false },
      1 / 60
    );
  }
  const kmh05s = player.speed * 3.6;
  assert.ok(kmh05s > 12 && kmh05s < 45, `After 0.5s car should still be accelerating gradually, got ${kmh05s.toFixed(1)} km/h`);

  for (let i = 0; i < 60; i++) {
    stepRaceSimulation(
      simCharge,
      { throttle: 1, brake: 0, steer: 0, nitro: true, drift: false },
      1 / 60
    );
  }
  const kmh15s = player.speed * 3.6;
  assert.ok(kmh15s > kmh05s + 20 && kmh15s < 105, `After 1.5s speed should smoothly climb, got ${kmh15s.toFixed(1)} km/h`);

  for (let i = 0; i < 240; i++) {
    stepRaceSimulation(
      simCharge,
      { throttle: 1, brake: 0, steer: 0, nitro: true, drift: false },
      1 / 60
    );
  }
  const normalKmh = player.speed * 3.6;
  assert.equal(player.isNitroActive, false, 'Nitro cannot activate before 100%');
  assert.ok(player.nitro > 20 && player.nitro < 80, `Nitro should charge while driving, got ${player.nitro}`);
  assert.ok(normalKmh >= 115 && normalKmh <= 120.5, `Expected ~120 km/h normal cap, got ${normalKmh.toFixed(1)}`);

  // Coasting without throttle loses speed gradually rather than stopping instantly
  for (let i = 0; i < 60; i++) {
    stepRaceSimulation(
      simCharge,
      { throttle: 0, brake: 0, steer: 0, nitro: false, drift: false },
      1 / 60
    );
  }
  const coastKmh = player.speed * 3.6;
  assert.ok(coastKmh > 60 && coastKmh < normalKmh - 5, `Coasting 1s should lose speed smoothly, got ${coastKmh.toFixed(1)}`);

  const simBoost = createRaceSimulation(track, true);
  for (let i = 1; i < simBoost.racers.length; i++) {
    simBoost.racers[i].x += 5;
  }
  const booster = simBoost.racers[0];
  booster.nitro = 100;

  stepRaceSimulation(
    simBoost,
    { throttle: 1, brake: 0, steer: 0, nitro: true, drift: false },
    1 / 60
  );
  assert.equal(booster.isNitroActive, true);
  assert.equal(booster.justActivatedNitro, true);

  for (let i = 0; i < 150; i++) {
    stepRaceSimulation(
      simBoost,
      { throttle: 1, brake: 0, steer: 0, nitro: false, drift: false },
      1 / 60
    );
  }
  const boostKmh = booster.speed * 3.6;
  assert.equal(booster.isNitroActive, true, 'Boost stays locked ON while draining to 0%');
  assert.ok(boostKmh >= 152 && boostKmh <= 165.5, `Expected ~165 km/h nitro speed, got ${boostKmh.toFixed(1)}`);
  assert.ok(booster.nitro > 25 && booster.nitro < 70, `Nitro should drain continuously, got ${booster.nitro}`);

  for (let i = 0; i < 300; i++) {
    stepRaceSimulation(
      simBoost,
      { throttle: 0, brake: 0, steer: 0, nitro: false, drift: false },
      1 / 60
    );
    if (!booster.isNitroActive) break;
  }
  assert.equal(booster.isNitroActive, false, 'Boost must turn off once depleted to 0%');
  assert.equal(booster.nitro, 0, 'Nitro should empty completely to 0%');
});

test('Ctrl drift turns tighter, preserves cornering momentum, and earns bonus nitro vs non-drift turn', () => {
  const track = createRaceTrack('beach');

  const simNoDrift = createRaceSimulation(track, true);
  const simDrift = createRaceSimulation(track, true);

  for (const sim of [simNoDrift, simDrift]) {
    for (let i = 1; i < sim.racers.length; i++) sim.racers[i].x += 8;
    const p = sim.racers[0];
    const s = sampleAtT(track, 0.25);
    p.x = s.x;
    p.z = s.z;
    p.yaw = s.yaw;
    p.nearestSampleIndex = s.index;
    p.vx = Math.sin(s.yaw) * 28.0;
    p.vz = Math.cos(s.yaw) * 28.0;
    p.speed = 28.0;
    p.nitro = 0;
  }

  for (let i = 0; i < 20; i++) {
    stepRaceSimulation(
      simNoDrift,
      { throttle: 1, brake: 0, steer: 1, nitro: false, drift: false },
      1 / 60
    );
    stepRaceSimulation(
      simDrift,
      { throttle: 1, brake: 0, steer: 1, nitro: false, drift: true },
      1 / 60
    );
  }

  const pNoDrift = simNoDrift.racers[0];
  const pDrift = simDrift.racers[0];
  assert.equal(pDrift.isDrifting, true);
  assert.equal(pNoDrift.isDrifting, false);
  assert.ok(
    pDrift.speed > pNoDrift.speed + 1.5,
    `Drift should preserve more momentum (${pDrift.speed.toFixed(2)} vs ${pNoDrift.speed.toFixed(2)})`
  );
  assert.ok(
    pDrift.nitro > pNoDrift.nitro + 1.5,
    `Drift should charge bonus nitro (${pDrift.nitro.toFixed(2)} vs ${pNoDrift.nitro.toFixed(2)})`
  );
});

test('floor boost pad replenishes +30% Nitro (capped at 100%) without direct speed surge', () => {
  const track = createRaceTrack('day-city');
  const sim = createRaceSimulation(track, true);
  const player = sim.racers[0];
  const pad = sim.boostPads[0];

  const s = sampleAtT(track, pad.trackT);
  player.x = pad.x;
  player.z = pad.z;
  player.yaw = s.yaw;
  player.nearestSampleIndex = s.index;
  player.nitro = 15;

  stepRaceSimulation(sim, { throttle: 1, brake: 0, steer: 0, nitro: false, drift: false }, 1 / 60);

  assert.equal(player.justHitBoostPad, true);
  assert.equal(player.padBoostTimer, 0, 'Boost pad must not grant an independent speed surge timer');
  assert.ok(
    player.nitro >= 44.9 && player.nitro <= 46.5,
    `Boost pad must replenish +30% Nitro (from 15 -> ~45), got ${player.nitro}`
  );
  assert.ok(player.padCooldown > 0.5, 'Pad cooldown prevents multi-tick double counting');

  // Verify cap at 100%
  player.nitro = 88;
  player.padCooldown = 0;
  player.x = pad.x;
  player.z = pad.z;
  stepRaceSimulation(sim, { throttle: 1, brake: 0, steer: 0, nitro: false, drift: false }, 1 / 60);
  assert.equal(player.nitro, 100, 'Boost pad replenishment must cap at 100%');
});

test('car appearance and game settings normalize all 6 car models, legacy styles, maps, and weather', () => {
  const custom = normalizeCarAppearance({
    bodyStyle: 'ferrari',
    primaryColor: '#dc2626',
    accentColor: '#38bdf8',
    spoilerStyle: 'ducktail',
    rimFinish: 'gold',
    livery: 'twin',
  });
  assert.equal(custom.bodyStyle, 'ferrari');
  assert.equal(custom.rimFinish, 'gold');

  const legacyGt = normalizeCarAppearance({ bodyStyle: 'gt' });
  const legacyHyper = normalizeCarAppearance({ bodyStyle: 'hyper' });
  assert.equal(legacyGt.bodyStyle, 'bmw');
  assert.equal(legacyHyper.bodyStyle, 'lamborghini');

  const fallback = normalizeCarAppearance({ primaryColor: 'invalid' as string });
  assert.equal(fallback.bodyStyle, 'lamborghini');
  assert.equal(fallback.primaryColor, '#f8fafc');

  const settings = normalizeGameSettings({ mapId: 'night-city', weather: 'rain' });
  assert.equal(settings.mapId, 'night-city');
  assert.equal(settings.weather, 'rain');

  const clampedBeachSnow = normalizeGameSettings({ mapId: 'beach', weather: 'snow' });
  assert.equal(clampedBeachSnow.mapId, 'beach');
  assert.equal(clampedBeachSnow.weather, 'clear');

  const clampedBeachRain = normalizeGameSettings({ mapId: 'beach', weather: 'rain' });
  assert.equal(clampedBeachRain.mapId, 'beach');
  assert.equal(clampedBeachRain.weather, 'clear');

  const fallbackSettings = normalizeGameSettings({
    mapId: 'mars' as MapId,
    weather: 'tornado' as 'clear',
  });
  assert.equal(fallbackSettings.mapId, 'night-city');
  assert.equal(fallbackSettings.weather, 'clear');
});

test('per-map weather rules enforce allowed weather combinations including construction daytime-only and pickRandomMap', () => {
  assert.deepEqual([...ALLOWED_WEATHER_BY_MAP['ice-arena']], ['clear', 'snow']);
  assert.deepEqual([...ALLOWED_WEATHER_BY_MAP.beach], ['clear']);
  assert.deepEqual([...ALLOWED_WEATHER_BY_MAP['night-city']], ['clear', 'rain', 'snow']);
  assert.deepEqual([...ALLOWED_WEATHER_BY_MAP['day-city']], ['clear', 'snow']);
  assert.deepEqual([...ALLOWED_WEATHER_BY_MAP.construction], ['clear']);

  assert.equal(resolveWeatherForMap('ice-arena', 'rain'), 'clear');
  assert.equal(resolveWeatherForMap('ice-arena', 'snow'), 'snow');
  assert.equal(resolveWeatherForMap('beach', 'snow'), 'clear');
  assert.equal(resolveWeatherForMap('beach', 'rain'), 'clear');
  assert.equal(resolveWeatherForMap('day-city', 'rain'), 'clear');
  assert.equal(resolveWeatherForMap('day-city', 'snow'), 'snow');
  assert.equal(resolveWeatherForMap('night-city', 'rain'), 'rain');
  assert.equal(resolveWeatherForMap('night-city', 'snow'), 'snow');
  assert.equal(resolveWeatherForMap('construction', 'rain'), 'clear');
  assert.equal(resolveWeatherForMap('construction', 'snow'), 'clear');

  for (const mapId of [
    'night-city',
    'beach',
    'day-city',
    'ice-arena',
    'construction',
  ] as MapId[]) {
    for (const r of [0, 0.34, 0.67, 0.99]) {
      const picked = pickWeatherForMap(mapId, () => r);
      assert.ok(
        ALLOWED_WEATHER_BY_MAP[mapId].includes(picked),
        `Picked weather ${picked} must be allowed for ${mapId}`
      );
    }
  }

  const pickedSet = new Set<MapId>();
  for (const r of [0.05, 0.25, 0.45, 0.65, 0.9]) {
    pickedSet.add(pickRandomMap(() => r));
  }
  assert.equal(pickedSet.size, 5, 'pickRandomMap should reach all 5 circuits');
  assert.notEqual(pickRandomMap(() => 0.99, 'construction'), 'construction');
});

test('AI bots navigate all 5 enlarged circuits cleanly, use nitro & boost pads, and finish 3 laps', () => {
  for (const mapId of [
    'night-city',
    'beach',
    'day-city',
    'ice-arena',
    'construction',
  ] as MapId[]) {
    const track = createRaceTrack(mapId);
    const sim = createRaceSimulation(track, true);

    let usedNitro = false;
    let hitBoostPad = false;
    for (let step = 0; step < 240 * 30; step++) {
      for (const r of sim.racers) {
        if (!r.isPlayer && r.isNitroActive) usedNitro = true;
        if (!r.isPlayer && r.justHitBoostPad) hitBoostPad = true;
      }
      const playerAi = computeAiInput(sim, sim.racers[0], 1 / 30);
      stepRaceSimulation(sim, playerAi, 1 / 30);
      if (sim.finished) break;
    }

    assert.equal(usedNitro, true, `Bots should trigger nitro on ${mapId}`);
    assert.equal(hitBoostPad, true, `Bots should hit boost pads on ${mapId}`);
    assert.equal(sim.finished, true, `A car should finish 3 laps within 240s on ${mapId}`);
    assert.ok(sim.winnerId !== null);

    const standings = getStandings(sim.racers);
    assert.equal(standings.length, 4);
    assert.equal(standings[0].id, sim.winnerId);
    assert.equal(standings[0].position, 1);
  }
});

test('pre-race showcase & 3-2-1 countdown hold cars on grid until countdown reaches zero', () => {
  const track = createRaceTrack('night-city');
  const sim = createRaceSimulation(track, false);
  const player = sim.racers[0];
  const startX = player.x;
  const startZ = player.z;

  assert.ok(sim.countdown > 6.0);
  for (let i = 0; i < 60; i++) {
    stepRaceSimulation(sim, { throttle: 1, brake: 0, steer: 0, nitro: false }, 1 / 30);
  }
  assert.ok(sim.countdown > 3.0);
  assert.equal(player.x, startX);
  assert.equal(player.z, startZ);
  assert.equal(player.speed, 0);

  for (let i = 0; i < 160; i++) {
    stepRaceSimulation(sim, { throttle: 1, brake: 0, steer: 0, nitro: false }, 1 / 30);
  }
  assert.equal(sim.countdown, 0);
  assert.ok(player.speed > 5, 'Car should accelerate once countdown finishes');
});

test('victory keeps player speeding past finish line while defeat triggers brief drift then full stop', () => {
  const track = createRaceTrack('night-city');

  const winSim = createRaceSimulation(track, true);
  const winPlayer = winSim.racers[0];
  const s = sampleAtT(track, 0.002);
  winPlayer.x = s.x;
  winPlayer.z = s.z;
  winPlayer.yaw = s.yaw;
  winPlayer.vx = Math.sin(s.yaw) * 16;
  winPlayer.vz = Math.cos(s.yaw) * 16;
  winPlayer.speed = 16;
  winSim.finished = true;
  winSim.winnerId = winPlayer.id;
  winPlayer.padBoostTimer = 2.0;

  for (let i = 0; i < 45; i++) {
    stepRaceSimulation(winSim, { throttle: 0, brake: 0, steer: 0, nitro: false }, 1 / 30);
  }
  assert.ok(
    winPlayer.speed * 3.6 > 85,
    `Expected victory flyby to speed past finish > 85 km/h, got ${winPlayer.speed * 3.6}`
  );

  const lossSim = createRaceSimulation(track, true);
  const lossPlayer = lossSim.racers[0];
  const s2 = sampleAtT(track, 0.5);
  lossPlayer.x = s2.x;
  lossPlayer.z = s2.z;
  lossPlayer.yaw = s2.yaw;
  lossPlayer.nearestSampleIndex = s2.index;
  lossPlayer.vx = Math.sin(s2.yaw) * 16;
  lossPlayer.vz = Math.cos(s2.yaw) * 16;
  lossPlayer.speed = 16;
  lossSim.finished = true;
  lossSim.winnerId = 'bot-1';
  lossSim.defeatDriftSign = 1;

  let sawDrift = false;
  for (let i = 0; i < 30; i++) {
    stepRaceSimulation(lossSim, { throttle: 1, brake: 0, steer: 0, nitro: false }, 1 / 30);
    if (lossPlayer.isDrifting && Math.abs(lossPlayer.lateralSpeed) > 0.3) {
      sawDrift = true;
    }
  }
  assert.equal(sawDrift, true, 'Defeat should induce a short lateral drift before stopping');

  for (let i = 0; i < 60; i++) {
    stepRaceSimulation(lossSim, { throttle: 1, brake: 0, steer: 0, nitro: false }, 1 / 30);
  }
  assert.equal(lossPlayer.speed, 0, 'Defeat car should come to a complete stop');
  assert.equal(lossPlayer.isDrifting, false);
});

test('Ice Peaks Arena builds momentum up toward 140 km/h, slides uncontrollably on turns, and returns car to current lap start on water fall', () => {
  const iceTrack = createRaceTrack('ice-arena');
  const asphaltTrack = createRaceTrack('night-city');
  assert.ok(iceTrack.waterZones.length >= 3, 'Ice Peaks must define open water hazard sections');

  // 1. Ice momentum > 125 km/h (and up to 140 km/h) without nitro
  const iceSim = createRaceSimulation(iceTrack, true);
  for (let i = 1; i < iceSim.racers.length; i++) iceSim.racers[i].x += 20;
  const p = iceSim.racers[0];
  for (let i = 0; i < 320; i++) {
    stepRaceSimulation(
      iceSim,
      { throttle: 1, brake: 0, steer: 0, nitro: false, drift: false },
      1 / 60
    );
  }
  const iceKmh = Math.hypot(p.vx, p.vz) * 3.6;
  assert.ok(
    iceKmh > 125 && iceKmh <= 140.5,
    `Expected ice momentum 125..140 km/h without nitro, got ${iceKmh.toFixed(1)}`
  );

  // 2. Ice turns produce huge uncontrollable lateral slip compared to asphalt
  const asphaltSim = createRaceSimulation(asphaltTrack, true);
  const iceTurnSim = createRaceSimulation(iceTrack, true);
  for (const sim of [asphaltSim, iceTurnSim]) {
    for (let i = 1; i < sim.racers.length; i++) sim.racers[i].x += 20;
    const r = sim.racers[0];
    const s = sampleAtT(sim.track, 0.04);
    r.x = s.x;
    r.z = s.z;
    r.yaw = s.yaw;
    r.nearestSampleIndex = s.index;
    r.vx = Math.sin(s.yaw) * 28;
    r.vz = Math.cos(s.yaw) * 28;
    r.speed = 28;
  }
  for (let i = 0; i < 20; i++) {
    stepRaceSimulation(asphaltSim, { throttle: 1, brake: 0, steer: 1, nitro: false }, 1 / 60);
    stepRaceSimulation(iceTurnSim, { throttle: 1, brake: 0, steer: 1, nitro: false }, 1 / 60);
  }
  assert.ok(
    Math.abs(iceTurnSim.racers[0].lateralSpeed) >
      Math.abs(asphaltSim.racers[0].lateralSpeed) + 3.0,
    `Ice turn should slide dramatically sideways (${iceTurnSim.racers[0].lateralSpeed.toFixed(2)} vs ${asphaltSim.racers[0].lateralSpeed.toFixed(2)})`
  );

  // 3. Falling into an open arctic water hazard returns the car to the start of its CURRENT lap
  const waterSim = createRaceSimulation(iceTrack, true);
  for (let i = 1; i < waterSim.racers.length; i++) waterSim.racers[i].x += 30;
  const wz = iceTrack.waterZones[0];
  const wzSample = sampleAtT(iceTrack, (wz.tStart + wz.tEnd) * 0.5);
  const wp = waterSim.racers[0];
  wp.lap = 2;
  wp.highestSector = 1;
  wp.x = wzSample.x + wzSample.rx * (wz.safeMinLat - 1.5);
  wp.z = wzSample.z + wzSample.rz * (wz.safeMinLat - 1.5);
  wp.yaw = wzSample.yaw;
  wp.nearestSampleIndex = wzSample.index;
  wp.trackT = wzSample.t;
  wp.vx = Math.sin(wzSample.yaw) * 18;
  wp.vz = Math.cos(wzSample.yaw) * 18;
  wp.speed = 18;

  stepRaceSimulation(waterSim, { throttle: 1, brake: 0, steer: 0, nitro: false }, 1 / 60);
  assert.equal(wp.justFellInWater, true, 'Driving off open-water edge must trigger justFellInWater');
  assert.equal(wp.lap, 2, 'Water reset must preserve current lap (2)');
  assert.ok(wp.trackT < 0.05, `Water reset must return car to start of current lap, got t=${wp.trackT}`);
  assert.equal(wp.speed, 0);
});

test('Construction Site slows cars on sand, hunts cars with excavators/bulldozers, and destroys cars on black wrecking ball impact', () => {
  const track = createRaceTrack('construction');
  const sim = createRaceSimulation(track, true);
  assert.ok(sim.sandPatches.length >= 9, 'Construction site must place 9+ wider road sand patches');
  assert.equal(sim.constructionVehicles.length, 8, 'Construction site must spawn 8 aggressive bulldozers/excavators');
  assert.ok(sim.wreckingBall !== null, 'Construction site must have a central crane wrecking ball');

  // 1. Road sand patch slows car dramatically vs 120 km/h clear asphalt
  const sandPatch = sim.sandPatches[0];
  const sandPlayer = sim.racers[0];
  for (let i = 1; i < sim.racers.length; i++) sim.racers[i].x += 40;
  sandPlayer.x = sandPatch.x;
  sandPlayer.z = sandPatch.z;
  sandPlayer.yaw = sandPatch.yaw;
  sandPlayer.trackT = sandPatch.trackT;
  sandPlayer.nearestSampleIndex = Math.floor(sandPatch.trackT * track.samples.length);
  sandPlayer.vx = Math.sin(sandPatch.yaw) * 30;
  sandPlayer.vz = Math.cos(sandPatch.yaw) * 30;
  sandPlayer.speed = 30;

  for (let i = 0; i < 45; i++) {
    // Keep car anchored inside the sand patch for sustained drag test
    sandPlayer.x = sandPatch.x;
    sandPlayer.z = sandPatch.z;
    stepRaceSimulation(
      sim,
      { throttle: 1, brake: 0, steer: 0, nitro: false, drift: false },
      1 / 60
    );
  }
  assert.equal(sandPlayer.isOnSand, true, 'Car inside road sand patch must report isOnSand=true');
  assert.ok(
    sandPlayer.speed * 3.6 < 68,
    `Road sand must slow car well below 120 km/h normal speed, got ${(sandPlayer.speed * 3.6).toFixed(1)} km/h`
  );

  // 2. Contact with moving excavator / bulldozer disables & respawns car
  const machSim = createRaceSimulation(track, true);
  for (let i = 1; i < machSim.racers.length; i++) machSim.racers[i].x += 50;
  const mp = machSim.racers[0];
  const bulldozer = machSim.constructionVehicles[0];
  mp.lap = 2;
  mp.x = bulldozer.x;
  mp.z = bulldozer.z;
  mp.trackT = bulldozer.trackT;
  mp.nearestSampleIndex = Math.floor(bulldozer.trackT * track.samples.length);
  mp.speed = 14;
  mp.vx = Math.sin(mp.yaw) * 14;
  mp.vz = Math.cos(mp.yaw) * 14;

  stepRaceSimulation(machSim, { throttle: 0, brake: 0, steer: 0, nitro: false }, 1 / 60);
  assert.equal(mp.justWrecked, true, 'Machinery collision must trigger justWrecked');
  assert.equal(mp.wreckReason, 'machinery');
  assert.equal(mp.speed, 0);
  assert.equal(mp.lap, 2);

  // 3. Contact with central tower crane black wrecking ball destroys & respawns car
  const ballSim = createRaceSimulation(track, true);
  for (let i = 1; i < ballSim.racers.length; i++) ballSim.racers[i].x += 50;
  const bp = ballSim.racers[0];
  const ball = ballSim.wreckingBall!;
  bp.lap = 3;
  bp.x = ball.ballX;
  bp.z = ball.ballZ;
  bp.trackT = 0.25;
  bp.speed = 15;
  bp.vx = Math.sin(bp.yaw) * 15;
  bp.vz = Math.cos(bp.yaw) * 15;

  stepRaceSimulation(ballSim, { throttle: 0, brake: 0, steer: 0, nitro: false }, 1 / 60);
  assert.equal(bp.justWrecked, true, 'Black wrecking ball impact must trigger justWrecked');
  assert.equal(bp.wreckReason, 'ball');
  assert.equal(bp.speed, 0);
  assert.equal(bp.lap, 3);
});

test('Construction Site machinery moves continuously at 60Hz without 1m quantization stalls or 1-frame direction-flip jitter', () => {
  const track = createRaceTrack('construction');
  const sim = createRaceSimulation(track, true);
  // Park racers far from vehicles to isolate pure patrol + boundary turnaround smoothness, then bring player close
  for (const r of sim.racers) {
    r.trackT = 0.01;
    r.x = track.samples[5].x;
    r.z = track.samples[5].z;
  }

  let prevX = sim.constructionVehicles.map((v) => v.x);
  let prevZ = sim.constructionVehicles.map((v) => v.z);
  let prevYaw = sim.constructionVehicles.map((v) => v.yaw);
  let prevDir = sim.constructionVehicles.map((v) => v.patrolDir);

  let maxYawJump = 0;
  let zeroMoveStallsAtCruise = 0;
  let quickFlips = 0;
  const lastFlipStep = sim.constructionVehicles.map(() => -999);

  for (let step = 0; step < 60 * 25; step++) {
    stepRaceSimulation(sim, { throttle: 0, brake: 0, steer: 0, nitro: false }, 1 / 60);
    for (let i = 0; i < sim.constructionVehicles.length; i++) {
      const v = sim.constructionVehicles[i];
      const dist = Math.hypot(v.x - prevX[i], v.z - prevZ[i]);
      if (Math.abs(v.speed) > 2.5 && dist < 0.01) {
        zeroMoveStallsAtCruise++;
      }
      let dyaw = Math.abs(v.yaw - prevYaw[i]);
      if (dyaw > Math.PI) dyaw = Math.PI * 2 - dyaw;
      if (dyaw > maxYawJump) maxYawJump = dyaw;

      if (v.patrolDir !== prevDir[i]) {
        if (step - lastFlipStep[i] < 45) quickFlips++;
        lastFlipStep[i] = step;
      }
      prevX[i] = v.x;
      prevZ[i] = v.z;
      prevYaw[i] = v.yaw;
      prevDir[i] = v.patrolDir;
    }
  }

  assert.equal(zeroMoveStallsAtCruise, 0, 'Vehicles must never stall between quantized spline samples');
  assert.equal(quickFlips, 0, 'Vehicles must never chatter/oscillate patrolDir at sector boundaries');
  assert.ok(maxYawJump < 0.12, `Max per-frame yaw delta must stay smooth (<0.12 rad), got ${maxYawJump.toFixed(3)}`);
});

test('Pursuit mode maps are enlarged open routes (>2100m) with watertight fork cuts and building-free branch corridors', () => {
  const pursuitIds: MapId[] = ['pursuit-highway', 'pursuit-docks', 'pursuit-industrial'];
  for (const mapId of pursuitIds) {
    const track = createRaceTrack(mapId);
    assert.equal(track.isClosed, false, `${mapId} must be an open non-closed 1-pass route`);
    assert.ok(track.totalLength > 2100, `${mapId} should be an enlarged >2100m pursuit route, got ${track.totalLength}`);
    assert.ok(track.branches.length >= 2, `${mapId} must have fast-hard and long-safe route forks`);
    assert.ok(track.branches.some((b) => b.kind === 'fast-hard'));
    assert.ok(track.branches.some((b) => b.kind === 'long-safe'));
    assert.deepEqual([...ALLOWED_WEATHER_BY_MAP[mapId]], ['clear', 'rain', 'snow']);

    const start = track.samples[0];
    const end = track.samples[track.samples.length - 1];
    assert.ok(Math.hypot(start.x - end.x, start.z - end.z) > 250, `${mapId} start & end must be separated`);

    // Verify forkCut geometry and branch obstacle clearance
    for (const b of track.branches) {
      const fc = b.forkCut;
      assert.ok(fc.entryMainEndIdx < fc.entryMainStartIdx, `${mapId} branch ${b.id} entry forkCut order`);
      assert.ok(fc.entryMainStartIdx < fc.exitMainEndIdx, `${mapId} branch ${b.id} gore order`);
      assert.ok(fc.exitMainEndIdx < fc.exitMainStartIdx, `${mapId} branch ${b.id} exit forkCut order`);
      assert.ok(fc.branchOuterStartIdx < fc.branchOuterEndIdx, `${mapId} branch ${b.id} outer wall indices`);
      assert.ok(fc.branchInnerStartIdx < fc.branchInnerEndIdx, `${mapId} branch ${b.id} inner wall indices`);

      // Verify isTrackPointClear rejects every sample along the branch corridor (prevents buildings spawning on detours)
      for (let i = 0; i < b.samples.length; i += 4) {
        const bs = b.samples[i];
        assert.equal(
          isTrackPointClear(track, bs.x, bs.z, 8, 4.55),
          false,
          `Buildings must not spawn inside branch ${b.id} sample ${i} on ${mapId}`
        );
      }

      // Verify inner wall vertices between branchInnerStartIdx..branchInnerEndIdx never intrude onto main asphalt
      const sideSign = b.side === 'right' ? 1 : -1;
      const bWallOff = b.halfWidth + 0.85;
      for (let i = fc.branchInnerStartIdx; i <= fc.branchInnerEndIdx; i++) {
        const bs = b.samples[i];
        const ix = bs.x - bs.rx * sideSign * bWallOff;
        const iz = bs.z - bs.rz * sideSign * bWallOff;
        let minDist = Infinity;
        for (const ms of track.samples) {
          const d = Math.hypot(ix - ms.x, iz - ms.z);
          if (d < minDist) minDist = d;
        }
        assert.ok(
          minDist >= track.halfWidth + 0.5,
          `Branch ${b.id} inner wall sample ${i} on ${mapId} must stay clear of main asphalt (${minDist.toFixed(2)}m)`
        );
      }
    }
  }

  for (const r of [0, 0.2, 0.4, 0.6, 0.85, 0.99]) {
    const racePick = pickRandomMap(() => r, undefined, 'race');
    assert.ok(!pursuitIds.includes(racePick), `Race picker must never select pursuit map (${racePick})`);
    const pursuitPick = pickRandomMap(() => r, undefined, 'pursuit');
    assert.ok(pursuitIds.includes(pursuitPick), `Pursuit picker must only select pursuit maps (${pursuitPick})`);
  }
});

test('Pursuit simulation spawns 200 HP player, 160 HP police, applies +10% speed (~132 km/h), <30% HP penalty (<60 HP), obstacle immunity & speed scrub', () => {
  const track = createRaceTrack('pursuit-highway');
  const simCountdown = createRaceSimulation(track, false);
  assert.equal(simCountdown.mode, 'pursuit');
  assert.equal(simCountdown.countdown, 3.0, 'Pursuit skips 4-car GP showcase and goes straight to 3s countdown');
  assert.equal(simCountdown.racers.length, 6);

  const player = simCountdown.racers[0];
  const chasers = simCountdown.racers.filter((r) => r.role === 'police-chaser');
  const roadblocks = simCountdown.racers.filter((r) => r.role === 'police-roadblock');
  assert.equal(player.hp, 200);
  assert.equal(player.maxHp, 200);
  assert.equal(chasers.length, 3);
  assert.equal(roadblocks.length, 2);
  for (const c of chasers) {
    assert.equal(c.hp, 160, 'Police HP must be -20% vs player (160 HP)');
    assert.ok(c.trackT < player.trackT, '3 police chasers must start behind the player');
  }
  for (const rb of roadblocks) {
    assert.equal(rb.hp, 160);
    assert.ok(rb.trackT > player.trackT, '2 roadblock police cars must start ahead of player');
  }

  // 1. Speed checks: +10% in Pursuit (~132 km/h normal) and -20%/-15% when HP < 30% (<60 HP)
  const simSpeed = createRaceSimulation(track, true);
  simSpeed.pursuitObstacles = [];
  const p = simSpeed.racers[0];
  // Clear chasers behind so they don't bump during straight speed measurement
  for (let i = 1; i < simSpeed.racers.length; i++) {
    simSpeed.racers[i].x += 500;
    simSpeed.racers[i].z += 500;
  }
  for (let i = 0; i < 360; i++) {
    stepRaceSimulation(simSpeed, { throttle: 1, brake: 0, steer: 0, nitro: false }, 1 / 60);
  }
  const normalPursuitKmh = p.speed * 3.6;
  assert.ok(
    normalPursuitKmh >= 126 && normalPursuitKmh <= 132.5,
    `Pursuit +10% normal top speed should be ~132 km/h, got ${normalPursuitKmh.toFixed(2)}`
  );

  // Drop HP < 30% (< 60 HP) -> -20% normal max speed (~105.6 km/h)
  p.hp = 50;
  for (let i = 0; i < 240; i++) {
    stepRaceSimulation(simSpeed, { throttle: 1, brake: 0, steer: 0, nitro: false }, 1 / 60);
  }
  const damagedNormalKmh = p.speed * 3.6;
  assert.ok(
    damagedNormalKmh >= 100 && damagedNormalKmh <= 106.5,
    `Damaged (<30% HP) normal max speed should drop -20% to ~105.6 km/h, got ${damagedNormalKmh.toFixed(2)}`
  );

  // Damaged (<30% HP) Nitro max speed drops -15% (~154.3 km/h instead of 181.5 km/h)
  const straightStart = sampleAtT(track, 0.042);
  p.x = straightStart.x;
  p.z = straightStart.z;
  p.yaw = straightStart.yaw;
  p.nearestSampleIndex = straightStart.index;
  p.trackT = straightStart.t;
  p.nitro = 100;
  for (let i = 0; i < 160; i++) {
    stepRaceSimulation(simSpeed, { throttle: 1, brake: 0, steer: 0, nitro: true }, 1 / 60);
  }
  const damagedNitroKmh = p.speed * 3.6;
  assert.ok(
    damagedNitroKmh >= 145 && damagedNitroKmh <= 155.5,
    `Damaged (<30% HP) Nitro max speed should drop -15% to ~154.3 km/h, got ${damagedNitroKmh.toFixed(2)}`
  );

  // 2. Roadblock police never chase even if player is ahead, and police ignore cones/barriers
  const simObs = createRaceSimulation(track, true);
  const pObs = simObs.racers[0];
  const chaser0 = simObs.racers[1];
  const rb0 = simObs.racers[4];
  const rbStartX = rb0.x;
  const rbStartZ = rb0.z;
  const firstCone = simObs.pursuitObstacles.find((o) => o.kind === 'cone')!;
  const firstBarrier = simObs.pursuitObstacles.find((o) => o.kind === 'barrier')!;

  // Police passes through obstacle without taking damage or knocking it
  chaser0.x = firstCone.x;
  chaser0.z = firstCone.z;
  // Teleport player ahead of roadblock
  pObs.trackT = rb0.trackT + 0.05;
  stepRaceSimulation(simObs, { throttle: 0, brake: 0, steer: 0, nitro: false }, 1 / 60);
  assert.equal(chaser0.hp, 160, 'Police must pass cleanly through obstacles with 0 damage');
  assert.equal(firstCone.knocked, false, 'Police must not trigger player roadblock traps');
  assert.ok(Math.hypot(rb0.x - rbStartX, rb0.z - rbStartZ) < 0.01, 'Roadblock police must remain stationary');

  // Player hits cone (3 HP) and barrier (5 HP) without Nitro -> loses HP and scrubs speed
  pObs.speed = 25;
  pObs.vx = 25;
  pObs.x = firstCone.x;
  pObs.z = firstCone.z;
  stepRaceSimulation(simObs, { throttle: 1, brake: 0, steer: 0, nitro: false }, 1 / 60);
  assert.equal(firstCone.knocked, true);
  assert.equal(pObs.hp, 197, 'Cone hit must deal 3 HP (200 -> 197)');

  pObs.x = firstBarrier.x;
  pObs.z = firstBarrier.z;
  stepRaceSimulation(simObs, { throttle: 1, brake: 0, steer: 0, nitro: false }, 1 / 60);
  assert.equal(firstBarrier.knocked, true);
  assert.equal(pObs.hp, 192, 'Barrier hit must deal 5 HP (197 -> 192)');

  // 3. Nitro ram deals 40 HP to police car
  const simRam = createRaceSimulation(track, true);
  const pr = simRam.racers[0];
  const pol = simRam.racers[1];
  pr.nitro = 100;
  pr.isNitroActive = true;
  pr.vx = 40;
  pr.vz = 0;
  pr.x = pol.x - 2.0;
  pr.z = pol.z;
  pol.vx = 0;
  pol.vz = 0;
  stepRaceSimulation(simRam, { throttle: 1, brake: 0, steer: 0, nitro: true }, 1 / 60);
  assert.equal(pol.hp, 120, 'Nitro ramming must deal 40 HP damage (160 -> 120)');

  // 4. Reaching end extraction point (t >= 0.992) wins Pursuit; 0 HP loses
  const simWin = createRaceSimulation(track, true);
  const pw = simWin.racers[0];
  const endSample = sampleAtT(track, 0.995);
  pw.x = endSample.x;
  pw.z = endSample.z;
  pw.yaw = endSample.yaw;
  pw.nearestSampleIndex = endSample.index;
  pw.trackT = 0.995;
  stepRaceSimulation(simWin, { throttle: 1, brake: 0, steer: 0, nitro: false }, 1 / 60);
  assert.equal(simWin.finished, true);
  assert.equal(simWin.winnerId, 'player');

  const simLose = createRaceSimulation(track, true);
  simLose.racers[0].hp = 0;
  stepRaceSimulation(simLose, { throttle: 0, brake: 0, steer: 0, nitro: false }, 1 / 60);
  assert.equal(simLose.finished, true);
  assert.equal(simLose.winnerId, 'police-1');
});

test('all Pursuit branch fork throats triangulate cleanly and keep outer bollards outside main road', () => {
  const pursuitMaps: MapId[] = ['pursuit-highway', 'pursuit-docks', 'pursuit-industrial'];
  for (const mapId of pursuitMaps) {
    const track = createRaceTrack(mapId);
    for (const branch of track.branches) {
      const fc = branch.forkCut;
      const sSign = branch.side === 'right' ? 1 : -1;
      const mw = track.halfWidth;
      const bw = branch.halfWidth;

      // Gore tip sample is excluded with pad=0 (wall physics) but included with pad=2 (lamps)
      const tipT = track.samples[fc.entryMainStartIdx].t;
      assert.equal(isForkOpeningAtT(track, tipT, branch.side, 0), null);
      assert.equal(isForkOpeningAtT(track, tipT, branch.side, 2)?.id, branch.id);

      // Bollard indices stay strictly within [branchOuterStartIdx, branchOuterEndIdx]
      assert.ok(fc.branchOuterStartIdx + 2 <= fc.branchOuterEndIdx - 2);
      const entryBollardSample = branch.samples[fc.branchOuterStartIdx + 2];
      const bx = entryBollardSample.x + entryBollardSample.rx * sSign * (bw + 0.6);
      const bz = entryBollardSample.z + entryBollardSample.rz * sSign * (bw + 0.6);
      const mainProj = projectOntoTrack(track, bx, bz, fc.entryMainEndIdx, null);
      assert.ok(
        sSign * mainProj.lateralOffset >= mw - 0.1 || mainProj.branchId === branch.id,
        `Bollard on ${mapId} branch ${branch.id} must not stand inside main road lane`
      );

      // Entry and exit throat apron polygons triangulate without losing vertices
      const mainPt = (idx: number, d: number) => {
        const s = track.samples[idx];
        return new THREE.Vector2(s.x + s.rx * sSign * d, s.z + s.rz * sSign * d);
      };
      const bOutPt = (j: number, d: number) => {
        const s = branch.samples[j];
        return new THREE.Vector2(s.x + s.rx * sSign * d, s.z + s.rz * sSign * d);
      };
      const bInPt = (j: number, d: number) => {
        const s = branch.samples[j];
        return new THREE.Vector2(s.x - s.rx * sSign * d, s.z - s.rz * sSign * d);
      };

      const entryPoly: THREE.Vector2[] = [];
      for (let i = fc.entryMainEndIdx; i <= fc.entryMainStartIdx; i++) {
        entryPoly.push(mainPt(i, mw - 0.65));
      }
      entryPoly.push(mainPt(fc.entryMainStartIdx, mw + 0.9));
      entryPoly.push(bInPt(fc.branchInnerStartIdx, bw + 0.9));
      entryPoly.push(bOutPt(fc.branchInnerStartIdx, bw + 0.9));
      for (let j = fc.branchInnerStartIdx - 1; j >= fc.branchOuterStartIdx; j--) {
        entryPoly.push(bOutPt(j, bw + 0.9));
      }
      entryPoly.push(mainPt(fc.entryMainEndIdx, mw + 0.9));
      const entryTris = THREE.ShapeUtils.triangulateShape(entryPoly, []);
      assert.equal(entryTris.length, entryPoly.length - 2);

      const exitPoly: THREE.Vector2[] = [];
      for (let i = fc.exitMainEndIdx; i <= fc.exitMainStartIdx; i++) {
        exitPoly.push(mainPt(i, mw - 0.65));
      }
      exitPoly.push(mainPt(fc.exitMainStartIdx, mw + 0.9));
      for (let j = fc.branchOuterEndIdx; j >= fc.branchInnerEndIdx; j--) {
        exitPoly.push(bOutPt(j, bw + 0.9));
      }
      exitPoly.push(bInPt(fc.branchInnerEndIdx, bw + 0.9));
      exitPoly.push(mainPt(fc.exitMainEndIdx, mw + 0.9));
      const exitTris = THREE.ShapeUtils.triangulateShape(exitPoly, []);
      assert.equal(exitTris.length, exitPoly.length - 2);
    }
  }
});

test('Pursuit police chasers actively pursue player world coordinates (even laterally or behind) and surround-intercept if player stalls', () => {
  const track = createRaceTrack('pursuit-highway');
  const sim = createRaceSimulation(track, true);
  sim.pursuitObstacles = [];
  const player = sim.racers[0];
  const chaser1 = sim.racers.find((r) => r.id === 'police-1')!;
  const chaser2 = sim.racers.find((r) => r.id === 'police-2')!;

  // 1. Place player off-center to the right and verify police chaser steers toward player world coords
  const s = sampleAtT(track, 0.08);
  player.x = s.x + s.rx * 5.2;
  player.z = s.z + s.rz * 5.2;
  player.yaw = s.yaw;
  player.trackT = s.t;
  player.nearestSampleIndex = s.index;
  player.vx = 0;
  player.vz = 0;
  player.speed = 0;

  const sBehind = sampleAtT(track, 0.068);
  chaser1.x = sBehind.x - sBehind.rx * 4.0;
  chaser1.z = sBehind.z - sBehind.rz * 4.0;
  chaser1.yaw = sBehind.yaw;
  chaser1.trackT = sBehind.t;
  chaser1.nearestSampleIndex = sBehind.index;
  chaser1.speed = 18;
  chaser1.vx = Math.sin(sBehind.yaw) * 18;
  chaser1.vz = Math.cos(sBehind.yaw) * 18;

  const inputTowardRightPlayer = computeAiInput(sim, chaser1, 1 / 60);
  // Chaser is left of player (looking forward, player is to its right -> negative yaw delta in right-handed atan2? Check steer sign reduces angleError!)
  assert.ok(
    Math.abs(inputTowardRightPlayer.steer) > 0.25,
    `Chaser should steer aggressively toward player's lane (${inputTowardRightPlayer.steer.toFixed(2)})`
  );

  // If player is BEHIND chaser within close range, chaser initiates U-turn braking/turning rather than ignoring player
  chaser2.x = player.x + Math.sin(player.yaw) * 18;
  chaser2.z = player.z + Math.cos(player.yaw) * 18;
  chaser2.yaw = player.yaw;
  chaser2.trackT = s.t + 0.01;
  chaser2.nearestSampleIndex = Math.min(track.samples.length - 1, s.index + 12);
  chaser2.speed = 24;
  const inputWhenAhead = computeAiInput(sim, chaser2, 1 / 60);
  assert.equal(inputWhenAhead.brake > 0.5, true, 'Chaser ahead of stationary player should brake into tight U-turn');
  assert.ok(Math.abs(inputWhenAhead.steer) > 0.8, 'Chaser ahead should steer sharply back toward player');

  // 2. When police remain separated, surroundTimer must NOT trigger defeat
  const simFree = createRaceSimulation(track, true);
  simFree.pursuitObstacles = [];
  for (let i = 0; i < 120; i++) {
    stepRaceSimulation(simFree, { throttle: 1, brake: 0, steer: 0, nitro: false }, 1 / 60);
  }
  assert.equal(simFree.finished, false);
  assert.equal(simFree.defeatReason, null);
  assert.equal(simFree.surroundTimer, 0);

  // 3. When >= 2 police box player in closely with >= 1 ahead, surround defeat triggers cleanly & stops cars
  const simBoxed = createRaceSimulation(track, true);
  simBoxed.pursuitObstacles = [];
  const bp = simBoxed.racers[0];
  const bs = sampleAtT(track, 0.12);
  const bFwdX = Math.sin(bs.yaw);
  const bFwdZ = Math.cos(bs.yaw);
  const bRightX = -bFwdZ;
  const bRightZ = bFwdX;

  bp.x = bs.x;
  bp.z = bs.z;
  bp.yaw = bs.yaw;
  bp.trackT = bs.t;
  bp.nearestSampleIndex = bs.index;
  bp.vx = 0;
  bp.vz = 0;
  bp.speed = 0;

  const box1 = simBoxed.racers.find((r) => r.id === 'police-1')!;
  const box2 = simBoxed.racers.find((r) => r.id === 'police-2')!;
  const box3 = simBoxed.racers.find((r) => r.id === 'police-3')!;

  box1.x = bp.x + bFwdX * 5.2;
  box1.z = bp.z + bFwdZ * 5.2;
  box1.yaw = bs.yaw;
  box1.speed = 0;
  box1.vx = 0;
  box1.vz = 0;

  box2.x = bp.x - bRightX * 3.1;
  box2.z = bp.z - bRightZ * 3.1;
  box2.yaw = bs.yaw;
  box2.speed = 0;
  box2.vx = 0;
  box2.vz = 0;

  box3.x = bp.x + bRightX * 3.1;
  box3.z = bp.z + bRightZ * 3.1;
  box3.yaw = bs.yaw;
  box3.speed = 0;
  box3.vx = 0;
  box3.vz = 0;

  for (let i = 0; i < 45; i++) {
    stepRaceSimulation(simBoxed, { throttle: 0, brake: 0, steer: 0, nitro: false }, 1 / 60);
    if (simBoxed.finished) break;
  }
  assert.equal(simBoxed.finished, true, 'Police surrounding player closely ahead & sides must trigger defeat');
  assert.equal(simBoxed.winnerId, 'police-1');
  assert.equal(simBoxed.defeatReason, 'surrounded');

  // Step post-finish to verify boxed-in formation comes smoothly to rest
  for (let i = 0; i < 45; i++) {
    stepRaceSimulation(simBoxed, { throttle: 1, brake: 0, steer: 0, nitro: false }, 1 / 60);
  }
  assert.ok(Math.hypot(bp.vx, bp.vz) < 1.0, 'Surrounded player remains halted at intercept site');
});

test('closer enlarged hero landmarks (Stadium, Waterpark, Lighthouse, Rink, Gas Station) stay clear of track & water hazards', () => {
  const dayTrack = createRaceTrack('day-city');
  assert.equal(isTrackPointClear(dayTrack, -52, -18, 66, 4.55), true, 'Daylight Metro Football Stadium plaza must clear track');

  const beachTrack = createRaceTrack('beach');
  assert.equal(isTrackPointClear(beachTrack, -70, -18, 86, 4.55), true, 'Beach Waterpark footprint must clear track');
  assert.equal(isTrackPointClear(beachTrack, -125, -125, 22, 4.55), true, 'Beach Resort must clear track');
  assert.equal(isTrackPointClear(beachTrack, -275, -135, 16, 4.55), true, 'Beach Lighthouse must clear track');

  const iceTrack = createRaceTrack('ice-arena');
  assert.equal(isTrackPointClear(iceTrack, -68, -12, 42, 4.55), true, 'Ice Peaks Skating Rink must clear track');
  const gasSample = sampleAtT(iceTrack, 0.025);
  const gasX = gasSample.x - gasSample.rx * 25.0;
  const gasZ = gasSample.z - gasSample.rz * 25.0;
  assert.equal(isTrackPointClear(iceTrack, gasX, gasZ, 11, 4.55), true, 'Ice Peaks Gas Station must clear track');
  for (const [vx, vz] of [
    [-125, -75],
    [48, -22],
    [16, 118],
    [-258, -118],
    [242, 110],
    [-30, -135],
  ]) {
    assert.equal(isTrackPointClear(iceTrack, vx, vz, 20, 4.55), true, `Ice Peaks village (${vx},${vz}) must clear track`);
  }
});




