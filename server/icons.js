// server/icons.js
// State → Lucide icon mapping. Path data is copied verbatim from the Lucide
// MIT-licensed source at https://github.com/lucide-icons/lucide/tree/main/icons.
// Each icon is designed on a 24×24 viewBox and rendered as line art
// (stroke only, no fill) by button-renderer.js.

export const STATE_ICONS = {
  idle: {
    name: 'moon',
    paths: [
      'M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401',
    ],
  },
  thinking: {
    name: 'brain',
    paths: [
      'M12 18V5',
      'M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4',
      'M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5',
      'M17.997 5.125a4 4 0 0 1 2.526 5.77',
      'M18 18a4 4 0 0 0 2-7.464',
      'M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517',
      'M6 18a4 4 0 0 1-2-7.464',
      'M6.003 5.125a4 4 0 0 0-2.526 5.77',
    ],
  },
  tool_use: {
    name: 'wrench',
    paths: [
      'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z',
    ],
  },
  permission: {
    name: 'shield-alert',
    paths: [
      'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
      'M12 8v4',
      'M12 16h.01',
    ],
  },
  error: {
    name: 'alert-triangle',
    paths: [
      'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3',
      'M12 9v4',
      'M12 17h.01',
    ],
  },
  done: {
    name: 'check-circle',
    paths: [
      // Lucide circle-check uses a <circle cx="12" cy="12" r="10" />; converted
      // to an equivalent path so the renderer can treat all icons uniformly.
      'M 2 12 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0',
      'm9 12 2 2 4-4',
    ],
  },
};

// State → button color. Lets hooks post just a `state` and have the server
// derive the color, mirroring the iTerm2 tab badge brightness values the hooks
// also set via OSC. Hooks may still send an explicit `color` to override.
export const STATE_COLORS = {
  idle: { r: 0, g: 200, b: 0 },
  thinking: { r: 30, g: 100, b: 255 },
  tool_use: { r: 30, g: 100, b: 255 },
  permission: { r: 255, g: 165, b: 0 },
  error: { r: 255, g: 0, b: 0 },
  done: { r: 0, g: 200, b: 0 },
};

const DEFAULT_COLOR = { r: 120, g: 120, b: 120 };

export function colorForState(state) {
  return STATE_COLORS[state] || DEFAULT_COLOR;
}
