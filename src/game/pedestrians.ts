import * as THREE from 'three';
import { getWaterHazardAtT, isForkOpeningAtT, type RaceTrack } from './track';
import { isPursuitMap } from './garage';
import type { MapId } from './types';

export const SIDEWALK_HEIGHT = 0.14;
export const SIDEWALK_INNER_OFFSET = 0.95; // starts just outside the 0.85m barrier
export const SIDEWALK_OUTER_OFFSET = 4.55; // 3.6m wide pedestrian promenade

export interface PedestrianAgent {
  trackT: number;
  side: 1 | -1; // +1 right sidewalk, -1 left sidewalk
  laneOffset: number; // lateral distance from track centerline
  direction: 1 | -1; // +1 forward along loop, -1 opposite direction
  walkSpeed: number; // m/s
  stridePhase: number;
  heightScale: number;
  isChild: boolean;
  coatColor: THREE.Color;
  pantsColor: THREE.Color;
  skinColor: THREE.Color;
  hairColor: THREE.Color;
}

export interface DogAgent {
  trackT: number;
  side: 1 | -1;
  laneOffset: number;
  direction: 1 | -1;
  trotSpeed: number;
  stridePhase: number;
  scale: number;
  coatColor: THREE.Color;
  earColor: THREE.Color;
  collarColor: THREE.Color;
}

import type { NpcWalkwaySegment } from './npcWalkways';
import { getGraphicsProfile, type GraphicsQuality } from './graphics';

export interface PedestrianSystemOptions {
  adultCount?: number;
  childCount?: number;
  dogCount?: number;
  mapId?: MapId;
  walkwaySegments?: NpcWalkwaySegment[];
  graphicsQuality?: GraphicsQuality;
  isSoftwareGl?: boolean;
}

export interface PedestrianSystem {
  group: THREE.Group;
  update: (dt: number) => void;
  dispose: () => void;
}

const DAY_STREET_TOP_PALETTE = [
  0x38bdf8, // sky hoodie
  0xf97316, // terracotta tee
  0xe11d48, // crimson bomber
  0xa78bfa, // lavender sweatshirt
  0xfbbf24, // mustard windbreaker
  0x10b981, // emerald overshirt
  0x2563eb, // denim jacket
  0xec4899, // berry hoodie
  0xe2e8f0, // heather grey tee
];

const ICE_PARKA_PALETTE = [
  0x0284c7, // glacier cobalt parka
  0xe11d48, // alpine crimson puffer
  0xf97316, // expedition orange parka
  0x0f766e, // pine teal down jacket
  0x7c3aed, // arctic violet parka
  0xeab308, // rescue amber parka
  0x0ea5e9, // frost cyan puffer
];

const ICE_SCARF_PALETTE = [
  0xf43f5e, // rose knit scarf
  0xfacc15, // gold knit scarf
  0x38bdf8, // ice-blue scarf
  0xf8fafc, // cream wool scarf
  0xfb923c, // tangerine scarf
  0xa855f7, // plum scarf
];

const TUXEDO_SUIT_PALETTE = [
  0x090d17, // jet black tuxedo
  0x0f172a, // midnight obsidian suit
  0x171e2e, // tailored midnight navy
  0x18181b, // charcoal satin tux
  0x1c1917, // onyx dinner jacket
];

const TUXEDO_BOWTIE_PALETTE = [
  0xdc2626, // silk crimson bowtie
  0x0f172a, // classic black bowtie
  0xfacc15, // champagne gold bowtie
  0x0284c7, // sapphire bowtie
  0xf8fafc, // white-tie ivory
];

const BEACH_WEAR_PALETTE = [
  0x06b6d4, // turquoise bikini/tank
  0xf97316, // coral swimsuit
  0xfacc15, // sunny yellow beachwear
  0xf43f5e, // watermelon one-piece
  0x22c55e, // tropical lime resort top
  0x38bdf8, // sky blue tank
  0xa855f7, // hibiscus violet
  0xfef3c7, // linen resort shirt
];

const CHILD_OUTFIT_PALETTE = [
  0xfacc15, // bright yellow
  0x22d3ee, // bright cyan
  0xf43f5e, // coral pink
  0x4ade80, // mint green
  0xfb923c, // tangerine
  0x818cf8, // periwinkle
];

const STREET_PANTS_PALETTE = [0x1d4ed8, 0x1e293b, 0x334155, 0x78350f, 0x475569];
const WINTER_PANTS_PALETTE = [0x0f172a, 0x1e293b, 0x334155, 0x1e1b4b];
const BEACH_SHORTS_PALETTE = [0x0284c7, 0xf97316, 0x0f766e, 0xe11d48, 0xfef08a, 0x38bdf8];
const SNEAKER_PALETTE = [0xf8fafc, 0xe2e8f0, 0xef4444, 0x0ea5e9, 0xfacc15];
const SKIN_PALETTE = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const HAIR_PALETTE = [0x0f172a, 0x3f2312, 0x78350f, 0xd97706, 0x94a3b8];

const DOG_COAT_PALETTE = [
  0xd99b52, // golden retriever
  0x6b3e26, // chocolate lab
  0x94a3b8, // husky grey
  0xf1e6d2, // cream terrier
  0x292524, // black lab
  0xc27849, // copper setter
];

const DOG_COLLAR_PALETTE = [0xef4444, 0x0ea5e9, 0x22c55e, 0xfacc15, 0xa855f7];

export function sampleSmoothTrackPoint(track: RaceTrack, t: number) {
  const n = track.samples.length;
  let exactIdx: number;
  let idx0: number;
  let idx1: number;
  let frac: number;

  if (track.isClosed) {
    const wrapped = ((t % 1) + 1) % 1;
    exactIdx = wrapped * n;
    idx0 = Math.floor(exactIdx) % n;
    idx1 = (idx0 + 1) % n;
    frac = exactIdx - Math.floor(exactIdx);
  } else {
    const clamped = Math.min(1, Math.max(0, t));
    exactIdx = clamped * (n - 1);
    idx0 = Math.min(n - 1, Math.floor(exactIdx));
    idx1 = Math.min(n - 1, idx0 + 1);
    frac = exactIdx - idx0;
  }

  const s0 = track.samples[idx0];
  const s1 = track.samples[idx1];

  const x = s0.x + (s1.x - s0.x) * frac;
  const z = s0.z + (s1.z - s0.z) * frac;
  const rx = s0.rx + (s1.rx - s0.rx) * frac;
  const rz = s0.rz + (s1.rz - s0.rz) * frac;
  const tx = s0.tx + (s1.tx - s0.tx) * frac;
  const tz = s0.tz + (s1.tz - s0.tz) * frac;
  const yaw = Math.atan2(tx, tz);

  return { x, z, rx, rz, yaw };
}

export function createPedestrianSystem(
  track: RaceTrack,
  countOrOptions: number | PedestrianSystemOptions = {}
): PedestrianSystem {
  const opts: PedestrianSystemOptions =
    typeof countOrOptions === 'number'
      ? {
          adultCount: countOrOptions,
          childCount: Math.round(countOrOptions * 0.42),
          dogCount: Math.round(countOrOptions * 0.34),
          mapId: track.mapId,
        }
      : countOrOptions;

  const mapId = opts.mapId ?? track.mapId;
  const walkwaySegments = opts.walkwaySegments ?? [];
  const profile = getGraphicsProfile(opts.graphicsQuality ?? 'medium');
  const isSimple = profile.npcDetail === 'simple';
  const isHigh = profile.npcDetail === 'high';
  const enableShadows = profile.shadows && !opts.isSoftwareGl;
  const isBeach = mapId === 'beach';
  const isIce = mapId === 'ice-arena';
  const isNight = mapId === 'night-city';
  const isPursuit = isPursuitMap(mapId);
  const isDay = mapId === 'day-city' || isPursuit;
  const isConstruction = mapId === 'construction';

  const baseAdultCount = opts.adultCount ?? 88;
  const minAdults = mapId === 'day-city' ? 10 : 6;
  const adultCount = Math.max(minAdults, Math.round(baseAdultCount * profile.npcDensityScale));
  // Construction site has ONLY adult workers in hard hats; Pursuit maps omit children & dogs for spare night tension
  const baseChildCount = isConstruction || isPursuit ? 0 : (opts.childCount ?? 38);
  const baseDogCount = isConstruction || isPursuit ? 0 : (opts.dogCount ?? 28);
  const childCount =
    baseChildCount > 0 ? Math.max(2, Math.round(baseChildCount * profile.npcDensityScale)) : 0;
  const dogCount =
    baseDogCount > 0 ? Math.max(2, Math.round(baseDogCount * profile.npcDensityScale)) : 0;
  const totalHumans = adultCount + childCount;

  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  // Deterministic seed so pedestrian spawns are clean and repeatable
  let seed = 90210;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const CONSTRUCTION_SHIRT_PALETTE = [
    0x1e3a8a, // work navy tee
    0x334155, // slate work shirt
    0xe2e8f0, // light grey work tee
    0x78350f, // flannel brown
    0x0f172a, // charcoal tee
  ];
  const CONSTRUCTION_VEST_PALETTE = [0xfacc15, 0xf97316, 0xa3e635];
  const CONSTRUCTION_HARDHAT_PALETTE = [0xfacc15, 0xf8fafc, 0xf97316];
  const CONSTRUCTION_PANTS_PALETTE = [0x1e3a8a, 0x334155, 0x451a03, 0x1e293b];

  const adultCoatPalette = isBeach
    ? BEACH_WEAR_PALETTE
    : isIce
      ? ICE_PARKA_PALETTE
      : isNight
        ? TUXEDO_SUIT_PALETTE
        : isConstruction
          ? CONSTRUCTION_SHIRT_PALETTE
          : DAY_STREET_TOP_PALETTE;
  const pantsPalette = isBeach
    ? BEACH_SHORTS_PALETTE
    : isNight
      ? TUXEDO_SUIT_PALETTE
      : isIce
        ? WINTER_PANTS_PALETTE
        : isConstruction
          ? CONSTRUCTION_PANTS_PALETTE
          : STREET_PANTS_PALETTE;

  const FAN_TEAM_COLORS = [0xdc2626, 0x2563eb, 0xfacc15, 0x16a34a];
  const createFootballTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = '#0f172a';
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.beginPath();
        ctx.arc(16 + c * 32 + (r % 2) * 16, 18 + r * 28, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  let fanSlotCursor = 0;
  const agents: Array<
    PedestrianAgent & {
      scarfColor: THREE.Color;
      bowtieColor: THREE.Color;
      shortsColor: THREE.Color;
      sneakerColor: THREE.Color;
      vestColor: THREE.Color;
      hardHatColor: THREE.Color;
      hasSunCap: boolean;
      fanSlot: number;
      walkwayIdx: number;
      walkwayU: number;
      walkwayLat: number;
    }
  > = Array.from({ length: totalHumans }, (_, idx) => {
    const isChild = idx >= adultCount;
    const isFootballFan =
      mapId === 'day-city' &&
      ((idx >= 0 && idx < 6) || (isChild && idx - adultCount < 2)) &&
      fanSlotCursor < 8;
    const fanSlot = isFootballFan ? fanSlotCursor++ : -1;
    const pairAnchorIdx = isChild ? (idx - adultCount) % adultCount : idx;
    const side: 1 | -1 = idx % 2 === 0 ? 1 : -1;
    const direction: 1 | -1 = isChild
      ? pairAnchorIdx % 3 === 0
        ? -1
        : 1
      : idx % 3 === 0
        ? -1
        : 1;

    // Spread across the 3.6m sidewalk promenade between 1.55m and 3.85m outside the barrier
    const laneDepth = 1.65 + rand() * 2.1;
    const laneOffset = side * (track.halfWidth + SIDEWALK_INNER_OFFSET + laneDepth);

    // Ensure the first 12 adults populate the start/finish boulevard on closed circuits; spread across route on open tracks
    const spreadT = !track.isClosed
      ? 0.04 + (idx / Math.max(1, adultCount)) * 0.90
      : idx < 12
        ? 0.006 + (idx / 12) * 0.058
        : (idx / adultCount + rand() * (0.45 / adultCount)) % 1;

    // Pair most children near an adult parent along the sidewalk
    const baseT = isChild
      ? (pairAnchorIdx < 12
          ? 0.008 + ((pairAnchorIdx % 12) / 12) * 0.058
          : (pairAnchorIdx / adultCount + 0.0028 + rand() * 0.003) % 1)
      : spreadT;

    const coatHex = isFootballFan
      ? FAN_TEAM_COLORS[fanSlot % FAN_TEAM_COLORS.length]
      : isNight
        ? TUXEDO_SUIT_PALETTE[idx % TUXEDO_SUIT_PALETTE.length]
        : isIce
          ? ICE_PARKA_PALETTE[idx % ICE_PARKA_PALETTE.length]
          : isChild
            ? CHILD_OUTFIT_PALETTE[idx % CHILD_OUTFIT_PALETTE.length]
            : adultCoatPalette[idx % adultCoatPalette.length];

    const pantsHex = isNight
      ? TUXEDO_SUIT_PALETTE[idx % TUXEDO_SUIT_PALETTE.length]
      : pantsPalette[idx % pantsPalette.length];

    const hasCapOrBeanie =
      (isIce && idx % 4 !== 0) ||
      (isBeach && idx % 3 === 0) ||
      (isChild && !isNight && idx % 3 === 0);

    const headgearHex = isIce
      ? ICE_SCARF_PALETTE[(idx + 2) % ICE_SCARF_PALETTE.length]
      : isBeach
        ? BEACH_WEAR_PALETTE[(idx + 3) % BEACH_WEAR_PALETTE.length]
        : CHILD_OUTFIT_PALETTE[(idx + 2) % CHILD_OUTFIT_PALETTE.length];

    const useWalkway =
      walkwaySegments.length > 0 && !isFootballFan && (idx % 5 === 1 || idx % 5 === 3);
    const walkwayIdx = useWalkway ? idx % walkwaySegments.length : -1;
    const walkwayU = 0.08 + rand() * 0.84;
    const walkwayLat =
      walkwayIdx >= 0
        ? (rand() - 0.5) * (walkwaySegments[walkwayIdx].width * 0.58)
        : 0;

    return {
      trackT: baseT,
      side: isChild ? (pairAnchorIdx % 2 === 0 ? 1 : -1) : side,
      laneOffset: isChild
        ? (pairAnchorIdx % 2 === 0 ? 1 : -1) *
          (track.halfWidth + SIDEWALK_INNER_OFFSET + 1.45 + rand() * 1.95)
        : laneOffset,
      direction,
      walkSpeed: isChild ? 1.55 + rand() * 0.7 : 1.2 + rand() * 0.65,
      stridePhase: rand() * Math.PI * 2,
      heightScale: isChild ? 0.56 + rand() * 0.12 : 0.92 + rand() * 0.14,
      isChild,
      coatColor: new THREE.Color(coatHex),
      pantsColor: new THREE.Color(pantsHex),
      skinColor: new THREE.Color(SKIN_PALETTE[idx % SKIN_PALETTE.length]),
      hairColor: new THREE.Color(
        hasCapOrBeanie ? headgearHex : HAIR_PALETTE[idx % HAIR_PALETTE.length]
      ),
      scarfColor: new THREE.Color(ICE_SCARF_PALETTE[(idx + 1) % ICE_SCARF_PALETTE.length]),
      bowtieColor: new THREE.Color(TUXEDO_BOWTIE_PALETTE[idx % TUXEDO_BOWTIE_PALETTE.length]),
      shortsColor: new THREE.Color(BEACH_SHORTS_PALETTE[(idx + 2) % BEACH_SHORTS_PALETTE.length]),
      sneakerColor: new THREE.Color(SNEAKER_PALETTE[idx % SNEAKER_PALETTE.length]),
      vestColor: new THREE.Color(CONSTRUCTION_VEST_PALETTE[idx % CONSTRUCTION_VEST_PALETTE.length]),
      hardHatColor: new THREE.Color(
        CONSTRUCTION_HARDHAT_PALETTE[idx % CONSTRUCTION_HARDHAT_PALETTE.length]
      ),
      hasSunCap: hasCapOrBeanie,
      fanSlot,
      walkwayIdx,
      walkwayU,
      walkwayLat,
    };
  });

  // Spawn NPC Dogs strolling alongside sidewalks AND city NPC roads
  const dogs: Array<
    DogAgent & {
      walkwayIdx: number;
      walkwayU: number;
      walkwayLat: number;
    }
  > = Array.from({ length: dogCount }, (_, idx) => {
    const ownerIdx = idx < 6 ? idx * 2 : (idx * 3) % Math.max(1, adultCount);
    const owner = agents[ownerIdx];
    const side = owner ? owner.side : idx % 2 === 0 ? 1 : -1;
    const direction = owner ? owner.direction : idx % 3 === 0 ? -1 : 1;
    const laneJitter = (rand() - 0.5) * 0.65;
    const baseLane = owner
      ? owner.laneOffset + laneJitter
      : side * (track.halfWidth + SIDEWALK_INNER_OFFSET + 2.2);
    const clampedAbs = THREE.MathUtils.clamp(
      Math.abs(baseLane),
      track.halfWidth + SIDEWALK_INNER_OFFSET + 0.65,
      track.halfWidth + SIDEWALK_OUTER_OFFSET - 0.55
    );
    const coatHex = DOG_COAT_PALETTE[idx % DOG_COAT_PALETTE.length];
    const earColor = new THREE.Color(coatHex).multiplyScalar(0.68);
    const walkwayIdx =
      owner && owner.walkwayIdx >= 0
        ? owner.walkwayIdx
        : walkwaySegments.length > 0 && idx % 3 === 1
          ? idx % walkwaySegments.length
          : -1;
    const walkwayU = owner && owner.walkwayIdx >= 0 ? owner.walkwayU : 0.1 + rand() * 0.8;
    const walkwayLat =
      walkwayIdx >= 0
        ? THREE.MathUtils.clamp(
            (owner && owner.walkwayIdx >= 0 ? owner.walkwayLat : 0) + (rand() - 0.5) * 0.7,
            -walkwaySegments[walkwayIdx].width * 0.36,
            walkwaySegments[walkwayIdx].width * 0.36
          )
        : 0;

    return {
      trackT: owner ? (owner.trackT + 0.0022) % 1 : (idx / dogCount) % 1,
      side,
      laneOffset: Math.sign(baseLane) * clampedAbs,
      direction,
      trotSpeed: owner ? owner.walkSpeed : 1.5 + rand() * 0.6,
      stridePhase: rand() * Math.PI * 2,
      scale: 0.84 + rand() * 0.34,
      coatColor: new THREE.Color(coatHex),
      earColor,
      collarColor: new THREE.Color(DOG_COLLAR_PALETTE[idx % DOG_COLLAR_PALETTE.length]),
      walkwayIdx,
      walkwayU,
      walkwayLat,
    };
  });

  // --- Shared procedural geometries for humans (adults + children) ---
  const shadowGeo = new THREE.CircleGeometry(0.38, 12);
  shadowGeo.rotateX(-Math.PI / 2);

  const legGeo = new THREE.BoxGeometry(0.16, 0.72, 0.18);
  legGeo.translate(0, -0.36, 0); // top-hip pivot

  const torsoGeo = new THREE.BoxGeometry(0.46, 0.64, 0.25);
  torsoGeo.translate(0, 0.32, 0); // waist pivot

  const armGeo = new THREE.BoxGeometry(0.13, 0.58, 0.14);
  armGeo.translate(0, -0.29, 0); // top-shoulder pivot

  const headGeo = new THREE.BoxGeometry(0.27, 0.27, 0.27);
  const hairGeo = new THREE.BoxGeometry(0.29, 0.12, 0.29);

  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x020617,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });

  const bodyMat = isSimple
    ? new THREE.MeshLambertMaterial({ color: 0xffffff })
    : new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: isNight ? 0.42 : 0.62,
        metalness: isNight ? 0.14 : 0.08,
      });

  const skinMat = isSimple
    ? new THREE.MeshLambertMaterial({ color: 0xffffff })
    : new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.7,
        metalness: 0.04,
      });

  const shadowInst = new THREE.InstancedMesh(shadowGeo, shadowMat, totalHumans);
  const leftLegInst = new THREE.InstancedMesh(legGeo, bodyMat, totalHumans);
  const rightLegInst = new THREE.InstancedMesh(legGeo, bodyMat, totalHumans);
  const torsoInst = new THREE.InstancedMesh(torsoGeo, bodyMat, totalHumans);
  const leftArmInst = new THREE.InstancedMesh(armGeo, bodyMat, totalHumans);
  const rightArmInst = new THREE.InstancedMesh(armGeo, bodyMat, totalHumans);
  const headInst = new THREE.InstancedMesh(headGeo, skinMat, totalHumans);
  const hairInst = new THREE.InstancedMesh(hairGeo, bodyMat, totalHumans);

  // Map-specific costume detail InstancedMeshes
  let scarfCollarInst: THREE.InstancedMesh | null = null;
  let scarfTailInst: THREE.InstancedMesh | null = null;
  let shirtFrontInst: THREE.InstancedMesh | null = null;
  let bowtieInst: THREE.InstancedMesh | null = null;
  let swimShortsInst: THREE.InstancedMesh | null = null;
  let leftSneakerInst: THREE.InstancedMesh | null = null;
  let rightSneakerInst: THREE.InstancedMesh | null = null;
  let backpackInst: THREE.InstancedMesh | null = null;
  let capVisorInst: THREE.InstancedMesh | null = null;
  let safetyVestInst: THREE.InstancedMesh | null = null;
  let hardHatDomeInst: THREE.InstancedMesh | null = null;
  let hardHatBrimInst: THREE.InstancedMesh | null = null;

  if (isIce) {
    const scarfCollarGeo = new THREE.BoxGeometry(0.58, 0.16, 0.44);
    scarfCollarGeo.translate(0, 0.68, 0);
    const scarfTailGeo = new THREE.BoxGeometry(0.14, 0.36, 0.09);
    scarfTailGeo.translate(0, -0.18, 0);
    const scarfMat = isSimple
      ? new THREE.MeshLambertMaterial({ color: 0xffffff })
      : new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.85,
          metalness: 0.02,
        });
    scarfCollarInst = new THREE.InstancedMesh(scarfCollarGeo, scarfMat, totalHumans);
    scarfTailInst = new THREE.InstancedMesh(scarfTailGeo, scarfMat, totalHumans);
    for (let i = 0; i < totalHumans; i++) {
      scarfCollarInst.setColorAt(i, agents[i].scarfColor);
      scarfTailInst.setColorAt(i, agents[i].scarfColor);
    }
    disposables.push(scarfCollarGeo, scarfTailGeo, scarfMat);
  } else if (isNight) {
    const shirtFrontGeo = new THREE.BoxGeometry(0.18, 0.44, 0.03);
    shirtFrontGeo.translate(0, 0.39, 0.125);
    const shirtMat = isSimple
      ? new THREE.MeshLambertMaterial({ color: 0xf8fafc })
      : new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          roughness: 0.45,
          metalness: 0.05,
        });
    const bowtieGeo = new THREE.BoxGeometry(0.16, 0.068, 0.04);
    bowtieGeo.translate(0, 0.58, 0.142);
    const bowtieMat = isSimple
      ? new THREE.MeshLambertMaterial({ color: 0xffffff })
      : new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.35,
          metalness: 0.2,
        });
    shirtFrontInst = new THREE.InstancedMesh(shirtFrontGeo, shirtMat, totalHumans);
    bowtieInst = new THREE.InstancedMesh(bowtieGeo, bowtieMat, totalHumans);
    const crispWhite = new THREE.Color(0xf8fafc);
    for (let i = 0; i < totalHumans; i++) {
      shirtFrontInst.setColorAt(i, crispWhite);
      bowtieInst.setColorAt(i, agents[i].bowtieColor);
    }
    disposables.push(shirtFrontGeo, shirtMat, bowtieGeo, bowtieMat);
  } else if (isBeach) {
    const shortsGeo = new THREE.BoxGeometry(0.47, 0.25, 0.27);
    shortsGeo.translate(0, 0.04, 0);
    swimShortsInst = new THREE.InstancedMesh(shortsGeo, bodyMat, totalHumans);
    for (let i = 0; i < totalHumans; i++) {
      swimShortsInst.setColorAt(i, agents[i].shortsColor);
    }
    disposables.push(shortsGeo);
  } else if (isConstruction) {
    const vestGeo = new THREE.BoxGeometry(0.49, 0.52, 0.28);
    vestGeo.translate(0, 0.34, 0);
    const vestMat = isSimple
      ? new THREE.MeshLambertMaterial({ color: 0xffffff })
      : new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.45,
          metalness: 0.05,
        });
    const hardHatDomeGeo = new THREE.CylinderGeometry(0.145, 0.185, 0.16, 12);
    const hardHatBrimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.035, 12);
    const hardHatMat = isSimple
      ? new THREE.MeshLambertMaterial({ color: 0xffffff })
      : new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.3,
          metalness: 0.12,
        });
    safetyVestInst = new THREE.InstancedMesh(vestGeo, vestMat, totalHumans);
    hardHatDomeInst = new THREE.InstancedMesh(hardHatDomeGeo, hardHatMat, totalHumans);
    hardHatBrimInst = new THREE.InstancedMesh(hardHatBrimGeo, hardHatMat, totalHumans);
    for (let i = 0; i < totalHumans; i++) {
      safetyVestInst.setColorAt(i, agents[i].vestColor);
      hardHatDomeInst.setColorAt(i, agents[i].hardHatColor);
      hardHatBrimInst.setColorAt(i, agents[i].hardHatColor);
    }
    disposables.push(vestGeo, vestMat, hardHatDomeGeo, hardHatBrimGeo, hardHatMat);
  }

  // Sneakers on Daylight Metro (Medium+) and ALL walkers on High
  if ((isDay && !isSimple) || isHigh) {
    const sneakerGeo = new THREE.BoxGeometry(0.18, 0.11, 0.24);
    sneakerGeo.translate(0, -0.665, 0.035);
    leftSneakerInst = new THREE.InstancedMesh(sneakerGeo, bodyMat, totalHumans);
    rightSneakerInst = new THREE.InstancedMesh(sneakerGeo, bodyMat, totalHumans);
    for (let i = 0; i < totalHumans; i++) {
      leftSneakerInst.setColorAt(i, agents[i].sneakerColor);
      rightSneakerInst.setColorAt(i, agents[i].sneakerColor);
    }
    disposables.push(sneakerGeo);
  }

  // High-quality NPC extras: backpacks & sun caps / cap visors
  if (isHigh) {
    if (!isNight && !isBeach) {
      const backpackGeo = new THREE.BoxGeometry(0.32, 0.42, 0.16);
      backpackGeo.translate(0, 0.35, -0.2);
      backpackInst = new THREE.InstancedMesh(backpackGeo, bodyMat, totalHumans);
      for (let i = 0; i < totalHumans; i++) {
        backpackInst.setColorAt(
          i,
          i % 3 === 0 ? agents[i].sneakerColor : agents[i].pantsColor
        );
      }
      disposables.push(backpackGeo);
    }
    if (!isConstruction && !isNight) {
      const capVisorGeo = new THREE.BoxGeometry(0.28, 0.04, 0.14);
      capVisorGeo.translate(0, 0, 0.19);
      capVisorInst = new THREE.InstancedMesh(capVisorGeo, bodyMat, totalHumans);
      for (let i = 0; i < totalHumans; i++) {
        capVisorInst.setColorAt(i, agents[i].hairColor);
      }
      disposables.push(capVisorGeo);
    }
  }

  for (let i = 0; i < totalHumans; i++) {
    const a = agents[i];
    leftLegInst.setColorAt(i, isBeach ? a.skinColor : a.pantsColor);
    rightLegInst.setColorAt(i, isBeach ? a.skinColor : a.pantsColor);
    torsoInst.setColorAt(i, a.coatColor);
    leftArmInst.setColorAt(i, isBeach ? a.skinColor : a.coatColor);
    rightArmInst.setColorAt(i, isBeach ? a.skinColor : a.coatColor);
    headInst.setColorAt(i, a.skinColor);
    hairInst.setColorAt(i, a.hairColor);
  }

  const allHumanInsts: THREE.InstancedMesh[] = [
    shadowInst,
    leftLegInst,
    rightLegInst,
    torsoInst,
    leftArmInst,
    rightArmInst,
    headInst,
    hairInst,
  ];
  if (scarfCollarInst) allHumanInsts.push(scarfCollarInst);
  if (scarfTailInst) allHumanInsts.push(scarfTailInst);
  if (shirtFrontInst) allHumanInsts.push(shirtFrontInst);
  if (bowtieInst) allHumanInsts.push(bowtieInst);
  if (swimShortsInst) allHumanInsts.push(swimShortsInst);
  if (leftSneakerInst) allHumanInsts.push(leftSneakerInst);
  if (rightSneakerInst) allHumanInsts.push(rightSneakerInst);
  if (backpackInst) allHumanInsts.push(backpackInst);
  if (capVisorInst) allHumanInsts.push(capVisorInst);
  if (safetyVestInst) allHumanInsts.push(safetyVestInst);
  if (hardHatDomeInst) allHumanInsts.push(hardHatDomeInst);
  if (hardHatBrimInst) allHumanInsts.push(hardHatBrimInst);

  for (const inst of allHumanInsts) {
    inst.frustumCulled = false;
    if (inst !== shadowInst) {
      inst.castShadow = enableShadows;
    }
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
  }

  // Football Fan Attributes on Daylight Metro (8 fans with team scarves, waving flags & soccer balls)
  const fanCount = fanSlotCursor;
  let fanScarfInst: THREE.InstancedMesh | null = null;
  let fanFlagPoleInst: THREE.InstancedMesh | null = null;
  let fanPennantInst: THREE.InstancedMesh | null = null;
  let fanBallInst: THREE.InstancedMesh | null = null;
  const fanInsts: THREE.InstancedMesh[] = [];

  if (fanCount > 0) {
    const fScarfGeo = new THREE.BoxGeometry(0.52, 0.14, 0.34);
    fScarfGeo.translate(0, 0.65, 0);
    const fPoleGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.95, 6);
    fPoleGeo.translate(0, 0.45, 0);
    const fPennantGeo = new THREE.BoxGeometry(0.03, 0.36, 0.56);
    fPennantGeo.translate(0, 0.72, 0.28);
    const fBallGeo = new THREE.SphereGeometry(0.18, 12, 10);
    const fScarfMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 });
    const fPoleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    const fPennantMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
    const fBallTex = createFootballTexture();
    const fBallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: fBallTex,
      roughness: 0.45,
    });

    fanScarfInst = new THREE.InstancedMesh(fScarfGeo, fScarfMat, fanCount);
    fanFlagPoleInst = new THREE.InstancedMesh(fPoleGeo, fPoleMat, fanCount);
    fanPennantInst = new THREE.InstancedMesh(fPennantGeo, fPennantMat, fanCount);
    fanBallInst = new THREE.InstancedMesh(fBallGeo, fBallMat, fanCount);

    for (const a of agents) {
      if (a.fanSlot >= 0) {
        const teamCol = new THREE.Color(FAN_TEAM_COLORS[a.fanSlot % FAN_TEAM_COLORS.length]);
        const altCol = new THREE.Color(a.fanSlot % 2 === 0 ? 0xfacc15 : 0xffffff);
        fanScarfInst.setColorAt(a.fanSlot, altCol);
        fanPennantInst.setColorAt(a.fanSlot, teamCol);
      }
    }

    fanInsts.push(fanScarfInst, fanFlagPoleInst, fanPennantInst, fanBallInst);
    for (const inst of fanInsts) {
      inst.frustumCulled = false;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      group.add(inst);
    }

    disposables.push(
      fScarfGeo,
      fPoleGeo,
      fPennantGeo,
      fBallGeo,
      fScarfMat,
      fPoleMat,
      fPennantMat,
      fBallTex,
      fBallMat
    );
  }

  disposables.push(
    shadowGeo,
    legGeo,
    torsoGeo,
    armGeo,
    headGeo,
    hairGeo,
    shadowMat,
    bodyMat,
    skinMat
  );

  // --- Shared procedural composite geometries for NPC Dogs (skipped when dogCount === 0, e.g. Construction) ---
  let dogShadowInst: THREE.InstancedMesh | null = null;
  let dogBodyInst: THREE.InstancedMesh | null = null;
  let dogCollarInst: THREE.InstancedMesh | null = null;
  let dogHeadInst: THREE.InstancedMesh | null = null;
  let dogSnoutInst: THREE.InstancedMesh | null = null;
  let dogLeftEarInst: THREE.InstancedMesh | null = null;
  let dogRightEarInst: THREE.InstancedMesh | null = null;
  let dogTailInst: THREE.InstancedMesh | null = null;
  let dogFLInst: THREE.InstancedMesh | null = null;
  let dogFRInst: THREE.InstancedMesh | null = null;
  let dogBLInst: THREE.InstancedMesh | null = null;
  let dogBRInst: THREE.InstancedMesh | null = null;
  const dogInsts: THREE.InstancedMesh[] = [];

  if (dogCount > 0) {
    const dogShadowGeo = new THREE.CircleGeometry(0.32, 10);
    dogShadowGeo.rotateX(-Math.PI / 2);

    const dogBodyGeo = new THREE.BoxGeometry(0.28, 0.25, 0.62);
    const dogCollarGeo = new THREE.BoxGeometry(0.30, 0.27, 0.08);
    const dogHeadGeo = new THREE.BoxGeometry(0.23, 0.22, 0.24);
    const dogSnoutGeo = new THREE.BoxGeometry(0.14, 0.11, 0.14);
    const dogEarGeo = new THREE.BoxGeometry(0.06, 0.14, 0.1);
    const dogTailGeo = new THREE.BoxGeometry(0.06, 0.24, 0.06);
    dogTailGeo.translate(0, 0.12, 0); // base pivot at rump
    const dogLegGeo = new THREE.BoxGeometry(0.085, 0.26, 0.09);
    dogLegGeo.translate(0, -0.13, 0); // hip/shoulder pivot

    const dogFurMat = isSimple
      ? new THREE.MeshLambertMaterial({ color: 0xffffff })
      : new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.78,
          metalness: 0.04,
        });

    dogShadowInst = new THREE.InstancedMesh(dogShadowGeo, shadowMat, dogCount);
    dogBodyInst = new THREE.InstancedMesh(dogBodyGeo, dogFurMat, dogCount);
    dogCollarInst = new THREE.InstancedMesh(dogCollarGeo, dogFurMat, dogCount);
    dogHeadInst = new THREE.InstancedMesh(dogHeadGeo, dogFurMat, dogCount);
    dogSnoutInst = new THREE.InstancedMesh(dogSnoutGeo, dogFurMat, dogCount);
    dogLeftEarInst = new THREE.InstancedMesh(dogEarGeo, dogFurMat, dogCount);
    dogRightEarInst = new THREE.InstancedMesh(dogEarGeo, dogFurMat, dogCount);
    dogTailInst = new THREE.InstancedMesh(dogTailGeo, dogFurMat, dogCount);
    dogFLInst = new THREE.InstancedMesh(dogLegGeo, dogFurMat, dogCount);
    dogFRInst = new THREE.InstancedMesh(dogLegGeo, dogFurMat, dogCount);
    dogBLInst = new THREE.InstancedMesh(dogLegGeo, dogFurMat, dogCount);
    dogBRInst = new THREE.InstancedMesh(dogLegGeo, dogFurMat, dogCount);

    for (let i = 0; i < dogCount; i++) {
      const d = dogs[i];
      dogBodyInst.setColorAt(i, d.coatColor);
      dogCollarInst.setColorAt(i, d.collarColor);
      dogHeadInst.setColorAt(i, d.coatColor);
      dogSnoutInst.setColorAt(i, d.earColor);
      dogLeftEarInst.setColorAt(i, d.earColor);
      dogRightEarInst.setColorAt(i, d.earColor);
      dogTailInst.setColorAt(i, d.coatColor);
      dogFLInst.setColorAt(i, d.coatColor);
      dogFRInst.setColorAt(i, d.coatColor);
      dogBLInst.setColorAt(i, d.coatColor);
      dogBRInst.setColorAt(i, d.coatColor);
    }
    dogInsts.push(
      dogShadowInst,
      dogBodyInst,
      dogCollarInst,
      dogHeadInst,
      dogSnoutInst,
      dogLeftEarInst,
      dogRightEarInst,
      dogTailInst,
      dogFLInst,
      dogFRInst,
      dogBLInst,
      dogBRInst
    );
    for (const inst of dogInsts) {
      inst.frustumCulled = false;
      if (inst !== dogShadowInst) {
        inst.castShadow = enableShadows;
      }
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      group.add(inst);
    }

    disposables.push(
      dogShadowGeo,
      dogBodyGeo,
      dogCollarGeo,
      dogHeadGeo,
      dogSnoutGeo,
      dogEarGeo,
      dogTailGeo,
      dogLegGeo,
      dogFurMat
    );
  }

  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YXZ';

  function update(dt: number): void {
    // 1. Update Adult & Child Pedestrians
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      a.stridePhase += a.walkSpeed * (a.isChild ? 6.6 : 5.2) * dt;

      let wx: number;
      let wz: number;
      let yaw: number;

      if (a.walkwayIdx >= 0 && a.walkwayIdx < walkwaySegments.length) {
        const seg = walkwaySegments[a.walkwayIdx];
        a.walkwayU += (a.direction * a.walkSpeed * dt) / Math.max(1, seg.length);
        if (a.walkwayU > 0.96) {
          a.walkwayU = 0.96;
          a.direction = -1;
        } else if (a.walkwayU < 0.04) {
          a.walkwayU = 0.04;
          a.direction = 1;
        }
        const segRightX = Math.cos(seg.yaw);
        const segRightZ = -Math.sin(seg.yaw);
        wx = seg.x0 + (seg.x1 - seg.x0) * a.walkwayU + segRightX * a.walkwayLat;
        wz = seg.z0 + (seg.z1 - seg.z0) * a.walkwayU + segRightZ * a.walkwayLat;
        yaw = a.direction > 0 ? seg.yaw : seg.yaw + Math.PI;
      } else {
        const dT = (a.direction * a.walkSpeed * dt) / track.totalLength;
        if (track.isClosed) {
          a.trackT = (a.trackT + dT + 1) % 1;
        } else {
          a.trackT += dT;
          if (a.trackT > 0.985) {
            a.trackT = 0.985;
            a.direction = -1;
          } else if (a.trackT < 0.015) {
            a.trackT = 0.015;
            a.direction = 1;
          }
        }

        const wzHazard = getWaterHazardAtT(track, a.trackT);
        const hiddenOverWater =
          wzHazard !== null &&
          (wzHazard.side === 'both' ||
            (wzHazard.side === 'left' && a.side === -1) ||
            (wzHazard.side === 'right' && a.side === 1));
        const hiddenAtFork =
          isForkOpeningAtT(track, a.trackT, a.side === 1 ? 'right' : 'left') !== null;
        if (hiddenOverWater || hiddenAtFork) {
          dummy.position.set(0, -40, 0);
          dummy.scale.setScalar(0.001);
          dummy.updateMatrix();
          for (const inst of allHumanInsts) {
            inst.setMatrixAt(i, dummy.matrix);
          }
          if (a.fanSlot >= 0) {
            for (const inst of fanInsts) {
              inst.setMatrixAt(a.fanSlot, dummy.matrix);
            }
          }
          continue;
        }

        const s = sampleSmoothTrackPoint(track, a.trackT);
        wx = s.x + s.rx * a.laneOffset;
        wz = s.z + s.rz * a.laneOffset;
        yaw = a.direction > 0 ? s.yaw : s.yaw + Math.PI;
      }

      const fwdX = Math.sin(yaw);
      const fwdZ = Math.cos(yaw);
      const rightX = -Math.cos(yaw);
      const rightZ = Math.sin(yaw);

      const hs = a.heightScale;
      const swing = Math.sin(a.stridePhase) * (a.isChild ? 0.62 : 0.52);
      const bob = Math.abs(Math.sin(a.stridePhase)) * 0.035 * hs;

      // Ground contact shadow on sidewalk surface
      dummy.position.set(wx, SIDEWALK_HEIGHT + 0.012, wz);
      dummy.rotation.set(0, yaw, 0, 'YXZ');
      dummy.scale.set(hs, 1, hs);
      dummy.updateMatrix();
      shadowInst.setMatrixAt(i, dummy.matrix);

      // Hip & shoulder lateral offsets (wider shoulders for bulky winter parkas)
      const hipOffset = 0.11 * hs;
      const shoulderOffset = (isIce ? 0.36 : 0.29) * hs;
      const hipY = SIDEWALK_HEIGHT + 0.72 * hs + bob;
      const shoulderY = SIDEWALK_HEIGHT + 1.34 * hs + bob;

      // Left Leg (+ optional street sneaker)
      dummy.position.set(wx - rightX * hipOffset, hipY, wz - rightZ * hipOffset);
      dummy.rotation.set(swing, yaw, 0, 'YXZ');
      dummy.scale.setScalar(hs);
      dummy.updateMatrix();
      leftLegInst.setMatrixAt(i, dummy.matrix);
      if (leftSneakerInst) leftSneakerInst.setMatrixAt(i, dummy.matrix);

      // Right Leg (+ optional street sneaker)
      dummy.position.set(wx + rightX * hipOffset, hipY, wz + rightZ * hipOffset);
      dummy.rotation.set(-swing, yaw, 0, 'YXZ');
      dummy.scale.setScalar(hs);
      dummy.updateMatrix();
      rightLegInst.setMatrixAt(i, dummy.matrix);
      if (rightSneakerInst) rightSneakerInst.setMatrixAt(i, dummy.matrix);

      // Torso (bulky puffer parka volume on Ice Peaks)
      dummy.position.set(wx, hipY, wz);
      dummy.rotation.set(0.04, yaw, 0, 'YXZ');
      if (isIce) {
        dummy.scale.set(1.38 * hs, 1.04 * hs, 1.48 * hs);
      } else if (isNight) {
        dummy.scale.set(1.06 * hs, 1.02 * hs, 1.02 * hs);
      } else {
        dummy.scale.setScalar(hs);
      }
      dummy.updateMatrix();
      torsoInst.setMatrixAt(i, dummy.matrix);
      if (backpackInst) {
        if (i % 2 === 0 && !isIce) {
          backpackInst.setMatrixAt(i, dummy.matrix);
        } else {
          dummy.position.set(0, -40, 0);
          dummy.scale.setScalar(0.001);
          dummy.updateMatrix();
          backpackInst.setMatrixAt(i, dummy.matrix);
        }
      }

      if (scarfCollarInst) {
        dummy.position.set(wx, hipY, wz);
        dummy.rotation.set(0.04, yaw, 0, 'YXZ');
        dummy.scale.setScalar(hs);
        dummy.updateMatrix();
        scarfCollarInst.setMatrixAt(i, dummy.matrix);
      }
      if (scarfTailInst) {
        dummy.position.set(
          wx + fwdX * 0.21 * hs,
          hipY + 0.63 * hs,
          wz + fwdZ * 0.21 * hs
        );
        dummy.rotation.set(-0.14 + Math.sin(a.stridePhase) * 0.09, yaw, 0.08, 'YXZ');
        dummy.scale.setScalar(hs);
        dummy.updateMatrix();
        scarfTailInst.setMatrixAt(i, dummy.matrix);
      }
      if (shirtFrontInst && bowtieInst) {
        dummy.position.set(wx, hipY, wz);
        dummy.rotation.set(0.04, yaw, 0, 'YXZ');
        dummy.scale.set(1.06 * hs, 1.02 * hs, 1.03 * hs);
        dummy.updateMatrix();
        shirtFrontInst.setMatrixAt(i, dummy.matrix);
        bowtieInst.setMatrixAt(i, dummy.matrix);
      }
      if (swimShortsInst) {
        dummy.position.set(wx, hipY, wz);
        dummy.rotation.set(0.04, yaw, 0, 'YXZ');
        dummy.scale.setScalar(hs);
        dummy.updateMatrix();
        swimShortsInst.setMatrixAt(i, dummy.matrix);
      }
      if (safetyVestInst) {
        dummy.position.set(wx, hipY, wz);
        dummy.rotation.set(0.04, yaw, 0, 'YXZ');
        dummy.scale.setScalar(hs);
        dummy.updateMatrix();
        safetyVestInst.setMatrixAt(i, dummy.matrix);
      }

      // Left Arm (puffy sleeves on Ice Peaks, bare skin on Coral Beach)
      dummy.position.set(wx - rightX * shoulderOffset, shoulderY, wz - rightZ * shoulderOffset);
      dummy.rotation.set(-swing * 0.85, yaw, 0, 'YXZ');
      if (isIce) {
        dummy.scale.set(1.36 * hs, hs, 1.36 * hs);
      } else {
        dummy.scale.setScalar(hs);
      }
      dummy.updateMatrix();
      leftArmInst.setMatrixAt(i, dummy.matrix);

      // Right Arm (waving team pennant if football fan)
      const isFan = a.fanSlot >= 0;
      const rightArmPitch = isFan ? -2.2 + Math.sin(a.stridePhase * 1.4) * 0.35 : swing * 0.85;
      dummy.position.set(wx + rightX * shoulderOffset, shoulderY, wz + rightZ * shoulderOffset);
      dummy.rotation.set(rightArmPitch, yaw, isFan ? -0.18 : 0, 'YXZ');
      if (isIce) {
        dummy.scale.set(1.36 * hs, hs, 1.36 * hs);
      } else {
        dummy.scale.setScalar(hs);
      }
      dummy.updateMatrix();
      rightArmInst.setMatrixAt(i, dummy.matrix);

      if (isFan && fanScarfInst && fanFlagPoleInst && fanPennantInst && fanBallInst) {
        // Fan Team Scarf around collar
        dummy.position.set(wx, hipY, wz);
        dummy.rotation.set(0.04, yaw, 0, 'YXZ');
        dummy.scale.setScalar(hs);
        dummy.updateMatrix();
        fanScarfInst.setMatrixAt(a.fanSlot, dummy.matrix);

        // Raised Flag Pole & Pennant in right hand
        const handX = wx + rightX * (shoulderOffset + 0.08 * hs) + fwdX * 0.28 * hs;
        const handY = shoulderY + 0.25 * hs;
        const handZ = wz + rightZ * (shoulderOffset + 0.08 * hs) + fwdZ * 0.28 * hs;
        const waveTilt = Math.sin(a.stridePhase * 1.4) * 0.28;
        dummy.position.set(handX, handY, handZ);
        dummy.rotation.set(0.22 + waveTilt, yaw, -0.15, 'YXZ');
        dummy.scale.setScalar(hs);
        dummy.updateMatrix();
        fanFlagPoleInst.setMatrixAt(a.fanSlot, dummy.matrix);
        fanPennantInst.setMatrixAt(a.fanSlot, dummy.matrix);

        // Football tucked under left hand/arm
        dummy.position.set(
          wx - rightX * (shoulderOffset + 0.11 * hs) + fwdX * 0.1 * hs,
          hipY + 0.14 * hs,
          wz - rightZ * (shoulderOffset + 0.11 * hs) + fwdZ * 0.1 * hs
        );
        dummy.rotation.set(a.stridePhase, yaw, 0, 'YXZ');
        dummy.scale.setScalar(hs);
        dummy.updateMatrix();
        fanBallInst.setMatrixAt(a.fanSlot, dummy.matrix);
      }

      // Head & Hair/Knit Beanie or Construction Hard Hat
      const headS = a.isChild ? hs * 1.15 : hs;
      dummy.position.set(wx, SIDEWALK_HEIGHT + 1.54 * hs + bob, wz);
      dummy.rotation.set(0, yaw, 0, 'YXZ');
      dummy.scale.setScalar(headS);
      dummy.updateMatrix();
      headInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(wx, SIDEWALK_HEIGHT + 1.66 * hs + bob, wz);
      dummy.rotation.set(0, yaw, 0, 'YXZ');
      dummy.scale.set(
        isIce && a.hasSunCap ? headS * 1.08 : headS,
        isIce && a.hasSunCap ? headS * 1.25 : headS,
        isIce && a.hasSunCap ? headS * 1.08 : headS
      );
      dummy.updateMatrix();
      hairInst.setMatrixAt(i, dummy.matrix);

      if (capVisorInst) {
        if (a.hasSunCap && !isIce) {
          capVisorInst.setMatrixAt(i, dummy.matrix);
        } else {
          dummy.position.set(0, -40, 0);
          dummy.scale.setScalar(0.001);
          dummy.updateMatrix();
          capVisorInst.setMatrixAt(i, dummy.matrix);
        }
      }

      if (hardHatBrimInst && hardHatDomeInst) {
        dummy.position.set(wx, SIDEWALK_HEIGHT + 1.67 * hs + bob, wz);
        dummy.rotation.set(0, yaw, 0, 'YXZ');
        dummy.scale.setScalar(headS);
        dummy.updateMatrix();
        hardHatBrimInst.setMatrixAt(i, dummy.matrix);

        dummy.position.set(wx, SIDEWALK_HEIGHT + 1.75 * hs + bob, wz);
        dummy.rotation.set(0, yaw, 0, 'YXZ');
        dummy.scale.setScalar(headS);
        dummy.updateMatrix();
        hardHatDomeInst.setMatrixAt(i, dummy.matrix);
      }
    }

    for (const inst of allHumanInsts) {
      inst.instanceMatrix.needsUpdate = true;
    }
    for (const inst of fanInsts) {
      inst.instanceMatrix.needsUpdate = true;
    }

    if (dogCount === 0) return;

    // 2. Update NPC Dogs trotting along sidewalks AND city NPC roads
    for (let i = 0; i < dogs.length; i++) {
      const d = dogs[i];
      d.stridePhase += d.trotSpeed * 8.2 * dt;

      let wx: number;
      let wz: number;
      let yaw: number;

      if (d.walkwayIdx >= 0 && d.walkwayIdx < walkwaySegments.length) {
        const seg = walkwaySegments[d.walkwayIdx];
        d.walkwayU += (d.direction * d.trotSpeed * dt) / Math.max(1, seg.length);
        if (d.walkwayU > 0.96) {
          d.walkwayU = 0.96;
          d.direction = -1;
        } else if (d.walkwayU < 0.04) {
          d.walkwayU = 0.04;
          d.direction = 1;
        }
        const segRightX = Math.cos(seg.yaw);
        const segRightZ = -Math.sin(seg.yaw);
        wx = seg.x0 + (seg.x1 - seg.x0) * d.walkwayU + segRightX * d.walkwayLat;
        wz = seg.z0 + (seg.z1 - seg.z0) * d.walkwayU + segRightZ * d.walkwayLat;
        yaw = d.direction > 0 ? seg.yaw : seg.yaw + Math.PI;
      } else {
        const dT = (d.direction * d.trotSpeed * dt) / track.totalLength;
        if (track.isClosed) {
          d.trackT = (d.trackT + dT + 1) % 1;
        } else {
          d.trackT += dT;
          if (d.trackT > 0.985) {
            d.trackT = 0.985;
            d.direction = -1;
          } else if (d.trackT < 0.015) {
            d.trackT = 0.015;
            d.direction = 1;
          }
        }

        const wzHazard = getWaterHazardAtT(track, d.trackT);
        const hiddenOverWater =
          wzHazard !== null &&
          (wzHazard.side === 'both' ||
            (wzHazard.side === 'left' && d.side === -1) ||
            (wzHazard.side === 'right' && d.side === 1));
        if (hiddenOverWater) {
          dummy.position.set(0, -40, 0);
          dummy.scale.setScalar(0.001);
          dummy.updateMatrix();
          for (const inst of dogInsts) {
            inst.setMatrixAt(i, dummy.matrix);
          }
          continue;
        }

        const s = sampleSmoothTrackPoint(track, d.trackT);
        wx = s.x + s.rx * d.laneOffset;
        wz = s.z + s.rz * d.laneOffset;
        yaw = d.direction > 0 ? s.yaw : s.yaw + Math.PI;
      }

      const fwdX = Math.sin(yaw);
      const fwdZ = Math.cos(yaw);
      const rightX = -Math.cos(yaw);
      const rightZ = Math.sin(yaw);

      const sc = d.scale;
      const swingA = Math.sin(d.stridePhase) * 0.58;
      const swingB = -swingA;
      const bob = Math.abs(Math.sin(d.stridePhase)) * 0.025 * sc;
      const wag = Math.sin(d.stridePhase * 1.8) * 0.45;
      const bodyY = SIDEWALK_HEIGHT + 0.36 * sc + bob;

      // Shadow
      dummy.position.set(wx, SIDEWALK_HEIGHT + 0.012, wz);
      dummy.rotation.set(0, yaw, 0, 'YXZ');
      dummy.scale.set(sc, 1, sc);
      dummy.updateMatrix();
      dogShadowInst!.setMatrixAt(i, dummy.matrix);

      // Torso
      dummy.position.set(wx, bodyY, wz);
      dummy.rotation.set(0, yaw, 0, 'YXZ');
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      dogBodyInst!.setMatrixAt(i, dummy.matrix);

      // Collar
      dummy.position.set(wx + fwdX * 0.22 * sc, bodyY + 0.01 * sc, wz + fwdZ * 0.22 * sc);
      dummy.rotation.set(0, yaw, 0, 'YXZ');
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      dogCollarInst!.setMatrixAt(i, dummy.matrix);

      // Head
      const headX = wx + fwdX * 0.34 * sc;
      const headY = bodyY + 0.16 * sc;
      const headZ = wz + fwdZ * 0.34 * sc;
      dummy.position.set(headX, headY, headZ);
      dummy.rotation.set(0.06, yaw, 0, 'YXZ');
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      dogHeadInst!.setMatrixAt(i, dummy.matrix);

      // Snout
      dummy.position.set(
        headX + fwdX * 0.16 * sc,
        headY - 0.03 * sc,
        headZ + fwdZ * 0.16 * sc
      );
      dummy.rotation.set(0, yaw, 0, 'YXZ');
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      dogSnoutInst!.setMatrixAt(i, dummy.matrix);

      // Floppy Ears
      dummy.position.set(
        headX - rightX * 0.12 * sc,
        headY + 0.03 * sc,
        headZ - rightZ * 0.12 * sc
      );
      dummy.rotation.set(0, yaw, 0.18, 'YXZ');
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      dogLeftEarInst!.setMatrixAt(i, dummy.matrix);

      dummy.position.set(
        headX + rightX * 0.12 * sc,
        headY + 0.03 * sc,
        headZ + rightZ * 0.12 * sc
      );
      dummy.rotation.set(0, yaw, -0.18, 'YXZ');
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      dogRightEarInst!.setMatrixAt(i, dummy.matrix);

      // Wagging Tail
      dummy.position.set(wx - fwdX * 0.3 * sc, bodyY + 0.08 * sc, wz - fwdZ * 0.3 * sc);
      dummy.rotation.set(-0.55, yaw, wag, 'YXZ');
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      dogTailInst!.setMatrixAt(i, dummy.matrix);

      // 4 Trotting Legs
      const legY = SIDEWALK_HEIGHT + 0.26 * sc + bob * 0.5;
      const lat = 0.095 * sc;
      const frontDist = 0.21 * sc;
      const backDist = -0.21 * sc;

      // Front-Left
      dummy.position.set(
        wx + fwdX * frontDist - rightX * lat,
        legY,
        wz + fwdZ * frontDist - rightZ * lat
      );
      dummy.rotation.set(swingA, yaw, 0, 'YXZ');
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      dogFLInst!.setMatrixAt(i, dummy.matrix);

      // Front-Right
      dummy.position.set(
        wx + fwdX * frontDist + rightX * lat,
        legY,
        wz + fwdZ * frontDist + rightZ * lat
      );
      dummy.rotation.set(swingB, yaw, 0, 'YXZ');
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      dogFRInst!.setMatrixAt(i, dummy.matrix);

      // Back-Left
      dummy.position.set(
        wx + fwdX * backDist - rightX * lat,
        legY,
        wz + fwdZ * backDist - rightZ * lat
      );
      dummy.rotation.set(swingB, yaw, 0, 'YXZ');
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      dogBLInst!.setMatrixAt(i, dummy.matrix);

      // Back-Right
      dummy.position.set(
        wx + fwdX * backDist + rightX * lat,
        legY,
        wz + fwdZ * backDist + rightZ * lat
      );
      dummy.rotation.set(swingA, yaw, 0, 'YXZ');
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      dogBRInst!.setMatrixAt(i, dummy.matrix);
    }

    for (const inst of dogInsts) {
      inst.instanceMatrix.needsUpdate = true;
    }
  }

  // Initial pose placement
  update(0);

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
