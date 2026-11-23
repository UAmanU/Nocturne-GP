import { useCallback, useEffect, useRef, useState } from 'react';
import { CloudRain, MapPin, Play, Snowflake, Sun } from 'lucide-react';
import {
  MAP_OPTIONS,
  TOTAL_LAPS,
  WEATHER_OPTIONS,
  type CarAppearance,
  type GameMode,
  type GamePhase,
  type GraphicsQuality,
  type HudSnapshot,
  type KeyBindings,
  type MapId,
  type RaceFinishSummary,
  type WeatherMode,
} from './game/types';
import { normalizeGraphicsQuality } from './game/graphics';
import { loadKeyBindings, saveKeyBindings } from './game/controls';
import {
  isPursuitMap,
  loadCarAppearance,
  loadGameSettings,
  normalizeGameSettings,
  pickRandomMap,
  pickWeatherForMap,
  resolveWeatherForMap,
  saveCarAppearance,
  saveGameSettings,
  type GameSettings,
} from './game/garage';
import { ProceduralAudioEngine } from './game/audio';
import { RacingEngine } from './game/RacingEngine';
import { TitleOverlay } from './components/TitleOverlay';
import { SettingsModal } from './components/SettingsModal';
import { GarageModal } from './components/GarageModal';
import { RaceHud } from './components/RaceHud';
import { FinishModal, PauseModal } from './components/Modals';

const MAP_HIGHLIGHTS: Record<MapId, string> = {
  'night-city': 'Neon Skyscrapers · Boost Pads · City Night',
  beach: 'Giant Waterpark · Coastal Resort · Sunny Boardwalk',
  'day-city': 'Downtown Plaza · Vibrant Street Shops · Skyline',
  'ice-arena': 'Slick Glacier Ice · Ice Rink · Open Water Hazards',
  construction: 'Skyscraper Build · Crane Wrecking Ball · Heavy Machinery · Road Sand',
  'pursuit-highway': 'Night Freeway · 3 Police Interceptors · Roadblocks & Shortcuts',
  'pursuit-docks': 'Night Harbor Docks · Cargo Escape · Risky Pier Bypass',
  'pursuit-industrial': 'Refinery Sector · Night Patrol · Multi-Route Escape',
};

const INITIAL_HUD: HudSnapshot = {
  mode: 'race',
  speedKmh: 0,
  rpmRatio: 0.18,
  gear: 1,
  nitro: 0,
  isNitroActive: false,
  isPadBoostActive: false,
  isDrifting: false,
  isOnIce: false,
  isOnSand: false,
  hp: 200,
  maxHp: 200,
  isDamagedSlow: false,
  progressPct: 0,
  distanceLeftMeters: 0,
  policeActiveCount: 0,
  policeWreckedCount: 0,
  surroundPct: 0,
  damageAlertTimer: 0,
  lastDamageAmount: 0,
  waterSplashTimer: 0,
  wreckAlertTimer: 0,
  wreckReason: null,
  lap: 1,
  totalLaps: TOTAL_LAPS,
  position: 4,
  totalCars: 4,
  raceTime: 0,
  countdown: 6.6,
  goFlash: false,
  introSpotlight: null,
  standings: [],
  minimapCars: [],
  minimapBoostPads: [],
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RacingEngine | null>(null);
  const audioRef = useRef<ProceduralAudioEngine | null>(null);

  const [bindings, setBindings] = useState<KeyBindings>(() => loadKeyBindings());
  const bindingsRef = useRef<KeyBindings>(bindings);

  const [appearance, setAppearance] = useState<CarAppearance>(() => loadCarAppearance());
  const appearanceRef = useRef<CarAppearance>(appearance);

  const [gameSettings, setGameSettings] = useState<GameSettings>(() => {
    const saved = loadGameSettings();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const qMode = params.get('mode') as GameMode | null;
      const qMap = params.get('map') as MapId | null;
      const qWeather = params.get('weather') as WeatherMode | null;
      const qQuality = params.get('quality');
      const resolvedMode: GameMode =
        qMode === 'pursuit' || qMode === 'race'
          ? qMode
          : qMap && isPursuitMap(qMap)
            ? 'pursuit'
            : qMap
              ? 'race'
              : saved.mode;
      const normalized = normalizeGameSettings({
        mode: resolvedMode,
        mapId: qMap ?? (resolvedMode !== saved.mode ? pickRandomMap(Math.random, undefined, resolvedMode) : saved.mapId),
        graphicsQuality: qQuality !== null ? normalizeGraphicsQuality(qQuality) : saved.graphicsQuality,
      });
      return {
        mode: normalized.mode,
        mapId: normalized.mapId,
        weather: qWeather
          ? resolveWeatherForMap(normalized.mapId, qWeather)
          : pickWeatherForMap(normalized.mapId),
        graphicsQuality: normalized.graphicsQuality,
      };
    }
    return {
      mode: saved.mode,
      mapId: saved.mapId,
      weather: pickWeatherForMap(saved.mapId),
      graphicsQuality: saved.graphicsQuality,
    };
  });
  const gameSettingsRef = useRef<GameSettings>(gameSettings);

  const [phase, setPhase] = useState<GamePhase>('title');
  const phaseRef = useRef<GamePhase>('title');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsOpenRef = useRef(false);

  const [garageOpen, setGarageOpen] = useState(false);
  const garageOpenRef = useRef(false);

  const [muted, setMuted] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [finishSummary, setFinishSummary] = useState<RaceFinishSummary | null>(null);
  const [matchReveal, setMatchReveal] = useState<{
    mode: GameMode;
    mapId: MapId;
    weather: WeatherMode;
  } | null>(null);
  const matchRevealRef = useRef<{ mode: GameMode; mapId: MapId; weather: WeatherMode } | null>(null);
  const revealTimeoutRef = useRef<number | null>(null);

  const [trackOutline, setTrackOutline] = useState<Array<{ x: number; z: number }>>([]);
  const [trackBranches, setTrackBranches] = useState<Array<Array<{ x: number; z: number }>>>([]);
  const [trackBounds, setTrackBounds] = useState({
    minX: -160,
    maxX: 160,
    minZ: -160,
    maxZ: 160,
  });

  const applyPhase = useCallback((nextPhase: GamePhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
    document.body.dataset.state = nextPhase;
    engineRef.current?.setPhase(nextPhase);
  }, []);

  const handleOpenGarage = useCallback(() => {
    setGarageOpen(true);
    garageOpenRef.current = true;
    engineRef.current?.setGarageShowcase(true);
  }, []);

  const handleCloseGarage = useCallback(() => {
    setGarageOpen(false);
    garageOpenRef.current = false;
    engineRef.current?.setGarageShowcase(false);
  }, []);

  const clearRevealTimer = useCallback(() => {
    if (revealTimeoutRef.current !== null) {
      window.clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
  }, []);

  const handleSelectMode = useCallback((nextMode: GameMode) => {
    if (gameSettingsRef.current.mode === nextMode) return;
    const nextMap = pickRandomMap(Math.random, undefined, nextMode);
    const nextWeather = pickWeatherForMap(nextMap);
    const nextSettings: GameSettings = {
      ...gameSettingsRef.current,
      mode: nextMode,
      mapId: nextMap,
      weather: nextWeather,
    };
    gameSettingsRef.current = nextSettings;
    setGameSettings(nextSettings);
    saveGameSettings(nextSettings);

    const engine = engineRef.current;
    if (engine) {
      engine.setMap(nextMap);
      engine.setWeather(nextWeather);
      setTrackOutline(engine.getTrackOutline());
      setTrackBranches(engine.getTrackBranches());
      setTrackBounds(engine.getTrackBounds());
    }
  }, []);

  const enterArenaNow = useCallback(
    (skipCountdown = false) => {
      clearRevealTimer();
      matchRevealRef.current = null;
      setMatchReveal(null);
      audioRef.current?.ensureStarted();
      engineRef.current?.startNewRace(skipCountdown);
      applyPhase('playing');
    },
    [applyPhase, clearRevealTimer]
  );

  const handleStartRace = useCallback(
    (skipCountdown = false, showReveal = true) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      clearRevealTimer();
      setSettingsOpen(false);
      settingsOpenRef.current = false;
      setGarageOpen(false);
      garageOpenRef.current = false;
      engineRef.current?.setGarageShowcase(false);
      setFinishSummary(null);

      // Auto-select random map (for active mode) & allowed weather unless explicitly locked via URL params
      const params =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search)
          : null;
      const qMap = params?.get('map') as MapId | null;
      const qWeather = params?.get('weather') as WeatherMode | null;
      const activeMode = gameSettingsRef.current.mode;

      const nextMap = qMap
        ? normalizeGameSettings({
            mode: isPursuitMap(qMap) ? 'pursuit' : 'race',
            mapId: qMap,
          }).mapId
        : pickRandomMap(Math.random, gameSettingsRef.current.mapId, activeMode);
      const nextMode: GameMode = isPursuitMap(nextMap) ? 'pursuit' : 'race';
      const nextWeather = qWeather
        ? resolveWeatherForMap(nextMap, qWeather)
        : pickWeatherForMap(nextMap);

      const nextSettings: GameSettings = {
        ...gameSettingsRef.current,
        mode: nextMode,
        mapId: nextMap,
        weather: nextWeather,
      };
      gameSettingsRef.current = nextSettings;
      setGameSettings(nextSettings);
      saveGameSettings(nextSettings);

      const engine = engineRef.current;
      if (engine) {
        engine.setMap(nextMap);
        engine.setWeather(nextWeather);
        setTrackOutline(engine.getTrackOutline());
        setTrackBranches(engine.getTrackBranches());
        setTrackBounds(engine.getTrackBounds());
      }

      audioRef.current?.ensureStarted();

      if (showReveal && !skipCountdown) {
        const reveal = { mode: nextMode, mapId: nextMap, weather: nextWeather };
        matchRevealRef.current = reveal;
        setMatchReveal(reveal);
        revealTimeoutRef.current = window.setTimeout(() => {
          enterArenaNow(false);
        }, 2200);
      } else {
        enterArenaNow(skipCountdown);
      }
    },
    [clearRevealTimer, enterArenaNow]
  );

  const handlePauseToggle = useCallback(() => {
    if (phaseRef.current === 'playing') {
      applyPhase('paused');
    } else if (phaseRef.current === 'paused') {
      setSettingsOpen(false);
      settingsOpenRef.current = false;
      applyPhase('playing');
    }
  }, [applyPhase]);

  const handleReturnToTitle = useCallback(() => {
    clearRevealTimer();
    matchRevealRef.current = null;
    setMatchReveal(null);
    setSettingsOpen(false);
    settingsOpenRef.current = false;
    setGarageOpen(false);
    garageOpenRef.current = false;
    engineRef.current?.setGarageShowcase(false);
    setFinishSummary(null);
    engineRef.current?.startNewRace(false);
    applyPhase('title');
  }, [applyPhase, clearRevealTimer]);

  const handleBindingsChange = useCallback((next: KeyBindings) => {
    bindingsRef.current = next;
    setBindings(next);
    saveKeyBindings(next);
    engineRef.current?.setKeyBindings(next);
  }, []);

  const handleAppearanceChange = useCallback((next: CarAppearance) => {
    appearanceRef.current = next;
    setAppearance(next);
    saveCarAppearance(next);
    engineRef.current?.setPlayerAppearance(next);
  }, []);

  const handleGraphicsQualityChange = useCallback((nextQuality: GraphicsQuality) => {
    const nextSettings: GameSettings = {
      ...gameSettingsRef.current,
      graphicsQuality: nextQuality,
    };
    gameSettingsRef.current = nextSettings;
    setGameSettings(nextSettings);
    saveGameSettings(nextSettings);
    engineRef.current?.setGraphicsQuality(nextQuality);
  }, []);

  const handleToggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.ensureStarted();
    const nextMuted = !audio.isMuted();
    audio.setMuted(nextMuted);
    setMuted(nextMuted);
  }, []);

  const handleResetCar = useCallback(() => {
    engineRef.current?.requestResetPlayerCar();
  }, []);

  const handleSkipIntro = useCallback(() => {
    audioRef.current?.ensureStarted();
    engineRef.current?.skipIntro();
  }, []);

  const handleTouchKey = useCallback((code: string, down: boolean) => {
    audioRef.current?.ensureStarted();
    engineRef.current?.setPressedCode(code, down);
  }, []);

  // Initialize Three.js WebGL engine once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const audio = new ProceduralAudioEngine();
    audioRef.current = audio;

    const engine = new RacingEngine(
      container,
      bindingsRef.current,
      appearanceRef.current,
      gameSettingsRef.current.mapId,
      gameSettingsRef.current.weather,
      audio,
      {
        onHudUpdate: (snapshot) => {
          setHud(snapshot);
        },
        onRaceFinish: (summary) => {
          setFinishSummary(summary);
          applyPhase('gameover');
        },
        onContextLost: (lost) => {
          setContextLost(lost);
        },
      },
      gameSettingsRef.current.graphicsQuality
    );
    engineRef.current = engine;

    setTrackOutline(engine.getTrackOutline());
    setTrackBranches(engine.getTrackBranches());
    setTrackBounds(engine.getTrackBounds());

    const params = new URLSearchParams(window.location.search);
    const testFinish = params.get('testFinish');
    if (testFinish === 'win' || testFinish === 'loss') {
      applyPhase('playing');
      engine.forceFinishForTest(testFinish === 'win');
    } else if (params.get('autostart') === '1') {
      engine.startNewRace(true);
      const testTRaw = params.get('testT');
      if (testTRaw !== null) {
        const parsedT = Number(testTRaw);
        if (Number.isFinite(parsedT)) {
          engine.placePlayerAtTForTest(parsedT, 22);
        }
      }
      applyPhase('playing');
    } else {
      document.body.dataset.state = 'title';
    }

    return () => {
      clearRevealTimer();
      engine.dispose();
      audio.dispose();
      engineRef.current = null;
      audioRef.current = null;
    };
  }, [applyPhase, clearRevealTimer]);

  useEffect(() => {
    settingsOpenRef.current = settingsOpen;
  }, [settingsOpen]);

  useEffect(() => {
    garageOpenRef.current = garageOpen;
  }, [garageOpen]);

  // Unified keyboard listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (settingsOpenRef.current || garageOpenRef.current) return;

      if (matchRevealRef.current) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          enterArenaNow(false);
        }
        return;
      }

      const currentPhase = phaseRef.current;
      const b = bindingsRef.current;

      if (currentPhase === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartRace(false, true);
        }
        return;
      }

      if (currentPhase === 'gameover') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartRace(false, true);
        }
        return;
      }

      if (e.code === b.pause || e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        handlePauseToggle();
        return;
      }

      if (e.code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
        return;
      }

      if (currentPhase === 'playing') {
        if (e.code === 'Enter') {
          engineRef.current?.skipIntro();
        }
        if (e.code === b.resetCar) {
          e.preventDefault();
          engineRef.current?.requestResetPlayerCar();
          return;
        }
        if (e.code === 'Space' || e.code.startsWith('Arrow')) {
          e.preventDefault();
        }
        audioRef.current?.ensureStarted();
        engineRef.current?.setPressedCode(e.code, true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      engineRef.current?.setPressedCode(e.code, false);
    };

    const clearInputs = () => {
      engineRef.current?.clearInputs();
    };

    const onVisibility = () => {
      if (document.hidden) clearInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enterArenaNow, handlePauseToggle, handleStartRace, handleToggleMute]);

  const revealMapMeta = matchReveal
    ? MAP_OPTIONS.find((m) => m.id === matchReveal.mapId) ?? MAP_OPTIONS[0]
    : null;
  const revealWeatherMeta = matchReveal
    ? WEATHER_OPTIONS.find((w) => w.id === matchReveal.weather) ?? WEATHER_OPTIONS[0]
    : null;

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#050814]">
      <div
        ref={mountRef}
        data-testid="race-canvas-container"
        className="fixed inset-0 w-full h-full"
      />

      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050814]/95 p-6 text-center">
          <div className="max-w-md rounded-xl bg-[#0c1220] border border-slate-700 p-6">
            <h2 className="font-display text-xl font-bold text-slate-100 mb-2">
              WebGL Context Paused
            </h2>
            <p className="text-sm text-slate-300">
              Restoring the 3D scene. Reload the page if rendering does not resume.
            </p>
          </div>
        </div>
      )}

      {phase === 'title' && !garageOpen && !matchReveal && (
        <TitleOverlay
          mode={gameSettings.mode}
          bindings={bindings}
          onSelectMode={handleSelectMode}
          onStart={() => handleStartRace(false, true)}
          onOpenGarage={handleOpenGarage}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {matchReveal && revealMapMeta && revealWeatherMeta && (
        <div
          data-testid="match-reveal-overlay"
          className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[#050814]/70"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#0c1220]/96 border border-slate-700/80 shadow-2xl p-6 text-center">
            <div
              className={`text-xs font-display font-bold tracking-[0.28em] uppercase mb-2 ${
                matchReveal.mode === 'pursuit' ? 'text-sky-400' : 'text-amber-400'
              }`}
            >
              {matchReveal.mode === 'pursuit'
                ? 'Pursuit Selected · Cargo Escape'
                : 'Arena Selected · 3-Lap Race'}
            </div>
            <h2
              data-testid="match-reveal-map-name"
              className="font-display text-3xl font-extrabold text-slate-50 tracking-tight"
            >
              {revealMapMeta.name}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">{revealMapMeta.subtitle}</p>

            <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#141d35] border border-slate-700/80 text-sm font-semibold text-slate-100">
              {matchReveal.weather === 'rain' ? (
                <CloudRain className="w-4 h-4 text-sky-400" aria-hidden="true" />
              ) : matchReveal.weather === 'snow' ? (
                <Snowflake className="w-4 h-4 text-cyan-200" aria-hidden="true" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
              )}
              <span data-testid="match-reveal-weather">
                Weather: {revealWeatherMeta.name}
              </span>
            </div>

            <div className="mt-4 px-3 py-2 rounded-lg bg-[#090e1c] border border-slate-800 text-xs text-slate-300 flex items-center justify-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-orange-400 shrink-0" aria-hidden="true" />
              <span>{MAP_HIGHLIGHTS[matchReveal.mapId]}</span>
            </div>

            <div className="mt-5 flex justify-center">
              <button
                type="button"
                data-testid="enter-arena-btn"
                onClick={() => enterArenaNow(false)}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-display font-bold text-sm tracking-wide transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>Enter Arena</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {(phase === 'playing' || phase === 'paused') && (
        <RaceHud
          hud={hud}
          mapId={gameSettings.mapId}
          trackOutline={trackOutline}
          trackBranches={trackBranches}
          trackBounds={trackBounds}
          bindings={bindings}
          muted={muted}
          onToggleMute={handleToggleMute}
          onPause={handlePauseToggle}
          onResetCar={handleResetCar}
          onSkipIntro={handleSkipIntro}
          onTouchKey={handleTouchKey}
        />
      )}

      {phase === 'paused' && !settingsOpen && (
        <PauseModal
          mode={gameSettings.mode}
          onResume={handlePauseToggle}
          onRestart={() => handleStartRace(false, false)}
          onOpenSettings={() => setSettingsOpen(true)}
          onMainMenu={handleReturnToTitle}
        />
      )}

      {phase === 'gameover' && finishSummary && !matchReveal && (
        <FinishModal
          summary={finishSummary}
          onPlayAgain={() => handleStartRace(false, true)}
          onMainMenu={handleReturnToTitle}
        />
      )}

      <GarageModal
        isOpen={garageOpen}
        appearance={appearance}
        onChangeAppearance={handleAppearanceChange}
        onClose={handleCloseGarage}
      />

      <SettingsModal
        isOpen={settingsOpen}
        bindings={bindings}
        graphicsQuality={gameSettings.graphicsQuality}
        onChangeBindings={handleBindingsChange}
        onChangeGraphicsQuality={handleGraphicsQualityChange}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
