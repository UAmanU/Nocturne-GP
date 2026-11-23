import * as THREE from 'three';
import type { MapId, WeatherMode } from './types';
import { isPursuitMap } from './garage';

export interface VolumetricCloudsSystem {
  group: THREE.Group;
  update(dt: number, elapsed: number): void;
  dispose(): void;
}

interface CloudCluster {
  x: number;
  y: number;
  z: number;
  speedX: number;
  speedZ: number;
  scale: number;
  bobPhase: number;
  puffStart: number;
  puffCount: number;
}

interface PuffOffset {
  ox: number;
  oy: number;
  oz: number;
  sx: number;
  sy: number;
  sz: number;
}

function getCloudPalette(mapId: MapId, weather: WeatherMode): {
  top: number;
  belly: number;
  opacity: number;
} {
  const isNight = mapId === 'night-city' || isPursuitMap(mapId);
  if (isNight) {
    if (weather === 'rain' || weather === 'snow') {
      return { top: 0x263149, belly: 0x161d2e, opacity: 0.78 };
    }
    return { top: 0x3b4b72, belly: 0x202a44, opacity: 0.68 };
  }

  if (weather === 'rain') {
    return { top: 0x738196, belly: 0x4b5668, opacity: 0.88 };
  }
  if (weather === 'snow') {
    return { top: 0xc8d5e6, belly: 0x92a3ba, opacity: 0.86 };
  }
  if (mapId === 'beach') {
    return { top: 0xffffff, belly: 0xdbe9f6, opacity: 0.88 };
  }
  if (mapId === 'ice-arena') {
    return { top: 0xf4f9ff, belly: 0xc2d5ea, opacity: 0.84 };
  }
  return { top: 0xf9fcff, belly: 0xd0dceb, opacity: 0.86 };
}

function seededRand(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function createVolumetricCloudsSystem(
  mapId: MapId,
  weather: WeatherMode,
  worldSpan: number
): VolumetricCloudsSystem {
  const group = new THREE.Group();
  group.name = 'volumetric-clouds';

  const halfWrap = Math.max(260, worldSpan * 0.72);
  const clusterCount = 26;
  const rand = seededRand(
    mapId.length * 9173 + weather.length * 419 + Math.round(worldSpan)
  );

  const puffGeo = new THREE.IcosahedronGeometry(1, 2);
  const palette = getCloudPalette(mapId, weather);
  const cloudMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(palette.belly).multiplyScalar(0.18),
    transparent: true,
    opacity: palette.opacity,
    depthWrite: false,
  });

  const clusters: CloudCluster[] = [];
  const puffs: PuffOffset[] = [];

  for (let i = 0; i < clusterCount; i++) {
    const puffCount = 5 + Math.floor(rand() * 4);
    const puffStart = puffs.length;
    const baseScale = 6.2 + rand() * 5.8;

    for (let p = 0; p < puffCount; p++) {
      const t = puffCount > 1 ? p / (puffCount - 1) - 0.5 : 0;
      const ox = t * 2.5 + (rand() - 0.5) * 0.65;
      const oy = (1 - Math.abs(t) * 1.45) * 0.55 + (rand() - 0.5) * 0.2;
      const oz = (rand() - 0.5) * 1.15;
      const r = 0.72 + (1 - Math.abs(t)) * 0.55 + rand() * 0.35;
      puffs.push({
        ox,
        oy,
        oz,
        sx: r * 1.28,
        sy: r * 0.68,
        sz: r * 1.08,
      });
    }

    const angle = rand() * Math.PI * 2;
    const dist = (0.08 + rand() * 0.78) * halfWrap;
    clusters.push({
      x: Math.cos(angle) * dist,
      y: 50 + rand() * 34,
      z: Math.sin(angle) * dist,
      speedX: 1.8 + rand() * 2.4,
      speedZ: (rand() - 0.5) * 0.9,
      scale: baseScale,
      bobPhase: rand() * Math.PI * 2,
      puffStart,
      puffCount,
    });
  }

  const inst = new THREE.InstancedMesh(puffGeo, cloudMat, puffs.length);
  inst.name = 'volumetric-cloud-puffs';
  inst.frustumCulled = false;

  const topColor = new THREE.Color(palette.top);
  const bellyColor = new THREE.Color(palette.belly);
  const tmpColor = new THREE.Color();
  const dummy = new THREE.Object3D();

  for (let cIdx = 0; cIdx < clusters.length; cIdx++) {
    const c = clusters[cIdx];
    for (let k = 0; k < c.puffCount; k++) {
      const pIdx = c.puffStart + k;
      const p = puffs[pIdx];
      const heightRatio = THREE.MathUtils.clamp((p.oy + 0.4) / 1.1, 0, 1);
      tmpColor.copy(bellyColor).lerp(topColor, heightRatio);
      inst.setColorAt(pIdx, tmpColor);
    }
  }
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;

  const syncMatrices = (elapsed: number) => {
    for (let cIdx = 0; cIdx < clusters.length; cIdx++) {
      const c = clusters[cIdx];
      const bobY = Math.sin(elapsed * 0.25 + c.bobPhase) * 0.65;
      for (let k = 0; k < c.puffCount; k++) {
        const pIdx = c.puffStart + k;
        const p = puffs[pIdx];
        dummy.position.set(
          c.x + p.ox * c.scale,
          c.y + bobY + p.oy * c.scale,
          c.z + p.oz * c.scale
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(
          p.sx * c.scale,
          p.sy * c.scale,
          p.sz * c.scale
        );
        dummy.updateMatrix();
        inst.setMatrixAt(pIdx, dummy.matrix);
      }
    }
    inst.instanceMatrix.needsUpdate = true;
  };

  syncMatrices(0);
  group.add(inst);

  return {
    group,
    update(dt: number, elapsed: number) {
      for (let i = 0; i < clusters.length; i++) {
        const c = clusters[i];
        c.x += c.speedX * dt;
        c.z += c.speedZ * dt;
        if (c.x > halfWrap) c.x = -halfWrap;
        if (c.x < -halfWrap) c.x = halfWrap;
        if (c.z > halfWrap) c.z = -halfWrap;
        if (c.z < -halfWrap) c.z = halfWrap;
      }
      syncMatrices(elapsed);
    },
    dispose() {
      puffGeo.dispose();
      cloudMat.dispose();
    },
  };
}
