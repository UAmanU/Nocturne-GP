import {
  CAR_ROSTER,
  TOTAL_LAPS,
  type BoostPadState,
  type CarAppearance,
  type ConstructionHazardVehicle,
  type GameMode,
  type PursuitObstacle,
  type RacerStanding,
  type RacerState,
  type SandPatchState,
  type WreckingBallState,
} from './types';
import { isPursuitMap } from './garage';
import type { DrivingInput } from './controls';
import {
  createBoostPads,
  createSandPatches,
  getWaterHazardAtT,
  projectOntoTrack,
  sampleAtT,
  sampleBranchAtT,
  sampleSmoothAtT,
  type RaceTrack,
} from './track';

// Tuned GT street-racing parameters (120 km/h base, 165 km/h nitro; 140/185 km/h on ice)
export const PHYSICS_CONFIG = {
  baseMaxSpeed: 120 / 3.6, // 33.333 m/s = 120 km/h without boost
  nitroMaxSpeed: 165 / 3.6, // 45.833 m/s = 165 km/h with boost
  reverseMaxSpeed: 36 / 3.6,
  engineAccel: 12.2,
  nitroAccelBonus: 22.0,
  brakeDecel: 38,
  dragCoeff: 0.0028,
  rollingFriction: 1.35,
  steerRate: 2.45, // rad/s peak steering rate
  lateralGrip: 9.5,
  nitroChargePerMeter: 0.34, // gradual charge across high-speed runs
  nitroDrainPerSec: 22, // ~4.5s continuous nitro burn from 100% -> 0%
  padNitroBonus: 30, // floor boost pad grants +30% Nitro reserve
  padBoostHalfWidth: 2.35,
  padBoostHalfLength: 4.6,
  carRadius: 1.35,
  iceBaseMaxSpeed: 140 / 3.6, // 38.889 m/s = 140 km/h crazy momentum on frozen ice
  iceNitroMaxSpeed: 185 / 3.6, // 51.389 m/s = 185 km/h on ice with boost
  // Pursuit mode tuning
  pursuitPlayerSpeedScale: 1.10, // +10% on both normal & nitro speeds
  pursuitPoliceSpeedScale: 1.10 * 0.95, // 5% slower than player in Pursuit
  playerMaxHp: 200, // +100% max HP (200 HP)
  policeMaxHp: 160, // -20% vs player's 200 HP
  lowHpThreshold: 60, // < 30% HP (60 / 200) slows max speeds
  lowHpNormalScale: 0.80, // -20% normal max speed when < 30% HP
  lowHpNitroScale: 0.85, // -15% nitro max speed when < 30% HP
};

export const COUNTDOWN_SECONDS = 3.0;
export const GRID_INTRO_SECONDS = 3.6; // 4 cars x 0.9s close-up angles before 3-2-1 countdown
export const TOTAL_PRE_RACE_SECONDS = GRID_INTRO_SECONDS + COUNTDOWN_SECONDS;

export interface RaceSimulation {
  mode: GameMode;
  track: RaceTrack;
  racers: RacerState[];
  boostPads: BoostPadState[];
  sandPatches: SandPatchState[];
  constructionVehicles: ConstructionHazardVehicle[];
  wreckingBall: WreckingBallState | null;
  pursuitObstacles: PursuitObstacle[];
  damageTaken: number;
  lastDamageAmount: number;
  damageAlertTimer: number;
  surroundTimer: number;
  defeatReason: 'wrecked' | 'surrounded' | null;
  raceTime: number;
  countdown: number; // 6.6 -> 3.0 (grid showcase), 3.0 -> 0 (3-2-1 countdown)
  postFinishTime: number;
  defeatDriftSign: number;
  finished: boolean;
  winnerId: string | null;
}

export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function createPursuitObstacles(track: RaceTrack): PursuitObstacle[] {
  const obstacles: PursuitObstacle[] = [];
  let nextId = 0;

  // Main route barriers + cones + roadblock trap spreads
  const mainObstacles: Array<{ t: number; kind: 'cone' | 'barrier'; lanes: number[] }> = [
    { t: 0.14, kind: 'cone', lanes: [-0.45, 0.0, 0.45] },
    { t: 0.185, kind: 'barrier', lanes: [-0.38, 0.32] },
    { t: 0.41, kind: 'cone', lanes: [-0.55, 0.0, 0.55] },
    // Roadblock 1 flanking barriers at t=0.44
    { t: 0.436, kind: 'barrier', lanes: [-0.62, 0.62] },
    { t: 0.446, kind: 'cone', lanes: [-0.72, -0.35, 0.35, 0.72] },
    { t: 0.54, kind: 'barrier', lanes: [0.0] },
    { t: 0.72, kind: 'cone', lanes: [-0.4, 0.4] },
    // Roadblock 2 flanking barriers at t=0.78
    { t: 0.776, kind: 'barrier', lanes: [-0.62, 0.62] },
    { t: 0.786, kind: 'cone', lanes: [-0.72, -0.25, 0.25, 0.72] },
    { t: 0.90, kind: 'barrier', lanes: [-0.35, 0.35] },
    { t: 0.94, kind: 'cone', lanes: [-0.5, 0.5] },
  ];

  for (const spec of mainObstacles) {
    const s = sampleAtT(track, spec.t);
    for (const lane of spec.lanes) {
      const lat = lane * track.wallMargin;
      obstacles.push({
        id: nextId++,
        kind: spec.kind,
        x: s.x + s.rx * lat,
        y: 0,
        z: s.z + s.rz * lat,
        yaw: s.yaw,
        pitch: 0,
        roll: 0,
        radius: spec.kind === 'cone' ? 0.95 : 1.75,
        damage: spec.kind === 'cone' ? 3 : 5,
        trackT: spec.t,
        branchId: null,
        knocked: false,
        vx: 0,
        vy: 0,
        vz: 0,
        spinVel: 0,
      });
    }
  }

  // Fast-hard shortcut branches feature dense obstacles (high risk, shorter route)
  for (const branch of track.branches) {
    if (branch.kind !== 'fast-hard') continue;
    const branchTValues = [0.28, 0.52, 0.74];
    branchTValues.forEach((u, bIdx) => {
      const mainT = branch.tStart + u * (branch.tEnd - branch.tStart);
      const bs = sampleBranchAtT(branch, mainT);
      const kind: 'cone' | 'barrier' = bIdx % 2 === 0 ? 'barrier' : 'cone';
      const lat = (bIdx % 2 === 0 ? -0.28 : 0.28) * branch.wallMargin;
      obstacles.push({
        id: nextId++,
        kind,
        x: bs.x + bs.rx * lat,
        y: 0,
        z: bs.z + bs.rz * lat,
        yaw: bs.yaw,
        pitch: 0,
        roll: 0,
        radius: kind === 'cone' ? 0.95 : 1.75,
        damage: kind === 'cone' ? 3 : 5,
        trackT: mainT,
        branchId: branch.id,
        knocked: false,
        vx: 0,
        vy: 0,
        vz: 0,
        spinVel: 0,
      });
    });
  }

  return obstacles;
}

export function createRaceSimulation(
  track: RaceTrack,
  skipCountdown = false,
  playerAppearance?: CarAppearance
): RaceSimulation {
  const isPursuit = isPursuitMap(track.mapId);
  const mode: GameMode = isPursuit ? 'pursuit' : 'race';

  let racers: RacerState[];

  if (isPursuit) {
    const playerSpec = CAR_ROSTER[0];
    const playerSample = sampleAtT(track, 0.042);
    const pPrimary = playerAppearance?.primaryColor ?? playerSpec.primaryColor;
    const pAccent = playerAppearance?.accentColor ?? playerSpec.accentColor;

    const playerCar: RacerState = {
      id: 'player',
      name: 'You (Cargo)',
      isPlayer: true,
      role: 'racer',
      primaryColor: pPrimary,
      accentColor: pAccent,
      number: '01',
      x: playerSample.x,
      z: playerSample.z,
      vx: 0,
      vz: 0,
      yaw: playerSample.yaw,
      speed: 0,
      lateralSpeed: 0,
      steerAngle: 0,
      wheelSpin: 0,
      pitch: 0,
      roll: 0,
      nitro: 45, // start pursuit with partial reserve ready to charge or top up
      isNitroActive: false,
      padBoostTimer: 0,
      padCooldown: 0,
      isBraking: false,
      isDrifting: false,
      isOnSand: false,
      hp: PHYSICS_CONFIG.playerMaxHp,
      maxHp: PHYSICS_CONFIG.playerMaxHp,
      wrecked: false,
      wallHitCooldown: 0,
      ramCooldown: 0,
      justTookDamage: 0,
      trackT: playerSample.t,
      nearestSampleIndex: playerSample.index,
      activeBranchId: null,
      lap: 1,
      highestSector: 0,
      totalProgress: playerSample.t,
      finished: false,
      finishTime: null,
      currentLapStartTime: 0,
      bestLapTime: null,
      lastLapTime: null,
      aiSkill: 1.0,
      preferredLane: 0,
      aiLaneOffset: 0,
      aiNitroCooldown: 1.5,
      justActivatedNitro: false,
      justHitBoostPad: false,
      justCollidedStrength: 0,
      justFellInWater: false,
      waterSplashX: playerSample.x,
      waterSplashZ: playerSample.z,
      justWrecked: false,
      wreckX: playerSample.x,
      wreckZ: playerSample.z,
      wreckReason: null,
      wreckGraceTimer: 0,
    };

    // 3 Chasing Police Cruisers positioned behind the player
    const chaserSpecs = [
      { id: 'police-1', name: 'Interceptor Unit 01', number: 'P1', t: 0.015, lane: -0.32 },
      { id: 'police-2', name: 'Interceptor Unit 02', number: 'P2', t: 0.022, lane: 0.34 },
      { id: 'police-3', name: 'Interceptor Unit 03', number: 'P3', t: 0.028, lane: -0.05 },
    ];

    const chaserCars: RacerState[] = chaserSpecs.map((spec, idx) => {
      const s = sampleAtT(track, spec.t);
      const lat = spec.lane * track.wallMargin;
      const cx = s.x + s.rx * lat;
      const cz = s.z + s.rz * lat;
      return {
        id: spec.id,
        name: spec.name,
        isPlayer: false,
        role: 'police-chaser',
        primaryColor: '#0f172a',
        accentColor: '#3b82f6',
        number: spec.number,
        x: cx,
        z: cz,
        vx: 0,
        vz: 0,
        yaw: s.yaw,
        speed: 0,
        lateralSpeed: 0,
        steerAngle: 0,
        wheelSpin: 0,
        pitch: 0,
        roll: 0,
        nitro: 15 + idx * 10,
        isNitroActive: false,
        padBoostTimer: 0,
        padCooldown: 0,
        isBraking: false,
        isDrifting: false,
        isOnSand: false,
        hp: PHYSICS_CONFIG.policeMaxHp,
        maxHp: PHYSICS_CONFIG.policeMaxHp,
        wrecked: false,
        wallHitCooldown: 0,
        ramCooldown: 0,
        justTookDamage: 0,
        trackT: s.t,
        nearestSampleIndex: s.index,
        activeBranchId: null,
        lap: 1,
        highestSector: 0,
        totalProgress: s.t,
        finished: false,
        finishTime: null,
        currentLapStartTime: 0,
        bestLapTime: null,
        lastLapTime: null,
        aiSkill: 0.96,
        preferredLane: spec.lane,
        aiLaneOffset: lat,
        aiNitroCooldown: 1.0 + idx * 0.4,
        justActivatedNitro: false,
        justHitBoostPad: false,
        justCollidedStrength: 0,
        justFellInWater: false,
        waterSplashX: cx,
        waterSplashZ: cz,
        justWrecked: false,
        wreckX: cx,
        wreckZ: cz,
        wreckReason: null,
        wreckGraceTimer: 0,
      };
    });

    // 2 Stationary Roadblock Police Cruisers blocking the main road ahead (never join the chase!)
    const roadblockSpecs = [
      { id: 'roadblock-1', name: 'Roadblock Unit A', number: 'RB1', t: 0.44, lane: -0.20, angle: 1.15 },
      { id: 'roadblock-2', name: 'Roadblock Unit B', number: 'RB2', t: 0.78, lane: 0.20, angle: -1.15 },
    ];

    const roadblockCars: RacerState[] = roadblockSpecs.map((spec) => {
      const s = sampleAtT(track, spec.t);
      const lat = spec.lane * track.wallMargin;
      const rx = s.x + s.rx * lat;
      const rz = s.z + s.rz * lat;
      return {
        id: spec.id,
        name: spec.name,
        isPlayer: false,
        role: 'police-roadblock',
        primaryColor: '#0f172a',
        accentColor: '#ef4444',
        number: spec.number,
        x: rx,
        z: rz,
        vx: 0,
        vz: 0,
        yaw: normalizeAngle(s.yaw + spec.angle),
        speed: 0,
        lateralSpeed: 0,
        steerAngle: 0,
        wheelSpin: 0,
        pitch: 0,
        roll: 0,
        nitro: 0,
        isNitroActive: false,
        padBoostTimer: 0,
        padCooldown: 0,
        isBraking: false,
        isDrifting: false,
        isOnSand: false,
        hp: PHYSICS_CONFIG.policeMaxHp,
        maxHp: PHYSICS_CONFIG.policeMaxHp,
        wrecked: false,
        wallHitCooldown: 0,
        ramCooldown: 0,
        justTookDamage: 0,
        trackT: s.t,
        nearestSampleIndex: s.index,
        activeBranchId: null,
        lap: 1,
        highestSector: 0,
        totalProgress: s.t,
        finished: false,
        finishTime: null,
        currentLapStartTime: 0,
        bestLapTime: null,
        lastLapTime: null,
        aiSkill: 0,
        preferredLane: spec.lane,
        aiLaneOffset: lat,
        aiNitroCooldown: 999,
        justActivatedNitro: false,
        justHitBoostPad: false,
        justCollidedStrength: 0,
        justFellInWater: false,
        waterSplashX: rx,
        waterSplashZ: rz,
        justWrecked: false,
        wreckX: rx,
        wreckZ: rz,
        wreckReason: null,
        wreckGraceTimer: 0,
      };
    });

    racers = [playerCar, ...chaserCars, ...roadblockCars];
  } else {
    // Standard 4-car Circuit Race grid behind start/finish line
    const gridSlots = [
      { t: 0.974, lane: -0.36 }, // Player (P4)
      { t: 0.992, lane: 0.36 }, // Bot 1 (P1)
      { t: 0.986, lane: -0.36 }, // Bot 2 (P2)
      { t: 0.980, lane: 0.36 }, // Bot 3 (P3)
    ];

    racers = CAR_ROSTER.map((spec, idx) => {
      const slot = gridSlots[idx];
      const sample = sampleAtT(track, slot.t);
      const lateral = slot.lane * track.wallMargin;
      const x = sample.x + sample.rx * lateral;
      const z = sample.z + sample.rz * lateral;
      const primaryColor =
        spec.isPlayer && playerAppearance ? playerAppearance.primaryColor : spec.primaryColor;
      const accentColor =
        spec.isPlayer && playerAppearance ? playerAppearance.accentColor : spec.accentColor;

      return {
        id: spec.id,
        name: spec.name,
        isPlayer: spec.isPlayer,
        role: 'racer',
        primaryColor,
        accentColor,
        number: spec.number,
        x,
        z,
        vx: 0,
        vz: 0,
        yaw: sample.yaw,
        speed: 0,
        lateralSpeed: 0,
        steerAngle: 0,
        wheelSpin: 0,
        pitch: 0,
        roll: 0,
        nitro: 0,
        isNitroActive: false,
        padBoostTimer: 0,
        padCooldown: 0,
        isBraking: false,
        isDrifting: false,
        isOnSand: false,
        hp: PHYSICS_CONFIG.playerMaxHp,
        maxHp: PHYSICS_CONFIG.playerMaxHp,
        wrecked: false,
        wallHitCooldown: 0,
        ramCooldown: 0,
        justTookDamage: 0,
        trackT: slot.t,
        nearestSampleIndex: sample.index,
        activeBranchId: null,
        lap: 1,
        highestSector: -1, // pre-start grid before crossing t=0 first time
        totalProgress: slot.t - 1,
        finished: false,
        finishTime: null,
        currentLapStartTime: 0,
        bestLapTime: null,
        lastLapTime: null,
        aiSkill: spec.aiSkill,
        preferredLane: spec.preferredLane,
        aiLaneOffset: lateral,
        aiNitroCooldown: 1.5 + idx * 0.4,
        justActivatedNitro: false,
        justHitBoostPad: false,
        justCollidedStrength: 0,
        justFellInWater: false,
        waterSplashX: x,
        waterSplashZ: z,
        justWrecked: false,
        wreckX: x,
        wreckZ: z,
        wreckReason: null,
        wreckGraceTimer: 0,
      };
    });
  }

  // Construction Site: 8 heavier patrolling/hunting bulldozers & excavators
  const constructionVehicles: ConstructionHazardVehicle[] =
    track.mapId === 'construction'
      ? [
          { t: 0.09, kind: 'bulldozer' as const, lane: -0.36, dir: 1 as const },
          { t: 0.21, kind: 'excavator' as const, lane: 0.34, dir: -1 as const },
          { t: 0.33, kind: 'bulldozer' as const, lane: 0.05, dir: 1 as const },
          { t: 0.44, kind: 'excavator' as const, lane: -0.32, dir: -1 as const },
          { t: 0.56, kind: 'bulldozer' as const, lane: 0.34, dir: 1 as const },
          { t: 0.67, kind: 'excavator' as const, lane: -0.28, dir: -1 as const },
          { t: 0.78, kind: 'bulldozer' as const, lane: 0.26, dir: 1 as const },
          { t: 0.90, kind: 'excavator' as const, lane: -0.24, dir: -1 as const },
        ].map((spec, idx) => {
          const s = sampleSmoothAtT(track, spec.t);
          const laneOffset = spec.lane * track.wallMargin;
          const baseSpeed = spec.kind === 'bulldozer' ? 6.6 : 5.8;
          return {
            id: idx,
            kind: spec.kind,
            x: s.x + s.rx * laneOffset,
            z: s.z + s.rz * laneOffset,
            yaw: spec.dir > 0 ? s.yaw : normalizeAngle(s.yaw + Math.PI),
            speed: spec.dir * baseSpeed,
            trackT: spec.t,
            baseT: spec.t,
            laneOffset,
            patrolDir: spec.dir,
            dirCooldown: 0,
            armPhase: idx * 1.1,
          };
        })
      : [];

  const wreckingBall: WreckingBallState | null =
    track.mapId === 'construction'
      ? computeWreckingBallState(0, 0, 58.8, 0.35, 0)
      : null;

  const pursuitObstacles = isPursuit ? createPursuitObstacles(track) : [];

  return {
    mode,
    track,
    racers,
    boostPads: createBoostPads(track),
    sandPatches: createSandPatches(track),
    constructionVehicles,
    wreckingBall,
    pursuitObstacles,
    damageTaken: 0,
    lastDamageAmount: 0,
    damageAlertTimer: 0,
    surroundTimer: 0,
    defeatReason: null,
    raceTime: 0,
    countdown: skipCountdown
      ? 0
      : isPursuit
        ? COUNTDOWN_SECONDS
        : TOTAL_PRE_RACE_SECONDS,
    postFinishTime: 0,
    defeatDriftSign: 1,
    finished: false,
    winnerId: null,
  };
}

function computeWreckingBallState(
  pivotX: number,
  pivotZ: number,
  boomLength: number,
  boomYaw: number,
  swingPhase: number
): WreckingBallState {
  const tipX = pivotX + Math.sin(boomYaw) * boomLength;
  const tipZ = pivotZ + Math.cos(boomYaw) * boomLength;
  const tanX = Math.cos(boomYaw);
  const tanZ = -Math.sin(boomYaw);
  const pendulum = Math.sin(swingPhase);
  const swingAmp = 7.2;
  return {
    pivotX,
    pivotZ,
    boomLength,
    boomYaw,
    swingPhase,
    ballX: tipX + tanX * pendulum * swingAmp,
    ballY: 1.9 + Math.abs(pendulum) * 1.35,
    ballZ: tipZ + tanZ * pendulum * swingAmp,
    ballRadius: 4.2,
  };
}

export function computeAiInput(
  sim: RaceSimulation,
  bot: RacerState,
  dt: number
): DrivingInput {
  // Roadblocks never move; wrecked cars coast to a halt
  if (bot.role === 'police-roadblock' || bot.wrecked) {
    return {
      throttle: 0,
      brake: 1,
      steer: 0,
      nitro: false,
      drift: false,
    };
  }

  const { track, racers, boostPads } = sim;
  const isPursuit = sim.mode === 'pursuit';
  const player = racers[0];

  // Active Pursuit Police Chasers hunt the player directly in world space, overtake & surround!
  if (isPursuit && bot.role === 'police-chaser' && player && !player.wrecked) {
    const dxToPlayer = player.x - bot.x;
    const dzToPlayer = player.z - bot.z;
    const distToPlayer = Math.hypot(dxToPlayer, dzToPlayer);
    const pFwdX = Math.sin(player.yaw);
    const pFwdZ = Math.cos(player.yaw);
    const pRightX = -pFwdZ;
    const pRightZ = pFwdX;

    // Assign each interceptor cruiser a tactical surround slot (front cutoff, left flank, right flank)
    const unitNum = bot.id.endsWith('1') ? 0 : bot.id.endsWith('2') ? 1 : 2;
    const slotAhead = unitNum === 0 ? 5.6 : 1.0;
    const slotSide = unitNum === 0 ? 0.0 : unitNum === 1 ? -3.3 : 3.3;

    const leadSec = distToPlayer < 14 ? 0.14 : 0.28;
    const rawTargetX = player.x + player.vx * leadSec + pFwdX * slotAhead + pRightX * slotSide;
    const rawTargetZ = player.z + player.vz * leadSec + pFwdZ * slotAhead + pRightZ * slotSide;

    // Close/mid-range (< 72m): chase player directly in world space (cuts across lanes, reversals & slowdowns)
    // Long-range (>= 72m): follow the player's track corridor/branch smoothly around wide highway turns
    let targetX = rawTargetX;
    let targetZ = rawTargetZ;
    let curvatureForSpeed = 0;

    if (distToPlayer < 72) {
      const targetProj = projectOntoTrack(
        track,
        rawTargetX,
        rawTargetZ,
        player.nearestSampleIndex,
        player.activeBranchId
      );
      if (Math.abs(targetProj.lateralOffset) > targetProj.wallMargin * 0.92 && !targetProj.isInForkOpening) {
        const clampedLat = Math.sign(targetProj.lateralOffset) * targetProj.wallMargin * 0.88;
        targetX = targetProj.nearestX + targetProj.rx * clampedLat;
        targetZ = targetProj.nearestZ + targetProj.rz * clampedLat;
      }
      // Subtle separation from other police cars so all 3 don't stack on top of each other
      for (const other of racers) {
        if (other.id === bot.id || other.role !== 'police-chaser' || other.wrecked) continue;
        const ox = bot.x - other.x;
        const oz = bot.z - other.z;
        const od = Math.hypot(ox, oz);
        if (od > 0.05 && od < 4.2) {
          targetX += (ox / od) * (4.2 - od) * 0.9;
          targetZ += (oz / od) * (4.2 - od) * 0.9;
        }
      }
      const botSample = track.samples[Math.min(track.samples.length - 1, Math.max(0, bot.nearestSampleIndex))];
      curvatureForSpeed = botSample ? botSample.curvature * 0.65 : 0;
    } else {
      let activeSamples = track.samples;
      let activeLength = track.totalLength;
      let refIndex = bot.nearestSampleIndex;
      if (bot.activeBranchId !== null) {
        const b = track.branches.find((br) => br.id === bot.activeBranchId);
        if (b) {
          activeSamples = b.samples;
          activeLength = b.totalLength;
        }
      } else if (player.activeBranchId !== null) {
        const b = track.branches.find((br) => br.id === player.activeBranchId);
        if (b && bot.trackT >= b.tStart - 0.02 && bot.trackT <= b.tEnd) {
          activeSamples = b.samples;
          activeLength = b.totalLength;
          const u = Math.min(1, Math.max(0, (bot.trackT - b.tStart) / Math.max(0.001, b.tEnd - b.tStart)));
          refIndex = Math.round(u * (b.samples.length - 1));
        }
      }
      const n = activeSamples.length;
      const stepMeters = activeLength / n;
      const lookSteps = Math.max(4, Math.round((16 + Math.abs(bot.speed) * 0.45) / stepMeters));
      const chaserAheadOfPlayer = bot.trackT > player.trackT + 0.015;
      const lookIdx = chaserAheadOfPlayer
        ? Math.max(0, refIndex - lookSteps)
        : Math.min(n - 1, refIndex + lookSteps);
      const lookSample = activeSamples[lookIdx];
      targetX = lookSample.x + lookSample.rx * (slotSide * 0.75);
      targetZ = lookSample.z + lookSample.rz * (slotSide * 0.75);
      curvatureForSpeed = lookSample.curvature;
    }

    const toTargetX = targetX - bot.x;
    const toTargetZ = targetZ - bot.z;
    const toTargetDist = Math.hypot(toTargetX, toTargetZ);
    const desiredYaw = Math.atan2(toTargetX, toTargetZ);
    const angleError = normalizeAngle(desiredYaw - bot.yaw);
    const rawSteer = Math.max(-1, Math.min(1, angleError * 2.45));
    const steer = bot.speed < -0.2 ? -rawSteer : rawSteer;

    const playerSpeedMag = Math.hypot(player.vx, player.vz);
    const policeTopBase = PHYSICS_CONFIG.baseMaxSpeed * PHYSICS_CONFIG.pursuitPoliceSpeedScale;
    const policeTopNitro = PHYSICS_CONFIG.nitroMaxSpeed * PHYSICS_CONFIG.pursuitPoliceSpeedScale;
    const cornerCap =
      curvatureForSpeed > 0.01
        ? Math.max(19.0, Math.sqrt(52 / curvatureForSpeed))
        : policeTopNitro;

    // Catch-up speed when behind/chasing, tactical box-in pacing once aligned inside surround slot
    const alongPlayer = (bot.x - player.x) * pFwdX + (bot.z - player.z) * pFwdZ;
    const needsOvertake = alongPlayer < slotAhead - 0.8 || distToPlayer > 11;
    let desiredSpeed = needsOvertake
      ? Math.min(cornerCap, Math.max(policeTopBase * 1.07, playerSpeedMag + 5.5))
      : Math.min(cornerCap, Math.max(6.0, playerSpeedMag * 0.96 + (slotAhead - alongPlayer) * 1.4));

    if (toTargetDist < 3.2 && playerSpeedMag < 8.5) {
      desiredSpeed = Math.max(2.5, playerSpeedMag + 1.5);
    }

    let throttle = 1.0;
    let brake = 0.0;
    if (Math.abs(angleError) > 1.75 && distToPlayer < 45) {
      // Tight U-turn when player reverses/stops behind chaser: shed high speed, then hold ~6 m/s for full steering lock
      if (bot.speed > 6.5) {
        throttle = 0;
        brake = 0.9;
      } else {
        throttle = 0.65;
        brake = 0;
      }
    } else if (bot.speed > desiredSpeed + 3.2) {
      throttle = 0;
      brake = Math.min(1, (bot.speed - desiredSpeed) / 9);
    } else if (bot.speed > desiredSpeed) {
      throttle = 0.35;
    }

    bot.aiNitroCooldown = Math.max(0, bot.aiNitroCooldown - dt);
    const wantsNitro =
      !bot.isNitroActive &&
      bot.aiNitroCooldown <= 0 &&
      Math.abs(angleError) < 0.28 &&
      distToPlayer > 10 &&
      distToPlayer < 85 &&
      needsOvertake &&
      bot.speed > 12 &&
      bot.nitro >= 100;

    if (wantsNitro) {
      bot.aiNitroCooldown = 1.4;
    }

    return {
      throttle,
      brake,
      steer,
      nitro: wantsNitro,
      drift: Math.abs(angleError) > 0.72 && bot.speed > 14,
    };
  }

  // Standard Circuit Race Bots follow sampled racing line
  const activeSamples = track.samples;
  const activeLength = track.totalLength;
  const activeClosed = track.isClosed;
  const refIndex = bot.nearestSampleIndex;
  const activeWallMargin = track.wallMargin;

  const n = activeSamples.length;
  const speedAbs = Math.abs(bot.speed);
  const lookAheadMeters = 18 + speedAbs * 0.52;
  const stepMeters = activeLength / n;
  const lookAheadSteps = Math.max(4, Math.round(lookAheadMeters / stepMeters));

  let maxCurvatureAhead = 0;
  const curveScanSteps = Math.round((28 + speedAbs * 0.8) / stepMeters);
  for (let i = 1; i <= curveScanSteps; i++) {
    const idx = activeClosed ? (refIndex + i) % n : Math.min(n - 1, refIndex + i);
    const s = activeSamples[idx];
    if (s && s.curvature > maxCurvatureAhead) {
      maxCurvatureAhead = s.curvature;
    }
  }

  let targetLane = bot.preferredLane * (activeWallMargin * 0.72);
  const isIceMap = track.mapId === 'ice-arena';

  // On Ice Peaks, steer into safe center of upcoming open-water hazard zones
  let waterZoneAhead = false;
  if (track.waterZones.length > 0) {
    for (const wz of track.waterZones) {
      let dtAhead = wz.tStart - bot.trackT;
      if (dtAhead < 0) dtAhead += 1;
      const inZone = bot.trackT >= wz.tStart - 0.015 && bot.trackT <= wz.tEnd + 0.01;
      if (inZone || (dtAhead >= 0 && dtAhead < 0.085)) {
        targetLane = (wz.safeMinLat + wz.safeMaxLat) * 0.5;
        waterZoneAhead = true;
        break;
      }
    }
  }

  // Aim toward upcoming floor boost pad to replenish Nitro
  if (!waterZoneAhead && bot.nitro < 85 && bot.role === 'racer') {
    for (const pad of boostPads) {
      let dtAhead = pad.trackT - bot.trackT;
      if (dtAhead < 0 && track.isClosed) dtAhead += 1;
      if (dtAhead > 0.015 && dtAhead < 0.075) {
        targetLane = pad.laneOffset;
        break;
      }
    }
  }

  // On Construction Site, steer around road sand patches, heavy machinery, and crane wrecking ball
  let constructionDangerAhead = false;
  if (track.mapId === 'construction') {
    let bestSandDt = Infinity;
    let nearestSand: (typeof sim.sandPatches)[number] | null = null;
    for (const patch of sim.sandPatches) {
      let dT = patch.trackT - bot.trackT;
      if (dT > 0.5) dT -= 1;
      if (dT < -0.5) dT += 1;
      if (dT > -0.008 && dT < 0.055 && dT < bestSandDt) {
        bestSandDt = dT;
        nearestSand = patch;
      }
    }
    if (nearestSand && Math.abs(targetLane - nearestSand.laneOffset) < nearestSand.radiusX + 1.9) {
      const avoidSign =
        Math.abs(nearestSand.laneOffset) > 0.5
          ? -Math.sign(nearestSand.laneOffset)
          : bot.aiLaneOffset >= nearestSand.laneOffset
            ? 1
            : -1;
      targetLane = avoidSign * track.wallMargin * 0.78;
    }

    const fwdX = Math.sin(bot.yaw);
    const fwdZ = Math.cos(bot.yaw);
    const rightX = -fwdZ;
    const rightZ = fwdX;

    let bestVehDt = Infinity;
    let nearestVeh: (typeof sim.constructionVehicles)[number] | null = null;
    for (const veh of sim.constructionVehicles) {
      let dT = veh.trackT - bot.trackT;
      if (dT > 0.5) dT -= 1;
      if (dT < -0.5) dT += 1;
      if (dT > -0.008 && dT < 0.078 && dT < bestVehDt) {
        bestVehDt = dT;
        nearestVeh = veh;
      }
    }
    if (nearestVeh) {
      const botSample = track.samples[bot.nearestSampleIndex];
      const botLat = (bot.x - botSample.x) * botSample.rx + (bot.z - botSample.z) * botSample.rz;
      const sideSign =
        bestVehDt > 0.048 && Math.abs(botLat - nearestVeh.laneOffset) < 1.4 && Math.abs(nearestVeh.laneOffset) > 0.8
          ? -Math.sign(nearestVeh.laneOffset)
          : botLat >= nearestVeh.laneOffset
            ? 1
            : -1;
      targetLane = sideSign * track.wallMargin * 0.9;
      constructionDangerAhead = true;
    }

    if (sim.wreckingBall) {
      const dx = sim.wreckingBall.ballX - bot.x;
      const dz = sim.wreckingBall.ballZ - bot.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < 32 * 32) {
        const ahead = dx * fwdX + dz * fwdZ;
        const side = dx * rightX + dz * rightZ;
        if (ahead > -2 && ahead < 30 && Math.abs(side) < 8.4) {
          const dodgeDir = side >= 0 ? -1 : 1;
          targetLane = dodgeDir * track.wallMargin * 0.88;
          constructionDangerAhead = true;
        }
      }
    }
  }

  // Car-to-car avoidance
  if (!waterZoneAhead && !constructionDangerAhead) {
    for (const other of racers) {
      if (other.id === bot.id) continue;
      const dx = other.x - bot.x;
      const dz = other.z - bot.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > 20 * 20) continue;

      const fwdX = Math.sin(bot.yaw);
      const fwdZ = Math.cos(bot.yaw);
      const rightX = -fwdZ;
      const rightZ = fwdX;
      const aheadDist = dx * fwdX + dz * fwdZ;
      const sideDist = dx * rightX + dz * rightZ;

      if (aheadDist > -1.5 && aheadDist < 16 && Math.abs(sideDist) < 3.6) {
        const dodgeDir = sideDist >= 0 ? -1 : 1;
        targetLane = Math.max(
          -activeWallMargin * 0.78,
          Math.min(activeWallMargin * 0.78, targetLane + dodgeDir * 4.2)
        );
      }
    }
  }

  const laneBlendRate = waterZoneAhead || constructionDangerAhead ? 8.0 : 4.2;
  const laneBlend = 1 - Math.exp(-laneBlendRate * dt);
  bot.aiLaneOffset += (targetLane - bot.aiLaneOffset) * laneBlend;

  const effLookAhead = constructionDangerAhead
    ? Math.max(5, Math.round(lookAheadSteps * 0.62))
    : lookAheadSteps;
  const targetIdx = activeClosed
    ? (refIndex + effLookAhead) % n
    : Math.min(n - 1, refIndex + effLookAhead);
  const targetSample = activeSamples[targetIdx];
  const targetX = targetSample.x + targetSample.rx * bot.aiLaneOffset;
  const targetZ = targetSample.z + targetSample.rz * bot.aiLaneOffset;

  const toTargetX = targetX - bot.x;
  const toTargetZ = targetZ - bot.z;
  const velAngle = speedAbs > 4 ? Math.atan2(bot.vx, bot.vz) : bot.yaw;
  const slipBias = isIceMap ? normalizeAngle(velAngle - bot.yaw) * 0.45 : 0;
  const desiredYaw = Math.atan2(toTargetX, toTargetZ) - slipBias;
  const angleError = normalizeAngle(desiredYaw - bot.yaw);

  const steer = Math.max(-1, Math.min(1, angleError * (isIceMap ? 2.4 : 2.25)));

  const cornerGripFactor = isIceMap ? 20 : 42;
  const modeTopNitro = isIceMap
    ? PHYSICS_CONFIG.iceNitroMaxSpeed
    : PHYSICS_CONFIG.nitroMaxSpeed;
  const modeBase = isIceMap
    ? PHYSICS_CONFIG.iceBaseMaxSpeed * 0.90
    : PHYSICS_CONFIG.baseMaxSpeed;

  const cornerMaxSpeed =
    maxCurvatureAhead > 0.008
      ? Math.max(isIceMap ? 15.0 : 17.5, Math.sqrt(cornerGripFactor / maxCurvatureAhead) * (0.90 + 0.14 * bot.aiSkill))
      : modeTopNitro;

  const desiredSpeed = Math.min(
    modeBase * (0.94 + 0.08 * bot.aiSkill),
    waterZoneAhead ? Math.min(cornerMaxSpeed, 23.0) : cornerMaxSpeed
  );

  let throttle = 1.0;
  let brake = 0.0;

  if (bot.speed > desiredSpeed + 3.5) {
    throttle = 0;
    brake = Math.min(1, (bot.speed - desiredSpeed) / 10);
  } else if (bot.speed > desiredSpeed) {
    throttle = 0.45;
  }

  bot.aiNitroCooldown = Math.max(0, bot.aiNitroCooldown - dt);
  const isStraightEnough = maxCurvatureAhead < 0.024 && Math.abs(angleError) < 0.24 && !waterZoneAhead;
  const wantsNitro =
    !bot.isNitroActive &&
    bot.aiNitroCooldown <= 0 &&
    isStraightEnough &&
    bot.speed > 10 &&
    bot.nitro >= 100;

  if (wantsNitro) {
    bot.aiNitroCooldown = 1.2;
  }

  return {
    throttle,
    brake,
    steer,
    nitro: wantsNitro,
    drift: false,
  };
}

function isCarOnSandPatch(car: RacerState, sandPatches: SandPatchState[]): boolean {
  for (const p of sandPatches) {
    const dx = car.x - p.x;
    const dz = car.z - p.z;
    if (dx * dx + dz * dz > 85) continue;
    const sinY = Math.sin(p.yaw);
    const cosY = Math.cos(p.yaw);
    const along = dx * sinY + dz * cosY;
    const across = -dx * cosY + dz * sinY;
    const nx = across / p.radiusX;
    const nz = along / p.radiusZ;
    if (nx * nx + nz * nz <= 1.0) {
      return true;
    }
  }
  return false;
}

function wreckCarOnConstruction(
  track: RaceTrack,
  car: RacerState,
  reason: 'ball' | 'machinery'
): void {
  car.justWrecked = true;
  car.wreckX = car.x;
  car.wreckZ = car.z;
  car.wreckReason = reason;
  car.wreckGraceTimer = 3.6;

  const backDist = reason === 'ball' ? 0.026 : 0.016;
  const safeT = car.trackT > backDist + 0.008 ? car.trackT - backDist : 0.004;
  const respawnSample = sampleAtT(track, safeT);
  const laneOffset = car.preferredLane * (track.wallMargin * 0.55);
  car.x = respawnSample.x + respawnSample.rx * laneOffset;
  car.z = respawnSample.z + respawnSample.rz * laneOffset;
  car.yaw = respawnSample.yaw;
  car.vx = 0;
  car.vz = 0;
  car.speed = 0;
  car.lateralSpeed = 0;
  car.isNitroActive = false;
  car.padBoostTimer = 0;
  car.isDrifting = false;
  car.isOnSand = false;
  car.nitro = Math.max(0, car.nitro - 25);
  car.trackT = safeT;
  car.nearestSampleIndex = respawnSample.index;
}

function applyPursuitDamage(sim: RaceSimulation, car: RacerState, amount: number): void {
  if (sim.mode !== 'pursuit' || car.wrecked || amount <= 0) return;
  const dmg = Math.round(amount);
  car.hp = Math.max(0, car.hp - dmg);
  car.justTookDamage = Math.max(car.justTookDamage, dmg);
  if (car.isPlayer) {
    sim.damageTaken += dmg;
    sim.lastDamageAmount = dmg;
    sim.damageAlertTimer = 1.1;
  }
  if (car.hp <= 0) {
    car.hp = 0;
    car.wrecked = true;
    car.justWrecked = true;
    car.wreckX = car.x;
    car.wreckZ = car.z;
    car.isNitroActive = false;
  }
}

function stepSingleCar(
  sim: RaceSimulation,
  car: RacerState,
  input: DrivingInput,
  dt: number,
  lateralGripScale = 1
): void {
  const { track, sandPatches } = sim;
  const isPursuit = sim.mode === 'pursuit';

  car.justActivatedNitro = false;
  car.justHitBoostPad = false;
  car.justCollidedStrength = 0;
  car.justFellInWater = false;
  car.justWrecked = false;
  car.justTookDamage = 0;

  car.padBoostTimer = Math.max(0, car.padBoostTimer - dt);
  car.padCooldown = Math.max(0, car.padCooldown - dt);
  car.wreckGraceTimer = Math.max(0, car.wreckGraceTimer - dt);
  car.wallHitCooldown = Math.max(0, car.wallHitCooldown - dt);
  car.ramCooldown = Math.max(0, car.ramCooldown - dt);
  car.isOnSand = sandPatches.length > 0 && isCarOnSandPatch(car, sandPatches);

  // Wrecked cars or parked roadblocks gently come to rest without driving input
  if (car.wrecked || car.role === 'police-roadblock') {
    const damp = Math.exp(-5.5 * dt);
    car.vx *= damp;
    car.vz *= damp;
    car.speed *= damp;
    car.lateralSpeed *= damp;
    if (Math.hypot(car.vx, car.vz) < 0.15) {
      car.vx = 0;
      car.vz = 0;
      car.speed = 0;
      car.lateralSpeed = 0;
    }
    car.x += car.vx * dt;
    car.z += car.vz * dt;
    car.isNitroActive = false;
    car.isDrifting = false;
    car.isBraking = false;
    car.wheelSpin += (car.speed * dt) / 0.36;
    const suspDamp = 1 - Math.exp(-8 * dt);
    car.pitch += (0 - car.pitch) * suspDamp;
    car.roll += (0 - car.roll) * suspDamp;
    return;
  }

  const isIceMap = track.mapId === 'ice-arena';
  const fwdX = Math.sin(car.yaw);
  const fwdZ = Math.cos(car.yaw);
  const rightX = -fwdZ;
  const rightZ = fwdX;

  let vFwd = car.vx * fwdX + car.vz * fwdZ;
  let vLat = car.vx * rightX + car.vz * rightZ;

  const isCtrlDrifting =
    Boolean(input.drift) && vFwd > 4.0 && Math.abs(input.steer) > 0.05;
  car.isDrifting = isCtrlDrifting || (isIceMap && Math.abs(vLat) > 2.4 && Math.abs(vFwd) > 5);
  const preTurnVFwd = vFwd;

  // Track-chargeable Nitro state machine
  if (!car.isNitroActive) {
    if (Math.abs(vFwd) > 0.8) {
      const chargeRate =
        PHYSICS_CONFIG.nitroChargePerMeter + (isCtrlDrifting ? 0.35 : 0);
      car.nitro = Math.min(100, car.nitro + Math.abs(vFwd) * dt * chargeRate);
    }
    if (input.nitro && car.nitro >= 100) {
      car.isNitroActive = true;
      car.justActivatedNitro = true;
    }
  }

  if (car.isNitroActive) {
    car.nitro = Math.max(0, car.nitro - PHYSICS_CONFIG.nitroDrainPerSec * dt);
    if (car.nitro <= 0) {
      car.nitro = 0;
      car.isNitroActive = false;
    }
  }

  const boostActive = car.isNitroActive;

  // Speed caps: Ice Peaks -> Pursuit (+10% player, -5% vs player for police, <30% HP slowdowns) -> Race
  let maxSpd: number;
  if (isIceMap) {
    maxSpd = boostActive ? PHYSICS_CONFIG.iceNitroMaxSpeed : PHYSICS_CONFIG.iceBaseMaxSpeed;
  } else if (isPursuit) {
    const roleScale =
      car.role === 'police-chaser'
        ? PHYSICS_CONFIG.pursuitPoliceSpeedScale
        : PHYSICS_CONFIG.pursuitPlayerSpeedScale;
    const damageScale =
      car.isPlayer && car.hp < PHYSICS_CONFIG.lowHpThreshold
        ? boostActive
          ? PHYSICS_CONFIG.lowHpNitroScale
          : PHYSICS_CONFIG.lowHpNormalScale
        : 1.0;
    const baseCap = boostActive ? PHYSICS_CONFIG.nitroMaxSpeed : PHYSICS_CONFIG.baseMaxSpeed;
    maxSpd = baseCap * roleScale * damageScale;
  } else {
    maxSpd = boostActive ? PHYSICS_CONFIG.nitroMaxSpeed : PHYSICS_CONFIG.baseMaxSpeed;
  }

  const cornerCapScale =
    !isIceMap && !isCtrlDrifting && !boostActive && Math.abs(input.steer) > 0.15
      ? 1 - 0.18 * Math.abs(input.steer)
      : 1;
  const sandSpeedScale = car.isOnSand ? (boostActive ? 0.56 : 0.46) : 1.0;
  const effectiveMaxSpd = maxSpd * cornerCapScale * sandSpeedScale;

  // Progressive torque curve: strong low-end launch, smoothly tapering toward top speed
  const speedRatio = Math.max(0, Math.min(1, vFwd / Math.max(1, effectiveMaxSpd)));
  const torqueMultiplier = boostActive
    ? 1.18 - 0.38 * speedRatio
    : 1.18 - 0.64 * Math.pow(speedRatio, 1.35);
  const surfaceAccelScale = isIceMap ? 1.25 : car.isOnSand ? 0.52 : isPursuit ? 1.08 : 1.0;
  const accelForce =
    PHYSICS_CONFIG.engineAccel * surfaceAccelScale * torqueMultiplier +
    (boostActive ? PHYSICS_CONFIG.nitroAccelBonus * (isIceMap ? 1.15 : 1.0) : 0);

  car.isBraking = input.brake > 0.1 && vFwd > 2;
  const effectiveThrottle =
    boostActive && input.brake === 0 ? Math.max(input.throttle, 0.9) : input.throttle;

  if (effectiveThrottle > 0 && vFwd < effectiveMaxSpd) {
    vFwd = Math.min(effectiveMaxSpd, vFwd + effectiveThrottle * accelForce * dt);
  }

  if (input.brake > 0) {
    if (vFwd > 1.0) {
      vFwd -= input.brake * PHYSICS_CONFIG.brakeDecel * (isIceMap ? 0.34 : 1.0) * dt;
    } else {
      vFwd = Math.max(
        -PHYSICS_CONFIG.reverseMaxSpeed,
        vFwd - input.brake * (PHYSICS_CONFIG.engineAccel * 0.65) * dt
      );
    }
  }

  if (!isIceMap && !isCtrlDrifting && Math.abs(input.steer) > 0.15 && vFwd > 6.5) {
    const cornerScrub =
      Math.abs(input.steer) * (vFwd / PHYSICS_CONFIG.baseMaxSpeed) * 14.5;
    vFwd = Math.max(4.0, vFwd - cornerScrub * dt);
  } else if ((isCtrlDrifting || isIceMap) && effectiveThrottle > 0.2) {
    vFwd = Math.max(vFwd, preTurnVFwd * (1 - 0.08 * dt));
  }

  const dragScale = isIceMap ? 0.42 : car.isOnSand ? 4.4 : 1.0;
  const rollingScale = isIceMap ? 0.12 : car.isOnSand ? 3.8 : 1.0;
  const drag =
    PHYSICS_CONFIG.dragCoeff * dragScale * vFwd * Math.abs(vFwd) +
    Math.sign(vFwd) *
      PHYSICS_CONFIG.rollingFriction *
      rollingScale *
      (input.throttle === 0 ? 1.15 : 0.35);
  if (Math.abs(vFwd) > 0.25) {
    vFwd -= drag * dt;
  } else if (input.throttle === 0 && input.brake === 0) {
    vFwd = 0;
  }

  // Gradually bleed off overspeed (e.g. after Nitro ends or entering sand/corners)
  if (vFwd > effectiveMaxSpd) {
    const rate = car.isOnSand
      ? 7.5
      : boostActive
        ? 6.0
        : isIceMap
          ? 0.55
          : !isCtrlDrifting && Math.abs(input.steer) > 0.15
            ? 3.5
            : 0.85;
    vFwd += (effectiveMaxSpd - vFwd) * Math.min(1, rate * dt);
  }

  const targetSteerAngle = input.steer * (isCtrlDrifting ? 0.52 : 0.42);
  car.steerAngle += (targetSteerAngle - car.steerAngle) * (1 - Math.exp(-14 * dt));

  const speedFactor = Math.min(1, Math.abs(vFwd) / 7.5);
  const highSpeedStability = isIceMap
    ? 1.0
    : 1 - 0.28 * Math.min(1, Math.abs(vFwd) / PHYSICS_CONFIG.nitroMaxSpeed);
  const reverseFlip = vFwd >= -0.2 ? 1 : -1;
  const driftTurnMultiplier = isCtrlDrifting ? 1.48 : isIceMap ? 1.32 : 1.0;
  const iceYawJitter =
    isIceMap && Math.abs(input.steer) > 0.1 && Math.abs(vFwd) > 12
      ? Math.sign(input.steer) * 0.42 * (Math.abs(vFwd) / PHYSICS_CONFIG.iceBaseMaxSpeed)
      : 0;
  const yawDelta =
    (input.steer *
      PHYSICS_CONFIG.steerRate *
      driftTurnMultiplier *
      speedFactor *
      highSpeedStability *
      reverseFlip +
      iceYawJitter) *
    dt;
  car.yaw = normalizeAngle(car.yaw + yawDelta);

  const newFwdX = Math.sin(car.yaw);
  const newFwdZ = Math.cos(car.yaw);
  const newRightX = -newFwdZ;
  const newRightZ = newFwdX;

  const surfaceGripScale = isIceMap ? lateralGripScale * 0.105 : lateralGripScale;
  const effectiveGripScale = isCtrlDrifting ? surfaceGripScale * 0.24 : surfaceGripScale;

  if (isIceMap) {
    const worldVx = car.vx + newFwdX * (vFwd - preTurnVFwd);
    const worldVz = car.vz + newFwdZ * (vFwd - preTurnVFwd);
    const rotFwd = worldVx * newFwdX + worldVz * newFwdZ;
    const rotLat = worldVx * newRightX + worldVz * newRightZ;
    vFwd = rotFwd;
    vLat = rotLat;
  } else if (isCtrlDrifting) {
    const slipPush = -input.steer * Math.min(6.5, vFwd * 0.26);
    vLat += (slipPush - vLat) * Math.min(1, 7.5 * dt);
  }
  vLat *= Math.exp(-PHYSICS_CONFIG.lateralGrip * effectiveGripScale * dt);

  car.vx = newFwdX * vFwd + newRightX * vLat;
  car.vz = newFwdZ * vFwd + newRightZ * vLat;
  car.x += car.vx * dt;
  car.z += car.vz * dt;

  car.speed = vFwd;
  car.lateralSpeed = vLat;
  car.wheelSpin += (vFwd * dt) / 0.36;

  const targetPitch =
    (boostActive ? -0.055 : input.throttle > 0 ? -0.025 : 0) + (car.isBraking ? 0.045 : 0);
  const targetRoll = -input.steer * speedFactor * (isCtrlDrifting || isIceMap ? 0.095 : 0.065);
  const suspDamp = 1 - Math.exp(-10 * dt);
  car.pitch += (targetPitch - car.pitch) * suspDamp;
  car.roll += (targetRoll - car.roll) * suspDamp;

  // Track boundary projection (multi-path aware for Pursuit forks!)
  const proj = projectOntoTrack(
    track,
    car.x,
    car.z,
    car.nearestSampleIndex,
    car.activeBranchId
  );
  car.nearestSampleIndex = proj.sampleIndex;
  car.activeBranchId = proj.branchId;

  const waterZone = getWaterHazardAtT(track, proj.t);
  const leftIsOpenWater = waterZone !== null && (waterZone.side === 'left' || waterZone.side === 'both');
  const rightIsOpenWater = waterZone !== null && (waterZone.side === 'right' || waterZone.side === 'both');

  if (
    waterZone &&
    ((leftIsOpenWater && proj.lateralOffset < waterZone.safeMinLat - 0.65) ||
      (rightIsOpenWater && proj.lateralOffset > waterZone.safeMaxLat + 0.65))
  ) {
    car.justFellInWater = true;
    car.waterSplashX = car.x;
    car.waterSplashZ = car.z;

    const startSample = sampleAtT(track, 0.004);
    const laneOffset = car.preferredLane * (track.wallMargin * 0.5);
    car.x = startSample.x + startSample.rx * laneOffset;
    car.z = startSample.z + startSample.rz * laneOffset;
    car.yaw = startSample.yaw;
    car.vx = 0;
    car.vz = 0;
    car.speed = 0;
    car.lateralSpeed = 0;
    car.isNitroActive = false;
    car.padBoostTimer = 0;
    car.isDrifting = false;
    car.trackT = 0.004;
    car.nearestSampleIndex = startSample.index;
    car.highestSector = car.highestSector === -1 ? -1 : 0;
    return;
  }

  const hitsWall =
    !proj.isInForkOpening &&
    ((proj.lateralOffset < -proj.wallMargin && !leftIsOpenWater) ||
      (proj.lateralOffset > proj.wallMargin && !rightIsOpenWater));

  if (hitsWall) {
    const sign = Math.sign(proj.lateralOffset);
    const clampedLat = sign * proj.wallMargin;
    car.x = proj.nearestX + proj.rx * clampedLat;
    car.z = proj.nearestZ + proj.rz * clampedLat;

    const vAlongTrack = car.vx * proj.tx + car.vz * proj.tz;
    const vOutward = (car.vx * proj.rx + car.vz * proj.rz) * sign;
    if (vOutward > 0) {
      const impact = Math.min(1, vOutward / 18);
      if (impact > 0.12) {
        car.justCollidedStrength = Math.max(car.justCollidedStrength, impact);
      }
      // Pursuit mode: hitting road curb / guardrail removes 3-8 HP depending on speed & angle
      if (isPursuit && car.wallHitCooldown <= 0 && vOutward > 2.2) {
        const wallDmg = Math.min(8, Math.max(3, Math.round(3 + impact * 5)));
        applyPursuitDamage(sim, car, wallDmg);
        car.wallHitCooldown = 0.55;
      }
      const wallSpeed = vAlongTrack * Math.max(0.62, 0.94 - impact * 0.28);
      car.vx = proj.tx * wallSpeed - proj.rx * sign * 1.2;
      car.vz = proj.tz * wallSpeed - proj.rz * sign * 1.2;
      car.speed = car.vx * newFwdX + car.vz * newFwdZ;
    }

    const yawDiff = normalizeAngle(proj.yaw - car.yaw);
    if (Math.abs(yawDiff) > 0.35) {
      car.yaw = normalizeAngle(car.yaw + yawDiff * Math.min(1, 5 * dt));
    }
  }

  const prevT = car.trackT;
  car.trackT = proj.t;

  if (!track.isClosed) {
    car.highestSector = Math.min(3, Math.floor(car.trackT * 4));
    return;
  }

  const sector = Math.min(3, Math.floor(car.trackT * 4));
  if (car.highestSector === -1) {
    if (prevT > 0.75 && car.trackT < 0.25) {
      car.highestSector = 0;
    }
  } else {
    if (sector === car.highestSector + 1) {
      car.highestSector = sector;
    }
    if (car.highestSector === 3 && prevT > 0.75 && car.trackT < 0.25) {
      car.highestSector = 0;
      return;
    }
  }
}

export function stepRaceSimulation(
  sim: RaceSimulation,
  playerInput: DrivingInput,
  dt: number,
  resetPlayerRequested = false
): void {
  if (sim.countdown > 0) {
    sim.countdown = Math.max(0, sim.countdown - Math.min(dt, 1.0));
    return;
  }

  const clampedDt = Math.min(dt, 0.05);
  const isPursuit = sim.mode === 'pursuit';
  sim.damageAlertTimer = Math.max(0, sim.damageAlertTimer - clampedDt);

  // Animate any flying knocked Pursuit cones/barriers
  if (sim.pursuitObstacles.length > 0) {
    for (const obs of sim.pursuitObstacles) {
      if (!obs.knocked) continue;
      obs.x += obs.vx * clampedDt;
      obs.z += obs.vz * clampedDt;
      obs.y += obs.vy * clampedDt;
      obs.vy -= 18.0 * clampedDt;
      if (obs.y <= 0) {
        obs.y = 0;
        obs.vy = Math.abs(obs.vy) > 2.2 ? -obs.vy * 0.35 : 0;
        obs.vx *= 0.82;
        obs.vz *= 0.82;
        obs.spinVel *= 0.75;
      }
      obs.pitch = Math.min(Math.PI * 0.48, obs.pitch + obs.spinVel * clampedDt);
      obs.roll += obs.spinVel * 0.7 * clampedDt;
    }
  }

  if (sim.finished) {
    sim.postFinishTime += clampedDt;
    for (const car of sim.racers) {
      if (car.isPlayer) {
        if (sim.winnerId === car.id) {
          // Victory flyby: rocket swiftly past the fixed finish/extraction camera using Nitro
          if (sim.postFinishTime < 2.2 && !car.isNitroActive) {
            car.nitro = 100;
            car.isNitroActive = true;
          }
          let winSteer = 0;
          if (sim.track.isClosed) {
            winSteer = computeAiInput(sim, car, clampedDt).steer;
          } else {
            const endYaw = sim.track.samples[sim.track.samples.length - 1].yaw;
            winSteer = Math.max(-0.5, Math.min(0.5, normalizeAngle(endYaw - car.yaw) * 1.5));
          }
          const winInput: DrivingInput = {
            throttle: 1.0,
            brake: 0,
            steer: winSteer,
            nitro: true,
          };
          car.isDrifting = false;
          stepSingleCar(sim, car, winInput, clampedDt);
        } else if (sim.defeatReason === 'surrounded') {
          const stopDamp = Math.exp(-7.5 * clampedDt);
          car.vx *= stopDamp;
          car.vz *= stopDamp;
          car.speed *= stopDamp;
          car.lateralSpeed *= stopDamp;
          if (Math.hypot(car.vx, car.vz) < 0.2) {
            car.vx = 0;
            car.vz = 0;
            car.speed = 0;
            car.lateralSpeed = 0;
          }
          car.x += car.vx * clampedDt;
          car.z += car.vz * clampedDt;
          car.isDrifting = false;
          car.isNitroActive = false;
          car.isBraking = Math.hypot(car.vx, car.vz) > 0.25;
          car.wheelSpin += (car.speed * clampedDt) / 0.36;
          const suspDamp = 1 - Math.exp(-8 * clampedDt);
          car.pitch += (0 - car.pitch) * suspDamp;
          car.roll += (0 - car.roll) * suspDamp;
        } else {
          // Defeat: player's car kicks out into a short controlled drift and stops
          const speedMag = Math.hypot(car.vx, car.vz);
          if (sim.postFinishTime < 1.35 && speedMag > 1.8) {
            car.isDrifting = true;
            if (sim.postFinishTime < 0.62) {
              car.yaw = normalizeAngle(car.yaw + sim.defeatDriftSign * 1.15 * clampedDt);
            }
            const driftInput: DrivingInput = {
              throttle: 0,
              brake: speedMag > 5 ? 0.72 : 1.0,
              steer: -sim.defeatDriftSign * 0.85,
              nitro: false,
              drift: false,
            };
            stepSingleCar(sim, car, driftInput, clampedDt, 0.16);
            car.isDrifting = true;
          } else {
            const stopDamp = Math.exp(-6.5 * clampedDt);
            car.vx *= stopDamp;
            car.vz *= stopDamp;
            car.speed *= stopDamp;
            car.lateralSpeed *= stopDamp;
            if (Math.hypot(car.vx, car.vz) < 0.25) {
              car.vx = 0;
              car.vz = 0;
              car.speed = 0;
              car.lateralSpeed = 0;
            }
            car.isDrifting = false;
            car.isBraking = Math.abs(car.speed) > 0.25;
            car.wheelSpin += (car.speed * clampedDt) / 0.36;
            const suspDamp = 1 - Math.exp(-8 * clampedDt);
            car.pitch += (0 - car.pitch) * suspDamp;
            car.roll += (0 - car.roll) * suspDamp;
          }
        }
      } else if (
        sim.defeatReason === 'surrounded' &&
        car.role === 'police-chaser' &&
        Math.hypot(car.x - sim.racers[0].x, car.z - sim.racers[0].z) < 16
      ) {
        const stopDamp = Math.exp(-6.8 * clampedDt);
        car.vx *= stopDamp;
        car.vz *= stopDamp;
        car.speed *= stopDamp;
        car.lateralSpeed *= stopDamp;
        if (Math.hypot(car.vx, car.vz) < 0.2) {
          car.vx = 0;
          car.vz = 0;
          car.speed = 0;
          car.lateralSpeed = 0;
        }
        car.x += car.vx * clampedDt;
        car.z += car.vz * clampedDt;
        car.isDrifting = false;
        car.isNitroActive = false;
        car.isBraking = Math.hypot(car.vx, car.vz) > 0.25;
        car.wheelSpin += (car.speed * clampedDt) / 0.36;
        const suspDamp = 1 - Math.exp(-8 * clampedDt);
        car.pitch += (0 - car.pitch) * suspDamp;
        car.roll += (0 - car.roll) * suspDamp;
      } else {
        car.isDrifting = false;
        const aiInput = computeAiInput(sim, car, clampedDt);
        stepSingleCar(sim, car, aiInput, clampedDt);
      }
    }
    return;
  }

  sim.raceTime += clampedDt;

  if (resetPlayerRequested) {
    const player = sim.racers[0];
    const sample = sampleAtT(sim.track, player.trackT);
    player.x = sample.x;
    player.z = sample.z;
    player.yaw = sample.yaw;
    player.vx = 0;
    player.vz = 0;
    player.speed = 0;
    player.activeBranchId = null;
  }

  // Step Construction Site hazards (faster sweeping wrecking ball + 8 aggressive excavators/bulldozers)
  if (sim.track.mapId === 'construction') {
    if (sim.wreckingBall) {
      const nextYaw = normalizeAngle(sim.wreckingBall.boomYaw + clampedDt * 0.72);
      const nextPhase = sim.wreckingBall.swingPhase + clampedDt * 3.0;
      sim.wreckingBall = computeWreckingBallState(
        sim.wreckingBall.pivotX,
        sim.wreckingBall.pivotZ,
        sim.wreckingBall.boomLength,
        nextYaw,
        nextPhase
      );
    }

    const SECTOR_TURN = 0.038;
    const SECTOR_PURSUIT_LIMIT = 0.030;
    for (const veh of sim.constructionVehicles) {
      veh.armPhase += clampedDt * 2.8;
      veh.dirCooldown = Math.max(0, veh.dirCooldown - clampedDt);

      let targetCar: RacerState | null = null;
      let bestDistSq = 34 * 34;
      for (const car of sim.racers) {
        if (car.finished || car.wreckGraceTimer > 0) continue;
        const dx = car.x - veh.x;
        const dz = car.z - veh.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          targetCar = car;
        }
      }

      const maxLat = sim.track.wallMargin - 0.85;
      let targetLane = Math.sin(veh.armPhase * 0.45 + veh.id) * maxLat * 0.62;
      let targetSpeedMag = veh.kind === 'bulldozer' ? 6.6 : 5.8;

      let offBase = veh.trackT - veh.baseT;
      if (offBase > 0.5) offBase -= 1;
      if (offBase < -0.5) offBase += 1;

      if (offBase > SECTOR_TURN && veh.patrolDir > 0) {
        veh.patrolDir = -1;
        veh.dirCooldown = 1.4;
      } else if (offBase < -SECTOR_TURN && veh.patrolDir < 0) {
        veh.patrolDir = 1;
        veh.dirCooldown = 1.4;
      } else if (targetCar) {
        const carProj = projectOntoTrack(
          sim.track,
          targetCar.x,
          targetCar.z,
          targetCar.nearestSampleIndex
        );
        let dT = carProj.t - veh.trackT;
        if (dT > 0.5) dT -= 1;
        if (dT < -0.5) dT += 1;

        targetLane = Math.max(-maxLat, Math.min(maxLat, carProj.lateralOffset));
        targetSpeedMag = veh.kind === 'bulldozer' ? 9.2 : 8.0;

        if (
          veh.dirCooldown <= 0 &&
          Math.abs(offBase) < SECTOR_PURSUIT_LIMIT &&
          Math.abs(dT) > 0.008
        ) {
          const desiredDir: 1 | -1 = dT > 0 ? 1 : -1;
          if (desiredDir !== veh.patrolDir) {
            veh.patrolDir = desiredDir;
            veh.dirCooldown = 1.8;
          }
        }
      }

      const desiredSignedSpeed = veh.patrolDir * targetSpeedMag;
      const speedAccel = 13.0;
      const speedDelta = desiredSignedSpeed - veh.speed;
      const maxSpeedStep = speedAccel * clampedDt;
      if (Math.abs(speedDelta) <= maxSpeedStep) {
        veh.speed = desiredSignedSpeed;
      } else {
        veh.speed += Math.sign(speedDelta) * maxSpeedStep;
      }

      veh.trackT = (veh.trackT + (veh.speed * clampedDt) / sim.track.totalLength + 1) % 1;

      const moveFactor = Math.min(1, Math.abs(veh.speed) / 2.6);
      const laneRate = (targetCar ? 1.25 : 0.75) * (0.15 + 0.85 * moveFactor);
      const laneStep = (targetLane - veh.laneOffset) * Math.min(1, clampedDt * laneRate);
      veh.laneOffset = Math.max(-maxLat, Math.min(maxLat, veh.laneOffset + laneStep));

      const vs = sampleSmoothAtT(sim.track, veh.trackT);
      const nextX = vs.x + vs.rx * veh.laneOffset;
      const nextZ = vs.z + vs.rz * veh.laneOffset;
      const dx = nextX - veh.x;
      const dz = nextZ - veh.z;
      const stepDist = Math.hypot(dx, dz);

      if (stepDist > 0.004 && Math.abs(veh.speed) > 0.65) {
        const desiredYaw = Math.atan2(dx, dz);
        const yawDiff = normalizeAngle(desiredYaw - veh.yaw);
        const maxYawStep = 3.8 * clampedDt;
        if (Math.abs(yawDiff) <= maxYawStep) {
          veh.yaw = desiredYaw;
        } else {
          veh.yaw = normalizeAngle(veh.yaw + Math.sign(yawDiff) * maxYawStep);
        }
      }
      veh.x = nextX;
      veh.z = nextZ;
    }
  }

  // Step all vehicles
  for (const car of sim.racers) {
    const prevLapReady = car.highestSector === 3;
    const prevT = car.trackT;

    const input = car.isPlayer
      ? playerInput
      : computeAiInput(sim, car, clampedDt);

    stepSingleCar(sim, car, input, clampedDt, 1);

    // Check Construction Site lethal/disabling collisions
    if (sim.track.mapId === 'construction' && !car.finished && car.wreckGraceTimer <= 0) {
      if (sim.wreckingBall && sim.wreckingBall.ballY <= 5.5) {
        const dx = car.x - sim.wreckingBall.ballX;
        const dz = car.z - sim.wreckingBall.ballZ;
        const hitRadius = sim.wreckingBall.ballRadius + 1.25;
        if (dx * dx + dz * dz <= hitRadius * hitRadius) {
          wreckCarOnConstruction(sim.track, car, 'ball');
        }
      }
      if (!car.justWrecked) {
        for (const veh of sim.constructionVehicles) {
          const dx = car.x - veh.x;
          const dz = car.z - veh.z;
          if (dx * dx + dz * dz <= 2.45 * 2.45) {
            wreckCarOnConstruction(sim.track, car, 'machinery');
            break;
          }
        }
      }
    }

    if (isPursuit) {
      car.totalProgress = car.trackT;
      if (car.isPlayer && !car.wrecked && car.trackT >= 0.992 && !sim.finished) {
        car.finished = true;
        car.finishTime = sim.raceTime;
        sim.finished = true;
        sim.winnerId = car.id;
        sim.postFinishTime = 0;
        car.nitro = 100;
        car.isNitroActive = true;
      }
      continue;
    }

    // Closed-circuit lap completion check
    if (prevLapReady && prevT > 0.75 && car.trackT < 0.25 && car.highestSector === 0) {
      const lapDuration = sim.raceTime - car.currentLapStartTime;
      car.lastLapTime = lapDuration;
      if (car.bestLapTime === null || lapDuration < car.bestLapTime) {
        car.bestLapTime = lapDuration;
      }
      car.currentLapStartTime = sim.raceTime;
      car.lap += 1;

      if (car.lap > TOTAL_LAPS && !car.finished) {
        car.finished = true;
        car.finishTime = sim.raceTime;
        if (!sim.finished) {
          sim.finished = true;
          sim.winnerId = car.id;
          sim.postFinishTime = 0;
          const player = sim.racers[0];
          if (car.isPlayer) {
            player.nitro = 100;
            player.isNitroActive = true;
          } else {
            const pProj = projectOntoTrack(sim.track, player.x, player.z, player.nearestSampleIndex);
            sim.defeatDriftSign = pProj.lateralOffset > 0.5 ? -1 : 1;
          }
        }
      }
    }

    if (car.finished) {
      car.totalProgress = TOTAL_LAPS + 1 + (1000 - (car.finishTime ?? sim.raceTime));
    } else if (car.highestSector === -1) {
      car.totalProgress = car.trackT - 1;
    } else {
      const lapBase = car.lap - 1;
      const effectiveT =
        car.highestSector === 0 && car.trackT > 0.75 ? car.trackT - 1 : car.trackT;
      car.totalProgress = lapBase + effectiveT;
    }
  }

  // Pursuit knockable obstacles (cones & roadblock barriers) — police cars pass cleanly through!
  if (isPursuit && sim.pursuitObstacles.length > 0) {
    const player = sim.racers[0];
    if (!player.wrecked) {
      for (const obs of sim.pursuitObstacles) {
        if (obs.knocked) continue;
        const dx = obs.x - player.x;
        const dz = obs.z - player.z;
        const hitR = PHYSICS_CONFIG.carRadius + obs.radius * 0.72;
        if (dx * dx + dz * dz <= hitR * hitR) {
          obs.knocked = true;
          const speedMag = Math.max(8, Math.hypot(player.vx, player.vz));
          const len = Math.max(0.1, Math.hypot(dx, dz));
          obs.vx = (dx / len) * speedMag * 0.8 + player.vx * 0.65;
          obs.vz = (dz / len) * speedMag * 0.8 + player.vz * 0.65;
          obs.vy = 4.2 + Math.min(4.5, speedMag * 0.14);
          obs.spinVel = 8.5;

          applyPursuitDamage(sim, player, obs.damage);
          player.justCollidedStrength = Math.max(player.justCollidedStrength, 0.45);

          // Gradual slowdown when smashing cones/barriers without active Nitro
          if (!player.isNitroActive) {
            const obsScrub = obs.kind === 'barrier' ? 0.78 : 0.90;
            player.vx *= obsScrub;
            player.vz *= obsScrub;
            player.speed *= obsScrub;
          }
        }
      }
    }
  }

  // Car-to-car elastic collision separation & Pursuit ramming HP damage
  const minSep = PHYSICS_CONFIG.carRadius * 2;
  const minSepSq = minSep * minSep;
  for (let i = 0; i < sim.racers.length; i++) {
    for (let j = i + 1; j < sim.racers.length; j++) {
      const a = sim.racers[i];
      const b = sim.racers[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dSq = dx * dx + dz * dz;
      if (dSq > 0.0001 && dSq < minSepSq) {
        const d = Math.sqrt(dSq);
        const nx = dx / d;
        const nz = dz / d;
        const overlap = (minSep - d) * 0.5;
        // Stationary/wrecked roadblock takes more displacement when smashed by Nitro car
        const aShare = a.role === 'police-roadblock' ? 0.85 : b.role === 'police-roadblock' ? 0.15 : 0.5;
        const bShare = 1 - aShare;
        a.x -= nx * overlap * 2 * aShare;
        a.z -= nz * overlap * 2 * aShare;
        b.x += nx * overlap * 2 * bShare;
        b.z += nz * overlap * 2 * bShare;

        const rvx = b.vx - a.vx;
        const rvz = b.vz - a.vz;
        const velAlongNormal = rvx * nx + rvz * nz;
        if (velAlongNormal < 0) {
          const closingSpeed = Math.abs(velAlongNormal);
          const impulse = closingSpeed * 0.65;
          a.vx -= nx * impulse;
          a.vz -= nz * impulse;
          b.vx += nx * impulse;
          b.vz += nz * impulse;
          const strength = Math.min(1, closingSpeed / 20);
          a.justCollidedStrength = Math.max(a.justCollidedStrength, strength);
          b.justCollidedStrength = Math.max(b.justCollidedStrength, strength);

          // Pursuit car-to-car ramming HP rules (10-20 HP normally, 40 HP with Nitro)
          if (isPursuit && !a.wrecked && !b.wrecked && (a.ramCooldown <= 0 || b.ramCooldown <= 0)) {
            const baseRam = Math.min(20, Math.max(10, Math.round(10 + Math.min(1, closingSpeed / 22) * 10)));
            const aPush = a.vx * nx + a.vz * nz;
            const bPush = -(b.vx * nx + b.vz * nz);

            let dmgToB = a.isNitroActive ? 40 : baseRam;
            let dmgToA = b.isNitroActive ? 40 : baseRam;

            // Player blasting through a roadblock/cruiser with Nitro blasts target for 40 HP while shrugging most impact
            if (a.isNitroActive && !b.isNitroActive && aPush >= bPush) {
              dmgToB = 40;
              dmgToA = b.role === 'police-roadblock' ? 5 : Math.round(baseRam * 0.5);
            } else if (b.isNitroActive && !a.isNitroActive && bPush >= aPush) {
              dmgToA = 40;
              dmgToB = a.role === 'police-roadblock' ? 5 : Math.round(baseRam * 0.5);
            }

            if (a.ramCooldown <= 0) {
              applyPursuitDamage(sim, a, dmgToA);
              a.ramCooldown = 0.55;
            }
            if (b.ramCooldown <= 0) {
              applyPursuitDamage(sim, b, dmgToB);
              b.ramCooldown = 0.55;
            }
          }
        }
      }
    }
  }

  // Check Pursuit defeat when player HP reaches 0 OR when police overtake & surround the player nearby
  if (isPursuit && !sim.finished) {
    const player = sim.racers[0];
    if (player.hp <= 0) {
      player.hp = 0;
      player.wrecked = true;
      sim.finished = true;
      sim.winnerId = 'police-1';
      sim.defeatReason = 'wrecked';
      sim.postFinishTime = 0;
      const pProj = projectOntoTrack(
        sim.track,
        player.x,
        player.z,
        player.nearestSampleIndex,
        player.activeBranchId
      );
      sim.defeatDriftSign = pProj.lateralOffset > 0.5 ? -1 : 1;
    } else if (!player.wrecked) {
      const pFwdX = Math.sin(player.yaw);
      const pFwdZ = Math.cos(player.yaw);
      let nearbyCount = 0;
      let aheadCount = 0;
      for (let i = 1; i < sim.racers.length; i++) {
        const pol = sim.racers[i];
        if ((pol.role !== 'police-chaser' && pol.role !== 'police-roadblock') || pol.wrecked) {
          continue;
        }
        const dx = pol.x - player.x;
        const dz = pol.z - player.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= 11.5) {
          nearbyCount++;
          const alongFwd = dx * pFwdX + dz * pFwdZ;
          if (alongFwd > 0.5 || pol.trackT > player.trackT + 0.0012) {
            aheadCount++;
          }
        }
      }

      if (nearbyCount >= 2 && aheadCount >= 1) {
        const rate = Math.abs(player.speed) < 15 ? 1.55 : 1.0;
        sim.surroundTimer += clampedDt * rate;
        if (sim.surroundTimer >= 0.68) {
          sim.finished = true;
          sim.winnerId = 'police-1';
          sim.defeatReason = 'surrounded';
          sim.postFinishTime = 0;
          player.speed = 0;
          player.vx *= 0.2;
          player.vz *= 0.2;
          const pProj = projectOntoTrack(
            sim.track,
            player.x,
            player.z,
            player.nearestSampleIndex,
            player.activeBranchId
          );
          sim.defeatDriftSign = pProj.lateralOffset > 0.5 ? -1 : 1;
        }
      } else {
        sim.surroundTimer = Math.max(0, sim.surroundTimer - clampedDt * 1.35);
      }
    }
  }

  // Floor boost pad checks: ONLY replenish +30% Nitro reserve (no immediate speed surge!)
  for (const pad of sim.boostPads) {
    const padFwdX = Math.sin(pad.yaw);
    const padFwdZ = Math.cos(pad.yaw);
    const padRightX = -padFwdZ;
    const padRightZ = padFwdX;

    for (const car of sim.racers) {
      if (car.padCooldown > 0 || car.wrecked || car.role === 'police-roadblock') continue;
      const dx = car.x - pad.x;
      const dz = car.z - pad.z;
      const along = Math.abs(dx * padFwdX + dz * padFwdZ);
      const across = Math.abs(dx * padRightX + dz * padRightZ);
      if (
        along <= PHYSICS_CONFIG.padBoostHalfLength &&
        across <= PHYSICS_CONFIG.padBoostHalfWidth
      ) {
        car.nitro = Math.min(100, car.nitro + PHYSICS_CONFIG.padNitroBonus);
        car.padCooldown = 0.85;
        car.justHitBoostPad = true;
      }
    }
  }
}

export function getStandings(racers: RacerState[]): RacerStanding[] {
  const sorted = [...racers].sort((a, b) => b.totalProgress - a.totalProgress);
  return sorted.map((r, idx) => ({
    id: r.id,
    name: r.name,
    isPlayer: r.isPlayer,
    primaryColor: r.primaryColor,
    accentColor: r.accentColor,
    number: r.number,
    position: idx + 1,
    lap: Math.min(TOTAL_LAPS, r.lap),
    finished: r.finished,
    finishTime: r.finishTime,
    bestLapTime: r.bestLapTime,
    totalProgress: r.totalProgress,
  }));
}
