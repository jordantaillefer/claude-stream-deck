// server/test/button-renderer.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderButton, renderEmptyButton, renderIcon, svgToDataUri } from '../button-renderer.js';

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

describe('renderButton with state icons', () => {
  const STATE_TO_ICON = {
    idle: 'moon',
    thinking: 'brain',
    tool_use: 'wrench',
    permission: 'shield-alert',
    error: 'alert-triangle',
    done: 'check-circle',
  };

  for (const [state, iconName] of Object.entries(STATE_TO_ICON)) {
    it(`renders the ${iconName} icon for state "${state}"`, () => {
      const svg = renderButton({
        session: 'proj',
        state,
        color: { r: 30, g: 100, b: 255 },
      });
      assert.ok(
        svg.includes(`data-icon="${iconName}"`),
        `expected data-icon="${iconName}" in SVG for state ${state}`
      );
    });
  }

  it('omits the icon block for an unknown state but still renders a valid SVG', () => {
    const svg = renderButton({
      session: 'proj',
      state: 'mystery',
      color: { r: 30, g: 100, b: 255 },
    });
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('</svg>'));
    assert.ok(!svg.includes('data-icon='));
  });

  it('uses white stroke on dark backgrounds', () => {
    const svg = renderButton({
      session: 'proj',
      state: 'idle',
      color: { r: 30, g: 30, b: 30 },
    });
    assert.ok(svg.includes('stroke="#fff"'));
  });

  it('uses black stroke on bright backgrounds', () => {
    const svg = renderButton({
      session: 'proj',
      state: 'idle',
      color: { r: 255, g: 255, b: 0 },
    });
    assert.ok(svg.includes('stroke="#000"'));
  });

  it('uses the new font sizes (18 for name, 14 for state)', () => {
    const svg = renderButton({
      session: 'proj',
      state: 'idle',
      color: { r: 30, g: 100, b: 255 },
    });
    assert.ok(svg.includes('font-size="18"'));
    assert.ok(svg.includes('font-size="14"'));
  });
});

describe('renderEmptyButton', () => {
  it('returns a dark SVG', () => {
    const svg = renderEmptyButton();
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('rgb(30,30,30)'));
  });
});

describe('svgToDataUri', () => {
  it('converts SVG to base64 data URI', () => {
    const svg = '<svg></svg>';
    const uri = svgToDataUri(svg);
    assert.ok(uri.startsWith('data:image/svg+xml;base64,'));
    const decoded = Buffer.from(uri.split(',')[1], 'base64').toString();
    assert.equal(decoded, svg);
  });
});

describe('renderIcon', () => {
  it('returns a <g> fragment with data-icon for a known state', () => {
    const fragment = renderIcon('idle', '#fff');
    assert.ok(fragment.includes('<g'));
    assert.ok(fragment.includes('data-icon="moon"'));
    assert.ok(fragment.includes('</g>'));
  });

  it('applies the given stroke colour to every path', () => {
    const fragment = renderIcon('idle', '#abcdef');
    assert.ok(fragment.includes('stroke="#abcdef"'));
    assert.ok(fragment.includes('fill="none"'));
  });

  it('positions and scales the icon at translate(52, 56) scale(1.6667)', () => {
    const fragment = renderIcon('idle', '#fff');
    assert.ok(fragment.includes('translate(52, 56)'));
    assert.ok(fragment.includes('scale(1.6667)'));
  });

  it('returns an empty string for unknown states', () => {
    assert.equal(renderIcon('mystery', '#fff'), '');
    assert.equal(renderIcon(undefined, '#fff'), '');
  });

  it('returns an empty string when state maps to no icon', () => {
    assert.equal(renderIcon('', '#fff'), '');
  });
});
