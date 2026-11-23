import * as THREE from 'three';
import type {
  BoostPadState,
  ConstructionHazardVehicle,
  MapId,
  PursuitObstacle,
  RacerState,
  SandPatchState,
  WeatherMode,
  WreckingBallState,
} from './types';
import { isPursuitMap } from './garage';
import {
  isForkOpeningAtT,
  isTrackPointClear,
  type RaceTrack,
} from './track';
import {
  SIDEWALK_OUTER_OFFSET,
  createPedestrianSystem,
} from './pedestrians';
import { buildBeachFeatures, type BeachFeaturesSystem } from './beachFeatures';
import { buildDayCityBuildingsAndShops } from './dayCityFeatures';
import { buildIceArenaFeatures, type IceArenaFeaturesSystem } from './iceArenaFeatures';
import {
  buildConstructionFeatures,
  type ConstructionFeaturesSystem,
} from './constructionFeatures';
import { buildPursuitFeatures, type PursuitFeaturesSystem } from './pursuitFeatures';
import { buildNightCityFeatures, type NightCityFeaturesSystem } from './nightCityFeatures';
import { buildNpcWalkways } from './npcWalkways';
import { getGraphicsProfile, type GraphicsQuality } from './graphics';
import {
  createSkyscraperWindowTexture,
  createSoftGlowDiscTexture,
} from './sharedTextures';
import {
  buildTrackSurfacesAndGantry,
  isOpenWaterSide,
} from './trackMeshes';
import {
  createVolumetricCloudsSystem,
  type VolumetricCloudsSystem,
} from './clouds';
import { createSkidMarksSystem, type SkidMarksSystem } from './skidMarks';

export interface CityWorldObjects {
  root: THREE.Group;
  particleInstanced: THREE.InstancedMesh;
  updateEffects: (dt: number, elapsed: number) => void;
  recordSkidMarks: (racers: readonly RacerState[]) => void;
  resetSkidMarks: () => void;
  syncConstructionHazards: (
    vehicles: ConstructionHazardVehicle[],
    wreckingBall: WreckingBallState | null,
    elapsed: number
  ) => void;
  syncPursuitObstacles: (obstacles: PursuitObstacle[]) => void;
  spawnBurst: (x: number, y: number, z: number, colorHex: number, count: number, speedScale?: number) => void;
  spawnTrailParticle: (x: number, y: number, z: number, vx: number, vy: number, vz: number, colorHex: number, size?: number) => void;
  dispose: () => void;
}

export interface MapAtmosphere {
  bgColor: number;
  fogColor: number;
  fogDensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  keyColor: number;
  keyIntensity: number;
  rimColor: number;
  rimIntensity: number;
}

export function getMapAtmosphere(mapId: MapId, weather: WeatherMode): MapAtmosphere {
  const overcast = weather !== 'clear';
  if (isPursuitMap(mapId)) {
    return {
      bgColor: 0x060918,
      fogColor: overcast ? 0x0b1024 : 0x070a1c,
      fogDensity: overcast ? 0.0042 : 0.0029,
      hemiSky: 0x3b82f6,
      hemiGround: 0x0f172a,
      hemiIntensity: 1.18,
      keyColor: 0xdbeafe,
      keyIntensity: overcast ? 1.25 : 1.55,
      rimColor: 0xef4444,
      rimIntensity: 0.95,
    };
  }
  if (mapId === 'beach') {
    return {
      bgColor: overcast ? 0x9cb4c9 : 0x7dd3fc,
      fogColor: overcast ? 0x9cb4c9 : 0xbae6fd,
      fogDensity: overcast ? 0.0046 : 0.0022,
      hemiSky: overcast ? 0xcbd5e1 : 0xe0f2fe,
      hemiGround: 0xd9b98b,
      hemiIntensity: overcast ? 1.15 : 1.35,
      keyColor: overcast ? 0xe2e8f0 : 0xfff7ed,
      keyIntensity: overcast ? 1.25 : 2.15,
      rimColor: 0x38bdf8,
      rimIntensity: 0.65,
    };
  }
  if (mapId === 'ice-arena') {
    return {
      bgColor: overcast ? 0x94a3b8 : 0xbae6fd,
      fogColor: overcast ? 0xb4c6d8 : 0xe0f2fe,
      fogDensity: overcast ? 0.005 : 0.0023,
      hemiSky: overcast ? 0xe2e8f0 : 0xf0f9ff,
      hemiGround: 0x7dd3fc,
      hemiIntensity: overcast ? 1.2 : 1.4,
      keyColor: overcast ? 0xf1f5f9 : 0xf8fafc,
      keyIntensity: overcast ? 1.3 : 2.1,
      rimColor: 0x38bdf8,
      rimIntensity: 0.85,
    };
  }
  if (mapId === 'construction') {
    return {
      bgColor: 0x93c5fd,
      fogColor: 0xdbeafe,
      fogDensity: 0.0022,
      hemiSky: 0xe0f2fe,
      hemiGround: 0xa17c50,
      hemiIntensity: 1.32,
      keyColor: 0xfffbeb,
      keyIntensity: 2.1,
      rimColor: 0xfbbf24,
      rimIntensity: 0.55,
    };
  }
  if (mapId === 'day-city') {
    return {
      bgColor: overcast ? 0x8fa3b8 : 0x93c5fd,
      fogColor: overcast ? 0x94a3b8 : 0xc7dffe,
      fogDensity: overcast ? 0.0052 : 0.0025,
      hemiSky: overcast ? 0xcbd5e1 : 0xdbeafe,
      hemiGround: 0x475569,
      hemiIntensity: overcast ? 1.1 : 1.28,
      keyColor: overcast ? 0xf1f5f9 : 0xfffbeb,
      keyIntensity: overcast ? 1.2 : 2.05,
      rimColor: 0x93c5fd,
      rimIntensity: 0.6,
    };
  }
  // night-city
  return {
    bgColor: overcast ? 0x0b1224 : 0x070b18,
    fogColor: overcast ? 0x0b1224 : 0x070b18,
    fogDensity: overcast ? 0.006 : 0.0046,
    hemiSky: 0x60a5fa,
    hemiGround: 0x0f172a,
    hemiIntensity: 1.15,
    keyColor: 0xffedd5,
    keyIntensity: overcast ? 1.3 : 1.6,
    rimColor: 0x60a5fa,
    rimIntensity: 0.75,
  };
}

// Track & shared canvas textures live in ./trackMeshes and ./sharedTextures.

interface ParticleSlot {
  active: boolean;
  life: number;
  maxLife: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: THREE.Color;
}

export function createCityWorld(
  track: RaceTrack,
  boostPads: BoostPadState[],
  maxAnisotropy: number,
  isSoftwareGl: boolean,
  mapId: MapId = 'night-city',
  constructionContext?: {
    sandPatches: SandPatchState[];
    constructionVehicles: ConstructionHazardVehicle[];
  },
  graphicsQuality: GraphicsQuality = 'medium',
  weather: WeatherMode = 'clear'
): CityWorldObjects {
  const root = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const isPursuit = isPursuitMap(mapId);
  const isDaylight = !isPursuit && mapId !== 'night-city';
  const profile = getGraphicsProfile(graphicsQuality);
  const aniso = Math.min(maxAnisotropy, profile.maxAnisotropyCap);
  const simpleMat = profile.buildingDetail === 'simple';
  const enableShadows = profile.shadows && !isSoftwareGl;

  // 1-5. Ground, Track Surfaces, Sidewalks, Guardrails, Branch Forks & Start/Finish Gantry
  const { oceanMesh } = buildTrackSurfacesAndGantry(
    root,
    track,
    aniso,
    mapId,
    isDaylight,
    isPursuit,
    enableShadows,
    profile,
    disposables
  );

  const dummy = new THREE.Object3D();
  let envSeed = mapId === 'beach' ? 7717 : mapId === 'day-city' ? 5151 : 4242;
  const envRand = () => {
    envSeed = (envSeed * 48271) % 2147483647;
    return (envSeed - 1) / 2147483646;
  };

  // Helper to ensure placed scenery never clips road, branch bypasses, or sidewalks
  const isClearOfTrack = (x: number, z: number, radius: number): boolean =>
    isTrackPointClear(track, x, z, radius, SIDEWALK_OUTER_OFFSET);

  // 5B. City-Wide NPC Pedestrian Roads & Crosswalks across all maps
  const npcWalkways = buildNpcWalkways(
    track,
    mapId,
    aniso,
    isSoftwareGl,
    isClearOfTrack,
    graphicsQuality
  );
  root.add(npcWalkways.group);
  disposables.push(npcWalkways);

  // 6. Map-Specific World Architecture & Scenery
  let beachFeatures: BeachFeaturesSystem | null = null;
  let iceFeatures: IceArenaFeaturesSystem | null = null;
  let constructionFeatures: ConstructionFeaturesSystem | null = null;
  let pursuitFeatures: PursuitFeaturesSystem | null = null;
  let nightFeatures: NightCityFeaturesSystem | null = null;
  if (isPursuit) {
    pursuitFeatures = buildPursuitFeatures(
      track,
      mapId,
      aniso,
      isSoftwareGl,
      envRand,
      isClearOfTrack,
      npcWalkways.isOnWalkway,
      graphicsQuality
    );
    root.add(pursuitFeatures.group);
    disposables.push(pursuitFeatures);
  } else if (mapId === 'construction') {
    constructionFeatures = buildConstructionFeatures(
      track,
      constructionContext?.sandPatches ?? [],
      constructionContext?.constructionVehicles ?? [],
      aniso,
      isSoftwareGl,
      envRand,
      isClearOfTrack,
      graphicsQuality
    );
    root.add(constructionFeatures.group);
    disposables.push(constructionFeatures);
  } else if (mapId === 'beach') {
    // --- CORAL BEACH: Palm Trees, Giant Waterpark, Resort Hotel, Lighthouse & Beach Ball Players ---
    const palmPlacements: Array<{ x: number; z: number; scale: number; yaw: number }> = [];
    for (let gx = -285; gx <= 285; gx += 25) {
      for (let gz = -285; gz <= 285; gz += 25) {
        const x = gx + (envRand() - 0.5) * 11;
        const z = gz + (envRand() - 0.5) * 11;
        const distCenter = Math.hypot(x, z);
        if (distCenter > 284) continue;
        // Skip Giant Waterpark (-70, -18, R=94+moat), Coral Resort (-125, -125), Lighthouse (-275, -135), & beachfront stands/shops
        if (Math.hypot(x + 70, z + 18) < 109) continue;
        if (Math.hypot(x + 125, z + 125) < 28) continue;
        if (Math.hypot(x + 275, z + 135) < 22) continue;
        // Keep central sightline corridor open between Start Straight and Waterpark towers/slides
        if (x > -204 && x < -150 && z > -60 && z < 70) continue;
        if (
          Math.hypot(x + 197, z - 15) < 8.5 ||
          Math.hypot(x + 234, z + 24) < 8.5 ||
          Math.hypot(x + 237, z + 74) < 9.5 ||
          Math.hypot(x - 189, z - 40) < 8.5 ||
          Math.hypot(x + 154, z - 212) < 8.5
        ) {
          continue;
        }
        if (envRand() < (simpleMat ? 0.55 : 0.24)) continue;
        if (!isClearOfTrack(x, z, 3.4)) continue;
        if (npcWalkways.isOnWalkway(x, z, 2.2)) continue;
        palmPlacements.push({
          x,
          z,
          scale: 0.88 + envRand() * 0.52,
          yaw: envRand() * Math.PI * 2,
        });
      }
    }

    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.36, 7.6, simpleMat ? 6 : 8);
    trunkGeo.translate(0, 3.8, 0);
    const trunkMat: THREE.Material = simpleMat
      ? new THREE.MeshLambertMaterial({ color: 0x8b5a2b })
      : new THREE.MeshStandardMaterial({
          color: 0x8b5a2b,
          roughness: 0.9,
          metalness: 0.02,
        });
    const frondGeo = new THREE.ConeGeometry(1.9, 4.2, simpleMat ? 4 : 5);
    frondGeo.scale(1.6, 0.22, 0.65);
    frondGeo.translate(1.8, 0, 0);
    const frondMat: THREE.Material = simpleMat
      ? new THREE.MeshLambertMaterial({ color: 0x16a34a })
      : new THREE.MeshStandardMaterial({
          color: 0x16a34a,
          roughness: 0.65,
          metalness: 0.05,
        });

    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, palmPlacements.length);
    const frondInst = new THREE.InstancedMesh(frondGeo, frondMat, palmPlacements.length * 5);
    trunkInst.castShadow = enableShadows;
    frondInst.castShadow = enableShadows;

    palmPlacements.forEach((p, idx) => {
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.set(0.06, p.yaw, 0.05);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, dummy.matrix);

      for (let f = 0; f < 5; f++) {
        dummy.position.set(p.x + 0.25 * p.scale, 7.35 * p.scale, p.z + 0.15 * p.scale);
        dummy.rotation.set(0.18, p.yaw + (f * Math.PI * 2) / 5, -0.28);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        frondInst.setMatrixAt(idx * 5 + f, dummy.matrix);
      }
    });
    trunkInst.instanceMatrix.needsUpdate = true;
    frondInst.instanceMatrix.needsUpdate = true;
    root.add(trunkInst, frondInst);
    disposables.push(trunkGeo, trunkMat, frondGeo, frondMat);

    beachFeatures = buildBeachFeatures(
      track,
      aniso,
      isSoftwareGl,
      envRand,
      isClearOfTrack,
      graphicsQuality
    );
    root.add(beachFeatures.group);
    disposables.push(beachFeatures);
  } else if (mapId === 'ice-arena') {
    // --- ICE PEAKS ARENA: Monumental Crystalline Ice Peaks, Arctic Water Basins & Snowy Pines ---
    iceFeatures = buildIceArenaFeatures(
      track,
      aniso,
      isSoftwareGl,
      envRand,
      isClearOfTrack,
      npcWalkways.isOnWalkway,
      graphicsQuality
    );
    root.add(iceFeatures.group);
    disposables.push(iceFeatures);
  } else if (mapId === 'day-city') {
    // --- DAYLIGHT METRO: Colorful Mid-Rise Buildings, Glossy Sky-Blue Skyscrapers & Street Shops ---
    const dayCityFeatures = buildDayCityBuildingsAndShops(
      track,
      aniso,
      isSoftwareGl,
      envRand,
      isClearOfTrack,
      npcWalkways.isOnWalkway,
      graphicsQuality
    );
    root.add(dayCityFeatures.group);
    disposables.push(dayCityFeatures);
  } else {
    // --- MIDNIGHT CITY: Casino Club, Bar-Club, Street Shops, Glowing Skyscrapers & Starfield ---
    nightFeatures = buildNightCityFeatures(
      track,
      aniso,
      isSoftwareGl,
      isClearOfTrack,
      npcWalkways.isOnWalkway,
      graphicsQuality
    );
    root.add(nightFeatures.group);
    disposables.push(nightFeatures);

    const { colorMap: winColor, emissiveMap: winEmissive } =
      createSkyscraperWindowTexture(aniso, false, profile.textureSizeScale);
    const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
    buildingGeo.translate(0, 0.5, 0);
    const buildingMat: THREE.Material = simpleMat
      ? new THREE.MeshLambertMaterial({
          color: 0xffffff,
          map: winColor,
          emissive: 0xffffff,
          emissiveMap: winEmissive,
          emissiveIntensity: 0.75,
        })
      : new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: winColor,
          emissive: 0xffffff,
          emissiveMap: winEmissive,
          emissiveIntensity: 0.9,
          roughness: 0.42,
          metalness: 0.35,
        });
    const roofMat: THREE.Material = simpleMat
      ? new THREE.MeshLambertMaterial({ color: 0x0f1624 })
      : new THREE.MeshStandardMaterial({
          color: 0x0f1624,
          roughness: 0.85,
          metalness: 0.12,
        });

    const buildingTransforms: Array<{
      x: number;
      z: number;
      w: number;
      d: number;
      h: number;
      rot: number;
      tint: THREE.Color;
      crownColor: THREE.Color;
    }> = [];

    const crownPalette = [0x38bdf8, 0xfbbf24, 0xf97316, 0xa78bfa];

    for (let gx = -415; gx <= 415; gx += 30) {
      for (let gz = -415; gz <= 415; gz += 30) {
        const x = gx + (envRand() - 0.5) * 9;
        const z = gz + (envRand() - 0.5) * 9;

        const distFromCenter = Math.hypot(x, z);
        if (distFromCenter > 455) continue;
        if (envRand() < (simpleMat ? 0.42 : 0.14)) continue;

        const w = 14 + envRand() * 12;
        const d = 14 + envRand() * 12;
        const halfDiag = Math.hypot(w, d) * 0.5;

        if (!isClearOfTrack(x, z, halfDiag)) continue;
        if (nightFeatures.isNearNightFeature(x, z, halfDiag + 2)) continue;
        if (npcWalkways.isOnWalkway(x, z, halfDiag + 1.5)) continue;

        const isLandmarkZone = (x < -215 && Math.abs(z) < 165) || distFromCenter < 110;
        const h = isLandmarkZone ? 46 + envRand() * 60 : 20 + envRand() * 48;

        const tint = new THREE.Color().setHSL(
          0.58 + (envRand() - 0.5) * 0.08,
          0.22,
          0.82 + envRand() * 0.22
        );
        const crownHex = crownPalette[Math.floor(envRand() * crownPalette.length)];

        buildingTransforms.push({
          x,
          z,
          w,
          d,
          h,
          rot: Math.floor(envRand() * 4) * (Math.PI / 2),
          tint,
          crownColor: new THREE.Color(crownHex),
        });
      }
    }

    const buildingInstanced = new THREE.InstancedMesh(
      buildingGeo,
      [buildingMat, buildingMat, roofMat, roofMat, buildingMat, buildingMat],
      buildingTransforms.length
    );
    buildingInstanced.castShadow = enableShadows;
    buildingInstanced.receiveShadow = enableShadows;

    const crownGeo = new THREE.BoxGeometry(1.02, 0.55, 1.02);
    const crownMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, buildingTransforms.length);

    let storefrontInst: THREE.InstancedMesh | null = null;
    let storefrontGeo: THREE.BoxGeometry | null = null;
    let storefrontMat: THREE.MeshBasicMaterial | null = null;
    if (!simpleMat) {
      storefrontGeo = new THREE.BoxGeometry(1.03, 1.1, 1.03);
      storefrontMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.65,
      });
      storefrontInst = new THREE.InstancedMesh(
        storefrontGeo,
        storefrontMat,
        buildingTransforms.length
      );
    }

    buildingTransforms.forEach((b, idx) => {
      dummy.position.set(b.x, 0, b.z);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.updateMatrix();
      buildingInstanced.setMatrixAt(idx, dummy.matrix);
      buildingInstanced.setColorAt(idx, b.tint);

      dummy.position.set(b.x, b.h - 0.45, b.z);
      dummy.scale.set(b.w, 1, b.d);
      dummy.updateMatrix();
      crownInst.setMatrixAt(idx, dummy.matrix);
      crownInst.setColorAt(idx, b.crownColor);

      if (storefrontInst) {
        dummy.position.set(b.x, 1.1, b.z);
        dummy.scale.set(b.w, 1, b.d);
        dummy.updateMatrix();
        storefrontInst.setMatrixAt(idx, dummy.matrix);
        storefrontInst.setColorAt(idx, b.crownColor);
      }
    });
    buildingInstanced.instanceMatrix.needsUpdate = true;
    if (buildingInstanced.instanceColor) buildingInstanced.instanceColor.needsUpdate = true;
    buildingInstanced.computeBoundingSphere();

    crownInst.instanceMatrix.needsUpdate = true;
    if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
    crownInst.computeBoundingSphere();

    root.add(buildingInstanced, crownInst);
    if (storefrontInst) {
      storefrontInst.instanceMatrix.needsUpdate = true;
      if (storefrontInst.instanceColor) storefrontInst.instanceColor.needsUpdate = true;
      storefrontInst.computeBoundingSphere();
      root.add(storefrontInst);
    }
    disposables.push(
      winColor,
      winEmissive,
      buildingGeo,
      buildingMat,
      roofMat,
      crownGeo,
      crownMat
    );
    if (storefrontGeo && storefrontMat) {
      disposables.push(storefrontGeo, storefrontMat);
    }

    // Midnight city starfield overhead
    const starCount = Math.max(80, Math.round(340 * profile.densityScale));
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = envRand() * Math.PI * 2;
      const dist = 240 + envRand() * 380;
      starPositions[i * 3] = Math.cos(theta) * dist;
      starPositions[i * 3 + 1] = 105 + envRand() * 125;
      starPositions[i * 3 + 2] = Math.sin(theta) * dist;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xcbd5e1,
      size: 1.45,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.82,
    });
    root.add(new THREE.Points(starGeo, starMat));
    disposables.push(starGeo, starMat);
  }

  // 7. Streetlights (night-city: glowing warm lamps & pools; day-city/beach: sleek non-glow poles)
  const lampCount = Math.max(24, Math.round((mapId === 'beach' ? 60 : 124) * profile.densityScale));
  const poleGeo = new THREE.CylinderGeometry(0.11, 0.16, 6.4, simpleMat ? 6 : 8);
  poleGeo.translate(0, 3.2, 0);
  const poleMat: THREE.Material = simpleMat
    ? new THREE.MeshLambertMaterial({ color: mapId === 'beach' ? 0xe2e8f0 : 0x334155 })
    : new THREE.MeshStandardMaterial({
        color: mapId === 'beach' ? 0xe2e8f0 : 0x334155,
        metalness: 0.7,
        roughness: 0.3,
      });
  const lampHeadGeo = new THREE.BoxGeometry(1.1, 0.16, 0.38);
  const lampHeadMat: THREE.Material = simpleMat
    ? new THREE.MeshLambertMaterial({
        color: isDaylight ? 0xf1f5f9 : 0xffedd5,
        emissive: isDaylight ? 0x000000 : 0xfbbf24,
        emissiveIntensity: isDaylight ? 0 : 2.2,
      })
    : new THREE.MeshStandardMaterial({
        color: isDaylight ? 0xf1f5f9 : 0xffedd5,
        emissive: isDaylight ? 0x000000 : 0xfbbf24,
        emissiveIntensity: isDaylight ? 0 : 3.0,
        roughness: 0.2,
      });

  const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, lampCount);
  poleInst.castShadow = enableShadows;
  const headInst = new THREE.InstancedMesh(lampHeadGeo, lampHeadMat, lampCount);

  let poolInst: THREE.InstancedMesh | null = null;
  if ((mapId === 'night-city' || isPursuit) && profile.lampPools) {
    const lampPoolTex = createSoftGlowDiscTexture(
      'rgba(253, 224, 140, 0.34)',
      'rgba(251, 191, 36, 0.12)'
    );
    const lampPoolGeo = new THREE.PlaneGeometry(11.5, 11.5);
    lampPoolGeo.rotateX(-Math.PI / 2);
    const lampPoolMat = new THREE.MeshBasicMaterial({
      map: lampPoolTex,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    poolInst = new THREE.InstancedMesh(lampPoolGeo, lampPoolMat, lampCount);
    disposables.push(lampPoolTex, lampPoolGeo, lampPoolMat);
  }

  for (let i = 0; i < lampCount; i++) {
    const sampleIdx = Math.floor((i / lampCount) * track.samples.length);
    const s = track.samples[sampleIdx];
    const side = i % 2 === 0 ? 1 : -1;
    const openWater = isOpenWaterSide(track, s.t, side > 0 ? 'right' : 'left');
    const forkOpening = isForkOpeningAtT(track, s.t, side > 0 ? 'right' : 'left', 2) !== null;
    if (openWater || forkOpening) {
      dummy.position.set(0, -40, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      poleInst.setMatrixAt(i, dummy.matrix);
      headInst.setMatrixAt(i, dummy.matrix);
      if (poolInst) poolInst.setMatrixAt(i, dummy.matrix);
      continue;
    }

    const poleDist = track.halfWidth + 1.45;
    const px = s.x + s.rx * side * poleDist;
    const pz = s.z + s.rz * side * poleDist;

    dummy.position.set(px, 0, pz);
    dummy.rotation.set(0, s.yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poleInst.setMatrixAt(i, dummy.matrix);

    const hx = s.x + s.rx * side * (poleDist - 1.1);
    const hz = s.z + s.rz * side * (poleDist - 1.1);
    dummy.position.set(hx, 6.4, hz);
    dummy.rotation.set(0, s.yaw, 0);
    dummy.updateMatrix();
    headInst.setMatrixAt(i, dummy.matrix);

    if (poolInst) {
      const lx = s.x + s.rx * side * (track.halfWidth - 2.4);
      const lz = s.z + s.rz * side * (track.halfWidth - 2.4);
      dummy.position.set(lx, 0.054, lz);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      poolInst.setMatrixAt(i, dummy.matrix);
    }
  }
  poleInst.instanceMatrix.needsUpdate = true;
  headInst.instanceMatrix.needsUpdate = true;
  poleInst.computeBoundingSphere();
  headInst.computeBoundingSphere();
  root.add(poleInst, headInst);
  if (poolInst) {
    poolInst.instanceMatrix.needsUpdate = true;
    poolInst.computeBoundingSphere();
    root.add(poolInst);
  }
  disposables.push(poleGeo, poleMat, lampHeadGeo, lampHeadMat);

  // 7b. Track Floor Boost Pads (5 animated yellow chevron arrows)
  const padBedGeo = new THREE.PlaneGeometry(3.8, 8.8);
  padBedGeo.rotateX(-Math.PI / 2);
  const padBedMat = new THREE.MeshStandardMaterial({
    color: 0x0b1220,
    roughness: 0.45,
    metalness: 0.3,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const padRailGeo = new THREE.PlaneGeometry(0.18, 8.8);
  padRailGeo.rotateX(-Math.PI / 2);
  const padRailMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.72,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const chevronShape = new THREE.Shape();
  chevronShape.moveTo(0, -0.58);
  chevronShape.lineTo(1.38, 0.28);
  chevronShape.lineTo(1.38, 0.64);
  chevronShape.lineTo(0, -0.18);
  chevronShape.lineTo(-1.38, 0.64);
  chevronShape.lineTo(-1.38, 0.28);
  chevronShape.closePath();

  const chevronGeo = new THREE.ShapeGeometry(chevronShape);
  chevronGeo.rotateX(-Math.PI / 2);

  const ARROW_COUNT = 5;
  const arrowMats = Array.from({ length: ARROW_COUNT }, () =>
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    })
  );

  for (const pad of boostPads) {
    const padGroup = new THREE.Group();
    padGroup.position.set(pad.x, 0, pad.z);
    padGroup.rotation.y = pad.yaw;

    const bed = new THREE.Mesh(padBedGeo, padBedMat);
    bed.position.y = 0.052;
    bed.renderOrder = 1;
    padGroup.add(bed);

    for (const sx of [-1.85, 1.85]) {
      const rail = new THREE.Mesh(padRailGeo, padRailMat);
      rail.position.set(sx, 0.056, 0);
      rail.renderOrder = 2;
      padGroup.add(rail);
    }

    for (let a = 0; a < ARROW_COUNT; a++) {
      const arrow = new THREE.Mesh(chevronGeo, arrowMats[a]);
      arrow.position.set(0, 0.06, -3.0 + a * 1.5);
      arrow.renderOrder = 3;
      padGroup.add(arrow);
    }

    root.add(padGroup);
  }
  disposables.push(padBedGeo, padBedMat, padRailGeo, padRailMat, chevronGeo, ...arrowMats);

  // 8. Animated NPC Pedestrians (Construction: hard-hat workers only; Pursuit: far fewer night pedestrians)
  const pedestrianSystem = createPedestrianSystem(track, {
    adultCount: isPursuit ? 22 : mapId === 'beach' ? 128 : 118,
    childCount: isPursuit || mapId === 'construction' ? 0 : mapId === 'beach' ? 58 : 52,
    dogCount: isPursuit || mapId === 'construction' ? 0 : mapId === 'beach' ? 44 : 38,
    mapId,
    walkwaySegments: npcWalkways.segments,
    graphicsQuality,
    isSoftwareGl,
  });
  root.add(pedestrianSystem.group);
  disposables.push(pedestrianSystem);

  // 8b. High-Quality Volumetric 3D Clouds & Track Tire Skid Marks
  let volumetricClouds: VolumetricCloudsSystem | null = null;
  if (profile.volumetricClouds) {
    const worldSpan = Math.max(
      track.bounds.maxX - track.bounds.minX,
      track.bounds.maxZ - track.bounds.minZ
    );
    volumetricClouds = createVolumetricCloudsSystem(mapId, weather, worldSpan);
    root.add(volumetricClouds.group);
    disposables.push(volumetricClouds);
  }

  let skidMarks: SkidMarksSystem | null = null;
  if (profile.skidMarks) {
    skidMarks = createSkidMarksSystem(mapId);
    root.add(skidMarks.mesh);
    disposables.push(skidMarks);
  }

  // 9. Zero-GC Pooled Particle System (InstancedMesh) for nitro trails, tire drift smoke & impact sparks
  const PARTICLE_POOL_SIZE = 160;
  const particleGeo = new THREE.OctahedronGeometry(0.18, 0);
  const particleMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particleInstanced = new THREE.InstancedMesh(
    particleGeo,
    particleMat,
    PARTICLE_POOL_SIZE
  );
  particleInstanced.frustumCulled = false;
  root.add(particleInstanced);
  disposables.push(particleGeo, particleMat);

  const particles: ParticleSlot[] = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
    active: false,
    life: 0,
    maxLife: 0.4,
    x: 0,
    y: -50,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    size: 1,
    color: new THREE.Color(0xfacc15),
  }));
  let particleCursor = 0;

  const pDummy = new THREE.Object3D();
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    pDummy.position.set(0, -50, 0);
    pDummy.scale.setScalar(0.001);
    pDummy.updateMatrix();
    particleInstanced.setMatrixAt(i, pDummy.matrix);
    particleInstanced.setColorAt(i, particles[i].color);
  }
  particleInstanced.instanceMatrix.needsUpdate = true;

  function spawnTrailParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    colorHex: number,
    size = 1.0
  ): void {
    const slot = particles[particleCursor];
    particleCursor = (particleCursor + 1) % PARTICLE_POOL_SIZE;
    slot.active = true;
    slot.life = 0;
    slot.maxLife = 0.25 + Math.random() * 0.2;
    slot.x = x;
    slot.y = y;
    slot.z = z;
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.size = size;
    slot.color.setHex(colorHex);
    particleInstanced.setColorAt(
      (particleCursor - 1 + PARTICLE_POOL_SIZE) % PARTICLE_POOL_SIZE,
      slot.color
    );
  }

  function spawnBurst(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    count: number,
    speedScale = 1.0
  ): void {
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const spd = (4 + Math.random() * 7) * speedScale;
      spawnTrailParticle(
        x,
        y,
        z,
        Math.cos(ang) * spd,
        2.5 + Math.random() * 5.0 * speedScale,
        Math.sin(ang) * spd,
        colorHex,
        1.15
      );
    }
  }

  function updateEffects(dt: number, elapsed: number): void {
    pedestrianSystem.update(dt);
    if (beachFeatures) {
      beachFeatures.update(dt, elapsed);
    }
    if (iceFeatures) {
      iceFeatures.update(dt, elapsed);
    }
    if (constructionFeatures) {
      constructionFeatures.update(dt, elapsed);
    }
    if (pursuitFeatures) {
      pursuitFeatures.update(dt, elapsed);
    }
    if (nightFeatures) {
      nightFeatures.update(dt, elapsed);
    }
    if (volumetricClouds) {
      volumetricClouds.update(dt, elapsed);
    }

    if (oceanMesh) {
      oceanMesh.position.y = 0.03 + Math.sin(elapsed * 1.4) * 0.04;
    }

    const phase = (elapsed * 4.5) % ARROW_COUNT;
    for (let a = 0; a < ARROW_COUNT; a++) {
      let dist = phase - a;
      if (dist < 0) dist += ARROW_COUNT;
      const glow = Math.max(0, 1 - dist / 2.0);
      arrowMats[a].color.setHex(glow > 0.45 ? 0xfef08a : 0xfacc15);
      arrowMats[a].opacity = 0.48 + glow * 0.52;
    }

    let anyColorChanged = false;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = particles[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        pDummy.position.set(0, -50, 0);
        pDummy.scale.setScalar(0.001);
        pDummy.updateMatrix();
        particleInstanced.setMatrixAt(i, pDummy.matrix);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 9.5 * dt;

      const t = 1 - p.life / p.maxLife;
      pDummy.position.set(p.x, Math.max(0.1, p.y), p.z);
      pDummy.rotation.set(p.life * 6, p.life * 4, 0);
      pDummy.scale.setScalar(p.size * t);
      pDummy.updateMatrix();
      particleInstanced.setMatrixAt(i, pDummy.matrix);
      anyColorChanged = true;
    }
    particleInstanced.instanceMatrix.needsUpdate = true;
    if (anyColorChanged && particleInstanced.instanceColor) {
      particleInstanced.instanceColor.needsUpdate = true;
    }
  }

  function recordSkidMarks(racers: readonly RacerState[]): void {
    if (skidMarks) {
      skidMarks.record(racers);
    }
  }

  function resetSkidMarks(): void {
    if (skidMarks) {
      skidMarks.reset();
    }
  }

  function syncConstructionHazards(
    vehicles: ConstructionHazardVehicle[],
    wreckingBall: WreckingBallState | null,
    elapsed: number
  ): void {
    if (constructionFeatures) {
      constructionFeatures.syncHazards(vehicles, wreckingBall, elapsed);
    }
  }

  function syncPursuitObstacles(obstacles: PursuitObstacle[]): void {
    if (pursuitFeatures) {
      pursuitFeatures.syncObstacles(obstacles);
    }
  }

  return {
    root,
    particleInstanced,
    updateEffects,
    recordSkidMarks,
    resetSkidMarks,
    syncConstructionHazards,
    syncPursuitObstacles,
    spawnBurst,
    spawnTrailParticle,
    dispose: () => {
      for (const item of disposables) {
        item.dispose();
      }
    },
  };
}
