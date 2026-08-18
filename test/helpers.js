'use strict';
// Geometry helpers for the garnet verification suite. Zero dependencies, pure
// functions over the engine's Map<"d3|n17", [[x,y,z],[x,y,z]]> wireframes.

const TWO_THIRDS = 2 / 3;
const RESCALE = 1.7; // clipShape normalizes every shape to maxR = 1.7

// V/E/F per region of the (a,b) form square.
const REGION_TABLE = {
  d:   { V: 14,  E: 24,  F: 12 },
  n:   { V: 26,  E: 48,  F: 24 },
  h:   { V: 26,  E: 72,  F: 48 },
  dn:  { V: 62,  E: 96,  F: 36 },
  nh:  { V: 74,  E: 144, F: 72 },
  dh:  { V: 62,  E: 120, F: 60 },
  dnh: { V: 110, E: 192, F: 84 }
};

// Face census: per form letter, {edges per face: number of such faces}.
const FACE_CENSUS = {
  d:   { d: { 4: 12 } },
  n:   { n: { 4: 24 } },
  h:   { h: { 3: 48 } },
  dn:  { d: { 4: 12 }, n: { 6: 24 } },
  nh:  { n: { 6: 24 }, h: { 3: 48 } },
  dh:  { d: { 4: 12 }, h: { 4: 48 } },
  dnh: { d: { 4: 12 }, n: { 6: 24 }, h: { 4: 48 } }
};

// Vertex shells (radius / 1.7) of the three pure forms, as exact radicals.
const SHELLS = {
  d: [1, Math.sqrt(3) / 2],
  n: [1, 2 * Math.SQRT2 / 3, Math.sqrt(3) / 2],
  h: [1, Math.sqrt(3) / 2, 3 * Math.SQRT2 / 5]
};

const formKey = forms =>
  (forms.d ? 'd' : '') + (forms.n ? 'n' : '') + (forms.h ? 'h' : '');

// Canonical string for a faceHist so two histograms compare with ===.
const histKey = h => Object.keys(h).sort().map(L =>
  L + ':' + Object.keys(h[L]).map(Number).sort((x, y) => x - y)
    .map(n => n + 'x' + h[L][n]).join(',')).join(' ');

// ---------------------------------------------------------------- census ---
// V by greedy per-axis vertex merge, F = distinct plane ids in the edge keys,
// faceHist = per-form histogram of edges-per-face.
function census(shape, mergeTol = 1e-6) {
  const verts = [];
  const faceEdges = new Map();
  let minLen = Infinity, maxR = 0;
  for (const [key, e] of shape) {
    const bar = key.indexOf('|');
    const ida = key.slice(0, bar), idb = key.slice(bar + 1);
    faceEdges.set(ida, (faceEdges.get(ida) || 0) + 1);
    faceEdges.set(idb, (faceEdges.get(idb) || 0) + 1);
    const len = Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1], e[1][2] - e[0][2]);
    if (len < minLen) minLen = len;
    for (const p of e) {
      const r = Math.hypot(p[0], p[1], p[2]);
      if (r > maxR) maxR = r;
      let seen = false;
      for (let i = 0; i < verts.length; i++) {
        const v = verts[i];
        if (Math.abs(v[0] - p[0]) < mergeTol && Math.abs(v[1] - p[1]) < mergeTol &&
            Math.abs(v[2] - p[2]) < mergeTol) { seen = true; break; }
      }
      if (!seen) verts.push([p[0], p[1], p[2]]);
    }
  }
  const forms = { d: false, n: false, h: false };
  const faceHist = {};
  for (const [id, c] of faceEdges) {
    const L = id[0];
    forms[L] = true;
    if (!faceHist[L]) faceHist[L] = {};
    faceHist[L][c] = (faceHist[L][c] || 0) + 1;
  }
  const V = verts.length, E = shape.size, F = faceEdges.size;
  return { V, E, F, chi: V - E + F, forms, key: formKey(forms), faceHist,
           minLen: shape.size ? minLen : 0, maxR, verts };
}

// Distinct vertex-shell radii (descending), normalized by the 1.7 rescale.
function shells(cen, tol = 1e-9) {
  const rs = cen.verts.map(v => Math.hypot(v[0], v[1], v[2]) / RESCALE)
    .sort((a, b) => b - a);
  const out = [];
  for (const r of rs) if (!out.length || Math.abs(out[out.length - 1] - r) > tol) out.push(r);
  return out;
}

// ------------------------------------------------------------- hausdorff ---
// Endpoints + midpoints of one wireframe against the nearest segment of the
// other, both directions.
function segArray(M) {
  const s = new Float64Array(M.size * 7);
  let i = 0;
  for (const [, e] of M) {
    const ax = e[0][0], ay = e[0][1], az = e[0][2];
    const dx = e[1][0] - ax, dy = e[1][1] - ay, dz = e[1][2] - az;
    const L2 = dx * dx + dy * dy + dz * dz;
    s[i] = ax; s[i + 1] = ay; s[i + 2] = az;
    s[i + 3] = dx; s[i + 4] = dy; s[i + 5] = dz;
    s[i + 6] = L2 > 0 ? 1 / L2 : 0;
    i += 7;
  }
  return s;
}

function ptArray(M) {
  const p = new Float64Array(M.size * 9);
  let i = 0;
  for (const [, e] of M) {
    p[i] = e[0][0]; p[i + 1] = e[0][1]; p[i + 2] = e[0][2];
    p[i + 3] = e[1][0]; p[i + 4] = e[1][1]; p[i + 5] = e[1][2];
    p[i + 6] = (e[0][0] + e[1][0]) / 2;
    p[i + 7] = (e[0][1] + e[1][1]) / 2;
    p[i + 8] = (e[0][2] + e[1][2]) / 2;
    i += 9;
  }
  return p;
}

// max over points of (min distance to a segment). `running` seeds the max so
// the inner loop can bail as soon as a point can no longer raise it.
function oneWay(pts, segs, running) {
  let worst = running;
  for (let i = 0; i < pts.length; i += 3) {
    const px = pts[i], py = pts[i + 1], pz = pts[i + 2];
    const bail = worst * worst;
    let best = Infinity;
    for (let j = 0; j < segs.length; j += 7) {
      const wx = px - segs[j], wy = py - segs[j + 1], wz = pz - segs[j + 2];
      const dx = segs[j + 3], dy = segs[j + 4], dz = segs[j + 5];
      let t = (wx * dx + wy * dy + wz * dz) * segs[j + 6];
      if (t < 0) t = 0; else if (t > 1) t = 1;
      const ex = wx - dx * t, ey = wy - dy * t, ez = wz - dz * t;
      const d2 = ex * ex + ey * ey + ez * ez;
      if (d2 < best) { best = d2; if (best <= bail) break; }
    }
    const d = Math.sqrt(best);
    if (d > worst) worst = d;
  }
  return worst;
}

function hausdorff(A, B) {
  if (!A.size || !B.size) return Infinity;
  return oneWay(ptArray(B), segArray(A), oneWay(ptArray(A), segArray(B), 0));
}

// -------------------------------------------------------------- symmetry ---
const SIGNED_PERMS = (() => {
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const out = [];
  for (const p of perms)
    for (const s0 of [-1, 1]) for (const s1 of [-1, 1]) for (const s2 of [-1, 1])
      out.push([p, [s0, s1, s2]]);
  return out; // 48 signed permutation matrices = full m-3m point group
})();

const WINDOW = 0.05;
function nearestDist(sorted, qx, qy, qz) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid][0] < qx - WINDOW) lo = mid + 1; else hi = mid; }
  let best = Infinity;
  for (let i = lo; i < sorted.length && sorted[i][0] <= qx + WINDOW; i++) {
    const v = sorted[i];
    const d = (v[0] - qx) ** 2 + (v[1] - qy) ** 2 + (v[2] - qz) ** 2;
    if (d < best) best = d;
  }
  if (!(best < WINDOW * WINDOW)) { // window missed: exhaustive fallback
    best = Infinity;
    for (const v of sorted) {
      const d = (v[0] - qx) ** 2 + (v[1] - qy) ** 2 + (v[2] - qz) ** 2;
      if (d < best) best = d;
    }
  }
  return Math.sqrt(best);
}

// Max distance from any image of a vertex under the 48 signed permutations to
// the nearest actual vertex.
function symmetryDeviation(shape, cen) {
  const V = (cen || census(shape)).verts;
  if (!V.length) return Infinity;
  const sorted = V.slice().sort((a, b) => a[0] - b[0]);
  let worst = 0;
  for (const [p, s] of SIGNED_PERMS)
    for (const v of V) {
      const d = nearestDist(sorted, s[0] * v[p[0]], s[1] * v[p[1]], s[2] * v[p[2]]);
      if (d > worst) worst = d;
    }
  return worst;
}

// ------------------------------------------------------------- convexity ---
function smallestEigenvalue(C) {
  const p1 = C[0][1] ** 2 + C[0][2] ** 2 + C[1][2] ** 2;
  const q = (C[0][0] + C[1][1] + C[2][2]) / 3;
  if (p1 === 0) return Math.min(C[0][0], C[1][1], C[2][2]);
  const p2 = (C[0][0] - q) ** 2 + (C[1][1] - q) ** 2 + (C[2][2] - q) ** 2 + 2 * p1;
  const p = Math.sqrt(p2 / 6);
  const B = [
    [(C[0][0] - q) / p, C[0][1] / p, C[0][2] / p],
    [C[0][1] / p, (C[1][1] - q) / p, C[1][2] / p],
    [C[0][2] / p, C[1][2] / p, (C[2][2] - q) / p]
  ];
  const detB = B[0][0] * (B[1][1] * B[2][2] - B[1][2] * B[2][1])
             - B[0][1] * (B[1][0] * B[2][2] - B[1][2] * B[2][0])
             + B[0][2] * (B[1][0] * B[2][1] - B[1][1] * B[2][0]);
  const phi = Math.acos(Math.max(-1, Math.min(1, detB / 2))) / 3;
  return q + 2 * p * Math.cos(phi + 2 * Math.PI / 3);
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Best-fit plane of a face's own vertices, outward-oriented.
function fitPlane(pts) {
  let cx = 0, cy = 0, cz = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; cz += p[2]; }
  const m = pts.length; cx /= m; cy /= m; cz /= m;
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (const p of pts) {
    const dx = p[0] - cx, dy = p[1] - cy, dz = p[2] - cz;
    xx += dx * dx; xy += dx * dy; xz += dx * dz;
    yy += dy * dy; yz += dy * dz; zz += dz * dz;
  }
  const C = [[xx, xy, xz], [xy, yy, yz], [xz, yz, zz]];
  const lam = smallestEigenvalue(C);
  const A = [[xx - lam, xy, xz], [xy, yy - lam, yz], [xz, yz, zz - lam]];
  let best = null, bn = -1;
  for (const c of [cross(A[0], A[1]), cross(A[1], A[2]), cross(A[0], A[2])]) {
    const l = Math.hypot(c[0], c[1], c[2]);
    if (l > bn) { bn = l; best = c; }
  }
  let n = [best[0] / bn, best[1] / bn, best[2] / bn];
  let k = n[0] * cx + n[1] * cy + n[2] * cz;
  if (k < 0) { n = [-n[0], -n[1], -n[2]]; k = -k; }
  return { n, k };
}

// planarity: worst |distance| of a face's own vertices from its fitted plane.
// outside:   worst signed distance of ANY shape vertex beyond ANY face plane
//            (>0 means the wireframe is not convex).
function convexity(shape, cen) {
  const c = cen || census(shape);
  const faces = new Map();
  for (const [key, e] of shape) {
    const bar = key.indexOf('|');
    for (const id of [key.slice(0, bar), key.slice(bar + 1)]) {
      if (!faces.has(id)) faces.set(id, []);
      faces.get(id).push(e[0], e[1]);
    }
  }
  let planarity = 0, outside = -Infinity;
  for (const [, pts] of faces) {
    const { n, k } = fitPlane(pts);
    for (const p of pts) {
      const d = Math.abs(p[0] * n[0] + p[1] * n[1] + p[2] * n[2] - k);
      if (d > planarity) planarity = d;
    }
    for (const v of c.verts) {
      const d = v[0] * n[0] + v[1] * n[1] + v[2] * n[2] - k;
      if (d > outside) outside = d;
    }
  }
  return { planarity, outside };
}

// ----------------------------------------------------------- region map ----
// n vanishes at b_n(a) = a/(2(1-a)) for a <= 2/3, otherwise at b = 1;
// d vanishes at b_d(a) = 2(1-a)/a for a >= 2/3, otherwise at b = 1.
// (Both derived from kh(a,b) in closed form; the engine's nudges shift the
// real transition by <3e-4 in b, far inside the test grid's clearance.)
const bNVanish = a => (a <= TWO_THIRDS ? a / (2 * (1 - a)) : 1);
const bDVanish = a => (a >= TWO_THIRDS ? 2 * (1 - a) / a : 1);

const CURVE_EPS = 1e-9; // absorbs float noise exactly at the a = 2/3 crossover
function expectedForms(a, b) {
  return { d: b < bDVanish(a) - CURVE_EPS, n: b < bNVanish(a) - CURVE_EPS, h: b > 0 };
}

module.exports = {
  REGION_TABLE, FACE_CENSUS, SHELLS, RESCALE, TWO_THIRDS,
  census, shells, hausdorff, symmetryDeviation, convexity,
  expectedForms, bNVanish, bDVanish, formKey, histKey, SIGNED_PERMS
};
