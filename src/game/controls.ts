import type { ControlAction, ControlActionMeta, KeyBindings } from './types';

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  accelerate: 'KeyW',
  brake: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  drift: 'ControlLeft',
  nitro: 'ShiftLeft',
  pause: 'Escape',
  resetCar: 'KeyR',
};

export const CONTROL_ACTION_META: ControlActionMeta[] = [
  {
    action: 'accelerate',
    label: 'Accelerate',
    description: 'Drive forward',
  },
  {
    action: 'brake',
    label: 'Brake / Reverse',
    description: 'Slow down or reverse',
  },
  {
    action: 'left',
    label: 'Steer Left',
    description: 'Turn counter-clockwise',
  },
  {
    action: 'right',
    label: 'Steer Right',
    description: 'Turn clockwise',
  },
  {
    action: 'drift',
    label: 'Drift',
    description: 'Hold Ctrl to slide tight corners without losing momentum',
  },
  {
    action: 'nitro',
    label: 'Nitro Boost',
    description: 'Activate at 100% to boost up to 165 km/h until empty',
  },
  {
    action: 'resetCar',
    label: 'Reset to Track',
    description: 'Re-center car on the road',
  },
  {
    action: 'pause',
    label: 'Pause',
    description: 'Open pause menu during race',
  },
];

const STORAGE_KEY = 'nocturne_gp_keybindings_v1';

export function loadKeyBindings(): KeyBindings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_KEY_BINDINGS };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_KEY_BINDINGS };
    const parsed = JSON.parse(raw) as Partial<KeyBindings>;
    return {
      ...DEFAULT_KEY_BINDINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_KEY_BINDINGS };
  }
}

export function saveKeyBindings(bindings: KeyBindings): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // Ignore storage quota issues
  }
}

export function rebindControlKey(
  bindings: KeyBindings,
  targetAction: ControlAction,
  newCode: string
): KeyBindings {
  const next = { ...bindings };
  const previousCode = next[targetAction];
  for (const action of Object.keys(next) as ControlAction[]) {
    if (action !== targetAction && next[action] === newCode) {
      next[action] = previousCode;
    }
  }
  next[targetAction] = newCode;
  return next;
}

export function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  switch (code) {
    case 'ArrowUp':
      return '↑';
    case 'ArrowDown':
      return '↓';
    case 'ArrowLeft':
      return '←';
    case 'ArrowRight':
      return '→';
    case 'Space':
      return 'Space';
    case 'ShiftLeft':
    case 'ShiftRight':
      return 'Shift';
    case 'ControlLeft':
    case 'ControlRight':
      return 'Ctrl';
    case 'AltLeft':
    case 'AltRight':
      return 'Alt';
    case 'Escape':
      return 'Esc';
    case 'Enter':
      return 'Enter';
    default:
      return code;
  }
}

export interface DrivingInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1 (right) .. +1 (left)
  nitro: boolean;
  drift?: boolean;
}

const ARROW_FALLBACKS: Partial<Record<ControlAction, string>> = {
  accelerate: 'ArrowUp',
  brake: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

export function isActionPressed(
  pressedCodes: ReadonlySet<string>,
  bindings: KeyBindings,
  action: ControlAction
): boolean {
  const primary = bindings[action];
  if (pressedCodes.has(primary)) return true;

  // Allow either Shift key when Shift is bound to nitro
  if (action === 'nitro') {
    if (primary === 'ShiftLeft' && pressedCodes.has('ShiftRight')) return true;
    if (primary === 'ShiftRight' && pressedCodes.has('ShiftLeft')) return true;
  }

  // Allow either Ctrl key when Ctrl is bound to drift
  if (action === 'drift') {
    if (primary === 'ControlLeft' && pressedCodes.has('ControlRight')) return true;
    if (primary === 'ControlRight' && pressedCodes.has('ControlLeft')) return true;
  }

  const fallback = ARROW_FALLBACKS[action];
  if (!fallback) return false;

  for (const [otherAction, boundCode] of Object.entries(bindings)) {
    if (otherAction !== action && boundCode === fallback) {
      return false;
    }
  }
  return pressedCodes.has(fallback);
}

export function resolvePlayerInput(
  pressedCodes: ReadonlySet<string>,
  bindings: KeyBindings
): DrivingInput {
  const accel = isActionPressed(pressedCodes, bindings, 'accelerate') ? 1 : 0;
  const brake = isActionPressed(pressedCodes, bindings, 'brake') ? 1 : 0;
  const left = isActionPressed(pressedCodes, bindings, 'left') ? 1 : 0;
  const right = isActionPressed(pressedCodes, bindings, 'right') ? 1 : 0;
  const nitro = isActionPressed(pressedCodes, bindings, 'nitro');
  const drift = isActionPressed(pressedCodes, bindings, 'drift');

  return {
    throttle: accel,
    brake,
    steer: left - right,
    nitro,
    drift,
  };
}
