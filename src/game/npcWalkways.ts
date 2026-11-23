import * as THREE from 'three';
import { getWaterHazardAtT, isForkOpeningAtT, type RaceTrack } from './track';
import type { MapId } from './types';
import { SIDEWALK_OUTER_OFFSET, sampleSmoothTrackPoint } from './pedestrians';
import { isPursuitMap } from './garage';
import { getGraphicsProfile, type GraphicsQuality } from './graphics';

export const WALKWAY_HEIGHT = 0.14;

export interface NpcWalkwaySegment {
  id: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  length: number;
  width: number;
  yaw: number;
}

export interface NpcWalkwaysSystem {
  group: THREE.Group;
  segments: NpcWalkwaySegment[];
  isOnWalkway: (x: number, z: number, radius: number) => boolean;
  dispose: () => void;
}

function createWalkwayTexture(
  mapId: MapId,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  if (mapId === 'beach') {
    // Sunlit timber boardwalk planks
    ctx.fillStyle = '#b45309';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 24) {
      ctx.fillStyle = (y / 24) % 2 === 0 ? '#d97706' : '#c2690a';
      ctx.fillRect(4, y + 2, 248, 19);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, y, 256, 3);
    }
    ctx.fillStyle = '#92400e';
    ctx.fillRect(0, 0, 12, 256);
    ctx.fillRect(244, 0, 12, 256);
  } else if (mapId === 'ice-arena') {
    // Heated Nordic stone-slate walkway tiles
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 4; c++) {
        const x = c * 64 + (r % 2 === 0 ? 4 : 14) - 8;
        ctx.fillStyle = (r + c) % 2 === 0 ? '#475569' : '#3e4c5e';
        ctx.fillRect(x, r * 32 + 3, 56, 26);
      }
    }
    ctx.fillStyle = '#7dd3fc';
    ctx.fillRect(10, 0, 4, 256);
    ctx.fillRect(242, 0, 4, 256);
  } else if (mapId === 'construction') {
    // Compacted concrete worker pedestrian path with safety yellow stripes
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 64) {
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, y, 256, 3);
    }
    ctx.fillStyle = '#facc15';
    ctx.fillRect(6, 0, 10, 256);
    ctx.fillRect(240, 0, 10, 256);
  } else if (mapId === 'day-city') {
    // Crisp sunlit brick/stone pedestrian boulevard with center paver strip
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(14, 0, 228, 256);
    for (let y = 0; y < 256; y += 32) {
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(14, y, 228, 2);
    }
    ctx.fillStyle = '#b45309';
    ctx.fillRect(120, 0, 16, 256);
    ctx.fillStyle = '#e2e8f0';
    for (let y = 8; y < 256; y += 36) {
      ctx.fillRect(125, y, 6, 18);
    }
  } else {
    // Sleek dark slate night-city / pursuit pedestrian avenue
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#283548';
    ctx.fillRect(16, 0, 224, 256);
    for (let y = 0; y < 256; y += 32) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(16, y, 224, 2);
    }
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(8, 0, 4, 256);
    ctx.fillRect(244, 0, 4, 256);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function isBlockedByFixedLandmark(
  track: RaceTrack,
  mapId: MapId,
  x: number,
  z: number,
  pad: number
): boolean {
  if (mapId === 'day-city') {
    const dx = (x - -52) / (77 + pad);
    const dz = (z - -18) / (57 + pad);
    if (dx * dx + dz * dz < 1) return true;
  } else if (mapId === 'beach') {
    if (Math.hypot(x + 70, z + 18) < 108 + pad) return true;
    if (Math.hypot(x + 125, z + 125) < 27 + pad) return true;
    if (Math.hypot(x + 275, z + 135) < 21 + pad) return true;
  } else if (mapId === 'ice-arena') {
    const dx = (x - -68) / (56 + pad);
    const dz = (z - -12) / (40 + pad);
    if (dx * dx + dz * dz < 1) return true;
    const gasS = sampleSmoothTrackPoint(track, 0.025);
    if (Math.hypot(x - (gasS.x - gasS.rx * 25), z - (gasS.z - gasS.rz * 25)) < 21 + pad) {
      return true;
    }
    const villageCenters: Array<[number, number]> = [
      [-125, -75],
      [48, -22],
      [16, 118],
      [-258, -118],
      [242, 110],
      [-30, -135],
    ];
    for (const [vx, vz] of villageCenters) {
      if (Math.hypot(x - vx, z - vz) < 26 + pad) return true;
    }
  } else if (mapId === 'night-city') {
    if (Math.hypot(x + 46, z + 42) < 30 + pad) return true;
    if (Math.hypot(x - 12, z + 46) < 27 + pad) return true;
  } else if (mapId === 'construction') {
    if (Math.hypot(x - 0, z - 0) < 32 + pad) return true;
    if (Math.hypot(x + 246, z + 30) < 40 + pad) return true;
  }
  return false;
}

function pointToSegmentDist(
  px: number,
  pz: number,
  x0: number,
  z0: number,
  x1: number,
  z1: number
): number {
  const vx = x1 - x0;
  const vz = z1 - z0;
  const wx = px - x0;
  const wz = pz - z0;
  const lenSq = vx * vx + vz * vz;
  if (lenSq <= 0.0001) return Math.hypot(wx, wz);
  const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / lenSq));
  return Math.hypot(px - (x0 + vx * t), pz - (z0 + vz * t));
}

export function buildNpcWalkways(
  track: RaceTrack,
  mapId: MapId,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
  isClearOfTrack: (x: number, z: number, radius: number) => boolean,
  graphicsQuality: GraphicsQuality = 'medium'
): NpcWalkwaysSystem {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const isPursuit = isPursuitMap(mapId);
  const profile = getGraphicsProfile(graphicsQuality);
  const aniso = Math.min(maxAnisotropy, profile.maxAnisotropyCap);
  const enableShadows = profile.shadows && !isSoftwareGl;

  const walkwayWidth = mapId === 'beach' ? 4.4 : 4.6;
  const segments: NpcWalkwaySegment[] = [];

  const isInsideWaterZone = (x: number, z: number): boolean => {
    for (const wz of track.waterZones) {
      const ws = sampleSmoothTrackPoint(track, (wz.tStart + wz.tEnd) * 0.5);
      if (Math.hypot(x - ws.x, z - ws.z) < 46) return true;
    }
    return false;
  };

  const isSegmentSafe = (
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    width: number,
    skipStartCheckMeters = 4.0
  ): boolean => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 12) return false;
    const steps = Math.max(4, Math.ceil(len / 2.2));
    for (let k = 0; k <= steps; k++) {
      const u = k / steps;
      const d = u * len;
      if (d < skipStartCheckMeters) continue;
      const px = x0 + (x1 - x0) * u;
      const pz = z0 + (z1 - z0) * u;
      if (!isClearOfTrack(px, pz, width * 0.5 + 1.8)) return false;
      if (isInsideWaterZone(px, pz)) return false;
      if (isBlockedByFixedLandmark(track, mapId, px, pz, width * 0.5 + 2.0)) return false;
    }
    return true;
  };

  const pushSegment = (x0: number, z0: number, x1: number, z1: number, width: number): void => {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const length = Math.hypot(dx, dz);
    if (length < 10) return;
    segments.push({
      id: segments.length,
      x0,
      z0,
      x1,
      z1,
      length,
      width,
      yaw: Math.atan2(dx, dz),
    });
  };

  // 1. Radiating City Pedestrian Avenues branching directly off the track sidewalks
  // Step midway between street shops (idx % 48 === 12 on +1 side, 36 on -1 side)
  const n = track.samples.length;
  const radialStations = isPursuit ? 14 : 18;
  const startOffset = track.halfWidth + SIDEWALK_OUTER_OFFSET - 0.3;
  const endAnchors: Array<{ side: 1 | -1; x: number; z: number; t: number }> = [];

  for (let st = 0; st < radialStations; st++) {
    // Include an avenue right near start straight (st=0 -> t~0.015) so player sees NPC roads immediately!
    const baseT = isPursuit
      ? 0.04 + (st / radialStations) * 0.88
      : st === 0
        ? 0.016
        : st === 1
          ? 0.052
          : (0.08 + ((st - 2) / Math.max(1, radialStations - 2)) * 0.88) % 1;

    const sampleIdx = Math.min(n - 1, Math.round(baseT * (n - 1)));
    const s = track.samples[sampleIdx];
    if (s.curvature > 0.024) continue;
    if (getWaterHazardAtT(track, s.t) !== null) continue;

    const sides: Array<1 | -1> = st <= 1 ? [-1, 1] : [st % 2 === 0 ? 1 : -1];
    for (const side of sides) {
      if (isForkOpeningAtT(track, s.t, side === 1 ? 'right' : 'left', 4) !== null) continue;
      // Avoid clipping Start Straight Gas Station on Ice Peaks (-1 side near t=0.025)
      if (mapId === 'ice-arena' && side === -1 && baseT < 0.06) continue;

      const x0 = s.x + s.rx * side * startOffset;
      const z0 = s.z + s.rz * side * startOffset;

      let chosenLen = 0;
      for (const tryLen of [64, 44, 28, 18]) {
        const x1 = s.x + s.rx * side * (startOffset + tryLen);
        const z1 = s.z + s.rz * side * (startOffset + tryLen);
        if (isSegmentSafe(x0, z0, x1, z1, walkwayWidth, 4.5)) {
          chosenLen = tryLen;
          break;
        }
      }

      if (chosenLen > 0) {
        const x1 = s.x + s.rx * side * (startOffset + chosenLen);
        const z1 = s.z + s.rz * side * (startOffset + chosenLen);
        pushSegment(x0, z0, x1, z1, walkwayWidth);
        endAnchors.push({ side, x: x1, z: z1, t: s.t });
      }
    }
  }

  // 2. Parallel Connecting Pedestrian Boulevards forming proper city blocks between radial avenues
  for (let i = 0; i < endAnchors.length; i++) {
    const a = endAnchors[i];
    const b = endAnchors[(i + 1) % endAnchors.length];
    if (!b || a === b || a.side !== b.side) continue;
    const mx0 = a.x;
    const mz0 = a.z;
    const mx1 = b.x;
    const mz1 = b.z;
    const dist = Math.hypot(mx1 - mx0, mz1 - mz0);
    if (dist > 20 && dist < 115 && isSegmentSafe(mx0, mz0, mx1, mz1, walkwayWidth, 1.0)) {
      pushSegment(mx0, mz0, mx1, mz1, walkwayWidth);
    }
  }

  // 3. Dedicated Plaza / Village Pedestrian Links on Ice Peaks & Beach
  if (mapId === 'ice-arena') {
    const iceLinks: Array<[number, number, number, number]> = [
      [48, -46, 48, 2],
      [26, -22, 70, -22],
      [-6, 118, 38, 118],
      [-280, -118, -236, -118],
      [220, 110, 264, 110],
    ];
    for (const [x0, z0, x1, z1] of iceLinks) {
      if (isSegmentSafe(x0, z0, x1, z1, 3.8, 0)) {
        pushSegment(x0, z0, x1, z1, 3.8);
      }
    }
  } else if (mapId === 'beach') {
    const beachPromenades: Array<[number, number, number, number]> = [
      [-182, -78, -182, 76],
      [-248, -82, -248, 42],
    ];
    for (const [x0, z0, x1, z1] of beachPromenades) {
      if (isSegmentSafe(x0, z0, x1, z1, 4.2, 0)) {
        pushSegment(x0, z0, x1, z1, 4.2);
      }
    }
  }

  // Build Instanced Three.js Geometry for all validated NPC Pedestrian Roads
  if (segments.length > 0) {
    const roadTex = createWalkwayTexture(mapId, aniso);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: roadTex,
      roughness: mapId === 'beach' ? 0.85 : 0.78,
      metalness: 0.06,
    });
    const curbMat = new THREE.MeshStandardMaterial({
      color: mapId === 'beach' ? 0x78350f : mapId === 'ice-arena' ? 0x94a3b8 : 0xe2e8f0,
      roughness: 0.75,
    });
    const zebraMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
    });
    const bollardPoleMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.45,
      metalness: 0.65,
    });
    const bollardLampMat = new THREE.MeshStandardMaterial({
      color: mapId === 'day-city' || mapId === 'beach' ? 0xfef08a : 0x38bdf8,
      emissive: isPursuit || mapId === 'night-city' || mapId === 'ice-arena' ? 0x38bdf8 : 0xfacc15,
      emissiveIntensity: mapId === 'day-city' || mapId === 'beach' ? 0.35 : 1.75,
      roughness: 0.2,
    });

    const deckGeo = new THREE.BoxGeometry(1, WALKWAY_HEIGHT, 1);
    const curbGeo = new THREE.BoxGeometry(0.26, WALKWAY_HEIGHT + 0.04, 1);
    const zebraGeo = new THREE.PlaneGeometry(0.42, 2.2);
    zebraGeo.rotateX(-Math.PI / 2);
    const bollardGeo = new THREE.CylinderGeometry(0.11, 0.14, 1.05, 8);
    bollardGeo.translate(0, 0.525, 0);
    const lampCapGeo = new THREE.SphereGeometry(0.15, 8, 6);

    const deckInst = new THREE.InstancedMesh(deckGeo, deckMat, segments.length);
    deckInst.receiveShadow = enableShadows;
    const curbInst = new THREE.InstancedMesh(curbGeo, curbMat, segments.length * 2);
    const zebraInst = new THREE.InstancedMesh(zebraGeo, zebraMat, segments.length * 4);
    const bollardInst = new THREE.InstancedMesh(bollardGeo, bollardPoleMat, segments.length * 4);
    const bollardLampInst = new THREE.InstancedMesh(lampCapGeo, bollardLampMat, segments.length * 4);

    const dummy = new THREE.Object3D();
    segments.forEach((seg, idx) => {
      const mx = (seg.x0 + seg.x1) * 0.5;
      const mz = (seg.z0 + seg.z1) * 0.5;
      const rightX = Math.cos(seg.yaw);
      const rightZ = -Math.sin(seg.yaw);
      const fwdX = Math.sin(seg.yaw);
      const fwdZ = Math.cos(seg.yaw);

      dummy.position.set(mx, WALKWAY_HEIGHT * 0.5, mz);
      dummy.rotation.set(0, seg.yaw, 0);
      dummy.scale.set(seg.width, 1, seg.length);
      dummy.updateMatrix();
      deckInst.setMatrixAt(idx, dummy.matrix);

      for (let c = 0; c < 2; c++) {
        const sgn = c === 0 ? -1 : 1;
        const lat = sgn * (seg.width * 0.5 + 0.12);
        dummy.position.set(mx + rightX * lat, (WALKWAY_HEIGHT + 0.04) * 0.5, mz + rightZ * lat);
        dummy.rotation.set(0, seg.yaw, 0);
        dummy.scale.set(1, 1, seg.length);
        dummy.updateMatrix();
        curbInst.setMatrixAt(idx * 2 + c, dummy.matrix);
      }

      // Crosswalk zebra stripes near junction end
      for (let z = 0; z < 4; z++) {
        const stripeLat = (z - 1.5) * 0.92;
        dummy.position.set(
          seg.x0 + fwdX * 2.1 + rightX * stripeLat,
          WALKWAY_HEIGHT + 0.012,
          seg.z0 + fwdZ * 2.1 + rightZ * stripeLat
        );
        dummy.rotation.set(0, seg.yaw, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        zebraInst.setMatrixAt(idx * 4 + z, dummy.matrix);
      }

      // 4 Low Illuminated Pedestrian Bollards flanking start & mid-block
      const bPositions = [
        [0.2, -1],
        [0.2, 1],
        [0.65, -1],
        [0.65, 1],
      ];
      bPositions.forEach(([uPos, sgn], bIdx) => {
        const bx = seg.x0 + fwdX * (seg.length * uPos) + rightX * (sgn * (seg.width * 0.5 + 0.14));
        const bz = seg.z0 + fwdZ * (seg.length * uPos) + rightZ * (sgn * (seg.width * 0.5 + 0.14));
        dummy.position.set(bx, WALKWAY_HEIGHT, bz);
        dummy.rotation.set(0, seg.yaw, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        bollardInst.setMatrixAt(idx * 4 + bIdx, dummy.matrix);

        dummy.position.set(bx, WALKWAY_HEIGHT + 1.08, bz);
        dummy.updateMatrix();
        bollardLampInst.setMatrixAt(idx * 4 + bIdx, dummy.matrix);
      });
    });

    for (const inst of [deckInst, curbInst, zebraInst, bollardInst, bollardLampInst]) {
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      group.add(inst);
    }

    disposables.push(
      roadTex,
      deckMat,
      curbMat,
      zebraMat,
      bollardPoleMat,
      bollardLampMat,
      deckGeo,
      curbGeo,
      zebraGeo,
      bollardGeo,
      lampCapGeo
    );
  }

  function isOnWalkway(x: number, z: number, radius: number): boolean {
    for (const seg of segments) {
      if (pointToSegmentDist(x, z, seg.x0, seg.z0, seg.x1, seg.z1) < seg.width * 0.5 + radius) {
        return true;
      }
    }
    return false;
  }

  return {
    group,
    segments,
    isOnWalkway,
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
