'use strict';
// Geometry verification suite for the garnet form space. Zero dependencies.
// 13 checks: load smoke, input domain, the 41-step habit ladder, golden
// fixtures from the pre-form-space engine, the 2-parameter (a,b) form square,
// tangency constants, nudge regressions and a perf floor.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE_PATH = path.join(__dirname, '..', 'src', 'engine.js');
const INDEX_PATH = path.join(__dirname, '..', 'index.html');

const engine = require(ENGINE_PATH);
const {
  shapeAt, formAt, pathAB, formsPresent, makePlanes, clipShape,
  KN0, KN1, KH0, KH1, KH_DVAN, NUDGE
} = engine;
const {
  REGION_TABLE, FACE_CENSUS, SHELLS, TWO_THIRDS,
  census, shells, hausdorff, symmetryDeviation, convexity,
  expectedForms, bNVanish, bDVanish, formKey, histKey
} = require('./helpers');

let failures = 0;
const check = (ok, msg) => {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + msg);
  if (!ok) failures++;
};
const section = title => console.log('\n=== ' + title + ' ===');
const T0 = Date.now();

const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

// Worst displacement of edges shared (by plane-pair key) between two shapes.
// NaN-guarded: a non-finite displacement is counted, never silently ignored.
function sharedDisplacement(A, B) {
  let worst = 0, bad = 0, shared = 0;
  for (const [k, sa] of A) {
    if (!B.has(k)) continue;
    shared++;
    const sb = B.get(k);
    const disp = Math.sqrt(Math.min(
      Math.max(d2(sa[0], sb[0]), d2(sa[1], sb[1])),
      Math.max(d2(sa[0], sb[1]), d2(sa[1], sb[0]))));
    if (!Number.isFinite(disp)) { bad++; continue; }
    if (!(disp <= worst)) worst = disp;
  }
  return { worst, bad, shared };
}

const summarize = s => {
  let sumAbs = 0, sumLen = 0;
  for (const [, e] of s) {
    for (const p of e) sumAbs += Math.abs(p[0]) + Math.abs(p[1]) + Math.abs(p[2]);
    sumLen += Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1], e[1][2] - e[0][2]);
  }
  return { E: s.size, sumAbs, sumLen };
};

const maxCoordDiff = (A, B) => {
  if (A.size !== B.size) return Infinity;
  let worst = 0;
  for (const [k, sa] of A) {
    if (!B.has(k)) return Infinity;
    const sb = B.get(k);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
      const d = Math.abs(sa[i][j] - sb[i][j]);
      if (!(d <= worst)) worst = d;
    }
  }
  return worst;
};

const throwsRange = fn => {
  try { fn(); return false; } catch (e) { return e instanceof RangeError; }
};
const noThrow = fn => { try { fn(); return true; } catch (e) { return false; } };

// ---------------------------------------------------------------------------
// 1. Load smoke
// ---------------------------------------------------------------------------
section('1. load smoke');
const CONTRACT = ['formAt', 'shapeAt', 'pathAB', 'formsPresent', 'makePlanes',
  'clipShape', 'KN0', 'KN1', 'KH0', 'KH1', 'KH_DVAN', 'NUDGE'];

const engineSrc = fs.readFileSync(ENGINE_PATH, 'utf8');
let sandbox = null, vmErr = null;
try {
  sandbox = vm.createContext({ window: {} }); // no `module` in scope
  vm.runInContext(engineSrc, sandbox, { filename: 'src/engine.js' });
} catch (e) { vmErr = e; }
check(!vmErr, 'engine evaluates in a browser-like vm (window only, no module)'
  + (vmErr ? ': ' + vmErr.constructor.name + ' ' + vmErr.message : ''));

const G = sandbox && sandbox.window.GarnetEngine;
check(!!G, 'window.GarnetEngine assigned by the browser path');
const missingVm = G ? CONTRACT.filter(n => G[n] === undefined) : CONTRACT.slice();
check(missingVm.length === 0,
  'window.GarnetEngine exports the full contract' + (missingVm.length ? ', missing: ' + missingVm.join(', ') : ''));
const missingReq = CONTRACT.filter(n => engine[n] === undefined);
check(missingReq.length === 0,
  'module.exports exports the full contract' + (missingReq.length ? ', missing: ' + missingReq.join(', ') : ''));

const html = fs.readFileSync(INDEX_PATH, 'utf8');
const usedNames = new Set();
let m;
const reDestructure = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*window\.GarnetEngine\b/g;
while ((m = reDestructure.exec(html)) !== null)
  for (const part of m[1].split(',')) {
    const name = part.split(':').pop().trim();
    if (name) usedNames.add(name);
  }
const reMember = /window\.GarnetEngine\.([A-Za-z_$][\w$]*)/g;
while ((m = reMember.exec(html)) !== null) usedNames.add(m[1]);
check(usedNames.size > 0, 'index.html pulls names off window.GarnetEngine: {' + [...usedNames].join(', ') + '}');
const undeclared = [...usedNames].filter(n => !G || G[n] === undefined);
check(undeclared.length === 0,
  'every name index.html destructures is exported' + (undeclared.length ? ', missing: ' + undeclared.join(', ') : ''));

// ---------------------------------------------------------------------------
// 2. Input domain -> RangeError
// ---------------------------------------------------------------------------
section('2. input domain');
const badShapeAt = [
  ['NaN', () => shapeAt(NaN)],
  ['undefined', () => shapeAt(undefined)],
  ['Infinity', () => shapeAt(Infinity)],
  ['-1e-9', () => shapeAt(-1e-9)],
  ['2.000001', () => shapeAt(2.000001)],
  ['(1, 1.5)', () => shapeAt(1, 1.5)],
  ['(1, -1e-9)', () => shapeAt(1, -1e-9)],
  ['(1, NaN)', () => shapeAt(1, NaN)]
];
for (const [label, fn] of badShapeAt) check(throwsRange(fn), 'shapeAt(' + label + ') throws RangeError');
const badFormAt = [
  ['-1e-9, 0', () => formAt(-1e-9, 0)],
  ['0, 1.001', () => formAt(0, 1.001)],
  ['NaN, 0', () => formAt(NaN, 0)],
  ['0, undefined', () => formAt(0, undefined)],
  ['Infinity, 0', () => formAt(Infinity, 0)]
];
for (const [label, fn] of badFormAt) check(throwsRange(fn), 'formAt(' + label + ') throws RangeError');
check(noThrow(() => shapeAt(0)) && noThrow(() => shapeAt(1)) && noThrow(() => shapeAt(2)),
  'shapeAt boundaries t = 0, 1, 2 accepted');
check(noThrow(() => shapeAt(0, 0)) && noThrow(() => shapeAt(2, 1)),
  'shapeAt boundaries m = 0, 1 accepted');
check(noThrow(() => formAt(0, 0)) && noThrow(() => formAt(1, 1)) && noThrow(() => formAt(0, 1)) && noThrow(() => formAt(1, 0)),
  'formAt corners (0,0) (1,1) (0,1) (1,0) accepted');

// ---------------------------------------------------------------------------
// 3-7. The 41-step habit ladder
// ---------------------------------------------------------------------------
const STEPS = 40;
const ladder = [];
const tLadder = Date.now();
for (let i = 0; i <= STEPS; i++) ladder.push(shapeAt(2 * i / STEPS));
const ladderMs = Date.now() - tLadder;
const ladderCensus = ladder.map(s => census(s));

section('3. ladder counts + Euler');
const LADDER_VEF = {
  0:  { V: 14, E: 24,  F: 12 },
  10: { V: 62, E: 96,  F: 36 },
  20: { V: 26, E: 48,  F: 24 },
  30: { V: 74, E: 144, F: 72 },
  40: { V: 26, E: 72,  F: 48 }
};
for (const [i, want] of Object.entries(LADDER_VEF)) {
  const c = ladderCensus[i];
  check(c.V === want.V && c.E === want.E && c.F === want.F,
    'step ' + i + ' V/E/F: ' + c.V + '/' + c.E + '/' + c.F + ' (expect ' + want.V + '/' + want.E + '/' + want.F + ')');
}
const badChi = ladderCensus.map((c, i) => [i, c.chi]).filter(([, chi]) => chi !== 2);
check(badChi.length === 0,
  'Euler chi = 2 at all 41 ladder steps' + (badChi.length ? '; offenders ' + JSON.stringify(badChi) : ''));

section('4. ladder continuity');
let worstLadder = 0, ladderBad = 0;
for (let i = 1; i <= STEPS; i++) {
  const r = sharedDisplacement(ladder[i - 1], ladder[i]);
  ladderBad += r.bad;
  if (!(r.worst <= worstLadder)) worstLadder = r.worst;
}
check(ladderBad === 0, 'no non-finite shared-edge displacements on the ladder (' + ladderBad + ')');
check(worstLadder < 0.15, 'max shared-edge displacement per ladder step: ' + worstLadder.toFixed(4) + ' (want < 0.15)');

section('5. fader coincidence');
let uncovered = 0;
for (let i = 1; i <= STEPS; i++) {
  const A = ladder[i - 1], B = ladder[i];
  const faders = [];
  for (const [k, s] of A) if (!B.has(k) && d2(s[0], s[1]) > 0.01) faders.push(s);
  for (const [k, s] of B) if (!A.has(k) && d2(s[0], s[1]) > 0.01) faders.push(s);
  for (const f of faders) {
    const fm = [(f[0][0] + f[1][0]) / 2, (f[0][1] + f[1][1]) / 2, (f[0][2] + f[1][2]) / 2];
    let cov = false;
    for (const M of [A, B]) {
      for (const [, s] of M) {
        if (s === f) continue;
        const ab = [s[1][0] - s[0][0], s[1][1] - s[0][1], s[1][2] - s[0][2]];
        const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
        if (L2 < 1e-9) continue;
        let t = ((fm[0] - s[0][0]) * ab[0] + (fm[1] - s[0][1]) * ab[1] + (fm[2] - s[0][2]) * ab[2]) / L2;
        t = Math.max(0, Math.min(1, t));
        if (d2(fm, [s[0][0] + ab[0] * t, s[0][1] + ab[1] * t, s[0][2] + ab[2] * t]) < 0.0025) { cov = true; break; }
      }
      if (cov) break;
    }
    if (!cov) uncovered++;
  }
}
check(uncovered === 0, 'long fading edges all covered by coincident replacements: ' + uncovered + ' uncovered');

// ---------------------------------------------------------------------------
// 6. Golden fixtures, captured from the pre-form-space engine (commit d87bfa0,
//    `git show HEAD:src/engine.js`) before WP1 touched it. E must match
//    exactly; the coordinate sums to 1e-8.
// ---------------------------------------------------------------------------
section('6. golden path summaries');
const GOLDEN = {
  0:  { E: 24,  sumAbs: 102.00000000000003, sumLen: 35.333836474405111 },
  5:  { E: 96,  sumAbs: 412.07994777604222, sumLen: 67.126898295190415 },
  10: { E: 96,  sumAbs: 416.74281717553316, sumLen: 63.080236257061287 },
  15: { E: 96,  sumAbs: 422.12305374675265, sumLen: 58.411008529755591 },
  20: { E: 48,  sumAbs: 210.80000000000015, sumLen: 52.963573068413901 },
  25: { E: 144, sumAbs: 636.48019992008540, sumLen: 70.044639401540550 },
  30: { E: 144, sumAbs: 626.96001904017203, sumLen: 87.126388991669245 },
  35: { E: 144, sumAbs: 617.43983816025752, sumLen: 104.20813858179729 },
  40: { E: 72,  sumAbs: 301.91999999999922, sumLen: 85.955436766834026 }
};
let worstGolden = 0;
for (const [i, want] of Object.entries(GOLDEN)) {
  const got = summarize(ladder[i]);
  const dAbs = Math.abs(got.sumAbs - want.sumAbs), dLen = Math.abs(got.sumLen - want.sumLen);
  if (!(dAbs <= worstGolden)) worstGolden = dAbs;
  if (!(dLen <= worstGolden)) worstGolden = dLen;
  check(got.E === want.E && dAbs < 1e-8 && dLen < 1e-8,
    'golden step ' + i + ': E ' + got.E + ', d(sum|xyz|) ' + dAbs.toExponential(2) + ', d(sum len) ' + dLen.toExponential(2));
}
console.log('      worst golden deviation: ' + worstGolden.toExponential(3));

section('7. path identities');
let worstFormAt0 = 0;
for (let i = 0; i <= STEPS; i++) {
  const a = i / STEPS;
  const d = maxCoordDiff(formAt(a, 0), shapeAt(a));
  if (!(d <= worstFormAt0)) worstFormAt0 = d;
}
check(worstFormAt0 <= 1e-15, 'formAt(a,0) == shapeAt(a) at 41 a values: worst coord diff ' + worstFormAt0.toExponential(2));

let worstZone2 = 0;
for (let i = 0; i <= STEPS; i++) {
  const b = i / STEPS;
  const d = maxCoordDiff(formAt(1, b), shapeAt(1 + b));
  if (!(d <= worstZone2)) worstZone2 = d;
}
check(worstZone2 <= 1e-12, 'formAt(1,b) == shapeAt(1+b) at 41 b values: worst coord diff ' + worstZone2.toExponential(2));

let pathOk = true, pathWorst = 0;
for (let i = 0; i <= 20; i++) for (let j = 0; j <= 10; j++) {
  const t = 2 * i / 20, mm = j / 10;
  const want = t <= 1 ? [t, mm] : [1, (t - 1) + mm * (2 - t)];
  const got = pathAB(t, mm);
  if (!Array.isArray(got) || got.length !== 2) { pathOk = false; continue; }
  pathWorst = Math.max(pathWorst, Math.abs(got[0] - want[0]), Math.abs(got[1] - want[1]));
}
check(pathOk && pathWorst <= 1e-15, 'pathAB matches the blend mapping over a 21x11 grid: worst ' + pathWorst.toExponential(2));

let worstSeam = 0;
for (const mm of [0, 0.3, 0.7, 1]) {
  const h = hausdorff(shapeAt(1 - 1e-6, mm), shapeAt(1 + 1e-6, mm));
  if (!(h <= worstSeam)) worstSeam = h;
  check(h < 1e-4, 't=1 seam Hausdorff at m=' + mm + ': ' + h.toExponential(3) + ' (want < 1e-4)');
}

// ---------------------------------------------------------------------------
// 8. Invariants over the 144-point offset grid of the (a,b) square.
//    G avoids rational hits on the b_n / b_d transition curves.
// ---------------------------------------------------------------------------
section('8. form-square invariants (144-point offset grid)');
const Gaxis = [0];
for (let i = 0; i < 10; i++) Gaxis.push((2 * i + 1) / 20);
Gaxis.push(1);

let chiBad = [], formBad = [], vefBad = [], histBad = [], maxRBad = [];
let worstSym = 0, worstPlanar = 0, worstOutside = -Infinity, minLenGrid = Infinity, minLenAt = null;
let minCurveDist = Infinity, minCurveAt = null;
const tGrid = Date.now();
for (const a of Gaxis) for (const b of Gaxis) {
  const s = formAt(a, b);
  const c = census(s);
  const want = expectedForms(a, b);
  const wantKey = formKey(want);
  const fp = formsPresent(s);
  if (c.chi !== 2) chiBad.push([a, b, c.chi]);
  if (c.key !== wantKey || formKey(fp) !== wantKey) formBad.push([a, b, c.key, formKey(fp), wantKey]);
  const ref = REGION_TABLE[wantKey];
  if (!ref || c.V !== ref.V || c.E !== ref.E || c.F !== ref.F)
    vefBad.push([a, b, wantKey, c.V + '/' + c.E + '/' + c.F]);
  const wantHist = FACE_CENSUS[wantKey];
  if (!wantHist || histKey(c.faceHist) !== histKey(wantHist))
    histBad.push([a, b, wantKey, histKey(c.faceHist)]);
  if (Math.abs(c.maxR - 1.7) > 1e-12) maxRBad.push([a, b, c.maxR]);
  const sym = symmetryDeviation(s, c);
  if (!(sym <= worstSym)) worstSym = sym;
  const cv = convexity(s, c);
  if (!(cv.planarity <= worstPlanar)) worstPlanar = cv.planarity;
  if (!(cv.outside <= worstOutside)) worstOutside = cv.outside;
  if (c.minLen < minLenGrid) { minLenGrid = c.minLen; minLenAt = [a, b]; }
  // Clearance from the two interior transition curves. The b = 1 edge (where
  // bNVanish/bDVanish return their sentinel 1) is a nudged boundary, not a
  // curve to avoid — check 12 pins it instead.
  if (a > 0 && a < 1) {
    const curves = [];
    if (a < TWO_THIRDS) curves.push(bNVanish(a));
    if (a > TWO_THIRDS) curves.push(bDVanish(a));
    for (const bc of curves) {
      const d = Math.abs(b - bc);
      if (d < minCurveDist) { minCurveDist = d; minCurveAt = [a, b, bc]; }
    }
  }
}
const gridMs = Date.now() - tGrid;
check(chiBad.length === 0, 'Euler chi = 2 at all 144 grid points' + (chiBad.length ? ': ' + JSON.stringify(chiBad.slice(0, 5)) : ''));
check(formBad.length === 0, 'formsPresent == census forms == expectedForms(a,b) at all 144 points'
  + (formBad.length ? ': ' + JSON.stringify(formBad.slice(0, 5)) : ''));
check(vefBad.length === 0, 'V/E/F matches REGION_TABLE at all 144 points'
  + (vefBad.length ? ': ' + JSON.stringify(vefBad.slice(0, 5)) : ''));
check(histBad.length === 0, 'face census (edges per face, per form) matches at all 144 points'
  + (histBad.length ? ': ' + JSON.stringify(histBad.slice(0, 3)) : ''));
check(maxRBad.length === 0, 'maxR == 1.7 +/- 1e-12 at all 144 points' + (maxRBad.length ? ': ' + JSON.stringify(maxRBad.slice(0, 3)) : ''));
check(worstSym < 1e-9, 'worst deviation under the 48 signed permutations: ' + worstSym.toExponential(3) + ' (want < 1e-9)');
check(worstPlanar < 1e-9, 'worst face planarity residual: ' + worstPlanar.toExponential(3) + ' (want < 1e-9)');
check(worstOutside < 1e-9, 'worst vertex excursion outside a face plane: ' + worstOutside.toExponential(3) + ' (want < 1e-9)');
check(minLenGrid > 1e-4, 'min edge length over the grid: ' + minLenGrid.toExponential(3) + ' at (a,b)=' + JSON.stringify(minLenAt) + ' (want > 1e-4)');
check(minCurveDist >= 1e-3, 'min |b - transition curve| over interior grid points: ' + minCurveDist.toFixed(6)
  + ' at (a,b,curve)=' + JSON.stringify(minCurveAt && minCurveAt.map(x => +x.toFixed(6))) + ' (want >= 1e-3)');
console.log('      144 grid points in ' + gridMs + 'ms');

// ---------------------------------------------------------------------------
// 9. 2D continuity on a 21x11 uniform grid
// ---------------------------------------------------------------------------
section('9. 2D continuity (21x11 uniform grid)');
const NA = 20, NB = 10;
const grid = [];
const tCont = Date.now();
for (let i = 0; i <= NA; i++) {
  const row = [];
  for (let j = 0; j <= NB; j++) row.push(formAt(i / NA, j / NB));
  grid.push(row);
}
let worstH = 0, worstHAt = null, worstDisp = 0, worstDispAt = null, contBad = 0;
const pairUp = (A, B, at) => {
  const h = hausdorff(A, B);
  if (!(h <= worstH)) { worstH = h; worstHAt = at; }
  const r = sharedDisplacement(A, B);
  contBad += r.bad;
  if (!(r.worst <= worstDisp)) { worstDisp = r.worst; worstDispAt = at; }
};
for (let i = 0; i <= NA; i++) for (let j = 0; j <= NB; j++) {
  if (i < NA) pairUp(grid[i][j], grid[i + 1][j], ['a', i / NA, (i + 1) / NA, j / NB]);
  if (j < NB) pairUp(grid[i][j], grid[i][j + 1], ['b', i / NA, j / NB, (j + 1) / NB]);
}
const contMs = Date.now() - tCont;
check(contBad === 0, 'no non-finite shared-edge displacements on the 2D grid (' + contBad + ')');
check(worstH < 0.15, 'worst neighbour Hausdorff: ' + worstH.toFixed(4) + ' at ' + JSON.stringify(worstHAt) + ' (want < 0.15)');
check(worstDisp < 0.25, 'worst neighbour shared-edge displacement: ' + worstDisp.toFixed(4) + ' at ' + JSON.stringify(worstDispAt) + ' (want < 0.25)');
console.log('      231 shapes + 430 neighbour pairs in ' + contMs + 'ms');

// ---------------------------------------------------------------------------
// 10. Pure-form pinning: single form and exact vertex shells
// ---------------------------------------------------------------------------
section('10. pure-form pinning');
for (const [a, b, want] of [[0, 0, 'd'], [1, 0, 'n'], [1, 1, 'h'], [0, 1, 'h'], [2 / 3, 1, 'h']]) {
  const c = census(formAt(a, b));
  const got = shells(c);
  const ref = SHELLS[want].slice().sort((x, y) => y - x);
  let worst = Infinity;
  if (got.length === ref.length) {
    worst = 0;
    for (let i = 0; i < ref.length; i++) worst = Math.max(worst, Math.abs(got[i] - ref[i]));
  }
  check(c.key === want && Number.isFinite(worst) && worst < 1e-9,
    '(' + (+a.toFixed(4)) + ',' + b + ') pure ' + want + ': forms=' + c.key
    + ', shells=[' + got.map(r => r.toFixed(9)).join(', ') + '], worst radical diff '
    + (Number.isFinite(worst) ? worst.toExponential(2) : 'shell count ' + got.length + ' != ' + ref.length));
}

// ---------------------------------------------------------------------------
// 11. Tangency-constant pinning at k*(1 +/- 1e-4).
//     Radicals recomputed here, independent of the engine's constants.
//     Larger k = plane further out = that form less present.
// ---------------------------------------------------------------------------
section('11. tangency constants');
const S3 = Math.sqrt(3), S6 = Math.sqrt(6), S7 = Math.sqrt(7), S14 = Math.sqrt(14);
const R_NUDGE = 1.000001;
const R_KN0 = 2 / S3;                    // n tangent to d (n nucleates)
const R_KN1 = S3 / 2;                    // d vanishes into n
const R_KH0 = 5 * S6 / (3 * S14);        // h tangent to n (h nucleates)
const R_KH1 = 3 * S6 / (2 * S14);        // n vanishes into h
const R_KHD = 5 / (2 * S7);              // d vanishes into h (point tangency)
const R_KNX = 5 / (3 * S3);              // crossover kn: d and n vanish together
const khTan = kn => (1 + S3 * kn) / S7;  // h tangent to the d+n solid
const kn05 = R_KN0 * R_NUDGE + (R_KN1 - R_KN0 * R_NUDGE) * 0.5; // engine's kn(a=0.5)

check(Math.abs(KN0 - R_KN0 * R_NUDGE) < 1e-15 && Math.abs(KN1 - R_KN1) < 1e-15
  && Math.abs(KH0 - R_KH0 * R_NUDGE) < 1e-15 && Math.abs(KH1 - R_KH1 / R_NUDGE) < 1e-15
  && Math.abs(KH_DVAN - R_KHD) < 1e-15 && NUDGE === R_NUDGE,
  'exported constants equal the independently computed radicals (KN0/KN1/KH0/KH1/KH_DVAN/NUDGE)');

const dP = k => makePlanes([1, 1, 0], k, 'd');
const nP = k => makePlanes([2, 1, 1], k, 'n');
const hP = k => makePlanes([3, 2, 1], k, 'h');
const TANGENCY = [
  ['KN0 = 2/sqrt(3)      d@1 + n@k', R_KN0, k => [...dP(1), ...nP(k)], [24, 'd'], [96, 'dn']],
  ['KN1 = sqrt(3)/2      d@1 + n@k', R_KN1, k => [...dP(1), ...nP(k)], [96, 'dn'], [48, 'n']],
  ['KH0 = 5sqrt(6)/3sqrt(14) n@1 + h@k', R_KH0, k => [...nP(1), ...hP(k)], [48, 'n'], [144, 'nh']],
  ['KH1 = 3sqrt(6)/2sqrt(14) n@1 + h@k', R_KH1, k => [...nP(1), ...hP(k)], [144, 'nh'], [72, 'h']],
  ['KH_DVAN = 5/(2sqrt7) d@1 + h@k', R_KHD, k => [...dP(1), ...hP(k)], [120, 'dh'], [72, 'h']],
  ['khTan(kn(0.5))       d@1 + n@kn + h@k', khTan(kn05), k => [...dP(1), ...nP(kn05), ...hP(k)], [96, 'dn'], [192, 'dnh']],
  ['crossover kn=5/(3sqrt3), kh=KH_DVAN', R_KHD, k => [...dP(1), ...nP(R_KNX), ...hP(k)], [192, 'dnh'], [72, 'h']],
  ['kh = KH1u*kn(0.5)    d@1 + n@kn + h@k', R_KH1 * kn05, k => [...dP(1), ...nP(kn05), ...hP(k)], [192, 'dnh'], [120, 'dh']]
];
for (const [label, k, build, outside, inside] of TANGENCY) {
  for (const [sign, want] of [[+1, outside], [-1, inside]]) {
    const s = clipShape(build(k * (1 + sign * 1e-4)));
    const c = census(s);
    check(c.E === want[0] && c.key === want[1],
      label + ' at k*(1' + (sign > 0 ? '+' : '-') + '1e-4): E=' + c.E + ' ' + c.key
      + ' (expect ' + want[0] + ' ' + want[1] + ')');
  }
}

// ---------------------------------------------------------------------------
// 12. Nudge / tolerance regressions
// ---------------------------------------------------------------------------
section('12. nudge regressions');
for (const a of [0.7, 0.8, 0.9, 1, 2 / 3]) {
  const c = census(formAt(a, 1));
  check(c.E === 72 && c.key === 'h', 'b=1 at a=' + (+a.toFixed(6)) + ': E=' + c.E + ' ' + c.key + ' (expect 72 h)');
}
for (const a of [0.25, 0.5, 0.75]) {
  const c = census(formAt(a, 0));
  check(c.E === 96 && c.key === 'dn', 'b=0 at a=' + a + ': E=' + c.E + ' ' + c.key + ' (expect 96 dn)');
}

// ---------------------------------------------------------------------------
// 13. Perf sanity
// ---------------------------------------------------------------------------
section('13. perf sanity');
for (let i = 0; i < 10; i++) formAt(0.5, 0.2); // warm
const REPS = 20;
const tPerf = process.hrtime.bigint();
for (let i = 0; i < REPS; i++) formAt(0.5, 0.2);
const perMs = Number(process.hrtime.bigint() - tPerf) / 1e6 / REPS;
check(perMs < 50, 'warm formAt (d+n+h, 84 planes): ' + perMs.toFixed(3) + ' ms/call (want < 50)');
console.log('      41-step ladder built in ' + ladderMs + 'ms');

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASS' : failures + ' FAILURES')
  + '  (' + ((Date.now() - T0) / 1000).toFixed(1) + 's)');
process.exit(failures === 0 ? 0 : 1);
