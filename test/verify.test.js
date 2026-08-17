const { shapeAt } = require('../src/engine');

let failures = 0;
const check = (ok, msg) => {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + msg);
  if (!ok) failures++;
};

const STEPS = 40;
const ladder = [];
const t0 = Date.now();
for (let i = 0; i <= STEPS; i++) ladder.push(shapeAt(2 * i / STEPS));
console.log('ladder built: ' + (Date.now() - t0) + 'ms');

const expected = { 0: 24, 10: 96, 20: 48, 30: 144, 40: 72 };
for (const [i, E] of Object.entries(expected))
  check(ladder[i].size === E, 'edge count at step ' + i + ': ' + ladder[i].size + ' (expect ' + E + ')');

const d2 = (p, q) => (p[0]-q[0])**2 + (p[1]-q[1])**2 + (p[2]-q[2])**2;

let worst = 0;
for (let i = 1; i <= STEPS; i++) {
  const A = ladder[i-1], B = ladder[i];
  for (const [k, sa] of A) {
    if (!B.has(k)) continue;
    const sb = B.get(k);
    const disp = Math.sqrt(Math.min(
      Math.max(d2(sa[0], sb[0]), d2(sa[1], sb[1])),
      Math.max(d2(sa[0], sb[1]), d2(sa[1], sb[0]))));
    if (disp > worst) worst = disp;
  }
}
check(worst < 0.15, 'max shared-edge displacement per step: ' + worst.toFixed(4) + ' (want < 0.15)');

let uncovered = 0;
for (let i = 1; i <= STEPS; i++) {
  const A = ladder[i-1], B = ladder[i];
  const faders = [];
  for (const [k, s] of A) if (!B.has(k) && d2(s[0], s[1]) > 0.01) faders.push(s);
  for (const [k, s] of B) if (!A.has(k) && d2(s[0], s[1]) > 0.01) faders.push(s);
  for (const f of faders) {
    const fm = [(f[0][0]+f[1][0])/2, (f[0][1]+f[1][1])/2, (f[0][2]+f[1][2])/2];
    let cov = false;
    for (const M of [A, B]) {
      for (const [, s] of M) {
        if (s === f) continue;
        const ab = [s[1][0]-s[0][0], s[1][1]-s[0][1], s[1][2]-s[0][2]];
        const L2 = ab[0]**2 + ab[1]**2 + ab[2]**2;
        if (L2 < 1e-9) continue;
        let t = ((fm[0]-s[0][0])*ab[0] + (fm[1]-s[0][1])*ab[1] + (fm[2]-s[0][2])*ab[2]) / L2;
        t = Math.max(0, Math.min(1, t));
        if (d2(fm, [s[0][0]+ab[0]*t, s[0][1]+ab[1]*t, s[0][2]+ab[2]*t]) < 0.0025) { cov = true; break; }
      }
      if (cov) break;
    }
    if (!cov) uncovered++;
  }
}
check(uncovered === 0, 'long fading edges all covered by coincident replacements: ' + uncovered + ' uncovered');

console.log(failures === 0 ? '\nALL CHECKS PASS' : '\n' + failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
