// Icon set ported from the Wild Wonders design (Icon.dc.html).
// Pure vanilla JS: renderIcon() returns an inline <svg> markup string.

const ICON_DEFS = {
  home: { shapes: [{ t: 'path', d: 'M3 10.5 12 3l9 7.5' }, { t: 'path', d: 'M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5' }, { t: 'path', d: 'M9.5 21v-6h5v6' }] },
  search: { shapes: [{ t: 'circle', cx: 11, cy: 11, r: 6.5 }, { t: 'line', x1: 20, y1: 20, x2: 15.8, y2: 15.8 }] },
  heart: { shapes: [{ t: 'path', d: 'M12 20.3C12 20.3 3.5 15 3.5 8.9 3.5 5.9 5.8 3.5 8.8 3.5 10.6 3.5 12 4.6 12 4.6 12 4.6 13.4 3.5 15.2 3.5 18.2 3.5 20.5 5.9 20.5 8.9 20.5 15 12 20.3 12 20.3Z' }] },
  shuffle: { shapes: [{ t: 'path', d: 'M2.5 6h3.7c1.8 0 2.7 1 3.6 2.3L15 18c.9 1.3 1.8 2.3 3.6 2.3H21' }, { t: 'path', d: 'M17 3.2 21 6l-4 2.8' }, { t: 'path', d: 'M2.5 18h3.7c1.8 0 2.7-1 3.6-2.3' }, { t: 'path', d: 'M17 20.8 21 18l-4-2.8' }] },
  'chevron-left': { shapes: [{ t: 'path', d: 'M15 5 8 12l7 7' }] },
  'chevron-right': { shapes: [{ t: 'path', d: 'M9 5l7 7-7 7' }] },
  x: { shapes: [{ t: 'line', x1: 6, y1: 6, x2: 18, y2: 18 }, { t: 'line', x1: 18, y1: 6, x2: 6, y2: 18 }] },
  filter: { shapes: [{ t: 'line', x1: 4, y1: 6, x2: 20, y2: 6 }, { t: 'line', x1: 7.5, y1: 12, x2: 16.5, y2: 12 }, { t: 'line', x1: 10.5, y1: 18, x2: 13.5, y2: 18 }] },
  'map-pin': { shapes: [{ t: 'path', d: 'M12 21s7-6.8 7-12.3A7 7 0 0 0 5 8.7C5 14.2 12 21 12 21z' }, { t: 'circle', cx: 12, cy: 8.7, r: 2.3 }] },
  sparkles: { solid: true, shapes: [{ t: 'path', d: 'M11.5 2.5 13 7l4.5 1.5L13 10l-1.5 4.5L10 10l-4.5-1.5L10 7z' }, { t: 'path', d: 'M18.5 14 19.3 16.2 21.5 17l-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z' }] },
  check: { shapes: [{ t: 'path', d: 'M4.5 12.5 9.5 17.5 19.5 6.5' }] },
  'arrow-up': { shapes: [{ t: 'line', x1: 12, y1: 19, x2: 12, y2: 5 }, { t: 'path', d: 'M5.5 11.5 12 5l6.5 6.5' }] },
  dumbbell: { shapes: [{ t: 'circle', cx: 5.5, cy: 12, r: 2.6 }, { t: 'circle', cx: 18.5, cy: 12, r: 2.6 }, { t: 'line', x1: 8.1, y1: 12, x2: 15.9, y2: 12 }] },
  'move-horizontal': { shapes: [{ t: 'line', x1: 3.5, y1: 12, x2: 20.5, y2: 12 }, { t: 'path', d: 'M8 7.5 3.5 12 8 16.5' }, { t: 'path', d: 'M16 7.5 20.5 12 16 16.5' }] },
  clock: { shapes: [{ t: 'circle', cx: 12, cy: 12, r: 9 }, { t: 'path', d: 'M12 7v5.3l3.5 2' }] },
  leaf: { shapes: [{ t: 'path', d: 'M12 3c-1.2 2.3-3.7 2.6-5.5 4.4C3.2 10.7 3 15.7 6 19c3.3 3 8.3 2.8 11.6-.5C21.7 14.4 21 6.5 12 3z' }, { t: 'path', d: 'M7 18c3-4.5 6-7 11-11.5' }] },
  mountain: { solid: true, shapes: [{ t: 'path', d: 'M3 19 9 8.5l3.2 5.3L15 9l6 10z' }] },
  zap: { solid: true, shapes: [{ t: 'path', d: 'M13.5 2.5 5 14h5.5L10 21.5 19 10h-5.5z' }] },
  lightbulb: { shapes: [{ t: 'path', d: 'M12 3.5a6 6 0 0 0-3.6 10.8c.5.4.6 1 .6 1.6v.4h6v-.4c0-.6.1-1.2.6-1.6A6 6 0 0 0 12 3.5z' }, { t: 'line', x1: 9.3, y1: 19.3, x2: 14.7, y2: 19.3 }, { t: 'line', x1: 10, y1: 21.5, x2: 14, y2: 21.5 }] },
  'paw-print': { solid: true, shapes: [{ t: 'ellipse', cx: 12, cy: 16, rx: 5.2, ry: 4.3 }, { t: 'ellipse', cx: 5.3, cy: 9.3, rx: 2, ry: 2.5 }, { t: 'ellipse', cx: 10.2, cy: 5.8, rx: 2, ry: 2.6 }, { t: 'ellipse', cx: 15.8, cy: 5.8, rx: 2, ry: 2.6 }, { t: 'ellipse', cx: 20.7, cy: 9.3, rx: 2, ry: 2.5 }] },
  bird: { solid: true, shapes: [{ t: 'path', d: 'M3 13c3.2-4.3 6.4-4.3 9-1 2.6-3.3 5.8-3.3 9 1-3 1.3-6 4.5-9 2.2-3 2.3-6-.9-9-2.2z' }] },
  diamond: { shapes: [{ t: 'path', d: 'M12 3 20 12 12 21 4 12z' }] },
  droplet: { shapes: [{ t: 'path', d: 'M12 3S5.5 11 5.5 15.5a6.5 6.5 0 0 0 13 0C18.5 11 12 3 12 3z' }] },
  fish: { shapes: [{ t: 'path', d: 'M3 12.5c4-5 10-6.8 14.5-4.6-1 2-1 3.7 0 5.7C13 15.8 7 14 3 12.5z' }, { t: 'path', d: 'M17.5 10.2 21 8v9l-3.5-2.2' }, { t: 'circle', cx: 7.2, cy: 11.5, r: 0.6 }] },
  triangle: { solid: true, shapes: [{ t: 'path', d: 'M12 3.5 20 20H4z' }] },
  waves: { shapes: [{ t: 'path', d: 'M2 9c2-2.2 4-2.2 6 0s4 2.2 6 0 4-2.2 6-2.2' }, { t: 'path', d: 'M2 15c2-2.2 4-2.2 6 0s4 2.2 6 0 4-2.2 6-2.2' }] },
  crocodile: { shapes: [{ t: 'path', d: 'M2 14.5c2.5-1.8 4.5-1.8 6.5 0 1.8 1.6 3.4 1.6 5 0 1.3-1.1 2.6-1.4 4-1 1.3.4 2.6.4 4-1.2' }, { t: 'path', d: 'M9 14.5v2.2M11.4 14.9v2.2M13.8 14.9v2' }, { t: 'circle', cx: 4.2, cy: 12.6, r: 1.1 }] },
  ladybug: { shapes: [{ t: 'circle', cx: 12, cy: 13.5, r: 6.3 }, { t: 'line', x1: 12, y1: 7.3, x2: 12, y2: 19.7 }, { t: 'path', d: 'M8.5 8 6.3 5.8' }, { t: 'path', d: 'M15.5 8l2.2-2.2' }, { t: 'circle', cx: 9.6, cy: 12, r: 0.9 }, { t: 'circle', cx: 14.4, cy: 15, r: 0.9 }] },
  spider: { shapes: [{ t: 'circle', cx: 12, cy: 13, r: 3.2 }, { t: 'path', d: 'M9.2 11.5 3.5 7' }, { t: 'path', d: 'M9.2 13 3 13' }, { t: 'path', d: 'M9.2 14.8 3.5 19.5' }, { t: 'path', d: 'M14.8 11.5 20.5 7' }, { t: 'path', d: 'M14.8 13 21 13' }, { t: 'path', d: 'M14.8 14.8 20.5 19.5' }] },
  barn: { shapes: [{ t: 'path', d: 'M4 12 12 6l8 6v7.5H4z' }, { t: 'line', x1: 4, y1: 12, x2: 20, y2: 12 }, { t: 'line', x1: 12, y1: 12, x2: 12, y2: 19.5 }] },
  bone: { solid: true, shapes: [{ t: 'path', d: 'M6.5 8.8a2.3 2.3 0 1 0-3.3 3.2 2.3 2.3 0 1 0 3.3 3.2l7.4-7.4a2.3 2.3 0 1 0 3.3-3.2 2.3 2.3 0 1 0-3.3-3.2z' }] },
  sun: { shapes: [{ t: 'circle', cx: 12, cy: 12, r: 4.3 }, { t: 'line', x1: 12, y1: 2.5, x2: 12, y2: 4.8 }, { t: 'line', x1: 12, y1: 19.2, x2: 12, y2: 21.5 }, { t: 'line', x1: 2.5, y1: 12, x2: 4.8, y2: 12 }, { t: 'line', x1: 19.2, y1: 12, x2: 21.5, y2: 12 }, { t: 'line', x1: 5.4, y1: 5.4, x2: 7, y2: 7 }, { t: 'line', x1: 17, y1: 17, x2: 18.6, y2: 18.6 }, { t: 'line', x1: 5.4, y1: 18.6, x2: 7, y2: 17 }, { t: 'line', x1: 17, y1: 7, x2: 18.6, y2: 5.4 }] },
  snowflake: { shapes: [{ t: 'line', x1: 12, y1: 2.5, x2: 12, y2: 21.5 }, { t: 'line', x1: 4.5, y1: 7.2, x2: 19.5, y2: 16.8 }, { t: 'line', x1: 4.5, y1: 16.8, x2: 19.5, y2: 7.2 }] },
  shield: { shapes: [{ t: 'path', d: 'M12 3 19 6v6c0 5-3 8-7 9-4-1-7-4-7-9V6z' }] },
  moon: { solid: true, shapes: [{ t: 'path', d: 'M15.5 3.5a9 9 0 1 0 5 15.3A7.3 7.3 0 0 1 15.5 3.5z' }] },
  bottle: { shapes: [{ t: 'path', d: 'M10.2 3.2h3.6v2.6l1.7 1.9v11.6a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V7.7l1.7-1.9z' }, { t: 'line', x1: 9.8, y1: 9.5, x2: 14.2, y2: 9.5 }] },
  info: { shapes: [{ t: 'circle', cx: 12, cy: 12, r: 9 }, { t: 'line', x1: 12, y1: 11, x2: 12, y2: 16.3 }, { t: 'circle', cx: 12, cy: 7.6, r: 0.6 }] },
  snake: { shapes: [{ t: 'path', d: 'M4.5 9c2.3 0 2.3 3.3 4.7 3.3s2.3-3.3 4.7-3.3 2.3 3.3 4.7 3.3 2.3-3.3 4.7-3.3' }, { t: 'circle', cx: 4.5, cy: 9, r: 1.8 }] },
  lizard: { shapes: [{ t: 'path', d: 'M6 13c2 1.5 4 1.5 6 0s4-1.5 6 0' }, { t: 'path', d: 'M18 13l3.5 -1.5' }, { t: 'circle', cx: 6, cy: 13, r: 1.9 }, { t: 'line', x1: 9, y1: 14.5, x2: 8.3, y2: 17.5 }, { t: 'line', x1: 15, y1: 14.5, x2: 15.7, y2: 17.5 }] },
  turtle: { shapes: [{ t: 'path', d: 'M4 14a8 5.5 0 0 1 16 0z' }, { t: 'circle', cx: 19.5, cy: 13, r: 1.7 }, { t: 'line', x1: 9, y1: 14, x2: 9, y2: 17.3 }, { t: 'line', x1: 15, y1: 14, x2: 15, y2: 17.3 }] }
};

function shapeMarkup(s, stroke, strokeWidth, fill) {
  if (s.t === 'path') return `<path d="${s.d}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" stroke-linecap="round" stroke-linejoin="round"></path>`;
  if (s.t === 'circle') return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}"></circle>`;
  if (s.t === 'line') return `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"></line>`;
  if (s.t === 'ellipse') return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}"></ellipse>`;
  return '';
}

export function renderIcon(icon, size = 24, color = 'currentColor', strokeWidth = 2.75, filled = false) {
  const def = ICON_DEFS[icon] || { shapes: [{ t: 'circle', cx: 12, cy: 12, r: 9 }] };
  const isSolid = !!def.solid || !!filled;
  const fill = isSolid ? color : 'none';
  const stroke = isSolid ? 'none' : color;
  const shapes = def.shapes.map(s => shapeMarkup(s, stroke, strokeWidth, fill)).join('');
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" style="display:block;flex-shrink:0" aria-hidden="true">${shapes}</svg>`;
}
