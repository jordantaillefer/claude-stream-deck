import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SessionManager } from '../session-manager.js';

describe('SessionManager', () => {
  let manager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  it('assigns button index 0 to first session', () => {
    const session = manager.update({
      session: 'project-a',
      state: 'thinking',
      color: { r: 30, g: 100, b: 255 },
    });
    assert.equal(session.buttonIndex, 0);
  });

  it('assigns incrementing button indices', () => {
    manager.update({ session: 'project-a', state: 'idle', color: { r: 0, g: 200, b: 0 } });
    const session = manager.update({ session: 'project-b', state: 'thinking', color: { r: 30, g: 100, b: 255 } });
    assert.equal(session.buttonIndex, 1);
  });

  it('reuses same button index for same session', () => {
    manager.update({ session: 'project-a', state: 'idle', color: { r: 0, g: 200, b: 0 } });
    const session = manager.update({ session: 'project-a', state: 'thinking', color: { r: 30, g: 100, b: 255 } });
    assert.equal(session.buttonIndex, 0);
    assert.equal(session.state, 'thinking');
  });

  it('caps at 12 sessions', () => {
    for (let i = 0; i < 12; i++) {
      manager.update({ session: `project-${i}`, state: 'idle', color: { r: 0, g: 200, b: 0 } });
    }
    const session = manager.update({ session: 'project-overflow', state: 'idle', color: { r: 0, g: 200, b: 0 } });
    assert.equal(session, null);
  });

  it('returns all sessions', () => {
    manager.update({ session: 'project-a', state: 'idle', color: { r: 0, g: 200, b: 0 } });
    manager.update({ session: 'project-b', state: 'thinking', color: { r: 30, g: 100, b: 255 } });
    const all = manager.getAll();
    assert.equal(all.length, 2);
  });

  it('returns session by button index', () => {
    manager.update({ session: 'project-a', state: 'idle', color: { r: 0, g: 200, b: 0 } });
    const session = manager.getByButtonIndex(0);
    assert.equal(session.session, 'project-a');
  });
});
