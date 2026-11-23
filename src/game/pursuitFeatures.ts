import * as THREE from 'three';
import type { MapId, PursuitObstacle } from './types';
import { sampleAtT, type RaceTrack } from './track';
import { buildNightCityFeatures } from './nightCityFeatures';
import { getGraphicsProfile, type GraphicsQuality } from './graphics';
import { createSoftGlowDiscTexture } from './sharedTextures';

export interface PursuitFeaturesSystem {
  group: THREE.Group;
  syncObstacles: (obstacles: PursuitObstacle[]) => void;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

function createSkyGlowTexture(rgbaInner: string, rgbaMid: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, rgbaInner);
  grad.addColorStop(0.45, rgbaMid);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createIndustrialWindowTexture(maxAnisotropy: number): {
  colorMap: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const emCanvas = document.createElement('canvas');
  emCanvas.width = 256;
  emCanvas.height = 512;
  const eCtx = emCanvas.getContext('2d')!;

  ctx.fillStyle = '#0c1220';
  ctx.fillRect(0, 0, 256, 512);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, 256, 512);

  let s = 4099;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  for (let r = 0; r < 18; r++) {
    for (let c = 0; c < 6; c++) {
      if (rnd() < 0.38) {
        const hueTone = rnd();
        const col = hueTone < 0.45 ? '#93c5fd' : hueTone < 0.8 ? '#fde68a' : '#fca5a5';
        const x = c * 42 + 7;
        const y = r * 28 + 6;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 26, 15);
        eCtx.fillStyle = col;
        eCtx.fillRect(x, y, 26, 15);
      }
    }
  }

  const colorMap = new THREE.CanvasTexture(canvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.anisotropy = maxAnisotropy;

  const emissiveMap = new THREE.CanvasTexture(emCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.anisotropy = maxAnisotropy;

  return { colorMap, emissiveMap };
}

export function buildPursuitFeatures(
  track: RaceTrack,
  mapId: MapId,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
  rand: () => number,
  isClearOfTrack: (x: number, z: number, radius: number) => boolean,
  isWalkwayBlocked?: (x: number, z: number, radius: number) => boolean,
  graphicsQuality: GraphicsQuality = 'medium'
): PursuitFeaturesSystem {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const dummy = new THREE.Object3D();
  const profile = getGraphicsProfile(graphicsQuality);
  const aniso = Math.min(maxAnisotropy, profile.maxAnisotropyCap);
  const simpleMat = profile.buildingDetail === 'simple';
  const enableShadows = profile.shadows && !isSoftwareGl;

  // 1. Night Sky Red & Blue Police Light Beams + Atmospheric Horizon Glow Clouds
  const redGlowTex = createSoftGlowDiscTexture('rgba(248, 56, 56, 0.72)', 'rgba(220, 38, 38, 0.30)');
  const blueGlowTex = createSoftGlowDiscTexture('rgba(56, 139, 255, 0.78)', 'rgba(37, 99, 235, 0.32)');
  disposables.push(redGlowTex, blueGlowTex);

  const skyDiscGeo = new THREE.PlaneGeometry(460, 290);
  const redSkyMat = new THREE.MeshBasicMaterial({
    map: redGlowTex,
    transparent: true,
    opacity: 0.86,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  const blueSkyMat = new THREE.MeshBasicMaterial({
    map: blueGlowTex,
    transparent: true,
    opacity: 0.90,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  disposables.push(skyDiscGeo, redSkyMat, blueSkyMat);

  // Center glow dome around track midpoint so every segment sees red/blue horizons
  let sumX = 0;
  let sumZ = 0;
  for (let i = 0; i < track.samples.length; i += 20) {
    sumX += track.samples[i].x;
    sumZ += track.samples[i].z;
  }
  const sampleCnt = Math.ceil(track.samples.length / 20);
  const centerX = sumX / Math.max(1, sampleCnt);
  const centerZ = sumZ / Math.max(1, sampleCnt);

  const skyGlowMeshes: Array<{ mesh: THREE.Mesh; baseX: number; baseZ: number; phase: number; isRed: boolean }> = [];
  for (let i = 0; i < 12; i++) {
    const isRed = i % 2 === 0;
    const ang = (i / 12) * Math.PI * 2;
    const dist = 520 + (i % 3) * 85;
    const bx = centerX + Math.cos(ang) * dist;
    const bz = centerZ + Math.sin(ang) * dist;
    const m = new THREE.Mesh(skyDiscGeo, isRed ? redSkyMat : blueSkyMat);
    m.position.set(bx, 115 + (i % 3) * 24, bz);
    m.lookAt(centerX, 25, centerZ);
    group.add(m);
    skyGlowMeshes.push({ mesh: m, baseX: bx, baseZ: bz, phase: i * 0.85, isRed });
  }

  // Sweeping Police Searchlight Cones in the Night Sky alongside the route (narrow at ground projector, flaring upward)
  const beamConeGeo = new THREE.CylinderGeometry(18, 0.55, 250, 14, 1, true);
  beamConeGeo.translate(0, 125, 0);
  const projectorGeo = new THREE.CylinderGeometry(1.1, 1.45, 2.2, 10);
  const projectorMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.72,
    metalness: 0.45,
  });
  const redBeamMat = new THREE.MeshBasicMaterial({
    color: 0xf87171,
    transparent: true,
    opacity: 0.19,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  const blueBeamMat = new THREE.MeshBasicMaterial({
    color: 0x60a5fa,
    transparent: true,
    opacity: 0.21,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  disposables.push(beamConeGeo, projectorGeo, projectorMat, redBeamMat, blueBeamMat);

  const sweepBeams: Array<{ pivot: THREE.Group; phase: number; speed: number }> = [];
  const beamTs = [0.14, 0.28, 0.44, 0.60, 0.76, 0.92];
  beamTs.forEach((bt, idx) => {
    const bs = sampleAtT(track, bt);
    const side = idx % 2 === 0 ? -1 : 1;
    let bx = bs.x + bs.rx * side * 44;
    let bz = bs.z + bs.rz * side * 44;
    if (!isClearOfTrack(bx, bz, 6)) {
      bx = bs.x - bs.rx * side * 44;
      bz = bs.z - bs.rz * side * 44;
    }
    if (!isClearOfTrack(bx, bz, 5)) return;
    const housing = new THREE.Mesh(projectorGeo, projectorMat);
    housing.position.set(bx, 1.1, bz);
    group.add(housing);
    const pivot = new THREE.Group();
    pivot.position.set(bx, 2.0, bz);
    const beam = new THREE.Mesh(beamConeGeo, idx % 2 === 0 ? redBeamMat : blueBeamMat);
    beam.rotation.x = 0.45;
    pivot.add(beam);
    group.add(pivot);
    sweepBeams.push({ pivot, phase: idx * 1.15, speed: idx % 2 === 0 ? 0.55 : -0.48 });
  });

  // Night Starfield overhead
  const starCount = Math.round(420 * profile.densityScale);
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = rand() * Math.PI * 2;
    const dist = 160 + rand() * 720;
    starPositions[i * 3] = centerX + Math.cos(theta) * dist;
    starPositions[i * 3 + 1] = 140 + rand() * 160;
    starPositions[i * 3 + 2] = centerZ + Math.sin(theta) * dist;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xe2e8f0,
    size: 1.9,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    fog: false,
  });
  group.add(new THREE.Points(starGeo, starMat));
  disposables.push(starGeo, starMat);

  // 2. Extraction Destination Checkpoint Arch at End of Route (t ~ 0.994)
  const endSample = sampleAtT(track, 0.994);
  const checkpointGroup = new THREE.Group();
  checkpointGroup.position.set(endSample.x, 0, endSample.z);
  checkpointGroup.rotation.y = endSample.yaw;

  const cpSteelMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.72,
    roughness: 0.28,
  });
  const cpGlowMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x34d399,
    emissiveIntensity: 2.8,
    roughness: 0.15,
  });
  const cpPadMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.35,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const cpPillarGeo = new THREE.BoxGeometry(1.1, 8.2, 1.3);
  const cpTopGeo = new THREE.BoxGeometry(track.roadWidth + 3.6, 1.5, 1.6);
  const cpStripGeo = new THREE.BoxGeometry(track.roadWidth + 1.4, 0.38, 1.72);
  const cpPadGeo = new THREE.PlaneGeometry(track.roadWidth - 0.6, 5.5);
  cpPadGeo.rotateX(-Math.PI / 2);

  const lPillar = new THREE.Mesh(cpPillarGeo, cpSteelMat);
  lPillar.position.set(-track.halfWidth - 1.25, 4.1, 0);
  const rPillar = new THREE.Mesh(cpPillarGeo, cpSteelMat);
  rPillar.position.set(track.halfWidth + 1.25, 4.1, 0);
  const topBeam = new THREE.Mesh(cpTopGeo, cpSteelMat);
  topBeam.position.set(0, 8.2, 0);
  const topStrip = new THREE.Mesh(cpStripGeo, cpGlowMat);
  topStrip.position.set(0, 7.65, 0);
  const cpPad = new THREE.Mesh(cpPadGeo, cpPadMat);
  cpPad.position.set(0, 0.064, 0);

  // Skyward emerald beacon columns at extraction point
  const cpBeaconGeo = new THREE.CylinderGeometry(0.28, 0.55, 36, 10, 1, true);
  cpBeaconGeo.translate(0, 18, 0);
  const cpBeaconMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const sx of [-track.halfWidth - 1.25, track.halfWidth + 1.25]) {
    const b = new THREE.Mesh(cpBeaconGeo, cpBeaconMat);
    b.position.set(sx, 8.4, 0);
    checkpointGroup.add(b);
  }
  checkpointGroup.add(lPillar, rPillar, topBeam, topStrip, cpPad);
  group.add(checkpointGroup);
  disposables.push(
    cpSteelMat,
    cpGlowMat,
    cpPadMat,
    cpPillarGeo,
    cpTopGeo,
    cpStripGeo,
    cpPadGeo,
    cpBeaconGeo,
    cpBeaconMat
  );

  // 3. Branch Fork Guide Bollards (Amber-Red for Fast-Hard Shortcut, Emerald for Long-Safe Detour)
  const bollardGeo = new THREE.CylinderGeometry(0.28, 0.34, 2.2, 8);
  bollardGeo.translate(0, 1.1, 0);
  const fastMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xef4444,
    emissiveIntensity: 2.2,
  });
  const safeMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x10b981,
    emissiveIntensity: 2.0,
  });
  disposables.push(bollardGeo, fastMat, safeMat);

  for (const branch of track.branches) {
    const mat = branch.kind === 'fast-hard' ? fastMat : safeMat;
    const fc = branch.forkCut;
    const maxJ = branch.samples.length - 1;
    const entryStart = Math.min(maxJ, fc.branchOuterStartIdx + 2);
    const entryNext = Math.min(maxJ, fc.branchOuterStartIdx + 9);
    const exitPrev = Math.max(0, fc.branchOuterEndIdx - 9);
    const exitEnd = Math.max(0, fc.branchOuterEndIdx - 2);
    const bollardIndices = Array.from(new Set([entryStart, entryNext, exitPrev, exitEnd]));
    for (const idx of bollardIndices) {
      if (idx < fc.branchOuterStartIdx || idx > fc.branchOuterEndIdx) continue;
      const bs = branch.samples[idx];
      const lat = branch.side === 'right' ? branch.halfWidth + 0.6 : -branch.halfWidth - 0.6;
      const m = new THREE.Mesh(bollardGeo, mat);
      m.position.set(bs.x + bs.rx * lat, 0, bs.z + bs.rz * lat);
      group.add(m);
    }
  }

  // 4. Night Architecture & Map-Specific Scenery (including Casino Club, Bar-Club & Night Shops)
  const nightCityFeatures = buildNightCityFeatures(
    track,
    aniso,
    isSoftwareGl,
    isClearOfTrack,
    isWalkwayBlocked,
    graphicsQuality
  );
  group.add(nightCityFeatures.group);
  disposables.push(nightCityFeatures);

  const { colorMap, emissiveMap } = createIndustrialWindowTexture(aniso);
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  const bMat = simpleMat
    ? new THREE.MeshLambertMaterial({ color: 0xffffff, map: colorMap })
    : new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: colorMap,
        emissive: 0xffffff,
        emissiveMap,
        emissiveIntensity: 0.85,
        roughness: 0.45,
        metalness: 0.32,
      });
  const bRoofMat = simpleMat
    ? new THREE.MeshLambertMaterial({ color: 0x0b1220 })
    : new THREE.MeshStandardMaterial({
        color: 0x0b1220,
        roughness: 0.85,
        metalness: 0.15,
      });

  const buildings: Array<{
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    rot: number;
    tint: THREE.Color;
  }> = [];

  const gridStep = simpleMat ? 68 : 48;
  const bMinX = Math.floor((track.bounds.minX - 60) / gridStep) * gridStep;
  const bMaxX = Math.ceil((track.bounds.maxX + 60) / gridStep) * gridStep;
  const bMinZ = Math.floor((track.bounds.minZ - 60) / gridStep) * gridStep;
  const bMaxZ = Math.ceil((track.bounds.maxZ + 60) / gridStep) * gridStep;

  for (let gx = bMinX; gx <= bMaxX; gx += gridStep) {
    for (let gz = bMinZ; gz <= bMaxZ; gz += gridStep) {
      const x = gx + (rand() - 0.5) * 18;
      const z = gz + (rand() - 0.5) * 18;
      if (rand() < (simpleMat ? 0.44 : 0.28)) continue;

      const w = mapId === 'pursuit-docks' ? 14 + rand() * 14 : 16 + rand() * 16;
      const d = mapId === 'pursuit-docks' ? 10 + rand() * 10 : 16 + rand() * 16;
      const halfDiag = Math.hypot(w, d) * 0.52;
      if (!isClearOfTrack(x, z, halfDiag + 5.5)) continue;
      if (nightCityFeatures.isNearNightFeature(x, z, halfDiag)) continue;
      if (isWalkwayBlocked?.(x, z, halfDiag + 1.5)) continue;

      const h =
        mapId === 'pursuit-highway'
          ? 26 + rand() * 62
          : mapId === 'pursuit-docks'
            ? 8 + rand() * 18
            : 18 + rand() * 36;

      const tint =
        mapId === 'pursuit-docks'
          ? new THREE.Color().setHSL(rand() < 0.5 ? 0.58 : 0.03, 0.45, 0.36 + rand() * 0.14)
          : new THREE.Color().setHSL(0.6, 0.18, 0.65 + rand() * 0.25);

      buildings.push({
        x,
        z,
        w,
        d,
        h,
        rot: Math.floor(rand() * 4) * (Math.PI / 2),
        tint,
      });
    }
  }

  if (buildings.length > 0) {
    const inst = new THREE.InstancedMesh(
      bGeo,
      [bMat, bMat, bRoofMat, bRoofMat, bMat, bMat],
      buildings.length
    );
    inst.castShadow = enableShadows;
    inst.receiveShadow = enableShadows;
    buildings.forEach((b, idx) => {
      dummy.position.set(b.x, 0, b.z);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
      inst.setColorAt(idx, b.tint);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
  }
  disposables.push(colorMap, emissiveMap, bGeo, bMat, bRoofMat);

  // Additional refinery silos for Industrial / harbor cranes for Docks
  if (mapId === 'pursuit-industrial') {
    const tankGeo = new THREE.CylinderGeometry(7.5, 7.5, 16, 16);
    tankGeo.translate(0, 8, 0);
    const tankMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.65,
      roughness: 0.38,
    });
    const tankPlacements: Array<[number, number]> = [];
    const spanX = track.bounds.maxX - track.bounds.minX + 100;
    const spanZ = track.bounds.maxZ - track.bounds.minZ + 100;
    for (let i = 0; i < 34; i++) {
      const tx = track.bounds.minX - 50 + rand() * spanX;
      const tz = track.bounds.minZ - 50 + rand() * spanZ;
      if (isClearOfTrack(tx, tz, 12.5) && !isWalkwayBlocked?.(tx, tz, 9.5)) {
        tankPlacements.push([tx, tz]);
      }
    }
    if (tankPlacements.length > 0) {
      const tankInst = new THREE.InstancedMesh(tankGeo, tankMat, tankPlacements.length);
      tankPlacements.forEach(([tx, tz], idx) => {
        dummy.position.set(tx, 0, tz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0.85 + rand() * 0.4);
        dummy.updateMatrix();
        tankInst.setMatrixAt(idx, dummy.matrix);
      });
      tankInst.instanceMatrix.needsUpdate = true;
      tankInst.computeBoundingSphere();
      group.add(tankInst);
    }
    disposables.push(tankGeo, tankMat);
  } else if (mapId === 'pursuit-docks') {
    const craneMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.4,
      roughness: 0.45,
    });
    const mastGeo = new THREE.BoxGeometry(2.6, 34, 2.6);
    mastGeo.translate(0, 17, 0);
    const boomGeo = new THREE.BoxGeometry(3.2, 2.2, 34);
    for (let i = 0; i < 14; i++) {
      const cx =
        track.bounds.minX + 40 + (i / 13) * (track.bounds.maxX - track.bounds.minX - 80);
      const cz = i % 2 === 0 ? track.bounds.minZ * 0.72 : track.bounds.maxZ * 0.72;
      if (!isClearOfTrack(cx, cz, 9.5) || isWalkwayBlocked?.(cx, cz, 7.5)) continue;
      const cGroup = new THREE.Group();
      cGroup.position.set(cx, 0, cz);
      const mast = new THREE.Mesh(mastGeo, craneMat);
      const boom = new THREE.Mesh(boomGeo, craneMat);
      boom.position.set(0, 32, 0);
      cGroup.add(mast, boom);
      group.add(cGroup);
    }
    disposables.push(craneMat, mastGeo, boomGeo);
  }

  // 5. Dynamic Knockable Pursuit Obstacles (Traffic Cones & Roadblock Barriers)
  const coneBodyGeo = new THREE.ConeGeometry(0.42, 1.05, 10);
  coneBodyGeo.translate(0, 0.56, 0);
  const coneBaseGeo = new THREE.BoxGeometry(0.86, 0.1, 0.86);
  coneBaseGeo.translate(0, 0.05, 0);
  const coneStripeGeo = new THREE.CylinderGeometry(0.24, 0.30, 0.24, 10);
  coneStripeGeo.translate(0, 0.62, 0);

  const coneOrangeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0x9a3412,
    emissiveIntensity: 0.45,
    roughness: 0.45,
  });
  const coneReflectiveMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xe2e8f0,
    emissiveIntensity: 0.65,
    roughness: 0.25,
  });
  const darkBaseMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.75,
  });

  const barrierBoardGeo = new THREE.BoxGeometry(3.1, 0.68, 0.24);
  barrierBoardGeo.translate(0, 0.92, 0);
  const barrierLegGeo = new THREE.BoxGeometry(0.18, 0.95, 0.58);
  barrierLegGeo.translate(0, 0.47, 0);
  const barrierBeaconGeo = new THREE.SphereGeometry(0.14, 8, 6);
  barrierBeaconGeo.translate(0, 1.38, 0);

  const barrierCanvas = document.createElement('canvas');
  barrierCanvas.width = 256;
  barrierCanvas.height = 64;
  const bCtx = barrierCanvas.getContext('2d')!;
  bCtx.fillStyle = '#dc2626';
  bCtx.fillRect(0, 0, 256, 64);
  bCtx.fillStyle = '#f8fafc';
  for (let x = -64; x < 320; x += 64) {
    bCtx.beginPath();
    bCtx.moveTo(x, 64);
    bCtx.lineTo(x + 32, 64);
    bCtx.lineTo(x + 64, 0);
    bCtx.lineTo(x + 32, 0);
    bCtx.closePath();
    bCtx.fill();
  }
  const barrierTex = new THREE.CanvasTexture(barrierCanvas);
  barrierTex.colorSpace = THREE.SRGBColorSpace;
  const barrierBoardMat = new THREE.MeshStandardMaterial({
    map: barrierTex,
    roughness: 0.4,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.35,
  });
  const barrierAmberMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 2.2,
  });

  disposables.push(
    coneBodyGeo,
    coneBaseGeo,
    coneStripeGeo,
    coneOrangeMat,
    coneReflectiveMat,
    darkBaseMat,
    barrierBoardGeo,
    barrierLegGeo,
    barrierBeaconGeo,
    barrierTex,
    barrierBoardMat,
    barrierAmberMat
  );

  const obstacleMeshes = new Map<number, THREE.Group>();

  function getOrCreateObstacleMesh(obs: PursuitObstacle): THREE.Group {
    const existing = obstacleMeshes.get(obs.id);
    if (existing) return existing;

    const g = new THREE.Group();
    if (obs.kind === 'cone') {
      g.add(new THREE.Mesh(coneBaseGeo, darkBaseMat));
      g.add(new THREE.Mesh(coneBodyGeo, coneOrangeMat));
      g.add(new THREE.Mesh(coneStripeGeo, coneReflectiveMat));
    } else {
      g.add(new THREE.Mesh(barrierBoardGeo, barrierBoardMat));
      for (const lx of [-1.15, 1.15]) {
        const leg = new THREE.Mesh(barrierLegGeo, darkBaseMat);
        leg.position.x = lx;
        g.add(leg);
        const beacon = new THREE.Mesh(barrierBeaconGeo, barrierAmberMat);
        beacon.position.x = lx;
        g.add(beacon);
      }
    }
    group.add(g);
    obstacleMeshes.set(obs.id, g);
    return g;
  }

  function syncObstacles(obstacles: PursuitObstacle[]): void {
    for (const obs of obstacles) {
      const m = getOrCreateObstacleMesh(obs);
      m.position.set(obs.x, obs.y, obs.z);
      m.rotation.set(obs.pitch, obs.yaw, obs.roll, 'YXZ');
    }
  }

  function update(dt: number, elapsed: number): void {
    nightCityFeatures.update(dt, elapsed);
    const strobe = Math.sin(elapsed * 7.5);
    redSkyMat.opacity = 0.56 + Math.max(0, strobe) * 0.32;
    blueSkyMat.opacity = 0.56 + Math.max(0, -strobe) * 0.34;
    redBeamMat.opacity = 0.1 + Math.max(0, strobe) * 0.11;
    blueBeamMat.opacity = 0.1 + Math.max(0, -strobe) * 0.11;

    for (const b of sweepBeams) {
      b.pivot.rotation.y = b.phase + elapsed * b.speed;
    }

    const pulse = 2.0 + Math.sin(elapsed * 5.0) * 0.8;
    cpGlowMat.emissiveIntensity = pulse;
  }

  return {
    group,
    syncObstacles,
    update,
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
