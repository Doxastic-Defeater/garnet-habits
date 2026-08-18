#!/usr/bin/env node
/* Garnet habits — social card generator.

   Renders assets/og.png (1200x630): the d+n habit, shapeAt(0.5, 0), drawn with
   the same projection as the viewer (rotP + perspective + depth alpha/linewidth),
   white on black, with a stroked title and the Miller symbols beneath it.

   Zero dependencies: the wireframe is rasterized into an RGB buffer by an
   anti-aliased line drawer, and the PNG is written by hand (IHDR/IDAT/IEND,
   CRC32, zlib.deflateSync from node core). Deterministic — re-running it
   reproduces the committed file byte for byte.

   Usage:  node tools/og-card.js  [outfile]                                   */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { shapeAt } = require('../src/engine.js');

const W = 1200, H = 630;
const CAM = 5.2;                 // viewer camera
const RX = 0.42, RY = 0.62;      // fixed pose
const T = 0.5, M = 0;            // d+n preset
const CENTER = [W / 2, 330];     // crystal centre
const HALF = 212;                // target half-height of the crystal, px
const FG = [255, 255, 255];      // white variety
const TITLE = [233, 229, 221];
const SUB = [150, 145, 133];

// ---------------------------------------------------------------- raster

const buf = new Uint8Array(W * H * 3);   // black ground: all zeroes

function blend(x, y, cov, col) {
  if (cov <= 0 || x < 0 || y < 0 || x >= W || y >= H) return;
  if (cov > 1) cov = 1;
  const i = (y * W + x) * 3;
  buf[i]     = buf[i]     + (col[0] - buf[i])     * cov;
  buf[i + 1] = buf[i + 1] + (col[1] - buf[i + 1]) * cov;
  buf[i + 2] = buf[i + 2] + (col[2] - buf[i + 2]) * cov;
}

// Anti-aliased round-capped segment: coverage from distance to the segment.
function line(x0, y0, x1, y1, width, col, alpha) {
  const half = width / 2;
  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  const x0i = Math.max(0, Math.floor(Math.min(x0, x1) - half - 1));
  const x1i = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + half + 1));
  const y0i = Math.max(0, Math.floor(Math.min(y0, y1) - half - 1));
  const y1i = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + half + 1));
  for (let y = y0i; y <= y1i; y++) {
    for (let x = x0i; x <= x1i; x++) {
      const px = x + 0.5, py = y + 0.5;
      let t = len2 > 0 ? ((px - x0) * dx + (py - y0) * dy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = px - (x0 + t * dx), ey = py - (y0 + t * dy);
      const d = Math.sqrt(ex * ex + ey * ey);
      const cov = half + 0.5 - d;
      if (cov > 0) blend(x, y, Math.min(1, cov) * alpha, col);
    }
  }
}

// ---------------------------------------------------------------- font

// Stroke font on a 6 x 10 box (cap top y=0, baseline y=10), advance 8.
// Only the glyphs this card needs.
const GLYPHS = {
  ' ': [],
  'A': [[[0,10],[3,0],[6,10]], [[1,6.7],[5,6.7]]],
  'B': [[[0,0],[0,10]], [[0,0],[4,0],[5.2,1.2],[5.2,3.8],[4,5],[0,5]],
        [[0,5],[4.2,5],[5.4,6.2],[5.4,8.8],[4.2,10],[0,10]]],
  'E': [[[5.2,0],[0,0],[0,10],[5.2,10]], [[0,5],[4,5]]],
  'G': [[[5.4,2.2],[4,0.4],[2,0.4],[0.4,2],[0.4,8],[2,9.6],[4,9.6],[5.4,8],[5.4,6],[3.2,6]]],
  'H': [[[0,0],[0,10]], [[5.4,0],[5.4,10]], [[0,5],[5.4,5]]],
  'I': [[[0.6,0],[4.8,0]], [[2.7,0],[2.7,10]], [[0.6,10],[4.8,10]]],
  'N': [[[0,10],[0,0],[5.4,10],[5.4,0]]],
  'R': [[[0,10],[0,0],[4.2,0],[5.4,1.2],[5.4,3.8],[4.2,5],[0,5]], [[2.4,5],[5.4,10]]],
  'S': [[[5.4,1.6],[4,0.2],[1.4,0.2],[0.2,1.6],[0.2,3.6],[1.4,5],[4.2,5],
         [5.4,6.4],[5.4,8.4],[4.2,9.8],[1.4,9.8],[0.2,8.4]]],
  'T': [[[0,0],[5.6,0]], [[2.8,0],[2.8,10]]],
  '0': [[[1.4,0.4],[4,0.4],[5.2,2],[5.2,8],[4,9.6],[1.4,9.6],[0.2,8],[0.2,2],[1.4,0.4]]],
  '1': [[[1,2],[2.8,0.2],[2.8,10]], [[1,10],[4.8,10]]],
  '2': [[[0.4,2],[1.6,0.4],[3.8,0.4],[5,2],[5,3.4],[0.4,10],[5.2,10]]],
  '{': [[[4,0.2],[3,0.6],[2.4,2],[2.4,4],[1.4,5],[2.4,6],[2.4,8],[3,9.4],[4,9.8]]],
  '}': [[[1.4,0.2],[2.4,0.6],[3,2],[3,4],[4,5],[3,6],[3,8],[2.4,9.4],[1.4,9.8]]],
  '+': [[[0.6,5],[5,5]], [[2.8,2.8],[2.8,7.2]]],
  'd': [[[5,0],[5,10]], [[5,5.6],[3.6,4.4],[1.8,4.4],[0.4,5.8],[0.4,8.6],[1.8,10],[3.6,10],[5,8.8]]],
  'n': [[[0.4,4.4],[0.4,10]], [[0.4,6],[1.6,4.4],[3.4,4.4],[4.6,6],[4.6,10]]]
};

const ADVANCE = 8;

function textWidth(s, size, track) {
  const u = size / 10;
  return s.length * (ADVANCE * u + track) - track;
}

// x, y = left edge and baseline, in px. size = cap height.
function text(s, x, y, size, lw, col, track) {
  const u = size / 10;
  let cx = x;
  for (const ch of s) {
    const g = GLYPHS[ch];
    if (g === undefined) throw new Error('og-card: no glyph for ' + JSON.stringify(ch));
    for (const poly of g) {
      for (let i = 0; i < poly.length - 1; i++) {
        line(cx + poly[i][0] * u, y - size + poly[i][1] * u,
             cx + poly[i+1][0] * u, y - size + poly[i+1][1] * u, lw, col, 1);
      }
    }
    cx += ADVANCE * u + track;
  }
}

// ---------------------------------------------------------------- crystal

function rotP(v, cy, sy, cx, sx) {
  const x1 = v[0]*cy + v[2]*sy, z1 = -v[0]*sy + v[2]*cy;
  return [x1, v[1]*cx - z1*sx, v[1]*sx + z1*cx];
}

const cy = Math.cos(RY), sy = Math.sin(RY), cx = Math.cos(RX), sx = Math.sin(RX);
const segs = [];
for (const [, s] of shapeAt(T, M)) segs.push([rotP(s[0], cy, sy, cx, sx), rotP(s[1], cy, sy, cx, sx)]);

// Auto-fit: project at unit scale, then scale so the form reaches HALF px.
let ext = 0;
for (const [p1, p2] of segs) {
  for (const p of [p1, p2]) {
    const s = 1 / (CAM - p[2]);
    ext = Math.max(ext, Math.abs(p[0]) * s, Math.abs(p[1]) * s);
  }
}
const scale = HALF / ext;

// Back to front, so the near (brighter, thicker) edges paint last.
segs.sort((a, b) => (a[0][2] + a[1][2]) - (b[0][2] + b[1][2]));

for (const [p1, p2] of segs) {
  const dt = Math.max(0, Math.min(1, ((p1[2] + p2[2]) / 2 + 1.8) / 3.6));
  const alpha = 0.2 + 0.75 * dt;                 // viewer depth fade
  const s1 = scale / (CAM - p1[2]), s2 = scale / (CAM - p2[2]);
  line(CENTER[0] + p1[0]*s1, CENTER[1] - p1[1]*s1,
       CENTER[0] + p2[0]*s2, CENTER[1] - p2[1]*s2,
       1.9 + 2.4 * dt, FG, alpha);               // viewer linewidth ramp
}

// ---------------------------------------------------------------- text

const title = 'GARNET HABITS', tsize = 40, ttrack = 7;
text(title, (W - textWidth(title, tsize, ttrack)) / 2, 88, tsize, 4.2, TITLE, ttrack);

const sub = 'd{110} + n{211}', ssize = 22, strack = 5;
text(sub, (W - textWidth(sub, ssize, strack)) / 2, 596, ssize, 2.6, SUB, strack);

// hairline rules either side of the title
const ty = 72, gap = textWidth(title, tsize, ttrack) / 2 + 46;
line(W/2 - gap - 120, ty, W/2 - gap, ty, 1.4, SUB, 0.55);
line(W/2 + gap, ty, W/2 + gap + 120, ty, 1.4, SUB, 0.55);

// ---------------------------------------------------------------- png

function crc32(bytes) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;    // bit depth
ihdr[9] = 2;    // colour type: truecolour RGB
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // deflate / adaptive filtering / no interlace

const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  const o = y * (1 + W * 3);
  raw[o] = 0;   // filter type 0 (None)
  raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), o + 1);
}

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);

const out = process.argv[2] || path.join(__dirname, '..', 'assets', 'og.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log('wrote ' + out + '  ' + W + 'x' + H + '  ' + png.length + ' bytes  (' + segs.length + ' edges)');
