# Button State Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Lucide line-icon to each Stream Deck button that reflects the current Claude Code session state, layered between the project name and the state text.

**Architecture:** A new pure-data module `server/icons.js` holds the state→icon mapping (name + SVG path strings, copied from the Lucide MIT-licensed source). `server/button-renderer.js` gains a `renderIcon(state, textColor)` helper and `renderButton` is updated to place the icon at the vertical centre of the 144×144 button, adjusting text sizes so the layout stays balanced. No API changes; unknown states fall back to rendering without an icon.

**Tech Stack:** Node.js ESM, `node:test`, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-10-button-state-icons-design.md`

---

## File Structure

**Created:**
- `server/icons.js` — pure data: `STATE_ICONS` mapping `state` → `{ name, paths }`.
- `server/test/icons.test.js` — shape tests for `STATE_ICONS`.

**Modified:**
- `server/button-renderer.js` — adds `renderIcon` helper; `renderButton` calls it and uses new font sizes and y-coordinates.
- `server/test/button-renderer.test.js` — adds tests for icon presence per state, unknown-state fallback, and stroke colour.

---

## Task 1: Download Lucide icon sources

**Files:**
- Create (temporary): `/tmp/lucide-icons/<name>.svg` for 6 icons

- [ ] **Step 1: Download the six Lucide SVGs**

Run:
```bash
mkdir -p /tmp/lucide-icons
for name in moon brain wrench shield-alert triangle-alert circle-check; do
  curl -sSL "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/${name}.svg" -o "/tmp/lucide-icons/${name}.svg"
done
ls -la /tmp/lucide-icons/
```

Expected: six non-empty `.svg` files.

> **Note on names:** In recent Lucide versions, `alert-triangle` was renamed to `triangle-alert` and `check-circle` to `circle-check`. We use the new names when downloading but keep the legacy names (`alert-triangle`, `check-circle`) as the values in `STATE_ICONS` for clarity in state mapping. If a download 404s, fall back to the legacy name.

- [ ] **Step 2: Inspect each file to extract `<path d="...">` attributes**

Run:
```bash
for f in /tmp/lucide-icons/*.svg; do echo "=== $f ==="; cat "$f"; done
```

Expected: each file is an SVG with 1-5 `<path d="..."/>` elements inside a `<svg viewBox="0 0 24 24" ...>` root. Take note of the `d` strings — they will be copied into `server/icons.js` in Task 2.

- [ ] **Step 3: No commit**

No code written yet; the downloads are throwaway scratch data.

---

## Task 2: Create `server/icons.js` with the state→icon data

**Files:**
- Create: `server/icons.js`
- Test: `server/test/icons.test.js`

- [ ] **Step 1: Write the failing shape test**

Create `server/test/icons.test.js`:

```js
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
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd server && node --test test/icons.test.js`
Expected: FAIL with `Cannot find module '../icons.js'`.

- [ ] **Step 3: Create `server/icons.js`**

Copy each `d` attribute from the files inspected in Task 1 into the structure below. **Do NOT leave placeholders — paste the actual path strings.**

```js
// server/icons.js
// State → Lucide icon mapping. Path data is copied verbatim from the Lucide
// MIT-licensed source at https://github.com/lucide-icons/lucide/tree/main/icons.
// Each icon is designed on a 24×24 viewBox and rendered as line art
// (stroke only, no fill) by button-renderer.js.

export const STATE_ICONS = {
  idle: {
    name: 'moon',
    paths: [
      // paste d from /tmp/lucide-icons/moon.svg
      'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z',
    ],
  },
  thinking: {
    name: 'brain',
    paths: [
      // paste every d from /tmp/lucide-icons/brain.svg (brain has multiple paths)
    ],
  },
  tool_use: {
    name: 'wrench',
    paths: [
      // paste d from /tmp/lucide-icons/wrench.svg
    ],
  },
  permission: {
    name: 'shield-alert',
    paths: [
      // paste every d from /tmp/lucide-icons/shield-alert.svg (3 paths: shield + exclamation)
    ],
  },
  error: {
    name: 'alert-triangle',
    paths: [
      // paste every d from /tmp/lucide-icons/triangle-alert.svg (3 paths)
    ],
  },
  done: {
    name: 'check-circle',
    paths: [
      // paste every d from /tmp/lucide-icons/circle-check.svg (2 paths)
    ],
  },
};
```

**Important:** before running the test, replace each comment placeholder with the actual `d` strings from the downloaded SVGs. The placeholders exist only to show where to paste — the file must contain real path data before moving on.

- [ ] **Step 4: Run the test and verify it passes**

Run: `cd server && node --test test/icons.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add server/icons.js server/test/icons.test.js
git commit -m "feat(server): add state→Lucide icon mapping module"
```

---

## Task 3: Add `renderIcon` helper to `button-renderer.js`

**Files:**
- Modify: `server/button-renderer.js`
- Test: `server/test/button-renderer.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `server/test/button-renderer.test.js` (inside the file, after the existing `describe('svgToDataUri', ...)` block):

```js
import { renderIcon } from '../button-renderer.js';

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
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `cd server && node --test test/button-renderer.test.js`
Expected: FAIL, `renderIcon` is not exported.

- [ ] **Step 3: Implement `renderIcon` in `server/button-renderer.js`**

Add at the top of the file, below the existing imports/constants:

```js
import { STATE_ICONS } from './icons.js';
```

Add this function before `renderButton`:

```js
export function renderIcon(state, textColor) {
  const icon = STATE_ICONS[state];
  if (!icon) return '';
  const paths = icon.paths
    .map((d) => `<path d="${d}" stroke="${textColor}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />`)
    .join('');
  return `<g data-icon="${icon.name}" transform="translate(52, 56) scale(1.6667)">${paths}</g>`;
}
```

**Rationale for the transform:**
- `translate(52, 56)` centres a 40×40 icon horizontally on the 144-wide button (`(144 − 40) / 2 = 52`) and places its top at y=56, which is 26 px below the project-name baseline (y=30) — see the spec for the layout rationale.
- `scale(1.6667)` scales Lucide's 24-unit viewBox up to 40 px (`40 / 24 ≈ 1.6667`).

- [ ] **Step 4: Run the tests and verify they pass**

Run: `cd server && node --test test/button-renderer.test.js`
Expected: PASS — all previous tests plus the 5 new `renderIcon` tests.

- [ ] **Step 5: Commit**

```bash
git add server/button-renderer.js server/test/button-renderer.test.js
git commit -m "feat(server): add renderIcon helper for state icons"
```

---

## Task 4: Integrate `renderIcon` into `renderButton` and adjust layout

**Files:**
- Modify: `server/button-renderer.js`
- Test: `server/test/button-renderer.test.js`

- [ ] **Step 1: Write the failing integration tests**

Append to `server/test/button-renderer.test.js` (inside the existing `describe('renderButton', ...)` block or after it):

```js
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
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `cd server && node --test test/button-renderer.test.js`
Expected: FAIL on the icon and font-size assertions (current code uses sizes 20 and 16 and emits no `data-icon`).

- [ ] **Step 3: Update `renderButton` to call `renderIcon` and use the new layout**

Replace the existing `renderButton` function body in `server/button-renderer.js` with:

```js
export function renderButton({ session, state, color, detail }) {
  const { r, g, b } = color;
  const name = escapeXml(truncate(session, MAX_NAME_LEN));
  const bottomText = escapeXml(truncate(detail || state, 14));

  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const textColor = luminance > 140 ? '#000' : '#fff';

  const icon = renderIcon(state, textColor);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" rx="12" fill="rgb(${r},${g},${b})" />
  <text x="${SIZE / 2}" y="30" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="${textColor}">${name}</text>
  ${icon}
  <text x="${SIZE / 2}" y="122" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="${textColor}" opacity="0.85">${bottomText}</text>
</svg>`;
}
```

Changes versus the previous version:
- project name moves from `y=42` to `y=30` and shrinks from 20 to 18.
- state text moves from `y=100` to `y=122` and shrinks from 16 to 14.
- an `${icon}` slot is inserted between the two `<text>` elements.

- [ ] **Step 4: Run the full test suite and verify everything passes**

Run: `cd server && npm test`
Expected: PASS on every test in `server/test/*.test.js`, including the six state icon tests, the unknown-state fallback, the two stroke-colour tests, and the font-size test.

- [ ] **Step 5: Commit**

```bash
git add server/button-renderer.js server/test/button-renderer.test.js
git commit -m "feat(server): show Lucide state icons on buttons"
```

---

## Task 5: Manual smoke test on the running Stream Deck

**Files:** none (manual verification)

- [ ] **Step 1: Restart the server to pick up the new renderer**

Run:
```bash
launchctl unload ~/Library/LaunchAgents/com.claude.streamdeck.plist
launchctl load ~/Library/LaunchAgents/com.claude.streamdeck.plist
```

Expected: no output, `curl http://localhost:7842/health` returns `{"status":"ok",...}`.

- [ ] **Step 2: Push each state to the server and eyeball the buttons**

Run (one at a time, watch the Stream Deck after each):

```bash
curl -s -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{"session":"smoke","state":"idle","color":{"r":0,"g":200,"b":0},"tabIndex":0}'
curl -s -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{"session":"smoke","state":"thinking","color":{"r":30,"g":100,"b":255},"tabIndex":0}'
curl -s -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{"session":"smoke","state":"tool_use","color":{"r":30,"g":100,"b":255},"detail":"Bash","tabIndex":0}'
curl -s -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{"session":"smoke","state":"permission","color":{"r":255,"g":165,"b":0},"tabIndex":0}'
curl -s -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{"session":"smoke","state":"error","color":{"r":255,"g":0,"b":0},"tabIndex":0}'
curl -s -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{"session":"smoke","state":"done","color":{"r":0,"g":200,"b":0},"tabIndex":0}'
```

Expected: button 0 of the Stream Deck cycles through six icons (moon, brain, wrench, shield-alert, alert-triangle, check-circle), each one legible against its background and vertically aligned between the project name and state text.

- [ ] **Step 3: Verify the unknown-state fallback**

Run:
```bash
curl -s -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{"session":"smoke","state":"mystery","color":{"r":30,"g":100,"b":255},"tabIndex":0}'
```

Expected: button shows the project name and the text "mystery" but no icon — the layout remains readable.

- [ ] **Step 4: No commit (verification only)**

---

## Self-Review Notes

- **Spec coverage:** every section of the spec maps to a task — icons module (Task 2), `renderIcon` helper (Task 3), `renderButton` integration and layout adjustment (Task 4), error/fallback behaviour (covered by the unknown-state tests in Tasks 3 and 4), testing section (Tasks 2, 3, 4), and a manual smoke test (Task 5).
- **Placeholder scan:** Task 2 explicitly instructs the engineer to replace the comment placeholders with real `d` strings downloaded in Task 1; there are no TBDs elsewhere.
- **Type consistency:** `renderIcon(state, textColor)` signature is the same in Task 3 (implementation), the Task 3 unit tests, and the Task 4 integration tests. `STATE_ICONS[state] = { name, paths }` shape is consistent across Tasks 2, 3, and 4.
- **Coordinates:** `translate(52, 56) scale(1.6667)` matches the spec's layout section. Font sizes 18/14 and baselines 30/122 match the spec.
