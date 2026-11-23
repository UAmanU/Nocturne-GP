import * as THREE from 'three';
import type { RaceTrack } from './track';
import { getGraphicsProfile, type GraphicsQuality } from './graphics';
import type {
  ConstructionHazardVehicle,
  SandPatchState,
  WreckingBallState,
} from './types';

export interface ConstructionFeaturesSystem {
  group: THREE.Group;
  syncHazards: (
    vehicles: ConstructionHazardVehicle[],
    wreckingBall: WreckingBallState | null,
    elapsed: number
  ) => void;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

function createHazardStripeTexture(
  maxAnisotropy: number,
  sizeScale = 1
): THREE.CanvasTexture {
  const w = Math.max(64, Math.round(256 * sizeScale));
  const h = Math.max(32, Math.round(64 * sizeScale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (w !== 256 || h !== 64) ctx.scale(w / 256, h / 64);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#0f172a';
  for (let x = -64; x < 320; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 24, 0);
    ctx.lineTo(x + 56, 64);
    ctx.lineTo(x + 32, 64);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSiteBannerTexture(
  maxAnisotropy: number,
  sizeScale = 1
): THREE.CanvasTexture {
  const w = Math.max(128, Math.round(512 * sizeScale));
  const h = Math.max(32, Math.round(128 * sizeScale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (w !== 512 || h !== 128) ctx.scale(w / 512, h / 128);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, 512, 16);
  ctx.fillRect(0, 112, 512, 16);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('METRO TOWER CONSTRUCTION', 256, 52);
  ctx.fillStyle = '#f97316';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('HARD HAT & HEAVY MACHINERY ZONE', 256, 88);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSandDriftTexture(
  maxAnisotropy: number,
  sizeScale = 1
): THREE.CanvasTexture {
  const dim = Math.max(64, Math.round(256 * sizeScale));
  const canvas = document.createElement('canvas');
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d')!;
  if (dim !== 256) ctx.scale(dim / 256, dim / 256);
  ctx.clearRect(0, 0, 256, 256);

  // Soft radial rich yellow construction sand pile
  const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 124);
  grad.addColorStop(0, 'rgba(250, 204, 21, 1)');
  grad.addColorStop(0.62, 'rgba(245, 194, 42, 0.98)');
  grad.addColorStop(0.88, 'rgba(234, 179, 8, 0.78)');
  grad.addColorStop(1, 'rgba(234, 179, 8, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const grainCount = sizeScale < 1 ? 600 : 1600;
  for (let i = 0; i < grainCount; i++) {
    const ang = (i * 2.3999) % (Math.PI * 2);
    const rad = Math.sqrt((i % 900) / 900) * 112;
    const x = 128 + Math.cos(ang) * rad;
    const y = 128 + Math.sin(ang) * rad;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(254, 240, 138, 0.65)' : 'rgba(202, 138, 4, 0.45)';
    ctx.fillRect(x, y, 3, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function buildSkyscraperUnderConstruction(
  centerX: number,
  centerZ: number,
  floors: number,
  width: number,
  depth: number,
  floorHeight: number,
  mats: {
    concreteMat: THREE.Material;
    steelMat: THREE.Material;
    safetyNetMat: THREE.Material;
    hazardMat: THREE.Material;
    bannerMat: THREE.Material;
  },
  options: { showBanners: boolean; enableShadows: boolean },
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const tower = new THREE.Group();
  tower.position.set(centerX, 0, centerZ);

  const slabGeo = new THREE.BoxGeometry(width, 0.55, depth);
  const colGeo = new THREE.BoxGeometry(0.85, floors * floorHeight + 3.5, 0.85);
  const coreGeo = new THREE.BoxGeometry(width * 0.34, floors * floorHeight + 4.5, depth * 0.34);
  const rebarGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.6, 5);
  const barrierGeo = new THREE.BoxGeometry(width + 3.2, 1.3, 0.45);
  const barrierSideGeo = new THREE.BoxGeometry(0.45, 1.3, depth + 3.2);
  const netBandGeo = new THREE.BoxGeometry(width + 0.35, 1.4, depth + 0.35);
  const roofScaffoldGeo = new THREE.BoxGeometry(width * 0.85, 0.3, 0.3);
  disposables.push(
    slabGeo,
    colGeo,
    coreGeo,
    rebarGeo,
    barrierGeo,
    barrierSideGeo,
    netBandGeo,
    roofScaffoldGeo
  );

  // Central concrete elevator core
  const core = new THREE.Mesh(coreGeo, mats.concreteMat);
  core.position.y = (floors * floorHeight + 4.5) * 0.5;
  core.castShadow = options.enableShadows;
  core.receiveShadow = options.enableShadows;
  tower.add(core);

  // Perimeter structural steel I-beam columns (4x4 grid)
  const colsX = [-width * 0.46, -width * 0.16, width * 0.16, width * 0.46];
  const colsZ = [-depth * 0.46, -depth * 0.16, depth * 0.16, depth * 0.46];
  for (const cx of colsX) {
    for (const cz of colsZ) {
      if (Math.abs(cx) < width * 0.2 && Math.abs(cz) < depth * 0.2) continue;
      const col = new THREE.Mesh(colGeo, mats.steelMat);
      col.position.set(cx, (floors * floorHeight + 3.5) * 0.5, cz);
      col.castShadow = options.enableShadows;
      tower.add(col);
    }
  }

  // Floor slabs + orange safety netting on upper unfinished stories
  for (let f = 1; f <= floors; f++) {
    const y = f * floorHeight;
    const slab = new THREE.Mesh(slabGeo, mats.concreteMat);
    slab.position.y = y;
    slab.castShadow = options.enableShadows;
    slab.receiveShadow = options.enableShadows;
    tower.add(slab);

    if (f >= floors - 3 && f < floors) {
      const net = new THREE.Mesh(netBandGeo, mats.safetyNetMat);
      net.position.y = y + 1.0;
      tower.add(net);
    }
  }

  // Exposed vertical steel rebar rods poking from top unfinished floor
  const topY = floors * floorHeight;
  for (const rx of [-width * 0.42, 0, width * 0.42]) {
    for (const rz of [-depth * 0.42, 0, depth * 0.42]) {
      const rod = new THREE.Mesh(rebarGeo, mats.steelMat);
      rod.position.set(rx, topY + 1.8, rz);
      tower.add(rod);
    }
  }

  // Scaffolding crossbars on unfinished top
  for (const sx of [-width * 0.46, width * 0.46]) {
    const bar = new THREE.Mesh(roofScaffoldGeo, mats.steelMat);
    bar.position.set(0, topY + 2.4, sx * (depth / width));
    tower.add(bar);
  }

  // Ground-level yellow/black construction perimeter fence & site sign
  for (const sz of [-depth * 0.5 - 1.6, depth * 0.5 + 1.6]) {
    const fence = new THREE.Mesh(barrierGeo, mats.hazardMat);
    fence.position.set(0, 0.65, sz);
    fence.castShadow = options.enableShadows;
    tower.add(fence);
  }
  for (const sx of [-width * 0.5 - 1.6, width * 0.5 + 1.6]) {
    const fence = new THREE.Mesh(barrierSideGeo, mats.hazardMat);
    fence.position.set(sx, 0.65, 0);
    fence.castShadow = options.enableShadows;
    tower.add(fence);
  }

  if (options.showBanners) {
    const signGeo = new THREE.PlaneGeometry(14, 3.5);
    const signMesh = new THREE.Mesh(signGeo, mats.bannerMat);
    signMesh.position.set(width * 0.5 + 1.9, 3.4, 0);
    signMesh.rotation.y = Math.PI / 2;
    tower.add(signMesh);
    disposables.push(signGeo);
  }

  return tower;
}

function buildTowerCraneRig(
  mats: {
    craneYellowMat: THREE.Material;
    steelMat: THREE.Material;
    concreteMat: THREE.Material;
    glassMat: THREE.Material;
    blackIronMat: THREE.Material;
    beaconRedMat: THREE.Material;
  },
  enableShadows: boolean,
  disposables: Array<{ dispose: () => void }>
): {
  craneRoot: THREE.Group;
  turretGroup: THREE.Group;
  ballGroup: THREE.Group;
  cableMesh: THREE.Mesh;
  groundWarningMesh: THREE.Mesh;
  beaconMesh: THREE.Mesh;
} {
  const craneRoot = new THREE.Group();
  const mastHeight = 76;
  const boomLength = 58.8;

  // Heavy concrete base pad + ballast blocks at (0, 0)
  const padGeo = new THREE.CylinderGeometry(8.5, 9.2, 0.7, 12);
  const ballastGeo = new THREE.BoxGeometry(2.8, 2.2, 2.8);
  const cornerPostGeo = new THREE.BoxGeometry(0.68, mastHeight, 0.68);
  const rungGeo = new THREE.BoxGeometry(3.8, 0.34, 0.34);
  const apexGeo = new THREE.ConeGeometry(2.5, 7.2, 4);
  const cabGeo = new THREE.BoxGeometry(2.8, 3.1, 3.6);
  const cabWindowGeo = new THREE.BoxGeometry(2.88, 1.7, 1.6);
  const mainBoomGeo = new THREE.BoxGeometry(2.7, 2.7, boomLength + 3.0);
  const counterJibGeo = new THREE.BoxGeometry(2.5, 2.3, 16.5);
  const counterweightGeo = new THREE.BoxGeometry(3.2, 3.6, 4.8);
  const stayCableGeo = new THREE.CylinderGeometry(0.14, 0.14, 1, 6);
  const ballGeo = new THREE.SphereGeometry(4.2, 22, 18);
  const shackleGeo = new THREE.CylinderGeometry(0.55, 0.72, 1.2, 10);
  const warningRingGeo = new THREE.RingGeometry(3.2, 4.6, 28);
  warningRingGeo.rotateX(-Math.PI / 2);
  const beaconGeo = new THREE.SphereGeometry(0.62, 10, 8);

  const warningMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  disposables.push(
    padGeo,
    ballastGeo,
    cornerPostGeo,
    rungGeo,
    apexGeo,
    cabGeo,
    cabWindowGeo,
    mainBoomGeo,
    counterJibGeo,
    counterweightGeo,
    stayCableGeo,
    ballGeo,
    shackleGeo,
    warningRingGeo,
    beaconGeo,
    warningMat
  );

  const pad = new THREE.Mesh(padGeo, mats.concreteMat);
  pad.position.y = 0.35;
  pad.receiveShadow = enableShadows;
  craneRoot.add(pad);

  for (const bx of [-2.4, 2.4]) {
    for (const bz of [-2.4, 2.4]) {
      const block = new THREE.Mesh(ballastGeo, mats.concreteMat);
      block.position.set(bx, 1.6, bz);
      block.castShadow = enableShadows;
      craneRoot.add(block);
    }
  }

  // 4 Yellow vertical mast corner columns
  for (const mx of [-1.6, 1.6]) {
    for (const mz of [-1.6, 1.6]) {
      const col = new THREE.Mesh(cornerPostGeo, mats.craneYellowMat);
      col.position.set(mx, mastHeight * 0.5, mz);
      col.castShadow = enableShadows;
      craneRoot.add(col);
    }
  }

  // Horizontal & alternating mast lattice rungs
  for (let y = 4; y <= mastHeight - 2; y += 3.6) {
    const rungFront = new THREE.Mesh(rungGeo, mats.craneYellowMat);
    rungFront.position.set(0, y, 1.6);
    const rungBack = new THREE.Mesh(rungGeo, mats.craneYellowMat);
    rungBack.position.set(0, y, -1.6);
    const rungLeft = new THREE.Mesh(rungGeo, mats.craneYellowMat);
    rungLeft.position.set(-1.6, y, 0);
    rungLeft.rotation.y = Math.PI / 2;
    const rungRight = new THREE.Mesh(rungGeo, mats.craneYellowMat);
    rungRight.position.set(1.6, y, 0);
    rungRight.rotation.y = Math.PI / 2;
    craneRoot.add(rungFront, rungBack, rungLeft, rungRight);
  }

  // Rotating Upper Turret & Boom
  const turretGroup = new THREE.Group();
  turretGroup.position.set(0, mastHeight, 0);
  craneRoot.add(turretGroup);

  const apex = new THREE.Mesh(apexGeo, mats.craneYellowMat);
  apex.position.y = 3.1;
  apex.rotation.y = Math.PI / 4;
  turretGroup.add(apex);

  const beaconMesh = new THREE.Mesh(beaconGeo, mats.beaconRedMat);
  beaconMesh.position.y = 6.45;
  turretGroup.add(beaconMesh);

  // Main horizontal boom extends along +Z in turret local coordinates
  const boom = new THREE.Mesh(mainBoomGeo, mats.craneYellowMat);
  boom.position.set(0, 0.4, boomLength * 0.5);
  turretGroup.add(boom);

  // Counter-jib + heavy concrete counterweights along -Z
  const counterJib = new THREE.Mesh(counterJibGeo, mats.craneYellowMat);
  counterJib.position.set(0, 0.4, -7.8);
  turretGroup.add(counterJib);

  const counterweight = new THREE.Mesh(counterweightGeo, mats.concreteMat);
  counterweight.position.set(0, -0.5, -13.2);
  turretGroup.add(counterweight);

  // Operator cab on side of mast collar
  const cab = new THREE.Mesh(cabGeo, mats.craneYellowMat);
  cab.position.set(2.1, -0.5, 1.4);
  const cabWindow = new THREE.Mesh(cabWindowGeo, mats.glassMat);
  cabWindow.position.set(2.1, -0.1, 2.4);
  turretGroup.add(cab, cabWindow);

  // Diagonal guy stays from apex to boom & counter-jib
  const frontStay = new THREE.Mesh(stayCableGeo, mats.steelMat);
  frontStay.scale.set(1, 42, 1);
  frontStay.position.set(0, 3.2, 21);
  frontStay.rotation.x = Math.PI / 2 - 0.14;
  const backStay = new THREE.Mesh(stayCableGeo, mats.steelMat);
  backStay.scale.set(1, 14.5, 1);
  backStay.position.set(0, 3.2, -6.5);
  backStay.rotation.x = -(Math.PI / 2 - 0.36);
  turretGroup.add(frontStay, backStay);

  // Black Wrecking Ball Sphere (world-positioned directly from simulation state)
  const ballGroup = new THREE.Group();
  const ballMesh = new THREE.Mesh(ballGeo, mats.blackIronMat);
  ballMesh.castShadow = enableShadows;
  const shackleMesh = new THREE.Mesh(shackleGeo, mats.steelMat);
  shackleMesh.position.y = 3.9;
  ballGroup.add(ballMesh, shackleMesh);
  craneRoot.add(ballGroup);

  // Suspended Cable connecting boom tip to black wrecking ball
  const cableMesh = new THREE.Mesh(stayCableGeo, mats.steelMat);
  craneRoot.add(cableMesh);

  // Ground warning target ring directly underneath the black sphere
  const groundWarningMesh = new THREE.Mesh(warningRingGeo, warningMat);
  groundWarningMesh.position.y = 0.09;
  craneRoot.add(groundWarningMesh);

  return {
    craneRoot,
    turretGroup,
    ballGroup,
    cableMesh,
    groundWarningMesh,
    beaconMesh,
  };
}

function buildMachineryRig(
  kind: 'bulldozer' | 'excavator',
  mats: {
    machineYellowMat: THREE.Material;
    steelMat: THREE.Material;
    trackRubberMat: THREE.Material;
    glassMat: THREE.Material;
    beaconAmberMat: THREE.Material;
  },
  enableShadows: boolean,
  disposables: Array<{ dispose: () => void }>
): {
  root: THREE.Group;
  armGroup: THREE.Group;
  beaconMesh: THREE.Mesh;
} {
  const root = new THREE.Group();

  const treadGeo = new THREE.BoxGeometry(0.65, 0.85, 4.1);
  const chassisGeo = new THREE.BoxGeometry(2.1, 1.15, 3.3);
  const cabGeo = new THREE.BoxGeometry(1.55, 1.25, 1.55);
  const glassGeo = new THREE.BoxGeometry(1.61, 0.72, 1.3);
  const exhaustGeo = new THREE.CylinderGeometry(0.11, 0.13, 1.15, 8);
  const beaconGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.28, 8);
  disposables.push(treadGeo, chassisGeo, cabGeo, glassGeo, exhaustGeo, beaconGeo);

  for (const sx of [-1.12, 1.12]) {
    const tread = new THREE.Mesh(treadGeo, mats.trackRubberMat);
    tread.position.set(sx, 0.43, 0);
    tread.castShadow = enableShadows;
    root.add(tread);
  }

  const chassis = new THREE.Mesh(chassisGeo, mats.machineYellowMat);
  chassis.position.set(0, 1.12, -0.15);
  chassis.castShadow = enableShadows;
  chassis.receiveShadow = enableShadows;
  root.add(chassis);

  const cab = new THREE.Mesh(cabGeo, mats.machineYellowMat);
  cab.position.set(0, 2.25, -0.35);
  cab.castShadow = enableShadows;
  const cabGlass = new THREE.Mesh(glassGeo, mats.glassMat);
  cabGlass.position.set(0, 2.35, -0.32);
  root.add(cab, cabGlass);

  const exhaust = new THREE.Mesh(exhaustGeo, mats.steelMat);
  exhaust.position.set(0.62, 2.1, -1.35);
  root.add(exhaust);

  const beaconMesh = new THREE.Mesh(beaconGeo, mats.beaconAmberMat);
  beaconMesh.position.set(0, 3.02, -0.35);
  root.add(beaconMesh);

  const armGroup = new THREE.Group();
  root.add(armGroup);

  if (kind === 'bulldozer') {
    const bladeGeo = new THREE.BoxGeometry(3.55, 1.18, 0.42);
    const armBeamGeo = new THREE.BoxGeometry(0.28, 0.28, 1.9);
    disposables.push(bladeGeo, armBeamGeo);

    const blade = new THREE.Mesh(bladeGeo, mats.steelMat);
    blade.position.set(0, 0.65, 2.35);
    armGroup.add(blade);

    for (const bx of [-1.05, 1.05]) {
      const arm = new THREE.Mesh(armBeamGeo, mats.machineYellowMat);
      arm.position.set(bx, 0.62, 1.35);
      armGroup.add(arm);
    }
  } else {
    // Articulated hydraulic excavator boom + stick + toothed steel bucket
    const boomGeo = new THREE.BoxGeometry(0.46, 0.56, 2.9);
    const stickGeo = new THREE.BoxGeometry(0.38, 0.42, 2.2);
    const bucketGeo = new THREE.BoxGeometry(1.45, 0.95, 1.15);
    disposables.push(boomGeo, stickGeo, bucketGeo);

    armGroup.position.set(0, 1.55, 0.95);
    const boom = new THREE.Mesh(boomGeo, mats.machineYellowMat);
    boom.position.set(0, 1.05, 0.9);
    boom.rotation.x = -0.68;

    const stick = new THREE.Mesh(stickGeo, mats.machineYellowMat);
    stick.position.set(0, 1.15, 2.55);
    stick.rotation.x = 0.72;

    const bucket = new THREE.Mesh(bucketGeo, mats.steelMat);
    bucket.position.set(0, 0.15, 3.25);
    bucket.rotation.x = 0.35;

    armGroup.add(boom, stick, bucket);
  }

  return { root, armGroup, beaconMesh };
}

function buildDumpTruckRig(
  mats: {
    machineYellowMat: THREE.Material;
    steelMat: THREE.Material;
    trackRubberMat: THREE.Material;
    glassMat: THREE.Material;
    beaconAmberMat: THREE.Material;
    sandPileMat: THREE.Material;
  },
  enableShadows: boolean,
  disposables: Array<{ dispose: () => void }>
): {
  root: THREE.Group;
  bedGroup: THREE.Group;
  beaconMesh: THREE.Mesh;
} {
  const root = new THREE.Group();

  const wheelGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.65, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const frameGeo = new THREE.BoxGeometry(2.6, 0.75, 6.4);
  const cabGeo = new THREE.BoxGeometry(2.5, 1.85, 2.0);
  const windshieldGeo = new THREE.BoxGeometry(2.2, 0.85, 0.14);
  const bedGeo = new THREE.BoxGeometry(2.95, 1.45, 4.3);
  const sandLoadGeo = new THREE.ConeGeometry(1.5, 1.05, 8);
  const beaconGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.28, 8);
  disposables.push(
    wheelGeo,
    frameGeo,
    cabGeo,
    windshieldGeo,
    bedGeo,
    sandLoadGeo,
    beaconGeo
  );

  for (const wx of [-1.42, 1.42]) {
    for (const wz of [-2.1, 0.25, 2.0]) {
      const wheel = new THREE.Mesh(wheelGeo, mats.trackRubberMat);
      wheel.position.set(wx, 0.85, wz);
      wheel.castShadow = enableShadows;
      root.add(wheel);
    }
  }

  const frame = new THREE.Mesh(frameGeo, mats.steelMat);
  frame.position.set(0, 1.15, 0);
  root.add(frame);

  const cab = new THREE.Mesh(cabGeo, mats.machineYellowMat);
  cab.position.set(0, 2.38, 2.15);
  cab.castShadow = enableShadows;
  const windshield = new THREE.Mesh(windshieldGeo, mats.glassMat);
  windshield.position.set(0, 2.65, 3.16);
  const beaconMesh = new THREE.Mesh(beaconGeo, mats.beaconAmberMat);
  beaconMesh.position.set(0, 3.44, 2.15);
  root.add(cab, windshield, beaconMesh);

  const bedGroup = new THREE.Group();
  bedGroup.position.set(0, 1.55, -2.5);
  const bed = new THREE.Mesh(bedGeo, mats.machineYellowMat);
  bed.position.set(0, 0.72, 1.6);
  bed.castShadow = enableShadows;
  const sandLoad = new THREE.Mesh(sandLoadGeo, mats.sandPileMat);
  sandLoad.scale.set(1.05, 1, 1.45);
  sandLoad.position.set(0, 1.55, 1.6);
  bedGroup.add(bed, sandLoad);
  root.add(bedGroup);

  return { root, bedGroup, beaconMesh };
}

function buildSecondaryTowerCrane(
  height: number,
  boomLength: number,
  mats: {
    craneYellowMat: THREE.Material;
    concreteMat: THREE.Material;
    steelMat: THREE.Material;
  },
  enableShadows: boolean,
  disposables: Array<{ dispose: () => void }>
): { root: THREE.Group; turret: THREE.Group } {
  const root = new THREE.Group();
  const baseGeo = new THREE.BoxGeometry(5.2, 1.2, 5.2);
  const mastGeo = new THREE.BoxGeometry(2.2, height, 2.2);
  const boomGeo = new THREE.BoxGeometry(1.7, 1.7, boomLength);
  const counterGeo = new THREE.BoxGeometry(2.2, 2.4, 3.8);
  const cableGeo = new THREE.CylinderGeometry(0.1, 0.1, 18, 6);
  const hookBlockGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
  disposables.push(baseGeo, mastGeo, boomGeo, counterGeo, cableGeo, hookBlockGeo);

  const base = new THREE.Mesh(baseGeo, mats.concreteMat);
  base.position.y = 0.6;
  const mast = new THREE.Mesh(mastGeo, mats.craneYellowMat);
  mast.position.y = height * 0.5;
  mast.castShadow = enableShadows;
  root.add(base, mast);

  const turret = new THREE.Group();
  turret.position.y = height;
  const boom = new THREE.Mesh(boomGeo, mats.craneYellowMat);
  boom.position.set(0, 0.4, boomLength * 0.32);
  boom.castShadow = enableShadows;
  const counter = new THREE.Mesh(counterGeo, mats.concreteMat);
  counter.position.set(0, -0.3, -boomLength * 0.22);
  const cable = new THREE.Mesh(cableGeo, mats.steelMat);
  cable.position.set(0, -9, boomLength * 0.68);
  const hook = new THREE.Mesh(hookBlockGeo, mats.steelMat);
  hook.position.set(0, -18, boomLength * 0.68);
  turret.add(boom, counter, cable, hook);
  root.add(turret);

  return { root, turret };
}

export function buildConstructionFeatures(
  track: RaceTrack,
  sandPatches: SandPatchState[],
  initialVehicles: ConstructionHazardVehicle[],
  maxAnisotropy: number,
  isSoftwareGl: boolean,
  envRand: () => number,
  isClearOfTrack: (x: number, z: number, radius: number) => boolean,
  graphicsQuality: GraphicsQuality = 'medium'
): ConstructionFeaturesSystem {
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

  const hazardTex = createHazardStripeTexture(aniso, texScale);
  const bannerTex = createSiteBannerTexture(aniso, texScale);
  const sandTex = createSandDriftTexture(aniso, texScale);
  disposables.push(hazardTex, bannerTex, sandTex);

  const mats = {
    concreteMat: makeMat({
      color: 0x94a3b8,
      roughness: 0.88,
      metalness: 0.06,
    }),
    steelMat: makeMat({
      color: 0x334155,
      roughness: 0.42,
      metalness: 0.76,
    }),
    safetyNetMat: makeMat({
      color: 0xf97316,
      roughness: 0.65,
      metalness: 0.05,
      transparent: true,
      opacity: 0.84,
    }),
    hazardMat: makeMat({
      color: 0xffffff,
      map: hazardTex,
      roughness: 0.55,
      metalness: 0.12,
    }),
    bannerMat: makeMat({
      color: 0xffffff,
      map: bannerTex,
      roughness: 0.4,
    }),
    craneYellowMat: makeMat({
      color: 0xfacc15,
      roughness: 0.34,
      metalness: 0.38,
    }),
    machineYellowMat: makeMat({
      color: 0xeab308,
      roughness: 0.36,
      metalness: 0.32,
    }),
    trackRubberMat: makeMat({
      color: 0x111827,
      roughness: 0.88,
      metalness: 0.12,
    }),
    glassMat: makeMat({
      color: 0x38bdf8,
      roughness: 0.14,
      metalness: 0.8,
    }),
    blackIronMat: makeMat({
      color: 0x0b0f19,
      roughness: 0.32,
      metalness: 0.62,
    }),
    beaconRedMat: makeMat({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 2.0,
      roughness: 0.2,
    }),
    beaconAmberMat: makeMat({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.0,
      roughness: 0.2,
    }),
    sandPileMat: makeMat({
      color: 0xf5c838,
      roughness: 0.94,
      metalness: 0.0,
    }),
  };
  Object.values(mats).forEach((m) => disposables.push(m));

  const towerOptions = { showBanners: profile.showBanners, enableShadows };

  // 1. Primary Hero Skyscraper Under Construction right next to the Start/Finish Street
  const mainTower = buildSkyscraperUnderConstruction(
    -246,
    -30,
    13,
    34,
    40,
    5.6,
    mats,
    towerOptions,
    disposables
  );
  group.add(mainTower);

  // Additional half-built mid-rise towers & skyscrapers around the street construction site
  const secondaryBuilds = [
    { x: 243, z: -132, floors: 9, w: 24, d: 24 },
    { x: 228, z: 138, floors: 8, w: 22, d: 26 },
    { x: -51, z: -252, floors: 10, w: 26, d: 22 },
    { x: -243, z: 183, floors: 8, w: 24, d: 24 },
    { x: 51, z: 234, floors: 10, w: 26, d: 24 },
    { x: -144, z: -246, floors: 9, w: 24, d: 22 },
  ];
  for (const sb of secondaryBuilds) {
    if (isClearOfTrack(sb.x, sb.z, Math.hypot(sb.w, sb.d) * 0.5)) {
      const t = buildSkyscraperUnderConstruction(
        sb.x,
        sb.z,
        sb.floors,
        sb.w,
        sb.d,
        5.0,
        mats,
        towerOptions,
        disposables
      );
      group.add(t);
    }
  }

  // Detailed Surrounding Urban Background Buildings (Multi-Tier Facades, Windows, Cornices, Rooftop HVAC & Antennas)
  const createBackdropFacadeTex = (): THREE.CanvasTexture => {
    const w = Math.max(64, Math.round(256 * texScale));
    const h = Math.max(128, Math.round(512 * texScale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    if (w !== 256 || h !== 512) ctx.scale(w / 256, h / 512);

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, 256, 512);

    const rows = 14;
    const cols = 6;
    const cw = 256 / cols;
    const ch = 512 / rows;
    for (let r = 0; r < rows; r++) {
      // Concrete floor spandrel cornice line
      ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
      ctx.fillRect(0, r * ch, 256, 5);
      for (let c = 0; c < cols; c++) {
        const wx = c * cw + 6;
        const wy = r * ch + 9;
        const ww = cw - 12;
        const wh = ch - 16;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
        ctx.fillStyle = (r * 5 + c * 3) % 7 === 0 ? '#64748b' : '#1e3a5f';
        ctx.fillRect(wx, wy, ww, wh);
        // Sunlit glass sky highlight
        ctx.fillStyle = 'rgba(186, 230, 253, 0.42)';
        ctx.fillRect(wx + 2, wy + 2, ww * 0.45, wh * 0.62);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = aniso;
    return tex;
  };

  const backdropTex = createBackdropFacadeTex();
  const cityBlockGeo = new THREE.BoxGeometry(1, 1, 1);
  cityBlockGeo.translate(0, 0.5, 0);
  const cityBlockMat = makeMat({
    color: 0xffffff,
    map: backdropTex,
    roughness: 0.52,
    metalness: 0.18,
  });
  const blockRoofMat = makeMat({
    color: 0x334155,
    roughness: 0.85,
    metalness: 0.14,
  });
  const blockPodiumMat = makeMat({
    color: 0x1e293b,
    roughness: 0.72,
    metalness: 0.22,
  });
  const blockRimMat = makeMat({
    color: 0xffffff,
    roughness: 0.58,
    metalness: 0.25,
  });
  const blockColors = [
    0xd6d3d1, // warm limestone
    0xcbd5e1, // urban concrete
    0x94a3b8, // cool granite
    0xd97706, // warm brick terracotta (softened below via lerp)
    0x7dd3fc, // blue-glass office block
  ];
  const cityBlocks: Array<{
    x: number;
    z: number;
    w: number;
    h: number;
    d: number;
    rot: number;
    c: THREE.Color;
    rim: THREE.Color;
  }> = [];

  for (let gx = -390; gx <= 390; gx += 34) {
    for (let gz = -390; gz <= 390; gz += 34) {
      const x = gx + (envRand() - 0.5) * 8;
      const z = gz + (envRand() - 0.5) * 8;
      const dist = Math.hypot(x, z);
      if (dist < 205 || dist > 430) continue;
      if (Math.hypot(x + 246, z + 30) < 42) continue;
      if (secondaryBuilds.some((sb) => Math.hypot(x - sb.x, z - sb.z) < 32)) continue;
      if (envRand() < (simpleMat ? 0.58 : 0.2)) continue;
      const w = 15 + envRand() * 11;
      const d = 15 + envRand() * 11;
      if (!isClearOfTrack(x, z, Math.hypot(w, d) * 0.5 + 1.5)) continue;
      const baseHex = blockColors[Math.floor(envRand() * blockColors.length)];
      const col = new THREE.Color(baseHex);
      if (baseHex === 0xd97706) col.lerp(new THREE.Color(0xcbd5e1), 0.35);
      const rim = col.clone().multiplyScalar(0.62);
      cityBlocks.push({
        x,
        z,
        w,
        d,
        h: 18 + envRand() * 42,
        rot: Math.floor(envRand() * 4) * (Math.PI / 2),
        c: col,
        rim,
      });
    }
  }
  const dummy = new THREE.Object3D();
  if (cityBlocks.length > 0) {
    const blockInst = new THREE.InstancedMesh(
      cityBlockGeo,
      [cityBlockMat, cityBlockMat, blockRoofMat, blockRoofMat, cityBlockMat, cityBlockMat],
      cityBlocks.length
    );
    blockInst.castShadow = enableShadows;
    blockInst.receiveShadow = enableShadows;
    const podiumGeo = new THREE.BoxGeometry(1.04, 4.2, 1.04);
    podiumGeo.translate(0, 2.1, 0);
    const podiumInst = new THREE.InstancedMesh(podiumGeo, blockPodiumMat, cityBlocks.length);
    podiumInst.castShadow = enableShadows;

    const upperTierInst = new THREE.InstancedMesh(
      cityBlockGeo,
      [cityBlockMat, cityBlockMat, blockRoofMat, blockRoofMat, cityBlockMat, cityBlockMat],
      cityBlocks.length
    );
    upperTierInst.castShadow = enableShadows;
    const roofRimGeo = new THREE.BoxGeometry(1.03, 0.7, 1.03);
    const roofRimInst = new THREE.InstancedMesh(roofRimGeo, blockRimMat, cityBlocks.length);

    const hvacGeo = new THREE.BoxGeometry(3.4, 2.1, 3.0);
    const hvacInst = new THREE.InstancedMesh(hvacGeo, blockRoofMat, cityBlocks.length);
    const antennaGeo = new THREE.CylinderGeometry(0.12, 0.24, 6.5, 6);
    const antennaInst = new THREE.InstancedMesh(antennaGeo, blockPodiumMat, cityBlocks.length);

    cityBlocks.forEach((b, idx) => {
      dummy.position.set(b.x, 0, b.z);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.updateMatrix();
      blockInst.setMatrixAt(idx, dummy.matrix);
      blockInst.setColorAt(idx, b.c);

      dummy.position.set(b.x, 0, b.z);
      dummy.scale.set(b.w, 1, b.d);
      dummy.updateMatrix();
      podiumInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(b.x, b.h - 0.35, b.z);
      dummy.scale.set(b.w, 1, b.d);
      dummy.updateMatrix();
      roofRimInst.setMatrixAt(idx, dummy.matrix);
      roofRimInst.setColorAt(idx, b.rim);

      const upperH = b.h > 28 ? b.h * 0.24 : 2.6;
      dummy.position.set(b.x, b.h, b.z);
      dummy.scale.set(b.w * 0.64, upperH, b.d * 0.64);
      dummy.updateMatrix();
      upperTierInst.setMatrixAt(idx, dummy.matrix);
      upperTierInst.setColorAt(idx, b.c);

      dummy.position.set(b.x + 2.2, b.h + upperH + 1.05, b.z - 1.6);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      hvacInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(b.x - 1.8, b.h + upperH + 3.25, b.z + 1.5);
      dummy.scale.setScalar(b.h > 34 ? 1 : 0.001);
      dummy.updateMatrix();
      antennaInst.setMatrixAt(idx, dummy.matrix);
    });

    const activeInsts = simpleMat
      ? [blockInst, podiumInst]
      : [blockInst, podiumInst, upperTierInst, roofRimInst, hvacInst, antennaInst];
    for (const inst of activeInsts) {
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.computeBoundingSphere();
      group.add(inst);
    }
    disposables.push(podiumGeo, roofRimGeo, hvacGeo, antennaGeo);
  }
  disposables.push(backdropTex, cityBlockGeo, cityBlockMat, blockRoofMat, blockPodiumMat, blockRimMat);

  // Orange Construction Cones & Stackable Pipe Props around central plaza and sidelines
  const coneGeo = new THREE.ConeGeometry(0.32, 0.92, 8);
  coneGeo.translate(0, 0.46, 0);
  const coneMat = makeMat({ color: 0xf97316, roughness: 0.45 });
  const conePositions: Array<[number, number]> = [];
  const coneCount = simpleMat ? 8 : 16;
  for (let i = 0; i < coneCount; i++) {
    const ang = (i / coneCount) * Math.PI * 2;
    conePositions.push([Math.cos(ang) * 14.5, Math.sin(ang) * 14.5]);
  }
  const coneInst = new THREE.InstancedMesh(coneGeo, coneMat, conePositions.length);
  coneInst.castShadow = enableShadows;
  conePositions.forEach(([cx, cz], idx) => {
    dummy.position.set(cx, 0, cz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    coneInst.setMatrixAt(idx, dummy.matrix);
  });
  coneInst.instanceMatrix.needsUpdate = true;
  coneInst.computeBoundingSphere();
  group.add(coneInst);
  disposables.push(coneGeo, coneMat);

  // Large & Plentiful Scattered Sand Mounds + Gravel Heaps + Ground Sand Aprons
  const containerGeo = new THREE.BoxGeometry(1, 1, 1);
  containerGeo.translate(0, 0.5, 0);
  const containerMat = makeMat({
    color: 0xffffff,
    roughness: 0.56,
    metalness: 0.35,
  });
  const stockpileGeo = new THREE.ConeGeometry(1, 1, simpleMat ? 8 : 14);
  stockpileGeo.translate(0, 0.5, 0);
  const stockpileMat = makeMat({
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.0,
  });
  const spilledApronGeo = new THREE.CylinderGeometry(0.92, 1.0, 0.16, simpleMat ? 8 : 16);
  spilledApronGeo.translate(0, 0.08, 0);
  const pipeGeo = new THREE.CylinderGeometry(1, 1, 1, simpleMat ? 8 : 12);
  pipeGeo.rotateX(Math.PI / 2);
  const steelBundleMat = makeMat({
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.72,
  });
  disposables.push(
    containerGeo,
    containerMat,
    stockpileGeo,
    stockpileMat,
    spilledApronGeo,
    pipeGeo,
    steelBundleMat
  );

  const yardContainers = [
    { x: -108, z: -36, w: 6.4, h: 2.8, d: 2.6, yaw: 0.15, color: 0xea580c },
    { x: -108, z: -36, w: 6.4, h: 2.8, d: 2.6, yaw: 0.22, y: 2.8, color: 0x0284c7 },
    { x: -114, z: 27, w: 6.4, h: 2.8, d: 2.6, yaw: -0.2, color: 0xfacc15 },
    { x: -96, z: 69, w: 8.4, h: 3.1, d: 3.2, yaw: 0.05, color: 0xe2e8f0 }, // Site office trailer
    { x: -87, z: -102, w: 6.4, h: 2.8, d: 2.6, yaw: 0.85, color: 0x334155 },
    { x: 69, z: -48, w: 6.4, h: 2.8, d: 2.6, yaw: -0.45, color: 0xea580c },
    { x: 114, z: -9, w: 6.4, h: 2.8, d: 2.6, yaw: 1.2, color: 0x0284c7 },
    { x: 96, z: 162, w: 7.2, h: 2.9, d: 2.8, yaw: 0.3, color: 0xfacc15 },
    { x: -243, z: 54, w: 7.2, h: 3.0, d: 3.0, yaw: 0.08, color: 0xea580c },
    { x: -243, z: 54, w: 7.2, h: 3.0, d: 3.0, yaw: 0.12, y: 3.0, color: 0x0284c7 },
    { x: 243, z: -51, w: 7.4, h: 3.0, d: 3.0, yaw: -0.5, color: 0xfacc15 },
  ];
  const validContainers = yardContainers.filter(
    (c, idx) => (!simpleMat || idx % 2 === 0) && isClearOfTrack(c.x, c.z, Math.max(c.w, c.d) * 0.65 + 2)
  );
  if (validContainers.length > 0) {
    const contInst = new THREE.InstancedMesh(
      containerGeo,
      containerMat,
      validContainers.length
    );
    contInst.castShadow = enableShadows;
    contInst.receiveShadow = enableShadows;
    validContainers.forEach((c, idx) => {
      dummy.position.set(c.x, c.y ?? 0, c.z);
      dummy.rotation.set(0, c.yaw, 0);
      dummy.scale.set(c.w, c.h, c.d);
      dummy.updateMatrix();
      contInst.setMatrixAt(idx, dummy.matrix);
      contInst.setColorAt(idx, new THREE.Color(c.color));
    });
    contInst.instanceMatrix.needsUpdate = true;
    if (contInst.instanceColor) contInst.instanceColor.needsUpdate = true;
    contInst.computeBoundingSphere();
    group.add(contInst);
  }

  // 34+ Large & Tall Scattered Sand Piles & Gravel Dunes across the enlarged construction site
  const rawSandMounds = [
    // Inner yard prominent bright yellow sand hills & spilled mounds
    { x: -117, z: -9, r: 12.0, h: 7.2, color: 0xfacc15 },
    { x: -96, z: -18, r: 9.0, h: 5.2, color: 0xf5c838 },
    { x: -84, z: 36, r: 12.8, h: 7.6, color: 0xfde047 },
    { x: -129, z: 72, r: 11.2, h: 6.4, color: 0xeab308 },
    { x: -108, z: 102, r: 13.0, h: 7.0, color: 0xfacc15 },
    { x: -69, z: 117, r: 10.8, h: 6.2, color: 0xf5c838 },
    { x: -66, z: -72, r: 9.8, h: 5.6, color: 0xfacc15 },
    { x: -132, z: -72, r: 11.6, h: 6.8, color: 0xfde047 },
    { x: 69, z: -18, r: 12.4, h: 7.4, color: 0xfacc15 },
    { x: 87, z: -27, r: 9.4, h: 5.5, color: 0xeab308 },
    { x: 57, z: -108, r: 12.0, h: 6.8, color: 0xf5c838 },
    { x: 96, z: -90, r: 10.6, h: 6.2, color: 0xfacc15 },
    { x: 126, z: -30, r: 9.8, h: 5.8, color: 0xfde047 },
    { x: 36, z: 108, r: 11.8, h: 6.6, color: 0xfacc15 },
    { x: 63, z: 129, r: 10.0, h: 5.6, color: 0xeab308 },
    { x: -36, z: 51, r: 9.6, h: 5.4, color: 0xf5c838 },
    // Outer perimeter giant construction yellow sand quarries
    { x: -252, z: 93, r: 14.5, h: 8.4, color: 0xfacc15 },
    { x: -237, z: 123, r: 12.0, h: 6.6, color: 0xf5c838 },
    { x: -246, z: -117, r: 13.8, h: 8.0, color: 0xfde047 },
    { x: -216, z: -177, r: 13.0, h: 7.4, color: 0xeab308 },
    { x: -138, z: -243, r: 14.0, h: 7.8, color: 0xfacc15 },
    { x: -18, z: -231, r: 13.2, h: 7.5, color: 0xf5c838 },
    { x: 72, z: -219, r: 13.6, h: 8.0, color: 0xfacc15 },
    { x: 177, z: -189, r: 14.8, h: 8.6, color: 0xfde047 },
    { x: 252, z: -63, r: 13.4, h: 7.6, color: 0xfacc15 },
    { x: 246, z: 39, r: 14.0, h: 7.8, color: 0xf5c838 },
    { x: 222, z: 81, r: 12.2, h: 6.8, color: 0xeab308 },
    { x: 156, z: 177, r: 14.2, h: 8.2, color: 0xfacc15 },
    { x: 63, z: 198, r: 13.0, h: 7.4, color: 0xf5c838 },
    { x: -51, z: 219, r: 14.4, h: 8.0, color: 0xfacc15 },
    { x: -174, z: 228, r: 13.2, h: 7.2, color: 0xfde047 },
    { x: -246, z: 174, r: 13.8, h: 7.8, color: 0xfacc15 },
  ];
  const yardPiles = rawSandMounds.filter(
    (p, idx) => (!simpleMat || idx % 2 === 0) && isClearOfTrack(p.x, p.z, p.r * 0.92 + 1.5)
  );
  if (yardPiles.length > 0) {
    const pileInst = new THREE.InstancedMesh(
      stockpileGeo,
      stockpileMat,
      yardPiles.length
    );
    pileInst.castShadow = enableShadows;
    pileInst.receiveShadow = enableShadows;
    const apronInst = new THREE.InstancedMesh(
      spilledApronGeo,
      stockpileMat,
      yardPiles.length
    );
    apronInst.receiveShadow = enableShadows;
    const cTemp = new THREE.Color();
    yardPiles.forEach((p, idx) => {
      cTemp.setHex(p.color);
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.set(0, idx * 0.7, 0);
      dummy.scale.set(p.r, p.h, p.r * 0.9);
      dummy.updateMatrix();
      pileInst.setMatrixAt(idx, dummy.matrix);
      pileInst.setColorAt(idx, cTemp);

      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.set(0, idx * 1.1, 0);
      dummy.scale.set(p.r * 1.32, 1.0, p.r * 1.24);
      dummy.updateMatrix();
      apronInst.setMatrixAt(idx, dummy.matrix);
      apronInst.setColorAt(idx, cTemp);
    });
    pileInst.instanceMatrix.needsUpdate = true;
    apronInst.instanceMatrix.needsUpdate = true;
    if (pileInst.instanceColor) pileInst.instanceColor.needsUpdate = true;
    if (apronInst.instanceColor) apronInst.instanceColor.needsUpdate = true;
    pileInst.computeBoundingSphere();
    apronInst.computeBoundingSphere();
    group.add(apronInst, pileInst);
  }

  // Giant & Plentiful Scattered Metals: Steel I-Beams, Heavy Pipes, Metal Plates & Trusses
  const metalBeamBoxes: Array<{
    x: number;
    y: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    rx: number;
    ry: number;
    rz: number;
    color: number;
  }> = [];
  const metalPipes: Array<{
    x: number;
    y: number;
    z: number;
    r: number;
    len: number;
    ry: number;
    color: number;
  }> = [];

  const girderStackSites = [
    { x: -123, z: -42, yaw: 0.14, len: 14.5 },
    { x: -96, z: -63, yaw: 0.65, len: 15.5 },
    { x: -84, z: 12, yaw: -0.35, len: 14.0 },
    { x: -132, z: 48, yaw: 1.48, len: 15.0 },
    { x: -93, z: 138, yaw: 0.42, len: 13.5 },
    { x: -51, z: -39, yaw: -0.78, len: 12.5 },
    { x: 72, z: -69, yaw: 0.72, len: 15.2 },
    { x: 117, z: 21, yaw: 1.45, len: 14.5 },
    { x: 81, z: 48, yaw: -0.5, len: 13.0 },
    { x: 12, z: 93, yaw: 0.25, len: 14.8 },
    // Outer site heavy steel depots
    { x: -243, z: 24, yaw: 0.08, len: 16.5 },
    { x: -246, z: -84, yaw: 0.22, len: 16.0 },
    { x: -186, z: -219, yaw: 0.95, len: 15.5 },
    { x: -102, z: -237, yaw: -0.25, len: 16.0 },
    { x: 36, z: -228, yaw: 0.4, len: 15.5 },
    { x: 144, z: -204, yaw: -0.65, len: 16.5 },
    { x: 243, z: -18, yaw: 1.52, len: 16.0 },
    { x: 234, z: 54, yaw: 1.12, len: 15.0 },
    { x: 192, z: 162, yaw: 0.78, len: 16.0 },
    { x: 33, z: 207, yaw: 0.12, len: 15.8 },
    { x: -102, z: 234, yaw: -0.18, len: 16.2 },
    { x: -234, z: 198, yaw: 0.62, len: 15.5 },
  ];

  const steelColors = [0x334155, 0x475569, 0x64748b, 0xb45309, 0xc2410c];
  girderStackSites.forEach((gs, sIdx) => {
    if (simpleMat && sIdx % 2 === 1) return;
    if (!isClearOfTrack(gs.x, gs.z, gs.len * 0.55 + 1.5)) return;
    const baseColor = steelColors[sIdx % steelColors.length];
    const cosY = Math.cos(gs.yaw);
    const sinY = Math.sin(gs.yaw);
    // 3x2 stacked big steel I-beams (0.95m x 0.9m cross section, 12-16m long)
    for (let row = 0; row < 2; row++) {
      const cols = row === 0 ? 3 : 2;
      for (let c = 0; c < cols; c++) {
        const lat = (c - (cols - 1) * 0.5) * 1.45;
        metalBeamBoxes.push({
          x: gs.x + cosY * lat,
          y: 0.55 + row * 1.05,
          z: gs.z - sinY * lat,
          sx: 0.92,
          sy: 0.92,
          sz: gs.len,
          rx: 0,
          ry: gs.yaw,
          rz: 0,
          color: baseColor,
        });
      }
    }
    // Loose angled spilled girder & heavy metal plate nearby
    metalBeamBoxes.push({
      x: gs.x + cosY * 3.1,
      y: 0.35,
      z: gs.z - sinY * 3.1,
      sx: 3.4,
      sy: 0.42,
      sz: 5.8,
      rx: 0.06,
      ry: gs.yaw + 0.38,
      rz: 0.04,
      color: steelColors[(sIdx + 2) % steelColors.length],
    });
  });

  // Large Steel Culvert Pipe Pyramids & Loose Metal Rolls across the site
  const pipeStackSites = [
    { x: -126, z: -96, yaw: 0.35 },
    { x: -96, z: 48, yaw: -0.42 },
    { x: -69, z: 87, yaw: 1.1 },
    { x: 96, z: -54, yaw: 0.6 },
    { x: 138, z: -6, yaw: 1.5 },
    { x: 63, z: 102, yaw: -0.7 },
    { x: -231, z: -3, yaw: 0.15 },
    { x: -237, z: -156, yaw: 0.85 },
    { x: -72, z: -222, yaw: -0.15 },
    { x: 129, z: -192, yaw: 0.95 },
    { x: 243, z: -93, yaw: 1.35 },
    { x: 219, z: 111, yaw: -0.45 },
    { x: 111, z: 192, yaw: 0.25 },
    { x: -36, z: 201, yaw: -0.35 },
    { x: -204, z: 216, yaw: 0.55 },
  ];
  pipeStackSites.forEach((ps, pIdx) => {
    if (simpleMat && pIdx % 2 === 1) return;
    if (!isClearOfTrack(ps.x, ps.z, 7.5)) return;
    const rad = 0.78;
    const len = 11.2;
    const cosY = Math.cos(ps.yaw);
    const sinY = Math.sin(ps.yaw);
    const pipeColor = pIdx % 2 === 0 ? 0x64748b : 0x94a3b8;
    // Bottom 3 pipes + top 2 pipes pyramid
    for (let i = -1; i <= 1; i++) {
      metalPipes.push({
        x: ps.x + cosY * (i * rad * 2.1),
        y: rad,
        z: ps.z - sinY * (i * rad * 2.1),
        r: rad,
        len,
        ry: ps.yaw,
        color: pipeColor,
      });
    }
    for (let i = -0.5; i <= 0.5; i += 1) {
      metalPipes.push({
        x: ps.x + cosY * (i * rad * 2.1),
        y: rad * 2.72,
        z: ps.z - sinY * (i * rad * 2.1),
        r: rad,
        len,
        ry: ps.yaw,
        color: pIdx % 3 === 0 ? 0xb45309 : 0x475569,
      });
    }
  });

  if (metalBeamBoxes.length > 0) {
    const beamInst = new THREE.InstancedMesh(
      containerGeo,
      steelBundleMat,
      metalBeamBoxes.length
    );
    beamInst.castShadow = enableShadows;
    beamInst.receiveShadow = enableShadows;
    const bColor = new THREE.Color();
    metalBeamBoxes.forEach((b, idx) => {
      bColor.setHex(b.color);
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(b.rx, b.ry, b.rz);
      dummy.scale.set(b.sx, b.sy, b.sz);
      dummy.updateMatrix();
      beamInst.setMatrixAt(idx, dummy.matrix);
      beamInst.setColorAt(idx, bColor);
    });
    beamInst.instanceMatrix.needsUpdate = true;
    if (beamInst.instanceColor) beamInst.instanceColor.needsUpdate = true;
    beamInst.computeBoundingSphere();
    group.add(beamInst);
  }

  if (metalPipes.length > 0) {
    const pipeInst = new THREE.InstancedMesh(
      pipeGeo,
      steelBundleMat,
      metalPipes.length
    );
    pipeInst.castShadow = enableShadows;
    pipeInst.receiveShadow = enableShadows;
    const pColor = new THREE.Color();
    metalPipes.forEach((p, idx) => {
      pColor.setHex(p.color);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.ry, 0);
      dummy.scale.set(p.r, p.r, p.len);
      dummy.updateMatrix();
      pipeInst.setMatrixAt(idx, dummy.matrix);
      pipeInst.setColorAt(idx, pColor);
    });
    pipeInst.instanceMatrix.needsUpdate = true;
    if (pipeInst.instanceColor) pipeInst.instanceColor.needsUpdate = true;
    pipeInst.computeBoundingSphere();
    group.add(pipeInst);
  }

  // 2. Central Tall Yellow Tower Crane + Black Wrecking Ball Sphere + 2 Flanking Tower Cranes
  const craneRig = buildTowerCraneRig(mats, enableShadows, disposables);
  group.add(craneRig.craneRoot);

  const secondaryCranes: Array<{ turret: THREE.Group; baseYaw: number; speed: number }> = [];
  for (const scSpec of [
    { x: -243, z: -72, h: 52, boom: 32, speed: 0.16, baseYaw: 0.7 },
    { x: 243, z: -90, h: 48, boom: 30, speed: -0.18, baseYaw: -0.9 },
  ]) {
    if (isClearOfTrack(scSpec.x, scSpec.z, 5.5)) {
      const sc = buildSecondaryTowerCrane(
        scSpec.h,
        scSpec.boom,
        mats,
        enableShadows,
        disposables
      );
      sc.root.position.set(scSpec.x, 0, scSpec.z);
      group.add(sc.root);
      secondaryCranes.push({
        turret: sc.turret,
        baseYaw: scSpec.baseYaw,
        speed: scSpec.speed,
      });
    }
  }

  // 2B. Off-Track Heavy Construction Machinery Fleet (Excavators, Bulldozers, Dump Trucks outside track)
  interface OffTrackMachine {
    kind: 'excavator' | 'bulldozer' | 'dumptruck';
    root: THREE.Group;
    animTarget: THREE.Group;
    beaconMesh: THREE.Mesh;
    anchorX: number;
    anchorZ: number;
    baseYaw: number;
    patrolRange: number;
    phase: number;
    speed: number;
  }
  const offTrackMachines: OffTrackMachine[] = [];

  const offTrackSpecs: Array<{
    kind: 'excavator' | 'bulldozer' | 'dumptruck';
    x: number;
    z: number;
    yaw: number;
    patrolRange: number;
    phase: number;
    speed: number;
  }> = [
    // Inner yard active fleet
    { kind: 'excavator', x: -123, z: 9, yaw: 1.2, patrolRange: 0, phase: 0.4, speed: 1.4 },
    { kind: 'bulldozer', x: -99, z: -27, yaw: 0.2, patrolRange: 7.5, phase: 1.1, speed: 0.65 },
    { kind: 'dumptruck', x: -108, z: 81, yaw: -0.8, patrolRange: 8.0, phase: 0.2, speed: 0.55 },
    { kind: 'excavator', x: -75, z: 54, yaw: -2.1, patrolRange: 0, phase: 1.8, speed: 1.3 },
    { kind: 'bulldozer', x: -114, z: -90, yaw: 0.9, patrolRange: 6.5, phase: 2.3, speed: 0.7 },
    { kind: 'excavator', x: 84, z: -30, yaw: 2.6, patrolRange: 0, phase: 0.9, speed: 1.5 },
    { kind: 'dumptruck', x: 63, z: -96, yaw: -1.4, patrolRange: 7.0, phase: 1.5, speed: 0.6 },
    { kind: 'bulldozer', x: 111, z: 6, yaw: -0.4, patrolRange: 6.0, phase: 2.9, speed: 0.68 },
    { kind: 'excavator', x: 48, z: 120, yaw: 0.6, patrolRange: 0, phase: 2.1, speed: 1.35 },
    // Outer site fleet alongside unfinished towers & earthworks
    { kind: 'dumptruck', x: -240, z: 72, yaw: 0.05, patrolRange: 9.0, phase: 0.8, speed: 0.5 },
    { kind: 'excavator', x: -234, z: -102, yaw: 1.5, patrolRange: 0, phase: 1.2, speed: 1.45 },
    { kind: 'bulldozer', x: -153, z: -231, yaw: 1.45, patrolRange: 8.5, phase: 0.5, speed: 0.62 },
    { kind: 'dumptruck', x: 57, z: -222, yaw: 1.6, patrolRange: 9.0, phase: 2.2, speed: 0.52 },
    { kind: 'excavator', x: 237, z: -72, yaw: -1.6, patrolRange: 0, phase: 2.7, speed: 1.3 },
    { kind: 'bulldozer', x: 234, z: 63, yaw: 0.15, patrolRange: 7.5, phase: 1.9, speed: 0.66 },
    { kind: 'dumptruck', x: 144, z: 189, yaw: 2.4, patrolRange: 8.5, phase: 0.9, speed: 0.55 },
  ];

  for (let sIdx = 0; sIdx < offTrackSpecs.length; sIdx++) {
    if (simpleMat && sIdx % 2 === 1) continue;
    const spec = offTrackSpecs[sIdx];
    const clearRad = spec.patrolRange + 4.8;
    if (!isClearOfTrack(spec.x, spec.z, clearRad)) continue;
    if (spec.kind === 'dumptruck') {
      const rig = buildDumpTruckRig(mats, enableShadows, disposables);
      rig.root.position.set(spec.x, 0, spec.z);
      rig.root.rotation.y = spec.yaw;
      group.add(rig.root);
      offTrackMachines.push({
        kind: spec.kind,
        root: rig.root,
        animTarget: rig.bedGroup,
        beaconMesh: rig.beaconMesh,
        anchorX: spec.x,
        anchorZ: spec.z,
        baseYaw: spec.yaw,
        patrolRange: spec.patrolRange,
        phase: spec.phase,
        speed: spec.speed,
      });
    } else {
      const rig = buildMachineryRig(spec.kind, mats, enableShadows, disposables);
      rig.root.position.set(spec.x, 0, spec.z);
      rig.root.rotation.y = spec.yaw;
      group.add(rig.root);
      offTrackMachines.push({
        kind: spec.kind,
        root: rig.root,
        animTarget: rig.armGroup,
        beaconMesh: rig.beaconMesh,
        anchorX: spec.x,
        anchorZ: spec.z,
        baseYaw: spec.yaw,
        patrolRange: spec.patrolRange,
        phase: spec.phase,
        speed: spec.speed,
      });
    }
  }

  // 2C. Off-Track Construction Worker NPCs (Adults in Hard Hats & Safety Vests around machinery & piles)
  interface OffTrackWorker {
    anchorX: number;
    anchorZ: number;
    walkDirX: number;
    walkDirZ: number;
    walkRange: number;
    phase: number;
    speed: number;
    baseYaw: number;
    shirtColor: THREE.Color;
    vestColor: THREE.Color;
    hatColor: THREE.Color;
    pantsColor: THREE.Color;
    skinColor: THREE.Color;
  }

  const workerSpots: Array<{ x: number; z: number; yaw: number; walk: number }> = [];
  // Spawn workers around each off-track machine
  const workersPerMachine = simpleMat ? 1 : 3;
  for (const m of offTrackMachines) {
    for (let k = 0; k < workersPerMachine; k++) {
      const ang = m.baseYaw + 1.1 + k * 2.05;
      const dist = 4.8 + (k % 2) * 1.9;
      const wx = m.anchorX + Math.sin(ang) * dist;
      const wz = m.anchorZ + Math.cos(ang) * dist;
      if (isClearOfTrack(wx, wz, 1.8)) {
        workerSpots.push({
          x: wx,
          z: wz,
          yaw: Math.atan2(m.anchorX - wx, m.anchorZ - wz),
          walk: k === 1 ? 3.2 : 0,
        });
      }
    }
  }
  // Extra workers near girder stacks, sand piles & unfinished skyscraper yard
  const extraCrewAnchors = [
    [-129, -33], [-117, -48], [-99, 3], [-87, 63], [-102, 75], [-72, -60],
    [-234, 33], [-231, -21], [-228, -48], [66, -60], [96, -39], [126, 12],
    [24, 84], [54, 108], [222, -54], [213, 69], [-141, -219], [42, -213],
  ];
  for (let i = 0; i < extraCrewAnchors.length; i++) {
    if (simpleMat && i % 2 === 1) continue;
    const [ax, az] = extraCrewAnchors[i];
    if (isClearOfTrack(ax, az, 2.2)) {
      workerSpots.push({
        x: ax,
        z: az,
        yaw: (i * 1.3) % (Math.PI * 2),
        walk: i % 2 === 0 ? 3.5 : 0,
      });
    }
  }

  const offTrackWorkers: OffTrackWorker[] = workerSpots.map((ws, idx) => {
    const shirtHex = [0x1e3a8a, 0x334155, 0xe2e8f0, 0x78350f][idx % 4];
    const vestHex = [0xfacc15, 0xf97316, 0xa3e635][idx % 3];
    const hatHex = [0xfacc15, 0xf8fafc, 0xf97316][idx % 3];
    const pantsHex = [0x1e3a8a, 0x334155, 0x1e293b][idx % 3];
    const skinHex = [0xf1c27d, 0xe0ac69, 0xc68642, 0xffdbac][idx % 4];
    return {
      anchorX: ws.x,
      anchorZ: ws.z,
      walkDirX: Math.sin(ws.yaw),
      walkDirZ: Math.cos(ws.yaw),
      walkRange: ws.walk,
      phase: idx * 0.9,
      speed: ws.walk > 0 ? 1.35 + (idx % 3) * 0.25 : 2.2,
      baseYaw: ws.yaw,
      shirtColor: new THREE.Color(shirtHex),
      vestColor: new THREE.Color(vestHex),
      hatColor: new THREE.Color(hatHex),
      pantsColor: new THREE.Color(pantsHex),
      skinColor: new THREE.Color(skinHex),
    };
  });

  const wTorsoGeo = new THREE.BoxGeometry(0.46, 0.56, 0.26);
  const wVestGeo = new THREE.BoxGeometry(0.49, 0.44, 0.29);
  const wHeadGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
  const wHatDomeGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.16, 10);
  const wHatBrimGeo = new THREE.CylinderGeometry(0.25, 0.26, 0.04, 10);
  const wLegGeo = new THREE.BoxGeometry(0.17, 0.68, 0.19);
  wLegGeo.translate(0, -0.34, 0);
  const wArmGeo = new THREE.BoxGeometry(0.14, 0.5, 0.16);
  wArmGeo.translate(0, -0.22, 0);
  const wMat = makeMat({
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.06,
  });
  disposables.push(
    wTorsoGeo,
    wVestGeo,
    wHeadGeo,
    wHatDomeGeo,
    wHatBrimGeo,
    wLegGeo,
    wArmGeo,
    wMat
  );

  const wCount = Math.max(1, offTrackWorkers.length);
  const wTorsoInst = new THREE.InstancedMesh(wTorsoGeo, wMat, wCount);
  const wVestInst = new THREE.InstancedMesh(wVestGeo, wMat, wCount);
  const wHeadInst = new THREE.InstancedMesh(wHeadGeo, wMat, wCount);
  const wHatDomeInst = new THREE.InstancedMesh(wHatDomeGeo, wMat, wCount);
  const wHatBrimInst = new THREE.InstancedMesh(wHatBrimGeo, wMat, wCount);
  const wLeftLegInst = new THREE.InstancedMesh(wLegGeo, wMat, wCount);
  const wRightLegInst = new THREE.InstancedMesh(wLegGeo, wMat, wCount);
  const wLeftArmInst = new THREE.InstancedMesh(wArmGeo, wMat, wCount);
  const wRightArmInst = new THREE.InstancedMesh(wArmGeo, wMat, wCount);

  if (offTrackWorkers.length > 0) {
    offTrackWorkers.forEach((w, idx) => {
      wTorsoInst.setColorAt(idx, w.shirtColor);
      wVestInst.setColorAt(idx, w.vestColor);
      wHeadInst.setColorAt(idx, w.skinColor);
      wHatDomeInst.setColorAt(idx, w.hatColor);
      wHatBrimInst.setColorAt(idx, w.hatColor);
      wLeftLegInst.setColorAt(idx, w.pantsColor);
      wRightLegInst.setColorAt(idx, w.pantsColor);
      wLeftArmInst.setColorAt(idx, w.shirtColor);
      wRightArmInst.setColorAt(idx, w.shirtColor);
    });
    [
      wTorsoInst,
      wVestInst,
      wHeadInst,
      wHatDomeInst,
      wHatBrimInst,
      wLeftLegInst,
      wRightLegInst,
      wLeftArmInst,
      wRightArmInst,
    ].forEach((inst) => {
      inst.castShadow = enableShadows;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      group.add(inst);
    });
  }

  // 3. On-Road Bright Yellow Sand Patches
  const sandPatchGeo = new THREE.PlaneGeometry(1, 1);
  sandPatchGeo.rotateX(-Math.PI / 2);
  const sandMoundGeo = new THREE.CylinderGeometry(0.42, 0.92, 0.24, 14);
  const sandMoundMat = makeMat({
    color: 0xf5c838,
    roughness: 0.95,
    metalness: 0.0,
  });
  const sandPatchMat = makeMat({
    color: 0xffffff,
    map: sandTex,
    transparent: true,
    roughness: 0.95,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  disposables.push(sandPatchGeo, sandMoundGeo, sandMoundMat, sandPatchMat);

  for (const sp of sandPatches) {
    const patchGroup = new THREE.Group();
    patchGroup.position.set(sp.x, 0.056, sp.z);
    patchGroup.rotation.y = sp.yaw;

    const plane = new THREE.Mesh(sandPatchGeo, sandPatchMat);
    plane.scale.set(sp.radiusX * 2.15, 1, sp.radiusZ * 2.15);
    plane.renderOrder = 2;
    plane.receiveShadow = enableShadows;
    patchGroup.add(plane);

    const mound = new THREE.Mesh(sandMoundGeo, sandMoundMat);
    mound.scale.set(sp.radiusX * 0.85, 1, sp.radiusZ * 0.8);
    mound.position.y = 0.08;
    mound.castShadow = enableShadows;
    patchGroup.add(mound);

    group.add(patchGroup);
  }

  // 4. Moving Heavy Construction Vehicles (3 Bulldozers + 3 Excavators)
  const vehicleRigs = initialVehicles.map((v) => {
    const rig = buildMachineryRig(v.kind, mats, enableShadows, disposables);
    rig.root.position.set(v.x, 0, v.z);
    rig.root.rotation.y = v.yaw;
    group.add(rig.root);
    return rig;
  });

  const _tipPos = new THREE.Vector3();
  const _ballTopPos = new THREE.Vector3();
  const _cableDir = new THREE.Vector3();
  const _upAxis = new THREE.Vector3(0, 1, 0);

  function syncHazards(
    vehicles: ConstructionHazardVehicle[],
    wreckingBall: WreckingBallState | null,
    elapsed: number
  ): void {
    for (let i = 0; i < vehicles.length && i < vehicleRigs.length; i++) {
      const v = vehicles[i];
      const rig = vehicleRigs[i];
      rig.root.position.set(v.x, 0, v.z);
      rig.root.rotation.y = v.yaw;
      if (v.kind === 'bulldozer') {
        rig.armGroup.position.y = Math.sin(v.armPhase * 1.4) * 0.14;
      } else {
        rig.armGroup.rotation.x = Math.sin(v.armPhase) * 0.22;
      }
      const pulse = 1.1 + Math.sin(elapsed * 8 + i) * 0.9;
      rig.beaconMesh.scale.setScalar(0.95 + pulse * 0.08);
    }

    if (wreckingBall) {
      craneRig.turretGroup.rotation.y = wreckingBall.boomYaw;
      craneRig.ballGroup.position.set(
        wreckingBall.ballX,
        wreckingBall.ballY,
        wreckingBall.ballZ
      );
      craneRig.groundWarningMesh.position.set(
        wreckingBall.ballX,
        0.09,
        wreckingBall.ballZ
      );
      const ringPulse = 0.92 + Math.sin(elapsed * 6.5) * 0.12;
      craneRig.groundWarningMesh.scale.setScalar(ringPulse);

      const tipX =
        wreckingBall.pivotX + Math.sin(wreckingBall.boomYaw) * wreckingBall.boomLength;
      const tipZ =
        wreckingBall.pivotZ + Math.cos(wreckingBall.boomYaw) * wreckingBall.boomLength;
      _tipPos.set(tipX, 75.4, tipZ);
      _ballTopPos.set(
        wreckingBall.ballX,
        wreckingBall.ballY + 3.4,
        wreckingBall.ballZ
      );
      _cableDir.subVectors(_ballTopPos, _tipPos);
      const cableLen = Math.max(1, _cableDir.length());
      craneRig.cableMesh.position.copy(_tipPos).addScaledVector(_cableDir, 0.5);
      craneRig.cableMesh.scale.set(1, cableLen, 1);
      _cableDir.normalize();
      craneRig.cableMesh.quaternion.setFromUnitVectors(_upAxis, _cableDir);
    }
  }

  const _wDummy = new THREE.Object3D();
  function update(_dt: number, elapsed: number): void {
    const blink = Math.sin(elapsed * 5.2) > 0 ? 1.2 : 0.75;
    craneRig.beaconMesh.scale.setScalar(blink);

    for (const sc of secondaryCranes) {
      sc.turret.rotation.y = sc.baseYaw + Math.sin(elapsed * sc.speed) * 0.65;
    }

    // Animate off-track construction machinery (excavator scoops, moving bulldozers & dump trucks)
    for (let i = 0; i < offTrackMachines.length; i++) {
      const m = offTrackMachines[i];
      const t = elapsed * m.speed + m.phase;
      if (m.patrolRange > 0) {
        const sVal = Math.sin(t);
        const cosT = Math.cos(t);
        const turnRatio = Math.max(-1, Math.min(1, cosT * 5.0));
        const turnAngle = (1 - turnRatio) * 0.5 * Math.PI;
        const off = sVal * m.patrolRange;
        m.root.position.set(
          m.anchorX + Math.sin(m.baseYaw) * off,
          0,
          m.anchorZ + Math.cos(m.baseYaw) * off
        );
        m.root.rotation.y = m.baseYaw + turnAngle;
      } else {
        m.root.rotation.y = m.baseYaw + Math.sin(t * 0.55) * 0.45;
      }

      if (m.kind === 'excavator') {
        m.animTarget.rotation.x = Math.sin(t * 1.4) * 0.28;
      } else if (m.kind === 'bulldozer') {
        m.animTarget.position.y = Math.sin(t * 2.2) * 0.16;
      } else {
        m.animTarget.rotation.x = Math.max(0, Math.sin(t * 0.7)) * 0.38;
      }
      const bScale = 0.92 + Math.abs(Math.sin(elapsed * 5.5 + i)) * 0.24;
      m.beaconMesh.scale.setScalar(bScale);
    }

    // Animate off-track hard-hat construction workers (zero heap allocation)
    if (offTrackWorkers.length > 0) {
      for (let i = 0; i < offTrackWorkers.length; i++) {
        const w = offTrackWorkers[i];
        const t = elapsed * w.speed + w.phase;
        let wx = w.anchorX;
        let wz = w.anchorZ;
        let yaw = w.baseYaw;
        let swing = 0;
        let bob = 0;

        if (w.walkRange > 0) {
          const offset = Math.sin(t * 0.65) * w.walkRange;
          const dir = Math.cos(t * 0.65) >= 0 ? 0 : Math.PI;
          wx += w.walkDirX * offset;
          wz += w.walkDirZ * offset;
          yaw = w.baseYaw + dir;
          swing = Math.sin(t * 4.2) * 0.52;
          bob = Math.abs(Math.cos(t * 4.2)) * 0.05;
        } else {
          yaw = w.baseYaw + Math.sin(t * 0.5) * 0.28;
          swing = Math.sin(t * 2.4) * 0.22;
        }

        const sinY = Math.sin(yaw);
        const cosY = Math.cos(yaw);
        const rightX = -cosY;
        const rightZ = sinY;

        _wDummy.position.set(wx, 1.0 + bob, wz);
        _wDummy.rotation.set(0, yaw, 0);
        _wDummy.scale.setScalar(1);
        _wDummy.updateMatrix();
        wTorsoInst.setMatrixAt(i, _wDummy.matrix);

        _wDummy.position.set(wx, 1.02 + bob, wz);
        _wDummy.updateMatrix();
        wVestInst.setMatrixAt(i, _wDummy.matrix);

        _wDummy.position.set(wx, 1.46 + bob, wz);
        _wDummy.updateMatrix();
        wHeadInst.setMatrixAt(i, _wDummy.matrix);

        _wDummy.position.set(wx, 1.68 + bob, wz);
        _wDummy.updateMatrix();
        wHatDomeInst.setMatrixAt(i, _wDummy.matrix);

        _wDummy.position.set(wx, 1.61 + bob, wz);
        _wDummy.updateMatrix();
        wHatBrimInst.setMatrixAt(i, _wDummy.matrix);

        _wDummy.position.set(wx - rightX * 0.12, 0.72 + bob, wz - rightZ * 0.12);
        _wDummy.rotation.set(swing, yaw, 0);
        _wDummy.updateMatrix();
        wLeftLegInst.setMatrixAt(i, _wDummy.matrix);

        _wDummy.position.set(wx + rightX * 0.12, 0.72 + bob, wz + rightZ * 0.12);
        _wDummy.rotation.set(-swing, yaw, 0);
        _wDummy.updateMatrix();
        wRightLegInst.setMatrixAt(i, _wDummy.matrix);

        _wDummy.position.set(wx - rightX * 0.3, 1.24 + bob, wz - rightZ * 0.3);
        _wDummy.rotation.set(-swing * 0.8, yaw, 0);
        _wDummy.updateMatrix();
        wLeftArmInst.setMatrixAt(i, _wDummy.matrix);

        _wDummy.position.set(wx + rightX * 0.3, 1.24 + bob, wz + rightZ * 0.3);
        _wDummy.rotation.set(swing * 0.8, yaw, 0);
        _wDummy.updateMatrix();
        wRightArmInst.setMatrixAt(i, _wDummy.matrix);
      }

      wTorsoInst.instanceMatrix.needsUpdate = true;
      wVestInst.instanceMatrix.needsUpdate = true;
      wHeadInst.instanceMatrix.needsUpdate = true;
      wHatDomeInst.instanceMatrix.needsUpdate = true;
      wHatBrimInst.instanceMatrix.needsUpdate = true;
      wLeftLegInst.instanceMatrix.needsUpdate = true;
      wRightLegInst.instanceMatrix.needsUpdate = true;
      wLeftArmInst.instanceMatrix.needsUpdate = true;
      wRightArmInst.instanceMatrix.needsUpdate = true;
    }
  }

  // Suppress unused warning when software GL path is evaluated
  void isSoftwareGl;
  void track;

  return {
    group,
    syncHazards,
    update,
    dispose: () => {
      for (const item of disposables) {
        item.dispose();
      }
    },
  };
}
