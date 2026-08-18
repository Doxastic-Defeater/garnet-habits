function permsSigns(v) {
  const out = [], seen = new Set();
  const perms = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  for (const p of perms)
    for (const s0 of [-1,1]) for (const s1 of [-1,1]) for (const s2 of [-1,1]) {
      const w = [s0*v[p[0]], s1*v[p[1]], s2*v[p[2]]];
      const key = w.join(',');
      if (!seen.has(key)) { seen.add(key); out.push(w); }
    }
  return out;
}
function makePlanes(dir, k, tag) {
  return permsSigns(dir).map((n, i) => {
    const l = Math.hypot(n[0], n[1], n[2]);
    return { n: [n[0]/l, n[1]/l, n[2]/l], k, id: tag + i };
  });
}
function clipShape(planes) {
  const edges = new Map();
  for (let fi = 0; fi < planes.length; fi++) {
    const pl = planes[fi], nn = pl.n;
    const c = [nn[0]*pl.k, nn[1]*pl.k, nn[2]*pl.k];
    let ref = Math.abs(nn[0]) < 0.9 ? [1,0,0] : [0,1,0];
    let u = [nn[1]*ref[2]-nn[2]*ref[1], nn[2]*ref[0]-nn[0]*ref[2], nn[0]*ref[1]-nn[1]*ref[0]];
    const ul = Math.hypot(u[0],u[1],u[2]); u = [u[0]/ul, u[1]/ul, u[2]/ul];
    const w = [nn[1]*u[2]-nn[2]*u[1], nn[2]*u[0]-nn[0]*u[2], nn[0]*u[1]-nn[1]*u[0]];
    const L = 10;
    let poly = [[1,1],[-1,1],[-1,-1],[1,-1]].map(s =>
      [c[0]+L*(s[0]*u[0]+s[1]*w[0]), c[1]+L*(s[0]*u[1]+s[1]*w[1]), c[2]+L*(s[0]*u[2]+s[1]*w[2])]);
    for (let pj = 0; pj < planes.length && poly.length >= 3; pj++) {
      if (pj === fi) continue;
      const q = planes[pj], out = [];
      for (let i = 0; i < poly.length; i++) {
        const P = poly[i], Q = poly[(i+1) % poly.length];
        const dP = q.k - (P[0]*q.n[0] + P[1]*q.n[1] + P[2]*q.n[2]);
        const dQ = q.k - (Q[0]*q.n[0] + Q[1]*q.n[1] + Q[2]*q.n[2]);
        if (dP >= -1e-9) out.push(P);
        if ((dP > 1e-9 && dQ < -1e-9) || (dP < -1e-9 && dQ > 1e-9)) {
          const t = dP / (dP - dQ);
          out.push([P[0]+(Q[0]-P[0])*t, P[1]+(Q[1]-P[1])*t, P[2]+(Q[2]-P[2])*t]);
        }
      }
      poly = out;
    }
    if (poly.length < 3) continue;
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i+1) % poly.length];
      const len2 = (A[0]-B[0])**2 + (A[1]-B[1])**2 + (A[2]-B[2])**2;
      if (len2 < 1e-10) continue;
      const m = [(A[0]+B[0])/2, (A[1]+B[1])/2, (A[2]+B[2])/2];
      let other = null;
      for (let pj = 0; pj < planes.length; pj++) {
        if (pj === fi) continue;
        const q = planes[pj];
        if (Math.abs(m[0]*q.n[0] + m[1]*q.n[1] + m[2]*q.n[2] - q.k) < 1e-10) { other = q.id; break; }
      }
      if (other === null) continue;
      const key = pl.id < other ? pl.id + '|' + other : other + '|' + pl.id;
      if (!edges.has(key)) edges.set(key, [A, B]);
    }
  }
  let maxR = 0;
  for (const [, s] of edges) for (const p of s) maxR = Math.max(maxR, Math.hypot(p[0], p[1], p[2]));
  const sc = 1.7 / maxR;
  const out = new Map();
  for (const [k, s] of edges) out.set(k, [[s[0][0]*sc, s[0][1]*sc, s[0][2]*sc], [s[1][0]*sc, s[1][1]*sc, s[1][2]*sc]]);
  return out;
}
const NUDGE = 1.000001;
const KN0 = 2 / Math.sqrt(3) * NUDGE, KN1 = Math.sqrt(3) / 2;
const KH0 = 5 * Math.sqrt(6) / (3 * Math.sqrt(14)) * NUDGE, KH1 = 3 * Math.sqrt(6) / (2 * Math.sqrt(14)) / NUDGE;
// kh at which d vanishes into the hexoctahedron (point tangency), and the
// unnudged {321} "d/n gone" endpoint that KH1 is derived from.
const KH_DVAN = 5 / (2 * Math.sqrt(7)), KH1u = 3 * Math.sqrt(6) / (2 * Math.sqrt(14));
const unit = x => Number.isFinite(x) && x >= 0 && x <= 1;
// (a,b) square: a sweeps n{211} inward (d shrinks), b sweeps h{321} inward from
// tangency to the d+n solid down to where the last of d/n vanishes.
function formAt(a, b) {
  if (!unit(a) || !unit(b))
    throw new RangeError('formAt(a, b): a and b must be finite numbers in [0,1] (got a=' + a + ', b=' + b + ')');
  const kn = KN0 + (KN1 - KN0) * a;
  const khTan = (1 + Math.sqrt(3) * kn) / Math.sqrt(7) * NUDGE;   // h tangent along the d-n edge
  const khPure = Math.min(KH_DVAN, kn * KH1u) / NUDGE;            // last of d/n vanishes
  const kh = khTan + (khPure - khTan) * b;
  return clipShape([...makePlanes([1,1,0], 1, 'd'), ...makePlanes([2,1,1], kn, 'n'), ...makePlanes([3,2,1], kh, 'h')]);
}
// Habit slider t in [0,2] plus bevel m in [0,1] -> (a,b). Continuous at t=1;
// m=0 reproduces the original two-branch path; t=2 is pure h for every m.
function pathAB(t, m) {
  return t <= 1 ? [t, m] : [1, (t - 1) + m * (2 - t)];
}
function shapeAt(t, m = 0) {
  if (!Number.isFinite(t) || t < 0 || t > 2 || !unit(m))
    throw new RangeError('shapeAt(t, m): t must be finite in [0,2] and m finite in [0,1] (got t=' + t + ', m=' + m + ')');
  return formAt(...pathAB(t, m));
}
function formsPresent(map) {
  const f = { d: false, n: false, h: false };
  for (const key of map.keys()) for (const id of key.split('|')) if (id[0] in f) f[id[0]] = true;
  return f;
}
// Browser global first: a bare `module` reference throws ReferenceError in a
// classic <script>, which would abort before GarnetEngine is ever assigned.
const API = { formAt, shapeAt, pathAB, formsPresent, makePlanes, clipShape, KN0, KN1, KH0, KH1, KH_DVAN, NUDGE };
if (typeof window !== 'undefined') window.GarnetEngine = API;
if (typeof module !== 'undefined') module.exports = API;
