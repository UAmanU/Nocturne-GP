import React from 'react';
import { Car, Play, Settings, ShieldAlert, Flag } from 'lucide-react';
import { formatKeyCode } from '../game/controls';
import type { GameMode, KeyBindings } from '../game/types';

interface TitleOverlayProps {
  mode: GameMode;
  bindings: KeyBindings;
  onSelectMode: (mode: GameMode) => void;
  onStart: () => void;
  onOpenGarage: () => void;
  onOpenSettings: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  mode,
  bindings,
  onSelectMode,
  onStart,
  onOpenGarage,
  onOpenSettings,
}) => {
  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-6 md:p-12">
      {/* Left-side scrim for effortless title legibility over night & daylight maps */}
      <div
        aria-hidden="true"
        className="fixed inset-y-0 left-0 w-full md:w-[500px] pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(5, 8, 20, 0.90) 0%, rgba(5, 8, 20, 0.56) 72%, rgba(5, 8, 20, 0) 100%)',
        }}
      />

      {/* Minimalist Title Lockup, Mode Switch & Menu Actions (Circuit & Weather auto-selected on Play) */}
      <div className="relative z-10 max-w-md pt-4 md:pt-10 pointer-events-auto">
        <h1 className="sr-only">Nocturne GP</h1>
        <div className="mb-6">
          <svg
            viewBox="0 0 380 78"
            className="w-80 md:w-96 h-auto"
            role="img"
            aria-label="Nocturne GP"
          >
            <polygon points="4,10 36,10 24,64 0,64" fill="#f97316" />
            <polygon points="42,10 54,10 42,64 30,64" fill="#facc15" />
            <text
              x="66"
              y="42"
              fill="#f8fafc"
              fontFamily="Exo 2, sans-serif"
              fontWeight="800"
              fontSize="35"
              letterSpacing="1.8"
            >
              NOCTURNE GP
            </text>
            <text
              x="67"
              y="64"
              fill={mode === 'pursuit' ? '#7dd3fc' : '#cbd5e1'}
              fontFamily="Exo 2, sans-serif"
              fontWeight="700"
              fontSize="13"
              letterSpacing="2.8"
            >
              {mode === 'pursuit'
                ? 'CARGO ESCAPE · 3 POLICE UNITS'
                : 'RANDOM CIRCUIT · 3 LAPS'}
            </text>
          </svg>
        </div>

        {/* Game Mode Toggle: Race vs Pursuit */}
        <div
          className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-[#090f20]/95 border border-slate-700/80 mb-5"
          role="group"
          aria-label="Game Mode"
        >
          <button
            type="button"
            data-testid="mode-race-btn"
            aria-pressed={mode === 'race'}
            onClick={() => onSelectMode('race')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-display font-bold tracking-wider uppercase transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'race'
                ? 'bg-orange-500 text-slate-950'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/70'
            }`}
          >
            <Flag className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Race · 3 Laps</span>
          </button>

          <button
            type="button"
            data-testid="mode-pursuit-btn"
            aria-pressed={mode === 'pursuit'}
            onClick={() => onSelectMode('pursuit')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-display font-bold tracking-wider uppercase transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'pursuit'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/70'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Pursuit · Cargo</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            type="button"
            data-start="true"
            onClick={onStart}
            className={`inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-lg text-slate-950 font-display font-bold text-base tracking-wide transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 whitespace-nowrap shrink-0 ${
              mode === 'pursuit'
                ? 'bg-sky-400 hover:bg-sky-300 active:bg-sky-500'
                : 'bg-orange-500 hover:bg-orange-400 active:bg-orange-600'
            }`}
          >
            <Play className="w-5 h-5 fill-current" aria-hidden="true" />
            <span>Play</span>
          </button>

          <button
            type="button"
            onClick={onOpenGarage}
            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-lg bg-[#0d1426]/95 hover:bg-[#17223d] text-slate-100 border border-slate-700/80 font-medium text-sm transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
          >
            <Car className="w-4 h-4 text-amber-300" aria-hidden="true" />
            <span>Garage</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-lg bg-[#0d1426]/95 hover:bg-[#17223d] text-slate-100 border border-slate-700/80 font-medium text-sm transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap shrink-0"
          >
            <Settings className="w-4 h-4 text-slate-300" aria-hidden="true" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Single-Line Flat Bottom Control Hint */}
      <div className="relative z-10 flex items-center text-xs text-slate-300">
        <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 font-mono-num px-3 py-1.5 rounded-lg bg-[#050814]/80">
          <span>
            {formatKeyCode(bindings.accelerate)} / {formatKeyCode(bindings.brake)} Drive
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {formatKeyCode(bindings.left)} / {formatKeyCode(bindings.right)} Steer
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-sky-300">{formatKeyCode(bindings.drift)} Drift</span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-300">
            {formatKeyCode(bindings.nitro)} Nitro (100%)
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatKeyCode(bindings.resetCar)} Reset</span>
          <span aria-hidden="true">·</span>
          <span>{formatKeyCode(bindings.pause)} Pause</span>
        </div>
      </div>
    </div>
  );
};
