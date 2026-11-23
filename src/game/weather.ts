import * as THREE from 'three';
import type { WeatherMode } from './types';
import { getGraphicsProfile, type GraphicsQuality } from './graphics';

export interface WeatherSystem {
  root: THREE.Group;
  setWeather: (mode: WeatherMode) => void;
  update: (
    dt: number,
    elapsed: number,
    camPos: THREE.Vector3,
    carYaw: number,
    boostActive: boolean
  ) => void;
  dispose: () => void;
}

interface PrecipParticle {
  x: number;
  y: number;
  z: number;
  speed: number;
  swayPhase: number;
  scale: number;
}

interface WindStreak {
  sideAngle: number;
  radialDist: number;
  alongOffset: number;
  yOffset: number;
  speed: number;
  lengthScale: number;
}

export function createWeatherSystem(
  isSoftwareGl: boolean,
  graphicsQuality: GraphicsQuality = 'medium'
): WeatherSystem {
  const root = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const profile = getGraphicsProfile(graphicsQuality);

  let currentWeather: WeatherMode = 'clear';

  // --- 1. Raindrops (angled falling cyan-white streaks around camera) ---
  const rainCount = Math.max(80, Math.round((isSoftwareGl ? 360 : 600) * profile.precipScale));
  const rainGeo = new THREE.BoxGeometry(0.055, 1.45, 0.055);
  const rainMat = new THREE.MeshBasicMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const rainInst = new THREE.InstancedMesh(rainGeo, rainMat, rainCount);
  rainInst.frustumCulled = false;
  rainInst.visible = false;
  root.add(rainInst);
  disposables.push(rainGeo, rainMat);

  const rainData: PrecipParticle[] = Array.from({ length: rainCount }, () => ({
    x: (Math.random() - 0.5) * 76,
    y: Math.random() * 28,
    z: (Math.random() - 0.5) * 76,
    speed: 24 + Math.random() * 10,
    swayPhase: Math.random() * Math.PI * 2,
    scale: 0.75 + Math.random() * 0.55,
  }));

  // --- 2. Snowflakes (soft swirling white flakes drifting down around camera) ---
  const snowCount = Math.max(60, Math.round((isSoftwareGl ? 280 : 480) * profile.precipScale));
  const snowGeo = new THREE.OctahedronGeometry(0.16, 0);
  const snowMat = new THREE.MeshBasicMaterial({
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
  });
  const snowInst = new THREE.InstancedMesh(snowGeo, snowMat, snowCount);
  snowInst.frustumCulled = false;
  snowInst.visible = false;
  root.add(snowInst);
  disposables.push(snowGeo, snowMat);

  const snowData: PrecipParticle[] = Array.from({ length: snowCount }, () => ({
    x: (Math.random() - 0.5) * 74,
    y: Math.random() * 26,
    z: (Math.random() - 0.5) * 74,
    speed: 3.4 + Math.random() * 2.4,
    swayPhase: Math.random() * Math.PI * 2,
    scale: 0.65 + Math.random() * 0.8,
  }));

  // --- 3. Nitro Speed Wind Streaks (radial aero trails rushing past camera/car during boost) ---
  const windCount = 96;
  const windGeo = new THREE.BoxGeometry(0.036, 0.036, 3.8);
  const windMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.68,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const windInst = new THREE.InstancedMesh(windGeo, windMat, windCount);
  windInst.frustumCulled = false;
  windInst.visible = false;
  root.add(windInst);
  disposables.push(windGeo, windMat);

  const windData: WindStreak[] = Array.from({ length: windCount }, (_, idx) => ({
    sideAngle: (idx / windCount) * Math.PI * 2 + Math.random() * 0.35,
    radialDist: 2.8 + Math.random() * 6.5,
    alongOffset: (Math.random() - 0.5) * 42,
    yOffset: -0.9 + Math.random() * 3.6,
    speed: 44 + Math.random() * 22,
    lengthScale: 0.7 + Math.random() * 0.9,
  }));

  const dummy = new THREE.Object3D();

  function setWeather(mode: WeatherMode): void {
    currentWeather = mode;
    rainInst.visible = mode === 'rain';
    snowInst.visible = mode === 'snow';
  }

  function update(
    dt: number,
    elapsed: number,
    camPos: THREE.Vector3,
    carYaw: number,
    boostActive: boolean
  ): void {
    const safeDt = Math.min(dt, 0.08);

    if (currentWeather === 'rain') {
      const boxSpan = 74;
      const halfSpan = boxSpan / 2;
      for (let i = 0; i < rainCount; i++) {
        const p = rainData[i];
        p.y -= p.speed * safeDt;
        p.x -= 2.8 * safeDt;
        if (p.y < 0) {
          p.y = 26 + Math.random() * 4;
          p.x = camPos.x + (Math.random() - 0.5) * boxSpan;
          p.z = camPos.z + (Math.random() - 0.5) * boxSpan;
        }
        // Wrap around camera horizontally
        if (p.x - camPos.x > halfSpan) p.x -= boxSpan;
        if (p.x - camPos.x < -halfSpan) p.x += boxSpan;
        if (p.z - camPos.z > halfSpan) p.z -= boxSpan;
        if (p.z - camPos.z < -halfSpan) p.z += boxSpan;

        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0.06, 0, -0.14);
        dummy.scale.set(1, p.scale, 1);
        dummy.updateMatrix();
        rainInst.setMatrixAt(i, dummy.matrix);
      }
      rainInst.instanceMatrix.needsUpdate = true;
    } else if (currentWeather === 'snow') {
      const boxSpan = 72;
      const halfSpan = boxSpan / 2;
      for (let i = 0; i < snowCount; i++) {
        const p = snowData[i];
        p.y -= p.speed * safeDt;
        p.x += Math.sin(elapsed * 1.8 + p.swayPhase) * 1.4 * safeDt;
        p.z += Math.cos(elapsed * 1.5 + p.swayPhase) * 1.1 * safeDt;
        if (p.y < 0.08) {
          p.y = 24 + Math.random() * 4;
          p.x = camPos.x + (Math.random() - 0.5) * boxSpan;
          p.z = camPos.z + (Math.random() - 0.5) * boxSpan;
        }
        if (p.x - camPos.x > halfSpan) p.x -= boxSpan;
        if (p.x - camPos.x < -halfSpan) p.x += boxSpan;
        if (p.z - camPos.z > halfSpan) p.z -= boxSpan;
        if (p.z - camPos.z < -halfSpan) p.z += boxSpan;

        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(elapsed + p.swayPhase, elapsed * 0.7, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        snowInst.setMatrixAt(i, dummy.matrix);
      }
      snowInst.instanceMatrix.needsUpdate = true;
    }

    windInst.visible = boostActive;
    if (boostActive) {
      const fwdX = Math.sin(carYaw);
      const fwdZ = Math.cos(carYaw);
      const rightX = -fwdZ;
      const rightZ = fwdX;

      for (let i = 0; i < windCount; i++) {
        const w = windData[i];
        w.alongOffset -= w.speed * safeDt;
        if (w.alongOffset < -12) {
          w.alongOffset = 22 + Math.random() * 14;
        }
        const lat = Math.cos(w.sideAngle) * w.radialDist;
        const vert = Math.sin(w.sideAngle) * 1.8 + w.yOffset;
        const wx = camPos.x + fwdX * w.alongOffset + rightX * lat;
        const wy = Math.max(0.35, camPos.y + vert * 0.45);
        const wz = camPos.z + fwdZ * w.alongOffset + rightZ * lat;

        dummy.position.set(wx, wy, wz);
        dummy.rotation.set(0, carYaw, 0);
        dummy.scale.set(1, 1, w.lengthScale);
        dummy.updateMatrix();
        windInst.setMatrixAt(i, dummy.matrix);
      }
      windInst.instanceMatrix.needsUpdate = true;
    }
  }

  return {
    root,
    setWeather,
    update,
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
