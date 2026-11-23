import React, { useEffect } from 'react';
import { RotateCcw, X } from 'lucide-react';
import {
  CAR_ACCENT_OPTIONS,
  CAR_MODELS,
  CAR_PAINT_OPTIONS,
  DEFAULT_CAR_APPEARANCE,
  type CarAppearance,
  type LiveryStyle,
  type RimFinish,
  type SpoilerStyle,
} from '../game/types';

interface GarageModalProps {
  isOpen: boolean;
  appearance: CarAppearance;
  onChangeAppearance: (next: CarAppearance) => void;
  onClose: () => void;
}

const SPOILER_OPTIONS: Array<{ id: SpoilerStyle; label: string }> = [
  { id: 'gt-wing', label: 'GT Wing' },
  { id: 'ducktail', label: 'Ducktail' },
  { id: 'none', label: 'Clean' },
];

const LIVERY_OPTIONS: Array<{ id: LiveryStyle; label: string }> = [
  { id: 'stripe', label: 'Center' },
  { id: 'twin', label: 'Twin' },
  { id: 'clean', label: 'None' },
];

const RIM_OPTIONS: Array<{ id: RimFinish; label: string; swatch: string }> = [
  { id: 'silver', label: 'Alloy', swatch: '#d4dae4' },
  { id: 'gold', label: 'Gold', swatch: '#f59e0b' },
  { id: 'obsidian', label: 'Obsidian', swatch: '#273244' },
];

export const GarageModal: React.FC<GarageModalProps> = ({
  isOpen,
  appearance,
  onChangeAppearance,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const update = (patch: Partial<CarAppearance>) => {
    onChangeAppearance({ ...appearance, ...patch });
  };

  return (
    <div
      className="fixed inset-y-0 left-0 z-40 w-full max-w-sm bg-[#090e1c]/95 border-r border-slate-700/80 shadow-2xl flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="garage-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div>
          <h2
            id="garage-title"
            className="font-display text-xl font-bold text-slate-100"
          >
            Garage
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Select car model & custom trim
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close garage"
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable customization controls */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Car Model Selection */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Car Model
          </div>
          <div className="grid grid-cols-1 gap-2">
            {CAR_MODELS.map((model) => {
              const selected = appearance.bodyStyle === model.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => update({ bodyStyle: model.id })}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    selected
                      ? 'bg-orange-500/15 border-orange-400 text-slate-100'
                      : 'bg-[#10182d] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="font-display font-bold text-sm">{model.name}</div>
                    <div className="text-xs text-slate-400">{model.subtitle}</div>
                  </div>
                  {selected && (
                    <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body Paint */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Body Paint
          </div>
          <div className="flex flex-wrap gap-2">
            {CAR_PAINT_OPTIONS.map((p) => {
              const selected =
                appearance.primaryColor.toLowerCase() === p.hex.toLowerCase();
              return (
                <button
                  key={p.hex}
                  type="button"
                  title={p.name}
                  aria-label={`Paint ${p.name}`}
                  onClick={() => update({ primaryColor: p.hex })}
                  className={`w-8 h-8 rounded-lg border-2 transition-transform cursor-pointer ${
                    selected
                      ? 'border-amber-300 scale-110'
                      : 'border-slate-700 hover:border-slate-400'
                  }`}
                  style={{ backgroundColor: p.hex }}
                />
              );
            })}
          </div>
        </div>

        {/* Accent / Stripe Color */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Accent & Calipers
          </div>
          <div className="flex flex-wrap gap-2">
            {CAR_ACCENT_OPTIONS.map((a) => {
              const selected =
                appearance.accentColor.toLowerCase() === a.hex.toLowerCase();
              return (
                <button
                  key={a.hex}
                  type="button"
                  title={a.name}
                  aria-label={`Accent ${a.name}`}
                  onClick={() => update({ accentColor: a.hex })}
                  className={`w-8 h-8 rounded-lg border-2 transition-transform cursor-pointer ${
                    selected
                      ? 'border-white scale-110'
                      : 'border-slate-700 hover:border-slate-400'
                  }`}
                  style={{ backgroundColor: a.hex }}
                />
              );
            })}
          </div>
        </div>

        {/* Racing Livery Stripes */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Racing Stripe
          </div>
          <div className="grid grid-cols-3 gap-2">
            {LIVERY_OPTIONS.map((opt) => {
              const selected = appearance.livery === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => update({ livery: opt.id })}
                  className={`py-2 px-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                    selected
                      ? 'bg-orange-500/15 border-orange-400 text-orange-300'
                      : 'bg-[#10182d] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Rear Spoiler */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Rear Spoiler
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SPOILER_OPTIONS.map((opt) => {
              const selected = appearance.spoilerStyle === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => update({ spoilerStyle: opt.id })}
                  className={`py-2 px-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                    selected
                      ? 'bg-orange-500/15 border-orange-400 text-orange-300'
                      : 'bg-[#10182d] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Wheel Rim Finish */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Wheel Rims
          </div>
          <div className="grid grid-cols-3 gap-2">
            {RIM_OPTIONS.map((opt) => {
              const selected = appearance.rimFinish === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => update({ rimFinish: opt.id })}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                    selected
                      ? 'bg-orange-500/15 border-orange-400 text-orange-300'
                      : 'bg-[#10182d] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-slate-600 shrink-0"
                    style={{ backgroundColor: opt.swatch }}
                    aria-hidden="true"
                  />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-slate-800 bg-[#070b16]">
        <button
          type="button"
          onClick={() => onChangeAppearance({ ...DEFAULT_CAR_APPEARANCE })}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reset</span>
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
  );
};
