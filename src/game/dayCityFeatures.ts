import * as THREE from 'three';
import type { RaceTrack } from './track';
import { SIDEWALK_OUTER_OFFSET } from './pedestrians';
import { getGraphicsProfile, type GraphicsQuality } from './graphics';
import {
  createAwningStripeTexture,
  createSignPlaqueTexture,
} from './sharedTextures';

export interface DayCityFeaturesSystem {
  group: THREE.Group;
  dispose: () => void;
}

function createColorfulBuildingTexture(
  maxAnisotropy: number,
  sizeScale = 1
): THREE.CanvasTexture {
  const w = sizeScale < 1 ? 128 : 256;
  const h = sizeScale < 1 ? 256 : 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (sizeScale < 1) {
    ctx.scale(w / 256, h / 512);
  }

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 512);

  const rows = sizeScale < 1 ? 7 : 14;
  const cols = sizeScale < 1 ? 3 : 6;
  const cellW = 256 / cols;
  const cellH = 512 / rows;

  let seed = 4096;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let r = 0; r < rows; r++) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
    ctx.fillRect(0, r * cellH, 256, 3);
    for (let c = 0; c < cols; c++) {
      const wx = c * cellW + 7;
      const wy = r * cellH + 8;
      const ww = cellW - 14;
      const wh = cellH - 14;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);

      const shade = rand();
      ctx.fillStyle = shade < 0.5 ? '#1e293b' : shade < 0.85 ? '#334155' : '#475569';
      ctx.fillRect(wx, wy, ww, wh);
      if (sizeScale >= 1) {
        ctx.fillStyle = 'rgba(224, 242, 254, 0.35)';
        ctx.fillRect(wx + 2, wy + 2, ww * 0.42, wh * 0.55);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSkyBlueTowerTexture(
  maxAnisotropy: number,
  sizeScale = 1
): THREE.CanvasTexture {
  const w = sizeScale < 1 ? 128 : 256;
  const h = sizeScale < 1 ? 256 : 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (sizeScale < 1) {
    ctx.scale(w / 256, h / 512);
  }

  ctx.fillStyle = '#0c4a6e';
  ctx.fillRect(0, 0, 256, 512);

  const cols = sizeScale < 1 ? 4 : 8;
  const rows = sizeScale < 1 ? 10 : 20;
  const cellW = 256 / cols;
  const cellH = 512 / rows;

  let seed = 8821;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + 3;
      const y = r * cellH + 3;
      const ww = cellW - 6;
      const wh = cellH - 6;

      const tone = rand();
      ctx.fillStyle =
        tone < 0.35
          ? '#0ea5e9'
          : tone < 0.7
            ? '#38bdf8'
            : tone < 0.9
              ? '#0284c7'
              : '#7dd3fc';
      ctx.fillRect(x, y, ww, wh);

      if (sizeScale >= 1) {
        ctx.fillStyle = 'rgba(240, 249, 255, 0.45)';
        ctx.fillRect(x + 2, y + 2, ww * 0.32, wh - 4);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

interface ShopArchetype {
  name: string;
  sub: string;
  wallColor: number;
  signBg: string;
  signText: string;
  signBorder: string;
  awningA: string;
  awningB: string;
  windowColor: number;
  propType: 'produce' | 'gym' | 'cafe' | 'bakery';
}

const SHOP_TYPES: ShopArchetype[] = [
  {
    name: 'FRESH MARKET',
    sub: 'GROCERY & PRODUCE',
    wallColor: 0xfef3c7,
    signBg: '#14532d',
    signText: '#ffffff',
    signBorder: '#4ade80',
    awningA: '#16a34a',
    awningB: '#ffffff',
    windowColor: 0xfef08a,
    propType: 'produce',
  },
  {
    name: 'APEX GYM',
    sub: 'FITNESS & TRAINING',
    wallColor: 0x1e293b,
    signBg: '#0f172a',
    signText: '#f97316',
    signBorder: '#38bdf8',
    awningA: '#ea580c',
    awningB: '#1e293b',
    windowColor: 0x38bdf8,
    propType: 'gym',
  },
  {
    name: 'METRO CAFE',
    sub: 'ESPRESSO & BISTRO',
    wallColor: 0xfde68a,
    signBg: '#451a03',
    signText: '#fef3c7',
    signBorder: '#f59e0b',
    awningA: '#b45309',
    awningB: '#fef3c7',
    windowColor: 0xfdba74,
    propType: 'cafe',
  },
  {
    name: 'CITY BAKERY',
    sub: '24H MART & PASTRY',
    wallColor: 0xffe4e6,
    signBg: '#881337',
    signText: '#ffffff',
    signBorder: '#facc15',
    awningA: '#e11d48',
    awningB: '#ffffff',
    windowColor: 0xfde047,
    propType: 'bakery',
  },
];

export function buildDayCityBuildingsAndShops(
  track: RaceTrack,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
  envRand: () => number,
  isClearOfTrack: (x: number, z: number, radius: number) => boolean,
  isWalkwayBlocked?: (x: number, z: number, radius: number) => boolean,
  graphicsQuality: GraphicsQuality = 'medium'
): DayCityFeaturesSystem {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const dummy = new THREE.Object3D();
  const profile = getGraphicsProfile(graphicsQuality);
  const aniso = Math.min(maxAnisotropy, profile.maxAnisotropyCap);
  const simpleMat = profile.buildingDetail === 'simple';
  const highMat = profile.buildingDetail === 'high';
  const enableShadows = profile.shadows && !isSoftwareGl;

  // =========================================================================
  // 1. STREET-LEVEL SHOPS (Market, Gym, Cafe, Bakery) along clean sidewalks
  // =========================================================================
  const shopSpots: Array<{
    x: number;
    z: number;
    yaw: number;
    typeIdx: number;
    side: 1 | -1;
  }> = [];

  const shopHalfDepth = 3.1;
  const shopHalfWidth = 5.0;
  const shopCenterDist = track.halfWidth + SIDEWALK_OUTER_OFFSET + 4.5;
  const maxShops = simpleMat ? 20 : 42;

  for (let i = 0; i < track.samples.length; i += simpleMat ? 36 : 24) {
    const s = track.samples[i];
    if (s.curvature > 0.018) continue;

    for (const side of [1, -1] as const) {
      if (!simpleMat && (i + (side > 0 ? 0 : 12)) % 48 !== 0) continue;

      const cx = s.x + s.rx * side * shopCenterDist;
      const cz = s.z + s.rz * side * shopCenterDist;

      const frontLeftX = cx - s.tx * shopHalfWidth - s.rx * side * (shopHalfDepth - 0.5);
      const frontLeftZ = cz - s.tz * shopHalfWidth - s.rz * side * (shopHalfDepth - 0.5);
      const frontRightX = cx + s.tx * shopHalfWidth - s.rx * side * (shopHalfDepth - 0.5);
      const frontRightZ = cz + s.tz * shopHalfWidth - s.rz * side * (shopHalfDepth - 0.5);

      if (
        !isClearOfTrack(cx, cz, 3.0) ||
        !isClearOfTrack(frontLeftX, frontLeftZ, 0.2) ||
        !isClearOfTrack(frontRightX, frontRightZ, 0.2) ||
        isWalkwayBlocked?.(cx, cz, 5.2)
      ) {
        continue;
      }

      let tooClose = false;
      for (const prev of shopSpots) {
        if (Math.hypot(cx - prev.x, cz - prev.z) < (simpleMat ? 24 : 16.5)) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const faceX = -s.rx * side;
      const faceZ = -s.rz * side;
      const yaw = Math.atan2(faceX, faceZ);

      shopSpots.push({
        x: cx,
        z: cz,
        yaw,
        typeIdx: shopSpots.length % SHOP_TYPES.length,
        side,
      });
      if (shopSpots.length >= maxShops) break;
    }
    if (shopSpots.length >= maxShops) break;
  }

  const shopAssets = SHOP_TYPES.map((st) => {
    const wallMat = simpleMat
      ? new THREE.MeshLambertMaterial({ color: st.wallColor })
      : new THREE.MeshStandardMaterial({
          color: st.wallColor,
          roughness: 0.7,
          metalness: 0.08,
        });
    const signTex = createSignPlaqueTexture(
      st.name,
      st.sub,
      st.signBg,
      st.signBorder,
      st.signText,
      aniso,
      profile.textureSizeScale
    );
    const signMat = simpleMat
      ? new THREE.MeshLambertMaterial({ color: 0xffffff, map: signTex })
      : new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: signTex,
          roughness: 0.32,
          metalness: 0.15,
        });
    const awningTex = createAwningStripeTexture(
      st.awningA,
      st.awningB,
      aniso,
      profile.textureSizeScale
    );
    const awningMat = simpleMat
      ? new THREE.MeshLambertMaterial({ color: 0xffffff, map: awningTex })
      : new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: awningTex,
          roughness: 0.55,
        });
    const winMat = simpleMat
      ? new THREE.MeshLambertMaterial({ color: st.windowColor })
      : new THREE.MeshStandardMaterial({
          color: st.windowColor,
          emissive: st.windowColor,
          emissiveIntensity: 0.35,
          roughness: 0.14,
          metalness: 0.68,
        });
    disposables.push(wallMat, signTex, signMat, awningTex, awningMat, winMat);
    return { st, wallMat, signMat, awningMat, winMat };
  });

  const shopBodyGeo = new THREE.BoxGeometry(10.0, 5.4, 6.2);
  const shopRoofGeo = new THREE.BoxGeometry(10.4, 0.45, 6.6);
  const shopSignGeo = new THREE.BoxGeometry(8.6, 1.45, 0.35);
  const shopAwningGeo = new THREE.BoxGeometry(8.8, 0.22, 2.0);
  const shopWinGeo = new THREE.BoxGeometry(5.6, 2.4, 0.2);
  const shopSideWinGeo = new THREE.BoxGeometry(0.2, 2.1, 3.6);
  const shopDoorGeo = new THREE.BoxGeometry(1.7, 2.7, 0.22);
  const darkFrameMat = simpleMat
    ? new THREE.MeshLambertMaterial({ color: 0x0f172a })
    : new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.4,
        metalness: 0.6,
      });

  const crateGeo = new THREE.BoxGeometry(1.1, 0.72, 0.9);
  const produceTopGeo = new THREE.BoxGeometry(0.96, 0.22, 0.76);
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.65 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.65 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.85 });
  const cafeTableGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.08, 12);
  const cafePoleGeo = new THREE.CylinderGeometry(0.05, 0.06, 2.1, 8);
  const cafeParasolGeo = new THREE.ConeGeometry(1.15, 0.45, 8);
  const cafeParasolMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55 });

  disposables.push(
    shopBodyGeo,
    shopRoofGeo,
    shopSignGeo,
    shopAwningGeo,
    shopWinGeo,
    shopSideWinGeo,
    shopDoorGeo,
    darkFrameMat,
    crateGeo,
    produceTopGeo,
    orangeMat,
    greenMat,
    woodMat,
    cafeTableGeo,
    cafePoleGeo,
    cafeParasolGeo,
    cafeParasolMat
  );

  for (const spot of shopSpots) {
    const asset = shopAssets[spot.typeIdx];
    const shopGroup = new THREE.Group();
    shopGroup.position.set(spot.x, 0, spot.z);
    shopGroup.rotation.y = spot.yaw;

    const body = new THREE.Mesh(shopBodyGeo, asset.wallMat);
    body.position.y = 2.7;
    body.castShadow = enableShadows;
    body.receiveShadow = enableShadows;

    const roof = new THREE.Mesh(shopRoofGeo, darkFrameMat);
    roof.position.y = 5.6;
    roof.castShadow = enableShadows;

    const win = new THREE.Mesh(shopWinGeo, asset.winMat);
    win.position.set(-1.3, 1.65, 3.12);

    const door = new THREE.Mesh(shopDoorGeo, darkFrameMat);
    door.position.set(3.0, 1.4, 3.12);

    shopGroup.add(body, roof, win, door);

    if (!simpleMat) {
      const sign = new THREE.Mesh(shopSignGeo, asset.signMat);
      sign.position.set(0, 4.55, 3.18);

      const awning = new THREE.Mesh(shopAwningGeo, asset.awningMat);
      awning.position.set(0, 3.25, 3.9);
      awning.rotation.x = 0.26;
      awning.castShadow = enableShadows;

      const sideWinL = new THREE.Mesh(shopSideWinGeo, asset.winMat);
      sideWinL.position.set(-5.02, 2.2, 0);
      const sideWinR = new THREE.Mesh(shopSideWinGeo, asset.winMat);
      sideWinR.position.set(5.02, 2.2, 0);

      shopGroup.add(sign, awning, sideWinL, sideWinR);

      if (asset.st.propType === 'produce') {
        for (let k = 0; k < 3; k++) {
          const crate = new THREE.Mesh(crateGeo, woodMat);
          crate.position.set(-2.9 + k * 1.4, 0.36, 3.65);
          const top = new THREE.Mesh(produceTopGeo, k % 2 === 0 ? orangeMat : greenMat);
          top.position.set(-2.9 + k * 1.4, 0.8, 3.65);
          shopGroup.add(crate, top);
        }
      } else if (asset.st.propType === 'cafe' || asset.st.propType === 'bakery') {
        for (const tx of [-2.4, 0.2]) {
          const pole = new THREE.Mesh(cafePoleGeo, darkFrameMat);
          pole.position.set(tx, 1.05, 3.72);
          const table = new THREE.Mesh(cafeTableGeo, woodMat);
          table.position.set(tx, 0.82, 3.72);
          const parasol = new THREE.Mesh(cafeParasolGeo, cafeParasolMat);
          parasol.position.set(tx, 2.2, 3.72);
          parasol.castShadow = enableShadows;
          shopGroup.add(pole, table, parasol);
        }
      } else if (asset.st.propType === 'gym') {
        const rack = new THREE.Mesh(crateGeo, darkFrameMat);
        rack.position.set(-2.5, 0.4, 3.55);
        const weights = new THREE.Mesh(produceTopGeo, orangeMat);
        weights.position.set(-2.5, 0.82, 3.55);
        shopGroup.add(rack, weights);
      }
    }

    group.add(shopGroup);
  }

  // Helper to keep large skyline buildings clear of street shops, central stadium & West sightline from start straight
  const STADIUM_X = -52;
  const STADIUM_Z = -18;
  const STADIUM_RX = 75; // ~146m outer bowl + plaza apron
  const STADIUM_RZ = 55; // ~106m outer bowl + plaza apron

  const isInsideStadiumClearance = (x: number, z: number, radius: number): boolean => {
    const dx = (x - STADIUM_X) / (STADIUM_RX + radius);
    const dz = (z - STADIUM_Z) / (STADIUM_RZ + radius);
    if (dx * dx + dz * dz < 1) return true;
    // Open urban plaza sightline corridor from West start straight (x=-180) straight to the stadium
    if (x >= -172 - radius && x <= STADIUM_X + 8 && z >= -86 - radius && z <= 72 + radius) {
      return true;
    }
    return false;
  };

  const isNearShop = (x: number, z: number, radius: number): boolean => {
    for (const spot of shopSpots) {
      if (Math.hypot(x - spot.x, z - spot.z) < radius + 8.5) return true;
    }
    return false;
  };

  // =========================================================================
  // 2. COLORFUL URBAN BUILDINGS + GLOSSY SKY-BLUE GLASS SKYSCRAPERS
  // =========================================================================
  const colorWallTex = createColorfulBuildingTexture(aniso, profile.textureSizeScale);
  const skyBlueTex = createSkyBlueTowerTexture(aniso, profile.textureSizeScale);

  const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  unitBoxGeo.translate(0, 0.5, 0);

  const colorfulBuildingMat = simpleMat
    ? new THREE.MeshLambertMaterial({ color: 0xffffff })
    : new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: colorWallTex,
        roughness: 0.56,
        metalness: 0.14,
      });

  const skyBlueGlassMat = simpleMat
    ? new THREE.MeshLambertMaterial({ color: 0x38bdf8 })
    : new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: skyBlueTex,
        roughness: 0.14,
        metalness: 0.82,
        envMapIntensity: 1.55,
      });

  const roofCapMat = simpleMat
    ? new THREE.MeshLambertMaterial({ color: 0x334155 })
    : new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.78,
        metalness: 0.2,
      });

  const skyRoofMat = simpleMat
    ? new THREE.MeshLambertMaterial({ color: 0x0ea5e9 })
    : new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        roughness: 0.2,
        metalness: 0.75,
      });

  const colorfulBuildings: Array<{
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    rot: number;
    color: THREE.Color;
    trimColor: THREE.Color;
  }> = [];

  const skyTowers: Array<{
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    rot: number;
    tint: THREE.Color;
  }> = [];

  const VIBRANT_BUILDING_COLORS = [
    0xdc2626,
    0x2563eb,
    0xeab308,
    0xea580c,
    0x059669,
    0xe11d48,
    0x4f46e5,
    0x0d9488,
  ];

  const SKY_BLUE_TINTS = [0xe0f2fe, 0xbae6fd, 0x7dd3fc, 0xffffff];
  const gridStep = simpleMat ? 42 : 28;

  for (let gx = -415; gx <= 415; gx += gridStep) {
    for (let gz = -415; gz <= 415; gz += gridStep) {
      const x = gx + (envRand() - 0.5) * 8.0;
      const z = gz + (envRand() - 0.5) * 8.0;

      const distFromCenter = Math.hypot(x, z);
      if (distFromCenter > 455) continue;
      if (envRand() < (simpleMat ? 0.34 : 0.16)) continue;

      const w = 14 + envRand() * 11;
      const d = 14 + envRand() * 11;
      const halfDiag = Math.hypot(w, d) * 0.5;

      if (!isClearOfTrack(x, z, halfDiag)) continue;
      if (isNearShop(x, z, halfDiag)) continue;
      if (isInsideStadiumClearance(x, z, halfDiag + 4)) continue;
      if (isWalkwayBlocked?.(x, z, halfDiag + 1.5)) continue;

      const isSkyscraperZone =
        (x < -210 && Math.abs(z) < 175) ||
        distFromCenter < 120 ||
        envRand() < 0.34;

      if (isSkyscraperZone) {
        const h = 48 + envRand() * 58;
        const tintHex = SKY_BLUE_TINTS[Math.floor(envRand() * SKY_BLUE_TINTS.length)];
        skyTowers.push({
          x,
          z,
          w,
          d,
          h,
          rot: Math.floor(envRand() * 4) * (Math.PI / 2),
          tint: new THREE.Color(tintHex),
        });
      } else {
        const h = 15 + envRand() * 26;
        const baseHex =
          VIBRANT_BUILDING_COLORS[Math.floor(envRand() * VIBRANT_BUILDING_COLORS.length)];
        const trimColor = new THREE.Color(baseHex).multiplyScalar(0.62);
        colorfulBuildings.push({
          x,
          z,
          w,
          d,
          h,
          rot: Math.floor(envRand() * 4) * (Math.PI / 2),
          color: new THREE.Color(baseHex),
          trimColor,
        });
      }
    }
  }

  // Instantiate Colorful Mid-Rise City Buildings
  if (colorfulBuildings.length > 0) {
    const cbInst = new THREE.InstancedMesh(
      unitBoxGeo,
      [
        colorfulBuildingMat,
        colorfulBuildingMat,
        roofCapMat,
        roofCapMat,
        colorfulBuildingMat,
        colorfulBuildingMat,
      ],
      colorfulBuildings.length
    );
    cbInst.castShadow = enableShadows;
    cbInst.receiveShadow = enableShadows;

    let cbTrimInst: THREE.InstancedMesh | null = null;
    if (!simpleMat) {
      const cbTrimGeo = new THREE.BoxGeometry(1.03, 0.6, 1.03);
      const cbTrimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 });
      cbTrimInst = new THREE.InstancedMesh(cbTrimGeo, cbTrimMat, colorfulBuildings.length);
      disposables.push(cbTrimGeo, cbTrimMat);
    }

    let hvacInst: THREE.InstancedMesh | null = null;
    if (highMat) {
      const hvacGeo = new THREE.BoxGeometry(0.32, 1.35, 0.28);
      const hvacMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.52,
        metalness: 0.45,
      });
      hvacInst = new THREE.InstancedMesh(hvacGeo, hvacMat, colorfulBuildings.length);
      hvacInst.castShadow = enableShadows;
      disposables.push(hvacGeo, hvacMat);
    }

    colorfulBuildings.forEach((b, idx) => {
      dummy.position.set(b.x, 0, b.z);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.updateMatrix();
      cbInst.setMatrixAt(idx, dummy.matrix);
      cbInst.setColorAt(idx, b.color);

      if (cbTrimInst) {
        dummy.position.set(b.x, b.h - 0.5, b.z);
        dummy.scale.set(b.w, 1, b.d);
        dummy.updateMatrix();
        cbTrimInst.setMatrixAt(idx, dummy.matrix);
        cbTrimInst.setColorAt(idx, b.trimColor);
      }

      if (hvacInst) {
        dummy.position.set(b.x + 0.12 * b.w, b.h + 0.65, b.z - 0.1 * b.d);
        dummy.scale.set(b.w, 1, b.d);
        dummy.updateMatrix();
        hvacInst.setMatrixAt(idx, dummy.matrix);
      }
    });

    cbInst.instanceMatrix.needsUpdate = true;
    if (cbInst.instanceColor) cbInst.instanceColor.needsUpdate = true;
    cbInst.computeBoundingSphere();
    group.add(cbInst);

    if (cbTrimInst) {
      cbTrimInst.instanceMatrix.needsUpdate = true;
      if (cbTrimInst.instanceColor) cbTrimInst.instanceColor.needsUpdate = true;
      cbTrimInst.computeBoundingSphere();
      group.add(cbTrimInst);
    }
    if (hvacInst) {
      hvacInst.instanceMatrix.needsUpdate = true;
      hvacInst.computeBoundingSphere();
      group.add(hvacInst);
    }
  }

  // Instantiate Glossy Sky-Blue Glass Skyscrapers + Stepped Glass Crowns
  if (skyTowers.length > 0) {
    const skyInst = new THREE.InstancedMesh(
      unitBoxGeo,
      [
        skyBlueGlassMat,
        skyBlueGlassMat,
        skyRoofMat,
        skyRoofMat,
        skyBlueGlassMat,
        skyBlueGlassMat,
      ],
      skyTowers.length
    );
    skyInst.castShadow = enableShadows;
    skyInst.receiveShadow = enableShadows;

    let spireInst: THREE.InstancedMesh | null = null;
    if (!simpleMat) {
      const spireBaseGeo = new THREE.BoxGeometry(0.68, 3.6, 0.68);
      spireInst = new THREE.InstancedMesh(spireBaseGeo, skyBlueGlassMat, skyTowers.length);
      spireInst.castShadow = enableShadows;
      disposables.push(spireBaseGeo);
    }

    let antennaInst: THREE.InstancedMesh | null = null;
    if (highMat) {
      const antennaGeo = new THREE.CylinderGeometry(0.14, 0.35, 9.0, 6);
      const antennaMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.35,
        metalness: 0.72,
      });
      antennaInst = new THREE.InstancedMesh(antennaGeo, antennaMat, skyTowers.length);
      disposables.push(antennaGeo, antennaMat);
    }

    skyTowers.forEach((t, idx) => {
      dummy.position.set(t.x, 0, t.z);
      dummy.rotation.set(0, t.rot, 0);
      dummy.scale.set(t.w, t.h, t.d);
      dummy.updateMatrix();
      skyInst.setMatrixAt(idx, dummy.matrix);
      skyInst.setColorAt(idx, t.tint);

      if (spireInst) {
        dummy.position.set(t.x, t.h + 1.8, t.z);
        dummy.scale.set(t.w, 1, t.d);
        dummy.updateMatrix();
        spireInst.setMatrixAt(idx, dummy.matrix);
        spireInst.setColorAt(idx, t.tint);
      }

      if (antennaInst) {
        dummy.position.set(t.x, t.h + 7.6, t.z);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        antennaInst.setMatrixAt(idx, dummy.matrix);
      }
    });

    skyInst.instanceMatrix.needsUpdate = true;
    if (skyInst.instanceColor) skyInst.instanceColor.needsUpdate = true;
    skyInst.computeBoundingSphere();
    group.add(skyInst);

    if (spireInst) {
      spireInst.instanceMatrix.needsUpdate = true;
      if (spireInst.instanceColor) spireInst.instanceColor.needsUpdate = true;
      spireInst.computeBoundingSphere();
      group.add(spireInst);
    }
    if (antennaInst) {
      antennaInst.instanceMatrix.needsUpdate = true;
      antennaInst.computeBoundingSphere();
      group.add(antennaInst);
    }
  }

  // =========================================================================
  // 2B. HUGE MODERN FOOTBALL STADIUM IN CENTRAL PLAZA ("METRO ARENA")
  // =========================================================================
  const createPitchTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext('2d')!;

    // Alternating mowed grass stripes
    const stripes = 14;
    const sw = 1024 / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#15803d' : '#16a34a';
      ctx.fillRect(i * sw, 0, sw + 1, 640);
    }

    // Touchline chalk markings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = 6;
    const m = 42;
    ctx.strokeRect(m, m, 1024 - m * 2, 640 - m * 2);

    // Halfway line & center circle
    ctx.beginPath();
    ctx.moveTo(512, m);
    ctx.lineTo(512, 640 - m);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(512, 320, 92, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(512, 320, 7, 0, Math.PI * 2);
    ctx.fill();

    // Left & Right Penalty Areas
    ctx.strokeRect(m, 165, 148, 310);
    ctx.strokeRect(m, 232, 58, 176);
    ctx.strokeRect(1024 - m - 148, 165, 148, 310);
    ctx.strokeRect(1024 - m - 58, 232, 58, 176);

    // Penalty arcs
    ctx.beginPath();
    ctx.arc(m + 108, 320, 78, -0.68, 0.68);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(1024 - m - 108, 320, 78, Math.PI - 0.68, Math.PI + 0.68);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    return tex;
  };

  const createTierCrowdTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, 512, 128);
    const fanCols = ['#ef4444', '#facc15', '#38bdf8', '#ffffff', '#f97316', '#22c55e'];
    for (let r = 0; r < 10; r++) {
      ctx.fillStyle = r % 2 === 0 ? '#1e40af' : '#172554';
      ctx.fillRect(0, r * 12, 512, 5);
      for (let c = 0; c < 85; c++) {
        if ((r * 17 + c * 11) % 5 === 0) continue;
        ctx.fillStyle = fanCols[(r * 7 + c * 3) % fanCols.length];
        ctx.fillRect(c * 6 + 1, r * 12 + 3, 4, 7);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(12, 1);
    tex.anisotropy = maxAnisotropy;
    return tex;
  };

  const createMatchBannerTexture = (
    headline: string,
    teams: string,
    info: string,
    bgA: string,
    bgB: string,
    accent: string
  ): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 640;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, 640);
    grad.addColorStop(0, bgA);
    grad.addColorStop(1, bgB);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 640);

    // Architectural gold/cyan frame
    ctx.strokeStyle = accent;
    ctx.lineWidth = 14;
    ctx.strokeRect(12, 12, 488, 616);

    // Top spotlight arcs
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.moveTo(60, 0);
    ctx.lineTo(240, 290);
    ctx.lineTo(130, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(452, 0);
    ctx.lineTo(272, 290);
    ctx.lineTo(382, 0);
    ctx.closePath();
    ctx.fill();

    // Stylized soccer ball emblem
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(256, 200, 74, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    const pentPts = (cx: number, cy: number, r: number) => {
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const ang = -Math.PI / 2 + (k * Math.PI * 2) / 5;
        const px = cx + Math.cos(ang) * r;
        const py = cy + Math.sin(ang) * r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    };
    pentPts(256, 200, 26);
    for (let k = 0; k < 5; k++) {
      const ang = -Math.PI / 2 + (k * Math.PI * 2) / 5;
      pentPts(256 + Math.cos(ang) * 56, 200 + Math.sin(ang) * 56, 15);
    }

    ctx.fillStyle = accent;
    ctx.font = '900 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(headline, 256, 72);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 50px sans-serif';
    ctx.fillText(teams, 256, 355);

    ctx.fillStyle = accent;
    ctx.fillRect(64, 412, 384, 6);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 32px sans-serif';
    ctx.fillText(info, 256, 474);

    ctx.fillStyle = accent;
    ctx.fillRect(108, 526, 296, 56);
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 28px sans-serif';
    ctx.fillText('LIVE · METRO STADIUM', 256, 555);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    return tex;
  };

  const stadiumGroup = new THREE.Group();
  stadiumGroup.position.set(STADIUM_X, 0, STADIUM_Z);
  group.add(stadiumGroup);

  const pitchTex = createPitchTexture();
  const crowdTex = createTierCrowdTexture();
  const plazaMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.8 });
  const stadiumConcreteMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.62,
    metalness: 0.14,
    side: THREE.DoubleSide,
  });
  const stadiumDarkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.72,
    side: THREE.DoubleSide,
  });
  const stadiumRoofMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.28,
    metalness: 0.25,
    side: THREE.DoubleSide,
  });
  const stadiumGlassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.16,
    metalness: 0.72,
    side: THREE.DoubleSide,
  });
  const stadiumLedMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const tierMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: crowdTex,
    roughness: 0.65,
    side: THREE.DoubleSide,
  });
  const pitchMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: pitchTex,
    roughness: 0.85,
  });
  const goalPostMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
  const floodLampMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 2.4,
    roughness: 0.15,
  });

  // Enlarged oval stadium apron + podium (144m x 104m)
  const stApronGeo = new THREE.CylinderGeometry(1, 1.02, 0.34, 48);
  const stApron = new THREE.Mesh(stApronGeo, plazaMat);
  stApron.scale.set(72, 1, 52);
  stApron.position.y = 0.17;
  stApron.receiveShadow = enableShadows;
  stadiumGroup.add(stApron);

  // Enlarged Football Pitch (92m x 56m)
  const pitchGeo = new THREE.PlaneGeometry(92, 56);
  pitchGeo.rotateX(-Math.PI / 2);
  const pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
  pitchMesh.position.y = 0.38;
  pitchMesh.receiveShadow = enableShadows;
  stadiumGroup.add(pitchMesh);

  // Two 3D soccer goals (East & West ends of pitch)
  const goalCrossGeo = new THREE.BoxGeometry(0.28, 0.28, 9.2);
  const goalPostGeo = new THREE.BoxGeometry(0.28, 3.2, 0.28);
  const goalNetGeo = new THREE.BoxGeometry(2.5, 3.05, 9.0);
  const goalNetMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.44,
    roughness: 0.9,
  });
  for (const gx of [-41.0, 41.0]) {
    const dir = gx < 0 ? -1 : 1;
    const cross = new THREE.Mesh(goalCrossGeo, goalPostMat);
    cross.position.set(gx, 3.35, 0);
    const p1 = new THREE.Mesh(goalPostGeo, goalPostMat);
    p1.position.set(gx, 1.8, -4.5);
    const p2 = new THREE.Mesh(goalPostGeo, goalPostMat);
    p2.position.set(gx, 1.8, 4.5);
    const net = new THREE.Mesh(goalNetGeo, goalNetMat);
    net.position.set(gx + dir * 1.25, 1.85, 0);
    stadiumGroup.add(cross, p1, p2, net);
  }

  // Fully enclosed 360-degree stepped seating bowl & solid exterior facade wall
  const tierLowerGeo = new THREE.CylinderGeometry(1.0, 0.86, 6.4, 48, 1, true);
  const tierLower = new THREE.Mesh(tierLowerGeo, tierMat);
  tierLower.scale.set(60, 1, 43);
  tierLower.position.y = 3.5;
  tierLower.castShadow = enableShadows;
  tierLower.receiveShadow = enableShadows;

  const tierUpperGeo = new THREE.CylinderGeometry(1.0, 0.88, 8.2, 48, 1, true);
  const tierUpper = new THREE.Mesh(tierUpperGeo, tierMat);
  tierUpper.scale.set(66.5, 1, 49);
  tierUpper.position.y = 10.6;
  tierUpper.castShadow = enableShadows;
  tierUpper.receiveShadow = enableShadows;

  // Solid 360-degree lower architectural concrete stadium plinth wall (y = 0..5.6m)
  const extConcreteBaseGeo = new THREE.CylinderGeometry(1.0, 1.02, 5.6, 48, 1, true);
  const extConcreteBase = new THREE.Mesh(extConcreteBaseGeo, stadiumConcreteMat);
  extConcreteBase.scale.set(68.8, 1, 51.0);
  extConcreteBase.position.y = 2.8;
  extConcreteBase.castShadow = enableShadows;
  extConcreteBase.receiveShadow = enableShadows;

  // Full 360-degree glazed stadium curtain wall (y = 5.4..17.0m, DoubleSide)
  const extWallGeo = new THREE.CylinderGeometry(1.0, 1.01, 11.6, 48, 1, true);
  const extWall = new THREE.Mesh(extWallGeo, stadiumGlassMat);
  extWall.scale.set(68.2, 1, 50.6);
  extWall.position.y = 11.2;
  extWall.castShadow = enableShadows;
  extWall.receiveShadow = enableShadows;

  // Upper concrete frieze / cornice wall ring enclosing top facade (y = 16.8..19.6m)
  const extCorniceGeo = new THREE.CylinderGeometry(1.0, 1.0, 2.8, 48, 1, true);
  const extCornice = new THREE.Mesh(extCorniceGeo, stadiumConcreteMat);
  extCornice.scale.set(69.0, 1, 51.2);
  extCornice.position.y = 18.2;
  extCornice.castShadow = enableShadows;
  extCornice.receiveShadow = enableShadows;

  // Monumental West (-X) Gatehouse Entrance Portal framing the wall facing the start straight
  const portalWallGeo = new THREE.BoxGeometry(3.2, 19.6, 36.0);
  const portalWall = new THREE.Mesh(portalWallGeo, stadiumConcreteMat);
  portalWall.position.set(-68.6, 9.8, 0);
  portalWall.castShadow = enableShadows;
  portalWall.receiveShadow = enableShadows;

  const portalPylonGeo = new THREE.BoxGeometry(4.2, 22.0, 4.2);
  const portalArchGeo = new THREE.BoxGeometry(4.4, 3.8, 36.0);
  const portalGateGeo = new THREE.BoxGeometry(3.5, 4.4, 7.2);
  const portalPylonN = new THREE.Mesh(portalPylonGeo, stadiumConcreteMat);
  portalPylonN.position.set(-69.2, 11.0, -16.2);
  const portalPylonS = new THREE.Mesh(portalPylonGeo, stadiumConcreteMat);
  portalPylonS.position.set(-69.2, 11.0, 16.2);
  const portalArch = new THREE.Mesh(portalArchGeo, stadiumDarkSteelMat);
  portalArch.position.set(-69.2, 18.2, 0);
  portalPylonN.castShadow = enableShadows;
  portalPylonS.castShadow = enableShadows;
  portalArch.castShadow = enableShadows;
  stadiumGroup.add(portalWall, portalPylonN, portalPylonS, portalArch);

  for (const gz of [-9.5, 0, 9.5]) {
    const gateFrame = new THREE.Mesh(portalGateGeo, stadiumDarkSteelMat);
    gateFrame.position.set(-69.1, 2.2, gz);
    stadiumGroup.add(gateFrame);
  }

  // Cantilevered white modernist stadium roof canopy + glowing cyan fascia ring
  const stRoofRingGeo = new THREE.RingGeometry(0.7, 1.05, 48);
  stRoofRingGeo.rotateX(-Math.PI / 2);
  const stRoofRing = new THREE.Mesh(stRoofRingGeo, stadiumRoofMat);
  stRoofRing.scale.set(70, 1, 52);
  stRoofRing.position.y = 19.6;
  stRoofRing.castShadow = enableShadows;
  stRoofRing.receiveShadow = enableShadows;

  const stRoofRimGeo = new THREE.TorusGeometry(1.0, 0.032, 8, 48);
  stRoofRimGeo.rotateX(Math.PI / 2);
  const stRoofRim = new THREE.Mesh(stRoofRimGeo, stadiumLedMat);
  stRoofRim.scale.set(71.8, 1, 53.4);
  stRoofRim.position.y = 17.2;

  stadiumGroup.add(
    tierLower,
    tierUpper,
    extConcreteBase,
    extWall,
    extCornice,
    stRoofRing,
    stRoofRim
  );

  // Full 360-degree exterior structural concrete pilasters around entire perimeter bowl
  const ribGeo = new THREE.BoxGeometry(1.3, 20.0, 3.0);
  for (let r = 0; r < 24; r++) {
    const ang = (r / 24) * Math.PI * 2;
    const rx = Math.cos(ang) * 68.8;
    const rz = Math.sin(ang) * 51.0;
    const rib = new THREE.Mesh(ribGeo, stadiumConcreteMat);
    rib.position.set(rx, 10.0, rz);
    rib.rotation.y = -ang;
    rib.castShadow = enableShadows;
    rib.receiveShadow = enableShadows;
    stadiumGroup.add(rib);
  }

  // 4 towering 31m stadium floodlight masts visible across the skyline
  const floodPoleGeo = new THREE.BoxGeometry(1.5, 31.0, 1.5);
  const floodBankGeo = new THREE.BoxGeometry(7.2, 3.0, 1.0);
  for (const [fx, fz] of [
    [-55, -39],
    [55, -39],
    [-55, 39],
    [55, 39],
  ]) {
    const pole = new THREE.Mesh(floodPoleGeo, stadiumDarkSteelMat);
    pole.position.set(fx, 15.5, fz);
    pole.castShadow = enableShadows;
    const bank = new THREE.Mesh(floodBankGeo, floodLampMat);
    bank.position.set(fx, 30.8, fz);
    bank.lookAt(0, 1, 0);
    stadiumGroup.add(pole, bank);
  }

  // Stadium West, North & South Marquee Signs (Omitted on Low quality)
  if (profile.showBanners) {
    const stadiumMarqueeTex = createSignPlaqueTexture(
      'METRO ARENA',
      'NATIONAL FOOTBALL STADIUM',
      '#0f172a',
      '#38bdf8',
      '#facc15',
      aniso,
      profile.textureSizeScale
    );
    const stadiumMarqueeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: stadiumMarqueeTex,
      roughness: 0.3,
    });
    const stSignGeo = new THREE.BoxGeometry(28, 5.2, 0.85);
    const stSignW = new THREE.Mesh(stSignGeo, stadiumMarqueeMat);
    stSignW.position.set(-71.4, 15.2, 0);
    stSignW.rotation.y = -Math.PI / 2;
    const stSignS = new THREE.Mesh(stSignGeo, stadiumMarqueeMat);
    stSignS.position.set(0, 13.8, 51.8);
    const stSignN = new THREE.Mesh(stSignGeo, stadiumMarqueeMat);
    stSignN.position.set(0, 13.8, -51.8);
    stSignN.rotation.y = Math.PI;
    stadiumGroup.add(stSignW, stSignS, stSignN);
    disposables.push(stadiumMarqueeTex, stadiumMarqueeMat, stSignGeo);
  }

  disposables.push(
    pitchTex,
    crowdTex,
    plazaMat,
    stadiumConcreteMat,
    stadiumDarkSteelMat,
    stadiumRoofMat,
    stadiumGlassMat,
    stadiumLedMat,
    tierMat,
    pitchMat,
    goalPostMat,
    floodLampMat,
    stApronGeo,
    pitchGeo,
    goalCrossGeo,
    goalPostGeo,
    goalNetGeo,
    goalNetMat,
    tierLowerGeo,
    tierUpperGeo,
    extConcreteBaseGeo,
    extWallGeo,
    extCorniceGeo,
    portalWallGeo,
    portalPylonGeo,
    portalArchGeo,
    portalGateGeo,
    stRoofRingGeo,
    stRoofRimGeo,
    ribGeo,
    floodPoleGeo,
    floodBankGeo
  );

  // =========================================================================
  // 2C. 3 GIANT FOOTBALL MATCH BANNERS MOUNTED ON SKYSCRAPERS (Omitted on Low quality)
  // =========================================================================
  if (profile.showBanners) {
    const bannerSpecs = [
      {
        headline: 'MATCH OF THE SEASON',
        teams: 'METRO VS TITANS',
        info: 'TONIGHT · 20:00',
        bgA: '#0f172a',
        bgB: '#1d4ed8',
        accent: '#facc15',
        anchorSampleIdx: Math.floor(track.samples.length * 0.045),
      },
      {
        headline: 'CHAMPIONS CUP FINAL',
        teams: 'APEX FC VS CITY',
        info: 'SUNDAY · KICKOFF 19:30',
        bgA: '#4c0519',
        bgB: '#be123c',
        accent: '#fde047',
        anchorSampleIdx: Math.floor(track.samples.length * 0.32),
      },
      {
        headline: 'SUPER DERBY NIGHT',
        teams: 'UNITED VS ROYALS',
        info: 'GATES OPEN · 18:00',
        bgA: '#064e3b',
        bgB: '#0284c7',
        accent: '#ffffff',
        anchorSampleIdx: Math.floor(track.samples.length * 0.72),
      },
    ];

    const bannerFrameGeo = new THREE.BoxGeometry(13.8, 17.6, 0.55);
    const bannerFaceGeo = new THREE.PlaneGeometry(12.8, 16.4);
    const bannerFrameMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.35,
      metalness: 0.75,
    });
    disposables.push(bannerFrameGeo, bannerFaceGeo, bannerFrameMat);

    const usedTowerIndices = new Set<number>();
    for (const bs of bannerSpecs) {
      const anchorS = track.samples[bs.anchorSampleIdx % track.samples.length];
      let bestTowerIdx = -1;
      let bestScore = Infinity;

      for (let ti = 0; ti < skyTowers.length; ti++) {
        if (usedTowerIndices.has(ti)) continue;
        const t = skyTowers[ti];
        if (t.h < 34) continue;
        const distToRoad = Math.hypot(t.x - anchorS.x, t.z - anchorS.z);
        if (distToRoad > 130) continue;
        const score = distToRoad - Math.min(t.h, 70) * 0.45;
        if (score < bestScore) {
          bestScore = score;
          bestTowerIdx = ti;
        }
      }

      if (bestTowerIdx < 0) continue;
      usedTowerIndices.add(bestTowerIdx);
      const tower = skyTowers[bestTowerIdx];

      const toRoadX = anchorS.x - tower.x;
      const toRoadZ = anchorS.z - tower.z;
      const cosR = Math.cos(tower.rot);
      const sinR = Math.sin(tower.rot);
      const localX = toRoadX * cosR - toRoadZ * sinR;
      const localZ = toRoadX * sinR + toRoadZ * cosR;

      let offsetX = 0;
      let offsetZ = 0;
      let faceLocalYaw = 0;
      if (Math.abs(localX) / Math.max(1, tower.w) >= Math.abs(localZ) / Math.max(1, tower.d)) {
        const sign = localX >= 0 ? 1 : -1;
        offsetX = sign * (tower.w * 0.5 + 0.38);
        faceLocalYaw = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        const sign = localZ >= 0 ? 1 : -1;
        offsetZ = sign * (tower.d * 0.5 + 0.38);
        faceLocalYaw = sign > 0 ? 0 : Math.PI;
      }

      const bTex = createMatchBannerTexture(
        bs.headline,
        bs.teams,
        bs.info,
        bs.bgA,
        bs.bgB,
        bs.accent
      );
      const bMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: bTex,
        roughness: 0.32,
        emissive: 0xffffff,
        emissiveMap: bTex,
        emissiveIntensity: 0.25,
      });
      disposables.push(bTex, bMat);

      const towerBannerPivot = new THREE.Group();
      towerBannerPivot.position.set(tower.x, Math.min(tower.h * 0.58, 28), tower.z);
      towerBannerPivot.rotation.y = tower.rot;

      const billboard = new THREE.Group();
      billboard.position.set(offsetX, 0, offsetZ);
      billboard.rotation.y = faceLocalYaw;
      const frameMesh = new THREE.Mesh(bannerFrameGeo, bannerFrameMat);
      frameMesh.castShadow = enableShadows;
      const faceMesh = new THREE.Mesh(bannerFaceGeo, bMat);
      faceMesh.position.z = 0.3;
      billboard.add(frameMesh, faceMesh);
      towerBannerPivot.add(billboard);
      group.add(towerBannerPivot);
    }
  }

  // =========================================================================
  // 3. SUNLIT BOULEVARD TREES (Clear of Road, Sidewalks & Shops)
  // =========================================================================
  const treePlacements: Array<{ x: number; z: number; scale: number }> = [];
  const treeCount = Math.round(108 * profile.densityScale);
  for (let i = 0; i < treeCount; i++) {
    const s = track.samples[Math.floor((i / treeCount) * track.samples.length)];
    const side = i % 2 === 0 ? 1 : -1;
    const offset = track.halfWidth + SIDEWALK_OUTER_OFFSET + 2.2;
    const tx = s.x + s.rx * side * offset;
    const tz = s.z + s.rz * side * offset;
    if (!isClearOfTrack(tx, tz, 1.2)) continue;
    if (isNearShop(tx, tz, 0.5)) continue;
    if (isWalkwayBlocked?.(tx, tz, 1.4)) continue;
    treePlacements.push({ x: tx, z: tz, scale: 0.9 + envRand() * 0.45 });
  }
  if (treePlacements.length > 0) {
    const treeTrunkGeo = new THREE.CylinderGeometry(0.18, 0.25, 2.4, 7);
    treeTrunkGeo.translate(0, 1.2, 0);
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const canopyGeo = new THREE.DodecahedronGeometry(1.55, 0);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.72 });
    const tTrunkInst = new THREE.InstancedMesh(treeTrunkGeo, treeTrunkMat, treePlacements.length);
    const tCanopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, treePlacements.length);
    tTrunkInst.castShadow = enableShadows;
    tCanopyInst.castShadow = enableShadows;
    treePlacements.forEach((t, idx) => {
      dummy.position.set(t.x, 0, t.z);
      dummy.rotation.set(0, idx * 0.7, 0);
      dummy.scale.setScalar(t.scale);
      dummy.updateMatrix();
      tTrunkInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(t.x, 3.25 * t.scale, t.z);
      dummy.updateMatrix();
      tCanopyInst.setMatrixAt(idx, dummy.matrix);
    });
    tTrunkInst.instanceMatrix.needsUpdate = true;
    tCanopyInst.instanceMatrix.needsUpdate = true;
    group.add(tTrunkInst, tCanopyInst);
    disposables.push(treeTrunkGeo, treeTrunkMat, canopyGeo, canopyMat);
  }

  disposables.push(
    colorWallTex,
    skyBlueTex,
    unitBoxGeo,
    colorfulBuildingMat,
    skyBlueGlassMat,
    roofCapMat,
    skyRoofMat
  );

  return {
    group,
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
