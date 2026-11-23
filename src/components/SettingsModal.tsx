import React, { useEffect, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import {
  CONTROL_ACTION_META,
  DEFAULT_KEY_BINDINGS,
  formatKeyCode,
  rebindControlKey,
} from '../game/controls';
import {
  GRAPHICS_QUALITY_OPTIONS,
  type ControlAction,
  type GraphicsQuality,
  type KeyBindings,
} from '../game/types';

interface SettingsModalProps {
  isOpen: boolean;
  bindings: KeyBindings;
  graphicsQuality: GraphicsQuality;
  onChangeBindings: (next: KeyBindings) => void;
  onChangeGraphicsQuality: (next: GraphicsQuality) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  bindings,
  graphicsQuality,
  onChangeBindings,
  onChangeGraphicsQuality,
  onClose,
}) => {
  const [listeningAction, setListeningAction] = useState<ControlAction | null>(
    null
  );

  useEffect(() => {
    if (!isOpen) {
      setListeningAction(null);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (listeningAction) {
        e.preventDefault();
        e.stopPropagation();
        if (e.code === 'Escape' && listeningAction !== 'pause') {
          setListeningAction(null);
          return;
        }
        const next = rebindControlKey(bindings, listeningAction, e.code);
        onChangeBindings(next);
        setListeningAction(null);
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isOpen, listeningAction, bindings, onChangeBindings, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#04060d]/80"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-[#0c1220] border border-slate-700/80 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2
              id="settings-title"
              className="font-display text-xl font-bold text-slate-100"
            >
              Game Settings
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Graphics quality &amp; racing controls
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 max-h-[68vh] overflow-y-auto space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-display font-bold uppercase tracking-wider text-slate-300">
                Graphics Quality
              </div>
              <div className="text-[11px] text-slate-400">
                {GRAPHICS_QUALITY_OPTIONS.find((opt) => opt.id === graphicsQuality)?.label}
              </div>
            </div>
            <div
              className="grid grid-cols-3 gap-2"
              role="radiogroup"
              aria-label="Graphics Quality"
            >
              {GRAPHICS_QUALITY_OPTIONS.map((opt) => {
                const active = opt.id === graphicsQuality;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`graphics-quality-${opt.id}`}
                    onClick={() => onChangeGraphicsQuality(opt.id)}
                    className={`px-3 py-2.5 rounded-lg border text-center transition-colors cursor-pointer ${
                      active
                        ? 'bg-orange-500 border-orange-400 text-slate-950 font-display font-bold'
                        : 'bg-[#141d33] border-slate-700 text-slate-200 hover:border-slate-500 font-medium'
                    }`}
                  >
                    <div className="text-sm leading-tight">{opt.label}</div>
                  </button>
                );
              })}
            </div>
            <p
              data-testid="graphics-quality-summary"
              className="mt-2 text-xs text-slate-400 leading-relaxed"
            >
              {GRAPHICS_QUALITY_OPTIONS.find((opt) => opt.id === graphicsQuality)?.summary}
            </p>
          </div>

          <div className="border-t border-slate-800/90 pt-4">
            <div className="text-xs font-display font-bold uppercase tracking-wider text-slate-300 mb-1">
              Controls
            </div>
            <div className="divide-y divide-slate-800/80">
          {CONTROL_ACTION_META.map((item) => {
            const isListening = listeningAction === item.action;
            return (
              <div
                key={item.action}
                className="flex items-center justify-between py-2.5 gap-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-100">
                    {item.label}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {item.description}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setListeningAction(item.action)}
                  className={`min-w-[116px] px-3.5 py-2 rounded-lg font-mono-num text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isListening
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-[#141d33] border-slate-700 text-slate-100 hover:border-slate-500'
                  }`}
                >
                  {isListening
                    ? 'Press key...'
                    : formatKeyCode(bindings[item.action])}
                </button>
              </div>
            );
          })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-[#090e1a]">
          <button
            type="button"
            onClick={() => {
              setListeningAction(null);
              onChangeBindings({ ...DEFAULT_KEY_BINDINGS });
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset to Defaults</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-display font-bold text-sm transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
