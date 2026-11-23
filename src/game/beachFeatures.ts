import * as THREE from 'three';
import type { RaceTrack } from './track';
import { getGraphicsProfile, type GraphicsQuality } from './graphics';

export interface BeachFeaturesSystem {
  group: THREE.Group;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

interface SwimmerAnim {
  x: number;
  z: number;
  baseY: number;
  yaw: number;
  scale: number;
  isChild: boolean;
  phase: number;
  orbitR: number;
  orbitSpeed: number;
  skinColor: THREE.Color;
  swimColor: THREE.Color;
}

interface DeckWalkerAnim {
  centerX: number;
  centerZ: number;
  radius: number;
  angle: number;
  angularSpeed: number;
  scale: number;
  isChild: boolean;
  stridePhase: number;
  skinColor: THREE.Color;
  outfitColor: THREE.Color;
  hairColor: THREE.Color;
}

interface BallGameAnim {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  phase: number;
  speed: number;
  arcHeight: number;
  ballRadius: number;
  playerAScale: number;
  playerBScale: number;
}

const SKIN_TONES = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const HAIR_TONES = [0x0f172a, 0x3f2312, 0x78350f, 0xd97706, 0x94a3b8];
const SWIM_COLORS = [0x06b6d4, 0xf97316, 0xf43f5e, 0xfacc15, 0x10b981, 0x8b5cf6, 0x38bdf8];

function createSignTexture(
  title: string,
  subtitle: string,
  bgHex: string,
  accentHex: string,
  maxAnisotropy: number,
  sizeScale = 1
): THREE.CanvasTexture {
  const w = Math.max(128, Math.round(512 * sizeScale));
  const h = Math.max(48, Math.round(160 * sizeScale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (w !== 512 || h !== 160) {
    ctx.scale(w / 512, h / 160);
  }

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 512, 160);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 496, 144);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, 66);

  ctx.fillStyle = accentHex;
  ctx.font = '700 24px sans-serif';
  ctx.fillText(subtitle, 256, 118);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createResortFacadeTexture(
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

  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(0, 0, 256, 256);

  const floors = 4;
  const cols = 4;
  const fw = 256 / cols;
  const fh = 256 / floors;

  for (let r = 0; r < floors; r++) {
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(0, r * fh, 256, 7);
    for (let c = 0; c < cols; c++) {
      const wx = c * fw + 10;
      const wy = r * fh + 14;
      const ww = fw - 20;
      const wh = fh - 22;

      ctx.fillStyle = '#0284c7';
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = '#7dd3fc';
      ctx.fillRect(wx + 3, wy + 3, ww * 0.44, wh - 6);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(wx, wy, ww, wh);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createBeachBallTexture(
  maxAnisotropy: number,
  sizeScale = 1
): THREE.CanvasTexture {
  const w = Math.max(64, Math.round(256 * sizeScale));
  const h = Math.max(32, Math.round(128 * sizeScale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (w !== 256 || h !== 128) {
    ctx.scale(w / 256, h / 128);
  }

  const panels = ['#ef4444', '#ffffff', '#facc15', '#ffffff', '#0ea5e9', '#ffffff'];
  const pw = 256 / panels.length;
  panels.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(i * pw, 0, pw + 1, 128);
  });

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 16);
  ctx.fillRect(0, 112, 256, 16);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createPoolTileTexture(
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

  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(0, 0, 256, 256);

  const s = 32;
  for (let y = 0; y < 256; y += s) {
    for (let x = 0; x < 256; x += s) {
      ctx.fillStyle = (x / s + y / s) % 2 === 0 ? '#38bdf8' : '#0284c7';
      ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
    }
  }

  ctx.fillStyle = 'rgba(224, 242, 254, 0.28)';
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.arc((i * 53) % 256, (i * 89) % 256, 12 + (i % 3) * 6, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function buildBeachFeatures(
  _track: RaceTrack,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
  envRand: () => number,
  isClearOfTrack: (x: number, z: number, radius: number) => boolean,
  graphicsQuality: GraphicsQuality = 'medium'
): BeachFeaturesSystem {
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

  // Giant Mega Waterpark occupying central-west lagoon right across from the Start Straight,
  // flanked by Coral Resort (-125, -125) and our tall red-and-white Lighthouse headland!
  const WP_X = -70;
  const WP_Z = -18;
  const WP_RADIUS = 58;
  const WP_SCALE = 1.62;
  const WP_WORLD_RADIUS = WP_RADIUS * WP_SCALE;

  const RESORT_X = -125;
  const RESORT_Z = -125;

  const LIGHTHOUSE_X = -275;
  const LIGHTHOUSE_Z = -135;

  // =========================================================================
  // 1. MEGA WATERPARK (AQUA PARK) — Scaled 1.62x & Closer to Start Straight!
  // =========================================================================
  const wpGroup = new THREE.Group();
  wpGroup.position.set(WP_X, 0, WP_Z);
  wpGroup.scale.setScalar(WP_SCALE);
  group.add(wpGroup);

  // Outer turquoise lagoon moat bordering the massive waterpark plaza
  const moatGeo = new THREE.RingGeometry(WP_RADIUS - 0.6, WP_RADIUS + 7.5, 64);
  moatGeo.rotateX(-Math.PI / 2);
  const waterMat = makeMat({
    color: 0x06b6d4,
    roughness: 0.18,
    metalness: 0.25,
    transparent: true,
    opacity: 0.9,
  });
  const moatMesh = new THREE.Mesh(moatGeo, waterMat);
  moatMesh.position.y = 0.04;
  wpGroup.add(moatMesh);

  // Travertine stone mega plaza deck
  const deckGeo = new THREE.CylinderGeometry(WP_RADIUS, WP_RADIUS + 0.8, 0.24, 64);
  const deckMat = makeMat({
    color: 0xcbd5e1,
    roughness: 0.78,
    metalness: 0.06,
  });
  const deckMesh = new THREE.Mesh(deckGeo, deckMat);
  deckMesh.position.y = 0.12;
  deckMesh.receiveShadow = enableShadows;
  wpGroup.add(deckMesh);

  // Bright cobalt coping rim around the giant plaza
  const copingGeo = new THREE.TorusGeometry(WP_RADIUS - 0.3, 0.45, 8, 64);
  copingGeo.rotateX(Math.PI / 2);
  const copingMat = makeMat({ color: 0x0284c7, roughness: 0.42 });
  const copingMesh = new THREE.Mesh(copingGeo, copingMat);
  copingMesh.position.y = 0.28;
  wpGroup.add(copingMesh);

  // Pool tile water material
  const poolTileTex = createPoolTileTexture(aniso, texScale);
  const poolWaterMat = makeMat({
    color: 0xffffff,
    map: poolTileTex,
    roughness: 0.14,
    metalness: 0.22,
  });
  const poolRimMat = makeMat({ color: 0xf8fafc, roughness: 0.55 });

  // A. Giant Wave Pool (42m x 26m) on North-East quadrant
  const wavePoolRimGeo = new THREE.BoxGeometry(42, 0.26, 26);
  const wavePoolRim = new THREE.Mesh(wavePoolRimGeo, poolRimMat);
  wavePoolRim.position.set(6, 0.28, -14);
  wpGroup.add(wavePoolRim);

  const wavePoolWaterGeo = new THREE.PlaneGeometry(39.6, 23.6);
  wavePoolWaterGeo.rotateX(-Math.PI / 2);
  const wavePoolWater = new THREE.Mesh(wavePoolWaterGeo, poolWaterMat);
  wavePoolWater.position.set(6, 0.43, -14);
  wpGroup.add(wavePoolWater);

  // B. Lazy River / Circular Island Channel on West-South quadrant
  const lazyRimOuterGeo = new THREE.RingGeometry(9.2, 18.2, 48);
  lazyRimOuterGeo.rotateX(-Math.PI / 2);
  const lazyRim = new THREE.Mesh(lazyRimOuterGeo, poolRimMat);
  lazyRim.position.set(-22, 0.36, 18);
  const lazyWaterGeo = new THREE.RingGeometry(10.2, 17.2, 48);
  lazyWaterGeo.rotateX(-Math.PI / 2);
  const lazyWater = new THREE.Mesh(lazyWaterGeo, poolWaterMat);
  lazyWater.position.set(-22, 0.43, 18);
  wpGroup.add(lazyRim, lazyWater);

  // C. Large Kids' Splash Lagoon (r = 16.5m) with TWO Polka-Dot Mushroom Fountains!
  const kidsPoolRimGeo = new THREE.CylinderGeometry(16.5, 16.8, 0.26, 40);
  const kidsPoolRim = new THREE.Mesh(kidsPoolRimGeo, poolRimMat);
  kidsPoolRim.position.set(20, 0.28, 22);
  wpGroup.add(kidsPoolRim);

  const kidsPoolWaterGeo = new THREE.CircleGeometry(15.2, 40);
  kidsPoolWaterGeo.rotateX(-Math.PI / 2);
  const kidsPoolWater = new THREE.Mesh(kidsPoolWaterGeo, poolWaterMat);
  kidsPoolWater.position.set(20, 0.43, 22);
  wpGroup.add(kidsPoolWater);

  // Two Kids Splash Mushroom Fountains
  const mushStemGeo = new THREE.CylinderGeometry(0.55, 0.68, 3.1, 12);
  const mushStemMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
  const mushCapGeo = new THREE.ConeGeometry(2.75, 1.45, 16);
  const mushCapMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4 });
  const mushCapAltMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
  const splashRingGeo = new THREE.TorusGeometry(3.0, 0.18, 8, 24);
  splashRingGeo.rotateX(Math.PI / 2);
  const splashRingMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    roughness: 0.2,
    transparent: true,
    opacity: 0.8,
  });

  const mushroomSpots = [
    { x: 16.2, z: 20.5, capMat: mushCapMat },
    { x: 25.4, z: 24.5, capMat: mushCapAltMat },
  ];
  for (const ms of mushroomSpots) {
    const stem = new THREE.Mesh(mushStemGeo, mushStemMat);
    stem.position.set(ms.x, 1.8, ms.z);
    const cap = new THREE.Mesh(mushCapGeo, ms.capMat);
    cap.position.set(ms.x, 3.6, ms.z);
    const ring = new THREE.Mesh(splashRingGeo, splashRingMat);
    ring.position.set(ms.x, 0.47, ms.z);
    wpGroup.add(stem, cap, ring);
  }

  // D. Towering 16m Mega Slide Launch Tower (visible over the boardwalk from Start Straight)
  const towerMat = makeMat({
    color: 0xf8fafc,
    roughness: 0.45,
    metalness: 0.25,
  });
  const towerWoodMat = makeMat({
    color: 0xd97706,
    roughness: 0.72,
  });
  const towerX = -27;
  const towerZ = -18;
  const postGeo = new THREE.CylinderGeometry(0.32, 0.36, 15.6, 8);
  const platformGeo = new THREE.BoxGeometry(9.8, 0.45, 9.8);

  for (const px of [-4.2, 4.2]) {
    for (const pz of [-4.2, 4.2]) {
      const post = new THREE.Mesh(postGeo, towerMat);
      post.position.set(towerX + px, 7.9, towerZ + pz);
      post.castShadow = enableShadows;
      wpGroup.add(post);
    }
  }
  const lowDeck = new THREE.Mesh(platformGeo, towerWoodMat);
  lowDeck.position.set(towerX, 5.2, towerZ);
  lowDeck.castShadow = enableShadows;
  lowDeck.receiveShadow = enableShadows;
  const midDeck = new THREE.Mesh(platformGeo, towerWoodMat);
  midDeck.position.set(towerX, 9.5, towerZ);
  midDeck.castShadow = enableShadows;
  midDeck.receiveShadow = enableShadows;
  const topDeck = new THREE.Mesh(platformGeo, towerWoodMat);
  topDeck.position.set(towerX, 13.8, towerZ);
  topDeck.castShadow = enableShadows;
  topDeck.receiveShadow = enableShadows;

  const towerRoofGeo = new THREE.ConeGeometry(7.8, 3.4, 4);
  towerRoofGeo.rotateY(Math.PI / 4);
  const towerRoofMat = makeMat({ color: 0x0ea5e9, roughness: 0.42 });
  const towerRoof = new THREE.Mesh(towerRoofGeo, towerRoofMat);
  towerRoof.position.set(towerX, 17.5, towerZ);
  towerRoof.castShadow = enableShadows;

  // Wide staircase ramp
  const stairGeo = new THREE.BoxGeometry(3.2, 0.42, 17.5);
  const stairMesh = new THREE.Mesh(stairGeo, towerWoodMat);
  stairMesh.position.set(towerX - 7.4, 6.4, towerZ + 5.2);
  stairMesh.rotation.x = -0.7;
  stairMesh.castShadow = enableShadows;

  // Giant "AQUA PARK" 3-sided rooftop signboard visible from start straight & track (omitted on Low)
  const wpSignTex = createSignTexture(
    'AQUA PARK',
    'MEGA SLIDES & WAVE BAY',
    '#0369a1',
    '#facc15',
    aniso,
    texScale
  );
  const wpSignGeo = new THREE.BoxGeometry(12.2, 3.4, 0.55);
  const wpSignMat = makeMat({
    color: 0xffffff,
    map: wpSignTex,
    roughness: 0.32,
  });
  wpGroup.add(lowDeck, midDeck, topDeck, towerRoof, stairMesh);
  if (profile.showBanners) {
    const wpSignFront = new THREE.Mesh(wpSignGeo, wpSignMat);
    wpSignFront.position.set(towerX, 15.2, towerZ + 5.1);
    wpSignFront.rotation.y = -0.35;
    const wpSignWest = new THREE.Mesh(wpSignGeo, wpSignMat);
    wpSignWest.position.set(towerX - 5.1, 15.2, towerZ);
    wpSignWest.rotation.y = -Math.PI / 2;
    const wpSignBack = new THREE.Mesh(wpSignGeo, wpSignMat);
    wpSignBack.position.set(towerX + 5.1, 15.2, towerZ);
    wpSignBack.rotation.y = Math.PI / 2;
    wpGroup.add(wpSignFront, wpSignWest, wpSignBack);
  }

  // E. 5 Giant Sweeping TubeGeometry Water Slides
  const slideConfigs: Array<{
    pts: THREE.Vector3[];
    radius: number;
    color: number;
    splashX: number;
    splashZ: number;
  }> = [
    {
      // 1. Giant Yellow Spiral Chute across North Wave Pool
      pts: [
        new THREE.Vector3(towerX + 3.6, 13.9, towerZ - 2.6),
        new THREE.Vector3(towerX + 14.0, 11.4, towerZ - 14.0),
        new THREE.Vector3(towerX + 27.5, 7.2, towerZ - 11.0),
        new THREE.Vector3(towerX + 23.0, 3.2, towerZ - 0.5),
        new THREE.Vector3(3.0, 0.65, -18.5),
      ],
      radius: 1.22,
      color: 0xfacc15,
      splashX: 3.0,
      splashZ: -18.5,
    },
    {
      // 2. Coral-Orange Mega Speed Drop into Wave Pool
      pts: [
        new THREE.Vector3(towerX + 3.8, 13.9, towerZ + 1.8),
        new THREE.Vector3(towerX + 14.0, 9.6, towerZ + 3.0),
        new THREE.Vector3(towerX + 24.5, 4.4, towerZ + 4.2),
        new THREE.Vector3(9.5, 0.65, -11.0),
      ],
      radius: 1.12,
      color: 0xf97316,
      splashX: 9.5,
      splashZ: -11.0,
    },
    {
      // 3. Hot-Pink Twister Slide sweeping to East Wave Pool
      pts: [
        new THREE.Vector3(towerX + 1.2, 8.7, towerZ - 4.0),
        new THREE.Vector3(towerX + 12.0, 7.2, towerZ - 21.0),
        new THREE.Vector3(towerX + 32.0, 4.8, towerZ - 16.0),
        new THREE.Vector3(16.0, 0.65, -20.0),
      ],
      radius: 1.04,
      color: 0xf43f5e,
      splashX: 16.0,
      splashZ: -20.0,
    },
    {
      // 4. Bright Cyan Express Slide into Kids Splash Lagoon
      pts: [
        new THREE.Vector3(towerX + 3.5, 8.7, towerZ + 3.8),
        new THREE.Vector3(towerX + 16.0, 6.4, towerZ + 18.0),
        new THREE.Vector3(towerX + 29.0, 3.4, towerZ + 31.0),
        new THREE.Vector3(11.5, 0.6, 17.5),
      ],
      radius: 0.98,
      color: 0x06b6d4,
      splashX: 11.5,
      splashZ: 17.5,
    },
    {
      // 5. Emerald Boomerang Slide into Lazy River Lagoon
      pts: [
        new THREE.Vector3(towerX - 1.5, 4.9, towerZ + 4.2),
        new THREE.Vector3(towerX - 6.0, 3.6, towerZ + 15.0),
        new THREE.Vector3(towerX + 1.0, 2.0, towerZ + 24.0),
        new THREE.Vector3(-22.0, 0.6, 4.5),
      ],
      radius: 0.92,
      color: 0x10b981,
      splashX: -22.0,
      splashZ: 4.5,
    },
  ];

  for (const sc of slideConfigs) {
    const curve = new THREE.CatmullRomCurve3(sc.pts);
    const tubeGeo = new THREE.TubeGeometry(curve, simpleMat ? 22 : 38, sc.radius, simpleMat ? 8 : 12, false);
    const tubeMat = makeMat({
      color: sc.color,
      roughness: 0.22,
      metalness: 0.14,
    });
    const slideMesh = new THREE.Mesh(tubeGeo, tubeMat);
    slideMesh.castShadow = enableShadows;
    slideMesh.receiveShadow = enableShadows;
    wpGroup.add(slideMesh);

    const sRing = new THREE.Mesh(splashRingGeo, splashRingMat);
    sRing.position.set(sc.splashX, 0.47, sc.splashZ);
    sRing.scale.setScalar(0.85);
    wpGroup.add(sRing);
    disposables.push(tubeGeo, tubeMat);
  }

  // F. Two Lifeguard Chairs + Poolside Parasol Cabanas
  const lgLegGeo = new THREE.BoxGeometry(0.18, 3.2, 0.18);
  const lgSeatGeo = new THREE.BoxGeometry(1.4, 0.22, 1.2);
  const lgMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
  const lgAccentMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 });
  for (const lgPos of [
    { x: 29, z: -12 },
    { x: 3.5, z: 22 },
  ]) {
    for (const dx of [-0.55, 0.55]) {
      for (const dz of [-0.48, 0.48]) {
        const leg = new THREE.Mesh(lgLegGeo, lgMat);
        leg.position.set(lgPos.x + dx, 1.7, lgPos.z + dz);
        wpGroup.add(leg);
      }
    }
    const lgSeat = new THREE.Mesh(lgSeatGeo, lgAccentMat);
    lgSeat.position.set(lgPos.x, 3.25, lgPos.z);
    wpGroup.add(lgSeat);
  }

  // Poolside shade parasols around plaza walkways
  const deckParaPoleGeo = new THREE.CylinderGeometry(0.08, 0.09, 3.1, 6);
  const deckParaCapGeo = new THREE.ConeGeometry(2.6, 0.9, 8);
  const deckParaSpots = [
    { x: -6, z: -38, color: 0xf97316 },
    { x: 18, z: -38, color: 0x06b6d4 },
    { x: 38, z: -20, color: 0xfacc15 },
    { x: 40, z: 6, color: 0xf43f5e },
    { x: -2, z: 38, color: 0x10b981 },
    { x: -42, z: 6, color: 0x38bdf8 },
  ];
  for (const dp of deckParaSpots) {
    const pole = new THREE.Mesh(deckParaPoleGeo, lgMat);
    pole.position.set(dp.x, 1.65, dp.z);
    const capMat = new THREE.MeshStandardMaterial({ color: dp.color, roughness: 0.5 });
    const cap = new THREE.Mesh(deckParaCapGeo, capMat);
    cap.position.set(dp.x, 3.25, dp.z);
    wpGroup.add(pole, cap);
    disposables.push(capMat);
  }

  // Floating swim tubes inside all 3 pools
  const floatGeo = new THREE.TorusGeometry(0.75, 0.25, 10, 20);
  floatGeo.rotateX(Math.PI / 2);
  const floatMeshes: Array<{ mesh: THREE.Mesh; baseX: number; baseZ: number; phase: number }> = [];
  const floatSpots = [
    { x: 14, z: -15, color: 0xf43f5e },
    { x: 20, z: -7, color: 0xfacc15 },
    { x: -4, z: -9, color: 0x38bdf8 },
    { x: 24, z: 16, color: 0xa855f7 },
    { x: 14, z: 29, color: 0xf97316 },
    { x: -22, z: 4.5, color: 0xfacc15 },
    { x: -35, z: 18, color: 0xf43f5e },
    { x: -9, z: 18, color: 0x10b981 },
  ];
  floatSpots.forEach((fs, idx) => {
    const fMat = new THREE.MeshStandardMaterial({ color: fs.color, roughness: 0.35 });
    const fMesh = new THREE.Mesh(floatGeo, fMat);
    fMesh.position.set(fs.x, 0.5, fs.z);
    wpGroup.add(fMesh);
    floatMeshes.push({ mesh: fMesh, baseX: fs.x, baseZ: fs.z, phase: idx * 1.1 });
    disposables.push(fMat);
  });

  disposables.push(
    moatGeo,
    waterMat,
    deckGeo,
    deckMat,
    copingGeo,
    copingMat,
    poolTileTex,
    poolWaterMat,
    poolRimMat,
    wavePoolRimGeo,
    wavePoolWaterGeo,
    lazyRimOuterGeo,
    lazyWaterGeo,
    kidsPoolRimGeo,
    kidsPoolWaterGeo,
    mushStemGeo,
    mushStemMat,
    mushCapGeo,
    mushCapMat,
    mushCapAltMat,
    splashRingGeo,
    splashRingMat,
    towerMat,
    towerWoodMat,
    postGeo,
    platformGeo,
    towerRoofGeo,
    towerRoofMat,
    stairGeo,
    wpSignTex,
    wpSignGeo,
    wpSignMat,
    lgLegGeo,
    lgSeatGeo,
    lgMat,
    lgAccentMat,
    deckParaPoleGeo,
    deckParaCapGeo,
    floatGeo
  );

  // =========================================================================
  // 2. CORAL BAY RESORT BUILDING — North-West Lagoon Cove (-125, -125)
  // =========================================================================
  const resortGroup = new THREE.Group();
  resortGroup.position.set(RESORT_X, 0, RESORT_Z);
  resortGroup.rotation.y = -0.55;
  group.add(resortGroup);

  const resortTex = createResortFacadeTexture(aniso, texScale);
  const resortWallMat = makeMat({
    color: 0xffffff,
    map: resortTex,
    roughness: 0.62,
    metalness: 0.08,
  });
  const coralTrimMat = makeMat({
    color: 0xf97316,
    roughness: 0.52,
    metalness: 0.06,
  });
  const balconyWhiteMat = makeMat({
    color: 0xf8fafc,
    roughness: 0.5,
  });
  const terraceWoodMat = makeMat({
    color: 0xb45309,
    roughness: 0.78,
  });
  const glassLobbyMat = makeMat({
    color: 0x0ea5e9,
    roughness: 0.14,
    metalness: 0.75,
  });

  const resortPadGeo = new THREE.BoxGeometry(24, 0.35, 36);
  const resortPad = new THREE.Mesh(resortPadGeo, deckMat);
  resortPad.position.y = 0.175;
  resortPad.receiveShadow = enableShadows;
  resortGroup.add(resortPad);

  const atriumGeo = new THREE.BoxGeometry(11.5, 16.5, 12.5);
  const atriumMesh = new THREE.Mesh(atriumGeo, resortWallMat);
  atriumMesh.position.set(0, 8.5, 0);
  atriumMesh.castShadow = enableShadows;
  atriumMesh.receiveShadow = enableShadows;
  resortGroup.add(atriumMesh);

  const wingGeo = new THREE.BoxGeometry(9.2, 10.8, 10.5);
  const northWing = new THREE.Mesh(wingGeo, resortWallMat);
  northWing.position.set(0.4, 5.7, -11.2);
  northWing.castShadow = enableShadows;
  northWing.receiveShadow = enableShadows;
  const southWing = new THREE.Mesh(wingGeo, resortWallMat);
  southWing.position.set(0.4, 5.7, 11.2);
  southWing.castShadow = enableShadows;
  southWing.receiveShadow = enableShadows;
  resortGroup.add(northWing, southWing);

  const atriumBalconyGeo = new THREE.BoxGeometry(12.6, 0.32, 13.6);
  for (const by of [4.1, 7.6, 11.1, 14.6]) {
    const slab = new THREE.Mesh(atriumBalconyGeo, balconyWhiteMat);
    slab.position.set(0, by, 0);
    resortGroup.add(slab);
  }
  const wingBalconyGeo = new THREE.BoxGeometry(10.2, 0.28, 11.4);
  for (const bz of [-11.2, 11.2]) {
    for (const by of [4.0, 7.4, 10.8]) {
      const slab = new THREE.Mesh(wingBalconyGeo, balconyWhiteMat);
      slab.position.set(0.4, by, bz);
      resortGroup.add(slab);
    }
  }

  const atriumRoofGeo = new THREE.BoxGeometry(12.2, 1.3, 13.2);
  const atriumRoof = new THREE.Mesh(atriumRoofGeo, coralTrimMat);
  atriumRoof.position.set(0, 17.2, 0);
  atriumRoof.castShadow = enableShadows;
  const wingRoofGeo = new THREE.BoxGeometry(9.8, 1.0, 11.0);
  const nRoof = new THREE.Mesh(wingRoofGeo, coralTrimMat);
  nRoof.position.set(0.4, 11.5, -11.2);
  nRoof.castShadow = enableShadows;
  const sRoof = new THREE.Mesh(wingRoofGeo, coralTrimMat);
  sRoof.position.set(0.4, 11.5, 11.2);
  sRoof.castShadow = enableShadows;
  resortGroup.add(atriumRoof, nRoof, sRoof);

  const lobbyGlassGeo = new THREE.BoxGeometry(1.4, 3.6, 8.6);
  const lobbyGlass = new THREE.Mesh(lobbyGlassGeo, glassLobbyMat);
  lobbyGlass.position.set(-5.9, 2.1, 0);
  const canopyGeo = new THREE.BoxGeometry(4.2, 0.45, 9.2);
  const canopyMesh = new THREE.Mesh(canopyGeo, coralTrimMat);
  canopyMesh.position.set(-7.6, 3.85, 0);
  const canopyPillarGeo = new THREE.CylinderGeometry(0.18, 0.2, 3.6, 8);
  for (const pz of [-4.0, 4.0]) {
    const p = new THREE.Mesh(canopyPillarGeo, balconyWhiteMat);
    p.position.set(-9.2, 2.0, pz);
    resortGroup.add(p);
  }
  resortGroup.add(lobbyGlass, canopyMesh);

  const resDeckGeo = new THREE.BoxGeometry(6.8, 0.28, 26);
  const resDeck = new THREE.Mesh(resDeckGeo, terraceWoodMat);
  resDeck.position.set(8.6, 0.3, 0);
  const resPoolGeo = new THREE.PlaneGeometry(4.8, 13.5);
  resPoolGeo.rotateX(-Math.PI / 2);
  const resPool = new THREE.Mesh(resPoolGeo, poolWaterMat);
  resPool.position.set(8.6, 0.46, 0);
  resortGroup.add(resDeck, resPool);

  const resortSignTex = createSignTexture(
    'CORAL RESORT',
    'BEACHFRONT HOTEL & SPA',
    '#0f172a',
    '#fb923c',
    aniso,
    texScale
  );
  const resortSignMat = makeMat({
    color: 0xffffff,
    map: resortSignTex,
    roughness: 0.35,
  });
  const signBoardGeo = new THREE.BoxGeometry(10.8, 2.5, 0.4);
  if (profile.showBanners) {
    const resortSignFront = new THREE.Mesh(signBoardGeo, resortSignMat);
    resortSignFront.position.set(-5.8, 18.8, 0);
    resortSignFront.rotation.y = -Math.PI / 2;
    const resortSignBack = new THREE.Mesh(signBoardGeo, resortSignMat);
    resortSignBack.position.set(5.8, 18.8, 0);
    resortSignBack.rotation.y = Math.PI / 2;
    resortGroup.add(resortSignFront, resortSignBack);
  }

  disposables.push(
    resortTex,
    resortWallMat,
    coralTrimMat,
    balconyWhiteMat,
    terraceWoodMat,
    glassLobbyMat,
    resortPadGeo,
    atriumGeo,
    wingGeo,
    atriumBalconyGeo,
    wingBalconyGeo,
    atriumRoofGeo,
    wingRoofGeo,
    lobbyGlassGeo,
    canopyGeo,
    canopyPillarGeo,
    resDeckGeo,
    resPoolGeo,
    resortSignTex,
    signBoardGeo,
    resortSignMat
  );

  const STAND_SPOTS = [
    { kind: 'corn' as const, x: -197, z: 15, yaw: -1.53 },
    { kind: 'cocktail' as const, x: -234, z: -24, yaw: 1.56 },
    { kind: 'swimshop' as const, x: -237, z: -74, yaw: 1.56 },
    { kind: 'corn' as const, x: 189, z: 40, yaw: 2.35 },
    { kind: 'cocktail' as const, x: -154, z: 212, yaw: 2.79 },
  ];

  // =========================================================================
  // 2B. WHITE LUXURY CRUISE SHIP OUT IN THE OCEAN (Off the West Coastline)
  // =========================================================================
  const cruiseShip = new THREE.Group();
  cruiseShip.position.set(-342, 0, -40);
  cruiseShip.rotation.y = 0.08;
  group.add(cruiseShip);

  const shipWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.14,
  });
  const shipHullDarkMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.45,
    metalness: 0.28,
  });
  const shipRedLineMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.5,
  });
  const shipWindowMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.28,
    roughness: 0.12,
    metalness: 0.78,
  });
  const shipAccentMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    roughness: 0.35,
  });
  const shipLifeboatMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.4,
  });
  const shipDeckTeakMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.8,
  });

  // Lower hull + crimson waterline boot + crisp white hull body
  const hullRedGeo = new THREE.BoxGeometry(15.2, 1.4, 86);
  const hullRed = new THREE.Mesh(hullRedGeo, shipRedLineMat);
  hullRed.position.y = 0.7;

  const hullWhiteGeo = new THREE.BoxGeometry(16.0, 5.2, 88);
  const hullWhite = new THREE.Mesh(hullWhiteGeo, shipWhiteMat);
  hullWhite.position.y = 4.0;

  // Tapered bow cone wedge facing -Z (north)
  const bowGeo = new THREE.ConeGeometry(8.0, 18.0, 4);
  bowGeo.rotateY(Math.PI / 4);
  bowGeo.rotateX(-Math.PI / 2);
  bowGeo.scale(1.0, 0.42, 1.0);
  const bowMesh = new THREE.Mesh(bowGeo, shipWhiteMat);
  bowMesh.position.set(0, 3.6, -52.5);

  const bowRedGeo = new THREE.ConeGeometry(7.6, 16.5, 4);
  bowRedGeo.rotateY(Math.PI / 4);
  bowRedGeo.rotateX(-Math.PI / 2);
  bowRedGeo.scale(1.0, 0.16, 1.0);
  const bowRedMesh = new THREE.Mesh(bowRedGeo, shipRedLineMat);
  bowRedMesh.position.set(0, 0.75, -51.5);

  // 4 Stepped White Passenger Superstructure Decks + Sky-Blue Cabin Ribbon Windows
  const deckWidths = [15.4, 14.4, 13.0, 10.2];
  const deckLengths = [74, 66, 56, 36];
  const deckGeoList: THREE.BufferGeometry[] = [];
  for (let d = 0; d < 4; d++) {
    const dy = 7.9 + d * 3.1;
    const dGeo = new THREE.BoxGeometry(deckWidths[d], 2.95, deckLengths[d]);
    const dMesh = new THREE.Mesh(dGeo, shipWhiteMat);
    dMesh.position.set(0, dy, 2 + d * 1.4);
    cruiseShip.add(dMesh);

    const wGeo = new THREE.BoxGeometry(deckWidths[d] + 0.25, 1.25, deckLengths[d] - 3.0);
    const wMesh = new THREE.Mesh(wGeo, shipWindowMat);
    wMesh.position.set(0, dy + 0.15, 2 + d * 1.4);
    cruiseShip.add(wMesh);

    deckGeoList.push(dGeo, wGeo);
  }

  // Forward Ship Bridge Wings + Mast + Radar
  const bridgeWingGeo = new THREE.BoxGeometry(19.6, 1.8, 4.4);
  const bridgeWing = new THREE.Mesh(bridgeWingGeo, shipWhiteMat);
  bridgeWing.position.set(0, 16.2, -22.5);
  const bridgeGlassGeo = new THREE.BoxGeometry(18.8, 1.05, 4.65);
  const bridgeGlass = new THREE.Mesh(bridgeGlassGeo, shipWindowMat);
  bridgeGlass.position.set(0, 16.3, -22.6);

  const mastGeo = new THREE.CylinderGeometry(0.28, 0.48, 10.5, 8);
  const mast = new THREE.Mesh(mastGeo, shipWhiteMat);
  mast.position.set(0, 23.2, -11.5);
  const radarCrossGeo = new THREE.BoxGeometry(5.6, 0.35, 0.4);
  const radarCross = new THREE.Mesh(radarCrossGeo, shipAccentMat);
  radarCross.position.set(0, 26.8, -11.5);

  // Twin Iconic Blue-and-White Cruise Funnels + Orange Lifeboats
  const funnelGeo = new THREE.CylinderGeometry(1.75, 2.35, 6.8, 12);
  const funnelCapGeo = new THREE.CylinderGeometry(1.85, 1.85, 1.2, 12);
  for (const fz of [2.5, 13.5]) {
    const f = new THREE.Mesh(funnelGeo, shipAccentMat);
    f.position.set(0, 21.8, fz);
    f.rotation.x = 0.18;
    const cap = new THREE.Mesh(funnelCapGeo, shipHullDarkMat);
    cap.position.set(0, 25.2, fz + 0.58);
    cap.rotation.x = 0.18;
    cruiseShip.add(f, cap);
  }

  // Aft Sun Deck + Turquoise Pool on top stern deck
  const aftDeckGeo = new THREE.BoxGeometry(12.2, 0.3, 18);
  const aftDeck = new THREE.Mesh(aftDeckGeo, shipDeckTeakMat);
  aftDeck.position.set(0, 15.8, 28);
  const aftPoolGeo = new THREE.BoxGeometry(6.8, 0.12, 10.5);
  const aftPool = new THREE.Mesh(aftPoolGeo, shipWindowMat);
  aftPool.position.set(0, 15.96, 28);

  // 8 Orange Lifeboats slung along port & starboard sides
  const lifeboatGeo = new THREE.CapsuleGeometry(0.65, 2.2, 4, 8);
  lifeboatGeo.rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const lb = new THREE.Mesh(lifeboatGeo, shipLifeboatMat);
      lb.position.set(side * 8.15, 7.6, -16 + k * 11.5);
      cruiseShip.add(lb);
    }
  }

  cruiseShip.add(
    hullRed,
    hullWhite,
    bowMesh,
    bowRedMesh,
    bridgeWing,
    bridgeGlass,
    mast,
    radarCross,
    aftDeck,
    aftPool
  );

  disposables.push(
    shipWhiteMat,
    shipHullDarkMat,
    shipRedLineMat,
    shipWindowMat,
    shipAccentMat,
    shipLifeboatMat,
    shipDeckTeakMat,
    hullRedGeo,
    hullWhiteGeo,
    bowGeo,
    bowRedGeo,
    ...deckGeoList,
    bridgeWingGeo,
    bridgeGlassGeo,
    mastGeo,
    radarCrossGeo,
    funnelGeo,
    funnelCapGeo,
    aftDeckGeo,
    aftPoolGeo,
    lifeboatGeo
  );

  // =========================================================================
  // 2B-2. TALL WHITE-AND-RED STRIPED COASTAL LIGHTHOUSE ("Бело-красный маяк")
  // =========================================================================
  const lhGroup = new THREE.Group();
  lhGroup.position.set(LIGHTHOUSE_X, 0, LIGHTHOUSE_Z);
  group.add(lhGroup);

  const lhRockMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.92,
    metalness: 0.08,
    flatShading: true,
  });
  const lhWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.42,
    metalness: 0.06,
  });
  const lhRedMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.45,
    metalness: 0.06,
  });
  const lhIronMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.72,
  });
  const lhLanternGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfacc15,
    emissiveIntensity: 3.4,
    roughness: 0.12,
  });
  const lhBeamMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Rocky headland jetty + octagonal masonry base
  const lhJettyGeo = new THREE.CylinderGeometry(13.5, 16.5, 2.2, 9);
  const lhJetty = new THREE.Mesh(lhJettyGeo, lhRockMat);
  lhJetty.position.y = 1.0;
  const lhPlinthGeo = new THREE.CylinderGeometry(6.6, 7.8, 4.4, 8);
  const lhPlinth = new THREE.Mesh(lhPlinthGeo, lhWhiteMat);
  lhPlinth.position.y = 4.2;
  const lhPlinthTrimGeo = new THREE.CylinderGeometry(6.85, 6.85, 0.55, 8);
  const lhPlinthTrim = new THREE.Mesh(lhPlinthTrimGeo, lhRedMat);
  lhPlinthTrim.position.y = 6.2;
  lhGroup.add(lhJetty, lhPlinth, lhPlinthTrim);
  disposables.push(
    lhRockMat,
    lhWhiteMat,
    lhRedMat,
    lhIronMat,
    lhLanternGlowMat,
    lhBeamMat,
    lhJettyGeo,
    lhPlinthGeo,
    lhPlinthTrimGeo
  );

  // 6 Alternating White & Red Striped Tapered Tower Tiers (y = 6.4m -> 33.4m)
  const lhBandGeos: THREE.BufferGeometry[] = [];
  const BAND_COUNT = 6;
  const BAND_H = 4.5;
  for (let b = 0; b < BAND_COUNT; b++) {
    const rBot = 5.1 - b * 0.4;
    const rTop = 5.1 - (b + 1) * 0.4;
    const bGeo = new THREE.CylinderGeometry(rTop, rBot, BAND_H + 0.04, 24);
    const bMesh = new THREE.Mesh(bGeo, b % 2 === 0 ? lhRedMat : lhWhiteMat);
    bMesh.position.y = 6.4 + (b + 0.5) * BAND_H;
    bMesh.castShadow = enableShadows;
    bMesh.receiveShadow = enableShadows;
    lhGroup.add(bMesh);
    lhBandGeos.push(bGeo);
  }

  // Iron Observation Gallery Deck & Railing
  const lhGalleryGeo = new THREE.CylinderGeometry(3.85, 3.1, 0.65, 20);
  const lhGallery = new THREE.Mesh(lhGalleryGeo, lhIronMat);
  lhGallery.position.y = 33.7;
  const lhRailGeo = new THREE.TorusGeometry(3.75, 0.09, 8, 24);
  lhRailGeo.rotateX(Math.PI / 2);
  const lhRail = new THREE.Mesh(lhRailGeo, lhIronMat);
  lhRail.position.y = 34.7;
  const lhRailPostGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.95, 6);
  for (let p = 0; p < 12; p++) {
    const ang = (p / 12) * Math.PI * 2;
    const post = new THREE.Mesh(lhRailPostGeo, lhIronMat);
    post.position.set(Math.cos(ang) * 3.72, 34.25, Math.sin(ang) * 3.72);
    lhGroup.add(post);
  }

  // Lantern Glass Room + Conical Crimson Dome & Finial Spire (total height ~43m)
  const lhLanternGeo = new THREE.CylinderGeometry(2.35, 2.35, 3.6, 16);
  const lhLantern = new THREE.Mesh(lhLanternGeo, lhLanternGlowMat);
  lhLantern.position.y = 35.8;
  const lhCupolaGeo = new THREE.ConeGeometry(2.85, 3.1, 16);
  const lhCupola = new THREE.Mesh(lhCupolaGeo, lhRedMat);
  lhCupola.position.y = 39.15;
  lhCupola.castShadow = enableShadows;
  const lhSpireGeo = new THREE.CylinderGeometry(0.08, 0.16, 2.4, 8);
  const lhSpire = new THREE.Mesh(lhSpireGeo, lhIronMat);
  lhSpire.position.y = 41.7;

  // Rotating Twin Additive Volumetric Searchlight Cones
  const lhRotor = new THREE.Group();
  lhRotor.position.y = 36.1;
  const lhBeamGeo = new THREE.ConeGeometry(4.4, 42, 16, 1, true);
  lhBeamGeo.translate(0, -21, 0);
  lhBeamGeo.rotateX(Math.PI / 2);
  const beamFwd = new THREE.Mesh(lhBeamGeo, lhBeamMat);
  beamFwd.position.z = 2.0;
  beamFwd.rotation.x = 0.08;
  const beamBack = new THREE.Mesh(lhBeamGeo, lhBeamMat);
  beamBack.position.z = -2.0;
  beamBack.rotation.y = Math.PI;
  beamBack.rotation.x = 0.08;
  lhRotor.add(beamFwd, beamBack);

  // Lighthouse Keeper's Coastal Cottage beside the tower
  const cottageBodyGeo = new THREE.BoxGeometry(6.8, 3.2, 5.4);
  const cottageBody = new THREE.Mesh(cottageBodyGeo, lhWhiteMat);
  cottageBody.position.set(7.8, 3.3, 1.5);
  cottageBody.castShadow = enableShadows;
  const cottageRoofGeo = new THREE.ConeGeometry(5.2, 2.2, 4);
  cottageRoofGeo.rotateY(Math.PI / 4);
  const cottageRoof = new THREE.Mesh(cottageRoofGeo, lhRedMat);
  cottageRoof.position.set(7.8, 5.9, 1.5);
  cottageRoof.castShadow = enableShadows;

  lhGroup.add(
    lhGallery,
    lhRail,
    lhLantern,
    lhCupola,
    lhSpire,
    lhRotor,
    cottageBody,
    cottageRoof
  );
  disposables.push(
    ...lhBandGeos,
    lhGalleryGeo,
    lhRailGeo,
    lhRailPostGeo,
    lhLanternGeo,
    lhCupolaGeo,
    lhSpireGeo,
    lhBeamGeo,
    cottageBodyGeo,
    cottageRoofGeo
  );

  // =========================================================================
  // 2C. CORN STAND, COCKTAIL STAND & SWIMWEAR / FLOATIES SHOP
  // =========================================================================
  const standWoodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 });
  const cornYellowMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.25,
    roughness: 0.35,
  });
  const cornRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55 });
  const tikiRoofMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.88 });
  const tikiNeonPinkMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    emissive: 0xf43f5e,
    emissiveIntensity: 1.5,
    roughness: 0.25,
  });
  const tikiNeonCyanMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.4,
    roughness: 0.25,
  });
  const shopTealMat = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.52 });
  const floatieTorusGeo = new THREE.TorusGeometry(0.42, 0.14, 10, 18);
  const standBaseGeo = new THREE.BoxGeometry(7.6, 0.22, 4.8);
  const standCounterGeo = new THREE.BoxGeometry(6.8, 1.15, 1.2);
  const kioskRoofGeo = new THREE.ConeGeometry(4.8, 1.75, 4);
  kioskRoofGeo.rotateY(Math.PI / 4);
  const cornCobGeo = new THREE.CapsuleGeometry(0.32, 0.95, 6, 10);
  const surfboardGeo = new THREE.BoxGeometry(0.65, 2.35, 0.1);

  const cornSignTex = createSignTexture(
    'SWEET CORN',
    'HOT BUTTERED · FRESH COBS',
    '#7f1d1d',
    '#facc15',
    aniso,
    texScale
  );
  const cocktailSignTex = createSignTexture(
    'TIKI COCKTAILS',
    'COLD DRINKS · TROPICAL BAR',
    '#1e1b4b',
    '#22d3ee',
    aniso,
    texScale
  );
  const floatieSignTex = createSignTexture(
    'FLOATIES & SWIM',
    'SWIM RINGS · TRUNKS · GEAR',
    '#0f766e',
    '#fde047',
    aniso,
    texScale
  );
  const cornSignMat = makeMat({ color: 0xffffff, map: cornSignTex, roughness: 0.35 });
  const cocktailSignMat = makeMat({ color: 0xffffff, map: cocktailSignTex, roughness: 0.35 });
  const floatieSignMat = makeMat({ color: 0xffffff, map: floatieSignTex, roughness: 0.35 });
  const standSignGeo = new THREE.BoxGeometry(6.6, 1.35, 0.24);
  const kioskPillarGeo = new THREE.CylinderGeometry(0.11, 0.13, 3.2, 8);
  const stoolGeo = new THREE.CylinderGeometry(0.28, 0.22, 0.72, 10);
  const cupGeo = new THREE.CylinderGeometry(0.14, 0.09, 0.32, 8);

  const floatieColors = [0xf43f5e, 0x06b6d4, 0xfacc15, 0x22c55e, 0xf97316, 0xa855f7];
  const floatieMats = floatieColors.map((hex) =>
    makeMat({ color: hex, roughness: 0.3, metalness: 0.05 })
  );

  for (const st of STAND_SPOTS) {
    const sg = new THREE.Group();
    sg.position.set(st.x, 0, st.z);
    sg.rotation.y = st.yaw;

    const base = new THREE.Mesh(standBaseGeo, standWoodMat);
    base.position.y = 0.11;
    base.receiveShadow = enableShadows;
    sg.add(base);

    if (st.kind === 'corn') {
      const counter = new THREE.Mesh(standCounterGeo, cornRedMat);
      counter.position.set(0, 0.78, 1.3);
      counter.castShadow = enableShadows;
      for (const px of [-3.1, 3.1]) {
        for (const pz of [-1.7, 1.7]) {
          const p = new THREE.Mesh(kioskPillarGeo, cornYellowMat);
          p.position.set(px, 1.75, pz);
          sg.add(p);
        }
      }
      const roof = new THREE.Mesh(kioskRoofGeo, cornRedMat);
      roof.position.set(0, 4.1, 0);
      roof.castShadow = enableShadows;

      // Giant golden corn cob rooftop mascot + corn cobs lined up on counter
      const giantCob = new THREE.Mesh(cornCobGeo, cornYellowMat);
      giantCob.scale.setScalar(1.35);
      giantCob.position.set(0, 5.45, 0);
      giantCob.rotation.z = 0.22;
      sg.add(counter, roof, giantCob);
      if (profile.showBanners) {
        const sign = new THREE.Mesh(standSignGeo, cornSignMat);
        sign.position.set(0, 3.3, 1.95);
        sg.add(sign);
      }

      for (let c = 0; c < 5; c++) {
        const cob = new THREE.Mesh(cornCobGeo, cornYellowMat);
        cob.scale.setScalar(0.32);
        cob.rotation.z = Math.PI / 2;
        cob.position.set(-1.8 + c * 0.9, 1.48, 1.45);
        sg.add(cob);
      }
    } else if (st.kind === 'cocktail') {
      const counter = new THREE.Mesh(standCounterGeo, standWoodMat);
      counter.position.set(0, 0.78, 1.25);
      counter.castShadow = enableShadows;
      for (const px of [-3.1, 3.1]) {
        for (const pz of [-1.7, 1.7]) {
          const p = new THREE.Mesh(kioskPillarGeo, standWoodMat);
          p.position.set(px, 1.75, pz);
          sg.add(p);
        }
      }
      const roof = new THREE.Mesh(kioskRoofGeo, tikiRoofMat);
      roof.position.set(0, 4.1, 0);
      roof.castShadow = enableShadows;
      sg.add(counter, roof);
      if (profile.showBanners) {
        const sign = new THREE.Mesh(standSignGeo, cocktailSignMat);
        sign.position.set(0, 3.3, 1.95);
        sg.add(sign);
      }

      // 4 Bar Stools + Colorful Tropical Cocktail Glasses along front counter
      for (let k = 0; k < 4; k++) {
        const sx = -2.2 + k * 1.45;
        const stool = new THREE.Mesh(stoolGeo, floatieMats[k % floatieMats.length]);
        stool.position.set(sx, 0.42, 2.25);
        const drink = new THREE.Mesh(cupGeo, k % 2 === 0 ? tikiNeonPinkMat : tikiNeonCyanMat);
        drink.position.set(sx, 1.5, 1.35);
        sg.add(stool, drink);
      }
    } else {
      // Swim Rings & Swimwear Shop ("FLOATIES & SWIM")
      const shopBodyGeo = new THREE.BoxGeometry(8.8, 4.6, 5.2);
      const shopBody = new THREE.Mesh(shopBodyGeo, shopTealMat);
      shopBody.position.set(0, 2.45, -0.1);
      shopBody.castShadow = enableShadows;
      shopBody.receiveShadow = enableShadows;
      disposables.push(shopBodyGeo);

      if (profile.showBanners) {
        const sign = new THREE.Mesh(standSignGeo, floatieSignMat);
        sign.position.set(0, 4.15, 2.62);
        sg.add(sign);
      }

      const canopyGeo = new THREE.BoxGeometry(8.4, 0.25, 1.9);
      const canopy = new THREE.Mesh(canopyGeo, cornYellowMat);
      canopy.position.set(0, 2.95, 3.3);
      canopy.rotation.x = 0.22;
      disposables.push(canopyGeo);

      // Display hanging rack with 6 vibrant colorful swim rings + 2 upright surfboards + swimwear rack!
      for (let f = 0; f < 6; f++) {
        const ring = new THREE.Mesh(floatieTorusGeo, floatieMats[f % floatieMats.length]);
        ring.position.set(-2.9 + f * 1.15, 2.45, 3.95);
        sg.add(ring);
      }
      for (let s = 0; s < 2; s++) {
        const sb = new THREE.Mesh(surfboardGeo, floatieMats[(s * 2 + 1) % floatieMats.length]);
        sb.position.set(-3.8 + s * 7.6, 1.35, 2.95);
        sb.rotation.z = s === 0 ? 0.14 : -0.14;
        sg.add(sb);
      }
      // Swim trunks / swimwear display table outside storefront
      const rack = new THREE.Mesh(standCounterGeo, balconyWhiteMat);
      rack.scale.set(0.65, 0.72, 0.75);
      rack.position.set(0, 0.56, 3.1);
      for (let c = 0; c < 4; c++) {
        const trunks = new THREE.Mesh(cupGeo, floatieMats[(c + 2) % floatieMats.length]);
        trunks.scale.set(2.2, 0.75, 1.8);
        trunks.position.set(-1.35 + c * 0.9, 1.1, 3.1);
        sg.add(trunks);
      }
      sg.add(shopBody, canopy, rack);
    }

    group.add(sg);
  }

  disposables.push(
    standWoodMat,
    cornYellowMat,
    cornRedMat,
    tikiRoofMat,
    tikiNeonPinkMat,
    tikiNeonCyanMat,
    shopTealMat,
    floatieTorusGeo,
    standBaseGeo,
    standCounterGeo,
    kioskRoofGeo,
    cornCobGeo,
    surfboardGeo,
    cornSignTex,
    cocktailSignTex,
    floatieSignTex,
    cornSignMat,
    cocktailSignMat,
    floatieSignMat,
    standSignGeo,
    kioskPillarGeo,
    stoolGeo,
    cupGeo,
    ...floatieMats
  );

  // =========================================================================
  // 3. BEACH UMBRELLAS WITH LOUNGERS, TOWELS & SUNBATHERS (Adults & Kids)
  // =========================================================================
  const umbrellaSpots: Array<{ x: number; z: number; yaw: number; color: THREE.Color }> = [];
  const umbPalette = [0xf97316, 0x06b6d4, 0xf43f5e, 0xfacc15, 0x10b981, 0x8b5cf6];

  const isInsideSpecialZone = (x: number, z: number, margin: number): boolean => {
    if (Math.hypot(x - WP_X, z - WP_Z) < WP_WORLD_RADIUS + 13.0 + margin) return true;
    if (Math.hypot(x - RESORT_X, z - RESORT_Z) < 26 + margin) return true;
    if (Math.hypot(x - LIGHTHOUSE_X, z - LIGHTHOUSE_Z) < 20 + margin) return true;
    for (const st of STAND_SPOTS) {
      if (Math.hypot(x - st.x, z - st.z) < 7.5 + margin) return true;
    }
    return false;
  };

  // Curated umbrella rows visible right along the boardwalk (x=-215), resort lawn & east cove
  const curatedUmbrellas: Array<[number, number, number]> = [
    [-248, -68, 1.4],
    [-250, -42, 1.5],
    [-249, -16, 1.3],
    [-250, 22, 1.6],
    [-184, 24, -1.5],
    [-184, 54, -1.5],
    [-188, -66, -1.5],
    [-188, -34, -1.6],
    [168, -58, -1.4],
    [174, -22, -1.6],
  ];
  curatedUmbrellas.forEach(([x, z, yaw], idx) => {
    if (isClearOfTrack(x, z, 2.8) && !isInsideSpecialZone(x, z, 2.0)) {
      umbrellaSpots.push({
        x,
        z,
        yaw,
        color: new THREE.Color(umbPalette[idx % umbPalette.length]),
      });
    }
  });

  const randomUmbrellaCount = Math.round(90 * profile.densityScale);
  for (let i = 0; i < randomUmbrellaCount; i++) {
    const ang = envRand() * Math.PI * 2;
    const rad = 84 + envRand() * 195;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    if (isInsideSpecialZone(x, z, 2.5)) continue;
    if (!isClearOfTrack(x, z, 3.2)) continue;
    umbrellaSpots.push({
      x,
      z,
      yaw: envRand() * Math.PI * 2,
      color: new THREE.Color(umbPalette[i % umbPalette.length]),
    });
  }

  const uCount = umbrellaSpots.length;
  const uPoleGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6);
  uPoleGeo.translate(0, 1.3, 0);
  const uPoleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
  const uCanopyGeo = new THREE.ConeGeometry(2.15, 0.85, 8);
  const uCanopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.52 });

  const towelGeo = new THREE.BoxGeometry(0.95, 0.08, 1.95);
  const loungerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 });
  const backrestGeo = new THREE.BoxGeometry(0.88, 0.45, 0.14);

  const sbTorsoGeo = new THREE.BoxGeometry(0.42, 0.54, 0.22);
  const sbLegsGeo = new THREE.BoxGeometry(0.36, 0.18, 0.72);
  const sbHeadGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
  const sbSkinMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 });
  const sbWearMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });

  const uPoleInst = new THREE.InstancedMesh(uPoleGeo, uPoleMat, uCount);
  const uCanopyInst = new THREE.InstancedMesh(uCanopyGeo, uCanopyMat, uCount);
  const towelInst = new THREE.InstancedMesh(towelGeo, loungerMat, uCount * 2);
  const backrestInst = new THREE.InstancedMesh(backrestGeo, loungerMat, uCount * 2);
  const sbTorsoInst = new THREE.InstancedMesh(sbTorsoGeo, sbWearMat, uCount * 2);
  const sbLegsInst = new THREE.InstancedMesh(sbLegsGeo, sbSkinMat, uCount * 2);
  const sbHeadInst = new THREE.InstancedMesh(sbHeadGeo, sbSkinMat, uCount * 2);

  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YXZ';
  const tempColor = new THREE.Color();

  umbrellaSpots.forEach((u, idx) => {
    dummy.position.set(u.x, 0, u.z);
    dummy.rotation.set(0, u.yaw, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    uPoleInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(u.x, 2.38, u.z);
    dummy.updateMatrix();
    uCanopyInst.setMatrixAt(idx, dummy.matrix);
    uCanopyInst.setColorAt(idx, u.color);

    const rightX = Math.cos(u.yaw);
    const rightZ = -Math.sin(u.yaw);
    const fwdX = Math.sin(u.yaw);
    const fwdZ = Math.cos(u.yaw);

    for (let k = 0; k < 2; k++) {
      const slotIdx = idx * 2 + k;
      const sideSign = k === 0 ? -0.78 : 0.78;
      const lx = u.x + rightX * sideSign;
      const lz = u.z + rightZ * sideSign;
      const isKid = k === 1 && idx % 3 === 0;
      const sc = isKid ? 0.68 : 0.96;

      dummy.position.set(lx, 0.14, lz);
      dummy.rotation.set(0, u.yaw, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      towelInst.setMatrixAt(slotIdx, dummy.matrix);
      tempColor.setHex(k === 0 ? 0xf8fafc : SWIM_COLORS[(idx + k) % SWIM_COLORS.length]);
      towelInst.setColorAt(slotIdx, tempColor);

      dummy.position.set(lx - fwdX * 0.74, 0.34, lz - fwdZ * 0.74);
      dummy.rotation.set(-0.55, u.yaw, 0);
      dummy.updateMatrix();
      backrestInst.setMatrixAt(slotIdx, dummy.matrix);
      backrestInst.setColorAt(slotIdx, u.color);

      dummy.position.set(lx - fwdX * 0.25 * sc, 0.34, lz - fwdZ * 0.25 * sc);
      dummy.rotation.set(-1.05, u.yaw, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      sbTorsoInst.setMatrixAt(slotIdx, dummy.matrix);
      tempColor.setHex(SWIM_COLORS[(idx * 3 + k) % SWIM_COLORS.length]);
      sbTorsoInst.setColorAt(slotIdx, tempColor);

      dummy.position.set(lx + fwdX * 0.35 * sc, 0.24, lz + fwdZ * 0.35 * sc);
      dummy.rotation.set(0, u.yaw, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      sbLegsInst.setMatrixAt(slotIdx, dummy.matrix);
      tempColor.setHex(SKIN_TONES[(idx + k) % SKIN_TONES.length]);
      sbLegsInst.setColorAt(slotIdx, tempColor);

      dummy.position.set(lx - fwdX * 0.56 * sc, 0.52, lz - fwdZ * 0.56 * sc);
      dummy.rotation.set(0, u.yaw, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      sbHeadInst.setMatrixAt(slotIdx, dummy.matrix);
      sbHeadInst.setColorAt(slotIdx, tempColor);
    }
  });

  for (const inst of [
    uPoleInst,
    uCanopyInst,
    towelInst,
    backrestInst,
    sbTorsoInst,
    sbLegsInst,
    sbHeadInst,
  ]) {
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.castShadow = enableShadows;
    inst.receiveShadow = enableShadows;
    inst.computeBoundingSphere();
    group.add(inst);
  }

  disposables.push(
    uPoleGeo,
    uPoleMat,
    uCanopyGeo,
    uCanopyMat,
    towelGeo,
    loungerMat,
    backrestGeo,
    sbTorsoGeo,
    sbLegsGeo,
    sbHeadGeo,
    sbSkinMat,
    sbWearMat
  );

  // =========================================================================
  // 4. WATERPARK ANIMATED SWIMMERS & DECK WALKERS (Adults + Children)
  // =========================================================================
  const swimmers: SwimmerAnim[] = [];
  const wavePoolSwimmerCount = Math.max(6, Math.round(20 * profile.npcDensityScale));
  const kidsPoolSwimmerCount = Math.max(6, Math.round(16 * profile.npcDensityScale));
  const lazyPoolSwimmerCount = Math.max(4, Math.round(10 * profile.npcDensityScale));

  // Main wave pool swimmers
  for (let i = 0; i < wavePoolSwimmerCount; i++) {
    const isChild = i % 3 === 0;
    swimmers.push({
      x: WP_X + 6 * WP_SCALE + (envRand() - 0.5) * 32 * WP_SCALE,
      z: WP_Z - 14 * WP_SCALE + (envRand() - 0.5) * 18 * WP_SCALE,
      baseY: 0.2 * WP_SCALE,
      yaw: envRand() * Math.PI * 2,
      scale: isChild ? 0.72 : 1.12,
      isChild,
      phase: envRand() * Math.PI * 2,
      orbitR: 0.9 + envRand() * 1.6,
      orbitSpeed: (i % 2 === 0 ? 1 : -1) * (0.5 + envRand() * 0.5),
      skinColor: new THREE.Color(SKIN_TONES[i % SKIN_TONES.length]),
      swimColor: new THREE.Color(SWIM_COLORS[i % SWIM_COLORS.length]),
    });
  }
  // Kids splash lagoon children + parents
  for (let i = 0; i < kidsPoolSwimmerCount; i++) {
    const isChild = i < Math.round(kidsPoolSwimmerCount * 0.75);
    const ang = (i / kidsPoolSwimmerCount) * Math.PI * 2;
    const rad = (3.5 + envRand() * 8.5) * WP_SCALE;
    swimmers.push({
      x: WP_X + 20 * WP_SCALE + Math.cos(ang) * rad,
      z: WP_Z + 22 * WP_SCALE + Math.sin(ang) * rad,
      baseY: 0.28 * WP_SCALE,
      yaw: ang + Math.PI,
      scale: isChild ? 0.68 + envRand() * 0.08 : 1.1,
      isChild,
      phase: envRand() * Math.PI * 2,
      orbitR: 0.55 + envRand() * 0.9,
      orbitSpeed: (i % 2 === 0 ? 1 : -1) * (0.7 + envRand() * 0.6),
      skinColor: new THREE.Color(SKIN_TONES[(i + 2) % SKIN_TONES.length]),
      swimColor: new THREE.Color(SWIM_COLORS[(i + 3) % SWIM_COLORS.length]),
    });
  }
  // Lazy river floaters/swimmers
  for (let i = 0; i < lazyPoolSwimmerCount; i++) {
    const ang = (i / lazyPoolSwimmerCount) * Math.PI * 2;
    const rad = (11.8 + (i % 3) * 1.8) * WP_SCALE;
    swimmers.push({
      x: WP_X - 22 * WP_SCALE + Math.cos(ang) * rad,
      z: WP_Z + 18 * WP_SCALE + Math.sin(ang) * rad,
      baseY: 0.22 * WP_SCALE,
      yaw: ang + Math.PI * 0.5,
      scale: i % 3 === 0 ? 0.72 : 1.08,
      isChild: i % 3 === 0,
      phase: envRand() * Math.PI * 2,
      orbitR: 0.7,
      orbitSpeed: 0.55,
      skinColor: new THREE.Color(SKIN_TONES[(i + 1) % SKIN_TONES.length]),
      swimColor: new THREE.Color(SWIM_COLORS[(i + 4) % SWIM_COLORS.length]),
    });
  }

  // Deck walkers patrolling the huge waterpark promenade
  const deckWalkerCount = Math.max(8, Math.round(28 * profile.npcDensityScale));
  const deckWalkers: DeckWalkerAnim[] = [];
  for (let i = 0; i < deckWalkerCount; i++) {
    const isChild = i % 2 === 1;
    deckWalkers.push({
      centerX: WP_X,
      centerZ: WP_Z,
      radius: (42 + (i % 4) * 3.4) * WP_SCALE,
      angle: (i / deckWalkerCount) * Math.PI * 2,
      angularSpeed: (i % 2 === 0 ? 1 : -1) * (0.045 + envRand() * 0.035),
      scale: isChild ? 0.68 + envRand() * 0.08 : 1.08 + envRand() * 0.08,
      isChild,
      stridePhase: envRand() * Math.PI * 2,
      skinColor: new THREE.Color(SKIN_TONES[i % SKIN_TONES.length]),
      outfitColor: new THREE.Color(SWIM_COLORS[i % SWIM_COLORS.length]),
      hairColor: new THREE.Color(HAIR_TONES[i % HAIR_TONES.length]),
    });
  }

  // =========================================================================
  // 5. BEACH BALL PLAYERS ON OPEN SAND (Adults & Kids Tossing Beach Balls)
  // =========================================================================
  const ballGames: BallGameAnim[] = [];
  const priorityBallSpots = [
    { cx: -248, cz: 6, dir: 0.15, kid: true },
    { cx: -186, cz: 36, dir: -0.2, kid: true },
    { cx: -184, cz: 70, dir: 0.35, kid: true },
    { cx: -188, cz: -72, dir: -0.3, kid: false },
    { cx: -46, cz: -186, dir: 0.4, kid: true },
    { cx: -90, cz: 132, dir: -0.2, kid: true },
  ];
  for (const ps of priorityBallSpots) {
    if (!isInsideSpecialZone(ps.cx, ps.cz, 3.5) && isClearOfTrack(ps.cx, ps.cz, 4.8)) {
      ballGames.push({
        ax: ps.cx - Math.cos(ps.dir) * 3.1,
        az: ps.cz - Math.sin(ps.dir) * 3.1,
        bx: ps.cx + Math.cos(ps.dir) * 3.1,
        bz: ps.cz + Math.sin(ps.dir) * 3.1,
        phase: envRand() * Math.PI * 2,
        speed: 1.65,
        arcHeight: 3.1,
        ballRadius: 0.64,
        playerAScale: 1.08,
        playerBScale: ps.kid ? 0.72 : 1.08,
      });
    }
  }

  const candidateAngles = [0.25, 1.05, 1.85, 2.65, 3.45, 4.25, 5.15, 5.75];
  for (let i = 0; i < candidateAngles.length && ballGames.length < 10; i++) {
    const ang = candidateAngles[i];
    const rad = i % 2 === 0 ? 158 : 245;
    const cx = Math.cos(ang) * rad;
    const cz = Math.sin(ang) * rad;
    if (isInsideSpecialZone(cx, cz, 7)) continue;
    if (!isClearOfTrack(cx, cz, 6.2)) continue;

    const dir = ang + Math.PI * 0.5;
    const halfSpan = 3.1;
    ballGames.push({
      ax: cx - Math.cos(dir) * halfSpan,
      az: cz - Math.sin(dir) * halfSpan,
      bx: cx + Math.cos(dir) * halfSpan,
      bz: cz + Math.sin(dir) * halfSpan,
      phase: envRand() * Math.PI * 2,
      speed: 1.45 + envRand() * 0.45,
      arcHeight: 2.8 + envRand() * 1.1,
      ballRadius: 0.64,
      playerAScale: 1.08,
      playerBScale: i % 2 === 0 ? 0.72 : 1.06,
    });
  }

  const totalBeachNPCs = swimmers.length + deckWalkers.length + ballGames.length * 2;
  const npcTorsoGeo = new THREE.BoxGeometry(0.45, 0.62, 0.24);
  npcTorsoGeo.translate(0, 0.31, 0);
  const npcLegGeo = new THREE.BoxGeometry(0.16, 0.68, 0.17);
  npcLegGeo.translate(0, -0.34, 0);
  const npcArmGeo = new THREE.BoxGeometry(0.13, 0.56, 0.14);
  npcArmGeo.translate(0, -0.28, 0);
  const npcHeadGeo = new THREE.BoxGeometry(0.27, 0.27, 0.27);
  const npcHairGeo = new THREE.BoxGeometry(0.29, 0.11, 0.29);

  const npcTorsoInst = new THREE.InstancedMesh(npcTorsoGeo, sbWearMat, totalBeachNPCs);
  const npcLLegInst = new THREE.InstancedMesh(npcLegGeo, sbSkinMat, totalBeachNPCs);
  const npcRLegInst = new THREE.InstancedMesh(npcLegGeo, sbSkinMat, totalBeachNPCs);
  const npcLArmInst = new THREE.InstancedMesh(npcArmGeo, sbSkinMat, totalBeachNPCs);
  const npcRArmInst = new THREE.InstancedMesh(npcArmGeo, sbSkinMat, totalBeachNPCs);
  const npcHeadInst = new THREE.InstancedMesh(npcHeadGeo, sbSkinMat, totalBeachNPCs);
  const npcHairInst = new THREE.InstancedMesh(npcHairGeo, sbWearMat, totalBeachNPCs);

  let cursor = 0;
  for (const sw of swimmers) {
    npcTorsoInst.setColorAt(cursor, sw.swimColor);
    npcLLegInst.setColorAt(cursor, sw.skinColor);
    npcRLegInst.setColorAt(cursor, sw.skinColor);
    npcLArmInst.setColorAt(cursor, sw.skinColor);
    npcRArmInst.setColorAt(cursor, sw.skinColor);
    npcHeadInst.setColorAt(cursor, sw.skinColor);
    npcHairInst.setColorAt(cursor, new THREE.Color(HAIR_TONES[cursor % HAIR_TONES.length]));
    cursor++;
  }
  for (const dw of deckWalkers) {
    npcTorsoInst.setColorAt(cursor, dw.outfitColor);
    npcLLegInst.setColorAt(cursor, dw.skinColor);
    npcRLegInst.setColorAt(cursor, dw.skinColor);
    npcLArmInst.setColorAt(cursor, dw.skinColor);
    npcRArmInst.setColorAt(cursor, dw.skinColor);
    npcHeadInst.setColorAt(cursor, dw.skinColor);
    npcHairInst.setColorAt(cursor, dw.hairColor);
    cursor++;
  }
  for (let g = 0; g < ballGames.length; g++) {
    for (let p = 0; p < 2; p++) {
      const skin = new THREE.Color(SKIN_TONES[(g * 2 + p) % SKIN_TONES.length]);
      const outfit = new THREE.Color(SWIM_COLORS[(g * 3 + p) % SWIM_COLORS.length]);
      const hair = new THREE.Color(HAIR_TONES[(g + p) % HAIR_TONES.length]);
      npcTorsoInst.setColorAt(cursor, outfit);
      npcLLegInst.setColorAt(cursor, skin);
      npcRLegInst.setColorAt(cursor, skin);
      npcLArmInst.setColorAt(cursor, skin);
      npcRArmInst.setColorAt(cursor, skin);
      npcHeadInst.setColorAt(cursor, skin);
      npcHairInst.setColorAt(cursor, hair);
      cursor++;
    }
  }

  for (const inst of [
    npcTorsoInst,
    npcLLegInst,
    npcRLegInst,
    npcLArmInst,
    npcRArmInst,
    npcHeadInst,
    npcHairInst,
  ]) {
    inst.frustumCulled = false;
    inst.castShadow = enableShadows;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
  }

  const ballTex = createBeachBallTexture(aniso, texScale);
  const ballGeo = new THREE.SphereGeometry(1, 16, 12);
  const ballMat = makeMat({
    color: 0xffffff,
    map: ballTex,
    roughness: 0.25,
    metalness: 0.05,
  });
  const ballInst = new THREE.InstancedMesh(ballGeo, ballMat, Math.max(1, ballGames.length));
  ballInst.frustumCulled = false;
  ballInst.castShadow = enableShadows;
  group.add(ballInst);

  disposables.push(
    npcTorsoGeo,
    npcLegGeo,
    npcArmGeo,
    npcHeadGeo,
    npcHairGeo,
    ballTex,
    ballGeo,
    ballMat
  );

  function setPose(
    idx: number,
    wx: number,
    baseY: number,
    wz: number,
    yaw: number,
    hs: number,
    legSwing: number,
    leftArmPitch: number,
    rightArmPitch: number,
    inWater: boolean
  ): void {
    const rightX = -Math.cos(yaw);
    const rightZ = Math.sin(yaw);
    const hipY = baseY + 0.68 * hs;
    const shoulderY = baseY + 1.28 * hs;
    const hipOff = 0.11 * hs;
    const shOff = 0.28 * hs;

    const legScaleY = inWater ? 0.45 * hs : hs;
    dummy.position.set(wx - rightX * hipOff, hipY, wz - rightZ * hipOff);
    dummy.rotation.set(legSwing, yaw, 0, 'YXZ');
    dummy.scale.set(hs, legScaleY, hs);
    dummy.updateMatrix();
    npcLLegInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(wx + rightX * hipOff, hipY, wz + rightZ * hipOff);
    dummy.rotation.set(-legSwing, yaw, 0, 'YXZ');
    dummy.scale.set(hs, legScaleY, hs);
    dummy.updateMatrix();
    npcRLegInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(wx, hipY, wz);
    dummy.rotation.set(0.03, yaw, 0, 'YXZ');
    dummy.scale.setScalar(hs);
    dummy.updateMatrix();
    npcTorsoInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(wx - rightX * shOff, shoulderY, wz - rightZ * shOff);
    dummy.rotation.set(leftArmPitch, yaw, 0.14, 'YXZ');
    dummy.scale.setScalar(hs);
    dummy.updateMatrix();
    npcLArmInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(wx + rightX * shOff, shoulderY, wz + rightZ * shOff);
    dummy.rotation.set(rightArmPitch, yaw, -0.14, 'YXZ');
    dummy.scale.setScalar(hs);
    dummy.updateMatrix();
    npcRArmInst.setMatrixAt(idx, dummy.matrix);

    const headS = hs < 0.75 ? hs * 1.15 : hs;
    dummy.position.set(wx, baseY + 1.48 * hs, wz);
    dummy.rotation.set(0, yaw, 0, 'YXZ');
    dummy.scale.setScalar(headS);
    dummy.updateMatrix();
    npcHeadInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(wx, baseY + 1.60 * hs, wz);
    dummy.rotation.set(0, yaw, 0, 'YXZ');
    dummy.scale.setScalar(headS);
    dummy.updateMatrix();
    npcHairInst.setMatrixAt(idx, dummy.matrix);
  }

  function update(dt: number, elapsed: number): void {
    // Gentle luxury cruise ship ocean swell bobbing + rotating lighthouse searchlight beam
    cruiseShip.position.y = Math.sin(elapsed * 0.85) * 0.28;
    cruiseShip.rotation.z = Math.sin(elapsed * 0.65) * 0.015;
    cruiseShip.rotation.x = Math.cos(elapsed * 0.55) * 0.008;
    lhRotor.rotation.y = elapsed * 0.68;

    for (const f of floatMeshes) {
      f.mesh.position.y = 0.48 + Math.sin(elapsed * 2.2 + f.phase) * 0.05;
      f.mesh.rotation.z = Math.sin(elapsed * 1.5 + f.phase) * 0.08;
    }

    let idx = 0;

    for (const sw of swimmers) {
      const ang = sw.phase + elapsed * sw.orbitSpeed;
      const sx = sw.x + Math.cos(ang) * sw.orbitR;
      const sz = sw.z + Math.sin(ang) * sw.orbitR;
      const bob = Math.sin(elapsed * 3.4 + sw.phase) * 0.08;
      const splashArm = Math.sin(elapsed * 5.2 + sw.phase) * 0.9 - 0.6;
      const yaw = sw.yaw + Math.sin(elapsed * 0.8 + sw.phase) * 0.6;
      setPose(
        idx++,
        sx,
        sw.baseY + bob,
        sz,
        yaw,
        sw.scale,
        Math.sin(elapsed * 4 + sw.phase) * 0.25,
        splashArm,
        -splashArm - 0.8,
        true
      );
    }

    for (const dw of deckWalkers) {
      dw.angle += dw.angularSpeed * dt;
      dw.stridePhase += (dw.isChild ? 8.5 : 6.4) * dt;
      const wx = dw.centerX + Math.cos(dw.angle) * dw.radius;
      const wz = dw.centerZ + Math.sin(dw.angle) * dw.radius;
      const yaw =
        dw.angularSpeed >= 0
          ? Math.atan2(-Math.sin(dw.angle), Math.cos(dw.angle))
          : Math.atan2(Math.sin(dw.angle), -Math.cos(dw.angle));
      const swing = Math.sin(dw.stridePhase) * 0.5;
      const bob = Math.abs(Math.sin(dw.stridePhase)) * 0.03 * dw.scale;
      setPose(idx++, wx, 0.24 * WP_SCALE + bob, wz, yaw, dw.scale, swing, -swing * 0.8, swing * 0.8, false);
    }

    for (let g = 0; g < ballGames.length; g++) {
      const bg = ballGames[g];
      const cycle = (elapsed * bg.speed + bg.phase) % (Math.PI * 2);
      const u = 0.5 - 0.5 * Math.cos(cycle);
      const bx = bg.ax + (bg.bx - bg.ax) * u;
      const bz = bg.az + (bg.bz - bg.az) * u;
      const arc = Math.abs(Math.sin(cycle * 0.5));
      const by = 1.05 + 4 * u * (1 - u) * bg.arcHeight;

      const yawAtoB = Math.atan2(bg.bx - bg.ax, bg.bz - bg.az);
      const yawBtoA = yawAtoB + Math.PI;

      const reachA = Math.max(0, 1 - u * 3.0);
      const reachB = Math.max(0, 1 - (1 - u) * 3.0);
      const jumpA = reachA * 0.22;
      const jumpB = reachB * 0.22;

      setPose(
        idx++,
        bg.ax,
        jumpA,
        bg.az,
        yawAtoB,
        bg.playerAScale,
        0.12,
        -1.2 - reachA * 1.1,
        -1.2 - reachA * 1.1,
        false
      );
      setPose(
        idx++,
        bg.bx,
        jumpB,
        bg.bz,
        yawBtoA,
        bg.playerBScale,
        -0.12,
        -1.2 - reachB * 1.1,
        -1.2 - reachB * 1.1,
        false
      );

      dummy.position.set(bx, by + arc * 0.05, bz);
      dummy.rotation.set(elapsed * 2.4 + g, elapsed * 1.8, elapsed * 1.1, 'YXZ');
      dummy.scale.setScalar(bg.ballRadius);
      dummy.updateMatrix();
      ballInst.setMatrixAt(g, dummy.matrix);
    }

    for (const inst of [
      npcTorsoInst,
      npcLLegInst,
      npcRLegInst,
      npcLArmInst,
      npcRArmInst,
      npcHeadInst,
      npcHairInst,
      ballInst,
    ]) {
      inst.instanceMatrix.needsUpdate = true;
    }
  }

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
