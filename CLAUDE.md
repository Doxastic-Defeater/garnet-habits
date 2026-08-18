# Garnet habits — continuous crystallographic form space

Interactive wireframe visualization of garnet crystal habits. Two sliders sweep a
continuous 2-parameter space of the real isometric garnet forms: d{110} rhombic
dodecahedron, n{211} trapezohedron, and {321} hexoctahedron, in every combination
they can occur in. Every slider position is a true crystal form computed from its
Miller indices, not an artistic interpolation.

## Commands

- `npm test` — geometry verification suite (13 checks; must pass before any engine change ships)
- `npm start` — serve at http://localhost:8080 (or just open index.html)
- On Windows shells where `node` is not on PATH, node lives at `C:\Program Files\nodejs`
  (`& "C:\Program Files\nodejs\node.exe" test\verify.test.js`, or prepend it to `$env:Path`).

## Architecture

- `src/engine.js` — pure geometry, no DOM. Forms are built by Sutherland-Hodgman
  clipping of each face plane against all other half-spaces. Edge keys are
  plane-pair identities ("d3|n17"), which is what makes edge tracking possible.

  `formAt(a, b)` is the primitive: a form over the full unit square, 84 planes.
  - d = (1,1,0)/√2 at `kd = 1`, always present in the plane set.
  - n = (2,1,1)/√6 at `kn(a) = KN0 + (KN1 - KN0)*a` — a is n-depth, KN0 → KN1.
  - h = (3,2,1)/√14 at `kh(a,b) = khTan*NUDGE + (khPure/NUDGE - khTan*NUDGE)*b` — b is
    h-depth, from tangency to the d+n solid down to pure h:
    - `khTan(kn) = (1 + √3*kn)/√7` — h tangent to the d+n solid (edge tangency along
      the d–n edge), exact.
    - `khPure(kn) = min(KH_DVAN, kn*KH1u)` where `KH_DVAN = 5/(2√7)` and
      `KH1u = 3√6/(2√14)` — the k at which the last of d/n vanishes. Exact.
    - Both ends carry the usual 1.000001 nudge (outward on `khTan`, inward on `khPure`).
    - Feed `khTan` the same nudged `kn` used for the n planes; that is what makes
      `formAt(a,0)` bit-identical to the old `shapeAt(a)`.

  `shapeAt(t, m = 0) === formAt(...pathAB(t, m))` is the habit-slider path, with
  `pathAB(t, m) = t <= 1 ? [t, m] : [1, (t-1) + m*(2-t)]` — continuous at t=1, m=0
  reproduces the original single-slider path exactly, t=2 is always pure h.

  `formsPresent(map) → {d, n, h}` reads the edge-key ids: a census of the actual
  shape, not a prediction from (a,b).

  Domain errors (`NaN`, `undefined`, `Infinity`, out of range) throw `RangeError`;
  boundaries are inclusive. Exports (same object on `window.GarnetEngine`, set first
  and guarded, then `module.exports`, guarded): `formAt`, `shapeAt`, `pathAB`,
  `formsPresent`, `makePlanes`, `clipShape`, `KN0`, `KN1`, `KH0`, `KH1`, `KH_DVAN`,
  `NUDGE`.

- `index.html` — viewer. Computes `shapeAt(t, m)` **live, every frame** (~0.8 ms
  warm), recomputing only when (t,m) changed. No ladder, no crossfade, every edge
  drawn at fade 1. Two sliders: "Habit" t ∈ [0,2] and "{321} bevel" m ∈ [0,1];
  both eased and clamped before the engine sees them. The habit/species label is
  keyed off `formsPresent(shape)` — what is on screen, not what the slider implies.

## Crystallography invariants

Everything in this section is enforced by `npm test`.

Region map of the (a,b) square, closed form (derived analytically, confirmed by
bisection on the engine):

- n vanishes at `b_n(a) = a / (2(1-a))`, for a ≤ 2/3.
- d vanishes at `b_d(a) = 2(1-a) / a`, for a ≥ 2/3.
- The two curves cross at **a = 2/3** (kn = 5/(3√3)), which is also where `khPure`
  switches branch from `kn*KH1u` to `KH_DVAN`.
- Regions: **d+n+h** below both curves (~36% of the square), **d+h** above b_n for
  a < 2/3 (~45%), **n+h** above b_d for a > 2/3 (~19%).
- Edges: b=0 → the d+n path; b=1 → pure h; a=0 → d, then d+h (the canonical
  "hexoctahedral bevels on a dodecahedron"); a=1 → n, then n+h (the old zone 2,
  scaled by KN1; coordinates agree to ≤2.4e-14).
- {321} lies on the great circle between {110} and {211}, so it bevels the d–n edge
  directly. That is why n strips die so fast as b rises at low a — the h planes eat
  the edge the n faces sit on.

| form                    | V/E/F        |
|-------------------------|--------------|
| d{110} dodecahedron     | 14/24/12     |
| d+n                     | 62/96/36     |
| n{211} trapezohedron    | 26/48/24     |
| n+h                     | 74/144/72    |
| {321} hexoctahedron     | 26/72/48     |
| d+h                     | 62/120/60    |
| d+n+h                   | 110/192/84   |

Face census (edges per face, by form): d — d4 ×12; n — n4 ×24; h — h3 ×48;
d+n — d4, n6; n+h — n6, h3; d+h — d4, h4; d+n+h — d4, n6, h4.

Vertex shells, radius/1.7: d {1, √3/2}; n {1, 2√2/3, √3/2}; h {1, √3/2, 3√2/5}.

Symmetry deviation under all 48 signed permutations of m-3m is ≤3.1e-14 over the
whole test grid; planarity and convexity residuals ≤7.5e-13 as the suite measures
them (face plane fitted from the face's own vertices, not the known normal — a
stricter, more independent test; suite gate is 1e-9 for all three).

The suite enforces V/E/F/χ, point-group symmetry, form purity at the pure-form
corners, the face census, the vertex shells, tangency-constant pinning at k(1±1e-4)
for every transition, seam and 2D continuity, `RangeError` domain semantics, a `vm`
load smoke test (browser context, `window` but no `module`), and golden-path
fixtures against the pre-1.0 engine — 13 checks. The test grid
`G = {0, (2i+1)/20 for i=0..9, 1}` is deliberately offset so it never lands on the
b_n / b_d transition curves (a 10ths grid hits them at (0.5,0.5) and (0.8,0.5));
min distance to a curve is 0.0029 in b.

Truncation ranges use exact radicals: {211} spans k = 2/√3 (tangent to d) down to
√3/2 (d vanishes); {321} spans khTan (tangent to d+n) down to khPure — either
kn·3√6/(2√14) (n vanishes) or KH_DVAN = 5/(2√7) (d vanishes, point tangency).
All re-derived and confirmed exact to ≤2e-16.

The 1.000001 nudge factors: KN0 and KH0 move **outward** to suppress a nucleating
form, KH1 **inward** to suppress a vanishing one — same asymmetry as before. Inside
`formAt` the b=1 nudge (`khPure/1.000001`) is **load-bearing for a > 2/3**: it is the
n-branch edge tangency, and without it b=1 gives 96 edges instead of 72 (fails on
67/201 samples). The b=0 nudge (`khTan*1.000001`) is precautionary — it is the edge
tangency along the d–n edge, 0/201 samples fail without it today, but edge tangencies
are the sliver-prone ones (an edge tangency degenerates to a finite-length zero-width
face that survives the `len2` cull; a point tangency collapses to a point and does
not) and `Math.hypot` precision is implementation-defined, so surviving unnudged here
is not portable. Keep both.

The attribution tolerance in `clipShape` is coupled to these nudges — it must stay
below the ~1e-6 separation they create. Working window is ~1e-14 to ~5e-7; 1e-6
breaks pure h. It is now **1e-10** (was 1e-7, within one decade of the top edge),
which recentres it with ~4 orders of margin each way; verified bit-identical to the
1e-7 output across a 21×21 grid and the 41-step ladder.

Euler χ=2 holds everywhere the ladder, the grid or the sliders can reach — but not
literally everywhere. The `len2 < 1e-10` cull in `clipShape` drops the emerging
form's edges inside ~1e-5-wide windows where its faces have already split the
neighbouring form's vertices; the wireframe then has vertices for a polyhedron it has
no edges or faces for. These windows sit at the pure-form corners as before, and now
also run along the b_n / b_d transition curves (~3e-5 wide in b). Doc-only: the
ladder and the test grid never sample inside one, and the measure is negligible — but
don't call χ=2 an invariant for arbitrary (a,b).

## Hard-won lessons (do not regress)

1. Edge identity comes from **plane pairs**, never from spatial proximity or greedy
   assignment — that approach teleported edges by 1.5–2.9 units whenever edge counts
   collapsed. This is now less visible than it was (the viewer computes each frame
   from scratch and no longer crossfades between ladder steps), but it is exactly what
   makes continuity testable — Hausdorff and shared-edge displacement between
   neighbouring parameter points are only meaningful because edges have stable names —
   and it is the prerequisite for any future crossfade or face-shaded mode. The
   41-step ladder itself lives on in the test suite as sampled verification.
2. Edge→plane-pair attribution must be **geometric** (midpoint-on-plane test), not
   provenance tags threaded through the clipper — tags go stale after successive
   clips. The abandoned tag approach left a dead `src` field on every vertex until
   v1.0.0.
3. The face-count jump at t≈1.0 ({321} nucleation, 24→72 faces at once) is correct
   physics — symmetry demands all 48 faces nucleate simultaneously at zero area.
   Don't "fix" it.

## Backlog

- {311} icositetrahedron. **Literature claim on grossular is unverified — do not add
  species text without a source.** Geometrically coherent: `permsSigns([3,1,1])`
  yields 24 planes and {hll} is a deltoidal icositetrahedron.
- Drag-to-rotate / inertia on the canvas.
- Face-shaded rendering mode (translucent faces + edges), per-variety RI-ish look.
- Export current form as OBJ/STL.
- Suggested review workflow: use subagents — one crystallography reviewer
  (verify invariants above + literature), one code reviewer (perf, degeneracy,
  numerical edge cases). This mirrors how the project was originally built.

## Context

Built for Scott (Ventura, CA — gemology/mineralogy background). Variety colors:
pyrope, almandine, spessartine, hessonite, demantoid, uvarovite, tuned for
black background. Labels pair each habit with the species that favor it.
