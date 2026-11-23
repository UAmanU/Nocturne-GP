import React, { useMemo } from 'react';
import { Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import {
  MAP_OPTIONS,
  type HudSnapshot,
  type KeyBindings,
  type MapId,
} from '../game/types';
import { formatKeyCode } from '../game/controls';

interface RaceHudProps {
  hud: HudSnapshot;
  mapId: MapId;
  trackOutline: Array<{ x: number; z: number }>;
  trackBranches: Array<Array<{ x: number; z: number }>>;
  trackBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  bindings: KeyBindings;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onResetCar: () => void;
  onSkipIntro: () => void;
  onTouchKey: (code: string, down: boolean) => void;
}

function formatRaceTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds * 10) % 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export const RaceHud: React.FC<RaceHudProps> = ({
  hud,
  mapId,
  trackOutline,
  trackBranches,
  trackBounds,
  bindings,
  muted,
  onToggleMute,
  onPause,
  onResetCar,
  onSkipIntro,
  onTouchKey,
}) => {
  const { pathD, branchPaths, destPoint, mapWidth, mapHeight, toMapX, toMapY } = useMemo(() => {
    const w = 148;
    const h = 116;
    const pad = 12;
    const spanX = Math.max(1, trackBounds.maxX - trackBounds.minX);
    const spanZ = Math.max(1, trackBounds.maxZ - trackBounds.minZ);
    const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanZ);
    const offsetX = (w - spanX * scale) / 2;
    const offsetY = (h - spanZ * scale) / 2;

    const mapX = (wx: number) => offsetX + (wx - trackBounds.minX) * scale;
    const mapY = (wz: number) => offsetY + (wz - trackBounds.minZ) * scale;

    const d =
      trackOutline
        .map(
          (pt, idx) =>
            `${idx === 0 ? 'M' : 'L'} ${mapX(pt.x).toFixed(1)} ${mapY(pt.z).toFixed(1)}`
        )
        .join(' ') + (hud.mode === 'race' ? ' Z' : '');

    const branches = trackBranches.map((pts) =>
      pts
        .map(
          (pt, idx) =>
            `${idx === 0 ? 'M' : 'L'} ${mapX(pt.x).toFixed(1)} ${mapY(pt.z).toFixed(1)}`
        )
        .join(' ')
    );

    const lastPt = trackOutline.length > 0 ? trackOutline[trackOutline.length - 1] : null;
    const dest =
      hud.mode === 'pursuit' && lastPt
        ? { x: mapX(lastPt.x), y: mapY(lastPt.z) }
        : null;

    return {
      pathD: d,
      branchPaths: branches,
      destPoint: dest,
      mapWidth: w,
      mapHeight: h,
      toMapX: mapX,
      toMapY: mapY,
    };
  }, [trackOutline, trackBranches, trackBounds, hud.mode]);

  const radius = 54;
  const startDeg = 145;
  const totalArcDeg = 250;
  const circumference = 2 * Math.PI * radius;
  const maxArcLen = (totalArcDeg / 360) * circumference;
  const arcMaxKmh = hud.isOnIce ? 195 : hud.mode === 'pursuit' ? 190 : 175;
  const speedRatio = Math.min(1, hud.speedKmh / arcMaxKmh);
  const activeArcLen = maxArcLen * speedRatio;

  const mapTitle = MAP_OPTIONS.find((m) => m.id === mapId)?.name ?? 'Midnight City';
  const spotlight = hud.introSpotlight;
  const countdownDisplay =
    !spotlight && hud.countdown > 0.05
      ? Math.min(3, Math.ceil(hud.countdown))
      : null;

  if (spotlight) {
    return (
      <div
        data-testid="grid-intro-overlay"
        className="fixed inset-0 z-10 pointer-events-none select-none flex flex-col justify-between"
      >
        <div className="w-full h-14 md:h-16 bg-[#050814] border-b border-slate-800/80 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" aria-hidden="true" />
            <span className="font-display text-xs md:text-sm font-bold tracking-[0.22em] text-slate-200 uppercase">
              Starting Grid · {mapTitle}
            </span>
          </div>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onSkipIntro();
            }}
            className="pointer-events-auto px-3.5 py-1.5 rounded-lg bg-[#111930] hover:bg-[#1a2647] border border-slate-700/80 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
          >
            Skip Intro
          </button>
        </div>

        <div className="w-full h-20 md:h-24 bg-[#050814] border-t border-slate-800/80 px-6 md:px-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="w-1.5 h-11 rounded-full shrink-0"
              style={{ backgroundColor: spotlight.accentColor }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 text-[11px] font-mono-num font-bold tracking-widest text-amber-400 uppercase">
                <span>GRID P{spotlight.gridPos}</span>
                <span className="text-slate-600">·</span>
                <span>#{spotlight.number}</span>
                <span className="text-slate-600 hidden sm:inline">·</span>
                <span className="text-slate-400 hidden sm:inline">{spotlight.angleLabel}</span>
              </div>
              <div className="font-display text-xl md:text-2xl font-extrabold text-slate-100 truncate mt-0.5">
                {spotlight.name}{' '}
                <span className="text-slate-400 font-semibold text-base md:text-lg">
                  — {spotlight.carModelName}
                </span>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            {[1, 2, 3, 4].map((pos) => (
              <span
                key={pos}
                className={`h-1.5 rounded-full transition-all ${
                  pos === spotlight.gridPos
                    ? 'w-7 bg-amber-400'
                    : pos < spotlight.gridPos
                      ? 'w-3 bg-slate-500'
                      : 'w-3 bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Peripheral Nitro Wind Streaks + Glow when Nitro or Boost Pad is active */}
      {(hud.isNitroActive || hud.isPadBoostActive) && (
        <div
          data-testid="nitro-wind-overlay"
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none overflow-hidden"
          style={{
            boxShadow: hud.isNitroActive
              ? 'inset 0 0 95px rgba(56, 189, 248, 0.34)'
              : 'inset 0 0 85px rgba(250, 204, 21, 0.26)',
          }}
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="w-full h-full opacity-55"
          >
            <g stroke={hud.isNitroActive ? '#bae6fd' : '#fef08a'} strokeWidth="0.26">
              <line x1="2" y1="12" x2="18" y2="26" />
              <line x1="0" y1="38" x2="16" y2="43" />
              <line x1="2" y1="68" x2="18" y2="59" />
              <line x1="6" y1="90" x2="21" y2="75" />
              <line x1="98" y1="12" x2="82" y2="26" />
              <line x1="100" y1="38" x2="84" y2="43" />
              <line x1="98" y1="68" x2="82" y2="59" />
              <line x1="94" y1="90" x2="79" y2="75" />
            </g>
          </svg>
        </div>
      )}

      {/* TOP-LEFT: Race Position/Lap OR Pursuit HP/Cargo Route/Police */}
      {hud.mode === 'pursuit' ? (
        <div
          data-testid="pursuit-hud-panel"
          className="fixed top-5 left-5 flex items-stretch gap-4 px-4 py-2.5 rounded-xl bg-[#090e1c]/92 border border-slate-700/75 shadow-lg"
        >
          <div className="min-w-[92px]">
            <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-slate-400">
              <span>HP</span>
              <span
                data-testid="pursuit-hp-value"
                className={`font-mono-num font-bold ${
                  hud.hp / Math.max(1, hud.maxHp) < 0.3
                    ? 'text-rose-400'
                    : hud.hp / Math.max(1, hud.maxHp) < 0.6
                      ? 'text-amber-300'
                      : 'text-emerald-400'
                }`}
              >
                {hud.hp}/{hud.maxHp}
              </span>
            </div>
            <div className="w-24 h-2.5 rounded-full bg-slate-800 overflow-hidden mt-1.5">
              <div
                className="h-full rounded-full transition-[width] duration-100"
                style={{
                  width: `${Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100))}%`,
                  backgroundColor:
                    hud.hp / Math.max(1, hud.maxHp) < 0.3
                      ? '#f43f5e'
                      : hud.hp / Math.max(1, hud.maxHp) < 0.6
                        ? '#facc15'
                        : '#34d399',
                }}
              />
            </div>
            {hud.isDamagedSlow && (
              <div className="text-[10px] font-display font-bold tracking-wider text-rose-400 mt-1">
                -20% MAX SPD
              </div>
            )}
          </div>

          <div className="w-px bg-slate-800" aria-hidden="true" />

          <div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400">
              CARGO ROUTE
            </div>
            <div className="font-display text-2xl font-extrabold leading-none text-sky-300 font-mono-num mt-0.5">
              {hud.progressPct}%
            </div>
            <div className="font-mono-num text-[11px] text-slate-400 mt-0.5">
              {hud.distanceLeftMeters}m left
            </div>
          </div>

          <div className="w-px bg-slate-800" aria-hidden="true" />

          <div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400">
              POLICE
            </div>
            <div className="font-display text-2xl font-extrabold leading-none text-rose-400 font-mono-num mt-0.5">
              {hud.policeActiveCount}
              <span className="text-sm font-semibold text-slate-400">/3</span>
            </div>
            <div className="font-mono-num text-[11px] text-slate-400 mt-0.5">
              {formatRaceTime(hud.raceTime)}
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed top-5 left-5 flex items-stretch gap-4 px-4 py-2.5 rounded-xl bg-[#090e1c]/90 border border-slate-700/70 shadow-lg">
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400">
              POS
            </div>
            <div className="font-display text-3xl font-extrabold leading-none text-orange-400 font-mono-num mt-0.5">
              {hud.position}
              <span className="text-base font-semibold text-slate-400">
                /{hud.totalCars}
              </span>
            </div>
          </div>

          <div className="w-px bg-slate-800" aria-hidden="true" />

          <div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400">
              LAP
            </div>
            <div className="font-display text-3xl font-extrabold leading-none text-slate-100 font-mono-num mt-0.5">
              {hud.lap}
              <span className="text-base font-semibold text-slate-400">
                /{hud.totalLaps}
              </span>
            </div>
          </div>

          <div className="w-px bg-slate-800" aria-hidden="true" />

          <div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400">
              TIME
            </div>
            <div className="font-mono-num text-xl font-bold leading-none text-slate-100 mt-1.5">
              {formatRaceTime(hud.raceTime)}
            </div>
          </div>
        </div>
      )}

      {/* TOP-RIGHT: Compact Utility Controls */}
      <div className="fixed top-5 right-5 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onResetCar();
          }}
          title={`Reset to Track (${formatKeyCode(bindings.resetCar)})`}
          aria-label="Reset to Track"
          className="w-10 h-10 rounded-lg bg-[#090e1c]/90 hover:bg-[#131d36] border border-slate-700/70 flex items-center justify-center text-slate-200 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          title={muted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
          aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
          className="w-10 h-10 rounded-lg bg-[#090e1c]/90 hover:bg-[#131d36] border border-slate-700/70 flex items-center justify-center text-slate-200 transition-colors cursor-pointer"
        >
          {muted ? (
            <VolumeX className="w-4 h-4 text-rose-400" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onPause();
          }}
          title={`Pause (${formatKeyCode(bindings.pause)})`}
          aria-label="Pause"
          className="w-10 h-10 rounded-lg bg-[#090e1c]/90 hover:bg-[#131d36] border border-slate-700/70 flex items-center justify-center text-slate-200 transition-colors cursor-pointer"
        >
          <Pause className="w-4 h-4" />
        </button>
      </div>

      {/* CENTER: 3 - 2 - 1 - GO! Launch Countdown */}
      {countdownDisplay !== null && (
        <div
          data-testid="race-countdown"
          className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none"
        >
          <div className="text-xs font-display font-bold tracking-[0.35em] text-slate-300 uppercase mb-1 hud-stroke">
            GET READY
          </div>
          <div className="font-display text-8xl md:text-9xl font-extrabold text-amber-400 hud-stroke tracking-tight leading-none">
            {countdownDisplay}
          </div>
        </div>
      )}

      {countdownDisplay === null && hud.goFlash && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="font-display text-8xl md:text-9xl font-extrabold text-emerald-400 hud-stroke tracking-tight leading-none">
            GO!
          </div>
        </div>
      )}

      {hud.waterSplashTimer > 0 && (
        <div
          data-testid="water-hazard-alert"
          className="fixed top-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-sky-950/92 border border-sky-400/80 shadow-lg text-center pointer-events-none"
        >
          <div className="font-display text-xs font-extrabold tracking-widest text-sky-200 uppercase">
            Fell in Arctic Water · Returned to Lap Start
          </div>
        </div>
      )}

      {hud.wreckAlertTimer > 0 && (
        <div
          data-testid="construction-wreck-alert"
          className="fixed top-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-rose-950/94 border border-orange-400/85 shadow-lg text-center pointer-events-none"
        >
          <div className="font-display text-xs font-extrabold tracking-widest text-amber-200 uppercase">
            {hud.wreckReason === 'ball'
              ? 'Destroyed by Crane Wrecking Ball · Respawned'
              : 'Disabled by Heavy Machinery · Respawned'}
          </div>
        </div>
      )}

      {hud.mode === 'pursuit' && hud.damageAlertTimer > 0 && hud.lastDamageAmount > 0 && (
        <div
          data-testid="pursuit-damage-alert"
          className="fixed top-6 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-xl bg-rose-950/92 border border-rose-400/80 shadow-lg text-center pointer-events-none"
        >
          <div className="font-display text-xs font-extrabold tracking-widest text-rose-200 uppercase font-mono-num">
            -{hud.lastDamageAmount} HP · IMPACT
          </div>
        </div>
      )}

      {hud.mode === 'pursuit' && hud.surroundPct > 18 && (
        <div
          data-testid="pursuit-surround-alert"
          className="fixed top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-amber-950/94 border border-amber-400/85 shadow-lg text-center pointer-events-none"
        >
          <div className="font-display text-xs font-extrabold tracking-widest text-amber-200 uppercase font-mono-num">
            SURROUNDED! USE NITRO OR BREAK FREE · {hud.surroundPct}%
          </div>
        </div>
      )}

      {/* BOTTOM-LEFT: Compact Live Track Minimap (with open-route forks & extraction dot) */}
      <div className="fixed bottom-5 left-5 hidden sm:block p-2.5 rounded-xl bg-[#090e1c]/90 border border-slate-700/70 shadow-lg">
        <svg
          width={mapWidth}
          height={mapHeight}
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          aria-label="Track Minimap"
        >
          {branchPaths.map((bp, idx) => (
            <React.Fragment key={idx}>
              <path
                d={bp}
                fill="none"
                stroke="#1e293b"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={bp}
                fill="none"
                stroke="#475569"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </React.Fragment>
          ))}
          <path
            d={pathD}
            fill="none"
            stroke="#334155"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={pathD}
            fill="none"
            stroke="#64748b"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {destPoint && (
            <g aria-label="Extraction Checkpoint">
              <circle
                cx={destPoint.x}
                cy={destPoint.y}
                r={5.2}
                fill="none"
                stroke="#34d399"
                strokeWidth="1.6"
              />
              <circle cx={destPoint.x} cy={destPoint.y} r={2.3} fill="#34d399" />
            </g>
          )}
          {hud.minimapBoostPads.map((p) => (
            <rect
              key={p.id}
              x={toMapX(p.x) - 2}
              y={toMapY(p.z) - 2}
              width="4"
              height="4"
              rx="1"
              fill="#facc15"
            />
          ))}
          {hud.minimapCars.map((c) => (
            <circle
              key={c.id}
              cx={toMapX(c.x)}
              cy={toMapY(c.z)}
              r={c.isPlayer ? 4.4 : c.role === 'police-roadblock' ? 2.6 : 3.2}
              fill={c.color}
              opacity={c.wrecked ? 0.3 : 1}
              stroke="#060913"
              strokeWidth="1.4"
            />
          ))}
        </svg>
      </div>

      {/* BOTTOM-RIGHT: Speedometer, Drift/Surface/Damage Badges & Nitro Gauge */}
      <div
        data-testid="speedometer-hud"
        className="fixed bottom-5 right-5 flex flex-col items-end gap-2"
      >
        <div className="flex items-center gap-1.5">
          {hud.isDamagedSlow && (
            <div
              data-testid="damaged-slow-badge"
              className="px-2.5 py-0.5 rounded-md bg-[#090e1c]/90 border border-rose-500/80 text-[11px] font-display font-bold tracking-widest text-rose-300 shadow"
            >
              DAMAGED
            </div>
          )}
          {hud.isOnSand && (
            <div
              data-testid="sand-surface-badge"
              className="px-2.5 py-0.5 rounded-md bg-[#090e1c]/90 border border-amber-400/80 text-[11px] font-display font-bold tracking-widest text-amber-300 shadow"
            >
              SAND DRAG
            </div>
          )}
          {hud.isOnIce && (
            <div
              data-testid="ice-surface-badge"
              className="px-2.5 py-0.5 rounded-md bg-[#090e1c]/90 border border-cyan-400/75 text-[11px] font-display font-bold tracking-widest text-cyan-300 shadow"
            >
              ICE GLIDE
            </div>
          )}
          {hud.isDrifting && (
            <div
              data-testid="drift-indicator"
              className="px-2.5 py-0.5 rounded-md bg-[#090e1c]/90 border border-sky-400/75 text-[11px] font-display font-bold tracking-widest text-sky-300 shadow"
            >
              DRIFT
            </div>
          )}
        </div>
        <div className="relative w-52 h-44 rounded-2xl bg-[#090e1c]/92 border border-slate-700/75 shadow-xl px-4 pt-2.5 pb-3 flex flex-col justify-between">
          <svg
            viewBox="0 0 180 124"
            className="w-full h-28"
            aria-label={`Speed ${hud.speedKmh} km/h`}
          >
            <circle
              cx="90"
              cy="68"
              r={radius}
              fill="none"
              stroke="#1e293b"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${maxArcLen} ${circumference}`}
              transform={`rotate(${startDeg} 90 68)`}
            />
            <circle
              cx="90"
              cy="68"
              r={radius}
              fill="none"
              stroke={
                hud.isNitroActive
                  ? '#38bdf8'
                  : hud.speedKmh > 125
                    ? '#f97316'
                    : '#facc15'
              }
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${activeArcLen} ${circumference}`}
              transform={`rotate(${startDeg} 90 68)`}
            />

            <text
              x="90"
              y="71"
              textAnchor="middle"
              fill="#f8fafc"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="700"
              fontSize="30"
            >
              {hud.speedKmh}
            </text>
            <text
              x="90"
              y="88"
              textAnchor="middle"
              fill="#94a3b8"
              fontFamily="Manrope, sans-serif"
              fontWeight="700"
              fontSize="9"
              letterSpacing="0.8"
            >
              KM/H · G{hud.gear}
            </text>
          </svg>

          {/* Integrated Nitro Fuel Bar */}
          <div className="w-full">
            <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
              <span
                className={
                  hud.isNitroActive
                    ? 'text-sky-400'
                    : hud.nitro >= 100
                      ? 'text-emerald-400'
                      : 'text-amber-300'
                }
              >
                NITRO · {formatKeyCode(bindings.nitro).toUpperCase()}
              </span>
              <span className="font-mono-num text-slate-200">
                {hud.isNitroActive
                  ? `${hud.nitro}%`
                  : hud.nitro >= 100
                    ? 'READY'
                    : `${hud.nitro}%`}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-75"
                style={{
                  width: `${hud.nitro}%`,
                  backgroundColor: hud.isNitroActive
                    ? '#38bdf8'
                    : hud.nitro >= 100
                      ? '#34d399'
                      : '#facc15',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Touch Controls */}
      <div className="fixed bottom-4 left-4 right-56 flex sm:hidden items-center justify-between gap-2 pointer-events-auto">
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Steer Left"
            onPointerDown={() => onTouchKey(bindings.left, true)}
            onPointerUp={() => onTouchKey(bindings.left, false)}
            onPointerLeave={() => onTouchKey(bindings.left, false)}
            className="w-12 h-12 rounded-lg bg-[#090e1c]/90 border border-slate-700 text-slate-100 font-bold"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Steer Right"
            onPointerDown={() => onTouchKey(bindings.right, true)}
            onPointerUp={() => onTouchKey(bindings.right, false)}
            onPointerLeave={() => onTouchKey(bindings.right, false)}
            className="w-12 h-12 rounded-lg bg-[#090e1c]/90 border border-slate-700 text-slate-100 font-bold"
          >
            →
          </button>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label="Drift"
            onPointerDown={() => onTouchKey(bindings.drift, true)}
            onPointerUp={() => onTouchKey(bindings.drift, false)}
            onPointerLeave={() => onTouchKey(bindings.drift, false)}
            className="px-2.5 h-12 rounded-lg bg-sky-500/90 text-slate-950 font-bold text-xs"
          >
            DRIFT
          </button>
          <button
            type="button"
            aria-label="Nitro"
            onPointerDown={() => onTouchKey(bindings.nitro, true)}
            onPointerUp={() => onTouchKey(bindings.nitro, false)}
            onPointerLeave={() => onTouchKey(bindings.nitro, false)}
            className="px-2.5 h-12 rounded-lg bg-amber-500/90 text-slate-950 font-bold text-xs"
          >
            N2O
          </button>
          <button
            type="button"
            aria-label="Gas"
            onPointerDown={() => onTouchKey(bindings.accelerate, true)}
            onPointerUp={() => onTouchKey(bindings.accelerate, false)}
            onPointerLeave={() => onTouchKey(bindings.accelerate, false)}
            className="px-3.5 h-12 rounded-lg bg-orange-500 text-slate-950 font-bold text-xs"
          >
            GAS
          </button>
        </div>
      </div>
    </div>
  );
};
