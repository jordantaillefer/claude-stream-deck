// server/test/icons.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STATE_ICONS } from '../icons.js';

const EXPECTED_STATES = ['idle', 'thinking', 'tool_use', 'permission', 'error', 'done'];

describe('STATE_ICONS', () => {
  it('exports an entry for every known state', () => {
    for (const state of EXPECTED_STATES) {
      assert.ok(STATE_ICONS[state], `missing entry for state "${state}"`);
    }
  });

  it('each entry has a non-empty name string', () => {
    for (const [state, entry] of Object.entries(STATE_ICONS)) {
      assert.equal(typeof entry.name, 'string', `${state}.name is not a string`);
      assert.ok(entry.name.length > 0, `${state}.name is empty`);
    }
  });

  it('each entry has at least one path string', () => {
    for (const [state, entry] of Object.entries(STATE_ICONS)) {
      assert.ok(Array.isArray(entry.paths), `${state}.paths is not an array`);
      assert.ok(entry.paths.length > 0, `${state}.paths is empty`);
      for (const p of entry.paths) {
        assert.equal(typeof p, 'string', `${state} has a non-string path`);
        assert.ok(p.length > 0, `${state} has an empty path string`);
      }
    }
  });
});
