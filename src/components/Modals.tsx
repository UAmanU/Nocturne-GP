import React from 'react';
import { Play, RotateCcw, Settings, Home, Trophy } from 'lucide-react';
import type { GameMode, RaceFinishSummary } from '../game/types';

function formatTimeLong(seconds: number | null): string {
  if (seconds === null) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds * 100) % 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

interface PauseModalProps {
  mode?: GameMode;
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onMainMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  mode = 'race',
  onResume,
  onRestart,
  onOpenSettings,
  onMainMenu,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#04060d]/75"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div className="w-full max-w-sm rounded-xl bg-[#0c1220] border border-slate-700/80 shadow-2xl p-6">
        <h2
          id="pause-title"
          className="font-display text-2xl font-bold text-slate-100 mb-1"
        >
          Paused
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          {mode === 'pursuit' ? 'Cargo pursuit paused' : 'Race paused'}
        </p>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-display font-bold text-sm transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            <span>Resume</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#141d33] hover:bg-[#1c2742] text-slate-100 border border-slate-700 text-sm font-medium transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>{mode === 'pursuit' ? 'Restart Pursuit' : 'Restart Race'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#141d33] hover:bg-[#1c2742] text-slate-100 border border-slate-700 text-sm font-medium transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" aria-hidden="true" />
            <span>Control Settings</span>
          </button>

          <button
            type="button"
            onClick={onMainMenu}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-slate-300 hover:text-slate-100 hover:bg-slate-800/70 text-sm font-medium transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface FinishModalProps {
  summary: RaceFinishSummary;
  onPlayAgain: () => void;
  onMainMenu: () => void;
}

export const FinishModal: React.FC<FinishModalProps> = ({
  summary,
  onPlayAgain,
  onMainMenu,
}) => {
  const [showDebrief, setShowDebrief] = React.useState(false);

  React.useEffect(() => {
    setShowDebrief(false);
    const timer = window.setTimeout(() => {
      setShowDebrief(true);
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [summary]);

  return (
    <div
      data-testid="finish-overlay"
      className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between p-5 md:p-8"
      role="dialog"
      aria-modal="false"
      aria-labelledby="finish-title"
    >
      {/* Top Epic Cinematic Headline (always visible at top, leaving 3D car & track completely clear) */}
      <div className="w-full flex flex-col items-center text-center pt-1 md:pt-3">
        <div
          className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-md border text-[11px] font-mono-num font-bold tracking-[0.25em] uppercase mb-2 ${
            summary.playerWon
              ? 'bg-[#090e1c]/90 border-amber-400/50 text-amber-300'
              : 'bg-[#090e1c]/90 border-rose-500/50 text-rose-300'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
          <span>
            {summary.mode === 'pursuit'
              ? summary.playerWon
                ? 'CARGO DELIVERED · EXTRACTION COMPLETE'
                : summary.defeatReason === 'surrounded'
                  ? 'SURROUNDED BY POLICE · INTERCEPTED'
                  : 'VEHICLE DESTROYED · INTERCEPTED'
              : summary.playerWon
                ? '1ST PLACE · 3/3 LAPS'
                : `POSITION #${summary.playerPosition} · WINNER: ${summary.winnerName}`}
          </span>
        </div>

        <h2
          id="finish-title"
          className={`font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight hud-stroke ${
            summary.playerWon ? 'text-amber-300' : 'text-rose-400'
          }`}
        >
          {summary.playerWon ? 'Mission Completed.' : 'Mission failed'}
        </h2>
      </div>

      {/* Bottom Compact Debrief & Actions */}
      <div className="w-full flex justify-center">
        {!showDebrief ? (
          <button
            type="button"
            onClick={() => setShowDebrief(true)}
            className="pointer-events-auto px-4 py-2 rounded-lg bg-[#090e1c]/90 hover:bg-[#131d36] border border-slate-700/80 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
          >
            Show Results
          </button>
        ) : (
          <div className="pointer-events-auto w-full max-w-3xl rounded-xl bg-[#090e1c]/94 border border-slate-700/85 shadow-2xl p-4 md:p-5">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center">
              {summary.mode === 'pursuit' ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="px-3 py-1.5 rounded-lg bg-[#060913] border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-semibold tracking-wider">
                        TOTAL TIME
                      </div>
                      <div className="font-mono-num text-base font-bold text-slate-100">
                        {formatTimeLong(summary.raceTime)}
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-[#060913] border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-semibold tracking-wider">
                        ROUTE PROGRESS
                      </div>
                      <div className="font-mono-num text-base font-bold text-sky-300">
                        {summary.progressPct}%
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-[#060913] border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-semibold tracking-wider">
                        HP LEFT
                      </div>
                      <div
                        className={`font-mono-num text-base font-bold ${
                          summary.remainingHp < 60 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {summary.remainingHp}/200
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-[#060913] border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-semibold tracking-wider">
                        POLICE DISABLED
                      </div>
                      <div className="font-mono-num text-base font-bold text-amber-300">
                        {summary.policeWrecked}/5
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 font-mono-num">
                    Damage taken: {summary.damageTaken} HP · Cargo Extraction Run
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Key Race Metrics */}
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="px-3 py-1.5 rounded-lg bg-[#060913] border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-semibold tracking-wider">
                        TOTAL TIME
                      </div>
                      <div className="font-mono-num text-base font-bold text-slate-100">
                        {formatTimeLong(summary.raceTime)}
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-[#060913] border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-semibold tracking-wider">
                        BEST LAP
                      </div>
                      <div className="font-mono-num text-base font-bold text-amber-300">
                        {formatTimeLong(summary.bestLapTime)}
                      </div>
                    </div>
                  </div>

                  {/* Compact 4-Car Final Standings */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {summary.standings.map((r) => (
                      <div
                        key={r.id}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
                          r.isPlayer
                            ? 'bg-orange-500/12 border-orange-500/40'
                            : 'bg-[#060913] border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono-num font-bold text-slate-400">
                            {r.position}.
                          </span>
                          <span
                            className="w-2 h-2 rounded-sm shrink-0"
                            style={{
                              backgroundColor: r.isPlayer
                                ? r.accentColor
                                : r.primaryColor,
                            }}
                            aria-hidden="true"
                          />
                          <span
                            className={`truncate ${
                              r.isPlayer
                                ? 'font-bold text-orange-300'
                                : 'font-medium text-slate-200'
                            }`}
                          >
                            {r.isPlayer ? 'You' : r.name.split(' (')[0]}
                          </span>
                        </div>
                        <span className="font-mono-num text-[11px] text-slate-400 shrink-0">
                          {r.finished
                            ? formatTimeLong(r.finishTime)
                            : `L${r.lap}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex sm:flex-row md:flex-col items-stretch gap-2.5 shrink-0">
                <button
                  type="button"
                  data-start="true"
                  onClick={onPlayAgain}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-display font-bold text-sm transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>Play Again</span>
                </button>
                <button
                  type="button"
                  onClick={onMainMenu}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#141d33] hover:bg-[#1c2742] text-slate-100 border border-slate-700 text-sm font-medium transition-colors cursor-pointer"
                >
                  <Home className="w-4 h-4" aria-hidden="true" />
                  <span>Main Menu</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
