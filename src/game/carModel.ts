import * as THREE from 'three';
import type { CarAppearance, CarBodyStyle } from './types';
import { getGraphicsProfile, type GraphicsQuality } from './graphics';

export interface CarModelOptions {
  isPolice?: boolean;
  hasCargo?: boolean;
  graphicsQuality?: GraphicsQuality;
}

export type CarDetailTier = 'simple' | 'standard' | 'high';

export interface CarMeshRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  frontLeftSteer: THREE.Group;
  frontRightSteer: THREE.Group;
  wheelMeshes: THREE.Group[];
  brakeLightMat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  nitroFlames: THREE.Mesh[];
  nitroGlowMat: THREE.MeshBasicMaterial;
  headlightBeamMat: THREE.MeshBasicMaterial;
  scratchMat: THREE.MeshBasicMaterial;
  lightbarRedMat?: THREE.MeshStandardMaterial;
  lightbarBlueMat?: THREE.MeshStandardMaterial;
  dispose: () => void;
}

// Shared geometries created once and reused across all 6 sports car models
let sharedGeoReady = false;
const bodyGeos = {} as Record<CarBodyStyle, THREE.BufferGeometry>;
const cabinGeos = {} as Record<CarBodyStyle, THREE.BufferGeometry>;
const glassGeos = {} as Record<CarBodyStyle, THREE.BufferGeometry>;

let hoodSingleStripeGeo: THREE.BufferGeometry;
let roofSingleStripeGeo: THREE.BufferGeometry;
let hoodTwinStripeGeo: THREE.BufferGeometry;
let roofTwinStripeGeo: THREE.BufferGeometry;
let muscleScoopGeo: THREE.BufferGeometry;
let hyperLouversGeo: THREE.BufferGeometry;
let sideIntakeGeo: THREE.BufferGeometry;
let kidneyGrilleGeo: THREE.BufferGeometry;
let gtrGrilleGeo: THREE.BufferGeometry;
let quadTailRingGeo: THREE.BufferGeometry;
let splitterGeo: THREE.BufferGeometry;
let rearDiffuserGeo: THREE.BufferGeometry;
let wingBladeGeo: THREE.BufferGeometry;
let wingPylonGeo: THREE.BufferGeometry;
let ducktailGeo: THREE.BufferGeometry;
let sideMirrorGeo: THREE.BufferGeometry;
let brakeCaliperGeo: THREE.BufferGeometry;
let spokeGeo: THREE.BufferGeometry;
let brakeDiscGeo: THREE.BufferGeometry;
let headlightGeo: THREE.BufferGeometry;
let taillightGeo: THREE.BufferGeometry;
let exhaustPipeGeo: THREE.BufferGeometry;
let contactShadowGeo: THREE.BufferGeometry;
let contactShadowTex: THREE.CanvasTexture;
let headlightPoolGeo: THREE.BufferGeometry;
let headlightPoolTex: THREE.CanvasTexture;

const tireGeoByTier = {} as Record<CarDetailTier, THREE.BufferGeometry>;
const rimGeoByTier = {} as Record<CarDetailTier, THREE.BufferGeometry>;
const flameConeGeoByTier = {} as Record<CarDetailTier, THREE.BufferGeometry>;

function createRadialTexture(
  innerRgba: string,
  midRgba: string,
  outerRgba: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, innerRgba);
  grad.addColorStop(0.5, midRgba);
  grad.addColorStop(1, outerRgba);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function extrudeProfile(
  profile: THREE.Shape,
  depth: number,
  bevelThickness = 0.08,
  bevelSize = 0.05
): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(profile, {
    depth,
    bevelEnabled: true,
    bevelThickness,
    bevelSize,
    bevelSegments: 3,
    steps: 1,
  });
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function ensureSharedCarGeometries(): void {
  if (sharedGeoReady) return;
  sharedGeoReady = true;

  // --- 1. Lamborghini SVJ (Extreme angular V12 wedge) ---
  const lamboBody = new THREE.Shape();
  lamboBody.moveTo(-2.24, 0.19);
  lamboBody.lineTo(2.28, 0.15);
  lamboBody.lineTo(2.40, 0.27);
  lamboBody.lineTo(2.14, 0.42);
  lamboBody.lineTo(1.10, 0.56);
  lamboBody.lineTo(-0.98, 0.65);
  lamboBody.lineTo(-2.22, 0.68);
  lamboBody.lineTo(-2.28, 0.30);
  lamboBody.closePath();
  bodyGeos.lamborghini = extrudeProfile(lamboBody, 1.92, 0.06, 0.04);

  const lamboCabin = new THREE.Shape();
  lamboCabin.moveTo(-1.14, 0.61);
  lamboCabin.lineTo(1.12, 0.55);
  lamboCabin.lineTo(0.32, 1.01);
  lamboCabin.lineTo(-0.42, 1.02);
  lamboCabin.lineTo(-1.14, 0.65);
  lamboCabin.closePath();
  cabinGeos.lamborghini = extrudeProfile(lamboCabin, 1.32, 0.05, 0.04);
  glassGeos.lamborghini = extrudeProfile(lamboCabin, 1.38, 0.03, 0.03);
  glassGeos.lamborghini.scale(1.0, 0.94, 0.96);

  // --- 2. Ferrari SF90 (Sculpted low-slung mid-engine berlinetta) ---
  const ferrariBody = new THREE.Shape();
  ferrariBody.moveTo(-2.20, 0.20);
  ferrariBody.lineTo(2.22, 0.17);
  ferrariBody.lineTo(2.32, 0.33);
  ferrariBody.lineTo(2.04, 0.51);
  ferrariBody.lineTo(1.02, 0.64);
  ferrariBody.lineTo(-1.05, 0.69);
  ferrariBody.lineTo(-2.18, 0.69);
  ferrariBody.lineTo(-2.24, 0.34);
  ferrariBody.closePath();
  bodyGeos.ferrari = extrudeProfile(ferrariBody, 1.86, 0.09, 0.06);

  const ferrariCabin = new THREE.Shape();
  ferrariCabin.moveTo(-1.22, 0.66);
  ferrariCabin.lineTo(0.98, 0.62);
  ferrariCabin.lineTo(0.28, 1.07);
  ferrariCabin.lineTo(-0.48, 1.08);
  ferrariCabin.lineTo(-1.22, 0.72);
  ferrariCabin.closePath();
  cabinGeos.ferrari = extrudeProfile(ferrariCabin, 1.30, 0.06, 0.05);
  glassGeos.ferrari = extrudeProfile(ferrariCabin, 1.36, 0.03, 0.03);
  glassGeos.ferrari.scale(1.0, 0.94, 0.96);

  // --- 3. BMW M4 GT3 (Muscular front-engine DTM/GT3 touring coupe) ---
  const bmwBody = new THREE.Shape();
  bmwBody.moveTo(-2.18, 0.22);
  bmwBody.lineTo(2.16, 0.18);
  bmwBody.lineTo(2.26, 0.36);
  bmwBody.lineTo(2.10, 0.59);
  bmwBody.lineTo(1.02, 0.74);
  bmwBody.lineTo(-1.45, 0.77);
  bmwBody.lineTo(-2.16, 0.73);
  bmwBody.lineTo(-2.22, 0.38);
  bmwBody.closePath();
  bodyGeos.bmw = extrudeProfile(bmwBody, 1.80, 0.09, 0.05);

  const bmwCabin = new THREE.Shape();
  bmwCabin.moveTo(-1.35, 0.73);
  bmwCabin.lineTo(0.86, 0.71);
  bmwCabin.lineTo(0.28, 1.17);
  bmwCabin.lineTo(-0.56, 1.18);
  bmwCabin.lineTo(-1.35, 0.79);
  bmwCabin.closePath();
  cabinGeos.bmw = extrudeProfile(bmwCabin, 1.36, 0.06, 0.05);
  glassGeos.bmw = extrudeProfile(bmwCabin, 1.42, 0.03, 0.03);
  glassGeos.bmw.scale(1.0, 0.94, 0.96);

  // --- 4. Porsche 911 GT3 (Signature sloped nose + iconic fastback rear roofline) ---
  const porscheBody = new THREE.Shape();
  porscheBody.moveTo(-2.14, 0.21);
  porscheBody.lineTo(2.12, 0.19);
  porscheBody.lineTo(2.20, 0.36);
  porscheBody.lineTo(1.88, 0.52);
  porscheBody.lineTo(0.95, 0.65);
  porscheBody.lineTo(-1.35, 0.73);
  porscheBody.lineTo(-2.14, 0.72);
  porscheBody.lineTo(-2.18, 0.36);
  porscheBody.closePath();
  bodyGeos.porsche = extrudeProfile(porscheBody, 1.78, 0.10, 0.07);

  const porscheCabin = new THREE.Shape();
  porscheCabin.moveTo(-1.58, 0.72);
  porscheCabin.lineTo(0.88, 0.64);
  porscheCabin.lineTo(0.24, 1.14);
  porscheCabin.lineTo(-0.46, 1.15);
  porscheCabin.lineTo(-1.58, 0.76);
  porscheCabin.closePath();
  cabinGeos.porsche = extrudeProfile(porscheCabin, 1.30, 0.07, 0.05);
  glassGeos.porsche = extrudeProfile(porscheCabin, 1.36, 0.03, 0.03);
  glassGeos.porsche.scale(1.0, 0.94, 0.96);

  // --- 5. Nissan GT-R R35 (Bold Godzilla square-jawed AWD street monster) ---
  const nissanBody = new THREE.Shape();
  nissanBody.moveTo(-2.20, 0.22);
  nissanBody.lineTo(2.18, 0.20);
  nissanBody.lineTo(2.25, 0.52);
  nissanBody.lineTo(2.04, 0.66);
  nissanBody.lineTo(0.98, 0.76);
  nissanBody.lineTo(-1.42, 0.79);
  nissanBody.lineTo(-2.18, 0.76);
  nissanBody.lineTo(-2.22, 0.38);
  nissanBody.closePath();
  bodyGeos.nissan = extrudeProfile(nissanBody, 1.84, 0.08, 0.04);

  const nissanCabin = new THREE.Shape();
  nissanCabin.moveTo(-1.32, 0.75);
  nissanCabin.lineTo(0.84, 0.74);
  nissanCabin.lineTo(0.32, 1.21);
  nissanCabin.lineTo(-0.62, 1.21);
  nissanCabin.lineTo(-1.32, 0.80);
  nissanCabin.closePath();
  cabinGeos.nissan = extrudeProfile(nissanCabin, 1.38, 0.05, 0.04);
  glassGeos.nissan = extrudeProfile(nissanCabin, 1.44, 0.03, 0.03);
  glassGeos.nissan.scale(1.0, 0.94, 0.96);

  // --- 6. Dodge SRT Hellcat (Widebody V8 Muscle) ---
  const muscleBody = new THREE.Shape();
  muscleBody.moveTo(-2.22, 0.24);
  muscleBody.lineTo(2.14, 0.22);
  muscleBody.lineTo(2.22, 0.64);
  muscleBody.lineTo(0.95, 0.77);
  muscleBody.lineTo(-1.42, 0.79);
  muscleBody.lineTo(-2.20, 0.76);
  muscleBody.lineTo(-2.24, 0.38);
  muscleBody.closePath();
  bodyGeos.muscle = extrudeProfile(muscleBody, 1.88, 0.07, 0.04);

  const muscleCabin = new THREE.Shape();
  muscleCabin.moveTo(-1.26, 0.77);
  muscleCabin.lineTo(0.78, 0.75);
  muscleCabin.lineTo(0.34, 1.21);
  muscleCabin.lineTo(-0.72, 1.20);
  muscleCabin.lineTo(-1.26, 0.82);
  muscleCabin.closePath();
  cabinGeos.muscle = extrudeProfile(muscleCabin, 1.40, 0.05, 0.04);
  glassGeos.muscle = extrudeProfile(muscleCabin, 1.46, 0.03, 0.03);
  glassGeos.muscle.scale(1.0, 0.94, 0.96);

  // Livery stripes & model-specific details
  hoodSingleStripeGeo = new THREE.BoxGeometry(0.46, 0.03, 1.36);
  roofSingleStripeGeo = new THREE.BoxGeometry(0.46, 0.03, 0.95);
  hoodTwinStripeGeo = new THREE.BoxGeometry(0.18, 0.03, 1.36);
  roofTwinStripeGeo = new THREE.BoxGeometry(0.18, 0.03, 0.95);
  muscleScoopGeo = new THREE.BoxGeometry(0.62, 0.16, 0.85);
  hyperLouversGeo = new THREE.BoxGeometry(1.05, 0.08, 0.95);
  sideIntakeGeo = new THREE.BoxGeometry(0.14, 0.26, 0.72);
  kidneyGrilleGeo = new THREE.BoxGeometry(0.36, 0.24, 0.08);
  gtrGrilleGeo = new THREE.BoxGeometry(0.92, 0.24, 0.08);
  quadTailRingGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 14);
  quadTailRingGeo.rotateX(Math.PI / 2);

  // Aero & chassis trim
  splitterGeo = new THREE.BoxGeometry(1.98, 0.06, 4.52);
  rearDiffuserGeo = new THREE.BoxGeometry(1.66, 0.18, 0.35);
  wingBladeGeo = new THREE.BoxGeometry(1.92, 0.055, 0.35);
  wingPylonGeo = new THREE.BoxGeometry(0.06, 0.28, 0.20);
  ducktailGeo = new THREE.BoxGeometry(1.76, 0.14, 0.22);
  sideMirrorGeo = new THREE.BoxGeometry(0.22, 0.11, 0.16);
  brakeCaliperGeo = new THREE.BoxGeometry(0.09, 0.17, 0.12);

  // Per-tier wheel & flame geometries so live quality switches never reuse mismatched segment counts
  const makeTire = (segs: number) => {
    const g = new THREE.CylinderGeometry(0.36, 0.36, 0.28, segs);
    g.rotateZ(Math.PI / 2);
    return g;
  };
  const makeRim = (segs: number) => {
    const g = new THREE.CylinderGeometry(0.24, 0.24, 0.29, segs);
    g.rotateZ(Math.PI / 2);
    return g;
  };
  const makeFlame = (segs: number) => {
    const g = new THREE.ConeGeometry(0.10, 0.92, segs);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -0.46);
    return g;
  };

  tireGeoByTier.simple = makeTire(10);
  tireGeoByTier.standard = makeTire(20);
  tireGeoByTier.high = makeTire(32);

  rimGeoByTier.simple = makeRim(10);
  rimGeoByTier.standard = makeRim(16);
  rimGeoByTier.high = makeRim(24);

  flameConeGeoByTier.simple = makeFlame(10);
  flameConeGeoByTier.standard = makeFlame(14);
  flameConeGeoByTier.high = makeFlame(20);

  spokeGeo = new THREE.BoxGeometry(0.30, 0.42, 0.045);
  brakeDiscGeo = new THREE.CylinderGeometry(0.20, 0.20, 0.06, 16);
  brakeDiscGeo.rotateZ(Math.PI / 2);

  // Lights & nitro cones
  headlightGeo = new THREE.BoxGeometry(0.42, 0.075, 0.12);
  taillightGeo = new THREE.BoxGeometry(1.74, 0.075, 0.09);
  exhaustPipeGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.22, 12);
  exhaustPipeGeo.rotateX(Math.PI / 2);

  // Ground contact shadow & headlight projection
  contactShadowGeo = new THREE.PlaneGeometry(2.75, 5.15);
  contactShadowGeo.rotateX(-Math.PI / 2);
  contactShadowTex = createRadialTexture(
    'rgba(0, 0, 0, 0.82)',
    'rgba(0, 0, 0, 0.42)',
    'rgba(0, 0, 0, 0.0)'
  );

  headlightPoolGeo = new THREE.PlaneGeometry(4.2, 8.8);
  headlightPoolGeo.rotateX(-Math.PI / 2);
  headlightPoolTex = createRadialTexture(
    'rgba(225, 240, 255, 0.42)',
    'rgba(200, 225, 255, 0.16)',
    'rgba(180, 210, 255, 0.0)'
  );
}

interface BodyGeometrySpec {
  hoodY: number;
  hoodSlope: number;
  roofTopY: number;
  deckY: number;
  hlY: number;
  hlZ: number;
  tailY: number;
  splitterY: number;
  trackHalf: number;
}

const BODY_SPECS: Record<CarBodyStyle, BodyGeometrySpec> = {
  lamborghini: {
    hoodY: 0.53,
    hoodSlope: 0.14,
    roofTopY: 1.05,
    deckY: 0.71,
    hlY: 0.39,
    hlZ: 2.24,
    tailY: 0.56,
    splitterY: 0.15,
    trackHalf: 1.0,
  },
  ferrari: {
    hoodY: 0.59,
    hoodSlope: 0.13,
    roofTopY: 1.11,
    deckY: 0.73,
    hlY: 0.44,
    hlZ: 2.18,
    tailY: 0.58,
    splitterY: 0.16,
    trackHalf: 0.98,
  },
  bmw: {
    hoodY: 0.68,
    hoodSlope: 0.11,
    roofTopY: 1.20,
    deckY: 0.77,
    hlY: 0.49,
    hlZ: 2.16,
    tailY: 0.63,
    splitterY: 0.18,
    trackHalf: 0.95,
  },
  porsche: {
    hoodY: 0.61,
    hoodSlope: 0.14,
    roofTopY: 1.17,
    deckY: 0.75,
    hlY: 0.46,
    hlZ: 2.10,
    tailY: 0.61,
    splitterY: 0.17,
    trackHalf: 0.94,
  },
  nissan: {
    hoodY: 0.72,
    hoodSlope: 0.08,
    roofTopY: 1.23,
    deckY: 0.79,
    hlY: 0.52,
    hlZ: 2.16,
    tailY: 0.64,
    splitterY: 0.18,
    trackHalf: 0.97,
  },
  muscle: {
    hoodY: 0.79,
    hoodSlope: 0.05,
    roofTopY: 1.23,
    deckY: 0.82,
    hlY: 0.54,
    hlZ: 2.16,
    tailY: 0.64,
    splitterY: 0.18,
    trackHalf: 0.99,
  },
};

export function createCarModel(
  appearance: CarAppearance,
  isSoftwareGl: boolean,
  options?: CarModelOptions
): CarMeshRig {
  ensureSharedCarGeometries();

  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const disposables: Array<{ dispose: () => void }> = [];
  const isPolice = Boolean(options?.isPolice);
  const hasCargo = Boolean(options?.hasCargo);
  const profile = getGraphicsProfile(options?.graphicsQuality ?? 'medium');
  const detail: CarDetailTier = profile.carDetail;
  const isSimple = detail === 'simple';
  const isHigh = detail === 'high';
  const enableShadows = profile.shadows && !isSoftwareGl;

  const baseColor = isPolice ? '#0b0f19' : appearance.primaryColor;
  const paintMat = isSimple
    ? new THREE.MeshLambertMaterial({ color: new THREE.Color(baseColor) })
    : isSoftwareGl || !isHigh
      ? new THREE.MeshStandardMaterial({
          color: new THREE.Color(baseColor),
          metalness: 0.65,
          roughness: 0.22,
        })
      : new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(baseColor),
          metalness: 0.7,
          roughness: 0.18,
          clearcoat: 1.0,
          clearcoatRoughness: 0.06,
        });

  const carbonMat = isSimple
    ? new THREE.MeshLambertMaterial({ color: 0x161a23 })
    : new THREE.MeshStandardMaterial({
        color: 0x161a23,
        metalness: 0.2,
        roughness: 0.72,
      });

  const glassMat = isSimple
    ? new THREE.MeshLambertMaterial({ color: 0x091124 })
    : isSoftwareGl || !isHigh
      ? new THREE.MeshStandardMaterial({
          color: 0x050914,
          metalness: 0.35,
          roughness: 0.08,
        })
      : new THREE.MeshPhysicalMaterial({
          color: 0x050914,
          metalness: 0.35,
          roughness: 0.05,
          clearcoat: 1.0,
          clearcoatRoughness: 0.04,
        });

  const accentMat = isSimple
    ? new THREE.MeshLambertMaterial({ color: new THREE.Color(appearance.accentColor) })
    : new THREE.MeshStandardMaterial({
        color: new THREE.Color(appearance.accentColor),
        metalness: 0.55,
        roughness: 0.28,
      });

  const tireMat = isSimple
    ? new THREE.MeshLambertMaterial({ color: 0x12141a })
    : new THREE.MeshStandardMaterial({
        color: 0x12141a,
        metalness: 0.05,
        roughness: 0.86,
      });

  const rimHex =
    appearance.rimFinish === 'gold'
      ? 0xf59e0b
      : appearance.rimFinish === 'obsidian'
        ? 0x273244
        : 0xd4dae4;
  const rimMat = isSimple
    ? new THREE.MeshLambertMaterial({ color: rimHex })
    : new THREE.MeshStandardMaterial({
        color: rimHex,
        metalness: 0.92,
        roughness: appearance.rimFinish === 'obsidian' ? 0.35 : 0.18,
      });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 3.2,
    roughness: 0.1,
  });

  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });

  const nitroGlowMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const nitroCoreMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });

  const headlightBeamMat = new THREE.MeshBasicMaterial({
    map: headlightPoolTex,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const scratchMat = new THREE.MeshBasicMaterial({
    color: 0x090d16,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  disposables.push(
    paintMat,
    carbonMat,
    glassMat,
    accentMat,
    tireMat,
    rimMat,
    headlightMat,
    brakeLightMat,
    nitroGlowMat,
    nitroCoreMat,
    shadowMat,
    headlightBeamMat,
    scratchMat
  );

  // Main chassis silhouette based on chosen car model
  const { bodyStyle, livery, spoilerStyle } = appearance;
  const spec = BODY_SPECS[bodyStyle] ?? BODY_SPECS.lamborghini;

  const bodyMesh = new THREE.Mesh(bodyGeos[bodyStyle], paintMat);
  bodyMesh.castShadow = enableShadows;
  bodyMesh.receiveShadow = enableShadows;
  bodyPivot.add(bodyMesh);

  // Cabin glass & roof shell
  const glassMesh = new THREE.Mesh(glassGeos[bodyStyle], glassMat);
  glassMesh.position.set(0, 0.03, 0);
  bodyPivot.add(glassMesh);

  const roofPaintMat = isPolice
    ? new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        metalness: 0.4,
        roughness: 0.25,
      })
    : paintMat;
  if (isPolice) disposables.push(roofPaintMat);

  const roofCap = new THREE.Mesh(cabinGeos[bodyStyle], roofPaintMat);
  roofCap.scale.set(0.72, 0.96, 0.82);
  roofCap.position.set(0, 0.06, -0.04);
  roofCap.castShadow = enableShadows;
  bodyPivot.add(roofCap);

  // High-detail sculpted side-view wing mirrors
  if (isHigh) {
    for (const sx of [-0.94, 0.94]) {
      const mirror = new THREE.Mesh(sideMirrorGeo, carbonMat);
      mirror.position.set(sx, spec.hoodY + 0.14, 0.46);
      mirror.rotation.y = sx > 0 ? -0.18 : 0.18;
      mirror.castShadow = enableShadows;
      bodyPivot.add(mirror);
    }
  }

  // Police interceptor side door panels & roof red/blue LED lightbar
  let lightbarRedMat: THREE.MeshStandardMaterial | undefined;
  let lightbarBlueMat: THREE.MeshStandardMaterial | undefined;
  if (isPolice) {
    const doorPanelGeo = new THREE.BoxGeometry(1.94, 0.28, 1.35);
    const doorPanel = new THREE.Mesh(doorPanelGeo, roofPaintMat);
    doorPanel.position.set(0, 0.44, 0.05);
    bodyPivot.add(doorPanel);

    const barBaseGeo = new THREE.BoxGeometry(1.16, 0.07, 0.28);
    const barHalfGeo = new THREE.BoxGeometry(0.46, 0.095, 0.24);
    lightbarRedMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 3.4,
      roughness: 0.15,
    });
    lightbarBlueMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x2563eb,
      emissiveIntensity: 3.4,
      roughness: 0.15,
    });
    const barCenter = new THREE.Mesh(barBaseGeo, carbonMat);
    barCenter.position.set(0, spec.roofTopY + 0.08, -0.1);
    const redPod = new THREE.Mesh(barHalfGeo, lightbarRedMat);
    redPod.position.set(-0.29, spec.roofTopY + 0.11, -0.1);
    const bluePod = new THREE.Mesh(barHalfGeo, lightbarBlueMat);
    bluePod.position.set(0.29, spec.roofTopY + 0.11, -0.1);
    bodyPivot.add(barCenter, redPod, bluePod);
    disposables.push(doorPanelGeo, barBaseGeo, barHalfGeo, lightbarRedMat, lightbarBlueMat);
  }

  // Strapped armored cargo crate for Pursuit mode player vehicle
  if (hasCargo) {
    const crateGeo = new THREE.BoxGeometry(1.06, 0.34, 1.18);
    const strapGeo = new THREE.BoxGeometry(1.1, 0.36, 0.12);
    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.68,
      roughness: 0.34,
    });
    const strapMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xc2410c,
      emissiveIntensity: 0.45,
      roughness: 0.35,
    });
    const crate = new THREE.Mesh(crateGeo, crateMat);
    crate.position.set(0, spec.deckY + 0.15, -1.25);
    bodyPivot.add(crate);
    for (const sz of [-1.52, -0.98]) {
      const strap = new THREE.Mesh(strapGeo, strapMat);
      strap.position.set(0, spec.deckY + 0.15, sz);
      bodyPivot.add(strap);
    }
    disposables.push(crateGeo, strapGeo, crateMat, strapMat);
  }

  // Surface scuff & scratch decals (fade in dynamically with Pursuit damage)
  const scratchGeo = new THREE.BoxGeometry(0.05, 0.07, 0.85);
  const hoodScratchGeo = new THREE.BoxGeometry(0.55, 0.04, 0.07);
  const scratchPlacements: Array<{ x: number; y: number; z: number; rx: number; ry: number; rz: number; isHood?: boolean }> = [
    { x: -0.96, y: 0.45, z: 0.65, rx: 0.24, ry: 0, rz: 0 },
    { x: -0.96, y: 0.48, z: -0.55, rx: -0.18, ry: 0, rz: 0 },
    { x: 0.96, y: 0.46, z: 0.52, rx: -0.22, ry: 0, rz: 0 },
    { x: 0.96, y: 0.43, z: -0.68, rx: 0.21, ry: 0, rz: 0 },
    { x: -0.28, y: spec.hoodY + 0.03, z: 1.55, rx: 0, ry: 0.45, rz: 0, isHood: true },
    { x: 0.24, y: spec.hoodY + 0.04, z: 1.32, rx: 0, ry: -0.55, rz: 0, isHood: true },
  ];
  for (const sp of scratchPlacements) {
    const sm = new THREE.Mesh(sp.isHood ? hoodScratchGeo : scratchGeo, scratchMat);
    sm.position.set(sp.x, sp.y, sp.z);
    sm.rotation.set(sp.rx, sp.ry, sp.rz);
    bodyPivot.add(sm);
  }
  disposables.push(scratchGeo, hoodScratchGeo);

  // Signature marque details per bodyStyle
  if (bodyStyle === 'lamborghini') {
    const louvers = new THREE.Mesh(hyperLouversGeo, carbonMat);
    louvers.position.set(0, 0.66, -1.42);
    bodyPivot.add(louvers);
    for (const sx of [-0.94, 0.94]) {
      const intake = new THREE.Mesh(sideIntakeGeo, carbonMat);
      intake.position.set(sx, 0.44, -0.58);
      bodyPivot.add(intake);
    }
  } else if (bodyStyle === 'ferrari') {
    const engineDeck = new THREE.Mesh(hyperLouversGeo, glassMat);
    engineDeck.scale.set(0.9, 0.8, 0.92);
    engineDeck.position.set(0, 0.69, -1.45);
    bodyPivot.add(engineDeck);
    for (const sx of [-0.92, 0.92]) {
      const pod = new THREE.Mesh(sideIntakeGeo, carbonMat);
      pod.position.set(sx, 0.46, -0.45);
      bodyPivot.add(pod);
    }
  } else if (bodyStyle === 'bmw') {
    for (const sx of [-0.22, 0.22]) {
      const kidney = new THREE.Mesh(kidneyGrilleGeo, carbonMat);
      kidney.position.set(sx, 0.40, 2.27);
      bodyPivot.add(kidney);
    }
    const powerDome = new THREE.Mesh(muscleScoopGeo, paintMat);
    powerDome.scale.set(0.8, 0.45, 0.95);
    powerDome.position.set(0, 0.71, 1.32);
    bodyPivot.add(powerDome);
  } else if (bodyStyle === 'porsche') {
    const rearGrille = new THREE.Mesh(hyperLouversGeo, carbonMat);
    rearGrille.scale.set(0.88, 0.7, 0.65);
    rearGrille.position.set(0, 0.74, -1.68);
    bodyPivot.add(rearGrille);
  } else if (bodyStyle === 'nissan') {
    const grille = new THREE.Mesh(gtrGrilleGeo, carbonMat);
    grille.position.set(0, 0.39, 2.24);
    bodyPivot.add(grille);
    for (const sx of [-0.66, -0.40, 0.40, 0.66]) {
      const ring = new THREE.Mesh(quadTailRingGeo, brakeLightMat);
      ring.position.set(sx, 0.63, -2.28);
      bodyPivot.add(ring);
    }
  } else if (bodyStyle === 'muscle') {
    const scoop = new THREE.Mesh(muscleScoopGeo, carbonMat);
    scoop.position.set(0, 0.83, 1.34);
    bodyPivot.add(scoop);
  }

  // Livery stripes
  if (livery === 'stripe') {
    const hoodStripe = new THREE.Mesh(hoodSingleStripeGeo, accentMat);
    hoodStripe.position.set(0, spec.hoodY, 1.36);
    hoodStripe.rotation.x = spec.hoodSlope;
    bodyPivot.add(hoodStripe);

    const roofStripe = new THREE.Mesh(roofSingleStripeGeo, accentMat);
    roofStripe.position.set(0, spec.roofTopY, -0.15);
    bodyPivot.add(roofStripe);
  } else if (livery === 'twin') {
    for (const sx of [-0.22, 0.22]) {
      const hStripe = new THREE.Mesh(hoodTwinStripeGeo, accentMat);
      hStripe.position.set(sx, spec.hoodY, 1.36);
      hStripe.rotation.x = spec.hoodSlope;
      bodyPivot.add(hStripe);

      const rStripe = new THREE.Mesh(roofTwinStripeGeo, accentMat);
      rStripe.position.set(sx, spec.roofTopY, -0.15);
      bodyPivot.add(rStripe);
    }
  }

  // Aero splitter + side skirts + rear diffuser
  const splitter = new THREE.Mesh(splitterGeo, carbonMat);
  splitter.position.set(0, spec.splitterY, 0);
  splitter.castShadow = enableShadows;
  bodyPivot.add(splitter);

  const diffuser = new THREE.Mesh(rearDiffuserGeo, carbonMat);
  diffuser.position.set(0, 0.26, -2.24);
  bodyPivot.add(diffuser);

  // Customizable rear spoiler
  if (spoilerStyle === 'gt-wing') {
    const wingBlade = new THREE.Mesh(wingBladeGeo, carbonMat);
    wingBlade.position.set(0, spec.deckY + 0.28, -2.02);
    wingBlade.rotation.x = 0.12;
    wingBlade.castShadow = enableShadows;
    bodyPivot.add(wingBlade);

    for (const sx of [-0.54, 0.54]) {
      const pylon = new THREE.Mesh(wingPylonGeo, accentMat);
      pylon.position.set(sx, spec.deckY + 0.12, -1.98);
      bodyPivot.add(pylon);
    }
  } else if (spoilerStyle === 'ducktail') {
    const ducktail = new THREE.Mesh(ducktailGeo, accentMat);
    ducktail.position.set(0, spec.deckY + 0.04, -2.14);
    ducktail.rotation.x = -0.35;
    bodyPivot.add(ducktail);
  }

  // Headlights & full-width rear taillight strip
  for (const sx of [-0.66, 0.66]) {
    const hl = new THREE.Mesh(headlightGeo, headlightMat);
    hl.position.set(sx, spec.hlY, spec.hlZ);
    hl.rotation.y = sx > 0 ? -0.15 : 0.15;
    bodyPivot.add(hl);
  }

  if (bodyStyle !== 'nissan') {
    const tailBar = new THREE.Mesh(taillightGeo, brakeLightMat);
    tailBar.position.set(0, spec.tailY, -2.28);
    bodyPivot.add(tailBar);
  }

  // Dual exhaust pipes + dual-core nitro flame cones
  const nitroFlames: THREE.Mesh[] = [];
  const activeFlameGeo = flameConeGeoByTier[detail];
  for (const sx of [-0.46, 0.46]) {
    const pipe = new THREE.Mesh(exhaustPipeGeo, rimMat);
    pipe.position.set(sx, 0.27, -2.28);
    bodyPivot.add(pipe);

    const outerFlame = new THREE.Mesh(activeFlameGeo, nitroGlowMat);
    outerFlame.position.set(sx, 0.27, -2.32);
    outerFlame.visible = false;
    bodyPivot.add(outerFlame);

    const innerFlame = new THREE.Mesh(activeFlameGeo, nitroCoreMat);
    innerFlame.scale.set(0.5, 0.5, 0.65);
    outerFlame.add(innerFlame);

    nitroFlames.push(outerFlame);
  }

  // 4 Wheel assemblies (grounded at y = 0.36m)
  const trackHalf = spec.trackHalf;
  const wheelPositions: Array<{ x: number; z: number; isFront: boolean }> = [
    { x: trackHalf, z: 1.38, isFront: true },
    { x: -trackHalf, z: 1.38, isFront: true },
    { x: trackHalf + 0.02, z: -1.36, isFront: false },
    { x: -(trackHalf + 0.02), z: -1.36, isFront: false },
  ];

  const frontLeftSteer = new THREE.Group();
  const frontRightSteer = new THREE.Group();
  const wheelMeshes: THREE.Group[] = [];
  const activeTireGeo = tireGeoByTier[detail];
  const activeRimGeo = rimGeoByTier[detail];

  wheelPositions.forEach((wp, idx) => {
    const steerGroup =
      idx === 0 ? frontLeftSteer : idx === 1 ? frontRightSteer : new THREE.Group();
    steerGroup.position.set(wp.x, 0.36, wp.z);
    root.add(steerGroup);

    const spinGroup = new THREE.Group();
    steerGroup.add(spinGroup);

    const tire = new THREE.Mesh(activeTireGeo, tireMat);
    tire.castShadow = enableShadows;
    spinGroup.add(tire);

    const rim = new THREE.Mesh(activeRimGeo, rimMat);
    spinGroup.add(rim);

    if (!isSimple) {
      for (let s = 0; s < 3; s++) {
        const spoke = new THREE.Mesh(spokeGeo, accentMat);
        spoke.rotation.x = (s * Math.PI) / 3;
        spinGroup.add(spoke);
      }

      const disc = new THREE.Mesh(brakeDiscGeo, accentMat);
      disc.position.x = wp.x > 0 ? -0.06 : 0.06;
      steerGroup.add(disc);
    }

    if (isHigh) {
      const caliper = new THREE.Mesh(brakeCaliperGeo, brakeLightMat);
      caliper.position.set(wp.x > 0 ? 0.07 : -0.07, 0.08, -0.14);
      steerGroup.add(caliper);
    }

    wheelMeshes.push(spinGroup);
  });

  // Ground contact shadow & projected headlight beam
  const contactShadow = new THREE.Mesh(contactShadowGeo, shadowMat);
  contactShadow.position.set(0, 0.055, 0);
  contactShadow.renderOrder = 2;
  root.add(contactShadow);

  if (!isSimple) {
    const headlightPool = new THREE.Mesh(headlightPoolGeo, headlightBeamMat);
    headlightPool.position.set(0, 0.058, 6.4);
    headlightPool.renderOrder = 3;
    root.add(headlightPool);
  }

  return {
    root,
    bodyPivot,
    frontLeftSteer,
    frontRightSteer,
    wheelMeshes,
    brakeLightMat,
    nitroFlames,
    nitroGlowMat,
    headlightBeamMat,
    scratchMat,
    lightbarRedMat,
    lightbarBlueMat,
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
