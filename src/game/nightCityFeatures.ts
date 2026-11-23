import * as THREE from 'three';
import { isForkOpeningAtT, sampleAtT, type RaceTrack } from './track';
import { SIDEWALK_OUTER_OFFSET } from './pedestrians';
import { getGraphicsProfile, type GraphicsQuality } from './graphics';
import {
  createAwningStripeTexture,
  createSignPlaqueTexture,
} from './sharedTextures';

export interface NightVenueFootprint {
  x: number;
  z: number;
  radius: number;
}

export interface NightCityFeaturesSystem {
  group: THREE.Group;
  venueFootprints: NightVenueFootprint[];
  shopSpots: Array<{ x: number; z: number }>;
  isNearNightFeature: (x: number, z: number, radius: number) => boolean;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

interface NightShopArchetype {
  name: string;
  sub: string;
  wallColor: number;
  signBg: string;
  signText: string;
  signBorder: string;
  awningA: string;
  awningB: string;
  windowColor: number;
  propType: 'barber' | 'supermarket' | 'diner' | 'tech';
}

const NIGHT_SHOP_TYPES: NightShopArchetype[] = [
  {
    name: 'BARBER SHOP',
    sub: 'CUTS · FADES · SHAVES',
    wallColor: 0x3b1d14,
    signBg: '#1e1b4b',
    signText: '#f8fafc',
    signBorder: '#ef4444',
    awningA: '#dc2626',
    awningB: '#ffffff',
    windowColor: 0xfef08a,
    propType: 'barber',
  },
  {
    name: 'SUPERMARKET',
    sub: '24/7 GROCERY & DRINKS',
    wallColor: 0x1e293b,
    signBg: '#064e3b',
    signText: '#ffffff',
    signBorder: '#22c55e',
    awningA: '#16a34a',
    awningB: '#fef08a',
    windowColor: 0xd9f99d,
    propType: 'supermarket',
  },
  {
    name: 'NIGHT DINER',
    sub: '24H COFFEE & GRILL',
    wallColor: 0x312e81,
    signBg: '#4c0519',
    signText: '#fde68a',
    signBorder: '#f43f5e',
    awningA: '#e11d48',
    awningB: '#1e1b4b',
    windowColor: 0xfdba74,
    propType: 'diner',
  },
  {
    name: 'TECH LOUNGE',
    sub: 'AUDIO & ELECTRONICS',
    wallColor: 0x0f172a,
    signBg: '#082f49',
    signText: '#38bdf8',
    signBorder: '#22d3ee',
    awningA: '#0284c7',
    awningB: '#0f172a',
    windowColor: 0x38bdf8,
    propType: 'tech',
  },
];

function createBarberPoleTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);

  ctx.lineWidth = 18;
  for (let i = -2; i <= 4; i++) {
    ctx.strokeStyle = i % 2 === 0 ? '#ef4444' : '#2563eb';
    ctx.beginPath();
    ctx.moveTo(i * 44, 0);
    ctx.lineTo(i * 44 + 128, 128);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createCasinoFacadeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#171123';
  ctx.fillRect(0, 0, 256, 256);

  // Gold Art-Deco vertical flutes and warm backlit hotel-casino windows
  for (let c = 0; c < 6; c++) {
    const x = c * 42 + 6;
    ctx.fillStyle = '#ca8a04';
    ctx.fillRect(x - 3, 0, 3, 256);
    for (let r = 0; r < 5; r++) {
      const y = r * 48 + 10;
      const lit = (c + r * 3) % 4 !== 0;
      ctx.fillStyle = lit ? '#fde047' : '#312e81';
      ctx.fillRect(x + 4, y, 24, 30);
      if (lit) {
        ctx.fillStyle = '#fef9c3';
        ctx.fillRect(x + 7, y + 4, 18, 14);
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

function buildCasinoClub(
  maxAnisotropy: number,
  enableShadows: boolean,
  showBanners: boolean,
  textureSizeScale: number,
  disposables: Array<{ dispose: () => void }>
): { group: THREE.Group; spinTarget: THREE.Group } {
  const root = new THREE.Group();

  const facadeTex = createCasinoFacadeTexture(maxAnisotropy);
  const signTex = showBanners
    ? createSignPlaqueTexture(
        'ROYAL CASINO CLUB',
        'VIP LOUNGE · ROULETTE · 24H',
        '#1f0917',
        '#f43f5e',
        '#fde047',
        maxAnisotropy,
        textureSizeScale
      )
    : null;
  const marbleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.45,
    metalness: 0.25,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: facadeTex,
    emissive: 0xfef08a,
    emissiveMap: facadeTex,
    emissiveIntensity: 0.42,
    roughness: 0.38,
    metalness: 0.35,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xd97706,
    emissiveIntensity: 0.75,
    roughness: 0.22,
    metalness: 0.82,
  });
  const rubyNeonMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    emissive: 0xf43f5e,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  const carpetMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.85,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfbbf24,
    emissiveIntensity: 1.1,
    roughness: 0.16,
    metalness: 0.65,
  });
  const signMat = signTex
    ? new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: signTex,
        emissive: 0xffffff,
        emissiveMap: signTex,
        emissiveIntensity: 1.05,
        roughness: 0.25,
      })
    : null;

  const podiumGeo = new THREE.BoxGeometry(44, 0.45, 32);
  const podium = new THREE.Mesh(podiumGeo, marbleMat);
  podium.position.y = 0.225;
  podium.receiveShadow = enableShadows;

  const carpetGeo = new THREE.BoxGeometry(4.8, 0.08, 7.2);
  const carpet = new THREE.Mesh(carpetGeo, carpetMat);
  carpet.position.set(0, 0.48, 12.6);

  // Main stepped Art-Deco casino hall + upper VIP tower
  const baseHallGeo = new THREE.BoxGeometry(36, 11.5, 22);
  const baseHall = new THREE.Mesh(baseHallGeo, wallMat);
  baseHall.position.set(0, 6.2, -1.5);
  baseHall.castShadow = enableShadows;
  baseHall.receiveShadow = enableShadows;

  const upperTowerGeo = new THREE.BoxGeometry(22, 9.5, 14);
  const upperTower = new THREE.Mesh(upperTowerGeo, wallMat);
  upperTower.position.set(0, 16.5, -2.0);
  upperTower.castShadow = enableShadows;

  // Golden Art-Deco cornice trim bands & corner pilasters
  const corniceLowerGeo = new THREE.BoxGeometry(37.2, 0.75, 23.2);
  const corniceLower = new THREE.Mesh(corniceLowerGeo, goldMat);
  corniceLower.position.set(0, 12.0, -1.5);

  const corniceUpperGeo = new THREE.BoxGeometry(23.2, 0.75, 15.2);
  const corniceUpper = new THREE.Mesh(corniceUpperGeo, goldMat);
  corniceUpper.position.set(0, 21.4, -2.0);

  // Projecting grand porte-cochere canopy with glowing ruby soffit & 4 gold columns
  const canopyGeo = new THREE.BoxGeometry(16, 1.1, 7.6);
  const canopy = new THREE.Mesh(canopyGeo, goldMat);
  canopy.position.set(0, 5.4, 12.5);
  const canopyTrimGeo = new THREE.BoxGeometry(16.4, 0.35, 7.9);
  const canopyTrim = new THREE.Mesh(canopyTrimGeo, rubyNeonMat);
  canopyTrim.position.set(0, 5.95, 12.5);

  const colGeo = new THREE.CylinderGeometry(0.42, 0.5, 5.2, 10);
  for (const [cx, cz] of [
    [-6.8, 15.2],
    [-2.4, 15.2],
    [2.4, 15.2],
    [6.8, 15.2],
  ]) {
    const col = new THREE.Mesh(colGeo, goldMat);
    col.position.set(cx, 2.8, cz);
    root.add(col);
  }

  // Grand glowing lobby facade doors
  const doorGeo = new THREE.BoxGeometry(9.2, 4.3, 0.4);
  const doorMesh = new THREE.Mesh(doorGeo, glassMat);
  doorMesh.position.set(0, 2.6, 9.55);

  // Front & Rear Giant Casino Marquees (omitted on Low quality)
  if (signMat && signTex) {
    const marqueeGeo = new THREE.BoxGeometry(18.5, 4.2, 0.6);
    const marqueeFront = new THREE.Mesh(marqueeGeo, signMat);
    marqueeFront.position.set(0, 14.5, 5.25);
    const marqueeRoof = new THREE.Mesh(marqueeGeo, signMat);
    marqueeRoof.position.set(0, 9.2, 9.7);
    root.add(marqueeFront, marqueeRoof);
    disposables.push(signTex, signMat, marqueeGeo);
  }

  // Animated Spinning Rooftop Diamond Roulette Crown
  const spinTarget = new THREE.Group();
  spinTarget.position.set(0, 25.2, -2.0);
  const ringGeo = new THREE.TorusGeometry(4.2, 0.45, 10, 28);
  const wheelRing = new THREE.Mesh(ringGeo, rubyNeonMat);
  const diamondGeo = new THREE.OctahedronGeometry(2.6, 0);
  const diamond = new THREE.Mesh(diamondGeo, goldMat);
  spinTarget.add(wheelRing, diamond);

  root.add(
    podium,
    carpet,
    baseHall,
    upperTower,
    corniceLower,
    corniceUpper,
    canopy,
    canopyTrim,
    doorMesh,
    spinTarget
  );

  disposables.push(
    facadeTex,
    marbleMat,
    wallMat,
    goldMat,
    rubyNeonMat,
    carpetMat,
    glassMat,
    podiumGeo,
    carpetGeo,
    baseHallGeo,
    upperTowerGeo,
    corniceLowerGeo,
    corniceUpperGeo,
    canopyGeo,
    canopyTrimGeo,
    colGeo,
    doorGeo,
    ringGeo,
    diamondGeo
  );

  return { group: root, spinTarget };
}

function buildBarClub(
  maxAnisotropy: number,
  enableShadows: boolean,
  showBanners: boolean,
  textureSizeScale: number,
  disposables: Array<{ dispose: () => void }>
): { group: THREE.Group; eqBars: THREE.Mesh[] } {
  const root = new THREE.Group();
  const eqBars: THREE.Mesh[] = [];

  const signTex = showBanners
    ? createSignPlaqueTexture(
        'NEON PULSE CLUB',
        'SKY BAR · LIVE DJ · COCKTAILS',
        '#09051d',
        '#ec4899',
        '#22d3ee',
        maxAnisotropy,
        textureSizeScale
      )
    : null;

  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.42,
    metalness: 0.45,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x1e1b4b,
    roughness: 0.34,
    metalness: 0.55,
  });
  const magentaNeonMat = new THREE.MeshStandardMaterial({
    color: 0xec4899,
    emissive: 0xec4899,
    emissiveIntensity: 2.3,
    roughness: 0.18,
  });
  const cyanNeonMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 2.2,
    roughness: 0.18,
  });
  const loungeGlassMat = new THREE.MeshStandardMaterial({
    color: 0xa855f7,
    emissive: 0x7e22ce,
    emissiveIntensity: 0.95,
    roughness: 0.12,
    metalness: 0.72,
  });
  const signMat = signTex
    ? new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: signTex,
        emissive: 0xffffff,
        emissiveMap: signTex,
        emissiveIntensity: 1.05,
        roughness: 0.25,
      })
    : null;

  // Grounded club plaza + entrance terrace
  const plazaGeo = new THREE.BoxGeometry(36, 0.4, 28);
  const plaza = new THREE.Mesh(plazaGeo, deckMat);
  plaza.position.y = 0.2;
  plaza.receiveShadow = enableShadows;

  // Sleek 2-story nightclub structure + overhanging upper skybar lounge
  const groundHallGeo = new THREE.BoxGeometry(30, 7.6, 19);
  const groundHall = new THREE.Mesh(groundHallGeo, wallMat);
  groundHall.position.set(0, 4.2, -1.5);
  groundHall.castShadow = enableShadows;
  groundHall.receiveShadow = enableShadows;

  const upperClubGeo = new THREE.BoxGeometry(24, 6.4, 15);
  const upperClub = new THREE.Mesh(upperClubGeo, wallMat);
  upperClub.position.set(0, 11.2, -2.5);
  upperClub.castShadow = enableShadows;

  // Illuminated rooftop VIP rail & terrace floor
  const railGeo = new THREE.BoxGeometry(28.5, 0.28, 4.5);
  const terrace = new THREE.Mesh(railGeo, deckMat);
  terrace.position.set(0, 8.15, 7.2);
  const railTrimGeo = new THREE.BoxGeometry(28.7, 0.22, 0.25);
  const railTrim = new THREE.Mesh(railTrimGeo, cyanNeonMat);
  railTrim.position.set(0, 9.1, 9.4);

  // Entrance neon portal & lounge windows
  const entryCanopyGeo = new THREE.BoxGeometry(11, 0.7, 5.2);
  const entryCanopy = new THREE.Mesh(entryCanopyGeo, magentaNeonMat);
  entryCanopy.position.set(0, 4.2, 9.8);
  const winGeo = new THREE.BoxGeometry(24, 2.8, 0.35);
  const frontWin = new THREE.Mesh(winGeo, loungeGlassMat);
  frontWin.position.set(0, 2.5, 8.1);

  // Rooftop sign (omitted on Low quality)
  if (signMat && signTex) {
    const signGeo = new THREE.BoxGeometry(18, 4.0, 0.55);
    const signMesh = new THREE.Mesh(signGeo, signMat);
    signMesh.position.set(0, 11.4, 5.3);
    root.add(signMesh);
    disposables.push(signTex, signMat, signGeo);
  }

  // Rooftop giant neon cocktail martini glass silhouette
  const stemGeo = new THREE.CylinderGeometry(0.24, 0.24, 4.2, 8);
  const bowlGeo = new THREE.ConeGeometry(3.2, 3.0, 14, 1, true);
  bowlGeo.rotateX(Math.PI);
  const baseDiscGeo = new THREE.CylinderGeometry(1.7, 1.8, 0.35, 14);
  const cocktailGroup = new THREE.Group();
  cocktailGroup.position.set(0, 14.6, -2.0);
  const baseDisc = new THREE.Mesh(baseDiscGeo, cyanNeonMat);
  baseDisc.position.y = 0.2;
  const stem = new THREE.Mesh(stemGeo, cyanNeonMat);
  stem.position.y = 2.3;
  const bowl = new THREE.Mesh(bowlGeo, magentaNeonMat);
  bowl.position.y = 5.4;
  cocktailGroup.add(baseDisc, stem, bowl);

  // 8 Vertical Equalizer Light Columns along the front facade
  const eqGeo = new THREE.BoxGeometry(1.1, 1.0, 0.45);
  eqGeo.translate(0, 0.5, 0);
  for (let i = 0; i < 8; i++) {
    const bx = -11.2 + i * 3.2;
    const bar = new THREE.Mesh(eqGeo, i % 2 === 0 ? cyanNeonMat : magentaNeonMat);
    bar.position.set(bx, 1.0, 8.35);
    bar.scale.y = 4.5 + (i % 3) * 1.8;
    root.add(bar);
    eqBars.push(bar);
  }

  root.add(
    plaza,
    groundHall,
    upperClub,
    terrace,
    railTrim,
    entryCanopy,
    frontWin,
    cocktailGroup
  );

  disposables.push(
    deckMat,
    wallMat,
    magentaNeonMat,
    cyanNeonMat,
    loungeGlassMat,
    plazaGeo,
    groundHallGeo,
    upperClubGeo,
    railGeo,
    railTrimGeo,
    entryCanopyGeo,
    winGeo,
    stemGeo,
    bowlGeo,
    baseDiscGeo,
    eqGeo
  );

  return { group: root, eqBars };
}

export function buildNightCityFeatures(
  track: RaceTrack,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
  isClearOfTrack: (x: number, z: number, radius: number) => boolean,
  isWalkwayBlocked?: (x: number, z: number, radius: number) => boolean,
  graphicsQuality: GraphicsQuality = 'medium'
): NightCityFeaturesSystem {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const venueFootprints: NightVenueFootprint[] = [];
  const barberPoles: THREE.Mesh[] = [];
  const profile = getGraphicsProfile(graphicsQuality);
  const aniso = Math.min(maxAnisotropy, profile.maxAnisotropyCap);
  const simpleMat = profile.buildingDetail === 'simple';
  const enableShadows = profile.shadows && !isSoftwareGl;

  const isPursuit = !track.isClosed;

  // =========================================================================
  // 1. CENTRAL HERO LANDMARKS: GRAND CASINO CLUB + NEON BAR-CLUB
  // =========================================================================
  const { group: casinoGroup, spinTarget: casinoCrown } = buildCasinoClub(
    aniso,
    enableShadows,
    profile.showBanners,
    profile.textureSizeScale,
    disposables
  );
  const { group: barClubGroup, eqBars } = buildBarClub(
    aniso,
    enableShadows,
    profile.showBanners,
    profile.textureSizeScale,
    disposables
  );

  const findOpenPlaza = (
    preferredX: number,
    preferredZ: number,
    requiredRadius: number,
    avoid?: NightVenueFootprint
  ): { x: number; z: number; yaw: number } => {
    if (
      isClearOfTrack(preferredX, preferredZ, requiredRadius) &&
      (!avoid || Math.hypot(preferredX - avoid.x, preferredZ - avoid.z) > requiredRadius + avoid.radius + 8)
    ) {
      return { x: preferredX, z: preferredZ, yaw: 0 };
    }
    // Search visibly beside the track corridor (t = 0.10 .. 0.65)
    for (const bt of [0.14, 0.22, 0.35, 0.45, 0.56, 0.68]) {
      const s = sampleAtT(track, bt);
      for (const side of [1, -1] as const) {
        for (const dist of [46, 58, 72]) {
          const px = s.x + s.rx * side * dist;
          const pz = s.z + s.rz * side * dist;
          if (!isClearOfTrack(px, pz, requiredRadius)) continue;
          if (avoid && Math.hypot(px - avoid.x, pz - avoid.z) < requiredRadius + avoid.radius + 10) {
            continue;
          }
          const yaw = Math.atan2(-side * s.rx, -side * s.rz);
          return { x: px, z: pz, yaw };
        }
      }
    }
    return { x: preferredX, z: preferredZ, yaw: 0 };
  };

  if (!isPursuit) {
    // Midnight City center open courtyard (-28, -44 has ~146m clear radius)
    const casinoSpot = findOpenPlaza(-46, -42, 24);
    casinoGroup.position.set(casinoSpot.x, 0, casinoSpot.z);
    casinoGroup.rotation.y = -0.35;
    venueFootprints.push({ x: casinoSpot.x, z: casinoSpot.z, radius: 28 });

    const barSpot = findOpenPlaza(12, -46, 21, venueFootprints[0]);
    barClubGroup.position.set(barSpot.x, 0, barSpot.z);
    barClubGroup.rotation.y = 0.3;
    venueFootprints.push({ x: barSpot.x, z: barSpot.z, radius: 25 });
  } else {
    // Pursuit maps: pick two wide clear trackside plazas early/mid-route so the player speeds right past both!
    const casinoSpot = findOpenPlaza(-401, -12, 24);
    casinoGroup.position.set(casinoSpot.x, 0, casinoSpot.z);
    casinoGroup.rotation.y = casinoSpot.yaw;
    venueFootprints.push({ x: casinoSpot.x, z: casinoSpot.z, radius: 28 });

    const barSpot = findOpenPlaza(177, -268, 21, venueFootprints[0]);
    barClubGroup.position.set(barSpot.x, 0, barSpot.z);
    barClubGroup.rotation.y = barSpot.yaw;
    venueFootprints.push({ x: barSpot.x, z: barSpot.z, radius: 25 });
  }
  group.add(casinoGroup, barClubGroup);

  // =========================================================================
  // 2. NIGHT STREET-LEVEL SHOPS (Barbershop, Supermarket, Diner, Tech)
  // =========================================================================
  const shopSpots: Array<{
    x: number;
    z: number;
    yaw: number;
    typeIdx: number;
  }> = [];

  const shopHalfDepth = 3.1;
  const shopHalfWidth = 5.0;
  const shopCenterDist = track.halfWidth + SIDEWALK_OUTER_OFFSET + 4.5;

  const maxNightShops = simpleMat ? 18 : 36;
  for (let i = 0; i < track.samples.length; i += simpleMat ? 36 : 24) {
    const s = track.samples[i];
    if (s.curvature > 0.018) continue;

    for (const side of [1, -1] as const) {
      if (!simpleMat && (i + (side > 0 ? 0 : 24)) % 48 !== 0) continue;
      if (isForkOpeningAtT(track, s.t, side === 1 ? 'right' : 'left', 4) !== null) continue;

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

      let blocked = false;
      for (const vf of venueFootprints) {
        if (Math.hypot(cx - vf.x, cz - vf.z) < vf.radius + 8) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      for (const prev of shopSpots) {
        if (Math.hypot(cx - prev.x, cz - prev.z) < (simpleMat ? 24 : 16.5)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      const yaw = Math.atan2(-s.rx * side, -s.rz * side);
      shopSpots.push({
        x: cx,
        z: cz,
        yaw,
        typeIdx: shopSpots.length % NIGHT_SHOP_TYPES.length,
      });
      if (shopSpots.length >= maxNightShops) break;
    }
    if (shopSpots.length >= maxNightShops) break;
  }

  const shopAssets = NIGHT_SHOP_TYPES.map((st) => {
    const wallMat = simpleMat
      ? new THREE.MeshLambertMaterial({ color: st.wallColor })
      : new THREE.MeshStandardMaterial({
          color: st.wallColor,
          roughness: 0.62,
          metalness: 0.14,
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
          emissive: 0xffffff,
          emissiveMap: signTex,
          emissiveIntensity: 0.95,
          roughness: 0.25,
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
          roughness: 0.52,
        });
    const winMat = simpleMat
      ? new THREE.MeshLambertMaterial({ color: st.windowColor })
      : new THREE.MeshStandardMaterial({
          color: st.windowColor,
          emissive: st.windowColor,
          emissiveIntensity: 0.92,
          roughness: 0.14,
          metalness: 0.45,
        });
    disposables.push(wallMat, signTex, signMat, awningTex, awningMat, winMat);
    return { st, wallMat, signMat, awningMat, winMat };
  });

  const shopBodyGeo = new THREE.BoxGeometry(10.0, 5.4, 6.2);
  const shopRoofGeo = new THREE.BoxGeometry(10.4, 0.45, 6.6);
  const shopSignGeo = new THREE.BoxGeometry(8.6, 1.5, 0.35);
  const shopAwningGeo = new THREE.BoxGeometry(8.8, 0.22, 2.0);
  const shopWinGeo = new THREE.BoxGeometry(5.6, 2.4, 0.2);
  const shopSideWinGeo = new THREE.BoxGeometry(0.2, 2.1, 3.6);
  const shopDoorGeo = new THREE.BoxGeometry(1.7, 2.7, 0.22);
  const darkFrameMat = new THREE.MeshStandardMaterial({
    color: 0x0b1220,
    roughness: 0.4,
    metalness: 0.6,
  });

  const poleTex = createBarberPoleTexture(maxAnisotropy);
  const barberPoleGeo = new THREE.CylinderGeometry(0.22, 0.22, 1.65, 12);
  const barberCapGeo = new THREE.SphereGeometry(0.24, 10, 8);
  const barberPoleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: poleTex,
    emissive: 0xffffff,
    emissiveMap: poleTex,
    emissiveIntensity: 0.45,
    roughness: 0.22,
  });
  const rackGeo = new THREE.BoxGeometry(1.3, 0.85, 0.8);
  const greenTrimMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x16a34a,
    emissiveIntensity: 0.55,
  });
  const cyanTrimMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.75,
  });

  disposables.push(
    shopBodyGeo,
    shopRoofGeo,
    shopSignGeo,
    shopAwningGeo,
    shopWinGeo,
    shopSideWinGeo,
    shopDoorGeo,
    darkFrameMat,
    poleTex,
    barberPoleGeo,
    barberCapGeo,
    barberPoleMat,
    rackGeo,
    greenTrimMat,
    cyanTrimMat
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

      if (asset.st.propType === 'barber') {
        const pole = new THREE.Mesh(barberPoleGeo, barberPoleMat);
        pole.position.set(4.15, 2.05, 3.45);
        const topCap = new THREE.Mesh(barberCapGeo, darkFrameMat);
        topCap.position.set(4.15, 2.95, 3.45);
        const botCap = new THREE.Mesh(barberCapGeo, darkFrameMat);
        botCap.position.set(4.15, 1.15, 3.45);
        shopGroup.add(pole, topCap, botCap);
        barberPoles.push(pole);
      } else if (asset.st.propType === 'supermarket') {
        for (const rx of [-2.8, -1.1]) {
          const rack = new THREE.Mesh(rackGeo, greenTrimMat);
          rack.position.set(rx, 0.45, 3.6);
          shopGroup.add(rack);
        }
      } else if (asset.st.propType === 'tech') {
        const display = new THREE.Mesh(rackGeo, cyanTrimMat);
        display.position.set(-2.2, 0.45, 3.6);
        shopGroup.add(display);
      }
    }

    group.add(shopGroup);
  }

  function isNearNightFeature(x: number, z: number, radius: number): boolean {
    for (const vf of venueFootprints) {
      if (Math.hypot(x - vf.x, z - vf.z) < vf.radius + radius) return true;
    }
    for (const s of shopSpots) {
      if (Math.hypot(x - s.x, z - s.z) < radius + 8.5) return true;
    }
    return false;
  }

  function update(_dt: number, elapsed: number): void {
    casinoCrown.rotation.y = elapsed * 0.95;
    for (let i = 0; i < eqBars.length; i++) {
      eqBars[i].scale.y = 3.2 + (Math.sin(elapsed * 5.4 + i * 0.9) * 0.5 + 0.5) * 4.2;
    }
    for (const p of barberPoles) {
      p.rotation.y = elapsed * 3.4;
    }
  }

  return {
    group,
    venueFootprints,
    shopSpots,
    isNearNightFeature,
    update,
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
