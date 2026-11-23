import * as THREE from 'three';
import type { RaceTrack } from './track';
import { sampleSmoothTrackPoint } from './pedestrians';
import { getGraphicsProfile, type GraphicsQuality } from './graphics';

export interface IceArenaFeaturesSystem {
  group: THREE.Group;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

function createArcticWaterTexture(
  maxAnisotropy: number,
  sizeScale = 1
): THREE.CanvasTexture {
  const dim = Math.max(64, Math.round(256 * sizeScale));
  const canvas = document.createElement('canvas');
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d')!;
  if (dim !== 256) {
    ctx.scale(dim / 256, dim / 256);
  }

  ctx.fillStyle = '#0c4a6e';
  ctx.fillRect(0, 0, 256, 256);

  const rippleCount = sizeScale < 1 ? 140 : 420;
  for (let i = 0; i < rippleCount; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(56, 189, 248, 0.24)' : 'rgba(7, 89, 133, 0.45)';
    ctx.fillRect(x, y, 18 + (i % 4) * 8, 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function buildIceArenaFeatures(
  track: RaceTrack,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
  envRand: () => number,
  isClearOfTrack: (x: number, z: number, radius: number) => boolean,
  isWalkwayBlocked?: (x: number, z: number, radius: number) => boolean,
  graphicsQuality: GraphicsQuality = 'medium'
): IceArenaFeaturesSystem {
  const profile = getGraphicsProfile(graphicsQuality);
  const aniso = Math.min(maxAnisotropy, profile.maxAnisotropyCap);
  const simpleMat = profile.buildingDetail === 'simple';
  const enableShadows = profile.shadows && !isSoftwareGl;
  const texScale = profile.textureSizeScale;

  const makeMat = (params: THREE.MeshStandardMaterialParameters): THREE.Material => {
    if (!simpleMat) return new THREE.MeshStandardMaterial(params);
    return new THREE.MeshLambertMaterial({
      color: params.color,
      map: params.map,
      emissive: params.emissive,
      emissiveIntensity: params.emissiveIntensity,
      transparent: params.transparent,
      opacity: params.opacity,
      flatShading: params.flatShading,
    });
  };

  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const dummy = new THREE.Object3D();

  // =========================================================================
  // 1. OPEN ARCTIC WATER HAZARD BASINS & FLOATING ICE FLOES
  // =========================================================================
  const waterTex = createArcticWaterTexture(aniso, texScale);
  const arcticWaterMat = makeMat({
    color: 0xffffff,
    map: waterTex,
    roughness: 0.12,
    metalness: 0.45,
    transparent: true,
    opacity: 0.94,
  });
  const hazardEdgeMat = makeMat({
    color: 0xe0f2fe,
    roughness: 0.25,
    metalness: 0.15,
  });
  const iceFloeGeo = new THREE.CylinderGeometry(2.6, 3.1, 0.34, 6);
  const hazardBeaconPoleGeo = new THREE.CylinderGeometry(0.14, 0.18, 2.5, 6);
  const hazardBeaconLampGeo = new THREE.OctahedronGeometry(0.42, 0);
  const beaconPoleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
  const beaconLampMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    emissive: 0xf43f5e,
    emissiveIntensity: 2.0,
    roughness: 0.25,
  });

  const floes: Array<{ mesh: THREE.Mesh; baseY: number; phase: number }> = [];
  const basinGeoList: THREE.BufferGeometry[] = [];

  for (const wz of track.waterZones) {
    const tMid = (wz.tStart + wz.tEnd) * 0.5;
    const midS = sampleSmoothTrackPoint(track, tMid);
    const startS = sampleSmoothTrackPoint(track, wz.tStart);
    const endS = sampleSmoothTrackPoint(track, wz.tEnd);
    const spanLen = Math.hypot(endS.x - startS.x, endS.z - startS.z) + 26;

    // Position the dark arctic fjord water pool directly beneath & flanking the open-water edges
    const sides: Array<1 | -1> =
      wz.side === 'both' ? [-1, 1] : wz.side === 'left' ? [-1] : [1];

    const poolWidth = wz.side === 'both' ? 54 : 34;
    const lateralCenter =
      wz.side === 'both'
        ? 0
        : wz.side === 'left'
          ? wz.safeMinLat - 15
          : wz.safeMaxLat + 15;

    const poolGeo = new THREE.PlaneGeometry(poolWidth, spanLen);
    poolGeo.rotateX(-Math.PI / 2);
    const poolMesh = new THREE.Mesh(poolGeo, arcticWaterMat);
    poolMesh.position.set(
      midS.x + midS.rx * lateralCenter,
      0.028,
      midS.z + midS.rz * lateralCenter
    );
    poolMesh.rotation.y = midS.yaw;
    group.add(poolMesh);
    basinGeoList.push(poolGeo);

    // Scatter jagged floating ice floes in the open arctic water
    for (let f = 0; f < 9; f++) {
      const ft = wz.tStart + ((wz.tEnd - wz.tStart) * (f + 0.5)) / 9;
      const fs = sampleSmoothTrackPoint(track, ft);
      const sidePick = sides[f % sides.length];
      const latDist =
        sidePick < 0
          ? wz.safeMinLat - (6.5 + envRand() * 14)
          : wz.safeMaxLat + (6.5 + envRand() * 14);
      const floe = new THREE.Mesh(iceFloeGeo, hazardEdgeMat);
      floe.position.set(fs.x + fs.rx * latDist, 0.08, fs.z + fs.rz * latDist);
      floe.rotation.y = envRand() * Math.PI * 2;
      floe.scale.set(0.75 + envRand() * 0.9, 1, 0.75 + envRand() * 0.9);
      group.add(floe);
      floes.push({ mesh: floe, baseY: 0.08, phase: f * 0.9 + wz.id });
    }

    // Glowing crimson/cyan warning pylons marking the entry & exit of each water cliff
    for (const markerT of [wz.tStart - 0.005, wz.tStart + 0.004, wz.tEnd - 0.004]) {
      const ms = sampleSmoothTrackPoint(track, markerT);
      for (const sgn of sides) {
        const edgeLat = sgn < 0 ? wz.safeMinLat - 0.25 : wz.safeMaxLat + 0.25;
        const bx = ms.x + ms.rx * edgeLat;
        const bz = ms.z + ms.rz * edgeLat;
        const pole = new THREE.Mesh(hazardBeaconPoleGeo, beaconPoleMat);
        pole.position.set(bx, 1.25, bz);
        const lamp = new THREE.Mesh(hazardBeaconLampGeo, beaconLampMat);
        lamp.position.set(bx, 2.7, bz);
        group.add(pole, lamp);
      }
    }
  }

  disposables.push(
    waterTex,
    arcticWaterMat,
    hazardEdgeMat,
    iceFloeGeo,
    hazardBeaconPoleGeo,
    hazardBeaconLampGeo,
    beaconPoleMat,
    beaconLampMat,
    ...basinGeoList
  );

  // =========================================================================
  // 2. ARENA LANDMARKS GEOMETRY DEFINITIONS (Closer Enlarged Rink, Gas Station, Villages & Grandstands)
  // =========================================================================
  const RINK_X = -68;
  const RINK_Z = -12;
  const RINK_W = 102;
  const RINK_D = 70;

  const isInsideRinkClearance = (x: number, z: number, pad = 10): boolean => {
    const dx = (x - RINK_X) / (RINK_W * 0.5 + pad);
    const dz = (z - RINK_Z) / (RINK_D * 0.5 + pad);
    return dx * dx + dz * dz < 1;
  };

  // Gas & Service Station beside Start Straight outer edge (West side, facing +X toward cars)
  const gasSample = sampleSmoothTrackPoint(track, 0.025);
  const GAS_X = gasSample.x - gasSample.rx * 25.0;
  const GAS_Z = gasSample.z - gasSample.rz * 25.0;
  const GAS_YAW = Math.atan2(gasSample.rx, gasSample.rz);

  const isNearGasStation = (x: number, z: number, pad = 16): boolean =>
    Math.hypot(x - GAS_X, z - GAS_Z) < 18 + pad;

  // 6 Alpine Wooden Log Cabin Villages ("Деревянные домики и деревни")
  const VILLAGE_CENTERS: Array<{ x: number; z: number; yaw: number; radius: number }> = [
    { x: -125, z: -75, yaw: -0.35, radius: 22 },
    { x: 48, z: -22, yaw: -Math.PI * 0.45, radius: 26 },
    { x: 16, z: 118, yaw: 0.25, radius: 26 },
    { x: -258, z: -118, yaw: 0.8, radius: 26 },
    { x: 242, z: 110, yaw: -0.7, radius: 26 },
    { x: -30, z: -135, yaw: 0.12, radius: 25 },
  ];

  const isInsideVillageClearance = (x: number, z: number, pad = 6): boolean => {
    for (const v of VILLAGE_CENTERS) {
      if (Math.hypot(x - v.x, z - v.z) < v.radius + pad) return true;
    }
    return false;
  };

  interface GrandstandPlacement {
    x: number;
    z: number;
    yaw: number;
    label: string;
  }

  const grandstandPlacements: GrandstandPlacement[] = [];
  const candidateTrackStands: Array<{ t: number; side: 1 | -1; label: string }> = [
    { t: 0.955, side: -1, label: 'START STRAIGHT' },
    { t: 0.278, side: 1, label: 'NORTH FROST' },
    { t: 0.815, side: 1, label: 'SOUTH GLACIER' },
  ];

  const standOffset = track.halfWidth + 4.55 + 5.5;
  for (const cand of candidateTrackStands) {
    const s = sampleSmoothTrackPoint(track, cand.t);
    const gx = s.x + s.rx * cand.side * standOffset;
    const gz = s.z + s.rz * cand.side * standOffset;
    if (!isClearOfTrack(gx, gz, 4.2) || isInsideRinkClearance(gx, gz, 8)) continue;
    if (isNearGasStation(gx, gz, 8) || isInsideVillageClearance(gx, gz, 6)) continue;

    let nearWater = false;
    for (const wz of track.waterZones) {
      const ws = sampleSmoothTrackPoint(track, (wz.tStart + wz.tEnd) * 0.5);
      if (Math.hypot(gx - ws.x, gz - ws.z) < 46) {
        nearWater = true;
        break;
      }
    }
    if (nearWater) continue;

    const yaw = Math.atan2(-cand.side * s.rx, -cand.side * s.rz);
    grandstandPlacements.push({ x: gx, z: gz, yaw, label: cand.label });
  }

  // Dedicated 5-tier Grandstand overlooking the Central Ice Skating Rink (North side, leaving West sightline open)
  grandstandPlacements.push({
    x: RINK_X,
    z: RINK_Z - (RINK_D * 0.5 + 6.4),
    yaw: 0,
    label: 'RINK PLAZA',
  });

  const isNearGrandstand = (x: number, z: number, pad = 17): boolean => {
    for (const g of grandstandPlacements) {
      if (Math.hypot(x - g.x, z - g.z) < pad) return true;
    }
    return false;
  };

  // =========================================================================
  // 3. MONUMENTAL CRYSTALLINE ICE PEAKS ("Ледяные пики") — Perimeter & Infield
  // =========================================================================
  const peakPlacements: Array<{
    x: number;
    z: number;
    radius: number;
    height: number;
    yaw: number;
    crystalTint: THREE.Color;
  }> = [];

  const ICE_TINTS = [0xbae6fd, 0x7dd3fc, 0x38bdf8, 0xe0f2fe, 0x60a5fa];

  // Signature inner-island Ice Peaks framing the enlarged Skating Rink & villages without blocking West view
  const heroPeakSpots: Array<[number, number, number, number]> = [
    [-78, -96, 16, 46],
    [48, -88, 17, 50],
    [102, -10, 15, 44],
    [-68, 86, 17, 48],
    [68, 108, 16, 44],
  ];

  for (const [hx, hz, rad, h] of heroPeakSpots) {
    if (
      isClearOfTrack(hx, hz, rad + 2.5) &&
      !isInsideRinkClearance(hx, hz, rad + 6) &&
      !isNearGrandstand(hx, hz, rad + 12) &&
      !isNearGasStation(hx, hz, rad + 4) &&
      !isInsideVillageClearance(hx, hz, rad + 4)
    ) {
      peakPlacements.push({
        x: hx,
        z: hz,
        radius: rad,
        height: h,
        yaw: envRand() * Math.PI * 2,
        crystalTint: new THREE.Color(ICE_TINTS[peakPlacements.length % ICE_TINTS.length]),
      });
    }
  }

  // Outer glacier mountain ring + spaced crystal spires
  for (let gx = -390; gx <= 390; gx += 44) {
    for (let gz = -390; gz <= 390; gz += 44) {
      const x = gx + (envRand() - 0.5) * 16;
      const z = gz + (envRand() - 0.5) * 16;
      const dist = Math.hypot(x, z);
      if (dist > 415) continue;
      if (envRand() < (simpleMat ? 0.65 : 0.38)) continue;

      // Keep West viewing corridor between start straight (-186) and Skating Rink (-68, -12) clear
      if (x >= -176 && x <= -60 && z >= -75 && z <= 65) continue;

      const isOuterMountain = dist > 225;
      const rad = isOuterMountain ? 14 + envRand() * 14 : 7.5 + envRand() * 7.5;
      if (!isClearOfTrack(x, z, rad + 3.2)) continue;
      if (isInsideRinkClearance(x, z, rad + 7)) continue;
      if (isNearGrandstand(x, z, rad + 14)) continue;
      if (isNearGasStation(x, z, rad + 4)) continue;
      if (isInsideVillageClearance(x, z, rad + 4)) continue;
      if (isWalkwayBlocked?.(x, z, rad + 2.0)) continue;

      // Ensure peaks don't spawn inside open arctic water hazard zones
      let nearWater = false;
      for (const wz of track.waterZones) {
        const ws = sampleSmoothTrackPoint(track, (wz.tStart + wz.tEnd) * 0.5);
        if (Math.hypot(x - ws.x, z - ws.z) < 50) {
          nearWater = true;
          break;
        }
      }
      if (nearWater) continue;

      const h = isOuterMountain ? 38 + envRand() * 48 : 20 + envRand() * 24;
      peakPlacements.push({
        x,
        z,
        radius: rad,
        height: h,
        yaw: envRand() * Math.PI * 2,
        crystalTint: new THREE.Color(ICE_TINTS[Math.floor(envRand() * ICE_TINTS.length)]),
      });
    }
  }

  const spireGeo = new THREE.ConeGeometry(1, 1, 5);
  spireGeo.translate(0, 0.5, 0);
  const subSpireGeo = new THREE.ConeGeometry(0.65, 0.72, 5);
  subSpireGeo.translate(0, 0.36, 0);
  const snowCapGeo = new THREE.ConeGeometry(0.55, 0.32, 5);
  snowCapGeo.translate(0, 0.86, 0);

  const iceCrystalMat = makeMat({
    color: 0xffffff,
    roughness: 0.16,
    metalness: 0.24,
    flatShading: true,
    envMapIntensity: 1.4,
  });
  const snowCapMat = makeMat({
    color: 0xf8fafc,
    roughness: 0.68,
    metalness: 0.04,
    flatShading: true,
  });

  if (peakPlacements.length > 0) {
    const mainPeakInst = new THREE.InstancedMesh(spireGeo, iceCrystalMat, peakPlacements.length);
    const sidePeakInst = new THREE.InstancedMesh(subSpireGeo, iceCrystalMat, peakPlacements.length * 2);
    const capInst = new THREE.InstancedMesh(snowCapGeo, snowCapMat, peakPlacements.length);
    mainPeakInst.castShadow = enableShadows;
    mainPeakInst.receiveShadow = enableShadows;
    sidePeakInst.castShadow = enableShadows;

    peakPlacements.forEach((pk, idx) => {
      dummy.position.set(pk.x, 0, pk.z);
      dummy.rotation.set(0, pk.yaw, 0);
      dummy.scale.set(pk.radius, pk.height, pk.radius);
      dummy.updateMatrix();
      mainPeakInst.setMatrixAt(idx, dummy.matrix);
      mainPeakInst.setColorAt(idx, pk.crystalTint);

      dummy.position.set(pk.x, 0, pk.z);
      dummy.rotation.set(0, pk.yaw, 0);
      dummy.scale.set(pk.radius, pk.height, pk.radius);
      dummy.updateMatrix();
      capInst.setMatrixAt(idx, dummy.matrix);

      // Two flanking crystal shards at the base of every major ice peak
      for (let k = 0; k < 2; k++) {
        const ang = pk.yaw + (k === 0 ? 1.1 : -1.5);
        const off = pk.radius * 0.62;
        dummy.position.set(pk.x + Math.cos(ang) * off, 0, pk.z + Math.sin(ang) * off);
        dummy.rotation.set(0.08 * (k === 0 ? 1 : -1), ang, 0.06);
        dummy.scale.set(pk.radius * 0.82, pk.height * (0.58 + k * 0.12), pk.radius * 0.82);
        dummy.updateMatrix();
        sidePeakInst.setMatrixAt(idx * 2 + k, dummy.matrix);
        sidePeakInst.setColorAt(idx * 2 + k, pk.crystalTint);
      }
    });

    for (const inst of [mainPeakInst, sidePeakInst, capInst]) {
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.computeBoundingSphere();
      group.add(inst);
    }
  }

  // =========================================================================
  // 4. SNOW-DUSTED ALPINE EVERGREENS (Clear of Road, Open Water, Rink & Stands)
  // =========================================================================
  const pineSpots: Array<{ x: number; z: number; scale: number }> = [];
  const pineTargetAttempts = Math.round(96 * profile.densityScale);
  for (let i = 0; i < pineTargetAttempts; i++) {
    const ang = envRand() * Math.PI * 2;
    const rad = 48 + envRand() * 215;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    if (x >= -176 && x <= -60 && z >= -75 && z <= 65) continue;
    if (!isClearOfTrack(x, z, 3.0)) continue;
    if (isInsideRinkClearance(x, z, 6)) continue;
    if (isNearGrandstand(x, z, 15)) continue;
    if (isNearGasStation(x, z, 5)) continue;
    if (isInsideVillageClearance(x, z, 4)) continue;
    if (isWalkwayBlocked?.(x, z, 2.5)) continue;
    let blocked = false;
    for (const wz of track.waterZones) {
      const ws = sampleSmoothTrackPoint(track, (wz.tStart + wz.tEnd) * 0.5);
      if (Math.hypot(x - ws.x, z - ws.z) < 42) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    pineSpots.push({ x, z, scale: 0.85 + envRand() * 0.55 });
  }

  if (pineSpots.length > 0) {
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2.2, 6);
    trunkGeo.translate(0, 1.1, 0);
    const trunkMat = makeMat({ color: 0x451a03, roughness: 0.9 });
    const foliageGeo = new THREE.ConeGeometry(1.75, 4.8, 7);
    foliageGeo.translate(0, 4.2, 0);
    const foliageMat = makeMat({ color: 0x0f766e, roughness: 0.78 });
    const snowTopGeo = new THREE.ConeGeometry(1.25, 2.3, 7);
    snowTopGeo.translate(0, 5.4, 0);

    const tInst = new THREE.InstancedMesh(trunkGeo, trunkMat, pineSpots.length);
    const fInst = new THREE.InstancedMesh(foliageGeo, foliageMat, pineSpots.length);
    const sInst = new THREE.InstancedMesh(snowTopGeo, snowCapMat, pineSpots.length);
    tInst.castShadow = enableShadows;
    fInst.castShadow = enableShadows;
    sInst.castShadow = enableShadows;

    pineSpots.forEach((p, idx) => {
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.set(0, idx * 0.9, 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      tInst.setMatrixAt(idx, dummy.matrix);
      fInst.setMatrixAt(idx, dummy.matrix);
      sInst.setMatrixAt(idx, dummy.matrix);
    });
    for (const inst of [tInst, fInst, sInst]) {
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      group.add(inst);
    }
    disposables.push(trunkGeo, trunkMat, foliageGeo, foliageMat, snowTopGeo);
  }

  // =========================================================================
  // 5. CENTRAL ICE SKATING RINK ("Каток") + 28 ANIMATED ICE SKATING NPCs
  // =========================================================================
  const makeRoundedRectShape = (w: number, d: number, r: number): THREE.Shape => {
    const hw = w * 0.5;
    const hd = d * 0.5;
    const rad = Math.min(r, hw * 0.9, hd * 0.9);
    const shape = new THREE.Shape();
    shape.moveTo(-hw + rad, -hd);
    shape.lineTo(hw - rad, -hd);
    shape.quadraticCurveTo(hw, -hd, hw, -hd + rad);
    shape.lineTo(hw, hd - rad);
    shape.quadraticCurveTo(hw, hd, hw - rad, hd);
    shape.lineTo(-hw + rad, hd);
    shape.quadraticCurveTo(-hw, hd, -hw, hd - rad);
    shape.lineTo(-hw, -hd + rad);
    shape.quadraticCurveTo(-hw, -hd, -hw + rad, -hd);
    return shape;
  };

  const createRinkIceTexture = (): THREE.CanvasTexture => {
    const w = Math.max(256, Math.round(1024 * texScale));
    const h = Math.max(192, Math.round(768 * texScale));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    if (w !== 1024 || h !== 768) {
      ctx.scale(w / 1024, h / 768);
    }

    // Gleaming cool mirror-ice gradient base
    const grad = ctx.createRadialGradient(512, 384, 40, 512, 384, 540);
    grad.addColorStop(0, '#e0f2fe');
    grad.addColorStop(0.6, '#bae6fd');
    grad.addColorStop(1, '#93c5fd');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 768);

    // Subtle Zamboni ice-resurfacer streaks & skate blade arcs
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = 2;
    for (let y = 24; y < 768; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Center red line & dual blue zone lines
    ctx.fillStyle = 'rgba(225, 29, 72, 0.72)';
    ctx.fillRect(507, 16, 10, 736);
    ctx.fillStyle = 'rgba(2, 132, 199, 0.72)';
    ctx.fillRect(320, 16, 10, 736);
    ctx.fillRect(694, 16, 10, 736);

    // Center ice circle & snowflake star
    ctx.strokeStyle = 'rgba(2, 132, 199, 0.85)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(512, 384, 96, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 5;
    for (let a = 0; a < 6; a++) {
      const ang = (a * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(512 - Math.cos(ang) * 58, 384 - Math.sin(ang) * 58);
      ctx.lineTo(512 + Math.cos(ang) * 58, 384 + Math.sin(ang) * 58);
      ctx.stroke();
    }

    // Corner faceoff circles
    ctx.strokeStyle = 'rgba(225, 29, 72, 0.65)';
    ctx.lineWidth = 6;
    for (const [cx, cy] of [
      [190, 210],
      [190, 558],
      [834, 210],
      [834, 558],
    ]) {
      ctx.beginPath();
      ctx.arc(cx, cy, 52, 0, Math.PI * 2);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = aniso;
    return tex;
  };

  // Stone plaza apron under & around the rink
  const rinkApronShape = makeRoundedRectShape(RINK_W + 10, RINK_D + 10, 13);
  const rinkApronGeo = new THREE.ShapeGeometry(rinkApronShape, simpleMat ? 10 : 18);
  rinkApronGeo.rotateX(-Math.PI / 2);
  const rinkApronMat = makeMat({
    color: 0x334155,
    roughness: 0.85,
    metalness: 0.1,
  });
  const rinkApronMesh = new THREE.Mesh(rinkApronGeo, rinkApronMat);
  rinkApronMesh.position.set(RINK_X, 0.05, RINK_Z);
  rinkApronMesh.receiveShadow = enableShadows;
  group.add(rinkApronMesh);

  // Mirror skating ice surface
  const rinkShape = makeRoundedRectShape(RINK_W, RINK_D, 10);
  const rinkIceGeo = new THREE.ShapeGeometry(rinkShape, simpleMat ? 12 : 20);
  const uvAttr = rinkIceGeo.getAttribute('uv');
  const posAttr = rinkIceGeo.getAttribute('position');
  for (let i = 0; i < posAttr.count; i++) {
    const px = posAttr.getX(i);
    const py = posAttr.getY(i);
    uvAttr.setXY(i, (px + RINK_W * 0.5) / RINK_W, (py + RINK_D * 0.5) / RINK_D);
  }
  uvAttr.needsUpdate = true;
  rinkIceGeo.rotateX(-Math.PI / 2);

  const rinkIceTex = createRinkIceTexture();
  const rinkIceMat = makeMat({
    color: 0xffffff,
    map: rinkIceTex,
    roughness: 0.08,
    metalness: 0.28,
    envMapIntensity: 1.45,
  });
  const rinkIceMesh = new THREE.Mesh(rinkIceGeo, rinkIceMat);
  rinkIceMesh.position.set(RINK_X, 0.14, RINK_Z);
  rinkIceMesh.receiveShadow = enableShadows;
  group.add(rinkIceMesh);

  // Rink dasher boards + crimson cap rail + clear acrylic barrier panels
  const boardSegs = simpleMat ? 32 : 56;
  const perimeterPts = rinkShape.getSpacedPoints(boardSegs);
  const boardMat = makeMat({ color: 0xf8fafc, roughness: 0.4 });
  const boardRailMat = makeMat({
    color: 0x0284c7,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.35,
    roughness: 0.35,
  });
  const glassMat = makeMat({
    color: 0xbae6fd,
    roughness: 0.1,
    metalness: 0.25,
    transparent: true,
    opacity: 0.28,
  });

  const segPanelGeo = new THREE.BoxGeometry(1, 1.15, 0.36);
  const segRailGeo = new THREE.BoxGeometry(1, 0.14, 0.42);
  const segGlassGeo = new THREE.BoxGeometry(1, 0.95, 0.1);

  const boardInst = new THREE.InstancedMesh(segPanelGeo, boardMat, boardSegs);
  boardInst.castShadow = enableShadows;
  boardInst.receiveShadow = enableShadows;
  const railInst = new THREE.InstancedMesh(segRailGeo, boardRailMat, boardSegs);
  const glassInst = new THREE.InstancedMesh(segGlassGeo, glassMat, boardSegs);

  for (let i = 0; i < boardSegs; i++) {
    const p0 = perimeterPts[i];
    const p1 = perimeterPts[(i + 1) % boardSegs];
    // Note: ShapeGeometry rotated by -Math.PI/2 maps (x, y) -> (x, 0, -y)
    const x0 = RINK_X + p0.x;
    const z0 = RINK_Z - p0.y;
    const x1 = RINK_X + p1.x;
    const z1 = RINK_Z - p1.y;
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    const len = Math.hypot(x1 - x0, z1 - z0) + 0.08;
    const yaw = Math.atan2(x1 - x0, z1 - z0) + Math.PI * 0.5;

    dummy.position.set(mx, 0.65, mz);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(len, 1, 1);
    dummy.updateMatrix();
    boardInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(mx, 1.28, mz);
    dummy.updateMatrix();
    railInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(mx, 1.82, mz);
    dummy.updateMatrix();
    glassInst.setMatrixAt(i, dummy.matrix);
  }
  for (const inst of [boardInst, railInst, glassInst]) {
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
  }

  // 4 Tall Floodlight Towers + West Marquee Arch ("ICE RINK ARENA") facing the Start Straight
  const lightPoleGeo = new THREE.CylinderGeometry(0.26, 0.34, 14.5, 8);
  lightPoleGeo.translate(0, 7.25, 0);
  const lightPoleMat = makeMat({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.65,
  });
  const lightHeadGeo = new THREE.BoxGeometry(3.2, 0.85, 0.8);
  const lightGlowMat = makeMat({
    color: 0xf8fafc,
    emissive: 0xe0f2fe,
    emissiveIntensity: 2.3,
    roughness: 0.2,
  });
  const towerCorners: Array<[number, number]> = [
    [RINK_X - RINK_W * 0.5 - 2.6, RINK_Z - RINK_D * 0.5 - 2.6],
    [RINK_X + RINK_W * 0.5 + 2.6, RINK_Z - RINK_D * 0.5 - 2.6],
    [RINK_X - RINK_W * 0.5 - 2.6, RINK_Z + RINK_D * 0.5 + 2.6],
    [RINK_X + RINK_W * 0.5 + 2.6, RINK_Z + RINK_D * 0.5 + 2.6],
  ];
  for (const [tx, tz] of towerCorners) {
    const pole = new THREE.Mesh(lightPoleGeo, lightPoleMat);
    pole.position.set(tx, 0, tz);
    pole.castShadow = enableShadows;
    const head = new THREE.Mesh(lightHeadGeo, lightGlowMat);
    head.position.set(tx, 14.4, tz);
    head.lookAt(RINK_X, 0.5, RINK_Z);
    group.add(pole, head);
  }

  // Tall glowing West Rink Entrance Arch visible immediately from start line (gated by showBanners)
  const archSignCanvas = document.createElement('canvas');
  archSignCanvas.width = 512;
  archSignCanvas.height = 128;
  const aCtx = archSignCanvas.getContext('2d')!;
  aCtx.fillStyle = '#0c4a6e';
  aCtx.fillRect(0, 0, 512, 128);
  aCtx.strokeStyle = '#38bdf8';
  aCtx.lineWidth = 8;
  aCtx.strokeRect(6, 6, 500, 116);
  aCtx.fillStyle = '#ffffff';
  aCtx.font = '900 36px sans-serif';
  aCtx.textAlign = 'center';
  aCtx.textBaseline = 'middle';
  aCtx.fillText('GLACIER SKATING RINK', 256, 48);
  aCtx.fillStyle = '#7dd3fc';
  aCtx.font = '700 24px sans-serif';
  aCtx.fillText('OPEN ICE · LIVE SKATERS', 256, 94);
  const archSignTex = new THREE.CanvasTexture(archSignCanvas);
  archSignTex.colorSpace = THREE.SRGBColorSpace;
  archSignTex.anisotropy = aniso;
  const archSignMat = makeMat({ color: 0xffffff, map: archSignTex, roughness: 0.3 });
  const archPillarGeo = new THREE.CylinderGeometry(0.42, 0.5, 11.5, 8);
  const archBannerGeo = new THREE.BoxGeometry(0.8, 3.6, 22.0);
  if (profile.showBanners) {
    const archPillarA = new THREE.Mesh(archPillarGeo, lightPoleMat);
    archPillarA.position.set(RINK_X - RINK_W * 0.5 - 1.5, 5.75, RINK_Z - 11.5);
    archPillarA.castShadow = enableShadows;
    const archPillarB = new THREE.Mesh(archPillarGeo, lightPoleMat);
    archPillarB.position.set(RINK_X - RINK_W * 0.5 - 1.5, 5.75, RINK_Z + 11.5);
    archPillarB.castShadow = enableShadows;
    const archBanner = new THREE.Mesh(archBannerGeo, archSignMat);
    archBanner.position.set(RINK_X - RINK_W * 0.5 - 1.5, 11.2, RINK_Z);
    archBanner.castShadow = enableShadows;
    group.add(archPillarA, archPillarB, archBanner);
  }

  disposables.push(
    rinkApronGeo,
    rinkApronMat,
    rinkIceGeo,
    rinkIceTex,
    rinkIceMat,
    boardMat,
    boardRailMat,
    glassMat,
    segPanelGeo,
    segRailGeo,
    segGlassGeo,
    lightPoleGeo,
    lightPoleMat,
    lightHeadGeo,
    lightGlowMat,
    archSignTex,
    archSignMat,
    archPillarGeo,
    archBannerGeo
  );

  // --- Animated Ice Skating NPCs (wearing bulky jackets, scarves & skates across larger rink) ---
  const SKATER_COUNT = Math.max(14, Math.round(44 * profile.npcDensityScale));
  const SKATER_COAT_COLORS = [
    0x0284c7, 0xe11d48, 0xf97316, 0x0f766e, 0x7c3aed, 0xeab308, 0x0ea5e9,
  ];
  const SKATER_SCARF_COLORS = [
    0xf43f5e, 0xfacc15, 0x38bdf8, 0xf8fafc, 0xfb923c, 0xa855f7,
  ];
  const SKATER_SKIN_COLORS = [0xf1c27d, 0xe0ac69, 0xc68642, 0xffdbac, 0x8d5524];

  interface IceSkaterAgent {
    phase: number;
    angularSpeed: number;
    rx: number;
    rz: number;
    direction: 1 | -1;
    stridePhase: number;
    heightScale: number;
    isFigureSkater: boolean;
    coatColor: THREE.Color;
    scarfColor: THREE.Color;
    pantsColor: THREE.Color;
    skinColor: THREE.Color;
    hatColor: THREE.Color;
  }

  const skaters: IceSkaterAgent[] = Array.from({ length: SKATER_COUNT }, (_, idx) => {
    const isCenterFigure = idx < 6;
    const ringFraction = (idx % 8) / 8;
    return {
      phase: (idx / SKATER_COUNT) * Math.PI * 2,
      angularSpeed: isCenterFigure
        ? 0.65 + (idx % 3) * 0.18
        : 0.22 + (idx % 5) * 0.04,
      rx: isCenterFigure ? 4.5 + idx * 1.9 : 16.5 + ringFraction * 27.5,
      rz: isCenterFigure ? 3.5 + idx * 1.45 : 10.5 + ringFraction * 18.0,
      direction: idx % 4 === 0 ? -1 : 1,
      stridePhase: idx * 1.1,
      heightScale: idx % 5 === 0 ? 0.64 : 0.92 + (idx % 4) * 0.04, // mix of kids & adults skating!
      isFigureSkater: isCenterFigure,
      coatColor: new THREE.Color(SKATER_COAT_COLORS[idx % SKATER_COAT_COLORS.length]),
      scarfColor: new THREE.Color(SKATER_SCARF_COLORS[(idx + 2) % SKATER_SCARF_COLORS.length]),
      pantsColor: new THREE.Color(idx % 2 === 0 ? 0x0f172a : 0x1e293b),
      skinColor: new THREE.Color(SKATER_SKIN_COLORS[idx % SKATER_SKIN_COLORS.length]),
      hatColor: new THREE.Color(SKATER_SCARF_COLORS[(idx + 4) % SKATER_SCARF_COLORS.length]),
    };
  });

  // Shared human/winter clothing geometries for skaters & cheering grandstand crowd
  const winLegGeo = new THREE.BoxGeometry(0.16, 0.72, 0.18);
  winLegGeo.translate(0, -0.36, 0);
  const winTorsoGeo = new THREE.BoxGeometry(0.58, 0.66, 0.36); // bulky winter parka chest
  winTorsoGeo.translate(0, 0.33, 0);
  const winArmGeo = new THREE.BoxGeometry(0.17, 0.56, 0.18); // bulky winter parka sleeves
  winArmGeo.translate(0, -0.28, 0);
  const winHeadGeo = new THREE.BoxGeometry(0.27, 0.27, 0.27);
  const winHatGeo = new THREE.BoxGeometry(0.3, 0.15, 0.3);
  const winScarfCollarGeo = new THREE.BoxGeometry(0.56, 0.16, 0.44);
  winScarfCollarGeo.translate(0, 0.68, 0);
  const skateBladeGeo = new THREE.BoxGeometry(0.05, 0.07, 0.34);
  skateBladeGeo.translate(0, -0.74, 0.04);

  const winterClothMat = makeMat({
    color: 0xffffff,
    roughness: 0.68,
    metalness: 0.06,
  });
  const winterSkinMat = makeMat({
    color: 0xffffff,
    roughness: 0.7,
    metalness: 0.03,
  });
  const skateSteelMat = makeMat({
    color: 0xe2e8f0,
    roughness: 0.15,
    metalness: 0.9,
  });

  const skLeftLegInst = new THREE.InstancedMesh(winLegGeo, winterClothMat, SKATER_COUNT);
  const skRightLegInst = new THREE.InstancedMesh(winLegGeo, winterClothMat, SKATER_COUNT);
  const skLeftBladeInst = new THREE.InstancedMesh(skateBladeGeo, skateSteelMat, SKATER_COUNT);
  const skRightBladeInst = new THREE.InstancedMesh(skateBladeGeo, skateSteelMat, SKATER_COUNT);
  const skTorsoInst = new THREE.InstancedMesh(winTorsoGeo, winterClothMat, SKATER_COUNT);
  const skScarfInst = new THREE.InstancedMesh(winScarfCollarGeo, winterClothMat, SKATER_COUNT);
  const skLeftArmInst = new THREE.InstancedMesh(winArmGeo, winterClothMat, SKATER_COUNT);
  const skRightArmInst = new THREE.InstancedMesh(winArmGeo, winterClothMat, SKATER_COUNT);
  const skHeadInst = new THREE.InstancedMesh(winHeadGeo, winterSkinMat, SKATER_COUNT);
  const skHatInst = new THREE.InstancedMesh(winHatGeo, winterClothMat, SKATER_COUNT);

  for (let i = 0; i < SKATER_COUNT; i++) {
    const sk = skaters[i];
    skLeftLegInst.setColorAt(i, sk.pantsColor);
    skRightLegInst.setColorAt(i, sk.pantsColor);
    skTorsoInst.setColorAt(i, sk.coatColor);
    skScarfInst.setColorAt(i, sk.scarfColor);
    skLeftArmInst.setColorAt(i, sk.coatColor);
    skRightArmInst.setColorAt(i, sk.coatColor);
    skHeadInst.setColorAt(i, sk.skinColor);
    skHatInst.setColorAt(i, sk.hatColor);
  }
  const skaterInsts = [
    skLeftLegInst,
    skRightLegInst,
    skLeftBladeInst,
    skRightBladeInst,
    skTorsoInst,
    skScarfInst,
    skLeftArmInst,
    skRightArmInst,
    skHeadInst,
    skHatInst,
  ];
  for (const inst of skaterInsts) {
    inst.frustumCulled = false;
    inst.castShadow = enableShadows;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
  }

  // =========================================================================
  // 6. 5-TIER SPECTATOR GRANDSTANDS ("Трибуны высотой 4-5 мест") + WINTER CROWD
  // =========================================================================
  const STAND_WIDTH = 28;
  const TIER_COUNT = 5;
  const TIER_STEP_H = 0.78;
  const TIER_STEP_D = 1.18;

  const standConcreteMat = makeMat({ color: 0x334155, roughness: 0.85 });
  const standBenchMat = makeMat({ color: 0x0284c7, roughness: 0.45 });
  const standSteelMat = makeMat({
    color: 0x94a3b8,
    roughness: 0.35,
    metalness: 0.65,
  });
  const standRoofMat = makeMat({ color: 0x0f172a, roughness: 0.5 });
  const standSnowTrimMat = makeMat({ color: 0xf8fafc, roughness: 0.75 });
  const standNeonMat = makeMat({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });

  const tierGeoList: THREE.BufferGeometry[] = [];
  interface SpectatorAgent {
    x: number;
    y: number;
    z: number;
    yaw: number;
    wavePhase: number;
    heightScale: number;
    coatColor: THREE.Color;
    scarfColor: THREE.Color;
    skinColor: THREE.Color;
    hatColor: THREE.Color;
  }
  const spectators: SpectatorAgent[] = [];
  const colsPerTier = simpleMat ? 5 : 9;

  for (let sIdx = 0; sIdx < grandstandPlacements.length; sIdx++) {
    const gp = grandstandPlacements[sIdx];
    const standGroup = new THREE.Group();
    standGroup.position.set(gp.x, 0, gp.z);
    standGroup.rotation.y = gp.yaw;

    // 5 stepped seating tiers (local +Z faces toward track/rink)
    for (let tier = 0; tier < TIER_COUNT; tier++) {
      const riserH = (tier + 1) * TIER_STEP_H;
      const tierZ = 2.4 - tier * TIER_STEP_D;

      const riserGeo = new THREE.BoxGeometry(STAND_WIDTH, riserH, TIER_STEP_D);
      const riserMesh = new THREE.Mesh(riserGeo, standConcreteMat);
      riserMesh.position.set(0, riserH * 0.5, tierZ);
      riserMesh.castShadow = enableShadows;
      riserMesh.receiveShadow = enableShadows;
      standGroup.add(riserMesh);
      tierGeoList.push(riserGeo);

      const benchGeo = new THREE.BoxGeometry(STAND_WIDTH - 0.8, 0.14, 0.58);
      const benchMesh = new THREE.Mesh(benchGeo, standBenchMat);
      benchMesh.position.set(0, riserH + 0.08, tierZ + 0.08);
      standGroup.add(benchMesh);
      tierGeoList.push(benchGeo);
    }

    // Back windscreen wall + steel roof columns + overhanging roof canopy + snow trim
    const backWallZ = 2.4 - TIER_COUNT * TIER_STEP_D - 0.15;
    const topTierY = TIER_COUNT * TIER_STEP_H;
    const roofY = topTierY + 2.45;

    const backWallGeo = new THREE.BoxGeometry(STAND_WIDTH, roofY, 0.35);
    const backWall = new THREE.Mesh(backWallGeo, standConcreteMat);
    backWall.position.set(0, roofY * 0.5, backWallZ);
    backWall.castShadow = enableShadows;
    backWall.receiveShadow = enableShadows;
    standGroup.add(backWall);

    const sideWallGeo = new THREE.BoxGeometry(0.35, roofY, TIER_COUNT * TIER_STEP_D + 0.5);
    for (const sx of [-STAND_WIDTH * 0.5, STAND_WIDTH * 0.5]) {
      const sw = new THREE.Mesh(sideWallGeo, standConcreteMat);
      sw.position.set(sx, roofY * 0.5, backWallZ + (TIER_COUNT * TIER_STEP_D + 0.3) * 0.5);
      sw.castShadow = enableShadows;
      sw.receiveShadow = enableShadows;
      standGroup.add(sw);
    }

    const colGeo = new THREE.CylinderGeometry(0.18, 0.22, roofY, 8);
    for (let cx = -STAND_WIDTH * 0.5 + 1.4; cx <= STAND_WIDTH * 0.5 - 1.4; cx += 6.2) {
      const col = new THREE.Mesh(colGeo, standSteelMat);
      col.position.set(cx, roofY * 0.5, backWallZ + 0.35);
      standGroup.add(col);
    }

    const roofGeo = new THREE.BoxGeometry(STAND_WIDTH + 1.2, 0.32, TIER_COUNT * TIER_STEP_D + 1.9);
    const roofMesh = new THREE.Mesh(roofGeo, standRoofMat);
    roofMesh.position.set(0, roofY, backWallZ + (TIER_COUNT * TIER_STEP_D + 1.2) * 0.5);
    roofMesh.rotation.x = 0.08;
    roofMesh.castShadow = enableShadows;
    standGroup.add(roofMesh);

    const roofSnowGeo = new THREE.BoxGeometry(STAND_WIDTH + 1.25, 0.18, TIER_COUNT * TIER_STEP_D + 1.95);
    const roofSnow = new THREE.Mesh(roofSnowGeo, standSnowTrimMat);
    roofSnow.position.set(0, roofY + 0.22, backWallZ + (TIER_COUNT * TIER_STEP_D + 1.2) * 0.5);
    roofSnow.rotation.x = 0.08;
    standGroup.add(roofSnow);

    const fasciaGeo = new THREE.BoxGeometry(STAND_WIDTH - 2.0, 0.36, 0.18);
    const fascia = new THREE.Mesh(fasciaGeo, standNeonMat);
    fascia.position.set(0, roofY - 0.18, 2.4 + 0.95);
    standGroup.add(fascia);

    tierGeoList.push(backWallGeo, sideWallGeo, colGeo, roofGeo, roofSnowGeo, fasciaGeo);
    group.add(standGroup);

    // Populate cheering winter fans across all 5 tiers
    const sinY = Math.sin(gp.yaw);
    const cosY = Math.cos(gp.yaw);
    for (let tier = 0; tier < TIER_COUNT; tier++) {
      const seatY = (tier + 1) * TIER_STEP_H + 0.15;
      const localZ = 2.4 - tier * TIER_STEP_D + 0.1;
      for (let col = 0; col < colsPerTier; col++) {
        const localX =
          -11.2 +
          col * (22.4 / Math.max(1, colsPerTier - 1)) +
          ((tier % 2) * 0.7 - 0.35);
        const wx = gp.x + localX * cosY + localZ * sinY;
        const wz = gp.z - localX * sinY + localZ * cosY;
        const seedIdx = sIdx * 45 + tier * colsPerTier + col;
        spectators.push({
          x: wx,
          y: seatY,
          z: wz,
          yaw: gp.yaw + (((seedIdx % 5) - 2) * 0.06),
          wavePhase: seedIdx * 0.65,
          heightScale: seedIdx % 6 === 0 ? 0.66 : 0.94 + (seedIdx % 3) * 0.04,
          coatColor: new THREE.Color(
            SKATER_COAT_COLORS[seedIdx % SKATER_COAT_COLORS.length]
          ),
          scarfColor: new THREE.Color(
            SKATER_SCARF_COLORS[(seedIdx + 1) % SKATER_SCARF_COLORS.length]
          ),
          skinColor: new THREE.Color(
            SKATER_SKIN_COLORS[seedIdx % SKATER_SKIN_COLORS.length]
          ),
          hatColor: new THREE.Color(
            SKATER_SCARF_COLORS[(seedIdx + 3) % SKATER_SCARF_COLORS.length]
          ),
        });
      }
    }
  }

  const spCount = spectators.length;
  const spTorsoInst = new THREE.InstancedMesh(winTorsoGeo, winterClothMat, spCount);
  const spScarfInst = new THREE.InstancedMesh(winScarfCollarGeo, winterClothMat, spCount);
  const spLeftArmInst = new THREE.InstancedMesh(winArmGeo, winterClothMat, spCount);
  const spRightArmInst = new THREE.InstancedMesh(winArmGeo, winterClothMat, spCount);
  const spHeadInst = new THREE.InstancedMesh(winHeadGeo, winterSkinMat, spCount);
  const spHatInst = new THREE.InstancedMesh(winHatGeo, winterClothMat, spCount);

  for (let i = 0; i < spCount; i++) {
    const sp = spectators[i];
    spTorsoInst.setColorAt(i, sp.coatColor);
    spScarfInst.setColorAt(i, sp.scarfColor);
    spLeftArmInst.setColorAt(i, sp.coatColor);
    spRightArmInst.setColorAt(i, sp.coatColor);
    spHeadInst.setColorAt(i, sp.skinColor);
    spHatInst.setColorAt(i, sp.hatColor);
  }
  const spectatorInsts = [
    spTorsoInst,
    spScarfInst,
    spLeftArmInst,
    spRightArmInst,
    spHeadInst,
    spHatInst,
  ];
  for (const inst of spectatorInsts) {
    inst.frustumCulled = false;
    inst.castShadow = enableShadows;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
  }

  // =========================================================================
  // 7. ARCTIC FUEL 24H CAR GAS STATION & PARKING LOT ("Авто-заправочная стоянка")
  // =========================================================================
  const gasGroup = new THREE.Group();
  gasGroup.position.set(GAS_X, 0, GAS_Z);
  gasGroup.rotation.y = GAS_YAW;
  group.add(gasGroup);

  const gasAsphaltMat = makeMat({ color: 0x1e293b, roughness: 0.88 });
  const gasCanopyMat = makeMat({ color: 0xf8fafc, roughness: 0.4 });
  const gasAccentCyanMat = makeMat({
    color: 0x06b6d4,
    emissive: 0x0284c7,
    emissiveIntensity: 1.4,
    roughness: 0.25,
  });
  const gasAccentAmberMat = makeMat({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 1.0,
    roughness: 0.3,
  });
  const gasMartWallMat = makeMat({ color: 0x334155, roughness: 0.65 });
  const gasGlassMat = makeMat({
    color: 0xfef08a,
    emissive: 0xfbbf24,
    emissiveIntensity: 1.45,
    roughness: 0.2,
  });

  const gasSignCanvas = document.createElement('canvas');
  gasSignCanvas.width = 512;
  gasSignCanvas.height = 160;
  const gCtx = gasSignCanvas.getContext('2d')!;
  gCtx.fillStyle = '#0f172a';
  gCtx.fillRect(0, 0, 512, 160);
  gCtx.strokeStyle = '#38bdf8';
  gCtx.lineWidth = 10;
  gCtx.strokeRect(8, 8, 496, 144);
  gCtx.fillStyle = '#38bdf8';
  gCtx.font = '900 50px sans-serif';
  gCtx.textAlign = 'center';
  gCtx.textBaseline = 'middle';
  gCtx.fillText('ARCTIC FUEL · 24H', 256, 62);
  gCtx.fillStyle = '#facc15';
  gCtx.font = '800 26px sans-serif';
  gCtx.fillText('95  $1.49  ·  DIESEL  $1.39', 256, 118);
  const gasSignTex = new THREE.CanvasTexture(gasSignCanvas);
  gasSignTex.colorSpace = THREE.SRGBColorSpace;
  gasSignTex.anisotropy = aniso;
  const gasSignMat = makeMat({ color: 0xffffff, map: gasSignTex, roughness: 0.3 });

  // Paved station forecourt + parking lot pad (22m deep x 32m long along straight)
  const gasPadGeo = new THREE.BoxGeometry(32, 0.24, 22);
  const gasPad = new THREE.Mesh(gasPadGeo, gasAsphaltMat);
  gasPad.position.set(0, 0.12, 0);
  gasPad.receiveShadow = enableShadows;

  // Yellow parking bay lines on north & south ends of forecourt
  const bayLineGeo = new THREE.BoxGeometry(0.18, 0.03, 4.6);
  const bayMat = makeMat({ color: 0xfacc15, roughness: 0.5 });
  for (const bx of [-12.5, -9.8, -7.1, 7.1, 9.8, 12.5]) {
    const line = new THREE.Mesh(bayLineGeo, bayMat);
    line.position.set(bx, 0.25, 7.4);
    gasGroup.add(line);
  }

  // Tall glowing fuel canopy on 4 pillars
  const canopyRoofGeo = new THREE.BoxGeometry(14.5, 0.7, 11.5);
  const canopyRoof = new THREE.Mesh(canopyRoofGeo, gasCanopyMat);
  canopyRoof.position.set(0, 5.6, 2.5);
  canopyRoof.castShadow = enableShadows;
  canopyRoof.receiveShadow = enableShadows;
  const canopySnowGeo = new THREE.BoxGeometry(14.6, 0.28, 11.6);
  const canopySnow = new THREE.Mesh(canopySnowGeo, standSnowTrimMat);
  canopySnow.position.set(0, 6.08, 2.5);
  const canopyTrimGeo = new THREE.BoxGeometry(14.7, 0.26, 11.7);
  const canopyTrim = new THREE.Mesh(canopyTrimGeo, gasAccentCyanMat);
  canopyTrim.position.set(0, 5.32, 2.5);
  const canopySignGeo = new THREE.BoxGeometry(11.0, 1.35, 0.22);
  const canopySign = new THREE.Mesh(canopySignGeo, gasSignMat);
  canopySign.position.set(0, 5.7, 8.38);

  const gasColGeo = new THREE.CylinderGeometry(0.28, 0.32, 5.3, 8);
  for (const cx of [-5.8, 5.8]) {
    for (const cz of [-2.2, 7.0]) {
      const col = new THREE.Mesh(gasColGeo, gasCanopyMat);
      col.position.set(cx, 2.75, cz);
      col.castShadow = enableShadows;
      gasGroup.add(col);
    }
  }

  // 4 Fuel Pump Islands with illuminated dispensers
  const islandGeo = new THREE.BoxGeometry(3.4, 0.24, 1.4);
  const pumpGeo = new THREE.BoxGeometry(0.95, 1.9, 0.65);
  const pumpCapGeo = new THREE.BoxGeometry(1.05, 0.26, 0.75);
  for (const px of [-3.4, 3.4]) {
    for (const pz of [0.3, 4.6]) {
      const isl = new THREE.Mesh(islandGeo, standConcreteMat);
      isl.position.set(px, 0.26, pz);
      const pump = new THREE.Mesh(pumpGeo, gasCanopyMat);
      pump.position.set(px, 1.28, pz);
      pump.castShadow = enableShadows;
      const cap = new THREE.Mesh(pumpCapGeo, gasAccentAmberMat);
      cap.position.set(px, 2.35, pz);
      gasGroup.add(isl, pump, cap);
    }
  }

  // 24H Convenience Mart & Coffee Building at back of forecourt
  const martBodyGeo = new THREE.BoxGeometry(15.5, 4.4, 6.8);
  const martBody = new THREE.Mesh(martBodyGeo, gasMartWallMat);
  martBody.position.set(0, 2.4, -6.6);
  martBody.castShadow = enableShadows;
  martBody.receiveShadow = enableShadows;
  const martRoofSnowGeo = new THREE.BoxGeometry(16.1, 0.45, 7.4);
  const martRoofSnow = new THREE.Mesh(martRoofSnowGeo, standSnowTrimMat);
  martRoofSnow.position.set(0, 4.82, -6.6);
  const martWinGeo = new THREE.BoxGeometry(12.2, 2.3, 0.18);
  const martWin = new THREE.Mesh(martWinGeo, gasGlassMat);
  martWin.position.set(0, 2.2, -3.14);

  // Tall roadside illuminated fuel price pylon facing incoming drivers
  const pylonPoleGeo = new THREE.BoxGeometry(0.45, 9.5, 0.45);
  const pylonPole = new THREE.Mesh(pylonPoleGeo, gasMartWallMat);
  pylonPole.position.set(14.2, 4.75, 8.8);
  pylonPole.castShadow = enableShadows;
  const pylonBoardGeo = new THREE.BoxGeometry(4.4, 2.4, 0.42);
  const pylonBoard = new THREE.Mesh(pylonBoardGeo, gasSignMat);
  pylonBoard.position.set(14.2, 8.2, 8.8);
  pylonBoard.rotation.y = Math.PI * 0.25;

  // 3 Parked Winter Vehicles in Painted Stalls + Beside Fuel Island
  const parkedCarBodyGeo = new THREE.BoxGeometry(2.05, 0.85, 4.35);
  const parkedCarCabinGeo = new THREE.BoxGeometry(1.75, 0.68, 2.15);
  const parkedWheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
  parkedWheelGeo.rotateZ(Math.PI / 2);
  const tireMat = makeMat({ color: 0x0f172a, roughness: 0.9 });
  const parkedSpecs = [
    { x: -11.15, z: 7.4, yaw: 0, color: 0xdc2626 },
    { x: -8.45, z: 7.4, yaw: Math.PI, color: 0x0284c7 },
    { x: 11.15, z: 7.4, yaw: 0, color: 0xfacc15 },
  ];
  const parkedCarMats: THREE.Material[] = [];
  for (const pc of parkedSpecs) {
    const cg = new THREE.Group();
    cg.position.set(pc.x, 0.24, pc.z);
    cg.rotation.y = pc.yaw;
    const cm = makeMat({ color: pc.color, roughness: 0.3, metalness: 0.45 });
    parkedCarMats.push(cm);
    const body = new THREE.Mesh(parkedCarBodyGeo, cm);
    body.position.y = 0.62;
    body.castShadow = enableShadows;
    const cabin = new THREE.Mesh(parkedCarCabinGeo, cm);
    cabin.position.set(0, 1.32, -0.2);
    cabin.castShadow = enableShadows;
    cg.add(body, cabin);
    for (const wx of [-0.95, 0.95]) {
      for (const wz of [-1.35, 1.35]) {
        const w = new THREE.Mesh(parkedWheelGeo, tireMat);
        w.position.set(wx, 0.36, wz);
        cg.add(w);
      }
    }
    gasGroup.add(cg);
  }

  gasGroup.add(
    gasPad,
    canopyRoof,
    canopySnow,
    canopyTrim,
    martBody,
    martRoofSnow,
    martWin,
    pylonPole
  );
  if (profile.showBanners) {
    gasGroup.add(canopySign, pylonBoard);
  }

  disposables.push(
    gasAsphaltMat,
    gasCanopyMat,
    gasAccentCyanMat,
    gasAccentAmberMat,
    gasMartWallMat,
    gasGlassMat,
    gasSignTex,
    gasSignMat,
    gasPadGeo,
    bayLineGeo,
    bayMat,
    canopyRoofGeo,
    canopySnowGeo,
    canopyTrimGeo,
    canopySignGeo,
    gasColGeo,
    islandGeo,
    pumpGeo,
    pumpCapGeo,
    martBodyGeo,
    martRoofSnowGeo,
    martWinGeo,
    pylonPoleGeo,
    pylonBoardGeo,
    parkedCarBodyGeo,
    parkedCarCabinGeo,
    parkedWheelGeo,
    tireMat,
    ...parkedCarMats
  );

  // =========================================================================
  // 8. 5 ALPINE WOODEN LOG CABIN VILLAGES ("Деревянные домики и деревни")
  // =========================================================================
  const logDim = Math.max(64, Math.round(256 * texScale));
  const logCanvas = document.createElement('canvas');
  logCanvas.width = logDim;
  logCanvas.height = logDim;
  const lCtx = logCanvas.getContext('2d')!;
  if (logDim !== 256) {
    lCtx.scale(logDim / 256, logDim / 256);
  }
  lCtx.fillStyle = '#92400e';
  lCtx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 12; row++) {
    const y = (row * 256) / 12;
    lCtx.fillStyle = row % 2 === 0 ? '#78350f' : '#9a4f1b';
    lCtx.fillRect(0, y + 2, 256, 17);
    lCtx.fillStyle = '#451a03';
    lCtx.fillRect(0, y, 256, 3);
  }
  const logTex = new THREE.CanvasTexture(logCanvas);
  logTex.colorSpace = THREE.SRGBColorSpace;
  logTex.wrapS = THREE.RepeatWrapping;
  logTex.wrapT = THREE.RepeatWrapping;
  logTex.anisotropy = aniso;

  const cabinLogMat = makeMat({ color: 0xffffff, map: logTex, roughness: 0.82 });
  const cabinStoneMat = makeMat({ color: 0x475569, roughness: 0.9 });
  const cabinRoofMat = makeMat({ color: 0x7c2d12, roughness: 0.78 });
  const cabinSnowRoofMat = makeMat({ color: 0xf8fafc, roughness: 0.72 });
  const cabinDoorMat = makeMat({ color: 0x451a03, roughness: 0.85 });
  const cabinGlowWinMat = makeMat({
    color: 0xfef3c7,
    emissive: 0xfbbf24,
    emissiveIntensity: 1.9,
    roughness: 0.25,
  });

  const smokePuffs: Array<{
    mesh: THREE.Mesh;
    baseX: number;
    baseY: number;
    baseZ: number;
    phase: number;
  }> = [];
  const smokeGeo = new THREE.SphereGeometry(0.42, 8, 6);
  const smokeMat = makeMat({
    color: 0xe2e8f0,
    transparent: true,
    opacity: 0.45,
    roughness: 1.0,
  });

  const cabinBaseGeo = new THREE.BoxGeometry(1, 0.65, 1);
  const cabinWallGeo = new THREE.BoxGeometry(1, 1, 1);
  const cabinRoofGeo = new THREE.ConeGeometry(0.8, 0.7, 4);
  cabinRoofGeo.rotateY(Math.PI / 4);
  const cabinPorchGeo = new THREE.BoxGeometry(0.55, 0.24, 0.35);
  const cabinDoorGeo = new THREE.BoxGeometry(0.24, 0.55, 0.08);
  const cabinWinGeo = new THREE.BoxGeometry(0.24, 0.26, 0.08);
  const cabinChimneyGeo = new THREE.BoxGeometry(0.18, 0.65, 0.18);
  const fencePostGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.1, 6);
  const fenceRailGeo = new THREE.BoxGeometry(4.4, 0.12, 0.12);
  const lanternPoleGeo = new THREE.CylinderGeometry(0.08, 0.11, 3.4, 6);
  const lanternBulbGeo = new THREE.OctahedronGeometry(0.26, 0);

  const CABIN_LAYOUT: Array<{ lx: number; lz: number; yaw: number; w: number; h: number; d: number }> = [
    { lx: -12, lz: -10, yaw: 0.2, w: 6.4, h: 3.4, d: 5.4 },
    { lx: 11, lz: -11, yaw: -0.3, w: 7.2, h: 3.8, d: 5.8 },
    { lx: -14, lz: 9, yaw: 1.1, w: 5.8, h: 3.2, d: 4.8 },
    { lx: 12, lz: 10, yaw: -1.2, w: 6.6, h: 3.5, d: 5.2 },
    { lx: 0, lz: -16, yaw: 0.0, w: 8.2, h: 4.2, d: 6.2 }, // Village Lodge Hall
  ];

  for (let vIdx = 0; vIdx < VILLAGE_CENTERS.length; vIdx++) {
    const vc = VILLAGE_CENTERS[vIdx];
    const vg = new THREE.Group();
    vg.position.set(vc.x, 0, vc.z);
    vg.rotation.y = vc.yaw;
    group.add(vg);

    const sinV = Math.sin(vc.yaw);
    const cosV = Math.cos(vc.yaw);

    // Central Village Snow Plaza Lantern
    const cPole = new THREE.Mesh(lanternPoleGeo, cabinDoorMat);
    cPole.position.set(0, 1.7, 0);
    const cBulb = new THREE.Mesh(lanternBulbGeo, cabinGlowWinMat);
    cBulb.position.set(0, 3.5, 0);
    vg.add(cPole, cBulb);

    CABIN_LAYOUT.forEach((cb, cIdx) => {
      const cg = new THREE.Group();
      cg.position.set(cb.lx, 0, cb.lz);
      cg.rotation.y = cb.yaw;

      const plinth = new THREE.Mesh(cabinBaseGeo, cabinStoneMat);
      plinth.scale.set(cb.w + 0.5, 1, cb.d + 0.5);
      plinth.position.y = 0.32;

      const walls = new THREE.Mesh(cabinWallGeo, cabinLogMat);
      walls.scale.set(cb.w, cb.h, cb.d);
      walls.position.y = 0.65 + cb.h * 0.5;
      walls.castShadow = enableShadows;
      walls.receiveShadow = enableShadows;

      const roof = new THREE.Mesh(cabinRoofGeo, cabinRoofMat);
      roof.scale.set(cb.w * 1.18, cb.h * 1.05, cb.d * 1.18);
      roof.position.y = 0.65 + cb.h + cb.h * 0.34;
      roof.castShadow = enableShadows;

      const snowRoof = new THREE.Mesh(cabinRoofGeo, cabinSnowRoofMat);
      snowRoof.scale.set(cb.w * 1.19, cb.h * 0.96, cb.d * 1.19);
      snowRoof.position.y = 0.65 + cb.h + cb.h * 0.4;

      const porch = new THREE.Mesh(cabinPorchGeo, cabinDoorMat);
      porch.scale.set(cb.w * 0.72, 1, 1.6);
      porch.position.set(0, 0.45, cb.d * 0.5 + 0.55);

      const door = new THREE.Mesh(cabinDoorGeo, cabinDoorMat);
      door.scale.set(cb.w * 0.85, cb.h * 0.95, 1);
      door.position.set(0, 0.65 + cb.h * 0.28, cb.d * 0.5 + 0.04);

      const winL = new THREE.Mesh(cabinWinGeo, cabinGlowWinMat);
      winL.scale.set(cb.w * 0.85, cb.h * 0.85, 1);
      winL.position.set(-cb.w * 0.28, 0.65 + cb.h * 0.54, cb.d * 0.5 + 0.04);

      const winR = new THREE.Mesh(cabinWinGeo, cabinGlowWinMat);
      winR.scale.set(cb.w * 0.85, cb.h * 0.85, 1);
      winR.position.set(cb.w * 0.28, 0.65 + cb.h * 0.54, cb.d * 0.5 + 0.04);

      const chimney = new THREE.Mesh(cabinChimneyGeo, cabinStoneMat);
      chimney.scale.set(cb.w * 0.8, cb.h * 0.9, cb.d * 0.8);
      chimney.position.set(cb.w * 0.22, 0.65 + cb.h * 1.3, -cb.d * 0.14);

      cg.add(plinth, walls, roof, snowRoof, porch, door, winL, winR, chimney);
      vg.add(cg);

      if (!simpleMat) {
        // Compute world chimney top for rising animated smoke puffs (2 puffs per cabin)
        const totalYaw = vc.yaw + cb.yaw;
        const chimLocalX = cb.w * 0.22;
        const chimLocalZ = -cb.d * 0.14;
        const chimWorldInVgX =
          cb.lx + chimLocalX * Math.cos(cb.yaw) + chimLocalZ * Math.sin(cb.yaw);
        const chimWorldInVgZ =
          cb.lz - chimLocalX * Math.sin(cb.yaw) + chimLocalZ * Math.cos(cb.yaw);
        const wx = vc.x + chimWorldInVgX * cosV + chimWorldInVgZ * sinV;
        const wz = vc.z - chimWorldInVgX * sinV + chimWorldInVgZ * cosV;
        const chimTopY = 0.65 + cb.h * 1.62;

        for (let sp = 0; sp < 2; sp++) {
          const puff = new THREE.Mesh(smokeGeo, smokeMat);
          puff.position.set(wx, chimTopY + sp * 1.1, wz);
          group.add(puff);
          smokePuffs.push({
            mesh: puff,
            baseX: wx,
            baseY: chimTopY,
            baseZ: wz,
            phase: vIdx * 1.3 + cIdx * 0.9 + sp * 0.5 + totalYaw * 0.05,
          });
        }
      }
    });

    // Timber split-rail fence segments around village perimeter
    for (let f = 0; f < 4; f++) {
      const ang = (f / 4) * Math.PI * 2 + 0.35;
      const fx = Math.cos(ang) * 20;
      const fz = Math.sin(ang) * 20;
      const railTop = new THREE.Mesh(fenceRailGeo, cabinDoorMat);
      railTop.position.set(fx, 0.82, fz);
      railTop.rotation.y = -ang + Math.PI / 2;
      const railBot = new THREE.Mesh(fenceRailGeo, cabinDoorMat);
      railBot.position.set(fx, 0.44, fz);
      railBot.rotation.y = -ang + Math.PI / 2;
      const postA = new THREE.Mesh(fencePostGeo, cabinDoorMat);
      postA.position.set(fx - Math.sin(ang) * 2.0, 0.55, fz + Math.cos(ang) * 2.0);
      const postB = new THREE.Mesh(fencePostGeo, cabinDoorMat);
      postB.position.set(fx + Math.sin(ang) * 2.0, 0.55, fz - Math.cos(ang) * 2.0);
      vg.add(railTop, railBot, postA, postB);
    }
  }

  disposables.push(
    logTex,
    cabinLogMat,
    cabinStoneMat,
    cabinRoofMat,
    cabinSnowRoofMat,
    cabinDoorMat,
    cabinGlowWinMat,
    smokeGeo,
    smokeMat,
    cabinBaseGeo,
    cabinWallGeo,
    cabinRoofGeo,
    cabinPorchGeo,
    cabinDoorGeo,
    cabinWinGeo,
    cabinChimneyGeo,
    fencePostGeo,
    fenceRailGeo,
    lanternPoleGeo,
    lanternBulbGeo
  );

  disposables.push(
    spireGeo,
    subSpireGeo,
    snowCapGeo,
    iceCrystalMat,
    snowCapMat,
    winLegGeo,
    winTorsoGeo,
    winArmGeo,
    winHeadGeo,
    winHatGeo,
    winScarfCollarGeo,
    skateBladeGeo,
    winterClothMat,
    winterSkinMat,
    skateSteelMat,
    standConcreteMat,
    standBenchMat,
    standSteelMat,
    standRoofMat,
    standSnowTrimMat,
    standNeonMat,
    ...tierGeoList
  );

  const animDummy = new THREE.Object3D();
  animDummy.rotation.order = 'YXZ';

  function update(dt: number, elapsed: number): void {
    // 1. Pulse arctic hazard beacons & gently bob ice floes in water basins
    const pulse = 1.3 + Math.sin(elapsed * 5.2) * 0.85;
    beaconLampMat.emissiveIntensity = pulse;
    for (const f of floes) {
      f.mesh.position.y = f.baseY + Math.sin(elapsed * 1.8 + f.phase) * 0.045;
    }

    // 1b. Rising chimney smoke puffs above wooden alpine village cabins
    for (const sp of smokePuffs) {
      const cycle = ((elapsed * 0.38 + sp.phase) % 1 + 1) % 1;
      sp.mesh.position.set(
        sp.baseX + Math.sin(elapsed * 1.4 + sp.phase) * 0.35 + cycle * 0.7,
        sp.baseY + cycle * 3.8,
        sp.baseZ + Math.cos(elapsed * 1.1 + sp.phase) * 0.25
      );
      const s = 0.55 + cycle * 1.35;
      sp.mesh.scale.setScalar(s * (1 - cycle * 0.35));
    }

    // 2. Animate 44 Ice Skating NPCs smoothly across the Enlarged Skating Rink
    for (let i = 0; i < skaters.length; i++) {
      const sk = skaters[i];
      sk.phase += sk.direction * sk.angularSpeed * dt;
      sk.stridePhase += (sk.isFigureSkater ? 6.2 : 5.0) * dt;

      const cosP = Math.cos(sk.phase);
      const sinP = Math.sin(sk.phase);
      const x = RINK_X + cosP * sk.rx;
      const z = RINK_Z + sinP * sk.rz;
      const vx = -sinP * sk.rx * sk.direction;
      const vz = cosP * sk.rz * sk.direction;
      const yaw = sk.isFigureSkater && i % 2 === 0
        ? elapsed * 3.8 + i
        : Math.atan2(vx, vz);

      const rightX = -Math.cos(yaw);
      const rightZ = Math.sin(yaw);
      const hs = sk.heightScale;
      const glideSwing = Math.sin(sk.stridePhase) * (sk.isFigureSkater ? 0.32 : 0.62);
      const leanRoll = sk.isFigureSkater ? 0.14 : -0.1 * sk.direction;
      const iceY = 0.15;
      const hipY = iceY + 0.76 * hs;
      const shoulderY = iceY + 1.38 * hs;
      const hipOffset = 0.11 * hs;
      const shoulderOffset = 0.36 * hs;

      // Left Leg & Ice Skate Blade
      animDummy.position.set(x - rightX * hipOffset, hipY, z - rightZ * hipOffset);
      animDummy.rotation.set(glideSwing, yaw, leanRoll, 'YXZ');
      animDummy.scale.setScalar(hs);
      animDummy.updateMatrix();
      skLeftLegInst.setMatrixAt(i, animDummy.matrix);
      skLeftBladeInst.setMatrixAt(i, animDummy.matrix);

      // Right Leg & Ice Skate Blade
      animDummy.position.set(x + rightX * hipOffset, hipY, z + rightZ * hipOffset);
      animDummy.rotation.set(-glideSwing, yaw, leanRoll, 'YXZ');
      animDummy.scale.setScalar(hs);
      animDummy.updateMatrix();
      skRightLegInst.setMatrixAt(i, animDummy.matrix);
      skRightBladeInst.setMatrixAt(i, animDummy.matrix);

      // Bulky Parka Torso & Scarf
      animDummy.position.set(x, hipY, z);
      animDummy.rotation.set(0.12, yaw, leanRoll, 'YXZ');
      animDummy.scale.setScalar(hs);
      animDummy.updateMatrix();
      skTorsoInst.setMatrixAt(i, animDummy.matrix);
      skScarfInst.setMatrixAt(i, animDummy.matrix);

      // Arms (graceful skater balance arms)
      animDummy.position.set(x - rightX * shoulderOffset, shoulderY, z - rightZ * shoulderOffset);
      animDummy.rotation.set(-glideSwing * 0.75, yaw, sk.isFigureSkater ? 0.85 : 0.25, 'YXZ');
      animDummy.scale.setScalar(hs);
      animDummy.updateMatrix();
      skLeftArmInst.setMatrixAt(i, animDummy.matrix);

      animDummy.position.set(x + rightX * shoulderOffset, shoulderY, z + rightZ * shoulderOffset);
      animDummy.rotation.set(glideSwing * 0.75, yaw, sk.isFigureSkater ? -0.85 : -0.25, 'YXZ');
      animDummy.scale.setScalar(hs);
      animDummy.updateMatrix();
      skRightArmInst.setMatrixAt(i, animDummy.matrix);

      // Head & Knit Beanie
      const headS = hs < 0.75 ? hs * 1.15 : hs;
      animDummy.position.set(x, iceY + 1.56 * hs, z);
      animDummy.rotation.set(0, yaw, leanRoll, 'YXZ');
      animDummy.scale.setScalar(headS);
      animDummy.updateMatrix();
      skHeadInst.setMatrixAt(i, animDummy.matrix);

      animDummy.position.set(x, iceY + 1.69 * hs, z);
      animDummy.scale.setScalar(headS);
      animDummy.updateMatrix();
      skHatInst.setMatrixAt(i, animDummy.matrix);
    }
    for (const inst of skaterInsts) {
      inst.instanceMatrix.needsUpdate = true;
    }

    // 3. Animate Cheering Grandstand Crowd
    for (let i = 0; i < spectators.length; i++) {
      const sp = spectators[i];
      const hs = sp.heightScale;
      const bounce = Math.max(0, Math.sin(elapsed * 4.4 + sp.wavePhase)) * 0.14 * hs;
      const cheerArm = 2.15 + Math.sin(elapsed * 6.5 + sp.wavePhase) * 0.65;
      const rightX = -Math.cos(sp.yaw);
      const rightZ = Math.sin(sp.yaw);
      const shoulderOffset = 0.36 * hs;
      const hipY = sp.y + 0.16 * hs + bounce;
      const shoulderY = hipY + 0.62 * hs;

      animDummy.position.set(sp.x, hipY, sp.z);
      animDummy.rotation.set(0, sp.yaw, 0, 'YXZ');
      animDummy.scale.setScalar(hs);
      animDummy.updateMatrix();
      spTorsoInst.setMatrixAt(i, animDummy.matrix);
      spScarfInst.setMatrixAt(i, animDummy.matrix);

      animDummy.position.set(
        sp.x - rightX * shoulderOffset,
        shoulderY,
        sp.z - rightZ * shoulderOffset
      );
      animDummy.rotation.set(-cheerArm, sp.yaw, 0.28, 'YXZ');
      animDummy.scale.setScalar(hs);
      animDummy.updateMatrix();
      spLeftArmInst.setMatrixAt(i, animDummy.matrix);

      animDummy.position.set(
        sp.x + rightX * shoulderOffset,
        shoulderY,
        sp.z + rightZ * shoulderOffset
      );
      animDummy.rotation.set(-cheerArm * 0.92, sp.yaw, -0.28, 'YXZ');
      animDummy.scale.setScalar(hs);
      animDummy.updateMatrix();
      spRightArmInst.setMatrixAt(i, animDummy.matrix);

      const headS = hs < 0.75 ? hs * 1.15 : hs;
      animDummy.position.set(sp.x, hipY + 0.8 * hs, sp.z);
      animDummy.rotation.set(0, sp.yaw, 0, 'YXZ');
      animDummy.scale.setScalar(headS);
      animDummy.updateMatrix();
      spHeadInst.setMatrixAt(i, animDummy.matrix);

      animDummy.position.set(sp.x, hipY + 0.93 * hs, sp.z);
      animDummy.scale.setScalar(headS);
      animDummy.updateMatrix();
      spHatInst.setMatrixAt(i, animDummy.matrix);
    }
    for (const inst of spectatorInsts) {
      inst.instanceMatrix.needsUpdate = true;
    }
  }

  // Initial matrix pose
  update(0, 0);

  return {
    group,
    update,
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
