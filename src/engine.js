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
      ({ p: [c[0]+L*(s[0]*u[0]+s[1]*w[0]), c[1]+L*(s[0]*u[1]+s[1]*w[1]), c[2]+L*(s[0]*u[2]+s[1]*w[2])], src: null }));
    for (let pj = 0; pj < planes.length && poly.length >= 3; pj++) {
      if (pj === fi) continue;
      const q = planes[pj], out = [];
      for (let i = 0; i < poly.length; i++) {
        const P = poly[i], Q = poly[(i+1) % poly.length];
        const dP = q.k - (P.p[0]*q.n[0] + P.p[1]*q.n[1] + P.p[2]*q.n[2]);
        const dQ = q.k - (Q.p[0]*q.n[0] + Q.p[1]*q.n[1] + Q.p[2]*q.n[2]);
        if (dP >= -1e-9) out.push(P);
        if ((dP > 1e-9 && dQ < -1e-9) || (dP < -1e-9 && dQ > 1e-9)) {
          const t = dP / (dP - dQ);
          out.push({ p: [P.p[0]+(Q.p[0]-P.p[0])*t, P.p[1]+(Q.p[1]-P.p[1])*t, P.p[2]+(Q.p[2]-P.p[2])*t], src: q.id });
        }
      }
      poly = out;
    }
    if (poly.length < 3) continue;
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i+1) % poly.length];
      const len2 = (A.p[0]-B.p[0])**2 + (A.p[1]-B.p[1])**2 + (A.p[2]-B.p[2])**2;
      if (len2 < 1e-10) continue;
      const m = [(A.p[0]+B.p[0])/2, (A.p[1]+B.p[1])/2, (A.p[2]+B.p[2])/2];
      let other = null;
      for (let pj = 0; pj < planes.length; pj++) {
        if (pj === fi) continue;
        const q = planes[pj];
        if (Math.abs(m[0]*q.n[0] + m[1]*q.n[1] + m[2]*q.n[2] - q.k) < 1e-7) { other = q.id; break; }
      }
      if (other === null) continue;
      const key = pl.id < other ? pl.id + '|' + other : other + '|' + pl.id;
      if (!edges.has(key)) edges.set(key, [A.p, B.p]);
    }
  }
  let maxR = 0;
  for (const [, s] of edges) for (const p of s) maxR = Math.max(maxR, Math.hypot(p[0], p[1], p[2]));
  const sc = 1.7 / maxR;
  const out = new Map();
  for (const [k, s] of edges) out.set(k, [[s[0][0]*sc, s[0][1]*sc, s[0][2]*sc], [s[1][0]*sc, s[1][1]*sc, s[1][2]*sc]]);
  return out;
}
const KN0 = 2 / Math.sqrt(3) * 1.000001, KN1 = Math.sqrt(3) / 2;
const KH0 = 5 * Math.sqrt(6) / (3 * Math.sqrt(14)) * 1.000001, KH1 = 3 * Math.sqrt(6) / (2 * Math.sqrt(14)) / 1.000001;
function shapeAt(t) {
  if (t <= 1) {
    const kn = KN0 + (KN1 - KN0) * t;
    return clipShape([...makePlanes([1,1,0], 1, 'd'), ...makePlanes([2,1,1], kn, 'n')]);
  }
  const kh = KH0 + (KH1 - KH0) * (t - 1);
  return clipShape([...makePlanes([2,1,1], 1, 'n'), ...makePlanes([3,2,1], kh, 'h')]);
}
// Browser global first: a bare `module` reference throws ReferenceError in a
// classic <script>, which would abort before GarnetEngine is ever assigned.
if (typeof window !== 'undefined') window.GarnetEngine = { shapeAt };
if (typeof module !== 'undefined') module.exports = { shapeAt };
