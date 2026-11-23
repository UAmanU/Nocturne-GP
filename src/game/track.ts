import * as THREE from 'three';
import { isPursuitMap } from './garage';
import type { BoostPadState, MapId, SandPatchState } from './types';

export interface TrackSample {
  index: number;
  t: number; // [0, 1]
  x: number;
  z: number;
  tx: number; // unit tangent X
  tz: number; // unit tangent Z
  rx: number; // unit right X (driver's right)
  rz: number; // unit right Z (driver's right)
  yaw: number; // heading yaw matching forward = (sin(yaw), 0, cos(yaw))
  curvature: number; // unsigned curvature (rad / meter)
  arcLength: number; // cumulative meters from start
}

export interface WaterHazardZone {
  id: number;
  tStart: number;
  tEnd: number;
  side: 'left' | 'right' | 'both';
  safeMinLat: number;
  safeMaxLat: number;
}

export interface BranchForkCut {
  entryMainEndIdx: number; // e0: main wall stops before entry opening
  entryMainStartIdx: number; // e1: main wall resumes at gore entry tip
  exitMainEndIdx: number; // x0: main wall stops at gore exit tail
  exitMainStartIdx: number; // x1: main wall resumes after exit opening
  branchOuterStartIdx: number; // first branch sample whose outer wall clears main wall
  branchOuterEndIdx: number; // last branch sample whose outer wall clears main wall
  branchInnerStartIdx: number; // first branch sample whose inner wall clears main wall
  branchInnerEndIdx: number; // last branch sample whose inner wall clears main wall
}

export interface TrackBranch {
  id: number;
  kind: 'fast-hard' | 'long-safe';
  label: string;
  tStart: number;
  tEnd: number;
  side: 'left' | 'right';
  halfWidth: number;
  wallMargin: number;
  totalLength: number;
  samples: TrackSample[];
  forkCut: BranchForkCut;
}

export interface TrackProjection {
  sampleIndex: number;
  t: number;
  nearestX: number;
  nearestZ: number;
  tx: number;
  tz: number;
  rx: number;
  rz: number;
  yaw: number;
  lateralOffset: number; // signed distance along right vector (+ right, - left)
  distanceSq: number;
  branchId: number | null;
  wallMargin: number;
  isInForkOpening: boolean;
}

export interface RaceTrack {
  mapId: MapId;
  isClosed: boolean;
  curve: THREE.CatmullRomCurve3;
  samples: TrackSample[];
  branches: TrackBranch[];
  waterZones: WaterHazardZone[];
  totalLength: number;
  roadWidth: number;
  halfWidth: number;
  wallMargin: number;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

// 1. Midnight City (~1560m enlarged neon GP loop weaving past central skyline towers & harbor)
const NIGHT_CITY_POINTS: Array<[number, number, number]> = [
  [-183, 0, 36],
  [-183, 0, -108],
  [-132, 0, -186],
  [-15, 0, -207],
  [102, 0, -195],
  [186, 0, -129],
  [198, 0, -36],
  [117, 0, 12],
  [192, 0, 93],
  [159, 0, 177],
  [57, 0, 201],
  [-51, 0, 162],
  [-132, 0, 195],
  [-183, 0, 144],
  [-183, 0, 87],
];

// 2. Coral Beach (~1825m enlarged scenic coastal loop hugging Coral Resort, mega Waterpark & beach games)
const BEACH_POINTS: Array<[number, number, number]> = [
  [-215, 0, 46],
  [-215, 0, -122],
  [-165, 0, -215],
  [-35, 0, -244],
  [90, 0, -212],
  [148, 0, -122],
  [133, 0, -23],
  [209, 0, 38],
  [174, 0, 142],
  [64, 0, 122],
  [-41, 0, 194],
  [-139, 0, 197],
  [-206, 0, 154],
  [-215, 0, 99],
];

// 3. Daylight Metro (~1590m enlarged sunlit downtown avenue winding past shops, colorful blocks & sky-blue towers)
const DAY_CITY_POINTS: Array<[number, number, number]> = [
  [-180, 0, 39],
  [-180, 0, -114],
  [-144, 0, -201],
  [-36, 0, -213],
  [69, 0, -159],
  [168, 0, -189],
  [213, 0, -102],
  [186, 0, 6],
  [108, 0, 42],
  [186, 0, 123],
  [126, 0, 201],
  [12, 0, 198],
  [-93, 0, 168],
  [-174, 0, 162],
  [-180, 0, 93],
];

// 4. Ice Peaks Arena (~1650m enlarged frozen glacier circuit with open arctic water hazards)
const ICE_ARENA_POINTS: Array<[number, number, number]> = [
  [-186, 0, 42],
  [-186, 0, -99],
  [-129, 0, -189],
  [-18, 0, -210],
  [99, 0, -186],
  [183, 0, -105],
  [186, 0, 9],
  [108, 0, 51],
  [177, 0, 135],
  [96, 0, 201],
  [-21, 0, 198],
  [-129, 0, 189],
  [-183, 0, 138],
  [-186, 0, 90],
];

// 5. Skyscraper Construction Site (~1530m enlarged downtown street build passing twice beneath central crane)
const CONSTRUCTION_POINTS: Array<[number, number, number]> = [
  [-183, 0, 42],
  [-183, 0, -102],
  [-138, 0, -183],
  [-63, 0, -156],
  [0, 0, -58.5],
  [102, 0, -144],
  [189, 0, -72],
  [186, 0, 33],
  [126, 0, 93],
  [42, 0, 42],
  [-21, 0, 153],
  [-129, 0, 186],
  [-183, 0, 135],
  [-183, 0, 87],
];

// 6. Pursuit Map 1: Midnight Freeway (~2550m enlarged open point-to-point night expressway)
const PURSUIT_HIGHWAY_POINTS: Array<[number, number, number]> = [
  [-448, 0, 378],
  [-448, 0, 182],
  [-448, 0, -28],
  [-413, 0, -245],
  [-259, 0, -357],
  [-42, 0, -371],
  [161, 0, -315],
  [329, 0, -371],
  [469, 0, -259],
  [462, 0, -42],
  [287, 0, 84],
  [168, 0, 203],
  [301, 0, 343],
  [497, 0, 364],
  [658, 0, 294],
];

// 7. Pursuit Map 2: Harbor Docks Run (~2650m enlarged open night port corridor)
const PURSUIT_DOCKS_POINTS: Array<[number, number, number]> = [
  [-504, 0, 322],
  [-504, 0, 105],
  [-490, 0, -133],
  [-343, 0, -315],
  [-133, 0, -343],
  [63, 0, -245],
  [259, 0, -343],
  [462, 0, -294],
  [518, 0, -84],
  [364, 0, 56],
  [189, 0, 133],
  [231, 0, 315],
  [434, 0, 392],
  [630, 0, 350],
  [728, 0, 196],
];

// 8. Pursuit Map 3: Refinery Alley (~2600m enlarged open industrial sector escape)
const PURSUIT_INDUSTRIAL_POINTS: Array<[number, number, number]> = [
  [-406, 0, 406],
  [-441, 0, 203],
  [-385, 0, 0],
  [-455, 0, -217],
  [-308, 0, -371],
  [-77, 0, -329],
  [133, 0, -371],
  [343, 0, -294],
  [483, 0, -126],
  [385, 0, 63],
  [196, 0, 154],
  [161, 0, 322],
  [357, 0, 399],
  [560, 0, 364],
  [693, 0, 245],
];

const MAP_CONTROL_POINTS: Record<MapId, Array<[number, number, number]>> = {
  'night-city': NIGHT_CITY_POINTS,
  beach: BEACH_POINTS,
  'day-city': DAY_CITY_POINTS,
  'ice-arena': ICE_ARENA_POINTS,
  construction: CONSTRUCTION_POINTS,
  'pursuit-highway': PURSUIT_HIGHWAY_POINTS,
  'pursuit-docks': PURSUIT_DOCKS_POINTS,
  'pursuit-industrial': PURSUIT_INDUSTRIAL_POINTS,
};

const SAMPLE_COUNT = 900;
export const TRACK_ROAD_WIDTH = 16.8;
export const PURSUIT_ROAD_WIDTH = 18.0;

export function getWaterHazardAtT(
  track: RaceTrack,
  t: number
): WaterHazardZone | null {
  if (track.waterZones.length === 0) return null;
  const wrapped = track.isClosed ? ((t % 1) + 1) % 1 : Math.min(1, Math.max(0, t));
  for (const wz of track.waterZones) {
    if (wrapped >= wz.tStart && wrapped <= wz.tEnd) {
      return wz;
    }
  }
  return null;
}

function buildSampleArrayFromCurve(
  curve: THREE.CatmullRomCurve3,
  sampleCount: number,
  isClosed: boolean,
  tMin = 0,
  tMax = 1
): { samples: TrackSample[]; totalLength: number } {
  const totalLength = curve.getLength();
  const rawPoints: THREE.Vector3[] = [];
  const rawTangents: THREE.Vector3[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const u = isClosed ? i / sampleCount : i / (sampleCount - 1);
    rawPoints.push(curve.getPointAt(u));
    rawTangents.push(curve.getTangentAt(u).setY(0).normalize());
  }

  const samples: TrackSample[] = [];
  let cumulativeArc = 0;

  for (let i = 0; i < sampleCount; i++) {
    const p = rawPoints[i];
    const tan = rawTangents[i];
    const prevIdx = isClosed ? (i - 1 + sampleCount) % sampleCount : Math.max(0, i - 1);
    const nextIdx = isClosed ? (i + 1) % sampleCount : Math.min(sampleCount - 1, i + 1);
    const prevTan = rawTangents[prevIdx];
    const nextTan = rawTangents[nextIdx];

    if (i > 0) {
      cumulativeArc += p.distanceTo(rawPoints[i - 1]);
    }

    const yaw = Math.atan2(tan.x, tan.z);
    const rx = -tan.z;
    const rz = tan.x;

    let dYaw = Math.atan2(nextTan.x, nextTan.z) - Math.atan2(prevTan.x, prevTan.z);
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    const stepSpan = isClosed ? 2 : Math.max(1, nextIdx - prevIdx);
    const stepLen = (totalLength / sampleCount) * stepSpan;
    const curvature = Math.abs(dYaw) / Math.max(stepLen, 0.001);

    const u = isClosed ? i / sampleCount : i / (sampleCount - 1);
    samples.push({
      index: i,
      t: tMin + u * (tMax - tMin),
      x: p.x,
      z: p.z,
      tx: tan.x,
      tz: tan.z,
      rx,
      rz,
      yaw,
      curvature,
      arcLength: cumulativeArc,
    });
  }

  return { samples, totalLength };
}

interface BranchSpec {
  kind: 'fast-hard' | 'long-safe';
  label: string;
  tStart: number;
  tEnd: number;
  lateralPush: number; // + right, - left relative to main curve midpoint
  chordBlend: number; // 0 = follow main + lateralPush (detour), 1 = straight chord (shortcut)
  halfWidth: number;
}

const PURSUIT_BRANCH_SPECS: Record<string, BranchSpec[]> = {
  'pursuit-highway': [
    {
      kind: 'fast-hard',
      label: 'Express Cut',
      tStart: 0.22,
      tEnd: 0.36,
      lateralPush: 34,
      chordBlend: 0.85,
      halfWidth: 6.2,
    },
    {
      kind: 'long-safe',
      label: 'Outer Bypass',
      tStart: 0.56,
      tEnd: 0.70,
      lateralPush: -48,
      chordBlend: 0.0,
      halfWidth: 8.2,
    },
  ],
  'pursuit-docks': [
    {
      kind: 'long-safe',
      label: 'Pier Loop',
      tStart: 0.20,
      tEnd: 0.34,
      lateralPush: -48,
      chordBlend: 0.0,
      halfWidth: 8.2,
    },
    {
      kind: 'fast-hard',
      label: 'Cargo Alley',
      tStart: 0.48,
      tEnd: 0.62,
      lateralPush: 32,
      chordBlend: 0.85,
      halfWidth: 6.1,
    },
    {
      kind: 'long-safe',
      label: 'Harbor Apron',
      tStart: 0.74,
      tEnd: 0.86,
      lateralPush: 46,
      chordBlend: 0.0,
      halfWidth: 8.2,
    },
  ],
  'pursuit-industrial': [
    {
      kind: 'fast-hard',
      label: 'Foundry Cut',
      tStart: 0.24,
      tEnd: 0.38,
      lateralPush: 34,
      chordBlend: 0.88,
      halfWidth: 6.1,
    },
    {
      kind: 'long-safe',
      label: 'Perimeter Road',
      tStart: 0.50,
      tEnd: 0.64,
      lateralPush: -50,
      chordBlend: 0.0,
      halfWidth: 8.2,
    },
    {
      kind: 'fast-hard',
      label: 'Pipeway',
      tStart: 0.75,
      tEnd: 0.88,
      lateralPush: 30,
      chordBlend: 0.82,
      halfWidth: 6.2,
    },
  ],
};

function nearestMainIndexAndLat(
  mainSamples: TrackSample[],
  px: number,
  pz: number,
  minIdx: number,
  maxIdx: number
): { idx: number; lat: number } {
  let bestIdx = minIdx;
  let bestDistSq = Infinity;
  for (let i = minIdx; i <= maxIdx; i++) {
    const s = mainSamples[i];
    const dx = px - s.x;
    const dz = pz - s.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = i;
    }
  }
  const s = mainSamples[bestIdx];
  const lat = (px - s.x) * s.rx + (pz - s.z) * s.rz;
  return { idx: bestIdx, lat };
}

function buildBranchFromMain(
  id: number,
  spec: BranchSpec,
  mainSamples: TrackSample[],
  isClosed: boolean,
  mainHalfWidth: number
): TrackBranch {
  const sampleMain = (t: number) => {
    const idx = Math.min(
      mainSamples.length - 1,
      Math.max(0, Math.round(t * (mainSamples.length - 1)))
    );
    return mainSamples[idx];
  };

  const s0 = sampleMain(spec.tStart);
  const sLead = sampleMain(spec.tStart + 0.014);
  const sMid1 = sampleMain(spec.tStart + (spec.tEnd - spec.tStart) * 0.35);
  const sMid = sampleMain(spec.tStart + (spec.tEnd - spec.tStart) * 0.5);
  const sMid2 = sampleMain(spec.tStart + (spec.tEnd - spec.tStart) * 0.65);
  const sTrail = sampleMain(spec.tEnd - 0.014);
  const s1 = sampleMain(spec.tEnd);

  const chordX1 = THREE.MathUtils.lerp(s0.x, s1.x, 0.35);
  const chordZ1 = THREE.MathUtils.lerp(s0.z, s1.z, 0.35);
  const chordXm = THREE.MathUtils.lerp(s0.x, s1.x, 0.5);
  const chordZm = THREE.MathUtils.lerp(s0.z, s1.z, 0.5);
  const chordX2 = THREE.MathUtils.lerp(s0.x, s1.x, 0.65);
  const chordZ2 = THREE.MathUtils.lerp(s0.z, s1.z, 0.65);

  const p1x = THREE.MathUtils.lerp(sMid1.x, chordX1, spec.chordBlend) + sMid1.rx * spec.lateralPush * 0.72;
  const p1z = THREE.MathUtils.lerp(sMid1.z, chordZ1, spec.chordBlend) + sMid1.rz * spec.lateralPush * 0.72;
  const pmx = THREE.MathUtils.lerp(sMid.x, chordXm, spec.chordBlend) + sMid.rx * spec.lateralPush;
  const pmz = THREE.MathUtils.lerp(sMid.z, chordZm, spec.chordBlend) + sMid.rz * spec.lateralPush;
  const p2x = THREE.MathUtils.lerp(sMid2.x, chordX2, spec.chordBlend) + sMid2.rx * spec.lateralPush * 0.72;
  const p2z = THREE.MathUtils.lerp(sMid2.z, chordZ2, spec.chordBlend) + sMid2.rz * spec.lateralPush * 0.72;

  const sideSign = spec.lateralPush >= 0 ? 1 : -1;
  const leadPush = Math.max(4.5, mainHalfWidth * 0.62);
  const pts = [
    new THREE.Vector3(s0.x, 0, s0.z),
    new THREE.Vector3(sLead.x + sLead.rx * sideSign * leadPush, 0, sLead.z + sLead.rz * sideSign * leadPush),
    new THREE.Vector3(p1x, 0, p1z),
    new THREE.Vector3(pmx, 0, pmz),
    new THREE.Vector3(p2x, 0, p2z),
    new THREE.Vector3(sTrail.x + sTrail.rx * sideSign * leadPush, 0, sTrail.z + sTrail.rz * sideSign * leadPush),
    new THREE.Vector3(s1.x, 0, s1.z),
  ];

  const branchCurve = new THREE.CatmullRomCurve3(pts, isClosed, 'catmullrom', 0.45);
  const { samples, totalLength } = buildSampleArrayFromCurve(
    branchCurve,
    140,
    false,
    spec.tStart,
    spec.tEnd
  );

  const midBranchIdx = Math.floor(samples.length / 2);
  const midBranch = samples[midBranchIdx];
  const latAtMid = (midBranch.x - sMid.x) * sMid.rx + (midBranch.z - sMid.z) * sMid.rz;
  const side: 'left' | 'right' = latAtMid >= 0 ? 'right' : 'left';
  const branchSideSign = side === 'right' ? 1 : -1;

  // Compute exact geometric intersection between branch walls and main road wall
  const nMain = mainSamples.length;
  const searchMinIdx = Math.max(0, Math.floor((spec.tStart - 0.04) * (nMain - 1)));
  const searchMaxIdx = Math.min(nMain - 1, Math.ceil((spec.tEnd + 0.04) * (nMain - 1)));
  const mainWallOff = mainHalfWidth + 0.85;
  const branchWallOff = spec.halfWidth + 0.85;

  const bLen = samples.length;
  const outLat = new Float64Array(bLen);
  const outMainIdx = new Int32Array(bLen);
  const inLat = new Float64Array(bLen);
  const inMainIdx = new Int32Array(bLen);

  for (let j = 0; j < bLen; j++) {
    const bs = samples[j];
    const ox = bs.x + bs.rx * branchSideSign * branchWallOff;
    const oz = bs.z + bs.rz * branchSideSign * branchWallOff;
    const oProj = nearestMainIndexAndLat(mainSamples, ox, oz, searchMinIdx, searchMaxIdx);
    outLat[j] = branchSideSign * oProj.lat;
    outMainIdx[j] = oProj.idx;

    const ix = bs.x - bs.rx * branchSideSign * branchWallOff;
    const iz = bs.z - bs.rz * branchSideSign * branchWallOff;
    const iProj = nearestMainIndexAndLat(mainSamples, ix, iz, searchMinIdx, searchMaxIdx);
    inLat[j] = branchSideSign * iProj.lat;
    inMainIdx[j] = iProj.idx;
  }

  // Walk outward from branch midpoint so outer & inner segments are guaranteed strictly outside main road
  let branchOuterStartIdx = midBranchIdx;
  while (branchOuterStartIdx > 1 && outLat[branchOuterStartIdx - 1] > mainWallOff + 0.15) {
    branchOuterStartIdx--;
  }
  let branchOuterEndIdx = midBranchIdx;
  while (branchOuterEndIdx < bLen - 2 && outLat[branchOuterEndIdx + 1] > mainWallOff + 0.15) {
    branchOuterEndIdx++;
  }

  let branchInnerStartIdx = midBranchIdx;
  while (branchInnerStartIdx > branchOuterStartIdx + 2 && inLat[branchInnerStartIdx - 1] > mainWallOff + 0.85) {
    branchInnerStartIdx--;
  }
  let branchInnerEndIdx = midBranchIdx;
  while (branchInnerEndIdx < branchOuterEndIdx - 2 && inLat[branchInnerEndIdx + 1] > mainWallOff + 0.85) {
    branchInnerEndIdx++;
  }

  const entryMainEndIdx = Math.max(0, outMainIdx[branchOuterStartIdx]);
  const entryMainStartIdx = Math.max(entryMainEndIdx + 3, inMainIdx[branchInnerStartIdx]);
  const exitMainStartIdx = Math.min(nMain - 1, outMainIdx[branchOuterEndIdx]);
  const exitMainEndIdx = Math.min(exitMainStartIdx - 3, Math.max(entryMainStartIdx + 4, inMainIdx[branchInnerEndIdx]));

  return {
    id,
    kind: spec.kind,
    label: spec.label,
    tStart: spec.tStart,
    tEnd: spec.tEnd,
    side,
    halfWidth: spec.halfWidth,
    wallMargin: spec.halfWidth - 1.05,
    totalLength,
    samples,
    forkCut: {
      entryMainEndIdx,
      entryMainStartIdx,
      exitMainEndIdx,
      exitMainStartIdx,
      branchOuterStartIdx,
      branchOuterEndIdx,
      branchInnerStartIdx,
      branchInnerEndIdx,
    },
  };
}

export function createRaceTrack(mapId: MapId = 'night-city'): RaceTrack {
  const isPursuit = isPursuitMap(mapId);
  const isClosed = !isPursuit;
  const controlPts = MAP_CONTROL_POINTS[mapId] ?? NIGHT_CITY_POINTS;
  const vectors = controlPts.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(vectors, isClosed, 'catmullrom', 0.45);
  const { samples, totalLength } = buildSampleArrayFromCurve(curve, SAMPLE_COUNT, isClosed, 0, 1);

  const roadWidth = isPursuit ? PURSUIT_ROAD_WIDTH : TRACK_ROAD_WIDTH;
  const halfWidth = roadWidth / 2;
  const wallMargin = halfWidth - 1.15;

  const branches: TrackBranch[] = (PURSUIT_BRANCH_SPECS[mapId] ?? []).map((spec, idx) =>
    buildBranchFromMain(idx, spec, samples, false, halfWidth)
  );

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of samples) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  for (const b of branches) {
    for (const p of b.samples) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
  }

  // (roadWidth/halfWidth/wallMargin computed above before branch build)

  const waterZones: WaterHazardZone[] =
    mapId === 'ice-arena'
      ? [
          {
            id: 0,
            tStart: 0.145,
            tEnd: 0.205,
            side: 'left',
            safeMinLat: -2.4,
            safeMaxLat: wallMargin,
          },
          {
            id: 1,
            tStart: 0.355,
            tEnd: 0.415,
            side: 'left',
            safeMinLat: -2.4,
            safeMaxLat: wallMargin,
          },
          {
            id: 2,
            tStart: 0.675,
            tEnd: 0.735,
            side: 'both',
            safeMinLat: -4.2,
            safeMaxLat: 4.2,
          },
        ]
      : [];

  return {
    mapId,
    isClosed,
    curve,
    samples,
    branches,
    waterZones,
    totalLength,
    roadWidth,
    halfWidth,
    wallMargin,
    bounds: {
      minX: minX - 32,
      maxX: maxX + 32,
      minZ: minZ - 32,
      maxZ: maxZ + 32,
    },
  };
}

export function isForkOpeningAtT(
  track: RaceTrack,
  t: number,
  side: 'left' | 'right',
  padSamples = 0
): TrackBranch | null {
  if (track.branches.length === 0) return null;
  const n = track.samples.length;
  const idx = track.isClosed
    ? Math.floor((((t % 1) + 1) % 1) * n) % n
    : Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))));
  for (const b of track.branches) {
    if (b.side !== side) continue;
    const fc = b.forkCut;
    if (
      (idx >= fc.entryMainEndIdx - padSamples && idx < fc.entryMainStartIdx + padSamples) ||
      (idx >= fc.exitMainEndIdx - padSamples && idx < fc.exitMainStartIdx + padSamples)
    ) {
      return b;
    }
  }
  return null;
}

export function isTrackPointClear(
  track: RaceTrack,
  x: number,
  z: number,
  radius: number,
  sidewalkMargin = 4.55
): boolean {
  const mainClearSq = Math.pow(
    track.halfWidth + sidewalkMargin + radius + 1.0,
    2
  );
  for (let i = 0; i < track.samples.length; i += 2) {
    const s = track.samples[i];
    const dx = x - s.x;
    const dz = z - s.z;
    if (dx * dx + dz * dz < mainClearSq) return false;
  }
  for (const b of track.branches) {
    const bClearSq = Math.pow(
      b.halfWidth + sidewalkMargin + radius + 2.5,
      2
    );
    for (let i = 0; i < b.samples.length; i++) {
      const s = b.samples[i];
      const dx = x - s.x;
      const dz = z - s.z;
      if (dx * dx + dz * dz < bClearSq) return false;
    }
  }
  return true;
}

function projectSampleList(
  samples: TrackSample[],
  totalLength: number,
  isClosed: boolean,
  x: number,
  z: number,
  hintIndex?: number
): {
  bestIdx: number;
  bestDistSq: number;
  t: number;
  nearestX: number;
  nearestZ: number;
  tx: number;
  tz: number;
  rx: number;
  rz: number;
  yaw: number;
  lateralOffset: number;
} {
  const n = samples.length;
  let bestIdx = 0;
  let bestDistSq = Infinity;

  if (hintIndex !== undefined && hintIndex >= 0 && hintIndex < n) {
    const windowRadius = 48;
    for (let offset = -windowRadius; offset <= windowRadius; offset++) {
      const idx = isClosed
        ? (hintIndex + offset + n) % n
        : Math.min(n - 1, Math.max(0, hintIndex + offset));
      const s = samples[idx];
      const dx = x - s.x;
      const dz = z - s.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = idx;
      }
    }
  }

  if (hintIndex === undefined || bestDistSq > 28 * 28) {
    bestDistSq = Infinity;
    for (let i = 0; i < n; i++) {
      const s = samples[i];
      const dx = x - s.x;
      const dz = z - s.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }
  }

  const s = samples[bestIdx];
  const dx = x - s.x;
  const dz = z - s.z;
  const along = dx * s.tx + dz * s.tz;
  const nearestX = s.x + s.tx * along;
  const nearestZ = s.z + s.tz * along;
  const lateralOffset = dx * s.rx + dz * s.rz;

  const stepArc = totalLength / n;
  let t: number;
  if (isClosed) {
    t = ((bestIdx + along / stepArc) / n + 1) % 1;
  } else {
    const tFirst = samples[0].t;
    const tLast = samples[n - 1].t;
    const u = Math.min(1, Math.max(0, (bestIdx + along / stepArc) / (n - 1)));
    t = tFirst + u * (tLast - tFirst);
  }

  return {
    bestIdx,
    bestDistSq,
    t,
    nearestX,
    nearestZ,
    tx: s.tx,
    tz: s.tz,
    rx: s.rx,
    rz: s.rz,
    yaw: s.yaw,
    lateralOffset,
  };
}

export function projectOntoTrack(
  track: RaceTrack,
  x: number,
  z: number,
  hintIndex?: number,
  hintBranchId: number | null = null
): TrackProjection {
  const mainHint = hintBranchId === null ? hintIndex : undefined;
  const mainProj = projectSampleList(
    track.samples,
    track.totalLength,
    track.isClosed,
    x,
    z,
    mainHint
  );

  // Check if car is currently closer to / inside an active branch road
  if (track.branches.length > 0) {
    let bestBranch: TrackBranch | null = null;
    let bestBranchProj: ReturnType<typeof projectSampleList> | null = null;

    for (const branch of track.branches) {
      if (mainProj.t < branch.tStart - 0.035 || mainProj.t > branch.tEnd + 0.035) {
        continue;
      }
      const bHint = hintBranchId === branch.id ? hintIndex : undefined;
      const bProj = projectSampleList(
        branch.samples,
        branch.totalLength,
        false,
        x,
        z,
        bHint
      );

      // Prefer branch once car commits toward the branch side past the fork throat
      const inThroat =
        bProj.t <= branch.tStart + 0.02 || bProj.t >= branch.tEnd - 0.02;
      const committedToBranch = inThroat
        ? hintBranchId === branch.id ||
          (branch.side === 'right' && mainProj.lateralOffset > 2.2) ||
          (branch.side === 'left' && mainProj.lateralOffset < -2.2)
        : bProj.bestDistSq < mainProj.bestDistSq;

      if (committedToBranch && bProj.bestDistSq < mainProj.bestDistSq + 18) {
        if (!bestBranchProj || bProj.bestDistSq < bestBranchProj.bestDistSq) {
          bestBranch = branch;
          bestBranchProj = bProj;
        }
      }
    }

    if (bestBranch && bestBranchProj) {
      const bIdx = bestBranchProj.bestIdx;
      const fc = bestBranch.forkCut;
      const onInnerSide =
        (bestBranch.side === 'right' && bestBranchProj.lateralOffset < 0) ||
        (bestBranch.side === 'left' && bestBranchProj.lateralOffset > 0);
      const onOuterSide = !onInnerSide;
      const isInForkOpening =
        (onInnerSide &&
          (bIdx <= fc.branchInnerStartIdx + 1 || bIdx >= fc.branchInnerEndIdx - 1)) ||
        (onOuterSide &&
          (bIdx <= fc.branchOuterStartIdx || bIdx >= fc.branchOuterEndIdx));

      return {
        sampleIndex: bestBranchProj.bestIdx,
        t: bestBranchProj.t,
        nearestX: bestBranchProj.nearestX,
        nearestZ: bestBranchProj.nearestZ,
        tx: bestBranchProj.tx,
        tz: bestBranchProj.tz,
        rx: bestBranchProj.rx,
        rz: bestBranchProj.rz,
        yaw: bestBranchProj.yaw,
        lateralOffset: bestBranchProj.lateralOffset,
        distanceSq: bestBranchProj.bestDistSq,
        branchId: bestBranch.id,
        wallMargin: bestBranch.wallMargin,
        isInForkOpening,
      };
    }
  }

  const openingLeft = isForkOpeningAtT(track, mainProj.t, 'left');
  const openingRight = isForkOpeningAtT(track, mainProj.t, 'right');
  const isInForkOpening =
    (openingLeft !== null && mainProj.lateralOffset < -track.wallMargin * 0.75) ||
    (openingRight !== null && mainProj.lateralOffset > track.wallMargin * 0.75);

  return {
    sampleIndex: mainProj.bestIdx,
    t: mainProj.t,
    nearestX: mainProj.nearestX,
    nearestZ: mainProj.nearestZ,
    tx: mainProj.tx,
    tz: mainProj.tz,
    rx: mainProj.rx,
    rz: mainProj.rz,
    yaw: mainProj.yaw,
    lateralOffset: mainProj.lateralOffset,
    distanceSq: mainProj.bestDistSq,
    branchId: null,
    wallMargin: track.wallMargin,
    isInForkOpening,
  };
}

export function sampleAtT(track: RaceTrack, t: number): TrackSample {
  const n = track.samples.length;
  if (track.isClosed) {
    const wrapped = ((t % 1) + 1) % 1;
    const idx = Math.floor(wrapped * n) % n;
    return track.samples[idx];
  }
  const clamped = Math.min(1, Math.max(0, t));
  const idx = Math.min(n - 1, Math.max(0, Math.round(clamped * (n - 1))));
  return track.samples[idx];
}

export function sampleBranchAtT(branch: TrackBranch, mainT: number): TrackSample {
  const n = branch.samples.length;
  const span = Math.max(0.0001, branch.tEnd - branch.tStart);
  const u = Math.min(1, Math.max(0, (mainT - branch.tStart) / span));
  const idx = Math.min(n - 1, Math.max(0, Math.round(u * (n - 1))));
  return branch.samples[idx];
}

export function sampleSmoothAtT(track: RaceTrack, t: number): {
  x: number;
  z: number;
  tx: number;
  tz: number;
  rx: number;
  rz: number;
  yaw: number;
} {
  const n = track.samples.length;
  let exactIdx: number;
  let idx0: number;
  let idx1: number;
  let frac: number;

  if (track.isClosed) {
    const wrapped = ((t % 1) + 1) % 1;
    exactIdx = wrapped * n;
    idx0 = Math.floor(exactIdx) % n;
    idx1 = (idx0 + 1) % n;
    frac = exactIdx - Math.floor(exactIdx);
  } else {
    const clamped = Math.min(1, Math.max(0, t));
    exactIdx = clamped * (n - 1);
    idx0 = Math.min(n - 1, Math.floor(exactIdx));
    idx1 = Math.min(n - 1, idx0 + 1);
    frac = exactIdx - idx0;
  }

  const s0 = track.samples[idx0];
  const s1 = track.samples[idx1];

  const x = s0.x + (s1.x - s0.x) * frac;
  const z = s0.z + (s1.z - s0.z) * frac;
  const tx = s0.tx + (s1.tx - s0.tx) * frac;
  const tz = s0.tz + (s1.tz - s0.tz) * frac;
  const rx = s0.rx + (s1.rx - s0.rx) * frac;
  const rz = s0.rz + (s1.rz - s0.rz) * frac;
  const yaw = Math.atan2(tx, tz);

  return { x, z, tx, tz, rx, rz, yaw };
}

export function createBoostPads(track: RaceTrack): BoostPadState[] {
  if (isPursuitMap(track.mapId)) {
    const mainPads: Array<{ t: number; lane: number }> = [
      { t: 0.085, lane: -0.22 },
      { t: 0.165, lane: 0.24 },
      { t: 0.39, lane: 0.0 },
      { t: 0.52, lane: -0.26 },
      { t: 0.68, lane: 0.22 },
      { t: 0.89, lane: -0.15 },
      { t: 0.945, lane: 0.18 },
    ];
    const pads: BoostPadState[] = mainPads.map((p, idx) => {
      const s = sampleAtT(track, p.t);
      const offset = p.lane * track.wallMargin;
      return {
        id: idx,
        x: s.x + s.rx * offset,
        z: s.z + s.rz * offset,
        yaw: s.yaw,
        trackT: p.t,
        laneOffset: offset,
      };
    });
    // Also place a Nitro recharge pad inside each shortcut/detour branch
    track.branches.forEach((b, bIdx) => {
      const midT = (b.tStart + b.tEnd) * 0.5;
      const bs = sampleBranchAtT(b, midT);
      pads.push({
        id: mainPads.length + bIdx,
        x: bs.x,
        z: bs.z,
        yaw: bs.yaw,
        trackT: midT,
        laneOffset: 0,
      });
    });
    return pads;
  }

  // 7 floor boost pads placed along key straights and corner exits (keeping clear of water hazards)
  const padSpecs: Array<{ t: number; lane: number }> = [
    { t: 0.042, lane: -0.25 },
    { t: 0.255, lane: 0.20 },
    { t: 0.32, lane: -0.18 },
    { t: 0.50, lane: 0.22 },
    { t: 0.61, lane: 0.0 },
    { t: 0.80, lane: 0.24 },
    { t: 0.92, lane: 0.0 },
  ];

  return padSpecs.map((p, idx) => {
    const s = sampleAtT(track, p.t);
    const offset = p.lane * track.wallMargin;
    return {
      id: idx,
      x: s.x + s.rx * offset,
      z: s.z + s.rz * offset,
      yaw: s.yaw,
      trackT: p.t,
      laneOffset: offset,
    };
  });
}

export function createSandPatches(track: RaceTrack): SandPatchState[] {
  if (track.mapId !== 'construction') return [];

  // 9 wider golden-yellow road sand patches making construction hazard dodging genuinely challenging
  const patchSpecs: Array<{ t: number; lane: number; rx: number; rz: number }> = [
    { t: 0.08, lane: 0.36, rx: 3.9, rz: 6.8 },
    { t: 0.185, lane: -0.34, rx: 4.0, rz: 6.6 },
    { t: 0.305, lane: 0.28, rx: 3.8, rz: 6.4 },
    { t: 0.375, lane: -0.26, rx: 4.1, rz: 6.8 },
    { t: 0.46, lane: 0.32, rx: 3.9, rz: 6.4 },
    { t: 0.56, lane: 0.0, rx: 4.5, rz: 6.2 },
    { t: 0.655, lane: 0.34, rx: 3.9, rz: 6.5 },
    { t: 0.735, lane: -0.36, rx: 4.0, rz: 6.8 },
    { t: 0.86, lane: 0.34, rx: 3.8, rz: 6.6 },
  ];

  return patchSpecs.map((p, idx) => {
    const s = sampleAtT(track, p.t);
    const offset = p.lane * track.wallMargin;
    return {
      id: idx,
      x: s.x + s.rx * offset,
      z: s.z + s.rz * offset,
      yaw: s.yaw,
      radiusX: p.rx,
      radiusZ: p.rz,
      trackT: p.t,
      laneOffset: offset,
    };
  });
}
