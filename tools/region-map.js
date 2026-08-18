'use strict';
// Generates assets/region-map.svg — the region map of the (a,b) form square.
// Zero dependencies; the only import is the project's own engine, which is used
// both to place the 7 preset markers (via pathAB) and to verify, at generation
// time, that every labelled region really yields that region's form key.
//
//   node tools/region-map.js
//
// Deterministic: same input constants -> byte-identical SVG.
//
// Curves (CLAUDE.md, "Crystallography invariants"):
//   n vanishes at b_n(a) = a / (2(1-a)),  a <= 2/3
//   d vanishes at b_d(a) = 2(1-a) / a,    a >= 2/3
//   both reach b = 1 at a = 2/3.

const fs = require('fs');
const path = require('path');
const G = require('../src/engine.js');

const OUT = path.resolve(__dirname, '..', 'assets', 'region-map.svg');

// ------------------------------------------------------------------ geometry

const b_n = a => a / (2 * (1 - a));
const b_d = a => 2 * (1 - a) / a;
const A_CROSS = 2 / 3;

// Plot frame inside a 640x560 viewBox.
const X0 = 96, X1 = 566, Y0 = 458, Y1 = 78;
const px = a => X0 + a * (X1 - X0);
const py = b => Y0 - b * (Y0 - Y1);

// Fixed 2-decimal formatting keeps the output byte-stable across platforms.
const f = v => {
  const s = (Math.round(v * 100) / 100).toFixed(2);
  return s === '-0.00' ? '0.00' : s;
};
const P = (a, b) => f(px(a)) + ' ' + f(py(b));

// Sample a curve as an array of "x y" strings.
function curve(fn, a0, a1, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    pts.push(P(a, Math.min(1, Math.max(0, fn(a)))));
  }
  return pts;
}

const N = 240;
const CN = curve(b_n, 0, A_CROSS, N);          // (0,0) -> (2/3,1)
const CD = curve(b_d, A_CROSS, 1, N);          // (2/3,1) -> (1,0)

const pathOf = pts => 'M ' + pts.join(' L ');
const rev = pts => pts.slice().reverse();

// Region polygons.
const FILL_DNH = pathOf([P(0, 0)].concat(CD.slice().reverse(), rev(CN).slice(1))) + ' Z';
const FILL_DH = pathOf(CN.concat([P(0, 1)])) + ' Z';
const FILL_NH = pathOf(CD.concat([P(1, 1), P(A_CROSS, 1)])) + ' Z';

// ------------------------------------------------------------------- content

const REGIONS = [
  { key: 'dnh', label: 'd + n + h', a: 0.35, b: 0.14, fill: 0.115, d: FILL_DNH },
  { key: 'dh',  label: 'd + h',     a: 0.22, b: 0.70, fill: 0.075, d: FILL_DH },
  { key: 'nh',  label: 'n + h',     a: 0.86, b: 0.60, fill: 0.05,  d: FILL_NH }
];

// (t, m) preset chips from index.html; (a,b) comes from the engine's pathAB.
const PRESETS = [
  { t: 0,   m: 0,   label: 'd',       dx:  9, dy:  -9, anchor: 'start' },
  { t: 0.5, m: 0,   label: 'd+n',     dx:  0, dy: -11, anchor: 'middle' },
  { t: 1,   m: 0,   label: 'n',       dx: -13, dy: -10, anchor: 'end' },
  { t: 1.5, m: 0,   label: 'n+h',     dx: -9, dy:   4, anchor: 'end' },
  { t: 2,   m: 0,   label: 'h',       dx: -9, dy:  17, anchor: 'end' },
  { t: 0,   m: 0.5, label: 'd+h',     dx:  9, dy:   4, anchor: 'start' },
  { t: 0.5, m: 0.3, label: 'd+n+h',   dx:  9, dy:  -6, anchor: 'start' }
];

const A_TICKS = [
  [0, '0'], [0.25, '0.25'], [0.5, '0.5'], [A_CROSS, '2/3'], [1, '1']
];
const B_TICKS = [
  [0, '0'], [0.25, '0.25'], [0.5, '0.5'], [0.75, '0.75'], [1, '1']
];

// --------------------------------------------------------------- verification

const formKey = f2 => (f2.d ? 'd' : '') + (f2.n ? 'n' : '') + (f2.h ? 'h' : '');
const keyAt = (a, b) => formKey(G.formsPresent(G.formAt(a, b)));

let bad = 0;
const log = [];

log.push('region label -> engine key');
for (const r of REGIONS) {
  const k = keyAt(r.a, r.b);
  const ok = k === r.key;
  if (!ok) bad++;
  log.push(`  "${r.label}" at (a=${r.a}, b=${r.b}) -> ${k} ${ok ? 'OK' : 'MISMATCH, expected ' + r.key}`);
}

log.push('preset marker -> (a,b) -> engine key');
for (const p of PRESETS) {
  const [a, b] = G.pathAB(p.t, p.m);
  const shape = G.shapeAt(p.t, p.m);
  const k = formKey(G.formsPresent(shape));
  const ok = k === p.label.replace(/\+/g, '');
  if (!ok) bad++;
  p.a = a; p.b = b;
  log.push(`  t=${p.t} m=${p.m} -> (a=${a}, b=${b}) -> ${k} E=${shape.size} ` +
           `${ok ? 'OK' : 'MISMATCH, expected ' + p.label}`);
}

log.push('curve crossing');
log.push(`  b_n(2/3) = ${b_n(A_CROSS)}, b_d(2/3) = ${b_d(A_CROSS)}`);

// ------------------------------------------------------------------ emit SVG

const L = [];
const add = s => L.push(s);

add('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 560" width="640" height="560" role="img" aria-labelledby="rm-title rm-desc">');
add('<title id="rm-title">Region map of the (a, b) form square</title>');
add('<desc id="rm-desc">The unit square of the two form parameters. The curve b_n(a) = a / (2(1 - a)) for a up to 2/3 and the curve b_d(a) = 2(1 - a) / a for a from 2/3 to 1 meet at a = 2/3, b = 1. Below both curves the shape carries all three forms, d + n + h. Above b_n and left of a = 2/3 it is d + h; above b_d and right of a = 2/3 it is n + h. Seven markers show the preset habits.</desc>');
add('<style>');
add('  .bg{fill:#000}');
add('  .frame{fill:none;stroke:#8a857a;stroke-width:1.2}');
add('  .grid{stroke:#8a857a;stroke-width:0.6;opacity:0.28}');
add('  .cross{stroke:#8a857a;stroke-width:1;opacity:0.5;stroke-dasharray:4 4}');
add('  .curve{fill:none;stroke:#b9b2a4;stroke-width:2.1;stroke-linejoin:round;stroke-linecap:round}');
add('  .tick{stroke:#8a857a;stroke-width:1.2}');
add('  text{fill:#e8e4dc}');
add('  .t-region{font:400 18px Georgia,\'Times New Roman\',serif;letter-spacing:0.04em;text-anchor:middle}');
add('  .t-axis{font:400 14px Georgia,\'Times New Roman\',serif;fill:#b9b2a4;letter-spacing:0.05em;text-anchor:middle}');
add('  .t-tick{font:12px system-ui,-apple-system,\'Segoe UI\',sans-serif;fill:#8a857a}');
add('  .t-edge{font:12.5px system-ui,-apple-system,\'Segoe UI\',sans-serif;fill:#8a857a;text-anchor:middle}');
add('  .t-mark{font:12.5px system-ui,-apple-system,\'Segoe UI\',sans-serif;fill:#e8e4dc}');
add('  .t-head{font:400 15px Georgia,\'Times New Roman\',serif;fill:#b9b2a4;letter-spacing:0.08em;text-anchor:middle}');
add('  .t-curve{font:12px system-ui,-apple-system,\'Segoe UI\',sans-serif;fill:#b9b2a4}');
add('  .dot{fill:#e8e4dc;stroke:#000;stroke-width:1.5}');
add('</style>');

add(`<rect class="bg" x="0" y="0" width="640" height="560"/>`);

// region fills
for (const r of REGIONS)
  add(`<path d="${r.d}" fill="#b9b2a4" fill-opacity="${r.fill}"/>`);

// grid
for (const [a] of A_TICKS)
  add(`<line class="grid" x1="${f(px(a))}" y1="${f(Y1)}" x2="${f(px(a))}" y2="${f(Y0)}"/>`);
for (const [b] of B_TICKS)
  add(`<line class="grid" x1="${f(X0)}" y1="${f(py(b))}" x2="${f(X1)}" y2="${f(py(b))}"/>`);

// a = 2/3 marker line
add(`<line class="cross" x1="${f(px(A_CROSS))}" y1="${f(Y1)}" x2="${f(px(A_CROSS))}" y2="${f(Y0)}"/>`);

// frame
add(`<rect class="frame" x="${f(X0)}" y="${f(Y1)}" width="${f(X1 - X0)}" height="${f(Y0 - Y1)}"/>`);

// curves
add(`<path class="curve" d="${pathOf(CN)}"/>`);
add(`<path class="curve" d="${pathOf(CD)}"/>`);

// curve labels — each sits on the far side of its own curve, clear of the other
const sub = (head, tail) =>
  `b<tspan font-size="9" dy="3">${head}</tspan><tspan dy="-3">${tail}</tspan>`;
add(`<text class="t-curve" x="${f(px(0.45) - 9)}" y="${f(py(b_n(0.45)))}" text-anchor="end">${sub('n', '(a) = a/(2(1−a))')}</text>`);
add(`<text class="t-curve" x="${f(px(0.90) - 9)}" y="${f(py(b_d(0.90)))}" text-anchor="end">${sub('d', '(a) = 2(1−a)/a')}</text>`);

// region labels
for (const r of REGIONS)
  add(`<text class="t-region" x="${f(px(r.a))}" y="${f(py(r.b))}">${r.label}</text>`);

// ticks + tick labels
for (const [a, s] of A_TICKS) {
  add(`<line class="tick" x1="${f(px(a))}" y1="${f(Y0)}" x2="${f(px(a))}" y2="${f(Y0 + 6)}"/>`);
  add(`<text class="t-tick" x="${f(px(a))}" y="${f(Y0 + 20)}" text-anchor="middle">${s}</text>`);
}
for (const [b, s] of B_TICKS) {
  add(`<line class="tick" x1="${f(X0 - 6)}" y1="${f(py(b))}" x2="${f(X0)}" y2="${f(py(b))}"/>`);
  add(`<text class="t-tick" x="${f(X0 - 10)}" y="${f(py(b) + 4)}" text-anchor="end">${s}</text>`);
}

// preset markers
for (const p of PRESETS) {
  add(`<circle class="dot" cx="${f(px(p.a))}" cy="${f(py(p.b))}" r="4"/>`);
  add(`<text class="t-mark" x="${f(px(p.a) + p.dx)}" y="${f(py(p.b) + p.dy)}" text-anchor="${p.anchor}">${p.label}</text>`);
}

// headings, axis titles, edge annotations
add(`<text class="t-head" x="331" y="30">THE (a, b) FORM SQUARE</text>`);
add(`<text class="t-edge" x="331" y="62">b = 1 — pure {321}, for every a</text>`);
add(`<text class="t-axis" x="331" y="502">a — n-depth</text>`);
add(`<text class="t-edge" x="331" y="526">b = 0 — the d+n path: d → d+n → n</text>`);
add(`<text class="t-axis" x="22" y="268" transform="rotate(-90 22 268)">b — {321} depth</text>`);
add(`<text class="t-edge" x="50" y="268" transform="rotate(-90 50 268)">a = 0 — d, then d+h</text>`);
add(`<text class="t-edge" x="592" y="268" transform="rotate(-90 592 268)">a = 1 — n, then n+h</text>`);

add('</svg>');

const svg = L.join('\n') + '\n';

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, svg, 'utf8');

console.log(log.join('\n'));
console.log(`\nwrote ${OUT} (${svg.length} bytes)`);
if (bad) {
  console.error(`\n${bad} verification mismatch(es) — the map does not agree with the engine.`);
  process.exit(1);
}
