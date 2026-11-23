import * as THREE from 'three';
import type { MapId, RacerState } from './types';

export interface SkidMarkEmissionInput {
  wrecked: boolean;
  speed: number;
  isDrifting: boolean;
  isBraking: boolean;
  lateralSpeed: number;
}

export function shouldEmitSkidMark(car: SkidMarkEmissionInput): boolean {
  if (car.wrecked) return false;
  const absSpeed = Math.abs(car.speed);
  if (absSpeed <= 5) return false;
  return (
    car.isDrifting ||
    (car.isBraking && absSpeed > 8) ||
    Math.abs(car.lateralSpeed) > 3.2
  );
}

export interface SkidMarksSystem {
  mesh: THREE.InstancedMesh;
  record(racers: readonly RacerState[]): void;
  reset(): void;
  dispose(): void;
}

const MAX_SKID_MARKS = 2400;
const REAR_AXLE_OFFSET = 1.42;
const REAR_TRACK_HALF_WIDTH = 0.88;
const MIN_STAMP_DISTANCE_SQ = 0.36 * 0.36;

function getSkidBaseColor(mapId: MapId): THREE.Color {
  switch (mapId) {
    case 'beach':
      return new THREE.Color(0x9a7838);
    case 'construction':
      return new THREE.Color(0x7c5a26);
    case 'ice-arena':
      return new THREE.Color(0xd6eeff);
    case 'day-city':
      return new THREE.Color(0x1b2029);
    case 'night-city':
    case 'pursuit-highway':
    case 'pursuit-docks':
    case 'pursuit-industrial':
    default:
      return new THREE.Color(0x101319);
  }
}

export function createSkidMarksSystem(mapId: MapId): SkidMarksSystem {
  const geo = new THREE.PlaneGeometry(0.24, 1);
  geo.rotateX(-Math.PI / 2);

  const isIce = mapId === 'ice-arena';
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: isIce ? 0.36 : mapId === 'beach' || mapId === 'construction' ? 0.42 : 0.48,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, MAX_SKID_MARKS);
  mesh.name = 'tire-skid-marks';
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.count = 0;

  const baseColor = getSkidBaseColor(mapId);
  const darkTint = baseColor.clone().multiplyScalar(0.84);
  const tmpColor = new THREE.Color();
  const dummy = new THREE.Object3D();

  const lastWheels = new Map<string, { lx: number; lz: number; rx: number; rz: number }>();
  let head = 0;
  let totalWritten = 0;

  const stampSegment = (
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    fallbackYaw: number,
    intensity: number
  ) => {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const dist = Math.hypot(dx, dz);
    const yaw = dist > 0.02 ? Math.atan2(dx, dz) : fallbackYaw;
    const segLen = Math.min(2.8, Math.max(0.45, dist * 1.12));

    dummy.position.set((x0 + x1) * 0.5, 0.056, (z0 + z1) * 0.5);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(1, 1, segLen);
    dummy.updateMatrix();
    mesh.setMatrixAt(head, dummy.matrix);

    tmpColor.copy(baseColor).lerp(darkTint, Math.min(1, intensity));
    mesh.setColorAt(head, tmpColor);

    head = (head + 1) % MAX_SKID_MARKS;
    if (totalWritten < MAX_SKID_MARKS) {
      totalWritten += 1;
      mesh.count = totalWritten;
    }
  };

  return {
    mesh,
    record(racers: readonly RacerState[]) {
      let dirty = false;
      for (let i = 0; i < racers.length; i++) {
        const car = racers[i];
        if (!shouldEmitSkidMark(car)) {
          lastWheels.delete(car.id);
          continue;
        }

        const sin = Math.sin(car.yaw);
        const cos = Math.cos(car.yaw);
        const rearX = car.x - sin * REAR_AXLE_OFFSET;
        const rearZ = car.z - cos * REAR_AXLE_OFFSET;
        const rightX = cos * REAR_TRACK_HALF_WIDTH;
        const rightZ = -sin * REAR_TRACK_HALF_WIDTH;

        const lx = rearX - rightX;
        const lz = rearZ - rightZ;
        const rx = rearX + rightX;
        const rz = rearZ + rightZ;

        const prev = lastWheels.get(car.id);
        if (!prev) {
          lastWheels.set(car.id, { lx, lz, rx, rz });
          const motionYaw = Math.hypot(car.vx, car.vz) > 0.5 ? Math.atan2(car.vx, car.vz) : car.yaw;
          const stepX = Math.sin(motionYaw) * 0.35;
          const stepZ = Math.cos(motionYaw) * 0.35;
          const intensity = car.isDrifting
            ? 0.95
            : Math.min(1, Math.abs(car.lateralSpeed) / 14 + (car.isBraking ? 0.45 : 0.2));
          stampSegment(lx - stepX, lz - stepZ, lx, lz, motionYaw, intensity);
          stampSegment(rx - stepX, rz - stepZ, rx, rz, motionYaw, intensity);
          dirty = true;
          continue;
        }

        const midPrevX = (prev.lx + prev.rx) * 0.5;
        const midPrevZ = (prev.lz + prev.rz) * 0.5;
        const dx = rearX - midPrevX;
        const dz = rearZ - midPrevZ;
        if (dx * dx + dz * dz < MIN_STAMP_DISTANCE_SQ) {
          continue;
        }

        const motionYaw = Math.atan2(dx, dz);
        const intensity = car.isDrifting
          ? 0.95
          : Math.min(1, Math.abs(car.lateralSpeed) / 14 + (car.isBraking ? 0.45 : 0.2));

        stampSegment(prev.lx, prev.lz, lx, lz, motionYaw, intensity);
        stampSegment(prev.rx, prev.rz, rx, rz, motionYaw, intensity);
        lastWheels.set(car.id, { lx, lz, rx, rz });
        dirty = true;
      }

      if (dirty) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
    reset() {
      head = 0;
      totalWritten = 0;
      mesh.count = 0;
      lastWheels.clear();
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
