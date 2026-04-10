// server/button-renderer.js
import { STATE_ICONS } from './icons.js';

const SIZE = 144;
const MAX_NAME_LEN = 10;

function truncate(str, max) {
  if (str.length <= max) return str;
  return str.slice(0, max) + '…';
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderIcon(state, textColor) {
  const icon = STATE_ICONS[state];
  if (!icon) return '';
  const paths = icon.paths
    .map((d) => `<path d="${d}" stroke="${textColor}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />`)
    .join('');
  return `<g data-icon="${icon.name}" transform="translate(52, 56) scale(1.6667)">${paths}</g>`;
}

export function renderButton({ session, state, color, detail }) {
  const { r, g, b } = color;
  const name = escapeXml(truncate(session, MAX_NAME_LEN));
  const bottomText = escapeXml(truncate(detail || state, 14));

  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const textColor = luminance > 140 ? '#000' : '#fff';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" rx="12" fill="rgb(${r},${g},${b})" />
  <text x="${SIZE / 2}" y="42" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="${textColor}">${name}</text>
  <text x="${SIZE / 2}" y="100" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="${textColor}" opacity="0.85">${bottomText}</text>
</svg>`;
}

export function renderEmptyButton() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" rx="12" fill="rgb(30,30,30)" />
</svg>`;
}

export function svgToDataUri(svg) {
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}
