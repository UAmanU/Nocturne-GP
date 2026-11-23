import * as THREE from 'three';
import type { MapId } from './types';
import type { GraphicsProfile } from './graphics';
import {
  getWaterHazardAtT,
  isForkOpeningAtT,
  type RaceTrack,
  type TrackSample,
} from './track';
import { SIDEWALK_HEIGHT, SIDEWALK_INNER_OFFSET, SIDEWALK_OUTER_OFFSET } from './pedestrians';
import {
  createAsphaltTexture,
  createCheckeredTexture,
  createCurbTexture,
  createGroundTexture,
  createPlainAsphaltTexture,
  createSidewalkTexture,
} from './sharedTextures';

export function isOpenWaterSide(
  track: RaceTrack,
  t: number,
  side: 'left' | 'right'
): boolean {
  const wz = getWaterHazardAtT(track, t);
  if (!wz) return false;
  return wz.side === 'both' || wz.side === side;
}

export function buildSampleRibbonGeometry(
  samples: TrackSample[],
  totalLength: number,
  isClosed: boolean,
  innerOffset: number,
  outerOffset: number,
  yHeight: number,
  uvRepeatLength: number,
  options?: {
    getInnerOuter?: (t: number) => [number, number];
    shouldOmit?: (s: TrackSample, index: number) => boolean;
  }
): THREE.BufferGeometry {
  const n = samples.length;
  const vertRows = isClosed ? n + 1 : n;
  const segCount = isClosed ? n : n - 1;
  const positions = new Float32Array(vertRows * 2 * 3);
  const normals = new Float32Array(vertRows * 2 * 3);
  const uvs = new Float32Array(vertRows * 2 * 2);
  const indices: number[] = [];

  for (let i = 0; i < vertRows; i++) {
    const s = samples[i % n];
    const arc = isClosed && i === n ? totalLength : s.arcLength;
    const vCoord = arc / uvRepeatLength;

    const [inOff, outOff] = options?.getInnerOuter
      ? options.getInnerOuter(s.t)
      : [innerOffset, outerOffset];

    const ix = s.x + s.rx * inOff;
    const iz = s.z + s.rz * inOff;
    const ox = s.x + s.rx * outOff;
    const oz = s.z + s.rz * outOff;

    const base = i * 2;
    positions[base * 3] = ix;
    positions[base * 3 + 1] = yHeight;
    positions[base * 3 + 2] = iz;

    positions[(base + 1) * 3] = ox;
    positions[(base + 1) * 3 + 1] = yHeight;
    positions[(base + 1) * 3 + 2] = oz;

    normals[base * 3] = 0;
    normals[base * 3 + 1] = 1;
    normals[base * 3 + 2] = 0;
    normals[(base + 1) * 3] = 0;
    normals[(base + 1) * 3 + 1] = 1;
    normals[(base + 1) * 3 + 2] = 0;

    uvs[base * 2] = 0;
    uvs[base * 2 + 1] = vCoord;
    uvs[(base + 1) * 2] = 1;
    uvs[(base + 1) * 2 + 1] = vCoord;

    if (i < segCount) {
      const omit = options?.shouldOmit?.(s, i) ?? false;
      if (!omit) {
        const a = base;
        const b = base + 1;
        const c = base + 2;
        const d = base + 3;
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

export function buildSampleWallGeometry(
  samples: TrackSample[],
  totalLength: number,
  isClosed: boolean,
  lateralOffset: number,
  height: number,
  shouldOmit?: (s: TrackSample, index: number) => boolean
): THREE.BufferGeometry {
  const n = samples.length;
  const vertRows = isClosed ? n + 1 : n;
  const segCount = isClosed ? n : n - 1;
  const positions = new Float32Array(vertRows * 2 * 3);
  const uvs = new Float32Array(vertRows * 2 * 2);
  const indices: number[] = [];

  for (let i = 0; i < vertRows; i++) {
    const s = samples[i % n];
    const arc = isClosed && i === n ? totalLength : s.arcLength;
    const x = s.x + s.rx * lateralOffset;
    const z = s.z + s.rz * lateralOffset;

    const base = i * 2;
    positions[base * 3] = x;
    positions[base * 3 + 1] = 0;
    positions[base * 3 + 2] = z;

    positions[(base + 1) * 3] = x;
    positions[(base + 1) * 3 + 1] = height;
    positions[(base + 1) * 3 + 2] = z;

    uvs[base * 2] = arc / 8;
    uvs[base * 2 + 1] = 0;
    uvs[(base + 1) * 2] = arc / 8;
    uvs[(base + 1) * 2 + 1] = 1;

    if (i < segCount) {
      const omit = shouldOmit?.(s, i) ?? false;
      if (!omit) {
        const a = base;
        const b = base + 1;
        const c = base + 2;
        const d = base + 3;
        if (lateralOffset > 0) {
          indices.push(a, b, c, b, d, c);
        } else {
          indices.push(a, c, b, b, c, d);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildTrackRibbonGeometry(
  track: RaceTrack,
  innerOffset: number,
  outerOffset: number,
  yHeight: number,
  uvRepeatLength: number,
  options?: {
    getInnerOuter?: (t: number) => [number, number];
    omitSide?: 'left' | 'right';
    omitAtForks?: 'left' | 'right';
  }
): THREE.BufferGeometry {
  return buildSampleRibbonGeometry(
    track.samples,
    track.totalLength,
    track.isClosed,
    innerOffset,
    outerOffset,
    yHeight,
    uvRepeatLength,
    {
      getInnerOuter: options?.getInnerOuter,
      shouldOmit: (s) => {
        if (options?.omitSide && isOpenWaterSide(track, s.t, options.omitSide)) {
          return true;
        }
        if (
          options?.omitAtForks &&
          isForkOpeningAtT(track, s.t, options.omitAtForks) !== null
        ) {
          return true;
        }
        return false;
      },
    }
  );
}

export function buildBarrierWallGeometry(
  track: RaceTrack,
  lateralOffset: number,
  height: number,
  omitSide?: 'left' | 'right',
  omitAtForks?: 'left' | 'right'
): THREE.BufferGeometry {
  return buildSampleWallGeometry(
    track.samples,
    track.totalLength,
    track.isClosed,
    lateralOffset,
    height,
    (s) => {
      if (omitSide && isOpenWaterSide(track, s.t, omitSide)) return true;
      if (omitAtForks && isForkOpeningAtT(track, s.t, omitAtForks) !== null) return true;
      return false;
    }
  );
}

function buildPointListWallGeometry(
  points: Array<{ x: number; z: number; arc: number }>,
  height: number
): THREE.BufferGeometry {
  const n = points.length;
  const positions = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const indices: number[] = [];

  for (let i = 0; i < n; i++) {
    const p = points[i];
    const base = i * 2;
    positions[base * 3] = p.x;
    positions[base * 3 + 1] = 0;
    positions[base * 3 + 2] = p.z;

    positions[(base + 1) * 3] = p.x;
    positions[(base + 1) * 3 + 1] = height;
    positions[(base + 1) * 3 + 2] = p.z;

    uvs[base * 2] = p.arc / 8;
    uvs[base * 2 + 1] = 0;
    uvs[(base + 1) * 2] = p.arc / 8;
    uvs[(base + 1) * 2 + 1] = 1;

    if (i < n - 1) {
      const a = base;
      const b = base + 1;
      const c = base + 2;
      const d = base + 3;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildEdgePairRibbonGeometry(
  rows: Array<{ ix: number; iz: number; ox: number; oz: number; arc: number }>,
  yHeight: number,
  uvRepeatLength: number
): THREE.BufferGeometry {
  const n = rows.length;
  const positions = new Float32Array(n * 2 * 3);
  const normals = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const indices: number[] = [];

  for (let i = 0; i < n; i++) {
    const r = rows[i];
    const vCoord = r.arc / uvRepeatLength;
    const base = i * 2;

    positions[base * 3] = r.ix;
    positions[base * 3 + 1] = yHeight;
    positions[base * 3 + 2] = r.iz;

    positions[(base + 1) * 3] = r.ox;
    positions[(base + 1) * 3 + 1] = yHeight;
    positions[(base + 1) * 3 + 2] = r.oz;

    normals[base * 3] = 0;
    normals[base * 3 + 1] = 1;
    normals[base * 3 + 2] = 0;
    normals[(base + 1) * 3] = 0;
    normals[(base + 1) * 3 + 1] = 1;
    normals[(base + 1) * 3 + 2] = 0;

    uvs[base * 2] = 0;
    uvs[base * 2 + 1] = vCoord;
    uvs[(base + 1) * 2] = 1;
    uvs[(base + 1) * 2 + 1] = vCoord;

    if (i < n - 1) {
      const a = base;
      const b = base + 1;
      const c = base + 2;
      const d = base + 3;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function buildThroatApronGeometry(
  contour: THREE.Vector2[],
  yHeight: number,
  uvScale = 18
): THREE.BufferGeometry {
  const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
  const n = contour.length;
  const positions = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  const uvs = new Float32Array(n * 2);

  for (let i = 0; i < n; i++) {
    const p = contour[i];
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = yHeight;
    positions[i * 3 + 2] = p.y;
    normals[i * 3] = 0;
    normals[i * 3 + 1] = 1;
    normals[i * 3 + 2] = 0;
    uvs[i * 2] = p.x / uvScale;
    uvs[i * 2 + 1] = p.y / uvScale;
  }

  const indices: number[] = [];
  for (const tri of triangles) {
    indices.push(tri[0], tri[1], tri[2]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

export function buildTrackSurfacesAndGantry(
  root: THREE.Group,
  track: RaceTrack,
  maxAnisotropy: number,
  mapId: MapId,
  isDaylight: boolean,
  isPursuit: boolean,
  enableShadows: boolean,
  profile: GraphicsProfile,
  disposables: Array<{ dispose: () => void }>
): { oceanMesh: THREE.Mesh | null } {
  const aniso = Math.min(maxAnisotropy, profile.maxAnisotropyCap);
  const simpleMat = profile.buildingDetail === 'simple';

  // 1. Extended Ground Plane
  const groundTex = createGroundTexture(
    aniso,
    mapId,
    profile.gridlessGround,
    profile.textureSizeScale
  );
  const groundSpan = isPursuit ? 4000 : 3000;
  const groundGeo = new THREE.PlaneGeometry(groundSpan, groundSpan);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = simpleMat
    ? new THREE.MeshLambertMaterial({ color: 0xffffff, map: groundTex })
    : new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: groundTex,
        roughness: mapId === 'beach' ? 0.94 : 0.85,
        metalness: 0.05,
      });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.y = 0;
  groundMesh.receiveShadow = enableShadows;
  root.add(groundMesh);
  disposables.push(groundTex, groundGeo, groundMat);

  // Beach ocean perimeter
  let oceanMesh: THREE.Mesh | null = null;
  if (mapId === 'beach') {
    const oceanGeo = new THREE.RingGeometry(295, 1400, simpleMat ? 40 : 72);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMat = simpleMat
      ? new THREE.MeshLambertMaterial({
          color: 0x0ea5e9,
          transparent: true,
          opacity: 0.9,
        })
      : new THREE.MeshStandardMaterial({
          color: 0x0ea5e9,
          roughness: 0.22,
          metalness: 0.35,
          transparent: true,
          opacity: 0.9,
        });
    oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.position.y = 0.03;
    oceanMesh.receiveShadow = enableShadows;
    root.add(oceanMesh);
    disposables.push(oceanGeo, oceanMat);
  }

  // 2. Track Surface Ribbon
  const asphaltTex = createAsphaltTexture(
    aniso,
    isDaylight,
    mapId,
    profile.textureSizeScale
  );
  const roadGeo = buildTrackRibbonGeometry(
    track,
    -track.halfWidth,
    track.halfWidth,
    0.04,
    18,
    track.waterZones.length > 0
      ? {
          getInnerOuter: (t) => {
            const wz = getWaterHazardAtT(track, t);
            if (!wz) return [-track.halfWidth, track.halfWidth];
            const leftEdge =
              wz.side === 'left' || wz.side === 'both'
                ? wz.safeMinLat - 0.65
                : -track.halfWidth;
            const rightEdge =
              wz.side === 'right' || wz.side === 'both'
                ? wz.safeMaxLat + 0.65
                : track.halfWidth;
            return [leftEdge, rightEdge];
          },
        }
      : undefined
  );
  const roadMat = simpleMat
    ? new THREE.MeshLambertMaterial({ color: 0xffffff, map: asphaltTex })
    : new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: asphaltTex,
        roughness: mapId === 'ice-arena' ? 0.08 : isDaylight ? 0.55 : 0.24,
        metalness: mapId === 'ice-arena' ? 0.34 : isDaylight ? 0.1 : 0.28,
        envMapIntensity: mapId === 'ice-arena' ? 1.55 : 1.0,
      });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = enableShadows;
  roadMesh.frustumCulled = false;
  root.add(roadMesh);
  disposables.push(asphaltTex, roadGeo, roadMat);

  // 3. Curbs along both track edges
  const curbTex = createCurbTexture(aniso, mapId);
  const curbLeftGeo = buildTrackRibbonGeometry(
    track,
    -track.halfWidth - 0.85,
    -track.halfWidth,
    0.052,
    5,
    { omitSide: 'left', omitAtForks: 'left' }
  );
  const curbRightGeo = buildTrackRibbonGeometry(
    track,
    track.halfWidth,
    track.halfWidth + 0.85,
    0.052,
    5,
    { omitSide: 'right', omitAtForks: 'right' }
  );
  const curbMat = simpleMat
    ? new THREE.MeshLambertMaterial({
        color: 0xffffff,
        map: curbTex,
        side: THREE.DoubleSide,
      })
    : new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: curbTex,
        roughness: 0.65,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
  const curbLeftMesh = new THREE.Mesh(curbLeftGeo, curbMat);
  const curbRightMesh = new THREE.Mesh(curbRightGeo, curbMat);
  curbLeftMesh.frustumCulled = false;
  curbRightMesh.frustumCulled = false;
  curbLeftMesh.receiveShadow = enableShadows;
  curbRightMesh.receiveShadow = enableShadows;
  root.add(curbLeftMesh, curbRightMesh);
  disposables.push(curbTex, curbLeftGeo, curbRightGeo, curbMat);

  // 4. Perimeter Safety Guardrails
  const wallLeftGeo = buildBarrierWallGeometry(
    track,
    -track.halfWidth - 0.85,
    0.95,
    'left',
    'left'
  );
  const wallRightGeo = buildBarrierWallGeometry(
    track,
    track.halfWidth + 0.85,
    0.95,
    'right',
    'right'
  );
  const wallMat = new THREE.MeshStandardMaterial({
    color:
      mapId === 'beach'
        ? 0xd6b48c
        : mapId === 'ice-arena'
          ? 0xbae6fd
          : mapId === 'day-city'
            ? 0x64748b
            : 0x1e293b,
    roughness: mapId === 'beach' ? 0.78 : mapId === 'ice-arena' ? 0.25 : 0.5,
    metalness: mapId === 'beach' ? 0.1 : mapId === 'ice-arena' ? 0.2 : 0.55,
    side: THREE.DoubleSide,
  });
  const wallLeftMesh = new THREE.Mesh(wallLeftGeo, wallMat);
  const wallRightMesh = new THREE.Mesh(wallRightGeo, wallMat);
  wallLeftMesh.castShadow = enableShadows;
  wallRightMesh.castShadow = enableShadows;
  wallLeftMesh.receiveShadow = enableShadows;
  wallRightMesh.receiveShadow = enableShadows;
  root.add(wallLeftMesh, wallRightMesh);
  disposables.push(wallLeftGeo, wallRightGeo, wallMat);

  const railLeftGeo = buildTrackRibbonGeometry(
    track,
    -track.halfWidth - 0.95,
    -track.halfWidth - 0.8,
    0.96,
    12,
    { omitSide: 'left', omitAtForks: 'left' }
  );
  const railRightGeo = buildTrackRibbonGeometry(
    track,
    track.halfWidth + 0.8,
    track.halfWidth + 0.95,
    0.96,
    12,
    { omitSide: 'right', omitAtForks: 'right' }
  );
  const railMat = new THREE.MeshStandardMaterial({
    color:
      mapId === 'beach' || mapId === 'construction'
        ? 0xfacc15
        : mapId === 'ice-arena'
          ? 0x0284c7
          : mapId === 'day-city'
            ? 0x0284c7
            : isPursuit
              ? 0xef4444
              : 0x38bdf8,
    emissive: isPursuit ? 0xef4444 : mapId === 'night-city' ? 0x0284c7 : 0x000000,
    emissiveIntensity: isPursuit ? 0.55 : mapId === 'night-city' ? 0.75 : 0,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });
  root.add(new THREE.Mesh(railLeftGeo, railMat), new THREE.Mesh(railRightGeo, railMat));
  disposables.push(railLeftGeo, railRightGeo, railMat);

  // 4b. Dedicated Pedestrian Sidewalks / Boardwalk
  const sidewalkTex = createSidewalkTexture(aniso, mapId, profile.textureSizeScale);
  const sidewalkLeftGeo = buildTrackRibbonGeometry(
    track,
    -track.halfWidth - SIDEWALK_OUTER_OFFSET,
    -track.halfWidth - SIDEWALK_INNER_OFFSET,
    SIDEWALK_HEIGHT,
    6,
    { omitSide: 'left', omitAtForks: 'left' }
  );
  const sidewalkRightGeo = buildTrackRibbonGeometry(
    track,
    track.halfWidth + SIDEWALK_INNER_OFFSET,
    track.halfWidth + SIDEWALK_OUTER_OFFSET,
    SIDEWALK_HEIGHT,
    6,
    { omitSide: 'right', omitAtForks: 'right' }
  );
  const sidewalkMat = simpleMat
    ? new THREE.MeshLambertMaterial({
        color: 0xffffff,
        map: sidewalkTex,
        side: THREE.DoubleSide,
      })
    : new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: sidewalkTex,
        roughness: 0.75,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
  const sidewalkLeftMesh = new THREE.Mesh(sidewalkLeftGeo, sidewalkMat);
  const sidewalkRightMesh = new THREE.Mesh(sidewalkRightGeo, sidewalkMat);
  sidewalkLeftMesh.receiveShadow = enableShadows;
  sidewalkRightMesh.receiveShadow = enableShadows;
  root.add(sidewalkLeftMesh, sidewalkRightMesh);

  const outerCurbLeftGeo = buildBarrierWallGeometry(
    track,
    -track.halfWidth - SIDEWALK_OUTER_OFFSET,
    SIDEWALK_HEIGHT,
    'left',
    'left'
  );
  const outerCurbRightGeo = buildBarrierWallGeometry(
    track,
    track.halfWidth + SIDEWALK_OUTER_OFFSET,
    SIDEWALK_HEIGHT,
    'right',
    'right'
  );
  const outerCurbMat = new THREE.MeshStandardMaterial({
    color: mapId === 'beach' ? 0xa16207 : mapId === 'ice-arena' ? 0x7dd3fc : 0x334155,
    roughness: 0.8,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  root.add(
    new THREE.Mesh(outerCurbLeftGeo, outerCurbMat),
    new THREE.Mesh(outerCurbRightGeo, outerCurbMat)
  );
  disposables.push(
    sidewalkTex,
    sidewalkLeftGeo,
    sidewalkRightGeo,
    sidewalkMat,
    outerCurbLeftGeo,
    outerCurbRightGeo,
    outerCurbMat
  );

  // 4c. Pursuit Multi-Path Branch Roads + Throat Aprons
  let plainAsphaltMat: THREE.Material | null = null;
  let plainAsphaltMaskMat: THREE.Material | null = null;
  if (track.branches.length > 0) {
    const plainTex = createPlainAsphaltTexture(
      aniso,
      isDaylight,
      profile.textureSizeScale
    );
    plainAsphaltMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: plainTex,
      roughness: isDaylight ? 0.55 : 0.24,
      metalness: isDaylight ? 0.1 : 0.28,
      envMapIntensity: 1.0,
      side: THREE.DoubleSide,
    });
    plainAsphaltMaskMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: plainTex,
      roughness: isDaylight ? 0.55 : 0.24,
      metalness: isDaylight ? 0.1 : 0.28,
      envMapIntensity: 1.0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    disposables.push(plainTex, plainAsphaltMat, plainAsphaltMaskMat);
  }

  for (const branch of track.branches) {
    const bRoadGeo = buildSampleRibbonGeometry(
      branch.samples,
      branch.totalLength,
      false,
      -branch.halfWidth,
      branch.halfWidth,
      0.036,
      18
    );
    const bRoadMesh = new THREE.Mesh(bRoadGeo, roadMat);
    bRoadMesh.receiveShadow = enableShadows;
    bRoadMesh.frustumCulled = false;
    root.add(bRoadMesh);

    const fc = branch.forkCut;
    const sSign = branch.side === 'right' ? 1 : -1;
    const mw = track.halfWidth;
    const bw = branch.halfWidth;

    const mainPt = (idx: number, d: number) => {
      const ms = track.samples[idx];
      return {
        x: ms.x + ms.rx * sSign * d,
        z: ms.z + ms.rz * sSign * d,
        arc: ms.arcLength,
      };
    };
    const bOutPt = (j: number, d: number) => {
      const bs = branch.samples[j];
      return {
        x: bs.x + bs.rx * sSign * d,
        z: bs.z + bs.rz * sSign * d,
        arc: bs.arcLength,
      };
    };
    const bInPt = (j: number, d: number) => {
      const bs = branch.samples[j];
      return {
        x: bs.x - bs.rx * sSign * d,
        z: bs.z - bs.rz * sSign * d,
        arc: bs.arcLength,
      };
    };

    if (plainAsphaltMat && plainAsphaltMaskMat) {
      const entryPoly: THREE.Vector2[] = [];
      for (let i = fc.entryMainEndIdx; i <= fc.entryMainStartIdx; i++) {
        const p = mainPt(i, mw - 0.65);
        entryPoly.push(new THREE.Vector2(p.x, p.z));
      }
      const pEntryInM = mainPt(fc.entryMainStartIdx, mw + 0.9);
      entryPoly.push(new THREE.Vector2(pEntryInM.x, pEntryInM.z));
      const pEntryInB = bInPt(fc.branchInnerStartIdx, bw + 0.9);
      entryPoly.push(new THREE.Vector2(pEntryInB.x, pEntryInB.z));
      const pEntryMidOut = bOutPt(fc.branchInnerStartIdx, bw + 0.9);
      entryPoly.push(new THREE.Vector2(pEntryMidOut.x, pEntryMidOut.z));
      for (let j = fc.branchInnerStartIdx - 1; j >= fc.branchOuterStartIdx; j--) {
        const p = bOutPt(j, bw + 0.9);
        entryPoly.push(new THREE.Vector2(p.x, p.z));
      }
      const pEntryOutM = mainPt(fc.entryMainEndIdx, mw + 0.9);
      entryPoly.push(new THREE.Vector2(pEntryOutM.x, pEntryOutM.z));

      const exitPoly: THREE.Vector2[] = [];
      for (let i = fc.exitMainEndIdx; i <= fc.exitMainStartIdx; i++) {
        const p = mainPt(i, mw - 0.65);
        exitPoly.push(new THREE.Vector2(p.x, p.z));
      }
      const pExitOutM = mainPt(fc.exitMainStartIdx, mw + 0.9);
      exitPoly.push(new THREE.Vector2(pExitOutM.x, pExitOutM.z));
      for (let j = fc.branchOuterEndIdx; j >= fc.branchInnerEndIdx; j--) {
        const p = bOutPt(j, bw + 0.9);
        exitPoly.push(new THREE.Vector2(p.x, p.z));
      }
      const pExitInB = bInPt(fc.branchInnerEndIdx, bw + 0.9);
      exitPoly.push(new THREE.Vector2(pExitInB.x, pExitInB.z));
      const pExitInM = mainPt(fc.exitMainEndIdx, mw + 0.9);
      exitPoly.push(new THREE.Vector2(pExitInM.x, pExitInM.z));

      const entryApronGeo = buildThroatApronGeometry(entryPoly, 0.032, 18);
      const exitApronGeo = buildThroatApronGeometry(exitPoly, 0.032, 18);
      const entryApronMesh = new THREE.Mesh(entryApronGeo, plainAsphaltMat);
      const exitApronMesh = new THREE.Mesh(exitApronGeo, plainAsphaltMat);
      entryApronMesh.receiveShadow = enableShadows;
      exitApronMesh.receiveShadow = enableShadows;
      entryApronMesh.frustumCulled = false;
      exitApronMesh.frustumCulled = false;

      const maskInner = sSign > 0 ? mw - 0.68 : -(mw + 0.05);
      const maskOuter = sSign > 0 ? mw + 0.05 : -(mw - 0.68);
      const entrySlice = track.samples.slice(fc.entryMainEndIdx, fc.entryMainStartIdx + 1);
      const exitSlice = track.samples.slice(fc.exitMainEndIdx, fc.exitMainStartIdx + 1);
      const entryMaskGeo = buildSampleRibbonGeometry(
        entrySlice,
        Math.max(10, entrySlice.length * 3.1),
        false,
        maskInner,
        maskOuter,
        0.044,
        18
      );
      const exitMaskGeo = buildSampleRibbonGeometry(
        exitSlice,
        Math.max(10, exitSlice.length * 3.1),
        false,
        maskInner,
        maskOuter,
        0.044,
        18
      );
      const entryMaskMesh = new THREE.Mesh(entryMaskGeo, plainAsphaltMaskMat);
      const exitMaskMesh = new THREE.Mesh(exitMaskGeo, plainAsphaltMaskMat);
      entryMaskMesh.frustumCulled = false;
      exitMaskMesh.frustumCulled = false;

      root.add(entryApronMesh, exitApronMesh, entryMaskMesh, exitMaskMesh);
      disposables.push(entryApronGeo, exitApronGeo, entryMaskGeo, exitMaskGeo);
    }

    const outerWallPts = [mainPt(fc.entryMainEndIdx, mw + 0.85)];
    const outerCurbRows: Array<{
      ix: number;
      iz: number;
      ox: number;
      oz: number;
      arc: number;
    }> = [];
    const outerRailRows: Array<{
      ix: number;
      iz: number;
      ox: number;
      oz: number;
      arc: number;
    }> = [];
    const outerSidewalkRows: Array<{
      ix: number;
      iz: number;
      ox: number;
      oz: number;
      arc: number;
    }> = [];
    const outerSideCurbPts = [mainPt(fc.entryMainEndIdx, mw + SIDEWALK_OUTER_OFFSET)];

    const pushOuterRibbonRow = (
      ptFn: (d: number) => { x: number; z: number; arc: number },
      baseW: number
    ) => {
      const pRoad = ptFn(baseW);
      const pWall = ptFn(baseW + 0.85);
      const pRailIn = ptFn(baseW + 0.8);
      const pRailOut = ptFn(baseW + 0.95);
      const pSwIn = ptFn(baseW + SIDEWALK_INNER_OFFSET);
      const pSwOut = ptFn(baseW + SIDEWALK_OUTER_OFFSET);
      outerCurbRows.push({
        ix: pRoad.x,
        iz: pRoad.z,
        ox: pWall.x,
        oz: pWall.z,
        arc: pRoad.arc,
      });
      outerRailRows.push({
        ix: pRailIn.x,
        iz: pRailIn.z,
        ox: pRailOut.x,
        oz: pRailOut.z,
        arc: pRailIn.arc,
      });
      outerSidewalkRows.push({
        ix: pSwIn.x,
        iz: pSwIn.z,
        ox: pSwOut.x,
        oz: pSwOut.z,
        arc: pSwIn.arc,
      });
    };

    pushOuterRibbonRow((d) => mainPt(fc.entryMainEndIdx, d), mw);
    for (let j = fc.branchOuterStartIdx; j <= fc.branchOuterEndIdx; j++) {
      outerWallPts.push(bOutPt(j, bw + 0.85));
      outerSideCurbPts.push(bOutPt(j, bw + SIDEWALK_OUTER_OFFSET));
      pushOuterRibbonRow((d) => bOutPt(j, d), bw);
    }
    outerWallPts.push(mainPt(fc.exitMainStartIdx, mw + 0.85));
    outerSideCurbPts.push(mainPt(fc.exitMainStartIdx, mw + SIDEWALK_OUTER_OFFSET));
    pushOuterRibbonRow((d) => mainPt(fc.exitMainStartIdx, d), mw);

    const outerWallGeo = buildPointListWallGeometry(outerWallPts, 0.95);
    const outerRailGeo = buildEdgePairRibbonGeometry(outerRailRows, 0.96, 12);
    const outerCurbGeo = buildEdgePairRibbonGeometry(outerCurbRows, 0.052, 5);
    const outerSidewalkGeo = buildEdgePairRibbonGeometry(
      outerSidewalkRows,
      SIDEWALK_HEIGHT,
      6
    );
    const outerSideCurbGeo = buildPointListWallGeometry(
      outerSideCurbPts,
      SIDEWALK_HEIGHT
    );

    const outerSwMesh = new THREE.Mesh(outerSidewalkGeo, sidewalkMat);
    outerSwMesh.receiveShadow = enableShadows;
    root.add(
      new THREE.Mesh(outerWallGeo, wallMat),
      new THREE.Mesh(outerRailGeo, railMat),
      new THREE.Mesh(outerCurbGeo, curbMat),
      outerSwMesh,
      new THREE.Mesh(outerSideCurbGeo, outerCurbMat)
    );

    const innerWallPts = [mainPt(fc.entryMainStartIdx, mw + 0.85)];
    const innerCurbRows: Array<{
      ix: number;
      iz: number;
      ox: number;
      oz: number;
      arc: number;
    }> = [];
    const innerRailRows: Array<{
      ix: number;
      iz: number;
      ox: number;
      oz: number;
      arc: number;
    }> = [];

    const pushInnerRibbonRow = (
      ptFn: (d: number) => { x: number; z: number; arc: number },
      baseW: number
    ) => {
      const pRoad = ptFn(baseW);
      const pWall = ptFn(baseW + 0.85);
      const pRailIn = ptFn(baseW + 0.8);
      const pRailOut = ptFn(baseW + 0.95);
      innerCurbRows.push({
        ix: pRoad.x,
        iz: pRoad.z,
        ox: pWall.x,
        oz: pWall.z,
        arc: pRoad.arc,
      });
      innerRailRows.push({
        ix: pRailIn.x,
        iz: pRailIn.z,
        ox: pRailOut.x,
        oz: pRailOut.z,
        arc: pRailIn.arc,
      });
    };

    pushInnerRibbonRow((d) => mainPt(fc.entryMainStartIdx, d), mw);
    if (fc.branchInnerStartIdx <= fc.branchInnerEndIdx) {
      for (let j = fc.branchInnerStartIdx; j <= fc.branchInnerEndIdx; j++) {
        innerWallPts.push(bInPt(j, bw + 0.85));
        pushInnerRibbonRow((d) => bInPt(j, d), bw);
      }
    }
    innerWallPts.push(mainPt(fc.exitMainEndIdx, mw + 0.85));
    pushInnerRibbonRow((d) => mainPt(fc.exitMainEndIdx, d), mw);

    const innerWallGeo = buildPointListWallGeometry(innerWallPts, 0.95);
    const innerRailGeo = buildEdgePairRibbonGeometry(innerRailRows, 0.96, 12);
    const innerCurbGeo = buildEdgePairRibbonGeometry(innerCurbRows, 0.052, 5);

    root.add(
      new THREE.Mesh(innerWallGeo, wallMat),
      new THREE.Mesh(innerRailGeo, railMat),
      new THREE.Mesh(innerCurbGeo, curbMat)
    );

    disposables.push(
      bRoadGeo,
      outerWallGeo,
      outerRailGeo,
      outerCurbGeo,
      outerSidewalkGeo,
      outerSideCurbGeo,
      innerWallGeo,
      innerRailGeo,
      innerCurbGeo
    );
  }

  // 5. Start / Finish Line Decal + Overhead Gantry Arch
  const s0 = track.samples[0];
  const checkerTex = createCheckeredTexture(aniso);
  const finishLineGeo = new THREE.PlaneGeometry(track.roadWidth, 3.2);
  finishLineGeo.rotateX(-Math.PI / 2);
  const finishLineMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: checkerTex,
    roughness: 0.45,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const finishLineMesh = new THREE.Mesh(finishLineGeo, finishLineMat);
  finishLineMesh.position.set(s0.x, 0.062, s0.z);
  finishLineMesh.rotation.y = s0.yaw;
  finishLineMesh.receiveShadow = enableShadows;
  root.add(finishLineMesh);
  disposables.push(checkerTex, finishLineGeo, finishLineMat);

  const gantry = new THREE.Group();
  gantry.position.set(s0.x, 0, s0.z);
  gantry.rotation.y = s0.yaw;
  const gantrySteelMat = new THREE.MeshStandardMaterial({
    color: mapId === 'beach' ? 0xf8fafc : 0x1e293b,
    metalness: mapId === 'beach' ? 0.35 : 0.78,
    roughness: 0.28,
  });
  const gantryGlowMat = new THREE.MeshStandardMaterial({
    color: mapId === 'beach' ? 0x0ea5e9 : 0xf97316,
    emissive: mapId === 'beach' ? 0x0284c7 : 0xf97316,
    emissiveIntensity: mapId === 'night-city' ? 2.2 : 1.0,
    roughness: 0.2,
  });
  const pillarGeo = new THREE.BoxGeometry(0.9, 7.2, 1.1);
  const spanGeo = new THREE.BoxGeometry(track.roadWidth + 3.2, 1.35, 1.4);
  const bannerGlowGeo = new THREE.BoxGeometry(track.roadWidth + 1.2, 0.25, 1.48);

  const leftPillar = new THREE.Mesh(pillarGeo, gantrySteelMat);
  leftPillar.position.set(-track.halfWidth - 1.2, 3.6, 0);
  leftPillar.castShadow = enableShadows;
  const rightPillar = new THREE.Mesh(pillarGeo, gantrySteelMat);
  rightPillar.position.set(track.halfWidth + 1.2, 3.6, 0);
  rightPillar.castShadow = enableShadows;
  const topSpan = new THREE.Mesh(spanGeo, gantrySteelMat);
  topSpan.position.set(0, 7.2, 0);
  topSpan.castShadow = enableShadows;
  const topGlow = new THREE.Mesh(bannerGlowGeo, gantryGlowMat);
  topGlow.position.set(0, 6.65, 0);

  gantry.add(leftPillar, rightPillar, topSpan, topGlow);
  root.add(gantry);
  disposables.push(gantrySteelMat, gantryGlowMat, pillarGeo, spanGeo, bannerGlowGeo);

  return { oceanMesh };
}
