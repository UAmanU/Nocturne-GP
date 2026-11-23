import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CAR_MODELS,
  CAR_ROSTER,
  TOTAL_LAPS,
  type CarAppearance,
  type GameMode,
  type GamePhase,
  type GraphicsQuality,
  type HudSnapshot,
  type IntroSpotlight,
  type KeyBindings,
  type MapId,
  type RaceFinishSummary,
  type WeatherMode,
} from './types';
import { getGraphicsProfile } from './graphics';
import { isPursuitMap } from './garage';
import { resolvePlayerInput } from './controls';
import { createRaceTrack, sampleAtT, type RaceTrack } from './track';
import {
  COUNTDOWN_SECONDS,
  GRID_INTRO_SECONDS,
  PHYSICS_CONFIG,
  createRaceSimulation,
  getStandings,
  stepRaceSimulation,
  type RaceSimulation,
} from './physics';
import { createCarModel, type CarMeshRig } from './carModel';
import {
  createCityWorld,
  getMapAtmosphere,
  type CityWorldObjects,
} from './cityWorld';
import { createWeatherSystem, type WeatherSystem } from './weather';
import type { ProceduralAudioEngine } from './audio';

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onRaceFinish: (summary: RaceFinishSummary) => void;
  onContextLost: (lost: boolean) => void;
}

// Reusable scratch vectors to ensure zero GC inside the render loop
const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class RacingEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private graphicsQuality: GraphicsQuality;
  private mode: GameMode;
  private mapId: MapId;
  private weather: WeatherMode;
  private track: RaceTrack;
  private sim: RaceSimulation;
  private world: CityWorldObjects;
  private weatherSystem: WeatherSystem;
  private carRigs: CarMeshRig[] = [];
  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private envRT: THREE.WebGLRenderTarget;

  private phase: GamePhase = 'title';
  private garageShowcase = false;
  private bindings: KeyBindings;
  private playerAppearance: CarAppearance;
  private pressedCodes = new Set<string>();
  private resetRequested = false;

  private callbacks: EngineCallbacks;
  private audio: ProceduralAudioEngine;

  private frameId = 0;
  private lastTimestamp = 0;
  private elapsed = 0;
  private hudEmitAccum = 0;
  private finishReported = false;
  private victoryCamLocked = false;
  private victoryCamPos = new THREE.Vector3();
  private usedIntroThisRace = false;
  private cameraTrauma = 0;
  private waterSplashNoticeTimer = 0;
  private wreckAlertTimer = 0;
  private lastWreckReason: 'ball' | 'machinery' | null = null;
  private lastCountdownInt = 0;
  private resizeObserver: ResizeObserver;
  private disposed = false;

  constructor(
    container: HTMLElement,
    initialBindings: KeyBindings,
    initialAppearance: CarAppearance,
    initialMapId: MapId,
    initialWeather: WeatherMode,
    audio: ProceduralAudioEngine,
    callbacks: EngineCallbacks,
    initialGraphicsQuality: GraphicsQuality = 'medium'
  ) {
    this.container = container;
    this.bindings = initialBindings;
    this.playerAppearance = { ...initialAppearance };
    this.mapId = initialMapId;
    this.mode = isPursuitMap(initialMapId) ? 'pursuit' : 'race';
    this.weather = initialWeather;
    this.graphicsQuality = initialGraphicsQuality;
    this.audio = audio;
    this.callbacks = callbacks;

    this.isSoftwareGl = detectSoftwareWebGL();
    const profile = getGraphicsProfile(this.graphicsQuality);
    const shadowsEnabled = profile.shadows && !this.isSoftwareGl;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && this.graphicsQuality !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, profile.pixelRatioCap)
    );
    this.renderer.shadowMap.enabled = shadowsEnabled;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 240);
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.3, 1100);

    // Mandatory studio PMREM environment reflections on every device
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    // 3-point atmospheric lighting rig
    this.hemiLight = new THREE.HemisphereLight(0x60a5fa, 0x0f172a, 1.15);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffedd5, 1.6);
    this.keyLight.position.set(45, 72, 38);
    this.keyLight.castShadow = shadowsEnabled;
    this.keyLight.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
    this.keyLight.shadow.camera.near = 5;
    this.keyLight.shadow.camera.far = 220;
    const d = 75;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    this.rimLight = new THREE.DirectionalLight(0x60a5fa, 0.75);
    this.rimLight.position.set(-70, 35, -80);
    this.scene.add(this.rimLight);

    // Track, simulation & world
    this.track = createRaceTrack(this.mapId);
    this.sim = createRaceSimulation(this.track, false, this.playerAppearance);
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.world = createCityWorld(
      this.track,
      this.sim.boostPads,
      maxAniso,
      this.isSoftwareGl,
      this.mapId,
      {
        sandPatches: this.sim.sandPatches,
        constructionVehicles: this.sim.constructionVehicles,
      },
      this.graphicsQuality,
      this.weather
    );
    this.world.syncConstructionHazards(
      this.sim.constructionVehicles,
      this.sim.wreckingBall,
      0
    );
    this.world.syncPursuitObstacles(this.sim.pursuitObstacles);
    this.scene.add(this.world.root);

    this.weatherSystem = createWeatherSystem(this.isSoftwareGl, this.graphicsQuality);
    this.weatherSystem.setWeather(this.weather);
    this.scene.add(this.weatherSystem.root);

    this.rebuildCarRigs();
    this.applyAtmosphere();
    this.syncCarMeshes(0.016);
    this.positionTitleCamera(0);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
    this.renderer.render(this.scene, this.camera);

    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(container);

    this.lastTimestamp = performance.now();
    this.scheduleNextFrame();
  }

  private buildAppearanceForRacer(idx: number): {
    appearance: CarAppearance;
    isPolice: boolean;
    hasCargo: boolean;
  } {
    const racer = this.sim.racers[idx];
    if (!racer || racer.isPlayer) {
      return {
        appearance: this.playerAppearance,
        isPolice: false,
        hasCargo: this.mode === 'pursuit',
      };
    }
    if (racer.role === 'police-chaser' || racer.role === 'police-roadblock') {
      return {
        appearance: {
          bodyStyle: idx % 2 === 0 ? 'nissan' : 'bmw',
          primaryColor: '#0b0f19',
          accentColor: '#3b82f6',
          spoilerStyle: 'ducktail',
          rimFinish: 'obsidian',
          livery: 'clean',
        },
        isPolice: true,
        hasCargo: false,
      };
    }
    const spec = CAR_ROSTER[idx] ?? CAR_ROSTER[1];
    return {
      appearance: {
        bodyStyle: spec.bodyStyle,
        primaryColor: spec.primaryColor,
        accentColor: spec.accentColor,
        spoilerStyle: spec.spoilerStyle,
        rimFinish: spec.rimFinish,
        livery: spec.livery,
      },
      isPolice: false,
      hasCargo: false,
    };
  }

  private rebuildCarRigs(): void {
    for (const rig of this.carRigs) {
      this.scene.remove(rig.root);
      rig.dispose();
    }
    this.carRigs = this.sim.racers.map((_r, idx) => {
      const cfg = this.buildAppearanceForRacer(idx);
      const rig = createCarModel(cfg.appearance, this.isSoftwareGl, {
        isPolice: cfg.isPolice,
        hasCargo: cfg.hasCargo,
        graphicsQuality: this.graphicsQuality,
      });
      this.scene.add(rig.root);
      return rig;
    });
  }

  private applyAtmosphere(): void {
    const atmo = getMapAtmosphere(this.mapId, this.weather);
    this.scene.background = new THREE.Color(atmo.bgColor);
    this.scene.fog = new THREE.FogExp2(atmo.fogColor, atmo.fogDensity);
    this.hemiLight.color.setHex(atmo.hemiSky);
    this.hemiLight.groundColor.setHex(atmo.hemiGround);
    this.hemiLight.intensity = atmo.hemiIntensity;
    this.keyLight.color.setHex(atmo.keyColor);
    this.keyLight.intensity = atmo.keyIntensity;
    this.rimLight.color.setHex(atmo.rimColor);
    this.rimLight.intensity = atmo.rimIntensity;

    const isNightMap = this.mapId === 'night-city' || this.mode === 'pursuit';
    const beamOpacity = isNightMap ? 0.34 : 0.08;
    for (const rig of this.carRigs) {
      rig.headlightBeamMat.opacity = beamOpacity;
    }
  }

  public setMap(mapId: MapId): void {
    if (this.mapId === mapId) return;
    this.mapId = mapId;
    this.mode = isPursuitMap(mapId) ? 'pursuit' : 'race';
    this.waterSplashNoticeTimer = 0;
    this.wreckAlertTimer = 0;
    this.lastWreckReason = null;

    this.scene.remove(this.world.root);
    this.world.dispose();

    this.track = createRaceTrack(mapId);
    this.sim = createRaceSimulation(this.track, false, this.playerAppearance);
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.world = createCityWorld(
      this.track,
      this.sim.boostPads,
      maxAniso,
      this.isSoftwareGl,
      mapId,
      {
        sandPatches: this.sim.sandPatches,
        constructionVehicles: this.sim.constructionVehicles,
      },
      this.graphicsQuality,
      this.weather
    );
    this.world.syncConstructionHazards(
      this.sim.constructionVehicles,
      this.sim.wreckingBall,
      this.elapsed
    );
    this.world.syncPursuitObstacles(this.sim.pursuitObstacles);
    this.scene.add(this.world.root);

    this.rebuildCarRigs();
    this.applyAtmosphere();
    this.syncCarMeshes(0.016);
    if (this.phase === 'title') {
      this.positionTitleCamera(this.elapsed);
    }
    this.emitHudSnapshot();
    this.renderer.render(this.scene, this.camera);
  }

  public setWeather(weather: WeatherMode): void {
    const prevWeather = this.weather;
    this.weather = weather;
    this.weatherSystem.setWeather(weather);
    if (prevWeather !== weather && getGraphicsProfile(this.graphicsQuality).volumetricClouds) {
      this.rebuildWorldForCurrentState();
    }
    this.applyAtmosphere();
    this.renderer.render(this.scene, this.camera);
  }

  private rebuildWorldForCurrentState(): void {
    this.scene.remove(this.world.root);
    this.world.dispose();

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.world = createCityWorld(
      this.track,
      this.sim.boostPads,
      maxAniso,
      this.isSoftwareGl,
      this.mapId,
      {
        sandPatches: this.sim.sandPatches,
        constructionVehicles: this.sim.constructionVehicles,
      },
      this.graphicsQuality,
      this.weather
    );
    this.world.syncConstructionHazards(
      this.sim.constructionVehicles,
      this.sim.wreckingBall,
      this.elapsed
    );
    this.world.syncPursuitObstacles(this.sim.pursuitObstacles);
    this.scene.add(this.world.root);
  }

  public setGraphicsQuality(quality: GraphicsQuality): void {
    if (this.graphicsQuality === quality) return;
    this.graphicsQuality = quality;

    const profile = getGraphicsProfile(quality);
    const shadowsEnabled = profile.shadows && !this.isSoftwareGl;

    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, profile.pixelRatioCap)
    );
    this.renderer.shadowMap.enabled = shadowsEnabled;
    this.keyLight.castShadow = shadowsEnabled;
    if (this.keyLight.shadow.map) {
      this.keyLight.shadow.map.dispose();
      this.keyLight.shadow.map = null;
    }
    this.keyLight.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
    this.renderer.shadowMap.needsUpdate = true;

    this.scene.remove(this.weatherSystem.root);
    this.weatherSystem.dispose();
    this.weatherSystem = createWeatherSystem(this.isSoftwareGl, this.graphicsQuality);
    this.weatherSystem.setWeather(this.weather);
    this.scene.add(this.weatherSystem.root);

    this.rebuildWorldForCurrentState();
    this.rebuildCarRigs();
    this.applyAtmosphere();
    this.syncCarMeshes(0.016);
    if (this.phase === 'title') {
      this.positionTitleCamera(this.elapsed);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.callbacks.onContextLost(true);
  };

  private handleContextRestored = (): void => {
    this.callbacks.onContextLost(false);
  };

  private handleResize(): void {
    if (this.disposed) return;
    const w = Math.max(this.container.clientWidth, 320);
    const h = Math.max(this.container.clientHeight, 240);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  public setPhase(phase: GamePhase): void {
    this.phase = phase;
    if (phase !== 'playing') {
      this.pressedCodes.clear();
      this.audio.updatePursuitSiren(false, 0, this.elapsed);
      if (phase !== 'gameover') {
        this.audio.updateEngine(0, false, false, false);
      }
    }
  }

  public setGarageShowcase(enabled: boolean): void {
    this.garageShowcase = enabled;
    if (this.phase === 'title') {
      this.positionTitleCamera(this.elapsed);
    }
  }

  public setPlayerAppearance(appearance: CarAppearance): void {
    this.playerAppearance = { ...appearance };
    const oldRig = this.carRigs[0];
    if (oldRig) {
      this.scene.remove(oldRig.root);
      oldRig.dispose();
    }
    const nextRig = createCarModel(this.playerAppearance, this.isSoftwareGl, {
      hasCargo: this.mode === 'pursuit',
      graphicsQuality: this.graphicsQuality,
    });
    const isNightMap = this.mapId === 'night-city' || this.mode === 'pursuit';
    nextRig.headlightBeamMat.opacity = isNightMap ? 0.34 : 0.08;
    this.carRigs[0] = nextRig;
    this.scene.add(nextRig.root);

    if (this.sim.racers[0]) {
      this.sim.racers[0].primaryColor = this.playerAppearance.primaryColor;
      this.sim.racers[0].accentColor = this.playerAppearance.accentColor;
    }
    this.syncCarMeshes(0.016);
  }

  public setKeyBindings(bindings: KeyBindings): void {
    this.bindings = bindings;
  }

  public setPressedCode(code: string, down: boolean): void {
    if (down) {
      this.pressedCodes.add(code);
    } else {
      this.pressedCodes.delete(code);
    }
  }

  public clearInputs(): void {
    this.pressedCodes.clear();
  }

  public requestResetPlayerCar(): void {
    this.resetRequested = true;
  }

  public skipIntro(): void {
    if (this.sim.countdown > COUNTDOWN_SECONDS) {
      this.sim.countdown = COUNTDOWN_SECONDS;
      this.lastCountdownInt = Math.ceil(this.sim.countdown) + 1;
      this.updatePreRaceCamera(0.016);
      this.emitHudSnapshot();
    }
  }

  public startNewRace(skipCountdown = false): void {
    this.sim = createRaceSimulation(this.track, skipCountdown, this.playerAppearance);
    if (this.carRigs.length !== this.sim.racers.length) {
      this.rebuildCarRigs();
      this.applyAtmosphere();
    }
    this.finishReported = false;
    this.victoryCamLocked = false;
    this.usedIntroThisRace = !skipCountdown;
    this.cameraTrauma = 0;
    this.waterSplashNoticeTimer = 0;
    this.wreckAlertTimer = 0;
    this.lastWreckReason = null;
    this.lastCountdownInt = skipCountdown ? 0 : Math.ceil(COUNTDOWN_SECONDS) + 1;
    this.pressedCodes.clear();
    this.resetRequested = false;
    this.world.resetSkidMarks();
    this.world.syncConstructionHazards(
      this.sim.constructionVehicles,
      this.sim.wreckingBall,
      this.elapsed
    );
    this.world.syncPursuitObstacles(this.sim.pursuitObstacles);

    this.syncCarMeshes(0.016);

    if (skipCountdown) {
      const player = this.sim.racers[0];
      const fwdX = Math.sin(player.yaw);
      const fwdZ = Math.cos(player.yaw);
      this.camera.position.set(
        player.x - fwdX * 8.6,
        3.5,
        player.z - fwdZ * 8.6
      );
      this.camera.lookAt(player.x + fwdX * 10, 1.1, player.z + fwdZ * 10);
      this.camera.fov = 62;
      this.camera.updateProjectionMatrix();
    } else {
      this.updatePreRaceCamera(0.016);
    }

    this.emitHudSnapshot();
  }

  public placePlayerAtTForTest(t: number, speedMs = 20): void {
    const player = this.sim.racers[0];
    const s = sampleAtT(this.track, Math.min(0.98, Math.max(0.01, t)));
    player.x = s.x;
    player.z = s.z;
    player.yaw = s.yaw;
    player.nearestSampleIndex = s.index;
    player.trackT = s.t;
    player.activeBranchId = null;
    player.vx = Math.sin(s.yaw) * speedMs;
    player.vz = Math.cos(s.yaw) * speedMs;
    player.speed = speedMs;
    const fwdX = Math.sin(player.yaw);
    const fwdZ = Math.cos(player.yaw);
    this.camera.position.set(player.x - fwdX * 8.6, 3.5, player.z - fwdZ * 8.6);
    this.camera.lookAt(player.x + fwdX * 10, 1.1, player.z + fwdZ * 10);
    this.syncCarMeshes(0.016);
    this.emitHudSnapshot();
    this.renderer.render(this.scene, this.camera);
  }

  public forceFinishForTest(playerWon: boolean): void {
    this.startNewRace(true);
    this.sim.raceTime = 84.32;
    const player = this.sim.racers[0];

    if (this.mode === 'pursuit') {
      const pSample = sampleAtT(this.track, playerWon ? 0.994 : 0.62);
      player.x = pSample.x - pSample.rx * 1.4;
      player.z = pSample.z - pSample.rz * 1.4;
      player.yaw = pSample.yaw;
      player.nearestSampleIndex = pSample.index;
      player.trackT = pSample.t;
      player.vx = Math.sin(pSample.yaw) * 18;
      player.vz = Math.cos(pSample.yaw) * 18;
      player.speed = 18;
      if (playerWon) {
        player.hp = 128;
        player.nitro = 100;
        player.isNitroActive = true;
        player.finished = true;
        player.finishTime = this.sim.raceTime;
        player.totalProgress = 1;
        this.sim.damageTaken = 72;
        this.sim.winnerId = player.id;
      } else {
        player.hp = 0;
        player.wrecked = true;
        player.totalProgress = 0.62;
        this.sim.damageTaken = 200;
        this.sim.winnerId = 'police-1';
        this.sim.defeatReason = 'wrecked';
        this.sim.defeatDriftSign = 1;
      }
    } else {
      const bot1 = this.sim.racers[1];
      const pSample = sampleAtT(this.track, playerWon ? 0.002 : 0.992);
      player.x = pSample.x - pSample.rx * 1.4;
      player.z = pSample.z - pSample.rz * 1.4;
      player.yaw = pSample.yaw;
      player.nearestSampleIndex = pSample.index;
      player.trackT = pSample.t;
      player.vx = Math.sin(pSample.yaw) * 18;
      player.vz = Math.cos(pSample.yaw) * 18;
      player.speed = 18;
      player.lap = TOTAL_LAPS;
      player.highestSector = 0;

      if (playerWon) {
        player.finished = true;
        player.finishTime = this.sim.raceTime;
        player.bestLapTime = 27.45;
        player.nitro = 100;
        player.isNitroActive = true;
        player.totalProgress = TOTAL_LAPS + 1 + 1000 - this.sim.raceTime;
        this.sim.winnerId = player.id;
      } else {
        const bSample = sampleAtT(this.track, 0.015);
        bot1.x = bSample.x + bSample.rx * 1.5;
        bot1.z = bSample.z + bSample.rz * 1.5;
        bot1.yaw = bSample.yaw;
        bot1.nearestSampleIndex = bSample.index;
        bot1.trackT = bSample.t;
        bot1.vx = Math.sin(bSample.yaw) * 18;
        bot1.vz = Math.cos(bSample.yaw) * 18;
        bot1.speed = 18;
        bot1.finished = true;
        bot1.finishTime = this.sim.raceTime;
        bot1.totalProgress = TOTAL_LAPS + 1 + 1000 - this.sim.raceTime;
        player.bestLapTime = 28.91;
        player.totalProgress = TOTAL_LAPS - 0.05;
        this.sim.winnerId = bot1.id;
        this.sim.defeatDriftSign = 1;
      }
    }

    this.sim.finished = true;
    this.sim.postFinishTime = 0;
    this.syncCarMeshes(0.016);
    this.updateFinishCamera(0.016);
    this.renderer.render(this.scene, this.camera);
    this.reportFinishIfNeeded();
  }

  private reportFinishIfNeeded(): void {
    if (!this.sim.finished || this.finishReported) return;
    this.finishReported = true;
    const player = this.sim.racers[0];
    const standings = getStandings(this.sim.racers);
    const winner = standings[0];
    const playerStanding = standings.find((s) => s.isPlayer) ?? standings[0];
    const playerWon = this.mode === 'pursuit' ? this.sim.winnerId === player.id : winner.isPlayer;
    const policeWrecked = this.sim.racers.filter(
      (r) => (r.role === 'police-chaser' || r.role === 'police-roadblock') && r.wrecked
    ).length;

    this.audio.playLapOrFinish(playerWon);
    this.emitHudSnapshot();
    this.callbacks.onRaceFinish({
      mode: this.mode,
      winnerId: this.sim.winnerId ?? winner.id,
      winnerName: this.mode === 'pursuit' ? (playerWon ? 'You' : 'Interceptor Squad') : winner.name,
      playerWon,
      defeatReason: playerWon ? null : (this.sim.defeatReason ?? 'wrecked'),
      playerPosition: playerStanding.position,
      raceTime: this.sim.raceTime,
      bestLapTime: player.bestLapTime,
      progressPct: Math.min(100, Math.max(0, Math.round(player.trackT * 100))),
      remainingHp: Math.round(player.hp),
      damageTaken: Math.round(this.sim.damageTaken),
      policeWrecked,
      standings,
    });
  }

  public getTrackOutline(): Array<{ x: number; z: number }> {
    const out: Array<{ x: number; z: number }> = [];
    for (let i = 0; i < this.track.samples.length; i += 8) {
      const s = this.track.samples[i];
      out.push({ x: s.x, z: s.z });
    }
    return out;
  }

  public getTrackBranches(): Array<Array<{ x: number; z: number }>> {
    return this.track.branches.map((branch) => {
      const pts: Array<{ x: number; z: number }> = [];
      for (let i = 0; i < branch.samples.length; i += 6) {
        pts.push({ x: branch.samples[i].x, z: branch.samples[i].z });
      }
      const last = branch.samples[branch.samples.length - 1];
      pts.push({ x: last.x, z: last.z });
      return pts;
    });
  }

  public getTrackBounds() {
    return this.track.bounds;
  }

  private positionTitleCamera(elapsed: number): void {
    if (this.garageShowcase) {
      const player = this.sim.racers[0];
      const orbitAngle = elapsed * 0.42 + 0.55;
      const dist = 6.2;
      const cx = player.x + Math.sin(orbitAngle) * dist;
      const cz = player.z + Math.cos(orbitAngle) * dist;
      this.camera.position.set(cx, 2.05, cz);
      const rightX = Math.cos(orbitAngle);
      const rightZ = -Math.sin(orbitAngle);
      this.camera.lookAt(
        player.x - rightX * 1.1,
        0.65,
        player.z - rightZ * 1.1
      );
      if (Math.abs(this.camera.fov - 46) > 0.1) {
        this.camera.fov = 46;
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    if (this.mode === 'pursuit') {
      const player = this.sim.racers[0];
      const orbitAngle = elapsed * 0.16 + 2.4;
      const radius = 26;
      this.camera.position.set(
        player.x + Math.sin(orbitAngle) * radius,
        11.5,
        player.z + Math.cos(orbitAngle) * radius
      );
      this.camera.lookAt(player.x, 1.2, player.z);
      if (Math.abs(this.camera.fov - 56) > 0.1) {
        this.camera.fov = 56;
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    const angle = elapsed * 0.12 - 0.85;
    const radius = 232;
    const cx = Math.sin(angle) * radius;
    const cz = Math.cos(angle) * radius;
    this.camera.position.set(cx, 128 + Math.sin(elapsed * 0.35) * 6, cz);
    this.camera.lookAt(-6, 2, 0);
    if (Math.abs(this.camera.fov - 56) > 0.1) {
      this.camera.fov = 56;
      this.camera.updateProjectionMatrix();
    }
  }

  private getIntroSpotlight(): IntroSpotlight | null {
    if (this.sim.countdown <= COUNTDOWN_SECONDS) return null;

    const introRemaining = this.sim.countdown - COUNTDOWN_SECONDS;
    const introElapsed = Math.max(0, GRID_INTRO_SECONDS - introRemaining);
    const segDuration = GRID_INTRO_SECONDS / 4;
    const segIndex = Math.min(3, Math.floor(introElapsed / segDuration));
    const spotlightOrder = [1, 2, 3, 0];
    const racerIdx = spotlightOrder[segIndex];
    const car = this.sim.racers[racerIdx] ?? this.sim.racers[0];
    const spec = CAR_ROSTER[racerIdx] ?? CAR_ROSTER[0];
    const modelId = car.isPlayer ? this.playerAppearance.bodyStyle : spec.bodyStyle;
    const carModelName = CAR_MODELS.find((m) => m.id === modelId)?.name ?? 'Lamborghini SVJ';
    const angleLabels = [
      'LOW NOSE QUARTER',
      'FLANK TRACKING',
      'HIGH APEX ANGLE',
      'HERO CHALLENGER',
    ];

    return {
      racerId: car.id,
      name: car.isPlayer ? 'You' : car.name.split(' (')[0],
      carModelName,
      number: car.number,
      gridPos: segIndex + 1,
      isPlayer: car.isPlayer,
      primaryColor: car.primaryColor,
      accentColor: car.accentColor,
      angleLabel: angleLabels[segIndex],
    };
  }

  private updatePreRaceCamera(dt: number): void {
    if (this.sim.countdown > COUNTDOWN_SECONDS) {
      const introRemaining = this.sim.countdown - COUNTDOWN_SECONDS;
      const introElapsed = Math.max(0, GRID_INTRO_SECONDS - introRemaining);
      const segDuration = GRID_INTRO_SECONDS / 4;
      const segIndex = Math.min(3, Math.floor(introElapsed / segDuration));
      const p = Math.min(1, Math.max(0, (introElapsed - segIndex * segDuration) / segDuration));

      const spotlightOrder = [1, 2, 3, 0];
      const car = this.sim.racers[spotlightOrder[segIndex]] ?? this.sim.racers[0];
      const fwdX = Math.sin(car.yaw);
      const fwdZ = Math.cos(car.yaw);
      const rightX = -fwdZ;
      const rightZ = fwdX;

      let along = 3.8;
      let lat = 2.2;
      let camY = 1.0;
      let lookAlong = 0.25;
      let lookY = 0.58;

      if (segIndex === 0) {
        along = 3.85;
        lat = 2.45 - p * 0.9;
        camY = 0.86 + p * 0.14;
        lookAlong = 0.4;
        lookY = 0.54;
      } else if (segIndex === 1) {
        along = -3.75 + p * 0.95;
        lat = -2.45;
        camY = 1.42 - p * 0.16;
        lookAlong = 0.1;
        lookY = 0.62;
      } else if (segIndex === 2) {
        along = 3.35 - p * 0.6;
        lat = -2.85 + p * 0.95;
        camY = 2.08 - p * 0.28;
        lookAlong = 0.25;
        lookY = 0.66;
      } else {
        along = 3.55 - p * 4.1;
        lat = 2.15 + p * 0.95;
        camY = 0.95 + p * 0.65;
        lookAlong = 0.15;
        lookY = 0.64;
      }

      this.camera.position.set(
        car.x + fwdX * along + rightX * lat,
        camY,
        car.z + fwdZ * along + rightZ * lat
      );
      this.camera.lookAt(
        car.x + fwdX * lookAlong,
        lookY,
        car.z + fwdZ * lookAlong
      );
      if (Math.abs(this.camera.fov - 44) > 0.1) {
        this.camera.fov = 44;
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    const player = this.sim.racers[0];
    const fwdX = Math.sin(player.yaw);
    const fwdZ = Math.cos(player.yaw);
    const cdProgress = 1 - this.sim.countdown / COUNTDOWN_SECONDS;
    const dist = 7.4 + cdProgress * 0.95;
    const height = 2.95 + cdProgress * 0.35;

    _camTargetPos.set(
      player.x - fwdX * dist,
      height,
      player.z - fwdZ * dist
    );
    const damp = 1 - Math.exp(-6.5 * dt);
    this.camera.position.lerp(_camTargetPos, damp);

    _camLookTarget.set(
      player.x + fwdX * 10,
      1.12,
      player.z + fwdZ * 10
    );
    this.camera.lookAt(_camLookTarget);

    const targetFov = 58 + cdProgress * 4;
    const nextFov = this.camera.fov + (targetFov - this.camera.fov) * damp;
    if (Math.abs(nextFov - this.camera.fov) > 0.05) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }
  }

  private updateFinishCamera(dt: number): void {
    const player = this.sim.racers[0];
    if (this.sim.winnerId === player.id) {
      if (!this.victoryCamLocked) {
        this.victoryCamLocked = true;
        const camT = this.mode === 'pursuit' ? 0.988 : 0.016;
        const camSample = sampleAtT(this.track, camT);
        const sideOffset = -(this.track.halfWidth - 1.45);
        this.victoryCamPos.set(
          camSample.x + camSample.rx * sideOffset,
          2.15,
          camSample.z + camSample.rz * sideOffset
        );
      }

      this.camera.position.copy(this.victoryCamPos);
      this.camera.lookAt(player.x, 0.82, player.z);
      if (Math.abs(this.camera.fov - 50) > 0.1) {
        this.camera.fov = 50;
        this.camera.updateProjectionMatrix();
      }
    } else {
      const orbit = Math.min(0.75, this.sim.postFinishTime * 0.18);
      const angle = player.yaw + 0.62 + orbit * this.sim.defeatDriftSign;
      const dist = 6.2;
      _camTargetPos.set(
        player.x + Math.sin(angle) * dist,
        1.58,
        player.z + Math.cos(angle) * dist
      );

      if (this.sim.postFinishTime < 0.08) {
        this.camera.position.copy(_camTargetPos);
      } else {
        const damp = 1 - Math.exp(-5.8 * dt);
        this.camera.position.lerp(_camTargetPos, damp);
      }
      this.camera.lookAt(player.x, 0.65, player.z);
      if (Math.abs(this.camera.fov - 46) > 0.1) {
        this.camera.fov = 46;
        this.camera.updateProjectionMatrix();
      }
    }

    if (this.keyLight.castShadow) {
      this.keyLight.position.set(player.x + 42, 68, player.z + 32);
      this.keyLight.target.position.set(player.x, 0, player.z);
    }
  }

  private updateChaseCamera(dt: number): void {
    const player = this.sim.racers[0];
    const fwdX = Math.sin(player.yaw);
    const fwdZ = Math.cos(player.yaw);
    const maxCap =
      this.mapId === 'ice-arena'
        ? PHYSICS_CONFIG.iceNitroMaxSpeed
        : PHYSICS_CONFIG.nitroMaxSpeed *
          (this.mode === 'pursuit' ? PHYSICS_CONFIG.pursuitPlayerSpeedScale : 1);
    const speedRatio = Math.max(0, Math.abs(player.speed) / maxCap);

    const chaseDist = 8.2 + speedRatio * 1.4;
    const chaseHeight = 3.25 + speedRatio * 0.35;

    _camTargetPos.set(
      player.x - fwdX * chaseDist,
      chaseHeight,
      player.z - fwdZ * chaseDist
    );

    const posDamp = 1 - Math.exp(-9.5 * dt);
    this.camera.position.lerp(_camTargetPos, posDamp);

    _camLookTarget.set(
      player.x + fwdX * 9.5,
      1.15,
      player.z + fwdZ * 9.5
    );
    this.camera.lookAt(_camLookTarget);

    if (this.cameraTrauma > 0.001) {
      const shake = this.cameraTrauma * this.cameraTrauma * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake * 0.6;
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.4);
    }

    const playerBoosted = player.isNitroActive;
    const targetFov = 62 + speedRatio * 11 + (playerBoosted ? 8 : 0);
    const fovDamp = 1 - Math.exp(-7 * dt);
    const nextFov = this.camera.fov + (targetFov - this.camera.fov) * fovDamp;
    if (Math.abs(nextFov - this.camera.fov) > 0.05) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    if (this.keyLight.castShadow) {
      this.keyLight.position.set(player.x + 42, 68, player.z + 32);
      this.keyLight.target.position.set(player.x, 0, player.z);
    }
  }

  private syncCarMeshes(dt: number): void {
    const sirenPhase = Math.sin(this.elapsed * 16);
    for (let i = 0; i < this.sim.racers.length; i++) {
      const car = this.sim.racers[i];
      const rig = this.carRigs[i];
      if (!rig) continue;

      rig.root.position.set(car.x, 0, car.z);
      rig.root.rotation.y = car.yaw;

      rig.bodyPivot.rotation.x = car.pitch;
      rig.bodyPivot.rotation.z = car.roll;

      rig.frontLeftSteer.rotation.y = car.steerAngle;
      rig.frontRightSteer.rotation.y = car.steerAngle;
      for (const w of rig.wheelMeshes) {
        w.rotation.x = car.wheelSpin;
      }

      rig.brakeLightMat.emissiveIntensity = car.isBraking ? 4.2 : 1.5;

      // Police roof red/blue lightbar strobe
      if (rig.lightbarRedMat && rig.lightbarBlueMat) {
        if (car.wrecked) {
          rig.lightbarRedMat.emissiveIntensity = 0.15;
          rig.lightbarBlueMat.emissiveIntensity = 0.15;
        } else {
          const offset = i * 0.7;
          const s = Math.sin(this.elapsed * 15 + offset);
          rig.lightbarRedMat.emissiveIntensity = s > 0 ? 4.6 : 0.45;
          rig.lightbarBlueMat.emissiveIntensity = s <= 0 ? 4.6 : 0.45;
        }
      }

      // Surface scratches intensify as HP drops
      const hpLossRatio = Math.max(0, 1 - car.hp / Math.max(1, car.maxHp));
      rig.scratchMat.opacity = Math.min(0.92, hpLossRatio * 1.15);

      // Engine hood smoke proportional to Pursuit vehicle damage (more intense below 30 HP / wrecked)
      if (this.mode === 'pursuit' && hpLossRatio > 0.22) {
        const smokeProb = car.wrecked ? 0.85 : Math.min(0.7, hpLossRatio * 0.85);
        if (Math.random() < smokeProb) {
          const fwdX = Math.sin(car.yaw);
          const fwdZ = Math.cos(car.yaw);
          const critical = car.hp < PHYSICS_CONFIG.lowHpThreshold || car.wrecked;
          this.world.spawnTrailParticle(
            car.x + fwdX * 1.35 + (Math.random() - 0.5) * 0.45,
            0.78,
            car.z + fwdZ * 1.35 + (Math.random() - 0.5) * 0.45,
            (Math.random() - 0.5) * 1.4,
            1.6 + Math.random() * 1.8,
            (Math.random() - 0.5) * 1.4,
            critical ? (Math.random() < 0.28 ? 0xf97316 : 0x334155) : 0x64748b,
            critical ? 1.25 : 0.9
          );
        }
      }

      const boostFlamesOn = car.isNitroActive && !car.wrecked;
      rig.nitroGlowMat.color.setHex(0x38bdf8);
      for (const flame of rig.nitroFlames) {
        flame.visible = boostFlamesOn;
        if (boostFlamesOn) {
          const flicker = 0.85 + Math.random() * 0.45;
          flame.scale.set(0.95, 0.95, flicker * 1.25);
        }
      }

      if (boostFlamesOn && Math.random() < 0.75) {
        const fwdX = Math.sin(car.yaw);
        const fwdZ = Math.cos(car.yaw);
        this.world.spawnTrailParticle(
          car.x - fwdX * 2.35 + (Math.random() - 0.5) * 0.7,
          0.32,
          car.z - fwdZ * 2.35 + (Math.random() - 0.5) * 0.7,
          -fwdX * 8 + (Math.random() - 0.5) * 2.5,
          0.6 + Math.random() * 1.5,
          -fwdZ * 8 + (Math.random() - 0.5) * 2.5,
          0x38bdf8,
          0.75
        );
      }

      if (car.isDrifting) {
        const fwdX = Math.sin(car.yaw);
        const fwdZ = Math.cos(car.yaw);
        const rightX = -fwdZ;
        const rightZ = fwdX;
        for (const side of [-0.88, 0.88]) {
          this.world.spawnTrailParticle(
            car.x - fwdX * 1.45 + rightX * side + (Math.random() - 0.5) * 0.25,
            0.22,
            car.z - fwdZ * 1.45 + rightZ * side + (Math.random() - 0.5) * 0.25,
            (Math.random() - 0.5) * 2.2,
            1.2 + Math.random() * 1.5,
            (Math.random() - 0.5) * 2.2,
            0xcbd5e1,
            1.08
          );
        }
      }

      if (car.justActivatedNitro) {
        this.world.spawnBurst(car.x, 0.75, car.z, 0x38bdf8, 16, 1.15);
        if (car.isPlayer) {
          this.audio.playOrbPickup();
        }
      }

      if (car.justHitBoostPad) {
        this.world.spawnBurst(car.x, 0.65, car.z, 0xfacc15, 16, 1.15);
        if (car.isPlayer) {
          this.audio.playOrbPickup();
        }
      }

      if (car.justCollidedStrength > 0.14 || car.justTookDamage > 0) {
        this.world.spawnBurst(car.x, 0.55, car.z, 0xf97316, 10, 0.9);
        if (car.isPlayer) {
          const hitStrength = Math.max(car.justCollidedStrength, car.justTookDamage > 0 ? 0.55 : 0);
          this.cameraTrauma = Math.min(1, this.cameraTrauma + hitStrength * 0.7);
          this.audio.playCollision(hitStrength);
        }
      }

      if (car.isOnSand && Math.abs(car.speed) > 2 && Math.random() < 0.7) {
        const fwdX = Math.sin(car.yaw);
        const fwdZ = Math.cos(car.yaw);
        this.world.spawnTrailParticle(
          car.x - fwdX * 1.4 + (Math.random() - 0.5) * 1.2,
          0.25,
          car.z - fwdZ * 1.4 + (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 3.0,
          1.4 + Math.random() * 1.8,
          (Math.random() - 0.5) * 3.0,
          0xdca54a,
          1.15
        );
      }

      if (car.justFellInWater) {
        this.world.spawnBurst(car.waterSplashX, 0.85, car.waterSplashZ, 0xbae6fd, 26, 1.35);
        if (car.isPlayer) {
          this.audio.playCollision(0.95);
          this.cameraTrauma = 0.65;
          this.waterSplashNoticeTimer = 2.4;
          const fwdX = Math.sin(car.yaw);
          const fwdZ = Math.cos(car.yaw);
          this.camera.position.set(car.x - fwdX * 8.6, 3.5, car.z - fwdZ * 8.6);
          this.camera.lookAt(car.x + fwdX * 10, 1.1, car.z + fwdZ * 10);
        }
      }

      if (car.justWrecked) {
        this.world.spawnBurst(car.wreckX, 0.95, car.wreckZ, 0xf97316, 26, 1.45);
        this.world.spawnBurst(car.wreckX, 1.15, car.wreckZ, 0x334155, 16, 1.15);
        if (car.isPlayer && this.mode === 'race') {
          this.audio.playCollision(1.0);
          this.cameraTrauma = 0.88;
          this.wreckAlertTimer = 2.6;
          this.lastWreckReason = car.wreckReason;
          const fwdX = Math.sin(car.yaw);
          const fwdZ = Math.cos(car.yaw);
          this.camera.position.set(car.x - fwdX * 8.6, 3.5, car.z - fwdZ * 8.6);
          this.camera.lookAt(car.x + fwdX * 10, 1.1, car.z + fwdZ * 10);
        } else if (!car.isPlayer && this.mode === 'pursuit') {
          this.audio.playCollision(0.85);
        }
      }
    }

    if (this.mode === 'pursuit') {
      this.rimLight.color.setHex(sirenPhase > 0 ? 0xef4444 : 0x2563eb);
    }

    this.world.syncConstructionHazards(
      this.sim.constructionVehicles,
      this.sim.wreckingBall,
      this.elapsed
    );
    this.world.syncPursuitObstacles(this.sim.pursuitObstacles);
    this.world.updateEffects(dt, this.elapsed);
  }

  private emitHudSnapshot(): void {
    const player = this.sim.racers[0];
    const standings = getStandings(this.sim.racers);
    const playerStanding = standings.find((s) => s.isPlayer) ?? standings[0];

    const speedKmh = Math.round(Math.abs(player.speed) * 3.6);
    const maxKmh = Math.round(
      (this.mapId === 'ice-arena'
        ? PHYSICS_CONFIG.iceNitroMaxSpeed
        : PHYSICS_CONFIG.nitroMaxSpeed *
          (this.mode === 'pursuit' ? PHYSICS_CONFIG.pursuitPlayerSpeedScale : 1)) * 3.6
    );
    const normSpeed = Math.min(1.15, speedKmh / maxKmh);
    const gear =
      speedKmh < 4
        ? 1
        : Math.min(6, Math.max(1, Math.floor((speedKmh / maxKmh) * 5) + 1));
    const rpmRatio = Math.min(
      1,
      0.18 + ((normSpeed * 4.2) % 1) * 0.75 + (player.isNitroActive ? 0.15 : 0)
    );

    const policeChasers = this.sim.racers.filter((r) => r.role === 'police-chaser');
    const policeActiveCount = policeChasers.filter((r) => !r.wrecked).length;
    const policeWreckedCount = this.sim.racers.filter(
      (r) => (r.role === 'police-chaser' || r.role === 'police-roadblock') && r.wrecked
    ).length;
    const progressPct = Math.min(100, Math.max(0, Math.round(player.trackT * 100)));
    const distanceLeftMeters = Math.max(
      0,
      Math.round((1 - Math.min(1, Math.max(0, player.trackT))) * this.track.totalLength)
    );

    this.callbacks.onHudUpdate({
      mode: this.mode,
      speedKmh,
      rpmRatio,
      gear,
      nitro: Math.round(player.nitro),
      isNitroActive: player.isNitroActive,
      isPadBoostActive: false,
      isDrifting: player.isDrifting,
      isOnIce: this.mapId === 'ice-arena',
      isOnSand: player.isOnSand,
      hp: Math.round(player.hp),
      maxHp: player.maxHp,
      isDamagedSlow: this.mode === 'pursuit' && player.hp < PHYSICS_CONFIG.lowHpThreshold,
      progressPct,
      distanceLeftMeters,
      policeActiveCount,
      policeWreckedCount,
      damageAlertTimer: this.sim.damageAlertTimer,
      lastDamageAmount: this.sim.lastDamageAmount,
      surroundPct: Math.min(100, Math.round((this.sim.surroundTimer / 0.68) * 100)),
      waterSplashTimer: this.waterSplashNoticeTimer,
      wreckAlertTimer: this.wreckAlertTimer,
      wreckReason: this.lastWreckReason,
      lap: Math.min(TOTAL_LAPS, player.lap),
      totalLaps: this.mode === 'pursuit' ? 1 : TOTAL_LAPS,
      position: playerStanding.position,
      totalCars: standings.length,
      raceTime: this.sim.raceTime,
      countdown: this.sim.countdown,
      goFlash: this.usedIntroThisRace && this.sim.countdown <= 0 && this.sim.raceTime < 0.85,
      introSpotlight: this.getIntroSpotlight(),
      standings,
      minimapCars: this.sim.racers.map((r) => ({
        id: r.id,
        x: r.x,
        z: r.z,
        yaw: r.yaw,
        isPlayer: r.isPlayer,
        role: r.role,
        wrecked: r.wrecked,
        color: r.isPlayer
          ? this.playerAppearance.accentColor
          : r.role === 'police-roadblock'
            ? '#ef4444'
            : r.role === 'police-chaser'
              ? '#38bdf8'
              : r.primaryColor,
      })),
      minimapBoostPads: this.sim.boostPads.map((p) => ({
        id: p.id,
        x: p.x,
        z: p.z,
      })),
    });
  }

  private lastSpotlightPos = 0;

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = Math.max(0.001, (now - this.lastTimestamp) / 1000);
    this.lastTimestamp = now;
    const dt = Math.min(rawDt, 0.05);
    const activeBudget = this.sim.finished ? Math.min(rawDt, 0.5) : Math.min(rawDt, 0.2);

    if (this.phase === 'title') {
      this.elapsed += dt;
      this.positionTitleCamera(this.elapsed);
      this.world.updateEffects(dt, this.elapsed);
      this.weatherSystem.update(dt, this.elapsed, this.camera.position, 0, false);
      this.audio.updatePursuitSiren(false, 0, this.elapsed);
    } else if (this.phase === 'playing' || this.phase === 'gameover') {
      this.elapsed += activeBudget;
      if (this.waterSplashNoticeTimer > 0) {
        this.waterSplashNoticeTimer = Math.max(0, this.waterSplashNoticeTimer - dt);
      }
      if (this.wreckAlertTimer > 0) {
        this.wreckAlertTimer = Math.max(0, this.wreckAlertTimer - dt);
      }
      const input =
        this.phase === 'playing'
          ? resolvePlayerInput(this.pressedCodes, this.bindings)
          : { throttle: 0, brake: 0, steer: 0, nitro: false, drift: false };

      if (this.sim.countdown > 0) {
        const prevCd = this.sim.countdown;
        stepRaceSimulation(this.sim, input, Math.min(rawDt, 0.85), this.resetRequested);
        if (prevCd > COUNTDOWN_SECONDS && this.sim.countdown <= COUNTDOWN_SECONDS) {
          this.hudEmitAccum = 1;
        }
      } else {
        const subSteps = Math.max(1, Math.min(12, Math.ceil(activeBudget / 0.04)));
        const subDt = activeBudget / subSteps;
        for (let s = 0; s < subSteps; s++) {
          stepRaceSimulation(this.sim, input, subDt, s === 0 && this.resetRequested);
          if (this.phase === 'playing' && !this.sim.finished) {
            this.world.recordSkidMarks(this.sim.racers);
          }
        }
      }
      this.resetRequested = false;

      this.syncCarMeshes(dt);
      if (this.sim.finished) {
        this.updateFinishCamera(Math.min(rawDt, 0.25));
      } else if (this.sim.countdown > 0) {
        this.updatePreRaceCamera(Math.min(rawDt, 0.25));
      } else {
        this.updateChaseCamera(dt);
      }

      const player = this.sim.racers[0];
      const boostActive = player.isNitroActive;
      this.weatherSystem.update(
        dt,
        this.elapsed,
        this.camera.position,
        player.yaw,
        boostActive && !this.sim.finished
      );

      const speedRatio = (Math.abs(player.speed) / PHYSICS_CONFIG.baseMaxSpeed) * 1.5;
      const keepFinishAudio =
        this.sim.finished &&
        this.sim.winnerId === player.id &&
        this.sim.postFinishTime < 2.4;
      this.audio.updateEngine(
        speedRatio,
        boostActive,
        player.isDrifting,
        !this.sim.finished || keepFinishAudio
      );

      if (this.mode === 'pursuit' && !this.sim.finished && this.sim.countdown <= 0) {
        let nearestPoliceDist = Infinity;
        for (const r of this.sim.racers) {
          if (r.role === 'police-chaser' && !r.wrecked) {
            const d = Math.hypot(r.x - player.x, r.z - player.z);
            if (d < nearestPoliceDist) nearestPoliceDist = d;
          }
        }
        const proximity =
          nearestPoliceDist < 120 ? Math.max(0.05, 1 - nearestPoliceDist / 120) : 0;
        this.audio.updatePursuitSiren(proximity > 0, proximity, this.elapsed);
      } else {
        this.audio.updatePursuitSiren(false, 0, this.elapsed);
      }

      let forceHudEmit = false;
      const spotlight = this.getIntroSpotlight();
      const spotlightPos = spotlight ? spotlight.gridPos : 0;
      if (spotlightPos !== this.lastSpotlightPos) {
        this.lastSpotlightPos = spotlightPos;
        forceHudEmit = true;
      }

      if (this.sim.countdown > 0 && this.sim.countdown <= COUNTDOWN_SECONDS) {
        const countdownCeil = Math.ceil(this.sim.countdown);
        if (countdownCeil !== this.lastCountdownInt) {
          this.lastCountdownInt = countdownCeil;
          this.audio.playCountdownBeep(false);
          forceHudEmit = true;
        }
      } else if (this.sim.countdown <= 0 && this.lastCountdownInt > 0) {
        this.lastCountdownInt = 0;
        this.audio.playCountdownBeep(true);
        forceHudEmit = true;
      }

      if (this.sim.finished && !this.finishReported) {
        this.reportFinishIfNeeded();
      }

      this.hudEmitAccum += rawDt;
      if (forceHudEmit || this.hudEmitAccum >= 0.05) {
        this.hudEmitAccum = 0;
        this.emitHudSnapshot();
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  };

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.world.dispose();
    this.weatherSystem.dispose();
    for (const rig of this.carRigs) {
      rig.dispose();
    }
    this.envRT.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
