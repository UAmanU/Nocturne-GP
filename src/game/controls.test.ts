import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_KEY_BINDINGS,
  formatKeyCode,
  rebindControlKey,
  resolvePlayerInput,
} from './controls';

test('rebindControlKey updates target action and swaps conflicting keys', () => {
  const updated = rebindControlKey(DEFAULT_KEY_BINDINGS, 'accelerate', 'KeyI');
  assert.equal(updated.accelerate, 'KeyI');
  assert.equal(updated.brake, DEFAULT_KEY_BINDINGS.brake);

  // Conflict swap: bind nitro to KeyW (which accelerate currently uses)
  const swapped = rebindControlKey(DEFAULT_KEY_BINDINGS, 'nitro', 'KeyW');
  assert.equal(swapped.nitro, 'KeyW');
  assert.equal(swapped.accelerate, DEFAULT_KEY_BINDINGS.nitro);
});

test('resolvePlayerInput reads custom bindings, non-conflicting arrow fallbacks, and Ctrl drift', () => {
  const bindings = rebindControlKey(DEFAULT_KEY_BINDINGS, 'accelerate', 'KeyI');
  const pressed = new Set(['KeyI', 'KeyA', 'ShiftLeft', 'ControlLeft']);
  const input = resolvePlayerInput(pressed, bindings);

  assert.equal(input.throttle, 1);
  assert.equal(input.brake, 0);
  assert.equal(input.steer, 1);
  assert.equal(input.nitro, true);
  assert.equal(input.drift, true);

  // Arrow keys also drive when not rebound to another action
  const arrowInput = resolvePlayerInput(new Set(['ArrowUp', 'ArrowRight']), bindings);
  assert.equal(arrowInput.throttle, 1);
  assert.equal(arrowInput.steer, -1);
  assert.equal(arrowInput.nitro, false);
  assert.equal(arrowInput.drift, false);

  // Right Shift & Right Ctrl also activate nitro and drift
  const rightModInput = resolvePlayerInput(
    new Set(['KeyW', 'ShiftRight', 'ControlRight']),
    DEFAULT_KEY_BINDINGS
  );
  assert.equal(rightModInput.throttle, 1);
  assert.equal(rightModInput.nitro, true);
  assert.equal(rightModInput.drift, true);
});

test('formatKeyCode produces concise human-readable key labels', () => {
  assert.equal(formatKeyCode('KeyW'), 'W');
  assert.equal(formatKeyCode('ShiftLeft'), 'Shift');
  assert.equal(formatKeyCode('ControlLeft'), 'Ctrl');
  assert.equal(formatKeyCode('ArrowUp'), '↑');
  assert.equal(formatKeyCode('Space'), 'Space');
});
