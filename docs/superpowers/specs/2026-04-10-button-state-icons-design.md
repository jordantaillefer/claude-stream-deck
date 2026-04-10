# Button State Icons — Design

## Goal

Add a visual icon to each Stream Deck button that reflects the current Claude
Code session state, so that state is recognisable at a glance without reading
text.

## Context

Today, `server/button-renderer.js` renders a 144×144 SVG with:
- a solid colour background derived from the `color` field,
- the project name at the top (`<text>`, size 20, bold),
- the state/detail string at the bottom (`<text>`, size 16).

Colour alone encodes state. This design adds a monochrome icon between the two
text lines, picked from the `state` field.

## User-visible behaviour

Each button keeps its coloured background and now shows three elements stacked
vertically, centred:

1. **Project name** (top, size 18, bold)
2. **State icon** (middle, 40×40, monochrome stroke matching text colour)
3. **State or detail text** (bottom, size 14)

Font sizes shrink slightly (20→18 and 16→14) to make room for the 40 px icon
without the layout feeling cramped.

## State → icon mapping

| `state` value  | Lucide icon      | Meaning                |
|----------------|------------------|------------------------|
| `idle`         | `moon`           | waiting, quiet         |
| `thinking`     | `brain`          | Claude is reasoning    |
| `tool_use`     | `wrench`         | running a tool         |
| `permission`   | `shield-alert`   | awaiting authorisation |
| `error`        | `alert-triangle` | something failed       |
| `done`         | `check-circle`   | task completed         |

Unknown `state` values fall back to rendering without an icon (the layout
still works — the icon slot stays empty). This preserves backward compatibility
with any hook that reports a state the renderer does not know about.

## Architecture

### New module: `server/icons.js`

Exports a single constant mapping state names to icon definitions:

```js
// server/icons.js
// Path data is copied verbatim from the Lucide source
// (https://github.com/lucide-icons/lucide) during implementation.
export const STATE_ICONS = {
  idle:       { name: 'moon',           paths: [/* moon paths */] },
  thinking:   { name: 'brain',          paths: [/* brain paths */] },
  tool_use:   { name: 'wrench',         paths: [/* wrench paths */] },
  permission: { name: 'shield-alert',   paths: [/* shield-alert paths */] },
  error:      { name: 'alert-triangle', paths: [/* alert-triangle paths */] },
  done:       { name: 'check-circle',   paths: [/* check-circle paths */] },
};
```

Each entry contains:
- `name` — the Lucide icon name, used for the `data-icon` attribute in the
  rendered SVG and for test assertions.
- `paths` — an array of `d` attribute strings copied verbatim from Lucide's
  source. Lucide icons are line-icons defined on a 24×24 viewBox, so we render
  them inside a `<g>` that scales them to 40×40 and positions them centred
  horizontally on the button.

The file contains **only data** — no rendering logic. It is pure constants.

### Updated module: `server/button-renderer.js`

`renderButton` gains a small helper `renderIcon(state, textColor)` that:

1. Looks up `STATE_ICONS[state]`. If absent, returns an empty string.
2. Returns an SVG `<g>` fragment:
   - `transform="translate(52, 56) scale(1.6667)"` — centres a 40×40 icon on a
     144-wide button (`(144 - 40) / 2 = 52`) and scales Lucide's 24×24 viewBox
     to 40 px (`40 / 24 ≈ 1.6667`).
   - Contains `<path>` elements for each entry in `paths`, with
     `stroke="${textColor}"`, `stroke-width="2"`, `fill="none"`,
     `stroke-linecap="round"`, `stroke-linejoin="round"` (Lucide defaults).
   - A `data-icon="${name}"` attribute on the `<g>` for test assertions.

The new layout in `renderButton`:

```
y=30   project name (size 18, bold, baseline)
y=56…96  icon box (40×40, top at y=56)
y=122  state/detail text (size 14, baseline)
```

The 26-pixel gap between the project-name baseline and the icon top, and the
26-pixel gap between the icon bottom and the state-text baseline, keep the
stack visually balanced on the 144×144 surface.

`renderEmptyButton` is unchanged.

### No API changes

- The POST `/state` contract is untouched.
- `SessionManager` is untouched.
- Plugin code is untouched — it continues to receive the rendered SVG as a
  data URI and blit it to the Stream Deck.

## Data flow

```
hook → POST /state → SessionManager.update
                        ↓
              renderButton(session)
                ├── draws coloured rect
                ├── draws project name
                ├── renderIcon(state, textColor) ← NEW
                └── draws state/detail text
                        ↓
              svgToDataUri → WS broadcast → plugin setImage
```

No new asynchronous paths, no file I/O, no dependencies added.

## Error handling

- Unknown `state` → `renderIcon` returns an empty string, layout still renders.
- Missing `color` → already handled upstream (`POST /state` requires color).
- Invalid path data in `STATE_ICONS` → surface as visible rendering glitch; a
  unit test per state prevents regressions.

## Testing

`server/test/button-renderer.test.js` gains:

1. **Per-state icon presence** — for each state in `STATE_ICONS`, assert the
   rendered SVG contains `data-icon="<icon-name>"`.
2. **Unknown state fallback** — passing `state: 'mystery'` renders a valid SVG
   without any `data-icon` attribute and does not throw.
3. **Icon stroke colour matches text colour** — assert the `<g data-icon>`
   block contains the expected `stroke` value based on background luminance
   (one bright background, one dark).

No new test files needed.

## Out of scope (YAGNI)

- User-configurable icon mapping.
- Animated icons (rotating spinner, pulsing, etc.).
- Multi-colour / filled icons.
- Icon library selection (Lucide is fixed).
- Fallback icon for unknown states — intentionally empty so missing states are
  visible during development.

## Open questions

None. The 6-icon mapping is fixed; exact `d` path strings will be copied from
the Lucide source during implementation.
