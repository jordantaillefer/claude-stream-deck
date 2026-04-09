// server/test/button-renderer.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderButton, renderEmptyButton } from '../button-renderer.js';

describe('renderButton', () => {
  it('returns an SVG string', () => {
    const svg = renderButton({
      session: 'my-project',
      state: 'thinking',
      color: { r: 30, g: 100, b: 255 },
    });
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('</svg>'));
  });

  it('includes session name in SVG', () => {
    const svg = renderButton({
      session: 'my-project',
      state: 'thinking',
      color: { r: 30, g: 100, b: 255 },
    });
    assert.ok(svg.includes('my-project'));
  });

  it('includes background color', () => {
    const svg = renderButton({
      session: 'my-project',
      state: 'thinking',
      color: { r: 30, g: 100, b: 255 },
    });
    assert.ok(svg.includes('rgb(30,100,255)'));
  });

  it('includes state text', () => {
    const svg = renderButton({
      session: 'my-project',
      state: 'permission',
      color: { r: 255, g: 165, b: 0 },
    });
    assert.ok(svg.includes('permission'));
  });

  it('truncates long session names', () => {
    const svg = renderButton({
      session: 'very-long-project-name-here',
      state: 'idle',
      color: { r: 0, g: 200, b: 0 },
    });
    // Name should be truncated to 10 chars + ellipsis
    assert.ok(svg.includes('very-long-…'));
  });

  it('shows detail instead of state when provided', () => {
    const svg = renderButton({
      session: 'my-project',
      state: 'tool_use',
      color: { r: 30, g: 100, b: 255 },
      detail: 'Reading: app.ts',
    });
    assert.ok(svg.includes('Reading:'));
  });
});

describe('renderEmptyButton', () => {
  it('returns a dark SVG', () => {
    const svg = renderEmptyButton();
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('rgb(30,30,30)'));
  });
});
